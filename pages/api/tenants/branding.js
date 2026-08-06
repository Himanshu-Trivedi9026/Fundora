// API — Tenant Branding

import { withAuth } from "../../../lib/withAuth.js";
import { updateBranding, getBranding } from "../../../lib/tenants/index.js";

async function handler(req, res) {
  try {
    const { method } = req;
    const tenantId = req.query.tenantId || req.user.organization_id;

    if (!tenantId)
      return res
        .status(400)
        .json({ success: false, error: "Tenant ID required" });

    switch (method) {
      case "GET": {
        const result = await getBranding(tenantId);
        return res.status(result.success ? 200 : 404).json(result);
      }

      case "PUT": {
        const result = await updateBranding(tenantId, req.body);
        return res.status(result.success ? 200 : 400).json(result);
      }

      default:
        return res
          .status(405)
          .json({ success: false, error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default withAuth(handler);
