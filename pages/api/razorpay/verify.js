import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false });
  }

  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      projectId,
      amount,
      payerId, // ✅ coming from frontend
    } = req.body;

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

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false });
    }

    /* ✅ Store donation */
    await supabaseAdmin.from("public_donations").insert({
      project_id: projectId,
      amount,
      payer_id: payerId, // ✅ FIXED
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
}
