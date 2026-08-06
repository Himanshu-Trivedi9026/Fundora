// GET /api/marketplace/featured — Get featured plugins
import { getFeaturedPlugins } from "../../../lib/marketplace/marketplaceEngine.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const result = await getFeaturedPlugins();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
