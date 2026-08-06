/**
 * Organization API — CRUD for organizations.
 *
 * GET — List or get organizations
 * POST — Create, update, delete, archive, transfer ownership
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import {
  createOrganization,
  getOrganization,
  getOrganizationBySlug,
  listOrganizations,
  getUserOrganizations,
  updateOrganization,
  deleteOrganization,
  archiveOrganization,
  transferOwnership,
} from "../../../lib/organization";
import { logError } from "../../../lib/verification/secureLogger";

const rl = rateLimit({ windowMs: 60_000, max: 30 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { mode, orgId, slug, type, status, limit, offset } = req.query;

      // Get specific org by ID
      if (orgId) {
        const result = await getOrganization(orgId);
        if (!result.success) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(200).json({ success: true, data: result.data });
      }

      // Get specific org by slug
      if (slug) {
        const result = await getOrganizationBySlug(slug);
        if (!result.success) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(200).json({ success: true, data: result.data });
      }

      // Get user's organizations
      if (mode === "my") {
        const result = await getUserOrganizations(user.id);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.status(200).json({ success: true, data: result.data });
      }

      // List all organizations
      const result = await listOrganizations({
        type,
        status,
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (err) {
      logError("OrganizationAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch organizations" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { action, name, slug, type, description, website, industry, size, contactEmail, contactPhone, metadata, orgId, updates, newOwnerId } = req.body;

      if (action === "create") {
        if (!name || !slug) {
          return res.status(400).json({ error: "name and slug are required" });
        }

        const result = await createOrganization({
          name,
          slug,
          type,
          description,
          website,
          ownerId: user.id,
          industry,
          size,
          contactEmail,
          contactPhone,
          metadata,
        });

        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(201).json({ success: true, data: result.data });
      }

      if (action === "update") {
        if (!orgId || !updates) {
          return res.status(400).json({ error: "orgId and updates are required" });
        }

        const result = await updateOrganization(orgId, updates, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({ success: true, data: result.data });
      }

      if (action === "delete") {
        if (!orgId) {
          return res.status(400).json({ error: "orgId is required" });
        }

        const result = await deleteOrganization(orgId, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({ success: true });
      }

      if (action === "archive") {
        if (!orgId) {
          return res.status(400).json({ error: "orgId is required" });
        }

        const result = await archiveOrganization(orgId, user.id);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({ success: true, data: result.data });
      }

      if (action === "transfer_ownership") {
        if (!orgId || !newOwnerId) {
          return res.status(400).json({ error: "orgId and newOwnerId are required" });
        }

        const result = await transferOwnership(orgId, user.id, newOwnerId);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({ success: true, data: result.data });
      }

      return res.status(400).json({ error: "Invalid action" });
    } catch (err) {
      logError("OrganizationAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to process request" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
