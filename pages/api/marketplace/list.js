// GET /api/marketplace/list — List marketplace plugins
import { listMarketplacePlugins } from "../../../lib/marketplace/marketplaceEngine.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { category, sort, page, limit, search } = req.query;
    const result = await listMarketplacePlugins({
      category,
      sort,
      page: Number(page),
      limit: Number(limit),
      search,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
