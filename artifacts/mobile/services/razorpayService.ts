import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RazorpayCartItem = {
  id: string;
  price: number;
  qty: number;
  is_course?: boolean;
  course_id?: string | null;
};

export type RazorpayOrderResult = {
  id: string;        // Razorpay order_id  e.g. "order_Abc123"
  amount: number;    // in paise           e.g. 49900 for ₹499
  currency: string;  // "INR"
  key_id: string;    // Razorpay Key ID    e.g. "rzp_live_..."
};

export type PaymentVerifyParams = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  amount: number;
  user_id: string;
  coupon_code?: string | null;
  coupon_id?: string | null;
  discount_amount?: number;
  tax_amount?: number;
};

// ─── Create Razorpay Order ────────────────────────────────────────────────────
// Calls the same Supabase edge function used by the web app.

export async function createRazorpayOrder(
  items: RazorpayCartItem[],
  totalAmount: number,
): Promise<RazorpayOrderResult> {
  const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
    body: {
      items: items.map((i) => ({
        id: i.is_course ? (i.course_id ?? i.id) : i.id,
        qty: i.qty,
        is_course: i.is_course ?? false,
        price: i.price,
      })),
      total_amount: totalAmount,
      currency: "INR",
      receipt: `mobile_${Date.now()}`,
      notes: { source: "mobile_app" },
    },
  });

  if (error) {
    throw new Error(`Could not create payment order: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Invalid response from payment server");
  }

  return data as RazorpayOrderResult;
}

// ─── Verify Payment Signature ─────────────────────────────────────────────────
// Calls the verify-razorpay-payment edge function to validate the signature.

export async function verifyRazorpayPayment(
  params: PaymentVerifyParams,
): Promise<{ success: boolean; payment_id?: string }> {
  const { data, error } = await supabase.functions.invoke("verify-razorpay-payment", {
    body: params,
  });

  if (error) {
    throw new Error(`Payment verification failed: ${error.message}`);
  }

  // The shared edge function (same one the web app uses) returns
  // { verified: boolean } — NOT { success }. Normalize it here so callers
  // keep a stable shape. This was silently failing every mobile payment.
  const verified = (data as any)?.verified === true || (data as any)?.success === true;
  return { success: verified, payment_id: (data as any)?.payment_id };
}