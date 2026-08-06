/**
 * Organization Engine — CRUD, members, invitations, departments, teams, settings.
 *
 * All functions follow the success/error pattern. Never throw.
 * Uses supabaseAdmin for server-side DB access.
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError, logWarn } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";

// ─── Constants ──────────────────────────────────────────────────────

export const ORG_TYPES = [
  "company",
  "incubator",
  "university",
  "ngo",
  "government",
  "accelerator",
  "other",
];

export const ORG_STATUSES = ["active", "suspended", "pending", "archived"];

export const ORG_ROLES = [
  "owner",
  "admin",
  "finance_manager",
  "campaign_manager",
  "reviewer",
  "auditor",
  "moderator",
  "member",
  "guest",
];

// ─── Authorization helpers (CR-6) ──────────────────────────────────

/**
 * Roles that may only be assigned by the organization owner.
 * Prevents privilege escalation: a member cannot become admin/owner and an
 * admin cannot hand out the owner (or admin) role to themselves or others.
 */
const OWNER_ONLY_ROLES = ["owner", "admin"];

/**
 * Verify that `actorId` is permitted to assign `targetRole` inside the
 * organization. Owner and admin may manage members; only the owner may assign
 * the owner/admin roles. The service-role client is used here, so this check
 * MUST run BEFORE any service-role write. Returns { allowed, error }.
 */
async function canManageRole(organizationId, actorId, targetRole) {
  if (!organizationId || !actorId) {
    return { allowed: false, error: "organizationId and actorId are required" };
  }

  const { data: actor } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", actorId)
    .eq("status", "active")
    .single();

  if (!actor || !["owner", "admin"].includes(actor.role)) {
    return { allowed: false, error: "Insufficient permissions" };
  }

  if (OWNER_ONLY_ROLES.includes(targetRole) && actor.role !== "owner") {
    return {
      allowed: false,
      error: `Only the organization owner can assign the ${targetRole} role`,
    };
  }

  return { allowed: true };
}

/**
 * Returns true if `userId` is an active member of the organization.
 */
async function isActiveMember(organizationId, userId) {
  const { data: member } = await supabaseAdmin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(member);
}

// ─── Organization CRUD ─────────────────────────────────────────────

/**
 * Create a new organization.
 */
