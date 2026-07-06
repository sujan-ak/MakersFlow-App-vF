import crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { getSupabaseAdmin } from "../lib/supabaseAdmin";

/**
 * Razorpay server-side routes (PDF §5 — "the biggest chunk of work"):
 *
 *  POST /api/razorpay/webhook    — idempotent webhook handler. Verifies
 *      Razorpay's signature against the RAW request body, records the event
 *      in payment_events (unique on event id → safe for duplicate
 *      deliveries), marks the order paid and fulfills course enrollments
 *      server-side. This is the safety net for "payment succeeded but the
 *      app crashed before writing the order".
 *
 *  POST /api/razorpay/reconcile  — admin-triggered (or cron-triggered)
 *      job that finds orders stuck in "pending" for >10 minutes and asks
 *      Razorpay's Orders API for their real status.
 *
 *  POST /api/razorpay/refund     — admin-initiated refund. Calls Razorpay's
 *      refund API and updates the order row.
 *
 * Env vars required:
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET,
 *   ADMIN_API_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const router: IRouter = Router();

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

function razorpayAuthHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay API keys are not configured");
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

function requireAdmin(req: Request, res: Response): boolean {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) {
    res.status(500).json({ error: "ADMIN_API_SECRET is not configured" });
    return false;
  }
  const provided = req.header("x-admin-secret");
  if (!provided || !crypto.timingSafeEqual(
    Buffer.from(provided.padEnd(secret.length)),
    Buffer.from(secret.padEnd(provided.length)),
  )) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

/** Fulfill: mark order paid + upsert 1-year enrollments for course items. */
async function fulfillOrder(razorpayOrderId: string, razorpayPaymentId: string | null) {
  const supabase = getSupabaseAdmin();

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, status, items")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  if (!order) {
    // Client never wrote the order (crashed after payment). Nothing to attach
    // enrollments to yet — record for manual/automated follow-up.
    logger.warn({ razorpayOrderId }, "Webhook for unknown order — needs reconciliation");
    return;
  }

  if (order.status !== "paid") {
    await supabase
      .from("orders")
      .update({ status: "paid", razorpay_payment_id: razorpayPaymentId ?? undefined })
      .eq("id", order.id);
  }

  const items: Array<{
    id: string;
    is_course?: boolean;
    course_id?: string | null;
    qty?: number;
    price?: number;
  }> = Array.isArray(order.items) ? order.items : [];

  for (const item of items) {
    // Shared item shape used by web + mobile orders
    let isCourse = !!item.is_course;
    let courseId: string | null = item.course_id ?? (isCourse ? item.id : null);

    // Legacy fallback: older orders stored {product_id} — look the product up
    if (!isCourse && !courseId && (item as any).product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("is_course, course_id")
        .eq("id", (item as any).product_id)
        .maybeSingle();
      isCourse = !!(product?.is_course || product?.course_id);
      courseId = product?.course_id ?? (isCourse ? (item as any).product_id : null);
    }

    if (isCourse && courseId) {
      const enrolledAt = new Date();
      const expiresAt = new Date(enrolledAt.getTime() + 365 * 24 * 60 * 60 * 1000);
      await supabase.from("enrollments").upsert(
        {
          user_id: order.user_id,
          course_id: courseId,
          payment_status: "completed",
          status: "active",
          enrolled_at: enrolledAt.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "user_id,course_id" },
      );
      // Mirror into course_purchases for the admin LMS Purchases page
      await supabase.from("course_purchases").upsert(
        {
          user_id: order.user_id,
          course_id: courseId,
          order_id: order.id,
          status: "active",
        },
        { onConflict: "user_id,course_id" },
      );
    }
  }
}

// ── Webhook ───────────────────────────────────────────────────────────────────

