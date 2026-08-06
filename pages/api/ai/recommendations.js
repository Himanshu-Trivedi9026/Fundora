import { withAuth } from "../../../lib/withAuth.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { getRecommendations } from "../../../lib/ai/recommendationEngine.js";

// GET: Get recommendations
// Query: { type: 'campaigns_for_donor'|'trending'|'similar', entityId?, limit? }
// Rate limit: 30/min
export default withAuth(
  rateLimit({ windowMs: 60000, max: 30 })(async function handler(req, res) {
    if (req.method !== "GET")
      return res.status(405).json({ error: "Method not allowed" });
    try {
      const { type, entityId, limit = "10" } = req.query;
      const validTypes = ["campaigns_for_donor", "trending", "similar"];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({
          error: `type is required and must be one of: ${validTypes.join(", ")}`,
        });
      }
      if (type === "similar" && !entityId) {
        return res.status(400).json({
          error: "entityId is required for 'similar' recommendations",
        });
      }
      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
      const result = await getRecommendations({
        userId: req.user.id,
        type,
        entityId: entityId || undefined,
        limit: parsedLimit,
      });
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.status(200).json(result.data);
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }),
);
