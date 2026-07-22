/**
 * notify-order-update
 * ───────────────────
 * Fired by a Supabase Database Webhook whenever an order's status changes.
 * Sends a push notification to the customer AND writes an in-app notification row.
 *
 * Webhook setup (Supabase Dashboard → Database → Webhooks):
 *   Table:  orders
 *   Events: UPDATE
 *   Type:   Supabase Edge Functions
 *   Edge Function: notify-order-update
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  paid:             { title: "Payment Confirmed", body: "Your payment has been confirmed. We are preparing your order." },
  packed:           { title: "Order Packed",      body: "Your order has been packed and is ready for dispatch." },
  shipped:          { title: "Order Shipped",     body: "Your order is on its way! Track it in My Orders." },
  out_for_delivery: { title: "Out for Delivery",  body: "Your order is out for delivery. Expect it today!" },
  delivered:        { title: "Order Delivered",   body: "Your order has been delivered. Enjoy! Rate your experience in the app." },
  cancelled:        { title: "Order Cancelled",   body: "Your order has been cancelled. Contact support if you need help." },
  refund_requested: { title: "Refund Requested",  body: "Your refund request has been received. Our team will review it shortly." },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    const newRecord = payload.record;
    const oldRecord = payload.old_record;
    if (!newRecord) return new Response("Invalid payload", { status: 400 });

    const newStatus = (newRecord.status ?? "").toLowerCase();
    const oldStatus = (oldRecord?.status ?? "").toLowerCase();

    if (newStatus === oldStatus) {
      return new Response(JSON.stringify({ skipped: true, reason: "Status unchanged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const message = STATUS_MESSAGES[newStatus];
    if (!message) {
      return new Response(JSON.stringify({ skipped: true, reason: `No message for status: ${newStatus}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = newRecord.user_id;
    if (!userId) return new Response("No user_id in order", { status: 400 });

    // In-app notification row — columns MUST match the notifications table:
    // (user_id, title, body, type, link, is_read). No 'data' column exists.
    await supabase.from("notifications").insert({
      user_id: userId,
      title: message.title,
      body: message.body,
      type: "order",
      link: "/store/orders",
      is_read: false,
    });

    // Push via the core function (looks up this user's tokens itself)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        user_ids: [userId],
        title: message.title,
        body: message.body,
        data: { screen: "orders", orderId: String(newRecord.id), status: newStatus },
      }),
    });

    const result = await sendRes.json();
    return new Response(JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[OrderPush] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
