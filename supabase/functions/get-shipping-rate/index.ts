// supabase/functions/get-shipping-rate/index.ts

import { getShiprocketRate } from "../_shared/shiprocket.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { deliveryPincode, weightKg, declaredValue } = await req.json();
    
    if (!deliveryPincode) {
      return Response.json({ error: "Delivery pincode is required" }, { status: 400, headers: cors });
    }

    const rateResult = await getShiprocketRate({
      deliveryPincode,
      weightKg: Number(weightKg) || 0.5,
      declaredValue: Number(declaredValue) || 100,
    });

    if (!rateResult.success) {
      return Response.json(
        { error: "Shipping calculation temporarily unavailable, please try again" },
        { status: 503, headers: cors }
      );
    }

    return Response.json(rateResult, { headers: cors });
  } catch (err) {
    console.error("[get-shipping-rate] error:", err);
    return Response.json(
      { error: "An unexpected error occurred while calculating shipping rate" },
      { status: 500, headers: cors }
    );
  }
});
