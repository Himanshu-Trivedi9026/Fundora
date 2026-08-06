import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { withAuth } from "@/lib/withAuth";

export default withAuth(async function handler(req, res, user) {
  try {
    /* ---------- METHOD CHECK ---------- */
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    /* ---------- INPUT VALIDATION ---------- */
    const { donationId } = req.body;

    if (!donationId) {
      return res.status(400).json({
        error: "Donation ID is required",
      });
    }

    /* ---------- FETCH DONATION ---------- */
    const { data, error } = await supabaseAdmin
      .from("public_donations")
      .select(
        `
        id,
        amount,
        created_at,
        payer_id,
        projects:project_id (
          title
        )
      `,
      )
      .eq("id", donationId)
      .eq("payer_id", user.id)
      .eq("status", "paid")
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      return res.status(500).json({
        error: "Database error",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Donation not found",
      });
    }

    /* ---------- BUILD RECEIPT ---------- */
    const receipt = {
      receiptId: `RCPT-${data.id.slice(0, 6).toUpperCase()}`,
      amount: data.amount,
      date: new Date(data.created_at).toLocaleString(),
      project: data.projects?.title || "Unknown",
      donor: data.payer_id,
    };

    /* ---------- SUCCESS ---------- */
    return res.status(200).json({
      success: true,
      receipt,
    });
  } catch (err) {
    console.error("Receipt API Error:", err);

    return res.status(500).json({
      error: "Receipt generation failed",
    });
  }
});
