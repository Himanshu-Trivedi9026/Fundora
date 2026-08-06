import crypto from "crypto";
import Razorpay from "razorpay";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { sendNotification, NOTIFICATION_TYPES } from "../../../lib/notification";
import { isCreatorVerified } from "../../../lib/verification/status";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rl(req, res)) return;

  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      projectId,
    } = req.body;

    /* ---------- INPUT VALIDATION ---------- */
    if (!razorpay_payment_id || typeof razorpay_payment_id !== "string") {
      return res.status(400).json({ error: "razorpay_payment_id is required" });
    }
    if (!razorpay_order_id || typeof razorpay_order_id !== "string") {
      return res.status(400).json({ error: "razorpay_order_id is required" });
    }
    if (!razorpay_signature || typeof razorpay_signature !== "string") {
      return res.status(400).json({ error: "razorpay_signature is required" });
    }
    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({ error: "projectId is required" });
    }

    const payerId = user.id;

    /* ---------- IDEMPOTENCY: a payment id may be credited only once ---------- */
    const { data: existing } = await supabaseAdmin
      .from("public_donations")
      .select("id")
      .eq("razorpay_payment_id", razorpay_payment_id)
      .maybeSingle();

    if (existing) {
      return res
        .status(409)
        .json({ error: "This payment has already been processed", donationId: existing.id });
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project?.owner_id) {
      return res.status(404).json({ error: "Project not found" });
    }

    /* A campaign may only receive donations when its owner is verified. */
    if (!(await isCreatorVerified(project.owner_id))) {
      return res.status(403).json({ error: "VerificationRequired" });
    }

    const { data: creatorConfig } = await supabaseAdmin
      .from("creator_payment_configs")
      .select("razorpay_key_id, razorpay_key_secret")
      .eq("creator_user_id", project.owner_id)
      .maybeSingle();

    const keyId =
      creatorConfig?.razorpay_key_id || process.env.RAZORPAY_KEY_ID || "";
    const keySecret =
      creatorConfig?.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || "";

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: "Payment system not configured" });
    }

    /* ---------- SIGNATURE VERIFICATION ---------- */
    // The HMAC covers `order_id|payment_id`. This authenticates that Razorpay
    // issued this signature, but does NOT prove the amount or the project. We
    // therefore re-fetch the payment and order from Razorpay below and derive
    // the amount and project binding from those server-side responses.
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    const sigBuf = Buffer.from(expectedSignature, "utf8");
    const receivedBuf = Buffer.from(razorpay_signature || "", "utf8");
    if (
      sigBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, receivedBuf)
    ) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    /* ---------- SERVER-SIDE RE-VERIFICATION ---------- */
    // Fetch the payment and order from Razorpay so the recorded amount, payer,
    // and project cannot be forged by the client.
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    let payment;
    let order;
    try {
      [payment, order] = await Promise.all([
        razorpay.payments.fetch(razorpay_payment_id),
        razorpay.orders.fetch(razorpay_order_id),
      ]);
    } catch (fetchErr) {
      console.error("Razorpay fetch error:", fetchErr);
      return res.status(400).json({ error: "Unable to verify payment with Razorpay" });
    }

    // The payment must belong to this order.
    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ error: "Payment/order mismatch" });
    }

    // The order must be bound to this project and payer (set at creation time).
    if (order.notes?.project_id !== projectId) {
      return res.status(400).json({ error: "Order is not bound to this project" });
    }
    if (order.notes?.payer_id !== payerId) {
      return res.status(400).json({ error: "Order is not bound to this payer" });
    }

    // Use the amount Razorpay actually captured (paise → rupees), never the
    // client-supplied amount.
    const capturedAmount = Number(payment.amount) / 100;
    if (!capturedAmount || capturedAmount <= 0 || !Number.isFinite(capturedAmount)) {
      return res.status(400).json({ error: "Payment amount is invalid" });
    }

    /* Store donation.
       NOTE: inserting a row into public_donations fires the DB trigger that
       increments projects.pledged by the donation amount. Do NOT call
       increment_project_funding here too — doing so would double-count the
       donation (2X). See audit: root cause of "donation X → project stats 2X". */
    const { data: donation, error: insertError } = await supabaseAdmin
      .from("public_donations")
      .insert({
        project_id: projectId,
        amount: capturedAmount,
        payer_id: payerId,
        razorpay_payment_id,
        razorpay_order_id,
        status: "paid",
      })
      .select("id")
      .single();

    if (insertError) {
      // Unique constraint (23505) is the database-level idempotency backstop.
      if (insertError.code === "23505") {
        return res
          .status(409)
          .json({ error: "This payment has already been processed" });
      }
      console.error("Verify insert error:", insertError);
      return res.status(500).json({ error: "Failed to record donation" });
    }

    /* Notify the project owner that a donation was received.
       Fire-and-forget: a notification failure must never fail the payment
       confirmation. The engine uses the service-role client (bypasses RLS). */
    sendNotification({
      userId: project.owner_id,
      notificationType: NOTIFICATION_TYPES.DONATION_RECEIVED,
      actorId: payerId,
      entityId: projectId,
    }).catch((err) => console.error("Donation notification failed:", err));

    return res.status(200).json({ success: true, donationId: donation.id });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ error: "Payment verification failed" });
  }
});
