// GET /api/developer/my-plugins — List developer's plugins
import { withAuth } from "../../../lib/withAuth.js";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const userId = req.user?.id;

    // In production: query plugins by author_id
    return res.status(200).json({
      success: true,
      data: [],
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default withAuth(handler);
