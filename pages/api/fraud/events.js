/**
 * Fraud Events API — Query fraud events.
 *
 * GET — Get fraud events for authenticated user
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { getFraudEvents, getFraudEventSummary } from "../../../lib/fraud";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { category, severity, startDate, endDate, limit, offset, summary } = req.query;

      // Summary mode
      if (summary === "true") {
        const result = await getFraudEventSummary(user.id, parseInt(req.query.days, 10) || 30);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.status(200).json({ success: true, summary: result.summary });
      }

      // Events list
      const result = await getFraudEvents(user.id, {
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
        category,
        severity,
        startDate,
        endDate,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      // Sanitize — never expose raw signal values or IP hashes
      const events = (result.events || []).map((e) => ({
        id: e.id,
        eventType: e.event_type,
        eventCategory: e.event_category,
        severity: e.severity,
        signalName: e.signal_name,
        riskContribution: e.risk_contribution,
        createdAt: e.created_at,
        // Never expose: signal_value, rule_ids, ip_address_hash, user_agent, metadata
      }));

      return res.status(200).json({
        success: true,
        events,
        total: result.total,
      });
    } catch (err) {
      logError("FraudEventsAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch fraud events" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
