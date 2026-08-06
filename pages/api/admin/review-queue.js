import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withRole } from "../../../lib/withAuth";
import { ROLES } from "../../../lib/roles";
import { rateLimit } from "../../../lib/rateLimit";
import { getReviewQueue, getBusinessReviewQueue, getBankReviewQueue } from "../../../lib/verification/manualReview";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

/**
 * Admin review queue — extended with business/bank filters.
 * GET: Returns verification review queue with type filters.
 */
export default withRole(async function handler(req, res, user) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rl(req, res)) return;

  try {
    const { type, status, priority, limit = 20, offset = 0 } = req.query;

    // Parse numeric params
    const numLimit = Math.min(parseInt(limit) || 20, 100);
    const numOffset = parseInt(offset) || 0;

    let result;

    switch (type) {
      case "identity":
      case undefined:
      case "":
        // Default: identity verification queue
        result = await getReviewQueue({
          status: status || "under_review",
          priority: priority || undefined,
          limit: numLimit,
          offset: numOffset,
          callerId: user.id,
        });
        break;
      case "business":
        result = await getBusinessReviewQueue({
          status: status || "pending",
          limit: numLimit,
          offset: numOffset,
          callerId: user.id,
        });
        break;
      case "bank":
        result = await getBankReviewQueue({
          status: status || "pending",
          limit: numLimit,
          offset: numOffset,
          callerId: user.id,
        });
        break;
      default:
        return res.status(400).json({ error: "Invalid type. Must be: identity, business, bank" });
    }

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      records: result.requests || result.records || [],
      total: result.total || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}, [ROLES.ADMIN]);
