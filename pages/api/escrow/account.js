/**
 * Escrow Account API — Manage escrow accounts for campaigns.
 *
 * GET — Get escrow account by campaign ID or list creator's accounts
 * POST — Create escrow account for a campaign
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { createEscrowAccount, getEscrowAccountByCampaign, getEscrowAccountsByCreator } from "../../../lib/escrow/escrowAccount";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { campaignId } = req.query;

      if (campaignId) {
        const result = await getEscrowAccountByCampaign(campaignId);
        if (!result.success) {
          return res.status(404).json({ error: result.error });
        }
        // Sanitize: never expose internal fields
        const safe = { ...result.account };
        delete safe.metadata;
        return res.status(200).json({ success: true, account: safe });
      }

      // List creator's escrow accounts
      const result = await getEscrowAccountsByCreator(user.id);
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      const safeAccounts = (result.accounts || []).map((a) => {
        const { metadata, ...safe } = a;
        return safe;
      });

      return res.status(200).json({ success: true, accounts: safeAccounts });
    } catch (err) {
      logError("EscrowAccountAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch escrow account" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { campaignId, feePercentage } = req.body;

      if (!campaignId) {
        return res.status(400).json({ error: "campaignId is required" });
      }

      const result = await createEscrowAccount({
        campaignId,
        creatorId: user.id,
        feePercentage: feePercentage || 5.0,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.status(201).json({ success: true, account: result.account });
    } catch (err) {
      logError("EscrowAccountAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to create escrow account" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
