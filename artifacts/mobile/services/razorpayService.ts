import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RazorpayCartItem = {
  id: string;
  price: number;
  qty: number;
  is_course?: boolean;
  course_id?: string | null;
  title?: string;
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
  userId: string,
  shippingAddress: any,
  promoCode?: string | null,
  discountAmount?: number
): Promise<RazorpayOrderResult> {
  const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
    body: {
      items: items.map((i) => ({
        id: i.id,
        qty: i.qty,
        is_course: i.is_course ?? false,
        price: i.price,
        title: i.title || "Product Item",
      })),
      total_amount: totalAmount,
      user_id: userId,
      shipping_address: shippingAddress,
      promo_code: promoCode || null,
      discount_amount: discountAmount || 0,
    },
  });

  if (error) {
    throw new Error(`Could not create payment order: ${error.message}`);
  }
  if (!data?.razorpayOrderId) {
    throw new Error("Invalid response from payment server");
  }

  return {
    id: data.razorpayOrderId,
    amount: data.amount,
    currency: data.currency,
    key_id: data.keyId,
  };
}

// ─── Verify Payment Signature ─────────────────────────────────────────────────
// Calls the verify-razorpay-payment edge function to validate the signature.

export async function verifyRazorpayPayment(
  params: PaymentVerifyParams,
): Promise<{ success: boolean; payment_id?: string }> {
  const { data, error } = await supabase.functions.invoke("verify-razorpay-payment", {
    body: {
      orderId: params.razorpay_order_id,
      paymentId: params.razorpay_payment_id,
      signature: params.razorpay_signature,
    },
  });

  if (error) {
    throw new Error(`Payment verification failed: ${error.message}`);
  }

  const verified = data?.success === true;
  return { success: verified, payment_id: params.razorpay_payment_id };
}