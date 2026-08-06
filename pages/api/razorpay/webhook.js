import crypto from "crypto";
import Razorpay from "razorpay";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { isCreatorVerified } from "../../../lib/verification/status";

export const config = {
  api: {
    bodyParser: false, // REQUIRED
  },
};

/**
 * Resolve the project a payment belongs to from its ORDER (bound server-side at
 * order creation via notes.project_id). Payment-level notes are client-
 * controllable and are deliberately NOT trusted here.
 *
 * Returns null when the project cannot be resolved (creator-owned account, or
 * order without a binding). In that case the webhook defers to verify.js, which
 * is the authoritative path (it re-fetches payment + order server-side and is
 * always invoked by the frontend on return from Razorpay checkout).
 */
async function resolveProjectFromOrder(paymentOrderId) {
  if (!paymentOrderId) return null;

  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret) return null;

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.fetch(paymentOrderId);
    return order?.notes?.project_id || null;
  } catch {
    // Creator-owned orders can't be fetched with the platform key. Defer to
    // verify.js rather than guessing the project.
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }

    const rawBody = Buffer.concat(buffers).toString("utf8");

    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const sigBuf = Buffer.from(expectedSignature, "utf8");
    const receivedBuf = Buffer.from(signature || "", "utf8");
    if (sigBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(sigBuf, receivedBuf)) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    /* ---------------- PAYMENT CAPTURED ---------------- */
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;

      /* Idempotency: skip if donation already recorded (e.g. by verify.js). */
      const { data: existing } = await supabaseAdmin
        .from("public_donations")
        .select("id")
        .eq("razorpay_payment_id", payment.id)
        .maybeSingle();

      if (existing) {
        return res.json({ success: true, duplicate: true });
      }

      /* Resolve the project from the server-bound order. Never from payment
         notes (client-controllable). If unresolved, defer to verify.js. */
      const projectId = await resolveProjectFromOrder(payment.order_id);
      if (!projectId) return res.json({ success: true, deferred: true });

      /* Money must never be credited to an unverified owner. The create-order
         route already blocks unverified projects, so this is a hard guarantee
         for orders that predate the gate or owners de-verified mid-payment.
         Return success so Razorpay doesn't retry; verify.js (authoritative
         path) will 403 the frontend. */
      const { data: ownerProject } = await supabaseAdmin
        .from("projects")
        .select("owner_id")
        .eq("id", projectId)
        .single();

      if (
        !ownerProject?.owner_id ||
        !(await isCreatorVerified(ownerProject.owner_id))
      ) {
        console.warn("Webhook: donation skipped — owner not verified", {
          projectId,
          paymentId: payment.id,
        });
        return res.json({ success: true, skipped: "creator_not_verified" });
      }

      const amount = payment.amount / 100; // paise → rupees

      // Insert donation.
      // NOTE: inserting fires the DB trigger that increments projects.pledged
      // by the donation amount. Do NOT call increment_project_funding here too
      // — that would double-count (2X).
      const { error: insertError } = await supabaseAdmin
        .from("public_donations")
        .insert({
          project_id: projectId,
          amount,
          razorpay_payment_id: payment.id,
          name: payment.email || null,
          status: "success",
        });

      if (insertError) {
        console.error("Webhook insert error:", insertError);
        return res.status(500).json({ error: "Donation insert failed" });
      }
    }

    /* ---------------- PAYMENT FAILED ---------------- */
    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      // Mark any recorded donation for this payment as failed so refunds/stats
      // don't treat an uncaptured payment as valid.
      await supabaseAdmin
        .from("public_donations")
        .update({ status: "failed" })
        .eq("razorpay_payment_id", payment.id)
        .eq("status", "paid");
      console.error("Payment failed:", payment.id);
    }

    /* ---------------- REFUND ---------------- */
    if (event.event === "refund.processed") {
      const refund = event.payload.refund.entity;
      // Mark the original donation refunded (never silently keep it "paid").
      const { data: donations } = await supabaseAdmin
        .from("public_donations")
        .select("id, project_id, amount")
        .eq("razorpay_payment_id", refund.payment_id);

      if (donations && donations.length > 0) {
        await supabaseAdmin
          .from("public_donations")
          .update({ status: "refunded" })
          .eq("razorpay_payment_id", refund.payment_id);

        // Decrement the project's pledged total by the refunded amount so the
        // campaign stats reflect money actually held.
        for (const d of donations) {
          await supabaseAdmin.rpc("decrement_project_funding", {
            project_id: d.project_id,
            amount: d.amount,
          });
        }
      }
      console.log("Refund processed:", refund.id);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
