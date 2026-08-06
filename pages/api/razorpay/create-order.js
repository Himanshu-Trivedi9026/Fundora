import Razorpay from "razorpay";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { isCreatorVerified } from "../../../lib/verification/status";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rl(req, res)) return;

  try {
    const { amount, projectId } = req.body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0 || !Number.isFinite(parsedAmount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
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
      creatorConfig?.razorpay_key_secret ||
      process.env.RAZORPAY_KEY_SECRET ||
      "";

    if (!keyId || !keySecret) {
      console.error("Missing Razorpay credentials");
      return res.status(500).json({ error: "Payment system not configured" });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: parsedAmount * 100, // rupees → paise
      currency: "INR",
      receipt: `p_${Date.now()}`,
      // Bind this order to the project + payer server-side. This is NOT
      // attacker-controlled: it is set at order creation, and verify/webhook
      // re-read it from the order to prevent cross-project mis-crediting.
      notes: { project_id: projectId, payer_id: user.id },
    });

    return res.status(200).json({
      id: order.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: keyId,
    });
  } catch (err) {
    console.error("Razorpay order error:", err);
    return res.status(500).json({ error: "Order creation failed" });
  }
});
