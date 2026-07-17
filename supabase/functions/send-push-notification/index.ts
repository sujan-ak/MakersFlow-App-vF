/**
 * send-push-notification
 * ─────────────────────
 * Core function that sends Expo push notifications to one or many users.
 *
 * POST body:
 * {
 *   user_ids: string[]          // array of Supabase user IDs to notify
 *   title:    string            // notification title
 *   body:     string            // notification body text
 *   data?:    Record<string,any> // optional deep-link data e.g. { screen: 'orders', orderId: '123' }
 *   sound?:   'default' | null  // default: 'default'
 * }
 *
 * Can also be called with:
 * {
 *   tokens:  string[]   // raw Expo push tokens (bypasses user lookup)
 *   title:   string
 *   body:    string
 *   data?:   Record<string,any>
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const body = await req.json();
    const { title, body: msgBody, data = {}, sound = "default" } = body;

    if (!title || !msgBody) {
      return new Response(
        JSON.stringify({ error: "title and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let tokens: string[] = [];

    // Option A — raw tokens passed directly
    if (Array.isArray(body.tokens) && body.tokens.length > 0) {
      tokens = body.tokens;
    }
    // Option B — user IDs passed, look up their tokens
    else if (Array.isArray(body.user_ids) && body.user_ids.length > 0) {
      const { data: rows, error } = await supabase
        .from("push_tokens")
        .select("token")
        .in("user_id", body.user_ids);

      if (error) {
        console.error("[Push] Token lookup error:", error.message);
        return new Response(
          JSON.stringify({ error: "Failed to fetch push tokens" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      tokens = (rows ?? []).map((r: any) => r.token).filter(Boolean);
    }
    // Option C — send to ALL users (broadcast)
    else if (body.broadcast === true) {
      const { data: rows, error } = await supabase
        .from("push_tokens")
        .select("token");

      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch push tokens" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      tokens = (rows ?? []).map((r: any) => r.token).filter(Boolean);
    }

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No tokens to send to" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Expo push API accepts max 100 messages per request — chunk them
    const CHUNK_SIZE = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      chunks.push(tokens.slice(i, i + CHUNK_SIZE));
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const chunk of chunks) {
      const messages = chunk.map((token) => ({
        to: token,
        title,
        body: msgBody,
        data,
        sound,
        priority: "high",
        channelId: "default",
      }));

      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        console.error("[Push] Expo API error:", res.status, await res.text());
        totalFailed += chunk.length;
        continue;
      }

      const result = await res.json();
      const receipts: any[] = result?.data ?? [];

      for (const receipt of receipts) {
        if (receipt.status === "ok") {
          totalSent++;
        } else {
          totalFailed++;
          console.warn("[Push] Delivery error:", receipt.details?.error);
        }
      }
    }

    console.log(`[Push] Sent: ${totalSent}, Failed: ${totalFailed}, Total tokens: ${tokens.length}`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Push] Unexpected error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
