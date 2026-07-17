// supabase/functions/_shared/shiprocket.ts

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";
const PICKUP_PINCODE = "500034"; // MakersFlow warehouse pincode (Hyderabad)

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export interface ShiprocketRate {
  success: boolean;
  fee: number | null;
  courierName: string;
  estimatedDays: string;
  source: "shiprocket" | "fallback";
}

async function getToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const email = Deno.env.get("SHIPROCKET_EMAIL");
  const password = Deno.env.get("SHIPROCKET_PASSWORD");

  if (!email || !password) {
    console.warn("[Shiprocket] Credentials not set in environment");
    return null;
  }

  try {
    const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      console.warn("[Shiprocket] Auth failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    if (!data.token) {
      console.warn("[Shiprocket] Auth succeeded but no token returned");
      return null;
    }

    cachedToken = data.token;
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // Cache for 23 hours
    return cachedToken;
  } catch (err) {
    console.warn("[Shiprocket] Auth error:", err);
    return null;
  }
}

export async function getShiprocketRate(params: {
  deliveryPincode: string;
  weightKg: number;
  declaredValue: number;
}): Promise<ShiprocketRate> {
  const fallback: ShiprocketRate = {
    success: false,
    fee: null,
    courierName: "Standard Delivery",
    estimatedDays: "3-7 days",
    source: "fallback",
  };

  const pincode = String(params.deliveryPincode ?? "").replace(/\D/g, "").trim();
  if (!pincode || pincode.length !== 6) return fallback;

  const token = await getToken();
  if (!token) return fallback;

  try {
    const weight = Math.max(params.weightKg, 0.1);
    const url = new URL(`${SHIPROCKET_BASE}/courier/serviceability/`);
    url.searchParams.set("pickup_postcode", PICKUP_PINCODE);
    url.searchParams.set("delivery_postcode", pincode);
    url.searchParams.set("weight", String(weight));
    url.searchParams.set("cod", "0");
    url.searchParams.set("declared_value", String(params.declaredValue));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("[Shiprocket] Serviceability query failed:", res.status, text);
      return fallback;
    }

    const data = await res.json();
    const couriers: any[] = data?.data?.available_courier_companies ?? [];

    if (couriers.length === 0) return fallback;

    const sorted = couriers
      .filter((c) => typeof c.rate === "number" && c.rate > 0)
      .sort((a, b) => a.rate - b.rate);

    if (sorted.length === 0) return fallback;

    const best = sorted[0];
    return {
      success: true,
      fee: Math.round(best.rate),
      courierName: best.courier_name ?? "Shiprocket",
      estimatedDays: best.estimated_delivery_days ? `${best.estimated_delivery_days} days` : "3-5 days",
      source: "shiprocket",
    };
  } catch (err) {
    console.warn("[Shiprocket] Serviceability exception:", err);
    return fallback;
  }
}

export async function createShiprocketOrder(orderId: string, orderData: any): Promise<any> {
  const token = await getToken();
  if (!token) {
    console.warn("[Shiprocket] No token available for order creation");
    return null;
  }

  const payload = {
    order_id: orderId,
    order_date: new Date().toISOString().split("T")[0],
    pickup_location: "Hyderabad",
    billing_customer_name: orderData.shipping_address.name || "Customer",
    billing_address: orderData.shipping_address.address,
    billing_city: orderData.shipping_address.city,
    billing_pincode: orderData.shipping_address.pincode,
    billing_phone: orderData.shipping_address.phone,
    shipping_is_billing: true,
    order_items: orderData.items.map((i: any) => ({
      name: i.title,
      sku: String(i.id),
      units: i.qty,
      selling_price: i.price,
    })),
    payment_method: "Prepaid",
    sub_total: orderData.total_amount,
    length: 10,
    breadth: 10,
    height: 10,
    weight: orderData.total_weight || 0.5,
  };

  try {
    const res = await fetch(`${SHIPROCKET_BASE}/orders/create/adhoc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Shiprocket] Order creation request failed:", res.status, text);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("[Shiprocket] Order creation exception:", err);
    return null;
  }
}
