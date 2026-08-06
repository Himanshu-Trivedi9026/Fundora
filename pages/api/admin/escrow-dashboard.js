/**
 * Admin Escrow Dashboard API — Escrow center for admins.
 *
 * GET — Escrow overview, ledger, milestones, payouts, risk flags
 * POST — Manual release, freeze, cancel payout, override decisions
 */

import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import {
  releaseFunds,
  emergencyFreeze,
} from "../../../lib/escrow/releaseEngine";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withRole(
  async function handler(req, res, user) {
    // Admin-only (see middleware + withRole in lib/withAuth.js).

    if (req.method === "GET") {
      if (!rl(req, res)) return;

      try {
        const { mode, status, limit, offset, campaignId, creatorId, days } =
          req.query;

        // Dashboard overview
        if (mode === "overview" || !mode) {
          // Get escrow summary stats
          const { data: accounts } = await supabaseAdmin
            .from("escrow_accounts")
            .select(
              "status, locked_balance, released_balance, refunded_balance, platform_fees, creator_earnings",
            );

          const summary = {
            totalAccounts: accounts?.length || 0,
            byStatus: {},
            totalLocked: 0,
            totalReleased: 0,
            totalRefunded: 0,
            totalFees: 0,
            totalEarnings: 0,
          };

          (accounts || []).forEach((a) => {
            summary.byStatus[a.status] = (summary.byStatus[a.status] || 0) + 1;
            summary.totalLocked += Number(a.locked_balance) || 0;
            summary.totalReleased += Number(a.released_balance) || 0;
            summary.totalRefunded += Number(a.refunded_balance) || 0;
            summary.totalFees += Number(a.platform_fees) || 0;
            summary.totalEarnings += Number(a.creator_earnings) || 0;
          });

          // Get pending payouts
          const { data: pendingPayouts, count: pendingCount } =
            await supabaseAdmin
              .from("payout_requests")
              .select(
                "id, creator_id, amount, net_amount, status, priority, created_at",
                { count: "exact" },
              )
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(parseInt(limit, 10) || 20);

          // Get recent escrow events
          const { data: recentEvents } = await supabaseAdmin
            .from("escrow_events")
            .select(
              "id, event_type, entity_type, new_status, details, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(20);

          // Get risk-flagged accounts
          const { data: riskFlagged } = await supabaseAdmin
            .from("escrow_accounts")
            .select(
              "id, campaign_id, creator_id, status, locked_balance, frozen, frozen_reason",
            )
            .eq("frozen", true);

          return res.status(200).json({
            success: true,
            summary,
            pendingPayouts: pendingPayouts || [],
            pendingPayoutCount: pendingCount || 0,
            recentEvents: recentEvents || [],
            riskFlagged: riskFlagged || [],
          });
        }

        // Ledger mode
        if (mode === "ledger") {
          const { escrowAccountId } = req.query;
          if (!escrowAccountId) {
            return res
              .status(400)
              .json({ error: "escrowAccountId is required" });
          }

          const { data: entries, count } = await supabaseAdmin
            .from("escrow_ledger")
            .select(
              "id, entry_type, amount, balance_after, reference_type, reference_id, description, created_at",
              { count: "exact" },
            )
            .eq("escrow_account_id", escrowAccountId)
            .order("created_at", { ascending: false })
            .range(
              parseInt(offset, 10) || 0,
              (parseInt(offset, 10) || 0) + (parseInt(limit, 10) || 50) - 1,
            );

          return res.status(200).json({
            success: true,
            entries: entries || [],
            total: count || 0,
          });
        }

        // Milestones mode
        if (mode === "milestones") {
          let query = supabaseAdmin
            .from("campaign_milestones")
            .select(
              "id, campaign_id, title, status, target_amount, release_amount, approval_percentage, total_reviews, created_at",
            )
            .order("created_at", { ascending: false });

          if (campaignId) query = query.eq("campaign_id", campaignId);
          if (status) query = query.eq("status", status);

          query = query.range(
            parseInt(offset, 10) || 0,
            (parseInt(offset, 10) || 0) + (parseInt(limit, 10) || 50) - 1,
          );

          const { data: milestones, count } = await query;

          return res.status(200).json({
            success: true,
            milestones: milestones || [],
            total: count || 0,
          });
        }

        return res.status(400).json({ error: "Invalid mode" });
      } catch (err) {
        logError("EscrowDashboardAPI", "GET error", { error: err.message });
        return res
          .status(500)
          .json({ error: "Failed to fetch escrow dashboard" });
      }
    }

    if (req.method === "POST") {
      if (!rl(req, res)) return;

      try {
        const { action, escrowAccountId, amount, reason, payoutRequestId } =
          req.body;

        if (action === "release") {
          if (!escrowAccountId || !amount || !reason) {
            return res.status(400).json({
              error: "escrowAccountId, amount, and reason are required",
            });
          }

          const result = await releaseFunds({
            escrowAccountId,
            amount: parseFloat(amount),
            reason,
            releasedBy: user.id,
          });

          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res
            .status(200)
            .json({ success: true, release: result.release });
        }

        if (action === "freeze") {
          if (!escrowAccountId || !reason) {
            return res
              .status(400)
              .json({ error: "escrowAccountId and reason are required" });
          }

          const result = await emergencyFreeze(
            escrowAccountId,
            reason,
            user.id,
          );
          if (!result.success) {
            return res.status(400).json({ error: result.error });
          }

          return res
            .status(200)
            .json({ success: true, message: "Account frozen" });
        }

        if (action === "cancel_payout") {
          if (!payoutRequestId) {
            return res
              .status(400)
              .json({ error: "payoutRequestId is required" });
          }

          const { error } = await supabaseAdmin
            .from("payout_requests")
            .update({
              status: "cancelled",
              metadata: {
                cancelled_by: user.id,
                cancelled_at: new Date().toISOString(),
                reason,
              },
            })
            .eq("id", payoutRequestId)
            .in("status", ["draft", "pending"]);

          if (error) {
            return res.status(500).json({ error: "Failed to cancel payout" });
          }

          return res
            .status(200)
            .json({ success: true, message: "Payout cancelled" });
        }

        return res.status(400).json({ error: "Invalid action" });
      } catch (err) {
        logError("EscrowDashboardAPI", "POST error", { error: err.message });
        return res.status(500).json({ error: "Failed to process request" });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  },
  [ROLES.ADMIN],
);
