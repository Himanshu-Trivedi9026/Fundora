// API — Tenant Management

import { withAuth } from "../../../lib/withAuth.js";
import {
  createTenant,
  updateTenant,
  getTenant,
  listTenants,
} from "../../../lib/tenants/index.js";

async function handler(req, res) {
  try {
    const { method } = req;

    switch (method) {
      case "POST": {
        const result = await createTenant({
          ...req.body,
          createdBy: req.user.id,
        });
        return res.status(result.success ? 201 : 400).json(result);
      }

      case "GET": {
        if (req.query.id) {
          const result = await getTenant(req.query.id);
          return res.status(result.success ? 200 : 404).json(result);
        }
        const result = await listTenants({
          plan: req.query.plan,
          search: req.query.search,
          limit: req.query.limit,
          offset: req.query.offset,
        });
        return res.status(200).json(result);
      }

      case "PUT": {
        if (!req.query.id) return res.status(400).json({ success: false, error: "Tenant ID required" });
        const result = await updateTenant(req.query.id, req.body);
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
