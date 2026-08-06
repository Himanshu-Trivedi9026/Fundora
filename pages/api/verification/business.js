import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { getBusinessVerification } from "../../../lib/verification/businessVerification";
import { createBusinessVerification } from "../../../lib/verification/businessVerification";
import { uploadBusinessDocument } from "../../../lib/verification/businessVerification";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const verification = await getBusinessVerification(user.id);
      return res.status(200).json({ success: true, ...verification });
    } catch (err) {
      console.error("Get business verification error:", err);
      return res
        .status(500)
        .json({ error: "Failed to fetch business verification" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { verificationId, businessData } = req.body;
      const result = await createBusinessVerification(user.id, {
        verificationId,
        businessData,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Create/update business verification error:", err);
      return res
        .status(500)
        .json({ error: "Failed to save business verification" });
    }
  }

  if (req.method === "PUT") {
    if (!rl(req, res)) return;

    try {
      const { verificationId, documentType, filename } = req.body;
      const result = await uploadBusinessDocument(user.id, {
        verificationId,
        documentType,
        filename,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error("Upload business document error:", err);
      return res
        .status(500)
        .json({ error: "Failed to upload business document" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
