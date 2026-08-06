/**
 * Fraud Profile API — Get and manage fraud profiles.
 *
 * GET — Get fraud profile for authenticated user
 * POST — Apply manual override (admin only)
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { getFraudProfile, applyManualOverride } from "../../../lib/fraud";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const result = await getFraudProfile(user.id);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      // Sanitize response — never expose internal scoring details
      const profile = result.profile
        ? {
            riskLevel: result.profile.risk_level,
            decision: result.profile.decision,
            lastEvaluated: result.profile.last_evaluated_at,
            // Never expose: risk_score, trust_score, manual_override details
          }
        : null;

      return res.status(200).json({ success: true, profile });
    } catch (err) {
      logError("FraudProfileAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch fraud profile" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    // Admin-only action
    // TODO: Check admin role in production
    // if (!user.isAdmin) return res.status(403).json({ error: "Forbidden" });

    try {
      const { overrideType, newValue, reason, isPermanent, expiresAt } =
        req.body;

      if (!overrideType || !newValue || !reason) {
        return res.status(400).json({
          error: "Missing required fields: overrideType, newValue, reason",
        });
      }

      const result = await applyManualOverride({
        userId: user.id,
        overrideType,
        newValue,
        reason,
        createdBy: user.id,
        isPermanent: isPermanent || false,
        expiresAt: expiresAt || null,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res
        .status(200)
        .json({ success: true, message: "Override applied" });
    } catch (err) {
      logError("FraudProfileAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to apply override" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
