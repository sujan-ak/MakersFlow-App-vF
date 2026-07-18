/**
 * notify-order-update
 * ───────────────────
 * Called by a Supabase Database Webhook whenever an order's status changes.
 * Sends a push notification to the customer with the new status.
 *
 * Set up a Database Webhook in Supabase:
 *   Table: orders
 *   Events: UPDATE
 *   URL: https://<project>.supabase.co/functions/v1/notify-order-update
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Status → human-readable message
const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  paid: {
    title: "Payment Confirmed",
    body: "Your payment has been confirmed. We are preparing your order.",
  },
  packed: {
    title: "Order Packed",
    body: "Your order has been packed and is ready for dispatch.",
  },
  shipped: {
    title: "Order Shipped",
    body: "Your order is on its way! Track it in My Orders.",
  },
  out_for_delivery: {
    title: "Out for Delivery",
    body: "Your order is out for delivery. Expect it today!",
  },
  delivered: {
    title: "Order Delivered",
    body: "Your order has been delivered. Enjoy! Rate your experience in the app.",
  },
  cancelled: {
    title: "Order Cancelled",
    body: "Your order has been cancelled. Contact support if you need help.",
  },
  refund_requested: {
    title: "Refund Requested",
    body: "Your refund request has been received. Our team will review it shortly.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();

    // Supabase webhook sends { type, table, record, old_record }
    const newRecord = payload.record;
    const oldRecord = payload.old_record;

    if (!newRecord || !oldRecord) {
      return new Response("Invalid payload", { status: 400 });
    }

    const newStatus = (newRecord.status ?? "").toLowerCase();
    const oldStatus = (oldRecord.status ?? "").toLowerCase();

    // Only notify if status actually changed
    if (newStatus === oldStatus) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Status unchanged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = STATUS_MESSAGES[newStatus];
    if (!message) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `No message for status: ${newStatus}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newRecord.user_id;
    if (!userId) {
      return new Response("No user_id in order", { status: 400 });
    }

    // Get user's push tokens
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId);

    if (tokenError || !tokens || tokens.length === 0) {
      console.log("[OrderPush] No tokens for user:", userId);
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the core send function
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const sendRes = await fetch(
      `${SUPABASE_URL}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          tokens: tokens.map((t: any) => t.token),
          title: message.title,
          body: message.body,
          data: {
            screen: "orders",
            orderId: String(newRecord.id),
            status: newStatus,
          },
        }),
      }
    );

    const result = await sendRes.json();
    console.log("[OrderPush] Result:", result);

    // Also insert a notification record in the notifications table
    await supabase.from("notifications").insert({
      user_id: userId,
      title: message.title,
      body: message.body,
      type: "order",
      data: JSON.stringify({ orderId: String(newRecord.id), status: newStatus }),
      is_read: false,
    }).catch((e: any) => {
      console.warn("[OrderPush] Failed to insert notification row:", e.message);
    });

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[OrderPush] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
