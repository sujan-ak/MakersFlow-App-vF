// supabase/functions/create-razorpay-order/index.ts

import { createClient } from "npm:@supabase/supabase-js@2";
import { getShiprocketRate } from "../_shared/shiprocket.ts";
import { Database } from "../_shared/database.types.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }

    const userClient = createClient<Database>(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }

    const body = await req.json();
    const { items, total_amount, user_id, shipping_address, promo_code, discount_amount } = body;

    if (user_id !== user.id) {
      return Response.json({ error: "Forbidden: user_id mismatch" }, { status: 403, headers: cors });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "Cart is empty" }, { status: 400, headers: cors });
    }

    // Fetch live product records from public.products
    const productIds = items.map((i: any) => String(i.id));
    const { data: dbProducts, error: dbError } = await supabaseAdmin
      .from("products")
      .select("id, price, is_course, course_id, weight")
      .in("id", productIds);

    if (dbError || !dbProducts) {
      console.error("[create-razorpay-order] DB lookup failed:", dbError);
      return Response.json({ error: "Product verification failed" }, { status: 500, headers: cors });
    }

    const dbProductMap = new Map(dbProducts.map((p) => [String(p.id), p]));

    // Recalculate prices and weights
    let calculatedSubtotal = 0;
    let physicalSubtotal = 0;
    let totalWeight = 0;
    let hasPhysical = false;

    for (const item of items) {
      const dbProd = dbProductMap.get(String(item.id));
      if (!dbProd) {
        return Response.json({ error: `Product ID ${item.id} not found in database` }, { status: 400, headers: cors });
      }
      
      const price = Number(dbProd.price);
      calculatedSubtotal += price * item.qty;
      
      const isPhysical = !dbProd.is_course && dbProd.course_id === null;
      if (isPhysical) {
        hasPhysical = true;
        physicalSubtotal += price * item.qty;
        totalWeight += (Number(dbProd.weight) || 0.5) * item.qty;
      }
    }

    // Enforce shipping address for physical items
    if (hasPhysical && (!shipping_address || !shipping_address.pincode)) {
      return Response.json({ error: "Shipping address with pincode is required for physical items" }, { status: 400, headers: cors });
    }

    // Apply discount if present
    const discount = Number(discount_amount) || 0;
    const discountedSubtotal = Math.max(calculatedSubtotal - discount, 0);

    // Recalculate 18% GST (tax)
    const calculatedTax = discountedSubtotal * 0.18;
    let recalculatedTotal = discountedSubtotal + calculatedTax;

    // Recalculate shipping cost if physical
    let shippingFee = 0;
    if (hasPhysical && shipping_address) {
      const shippingRateResult = await getShiprocketRate({
        deliveryPincode: shipping_address.pincode,
        weightKg: totalWeight,
        declaredValue: physicalSubtotal,
      });

      if (!shippingRateResult.success || shippingRateResult.fee === null) {
        return Response.json(
          { error: "Shipping calculation temporarily unavailable, please try again" },
          { status: 503, headers: cors }
        );
      }

      shippingFee = shippingRateResult.fee;
      recalculatedTotal += shippingFee;
    }

    // Compare with client-submitted total (within a 0.05 INR tolerance)
    if (Math.abs(recalculatedTotal - Number(total_amount)) > 0.05) {
      console.warn(`[create-razorpay-order] Total mismatch: Recalculated ${recalculatedTotal} vs Submitted ${total_amount}`);
      return Response.json({ error: "Cart total amount verification failed" }, { status: 400, headers: cors });
    }

    // Initialize Razorpay Order
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      console.error("[create-razorpay-order] Razorpay credentials missing");
      return Response.json({ error: "Payment gateway is not configured" }, { status: 500, headers: cors });
    }

    const amountInPaise = Math.round(recalculatedTotal * 100);
    const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now()}_${user.id.substring(0, 8)}`,
      }),
    });

    if (!razorpayRes.ok) {
      const errText = await razorpayRes.text();
      console.error("[create-razorpay-order] Razorpay order creation failed:", errText);
      return Response.json({ error: "Failed to create payment order" }, { status: 502, headers: cors });
    }

    const rzpOrder = await razorpayRes.json();

    // Map order items for database storage
    const orderItems = items.map((item) => {
      const dbProd = dbProductMap.get(String(item.id))!;
      return {
        id: String(item.id),
        title: item.title,
        price: Number(dbProd.price),
        qty: item.qty,
        is_course: !!(dbProd.is_course || dbProd.course_id),
        course_id: dbProd.course_id ? String(dbProd.course_id) : (dbProd.is_course ? String(dbProd.id) : null),
      };
    });

    // Write pending order into the database
    const { data: dbOrder, error: orderInsertError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: user.id,
        total_amount: recalculatedTotal,
        status: "pending",
        razorpay_order_id: rzpOrder.id,
        promo_code: promo_code || null,
        discount_amount: discount,
        tax_amount: calculatedTax,
        shipping_address: shipping_address || null,
        items: orderItems,
        shipment_status: hasPhysical ? "pending" : null,
      })
      .select("id")
      .single();

    if (orderInsertError || !dbOrder) {
      console.error("[create-razorpay-order] Database insertion failed:", orderInsertError);
      return Response.json({ error: "Failed to initialize order record" }, { status: 500, headers: cors });
    }

    return Response.json({
      success: true,
      orderId: dbOrder.id,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    }, { headers: cors });

  } catch (err) {
    console.error("[create-razorpay-order] exception:", err);
    return Response.json({ error: "An unexpected server error occurred" }, { status: 500, headers: cors });
  }
});
