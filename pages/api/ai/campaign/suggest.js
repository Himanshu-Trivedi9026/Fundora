import { withAuth } from "../../../../lib/withAuth.js";
import { rateLimit } from "../../../../lib/rateLimit.js";
import { suggestCampaignTitle } from "../../../../lib/ai/promptEngine.js";

// POST: Get campaign title suggestions
// Body: { title, category, goal }
// Rate limit: 30/min
export default withAuth(rateLimit({ windowMs: 60000, max: 30 })(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { title, category, goal } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    const result = await suggestCampaignTitle({ title, category, goal, userId: req.user.id });
    if (!result.success) return res.status(400).json({ error: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}));
