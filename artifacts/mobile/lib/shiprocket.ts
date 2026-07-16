/**
 * Shiprocket Shipping Rate Integration
 * API Docs: https://apidocs.shiprocket.in/
 *
 * Credentials from .env:
 *   EXPO_PUBLIC_SHIPROCKET_EMAIL    — your Shiprocket API email
 *   EXPO_PUBLIC_SHIPROCKET_PASSWORD — your Shiprocket API password
 *
 * How it works:
 *  1. Authenticate → get JWT token (cached for 24h)
 *  2. Call serviceability API with pickup/delivery pincodes + weight
 *  3. Return cheapest available courier rate
 *  4. Falls back to admin flat rates if Shiprocket fails
 *
 * FIX: Supabase column is `postal_code` — address objects must always have
 * this key.  The caller (checkout.tsx) now normalizes before calling this fn.
 */

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";

// MakersFlow warehouse pincode (Hyderabad)
const PICKUP_PINCODE = "500034";

// Token cache — Shiprocket tokens are valid for 24 hours
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export interface ShiprocketRate {
  fee: number;
  courierName: string;
  estimatedDays: string;
  source: "shiprocket" | "fallback";
}

async function getToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const email = process.env.EXPO_PUBLIC_SHIPROCKET_EMAIL ?? "";
  const password = process.env.EXPO_PUBLIC_SHIPROCKET_PASSWORD ?? "";

  if (!email || !password) {
    console.warn("[Shiprocket] Credentials not set — add EXPO_PUBLIC_SHIPROCKET_EMAIL and EXPO_PUBLIC_SHIPROCKET_PASSWORD to your .env");
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
      console.warn("[Shiprocket] Auth succeeded but no token in response:", JSON.stringify(data));
      return null;
    }

    cachedToken = data.token;
    // Cache for 23 hours (token valid 24h, refresh 1h early)
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
    console.log("[Shiprocket] Auth OK — token cached for 23h");
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
  fallbackFee: number;
  codEnabled?: boolean;
}): Promise<ShiprocketRate> {
  const fallback: ShiprocketRate = {
    fee: params.fallbackFee,
    courierName: "Standard Delivery",
    estimatedDays: "3-7 days",
    source: "fallback",
  };

  // FIX: strip non-digits and validate length
  const pincode = String(params.deliveryPincode ?? "").replace(/\D/g, "").trim();
  if (!pincode || pincode.length !== 6) {
    console.warn("[Shiprocket] Invalid delivery pincode:", params.deliveryPincode, "→ cleaned:", pincode);
    return fallback;
  }

  const token = await getToken();
  if (!token) {
    console.warn("[Shiprocket] No auth token — using fallback rate");
    return fallback;
  }

  try {
    const weight = Math.max(params.weightKg, 0.1);
    const url = new URL(`${SHIPROCKET_BASE}/courier/serviceability/`);
    url.searchParams.set("pickup_postcode", PICKUP_PINCODE);
    url.searchParams.set("delivery_postcode", pincode);
    url.searchParams.set("weight", String(weight));
    url.searchParams.set("cod", params.codEnabled ? "1" : "0");
    url.searchParams.set("declared_value", String(params.declaredValue));

    console.log("[Shiprocket] Serviceability query:", url.toString());

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn("[Shiprocket] Serviceability failed:", res.status, body);
      // If 401, clear token so next call re-authenticates
      if (res.status === 401) {
        cachedToken = null;
        tokenExpiry = 0;
      }
      return fallback;
    }

    const data = await res.json();
    const couriers: any[] = data?.data?.available_courier_companies ?? [];

    console.log("[Shiprocket] Available couriers:", couriers.length);

    if (couriers.length === 0) {
      console.warn("[Shiprocket] No couriers available for pincode:", pincode);
      return fallback;
    }

    // Sort by rate — pick cheapest with a valid rate
    const sorted = couriers
      .filter((c) => typeof c.rate === "number" && c.rate > 0)
      .sort((a, b) => a.rate - b.rate);

    if (sorted.length === 0) {
      console.warn("[Shiprocket] All couriers have rate ≤ 0");
      return fallback;
    }

    const best = sorted[0];
    console.log("[Shiprocket] Best rate:", best.courier_name, "₹", best.rate, "in", best.estimated_delivery_days, "days");

    return {
      fee: Math.round(best.rate),
      courierName: best.courier_name ?? "Shiprocket",
      estimatedDays: best.estimated_delivery_days
        ? `${best.estimated_delivery_days} day${Number(best.estimated_delivery_days) === 1 ? "" : "s"}`
        : "3-5 days",
      source: "shiprocket",
    };
  } catch (err) {
    console.warn("[Shiprocket] Rate fetch error:", err);
    return fallback;
  }
}
