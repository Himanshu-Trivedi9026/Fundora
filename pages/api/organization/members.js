/**
 * Organization Members API — Manage members within an organization.
 *
 * GET — List members
 * POST — Add, remove, update role
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import {
  addMember,
  removeMember,
  updateMemberRole,
  getMembers,
  getMember,
} from "../../../lib/organization";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 30 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { organizationId, userId, role, status, limit, offset } = req.query;

      if (!organizationId) {
        return res.status(400).json({ error: "organizationId is required" });
      }

      // Get specific member
      if (userId) {
        const result = await getMember(organizationId, userId, user.id);
        if (!result.success) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(200).json({ success: true, data: result.data });
      }

      // List members
      const result = await getMembers(organizationId, {
        role,
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
      logError("MembersAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch members" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { action, organizationId, userId, role } = req.body;

      if (action === "add") {
        if (!organizationId || !userId) {
          return res.status(400).json({ error: "organizationId and userId are required" });
        }

        const result = await addMember({
          organizationId,
          userId,
          role: role || "member",
          invitedBy: user.id,
        });

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(201).json({ success: true, data: result.data });
      }

      if (action === "remove") {
        if (!organizationId || !userId) {
          return res.status(400).json({ error: "organizationId and userId are required" });
        }

        const result = await removeMember(organizationId, userId, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({ success: true });
      }

      if (action === "update_role") {
        if (!organizationId || !userId || !role) {
          return res.status(400).json({ error: "organizationId, userId, and role are required" });
        }

        const result = await updateMemberRole(organizationId, userId, role, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({ success: true, data: result.data });
      }

      return res.status(400).json({ error: "Invalid action" });
    } catch (err) {
      logError("MembersAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to process request" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
