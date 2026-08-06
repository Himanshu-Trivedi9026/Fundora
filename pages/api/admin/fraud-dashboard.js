/**
 * Admin Fraud Dashboard API — Comprehensive fraud management.
 *
 * GET — Get fraud dashboard summary and profiles
 * POST — Apply manual overrides, trigger evaluations
 */

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import {
  getFraudDashboard,
  applyManualOverride,
  getAllFraudEvents,
  getAggregateStats,
} from "../../../lib/fraud";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withRole(
  async function handler(req, res, user) {
    // Admin-only (see middleware + withRole in lib/withAuth.js).

    if (req.method === "GET") {
      if (!rl(req, res)) return;

      try {
        const {
          mode,
          riskLevel,
          decision,
          limit,
          offset,
          userId,
          days,
          category,
          severity,
        } = req.query;

        // Stats mode
        if (mode === "stats") {
          const result = await getAggregateStats({
            days: parseInt(days, 10) || 30,
          });
          if (!result.success) {
            return res.status(500).json({ error: result.error });
          }
          return res.status(200).json({ success: true, stats: result.stats });
        }

        // Events mode
        if (mode === "events") {
          const result = await getAllFraudEvents({
            limit: parseInt(limit, 10) || 50,
            offset: parseInt(offset, 10) || 0,
            category,
            severity,
            userId,
          });
          if (!result.success) {
            return res.status(500).json({ error: result.error });
          }
          return res.status(200).json({
            success: true,
            events: result.events,
            total: result.total,
          });
        }

        // Default: dashboard
        const result = await getFraudDashboard({
          limit: parseInt(limit, 10) || 50,
          offset: parseInt(offset, 10) || 0,
          riskLevel,
          decision,
        });

        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }

        return res.status(200).json({ success: true, data: result.data });
      } catch (err) {
        logError("FraudDashboardAPI", "GET error", { error: err.message });
        return res
          .status(500)
          .json({ error: "Failed to fetch fraud dashboard" });
      }
    }

    if (req.method === "POST") {
      if (!rl(req, res)) return;

      try {
        const {
          action,
          userId: targetUserId,
          overrideType,
          newValue,
          reason,
          isPermanent,
          expiresAt,
        } = req.body;

        if (action === "override") {
          if (!targetUserId || !overrideType || !newValue || !reason) {
            return res.status(400).json({ error: "Missing required fields" });
          }

          const result = await applyManualOverride({
            userId: targetUserId,
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
        }

        // Get user profile for review
        if (action === "getProfile") {
          if (!targetUserId) {
            return res.status(400).json({ error: "userId required" });
          }

          const { data: profile, error } = await supabaseAdmin
            .from("fraud_profiles")
            .select("*")
            .eq("user_id", targetUserId)
            .single();

          if (error && error.code !== "PGRST116") {
            return res.status(500).json({ error: "Failed to fetch profile" });
          }

          // Get recent events
          const { data: events } = await supabaseAdmin
            .from("fraud_events")
            .select(
              "id, event_type, event_category, severity, signal_name, risk_contribution, created_at",
            )
            .eq("user_id", targetUserId)
            .order("created_at", { ascending: false })
            .limit(20);

          // Get risk history
          const { data: riskHistory } = await supabaseAdmin
            .from("risk_scores")
            .select("risk_score, risk_level, decision, calculated_at")
            .eq("user_id", targetUserId)
            .order("calculated_at", { ascending: false })
            .limit(10);

          // Get devices
          const { data: devices } = await supabaseAdmin
            .from("device_fingerprints")
            .select(
              "id, browser, platform, is_known, session_count, risk_flags, last_seen_at",
            )
            .eq("user_id", targetUserId)
            .order("last_seen_at", { ascending: false })
            .limit(10);

          // Get manual overrides
          const { data: overrides } = await supabaseAdmin
            .from("manual_overrides")
            .select(
              "id, override_type, new_value, reason, is_permanent, created_at, revoked_at",
            )
            .eq("user_id", targetUserId)
            .order("created_at", { ascending: false })
            .limit(10);

          return res.status(200).json({
            success: true,
            profile: profile || null,
            events: events || [],
            riskHistory: riskHistory || [],
            devices: devices || [],
            overrides: overrides || [],
          });
        }

        return res.status(400).json({ error: "Invalid action" });
      } catch (err) {
        logError("FraudDashboardAPI", "POST error", { error: err.message });
        return res.status(500).json({ error: "Failed to process request" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  },
  [ROLES.ADMIN],
);
