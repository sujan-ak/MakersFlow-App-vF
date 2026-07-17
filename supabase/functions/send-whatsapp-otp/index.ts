// Supabase Edge Function: send-whatsapp-otp
// Sends a 6-digit OTP to the given phone number over WhatsApp using Twilio.
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. "whatsapp:+14155238886")

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { Database } from "../_shared/database.types.ts";

const supabase = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const OTP_TTL_MINUTES = 10;

const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+\d{10,15}$/, "Invalid phone number format"),
});

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
        Body: `Your MakersFlow verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.error("[send-whatsapp-otp] provider error:", text);
    throw new Error("Failed to deliver WhatsApp message");
  }
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const result = sendOtpSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid phone number formatting" }, { status: 400, headers: cors });
    }
    const { phone } = result.data;

    // Rate limiting check
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

    // 1. IP rate limiting (looser: e.g. max 20 requests per hour)
    const ipKey = `ip:${clientIP}`;
    const { data: ipResult, error: ipError } = await supabase.rpc("check_rate_limit", {
      p_key: ipKey,
      p_limit: 20,
      p_window_interval: "1 hour"
    });
    if (ipError) throw ipError;
    if (ipResult && ipResult.length > 0 && !ipResult[0].allowed) {
      return Response.json(
        { error: `Too many requests from this network. Please try again in ${ipResult[0].backoff_seconds} seconds.` },
        { status: 429, headers: cors }
      );
    }

    // 2. Phone rate limiting (strict: e.g. max 5 requests per hour)
    const phoneKey = `phone:${phone}`;
    const { data: phoneResult, error: phoneError } = await supabase.rpc("check_rate_limit", {
      p_key: phoneKey,
      p_limit: 5,
      p_window_interval: "1 hour"
    });
    if (phoneError) throw phoneError;
    if (phoneResult && phoneResult.length > 0 && !phoneResult[0].allowed) {
      return Response.json(
        { error: `Too many OTP requests for this number. Please try again in ${phoneResult[0].backoff_seconds} seconds.` },
        { status: 429, headers: cors }
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
    console.error("[send-whatsapp-otp] error:", e);
    return Response.json(
      { error: "An unexpected error occurred while sending the verification code" },
      { status: 500, headers: cors }
    );
  }
});