router.post("/razorpay/webhook", async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    // Signature must be computed over the RAW body (see app.ts json verify hook)
    const rawBody: Buffer | undefined = (req as any).rawBody;
    const signature = req.header("x-razorpay-signature");
    if (!rawBody || !signature) {
      res.status(400).json({ error: "Missing body or signature" });
      return;
    }

    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const valid =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!valid) {
      logger.warn("Razorpay webhook signature mismatch");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const event = req.body;
    const eventId = req.header("x-razorpay-event-id") ?? `${event.event}:${event.created_at}`;

    // Idempotency: unique insert on event id — duplicate deliveries no-op
    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase
      .from("payment_events")
      .insert({ event_id: eventId, event_type: event.event, payload: event });

    if (insertError) {
      if ((insertError as any).code === "23505") {
        // Already processed this delivery
        res.json({ status: "duplicate_ignored" });
        return;
      }
      throw insertError;
    }

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId: string | undefined =
        paymentEntity?.order_id ?? event.payload?.order?.entity?.id;
      if (orderId) {
        await fulfillOrder(orderId, paymentEntity?.id ?? null);
      }
    }

    if (event.event === "payment.failed") {
      const orderId = event.payload?.payment?.entity?.order_id;
      if (orderId) {
        await getSupabaseAdmin()
          .from("orders")
          .update({ status: "failed" })
          .eq("razorpay_order_id", orderId)
          .neq("status", "paid"); // never downgrade a paid order
      }
    }

    res.json({ status: "ok" });
  } catch (e) {
    logger.error(e, "Razorpay webhook error");
    // 500 → Razorpay retries later, which is what we want
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ── Reconciliation ────────────────────────────────────────────────────────────

router.post("/razorpay/reconcile", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const supabase = getSupabaseAdmin();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: stuck } = await supabase
      .from("orders")
      .select("id, razorpay_order_id, status, created_at")
      .in("status", ["pending", "created"])
      .lt("created_at", tenMinAgo)
      .not("razorpay_order_id", "is", null)
      .limit(50);

    const results: Array<{ order_id: string; action: string }> = [];

    for (const order of stuck ?? []) {
      const rzpRes = await fetch(`${RAZORPAY_BASE}/orders/${order.razorpay_order_id}`, {
        headers: { Authorization: razorpayAuthHeader() },
      });
      if (!rzpRes.ok) {
        results.push({ order_id: order.id, action: "razorpay_lookup_failed" });
        continue;
      }
      const rzpOrder = (await rzpRes.json()) as { status: string };

      if (rzpOrder.status === "paid") {
        await fulfillOrder(order.razorpay_order_id, null);
        results.push({ order_id: order.id, action: "marked_paid_and_fulfilled" });
      } else if (rzpOrder.status === "created" || rzpOrder.status === "attempted") {
        await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
        results.push({ order_id: order.id, action: "marked_failed" });
      } else {
        results.push({ order_id: order.id, action: `left_as_${rzpOrder.status}` });
      }
    }

    res.json({ checked: stuck?.length ?? 0, results });
  } catch (e) {
    logger.error(e, "Reconcile error");
    res.status(500).json({ error: "Reconciliation failed" });
  }
});

// ── Refund (admin-initiated) ──────────────────────────────────────────────────

router.post("/razorpay/refund", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { order_id, amount, reason } = req.body ?? {};
    if (!order_id) {
      res.status(400).json({ error: "order_id is required" });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select("id, razorpay_payment_id, total_amount, status")
      .eq("id", order_id)
      .maybeSingle();

    if (!order?.razorpay_payment_id) {
      res.status(404).json({ error: "Order or payment id not found" });
      return;
    }
    if (order.status === "refunded") {
      res.status(409).json({ error: "Order already refunded" });
      return;
    }

    const refundAmountPaise = Math.round((amount ?? order.total_amount) * 100);

    const rzpRes = await fetch(
      `${RAZORPAY_BASE}/payments/${order.razorpay_payment_id}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: razorpayAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: refundAmountPaise,
          notes: { reason: reason ?? "admin_refund", order_id },
        }),
      },
    );

    const refund = await rzpRes.json();
    if (!rzpRes.ok) {
      logger.error(refund, "Razorpay refund failed");
      res.status(502).json({ error: "Razorpay refund failed", details: refund });
      return;
    }

    await supabase
      .from("orders")
      .update({ status: "refunded", refund_id: (refund as any).id ?? null })
      .eq("id", order.id);

    res.json({ success: true, refund });
  } catch (e) {
    logger.error(e, "Refund error");
    res.status(500).json({ error: "Refund failed" });
  }
});

export default router;
