/**
 * Organization Settings API — Manage organization settings.
 *
 * GET — Get all or specific settings
 * POST — Set a setting
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import {
  getOrganizationSettings,
  setOrganizationSetting,
  getOrganizationSetting,
} from "../../../lib/organization";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 20 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { organizationId, key } = req.query;

      if (!organizationId) {
        return res.status(400).json({ error: "organizationId is required" });
      }

      if (key) {
        const result = await getOrganizationSetting(organizationId, key, user.id);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.status(200).json({ success: true, data: result.data });
      }

      const result = await getOrganizationSettings(organizationId, user.id);
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      logError("SettingsAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch settings" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { organizationId, key, value, description } = req.body;

      if (!organizationId || !key) {
        return res.status(400).json({ error: "organizationId and key are required" });
      }

      const result = await setOrganizationSetting(organizationId, key, value, user.id);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
      logError("SettingsAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to process request" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
