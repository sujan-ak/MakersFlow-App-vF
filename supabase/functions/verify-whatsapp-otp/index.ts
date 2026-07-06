// Supabase Edge Function: verify-whatsapp-otp
// Verifies the OTP server-side, then returns a one-time magiclink token_hash
// that the mobile client exchanges for a session via
// supabase.auth.verifyOtp({ type: 'magiclink', token_hash }).
//
// Note: the user must already have an account with an email + this phone
// number saved on their profile (profiles.phone). WhatsApp OTP is an
// alternative login channel, not a signup channel.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_VERIFY_ATTEMPTS = 5;

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { phone, code } = await req.json();
    if (!phone || !code) {
      return Response.json({ error: "Missing phone or code" }, { status: 400, headers: cors });
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
    console.error("[verify-whatsapp-otp]", e);
    return Response.json(
      { error: (e as Error).message ?? "Verification failed" },
      { status: 500, headers: cors },
    );
  }
});