export async function createOrganization({
  name,
  slug,
  type = "company",
  description,
  website,
  ownerId,
  industry,
  size,
  contactEmail,
  contactPhone,
  metadata = {},
}) {
  try {
    if (!name || !slug || !ownerId) {
      return { success: false, error: "name, slug, and ownerId are required" };
    }

    // Validate type
    if (!ORG_TYPES.includes(type)) {
      return {
        success: false,
        error: `Invalid type: ${type}. Must be one of: ${ORG_TYPES.join(", ")}`,
      };
    }

    // Check slug uniqueness
    const { data: existing } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return { success: false, error: `Slug "${slug}" is already taken` };
    }

    // Create organization
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .insert({
        name,
        slug,
        type,
        description,
        website,
        industry,
        size,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        owner_id: ownerId,
        metadata,
      })
      .select()
      .single();

    if (orgErr) {
      logError("Organization", "createOrganization insert error", {
        error: orgErr.message,
      });
      return { success: false, error: orgErr.message };
    }

    // Add owner as member
    const { error: memberErr } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id: org.id,
        user_id: ownerId,
        role: "owner",
        status: "active",
        joined_at: new Date().toISOString(),
      });

    if (memberErr) {
      logError("Organization", "createOrganization add owner error", {
        error: memberErr.message,
      });
      // Org created but owner not added - log warning but continue
    }

    await logAuditEvent({
      eventType: "organization_created",
      entityType: "organization",
      entityId: org.id,
      userId: ownerId,
      details: { name, slug, type },
    });

    logInfo("Organization", "Organization created", {
      orgId: org.id,
      name,
      ownerId,
    });

    return { success: true, data: org };
  } catch (err) {
    logError("Organization", "createOrganization unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get an organization by ID.
 */
export async function getOrganization(orgId) {
  try {
    if (!orgId) {
      return { success: false, error: "orgId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .is("deleted_at", null)
      .single();

    if (error) {
      logError("Organization", "getOrganization query error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("Organization", "getOrganization unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get an organization by slug.
 */
export async function getOrganizationBySlug(slug) {
  try {
    if (!slug) {
      return { success: false, error: "slug is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("slug", slug)
      .is("deleted_at", null)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("Organization", "getOrganizationBySlug unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Update an organization.
 */
export async function updateOrganization(orgId, updates, userId) {
  try {
    if (!orgId || !updates || !userId) {
      return {
        success: false,
        error: "orgId, updates, and userId are required",
      };
    }

    // Verify ownership or admin
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    // Whitelist allowed fields
    const allowedFields = [
      "name",
      "description",
      "website",
      "logo_url",
      "type",
      "industry",
      "size",
      "tax_id",
      "registration_number",
      "contact_email",
      "contact_phone",
      "address",
      "settings",
      "metadata",
      "status",
    ];

    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return { success: false, error: "No valid fields to update" };
    }

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .update(sanitized)
      .eq("id", orgId)
      .select()
      .single();

    if (error) {
      logError("Organization", "updateOrganization error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "organization_updated",
      entityType: "organization",
      entityId: orgId,
      userId,
      details: { updatedFields: Object.keys(sanitized) },
    });

    return { success: true, data };
  } catch (err) {
    logError("Organization", "updateOrganization unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Soft-delete an organization. Only owner can delete.
 */
export async function deleteOrganization(orgId, userId) {
  try {
    if (!orgId || !userId) {
      return { success: false, error: "orgId and userId are required" };
    }

    // Verify owner
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!member || member.role !== "owner") {
      return {
        success: false,
        error: "Only the organization owner can delete",
      };
    }

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", orgId)
      .select()
      .single();

    if (error) {
      logError("Organization", "deleteOrganization error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "organization_deleted",
      entityType: "organization",
      entityId: orgId,
      userId,
      details: {},
    });

    logInfo("Organization", "Organization soft-deleted", { orgId, userId });

    return { success: true, data };
  } catch (err) {
    logError("Organization", "deleteOrganization unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * List organizations with optional filters.
 */
export async function listOrganizations({
  userId,
  type,
  status,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("organizations")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    if (userId) {
      // Only orgs the user is a member of
      query = query.in(
        "id",
        supabaseAdmin
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userId)
          .eq("status", "active"),
      );
    }

    const { data, count, error } = await query;

    if (error) {
      logError("Organization", "listOrganizations error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    logError("Organization", "listOrganizations unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get all organizations a user belongs to.
 */
export async function getUserOrganizations(userId) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }

    const { data: memberships, error: memErr } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, role, status, joined_at")
      .eq("user_id", userId)
      .eq("status", "active");

    if (memErr) {
      logError("Organization", "getUserOrganizations memberships error", {
        error: memErr.message,
      });
      return { success: false, error: memErr.message };
    }

    if (!memberships || memberships.length === 0) {
      return { success: true, data: [] };
    }

    const orgIds = memberships.map((m) => m.organization_id);

    const { data: orgs, error: orgErr } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .in("id", orgIds)
      .is("deleted_at", null);

    if (orgErr) {
      logError("Organization", "getUserOrganizations orgs error", {
        error: orgErr.message,
      });
      return { success: false, error: orgErr.message };
    }

    // Merge membership info with org data
    const result = (orgs || []).map((org) => {
      const membership = memberships.find((m) => m.organization_id === org.id);
      return {
        ...org,
        membership_role: membership?.role,
        membership_joined_at: membership?.joined_at,
      };
    });

    return { success: true, data: result };
  } catch (err) {
    logError("Organization", "getUserOrganizations unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Transfer organization ownership.
 */
export async function transferOwnership(orgId, currentOwnerId, newOwnerId) {
  try {
    if (!orgId || !currentOwnerId || !newOwnerId) {
      return {
        success: false,
        error: "orgId, currentOwnerId, and newOwnerId are required",
      };
    }

    // Verify current owner
    const { data: currentMember } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", currentOwnerId)
      .eq("status", "active")
      .single();

    if (!currentMember || currentMember.role !== "owner") {
      return {
        success: false,
        error: "Only the current owner can transfer ownership",
      };
    }

    // Verify new owner is a member
    const { data: newMember } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", newOwnerId)
      .eq("status", "active")
      .single();

    if (!newMember) {
      return { success: false, error: "New owner must be an active member" };
    }

    // Update owner_id on org
    const { error: orgErr } = await supabaseAdmin
      .from("organizations")
      .update({ owner_id: newOwnerId })
      .eq("id", orgId);

    if (orgErr) {
      logError("Organization", "transferOwnership org update error", {
        error: orgErr.message,
      });
      return { success: false, error: orgErr.message };
    }

    // Set new owner as owner role
    await supabaseAdmin
      .from("organization_members")
      .update({ role: "owner" })
      .eq("organization_id", orgId)
      .eq("user_id", newOwnerId);

    // Set old owner as admin
    await supabaseAdmin
      .from("organization_members")
      .update({ role: "admin" })
      .eq("organization_id", orgId)
      .eq("user_id", currentOwnerId);

    await logAuditEvent({
      eventType: "ownership_transferred",
      entityType: "organization",
      entityId: orgId,
      userId: currentOwnerId,
      details: { newOwnerId },
    });

    logInfo("Organization", "Ownership transferred", {
      orgId,
      from: currentOwnerId,
      to: newOwnerId,
    });

    return { success: true, data: { orgId, newOwnerId } };
  } catch (err) {
    logError("Organization", "transferOwnership unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Archive an organization.
 */
export async function archiveOrganization(orgId, userId) {
  try {
    if (!orgId || !userId) {
      return { success: false, error: "orgId and userId are required" };
    }

    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .update({ status: "archived" })
      .eq("id", orgId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "organization_archived",
      entityType: "organization",
      entityId: orgId,
      userId,
      details: {},
    });

    return { success: true, data };
  } catch (err) {
    logError("Organization", "archiveOrganization unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

// ─── Member Management ──────────────────────────────────────────────

/**
 * Add a member to an organization.
 */
export async function addMember({
  organizationId,
  userId,
  role = "member",
  invitedBy,
}) {
  try {
    if (!organizationId || !userId) {
      return {
        success: false,
        error: "organizationId and userId are required",
      };
    }

    if (!ORG_ROLES.includes(role)) {
      return { success: false, error: `Invalid role: ${role}` };
    }

    // SECURITY (CR-6): only a manager of this organization may add members,
    // and only the owner may grant the owner/admin roles. Ownership is verified
    // BEFORE the service role is used. The HTTP routes always pass the
    // authenticated user as invitedBy; legacy internal callers may omit it.
    if (invitedBy) {
      const permitted = await canManageRole(organizationId, invitedBy, role);
      if (!permitted.allowed) {
        return { success: false, error: permitted.error };
      }
    }

    // Check not already a member
    const { data: existing } = await supabaseAdmin
      .from("organization_members")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing && existing.status === "active") {
      return { success: false, error: "User is already an active member" };
    }

    // If previously a member, reactivate
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("organization_members")
        .update({
          role,
          status: "active",
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      await logAuditEvent({
        eventType: "member_reactivated",
        entityType: "organization_member",
        entityId: data.id,
        userId: invitedBy || userId,
        details: { organizationId, targetUserId: userId, role },
      });

      return { success: true, data };
    }

    // Add new member
    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        role,
        status: "active",
        invited_by: invitedBy || userId,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logError("Organization", "addMember insert error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "member_added",
      entityType: "organization_member",
      entityId: data.id,
      userId: invitedBy || userId,
      details: { organizationId, targetUserId: userId, role },
    });

    logInfo("Organization", "Member added", { organizationId, userId, role });

    return { success: true, data };
  } catch (err) {
    logError("Organization", "addMember unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Remove a member from an organization.
 */
export async function removeMember(organizationId, userId, performedBy) {
  try {
    if (!organizationId || !userId || !performedBy) {
      return {
        success: false,
        error: "organizationId, userId, and performedBy are required",
      };
    }

    // Verify performer is admin or owner
    const { data: performer } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", performedBy)
      .eq("status", "active")
      .single();

    if (!performer || !["owner", "admin"].includes(performer.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    // Cannot remove owner
    const { data: target } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .single();

    if (target?.role === "owner") {
      return { success: false, error: "Cannot remove the organization owner" };
    }

    const { error } = await supabaseAdmin
      .from("organization_members")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "member_removed",
      entityType: "organization_member",
      entityId: organizationId,
      userId: performedBy,
      details: { organizationId, targetUserId: userId },
    });

    return { success: true };
  } catch (err) {
    logError("Organization", "removeMember unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Update a member's role.
 */
export async function updateMemberRole(
  organizationId,
  userId,
  newRole,
  performedBy,
) {
  try {
    if (!organizationId || !userId || !newRole || !performedBy) {
      return { success: false, error: "All fields required" };
    }

    if (!ORG_ROLES.includes(newRole)) {
      return { success: false, error: `Invalid role: ${newRole}` };
    }

    // SECURITY (CR-6): users can never change their own role.
    if (performedBy === userId) {
      return { success: false, error: "You cannot change your own role" };
    }

    // SECURITY (CR-6): only the owner may assign the owner/admin roles; an
    // admin cannot escalate a member (or themselves) to owner. Ownership is
    // verified BEFORE the service role is used.
    const permitted = await canManageRole(organizationId, performedBy, newRole);
    if (!permitted.allowed) {
      return { success: false, error: permitted.error };
    }

    // The owner role can only change via transferOwnership, never a role update.
    const { data: target } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (target?.role === "owner") {
      return {
        success: false,
        error:
          "The organization owner's role can only be changed via ownership transfer",
      };
    }

    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "member_role_updated",
      entityType: "organization_member",
      entityId: data.id,
      userId: performedBy,
      details: { organizationId, targetUserId: userId, newRole },
    });

    return { success: true, data };
  } catch (err) {
    logError("Organization", "updateMemberRole unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get members of an organization.
 */
export async function getMembers(
  organizationId,
  { role, status = "active", limit = 50, offset = 0 } = {},
  performedBy,
) {
  try {
    if (!organizationId) {
      return { success: false, error: "organizationId is required" };
    }

    // SECURITY (CR-6): only active members of the organization may view its
    // member list.
    if (performedBy) {
      const isMember = await isActiveMember(organizationId, performedBy);
      if (!isMember) {
        return { success: false, error: "Insufficient permissions" };
      }
    }

    let query = supabaseAdmin
      .from("organization_members")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (role) query = query.eq("role", role);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    logError("Organization", "getMembers unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get a specific member of an organization.
 */
export async function getMember(organizationId, userId, performedBy) {
  try {
    if (!organizationId || !userId) {
      return {
        success: false,
        error: "organizationId and userId are required",
      };
    }

    // SECURITY (CR-6): only active members of the organization may view its
    // member records.
    if (performedBy) {
      const isMember = await isActiveMember(organizationId, performedBy);
      if (!isMember) {
        return { success: false, error: "Insufficient permissions" };
      }
    }

    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("Organization", "getMember unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

// ─── Invitation Management ──────────────────────────────────────────

/**
 * Generate a random token for invitations.
 */
function generateToken() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create an invitation to join an organization.
 */
export async function createInvitation({
  organizationId,
  email,
  role = "member",
  invitedBy,
}) {
  try {
    if (!organizationId || !email || !invitedBy) {
      return {
        success: false,
        error: "organizationId, email, and invitedBy are required",
      };
    }

    if (!ORG_ROLES.includes(role)) {
      return { success: false, error: `Invalid role: ${role}` };
    }

    // SECURITY (CR-6): only a manager of this organization may invite, and
    // only the owner may invite with the owner/admin role. Ownership is
    // verified BEFORE the service role is used.
    const permitted = await canManageRole(organizationId, invitedBy, role);
    if (!permitted.allowed) {
      return {
        success: false,
        error:
          permitted.error === "Insufficient permissions"
            ? "Insufficient permissions to invite"
            : permitted.error,
      };
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return {
        success: false,
        error: "A pending invitation already exists for this email",
      };
    }

    const token = generateToken();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(); // 7 days

    const { data, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        organization_id: organizationId,
        email,
        role,
        invited_by: invitedBy,
        token,
        status: "pending",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      logError("Organization", "createInvitation insert error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    await logAuditEvent({
      eventType: "invitation_created",
      entityType: "invitation",
      entityId: data.id,
      userId: invitedBy,
      details: { organizationId, email, role },
    });

    return { success: true, data };
  } catch (err) {
    logError("Organization", "createInvitation unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Accept an invitation.
 */
export async function acceptInvitation(invitationId, userId, userEmail) {
  try {
    if (!invitationId || !userId) {
      return { success: false, error: "invitationId and userId are required" };
    }

    const { data: invite, error: fetchErr } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (fetchErr || !invite) {
      return { success: false, error: "Invitation not found" };
    }

    if (invite.status !== "pending") {
      return {
        success: false,
        error: `Invitation is ${invite.status}, not pending`,
      };
    }

    // SECURITY (CR-6): only the invited email may accept the invitation.
    if (
      userEmail &&
      invite.email &&
      userEmail.toLowerCase() !== invite.email.toLowerCase()
    ) {
      return {
        success: false,
        error: "This invitation is not addressed to you",
      };
    }

    if (new Date(invite.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitationId);
      return { success: false, error: "Invitation has expired" };
    }

    // Add user as member
    const addResult = await addMember({
      organizationId: invite.organization_id,
      userId,
      role: invite.role,
      invitedBy: invite.invited_by,
    });

    if (!addResult.success) {
      return addResult;
    }

    // Update invitation status
    await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", invitationId);

    await logAuditEvent({
      eventType: "invitation_accepted",
      entityType: "invitation",
      entityId: invitationId,
      userId,
      details: { organizationId: invite.organization_id, role: invite.role },
    });

    return { success: true, data: addResult.data };
  } catch (err) {
    logError("Organization", "acceptInvitation unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Revoke an invitation.
 */
export async function revokeInvitation(invitationId, performedBy) {
  try {
    if (!invitationId || !performedBy) {
      return {
        success: false,
        error: "invitationId and performedBy are required",
      };
    }

    const { data: invite } = await supabaseAdmin
      .from("invitations")
      .select("organization_id")
      .eq("id", invitationId)
      .single();

    if (!invite) {
      return { success: false, error: "Invitation not found" };
    }

    // Verify performer is admin or owner
    const { data: performer } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", invite.organization_id)
      .eq("user_id", performedBy)
      .eq("status", "active")
      .single();

    if (!performer || !["owner", "admin"].includes(performer.role)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const { data, error } = await supabaseAdmin
      .from("invitations")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", invitationId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("Organization", "revokeInvitation unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * List invitations for an organization.
 */
export async function getInvitations(
  organizationId,
  { status, limit = 50, offset = 0 } = {},
  performedBy,
) {
  try {
    if (!organizationId) {
      return { success: false, error: "organizationId is required" };
    }

    // SECURITY (CR-6): only managers of the organization may list invitations
    // (they expose invitee emails), and the accept token is never returned.
    if (performedBy) {
      const permitted = await canManageRole(
        organizationId,
        performedBy,
        "member",
      );
      if (!permitted.allowed) {
        return { success: false, error: permitted.error };
      }
    }

    let query = supabaseAdmin
      .from("invitations")
      .select(
        "id, organization_id, email, role, invited_by, status, created_at, updated_at, expires_at",
        { count: "exact" },
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    logError("Organization", "getInvitations unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

// ─── Department Management ──────────────────────────────────────────

/**
 * Create a department.
 */
export async function createDepartment({
  organizationId,
  name,
  parentDepartmentId,
  headUserId,
  description,
}) {
  try {
    if (!organizationId || !name) {
      return { success: false, error: "organizationId and name are required" };
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .insert({
        organization_id: organizationId,
        name,
        parent_department_id: parentDepartmentId || null,
        head_user_id: headUserId || null,
        description,
      })
      .select()
      .single();

    if (error) {
      logError("Organization", "createDepartment error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("Organization", "createDepartment unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Update a department.
 */
export async function updateDepartment(departmentId, updates, performedBy) {
  try {
    if (!departmentId || !updates || !performedBy) {
      return {
        success: false,
        error: "departmentId, updates, and performedBy are required",
      };
    }

    const allowedFields = [
      "name",
      "description",
      "parent_department_id",
      "head_user_id",
      "budget",
      "status",
      "metadata",
    ];
    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return { success: false, error: "No valid fields to update" };
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .update(sanitized)
      .eq("id", departmentId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("Organization", "updateDepartment unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Delete a department.
 */
export async function deleteDepartment(departmentId, performedBy) {
  try {
    if (!departmentId || !performedBy) {
      return {
        success: false,
        error: "departmentId and performedBy are required",
      };
    }

    const { error } = await supabaseAdmin
      .from("departments")
      .delete()
      .eq("id", departmentId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    logError("Organization", "deleteDepartment unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * List departments for an organization.
 */
export async function getDepartments(organizationId) {
  try {
    if (!organizationId) {
      return { success: false, error: "organizationId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("departments")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("Organization", "getDepartments unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

// ─── Team Management ────────────────────────────────────────────────

/**
 * Create a team.
 */
export async function createTeam({
  organizationId,
  departmentId,
  name,
  teamLeadId,
  description,
}) {
  try {
    if (!organizationId || !name) {
      return { success: false, error: "organizationId and name are required" };
    }

    const { data, error } = await supabaseAdmin
      .from("teams")
      .insert({
        organization_id: organizationId,
        department_id: departmentId || null,
        name,
        team_lead_id: teamLeadId || null,
        description,
      })
      .select()
      .single();

    if (error) {
      logError("Organization", "createTeam error", { error: error.message });
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("Organization", "createTeam unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Add a member to a team.
 */
export async function addTeamMember(teamId, userId, role = "member") {
  try {
    if (!teamId || !userId) {
      return { success: false, error: "teamId and userId are required" };
    }

    const { data, error } = await supabaseAdmin
      .from("team_members")
      .insert({
        team_id: teamId,
        user_id: userId,
        role,
      })
      .select()
      .single();

    if (error) {
      logError("Organization", "addTeamMember error", { error: error.message });
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    logError("Organization", "addTeamMember unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Remove a member from a team.
 */
export async function removeTeamMember(teamId, userId) {
  try {
    if (!teamId || !userId) {
      return { success: false, error: "teamId and userId are required" };
    }

    const { error } = await supabaseAdmin
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    logError("Organization", "removeTeamMember unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * List teams for an organization.
 */
export async function getTeams(organizationId, { departmentId } = {}) {
  try {
    if (!organizationId) {
      return { success: false, error: "organizationId is required" };
    }

    let query = supabaseAdmin
      .from("teams")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");

    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("Organization", "getTeams unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

// ─── Settings Management ────────────────────────────────────────────

/**
 * Get all settings for an organization.
 */
export async function getOrganizationSettings(organizationId, performedBy) {
  try {
    if (!organizationId) {
      return { success: false, error: "organizationId is required" };
    }

    // SECURITY (CR-6): only active members of the organization may read its
    // settings.
    if (performedBy) {
      const isMember = await isActiveMember(organizationId, performedBy);
      if (!isMember) {
        return { success: false, error: "Insufficient permissions" };
      }
    }

    const { data, error } = await supabaseAdmin
      .from("organization_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("setting_key");

    if (error) {
      return { success: false, error: error.message };
    }

    // Convert array to key-value object
    const settings = {};
    for (const row of data || []) {
      settings[row.setting_key] = row.setting_value;
    }

    return { success: true, data: settings };
  } catch (err) {
    logError("Organization", "getOrganizationSettings unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Set a specific setting for an organization.
 */
export async function setOrganizationSetting(
  organizationId,
  key,
  value,
  performedBy,
) {
  try {
    if (!organizationId || !key) {
      return { success: false, error: "organizationId and key are required" };
    }

    // SECURITY (CR-6): only a manager of this organization may change its
    // settings. Ownership is verified BEFORE the service role is used.
    if (performedBy) {
      const permitted = await canManageRole(
        organizationId,
        performedBy,
        "member",
      );
      if (!permitted.allowed) {
        return { success: false, error: permitted.error };
      }
    }

    // Upsert the setting
    const { data, error } = await supabaseAdmin
      .from("organization_settings")
      .upsert(
        {
          organization_id: organizationId,
          setting_key: key,
          setting_value: value,
        },
        { onConflict: "organization_id,setting_key" },
      )
      .select()
      .single();

    if (error) {
      logError("Organization", "setOrganizationSetting upsert error", {
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    if (performedBy) {
      await logAuditEvent({
        eventType: "org_setting_changed",
        entityType: "organization_setting",
        entityId: data.id,
        userId: performedBy,
        details: { organizationId, key },
      });
    }

    return { success: true, data };
  } catch (err) {
    logError("Organization", "setOrganizationSetting unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}

/**
 * Get a specific setting for an organization.
 */
export async function getOrganizationSetting(organizationId, key, performedBy) {
  try {
    if (!organizationId || !key) {
      return { success: false, error: "organizationId and key are required" };
    }

    // SECURITY (CR-6): only active members of the organization may read its
    // settings.
    if (performedBy) {
      const isMember = await isActiveMember(organizationId, performedBy);
      if (!isMember) {
        return { success: false, error: "Insufficient permissions" };
      }
    }

    const { data, error } = await supabaseAdmin
      .from("organization_settings")
      .select("setting_value")
      .eq("organization_id", organizationId)
      .eq("setting_key", key)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data?.setting_value || null };
  } catch (err) {
    logError("Organization", "getOrganizationSetting unexpected error", {
      error: err.message,
    });
    return { success: false, error: "Internal error" };
  }
}
