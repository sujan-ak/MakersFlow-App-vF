// Supabase Edge Function: send-whatsapp-otp
// Sends a 6-digit OTP to the given phone number over WhatsApp using a
// provider (Twilio WhatsApp Business API by default; MSG91/Gupshup work the
// same way — swap the sendViaProvider implementation).
//
// Required secrets (supabase secrets set ...):
//   SB_SERVICE_ROLE_KEY   – service role key (auto-injected as SUPABASE_SERVICE_ROLE_KEY)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. "whatsapp:+14155238886")
//
// Table required: whatsapp_otps (see docs/migrations/2026-07_premium_features.sql)

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const OTP_TTL_MINUTES = 10;
const MAX_SENDS_PER_HOUR = 5;

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendViaProvider(phone: string, code: string): Promise<void> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (!sid || !token || !from) {
    throw new Error("WhatsApp provider is not configured");
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${sid}:${token}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from,
        To: `whatsapp:${phone}`,
        Body: `Your Edodwaja verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.error("[send-whatsapp-otp] provider error:", text);
    throw new Error("Failed to deliver WhatsApp message");
  }
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { phone } = await req.json();
    if (!phone || !/^\+\d{10,15}$/.test(phone)) {
      return Response.json({ error: "Invalid phone number" }, { status: 400, headers: cors });
    }

    // Rate limit: max sends per phone per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("whatsapp_otps")
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= MAX_SENDS_PER_HOUR) {
      return Response.json(
        { error: "Too many OTP requests. Please try again later." },
        { status: 429, headers: cors },
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: insertError } = await supabase.from("whatsapp_otps").insert({
      phone,
      code_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    await sendViaProvider(phone, code);

    return Response.json({ success: true }, { headers: cors });
  } catch (e) {
    console.error("[send-whatsapp-otp]", e);
    return Response.json(
      { error: (e as Error).message ?? "Failed to send OTP" },
      { status: 500, headers: cors },
    );
  }
});
