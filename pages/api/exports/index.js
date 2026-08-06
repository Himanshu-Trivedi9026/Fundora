// API — Data Export

import { withAuth } from "../../../lib/withAuth.js";
import {
  exportData,
  createExportTemplate,
  listExportTemplates,
  getSupportedFormats,
} from "../../../lib/exports/index.js";

async function handler(req, res) {
  try {
    const { method } = req;

    switch (method) {
      case "POST": {
        const result = await exportData({
          ...req.body,
          storeResult: true,
          createdBy: req.user.id,
          organizationId: req.user.organization_id,
        });
        return res.status(result.success ? 201 : 400).json(result);
      }

      case "GET": {
        if (req.query.formats) {
          return res
            .status(200)
            .json({ success: true, data: getSupportedFormats() });
        }
        const result = await listExportTemplates({
          createdBy: req.user.id,
          organizationId: req.user.organization_id,
          source: req.query.source,
          limit: req.query.limit,
          offset: req.query.offset,
        });
        return res.status(200).json(result);
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
