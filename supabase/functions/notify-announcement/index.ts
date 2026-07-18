/**
 * notify-announcement
 * ───────────────────
 * Called by a Supabase Database Webhook when an announcement is published.
 * Broadcasts a push notification to ALL users who have registered tokens.
 *
 * Set up a Database Webhook in Supabase:
 *   Table: announcements
 *   Events: INSERT, UPDATE
 *   URL: https://<project>.supabase.co/functions/v1/notify-announcement
 *
 * Can also be called manually from admin panel:
 * POST body: { title: string, body: string, data?: object }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const payload = await req.json();

    let title: string;
    let body: string;
    let data: Record<string, any> = {};

    // Called from Database Webhook (INSERT/UPDATE on announcements)
    if (payload.record) {
      const record = payload.record;

      // Only send for published announcements
      if (record.status !== "published") {
        return new Response(
          JSON.stringify({ skipped: true, reason: "Not published" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // On UPDATE — only notify if it just became published
      if (payload.type === "UPDATE" && payload.old_record?.status === "published") {
        return new Response(
          JSON.stringify({ skipped: true, reason: "Already was published" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      title = record.title ?? "New Announcement";
      body = record.summary ?? record.content ?? "Check the latest update from MakersFlow.";
      data = { screen: "announcements", announcementId: String(record.id) };
    }
    // Called manually from admin
    else if (payload.title && payload.body) {
      title = payload.title;
      body = payload.body;
      data = payload.data ?? {};
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Broadcast to all users
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
          broadcast: true,
          title,
          body,
          data,
        }),
      }
    );

    const result = await sendRes.json();
    console.log("[AnnouncePush] Result:", result);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[AnnouncePush] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
