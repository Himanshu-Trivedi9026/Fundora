import { withAuth } from "../../../lib/withAuth.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { askCopilot } from "../../../lib/ai/copilotEngine.js";

// POST: Send message to AI copilot
// Body: { question, copilotType, conversationId? }
// Rate limit: 30/min
export default withAuth(rateLimit({ windowMs: 60000, max: 30 })(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { question, copilotType, conversationId } = req.body;
    if (!question || !copilotType) return res.status(400).json({ error: "question and copilotType required" });
    const result = await askCopilot({ userId: req.user.id, copilotType, question, conversationId });
    if (!result.success) return res.status(400).json({ error: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}));
