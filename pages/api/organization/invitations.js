/**
 * Organization Invitations API — Manage invitations.
 *
 * GET — List invitations
 * POST — Create, accept, revoke
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import {
  createInvitation,
  acceptInvitation,
  revokeInvitation,
  getInvitations,
} from "../../../lib/organization";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 15 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { organizationId, status, limit, offset } = req.query;

      if (!organizationId) {
        return res.status(400).json({ error: "organizationId is required" });
      }

      const result = await getInvitations(organizationId, {
        status,
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
      }, user.id);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (err) {
      logError("InvitationsAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch invitations" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { action, organizationId, email, role, invitationId } = req.body;

      if (action === "create") {
        if (!organizationId || !email) {
          return res.status(400).json({ error: "organizationId and email are required" });
        }

        const result = await createInvitation({
          organizationId,
          email,
          role: role || "member",
          invitedBy: user.id,
        });

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(201).json({ success: true, data: result.data });
      }

      if (action === "accept") {
        if (!invitationId) {
          return res.status(400).json({ error: "invitationId is required" });
        }

        const result = await acceptInvitation(invitationId, user.id, user.email);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({ success: true, data: result.data });
      }

      if (action === "revoke") {
        if (!invitationId) {
          return res.status(400).json({ error: "invitationId is required" });
        }

        const result = await revokeInvitation(invitationId, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({ success: true, data: result.data });
      }

      return res.status(400).json({ error: "Invalid action" });
    } catch (err) {
      logError("InvitationsAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to process request" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
