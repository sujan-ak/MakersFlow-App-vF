// Supabase Edge Function: verify-whatsapp-otp
// Verifies the OTP server-side, then returns a one-time magiclink token_hash.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { Database } from "../_shared/database.types.ts";

const supabase = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_VERIFY_ATTEMPTS = 5;

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+\d{10,15}$/, "Invalid phone format"),
  code: z.string().regex(/^\d{6}$/, "Verification code must be exactly 6 digits"),
});

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const result = verifyOtpSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid phone or verification code" }, { status: 400, headers: cors });
    }
    const { phone, code } = result.data;

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
        { error: `Too many OTP verification requests. Please try again in ${phoneResult[0].backoff_seconds} seconds.` },
        { status: 429, headers: cors }
      );
    }

    // Latest unexpired, unused OTP for this phone
    const { data: otp } = await supabase
      .from("whatsapp_otps")
      .select("id, code_hash, expires_at, attempts, used_at")
      .eq("phone", phone)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp || new Date(otp.expires_at) < new Date()) {
      return Response.json({ error: "Code expired. Request a new one." }, { status: 400, headers: cors });
    }
    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      return Response.json({ error: "Too many attempts. Request a new code." }, { status: 429, headers: cors });
    }

    const codeHash = await sha256(String(code));
    if (codeHash !== otp.code_hash) {
      await supabase
        .from("whatsapp_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      return Response.json({ error: "Invalid code" }, { status: 400, headers: cors });
    }

    // Mark used (single-use)
    await supabase
      .from("whatsapp_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otp.id);

    // Find the account tied to this phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("phone", phone)
      .maybeSingle();

    if (!profile?.email) {
      return Response.json(
        { error: "No account is linked to this WhatsApp number. Log in with email first and add your phone in Profile." },
        { status: 404, headers: cors },
      );
    }

    // Mint a one-time token the client can exchange for a session
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("[verify-whatsapp-otp] generateLink failed:", linkError);
      return Response.json({ error: "Could not create session" }, { status: 500, headers: cors });
    }

    return Response.json(
      { success: true, token_hash: linkData.properties.hashed_token },
      { headers: cors },
    );
  } catch (e) {
    console.error("[verify-whatsapp-otp] error:", e);
    return Response.json(
      { error: "An unexpected error occurred while verifying the code" },
      { status: 500, headers: cors }
    );
  }
});
