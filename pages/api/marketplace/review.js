// POST /api/marketplace/review — Submit a plugin review
import { withAuth } from "../../../lib/withAuth.js";
import { submitPluginReview } from "../../../lib/marketplace/marketplaceEngine.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { pluginId, rating, review } = req.body;
    const userId = req.user?.id;

    if (!pluginId || !rating) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: pluginId, rating",
      });
    }

    const result = await submitPluginReview({
      pluginId,
      userId,
      rating,
      review,
    });
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);
