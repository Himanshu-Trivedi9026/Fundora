import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const config = {
  api: {
    bodyParser: false, // REQUIRED
  },
};

export default async function handler(req, res) {
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

    const projectId = payment.notes?.projectId;
    const amount = payment.amount / 100; // paise → rupees
    const payerEmail = payment.email || null;

    if (!projectId) return res.json({ ok: true });

    // 1️⃣ Insert donation
    const { error: insertError } = await supabaseAdmin
      .from("public_donations")
      .insert({
        project_id: projectId,
        amount,
        payer_email: payerEmail,
        payment_id: payment.id,
        status: "success",
      });

    if (insertError) {
      console.error("Webhook insert error:", insertError);
      return res.status(500).json({ error: "Donation insert failed" });
    }

    // 2️⃣ Update pledged amount
    const { error: rpcError } = await supabaseAdmin.rpc(
      "increment_project_funding",
      {
        project_id: projectId,
        amount,
      },
    );

    if (rpcError) {
      console.error("Webhook RPC error:", rpcError);
      return res.status(500).json({ error: "Funding update failed" });
    }
  }

  /* ---------------- PAYMENT FAILED ---------------- */
  if (event.event === "payment.failed") {
    console.log("Payment failed:", event.payload.payment.entity.id);
  }

  /* ---------------- REFUND ---------------- */
  if (event.event === "refund.processed") {
    console.log("Refund processed:", event.payload.refund.entity.id);
  }

  return res.json({ success: true });
}
