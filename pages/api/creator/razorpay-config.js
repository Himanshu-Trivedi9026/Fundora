import { supabaseAdmin } from "../../../lib/supabaseAdmin";

async function getAuthedUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  const user = await getAuthedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("creator_payment_configs")
      .select("razorpay_key_id")
      .eq("creator_user_id", user.id)
      .maybeSingle();

    if (error) {
      if (String(error.message || "").includes("creator_payment_configs")) {
        return res.status(500).json({
          error:
            "Database table creator_payment_configs is missing. Run supabase/creator_payment_configs.sql once.",
        });
      }

      return res.status(500).json({
        error: "Failed to load Razorpay config",
        details: error.message,
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
      if (String(error.message || "").includes("creator_payment_configs")) {
        return res.status(500).json({
          error:
            "Database table creator_payment_configs is missing. Run supabase/creator_payment_configs.sql once.",
        });
      }

      return res.status(500).json({
        error: "Failed to save Razorpay config",
        details: error.message,
      });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
