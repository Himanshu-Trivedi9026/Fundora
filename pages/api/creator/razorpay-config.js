import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";

export default withAuth(async function handler(req, res, user) {

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("creator_payment_configs")
      .select("razorpay_key_id")
      .eq("creator_user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Razorpay config load error:", error);
      return res.status(500).json({
        error: "Failed to load Razorpay config",
      });
    }

    return res.status(200).json({
      configured: Boolean(data?.razorpay_key_id),
      keyId: data?.razorpay_key_id || "",
    });
  }

  if (req.method === "POST") {
    const { keyId, keySecret } = req.body || {};

    if (!keyId || !keySecret) {
      return res
        .status(400)
        .json({ error: "keyId and keySecret are required" });
    }

    const { error } = await supabaseAdmin
      .from("creator_payment_configs")
      .upsert(
        {
          creator_user_id: user.id,
          razorpay_key_id: String(keyId).trim(),
          razorpay_key_secret: String(keySecret).trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "creator_user_id" },
      );

    if (error) {
      console.error("Razorpay config save error:", error);
      return res.status(500).json({
        error: "Failed to save Razorpay config",
      });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
});
