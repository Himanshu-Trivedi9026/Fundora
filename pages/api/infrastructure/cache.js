// API — Cache infrastructure management
import {
  getStats,
  clear,
  cleanupExpiredCache,
} from "../../../lib/cache/index.js";
import { withAuth } from "../../../lib/withAuth.js";

async function handler(req, res) {
  const { method } = req;

  switch (method) {
    case "GET":
      return handleGet(req, res);
    case "POST":
      return handlePost(req, res);
    default:
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }
}

function handleGet(req, res) {
  try {
    const stats = getStats();
    return res.status(200).json({
      success: true,
      data: {
        memory: {
          size: stats.memory.size,
          keys: stats.memory.keys,
        },
        locks: {
          active: stats.locks.active,
        },
        rateLimiters: {
          active: stats.rateLimiters.active,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function handlePost(req, res) {
  try {
    const { action, backend } = req.body;

    switch (action) {
      case "clear":
        const clearResult = await clear(backend || "memory");
        return res.status(200).json(clearResult);

      case "cleanup":
        const cleanupResult = cleanupExpiredCache();
        return res.status(200).json(cleanupResult);

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
