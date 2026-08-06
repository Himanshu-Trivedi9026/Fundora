import { withAuth } from "../../../../lib/withAuth.js";
import { rateLimit } from "../../../../lib/rateLimit.js";
import { scoreCampaign } from "../../../../lib/ai/aiEngine.js";

// POST: Score campaign quality
// Body: { campaignId }
// Rate limit: 30/min
export default withAuth(rateLimit({ windowMs: 60000, max: 30 })(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { campaignId } = req.body;
    if (!campaignId) return res.status(400).json({ error: "campaignId is required" });
    const result = await scoreCampaign({ campaignId, scoredBy: req.user.id });
    if (!result.success) return res.status(400).json({ error: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}));
