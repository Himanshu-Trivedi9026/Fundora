/**
 * Device Fingerprint API — Record and query device fingerprints.
 *
 * GET — Get device fingerprints for authenticated user
 * POST — Record a new device fingerprint
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import {
  recordFingerprint,
  getDeviceFingerprints,
  getDeviceStats,
  sanitizeDeviceResponse,
} from "../../../lib/fraud";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { mode, limit, offset } = req.query;

      // Stats mode
      if (mode === "stats") {
        const result = await getDeviceStats(user.id);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.status(200).json({ success: true, stats: result.stats });
      }

      // Default: device list
      const result = await getDeviceFingerprints(user.id, {
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      // Sanitize — never expose raw hashes
      const devices = (result.devices || []).map(sanitizeDeviceResponse);

      return res.status(200).json({
        success: true,
        devices,
        total: result.total,
      });
    } catch (err) {
      logError("DeviceAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch devices" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { fingerprint } = req.body;

      if (!fingerprint) {
        return res.status(400).json({ error: "Missing fingerprint data" });
      }

      const result = await recordFingerprint({
        userId: user.id,
        fingerprint,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({
        success: true,
        isNew: result.isNew,
        // Never expose the device ID or hash
      });
    } catch (err) {
      logError("DeviceAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to record fingerprint" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
