import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  if (!rl(req, res)) return;

  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      projectId,
      amount,
    } = req.body;

    const payerId = user.id;

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project?.owner_id) {
      return res
        .status(404)
        .json({ success: false, error: "Project not found" });
    }

    const { data: creatorConfig } = await supabaseAdmin
      .from("creator_payment_configs")
      .select("razorpay_key_secret")
      .eq("creator_user_id", project.owner_id)
      .maybeSingle();

    const keySecret =
      creatorConfig?.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return res
        .status(500)
        .json({ success: false, error: "Payment system not configured" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    const sigBuf = Buffer.from(expectedSignature, "utf8");
    const receivedBuf = Buffer.from(razorpay_signature || "", "utf8");
    if (sigBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(sigBuf, receivedBuf)) {
      return res.status(400).json({ success: false });
    }

    /* Store donation */
    await supabaseAdmin.from("public_donations").insert({
      project_id: projectId,
      amount,
      payer_id: payerId,
      razorpay_payment_id,
      razorpay_order_id,
      status: "paid",
    });

    /* ✅ Update project funding */
    await supabaseAdmin.rpc("increment_project_funding", {
      project_id: projectId,
      amount,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ success: false });
  }
});
