import Razorpay from "razorpay";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, projectId } = req.body;

    if (!amount || amount <= 0) {
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
      amount: amount * 100, // rupees → paise
      currency: "INR",
      receipt: `p_${Date.now()}`,
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
}
