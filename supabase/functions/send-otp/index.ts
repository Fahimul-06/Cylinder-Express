import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};


function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeBdPhone(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, "");
  // 01XXXXXXXXX (11 digits) → 8801XXXXXXXXX
  if (/^01[3-9]\d{8}$/.test(cleaned)) return "88" + cleaned;
  // Already 8801XXXXXXXXX (13 digits)
  if (/^8801[3-9]\d{8}$/.test(cleaned)) return cleaned;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const internationalPhone = normalizeBdPhone(phone);
    if (!internationalPhone) {
      return new Response(
        JSON.stringify({ error: "Enter a valid Bangladesh mobile number (e.g. 01XXXXXXXXX)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otp = generateOtp();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Remove any existing unused OTPs for this phone
    await supabase
      .from("otp_verifications")
      .delete()
      .eq("phone", phone)
      .eq("used", false);

    const { error: insertError } = await supabase
      .from("otp_verifications")
      .insert({
        phone,
        otp,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

    if (insertError) {
      console.error("DB insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create OTP. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bulkSmsApiKey = Deno.env.get("BULKSMSBD_API_KEY");
    const bulkSmsSenderId = Deno.env.get("BULKSMSBD_SENDER_ID");

    if (!bulkSmsApiKey || !bulkSmsSenderId) {
      console.error("Missing BulkSMSBD environment variables");
      return new Response(
        JSON.stringify({ error: "SMS service is not configured. Please contact support." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS via BulkSMSBD
    const message = `Your CylinderExpress OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`;
    const smsUrl = new URL("https://bulksmsbd.net/api/smsapi");
    smsUrl.searchParams.set("api_key", bulkSmsApiKey);
    smsUrl.searchParams.set("type", "text");
    smsUrl.searchParams.set("number", internationalPhone);
    smsUrl.searchParams.set("senderid", bulkSmsSenderId);
    smsUrl.searchParams.set("message", message);

    const smsRes = await fetch(smsUrl.toString(), { method: "GET" });
    const smsText = await smsRes.text();

    let smsJson: { response_code?: number; error_message?: string } = {};
    try { smsJson = JSON.parse(smsText); } catch { /* non-JSON response */ }

    if (smsJson.response_code && smsJson.response_code !== 202) {
      console.error("BulkSMSBD error:", smsText);
      return new Response(
        JSON.stringify({ error: smsJson.error_message || "Failed to send SMS. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent to " + phone }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-otp error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
