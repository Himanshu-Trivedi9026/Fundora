// API — Feature Flags

import { withAuth } from "../../../lib/withAuth.js";
import {
  createFlag,
  updateFlag,
  getFlag,
  listFlags,
  deleteFlag,
  isEnabled,
  getEnabledFlags,
  invalidateCache,
  clearCache,
} from "../../../lib/flags/index.js";

async function handler(req, res) {
  try {
    const { method } = req;

    switch (method) {
      case "POST": {
        const result = await createFlag({
          ...req.body,
          createdBy: req.user.id,
        });
        return res.status(result.success ? 201 : 400).json(result);
      }

      case "GET": {
        // Check a specific flag
        if (req.query.key && req.query.check) {
          const enabled = await isEnabled(req.query.key, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
          });
          return res.status(200).json({ success: true, data: { key: req.query.key, enabled } });
        }

        // Get all enabled flags
        if (req.query.enabled) {
          const enabled = await getEnabledFlags({
            userId: req.user.id,
            organizationId: req.user.organization_id,
          });
          return res.status(200).json({ success: true, data: enabled });
        }

        // Get specific flag by ID
        if (req.query.id) {
          const result = await getFlag(req.query.id);
          return res.status(result.success ? 200 : 404).json(result);
        }

        // List all flags
        const result = await listFlags({
          enabled: req.query.filterEnabled !== undefined ? req.query.filterEnabled === "true" : undefined,
          search: req.query.search,
          limit: req.query.limit,
          offset: req.query.offset,
        });
        return res.status(200).json(result);
      }

      case "PUT": {
        if (!req.query.id) return res.status(400).json({ success: false, error: "Flag ID required" });
        const result = await updateFlag(req.query.id, req.body);
        return res.status(result.success ? 200 : 400).json(result);
      }

      case "DELETE": {
        if (req.query.all && req.query.all === "cache") {
          clearCache();
          return res.status(200).json({ success: true, data: { message: "Cache cleared" } });
        }
        if (!req.query.id) return res.status(400).json({ success: false, error: "Flag ID required" });
        const result = await deleteFlag(req.query.id);
        return res.status(result.success ? 200 : 400).json(result);
      }

      default:
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default withAuth(handler);
