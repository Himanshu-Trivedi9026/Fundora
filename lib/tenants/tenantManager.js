// Tenant Manager — organization multi-tenancy management
// Handles provisioning, config, branding, and usage quotas

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logAuditEvent } from "../verification/auditLog.js";
import { secureLogger } from "../verification/secureLogger.js";

// ——————————————————————————————————————
// Tenant Provisioning
// ——————————————————————————————————————

export async function createTenant(options) {
  try {
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: options.name,
        slug: options.slug || slugify(options.name),
        description: options.description || "",
        config: options.config || {},
        settings: options.settings || {},
        branding: options.branding || {},
        website_url: options.websiteUrl || null,
        contact_email: options.contactEmail || null,
        plan: options.plan || "free",
        created_by: options.createdBy || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Initialize default tenant settings
    await initializeTenantSettings(data.id);

    await logAuditEvent({
      action: "tenant.created",
      actorId: options.createdBy,
      targetType: "organization",
      targetId: data.id,
      metadata: { name: options.name, plan: options.plan },
    });

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function updateTenant(tenantId, updates) {
  try {
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getTenant(tenantId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", tenantId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listTenants(options = {}) {
  try {
    let query = supabaseAdmin
      .from("organizations")
      .select("*", { count: "exact" });
    if (options.plan) query = query.eq("plan", options.plan);
    if (options.search)
      query = query.or(
        `name.ilike.%${options.search}%,slug.ilike.%${options.search}%`,
      );
    query = query.order("created_at", { ascending: false });

    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Tenant Settings
// ——————————————————————————————————————

async function initializeTenantSettings(tenantId) {
  const defaultSettings = {
    features: {
      agent_platform: false,
      mcp_server: false,
      enterprise_connectors: false,
      event_bus: true,
      analytics_studio: true,
      data_export: true,
    },
    limits: {
      max_users: 10,
      max_campaigns: 50,
      max_agents: 5,
      storage_mb: 500,
    },
    security: {
      require_mfa: false,
      session_timeout_minutes: 60,
      password_policy: "standard",
    },
    notifications: {
      email: true,
      in_app: true,
    },
  };

  await supabaseAdmin.from("tenant_settings").insert({
    organization_id: tenantId,
    settings: defaultSettings,
    branding: {},
    features: defaultSettings.features,
    limits: defaultSettings.limits,
  });
}

export async function getTenantSettings(tenantId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("tenant_settings")
      .select("*")
      .eq("organization_id", tenantId)
      .single();

    if (error) {
      // Auto-initialize if not found
      await initializeTenantSettings(tenantId);
      const { data: retry } = await supabaseAdmin
        .from("tenant_settings")
        .select("*")
        .eq("organization_id", tenantId)
        .single();
      return { success: true, data: retry || null };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function updateTenantSettings(tenantId, updates) {
  try {
    const { data, error } = await supabaseAdmin
      .from("tenant_settings")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", tenantId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Usage Quotas
// ——————————————————————————————————————

export async function checkQuota(tenantId, resource) {
  try {
    const { data: quota, error } = await supabaseAdmin
      .from("usage_quotas")
      .select("*")
      .eq("organization_id", tenantId)
      .eq("resource", resource)
      .eq("period", "monthly")
      .single();

    if (error && error.code !== "PGRST116")
      return { success: false, error: error.message };

    if (!quota)
      return { success: true, data: { allowed: true, usage: 0, limit: null } };

    return {
      success: true,
      data: {
        allowed: quota.usage < quota.limit,
        usage: quota.usage,
        limit: quota.limit,
        remaining: quota.limit - quota.usage,
        resetsAt: quota.period_end,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function trackUsage(tenantId, resource, amount = 1) {
  try {
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data, error } = await supabaseAdmin
      .from("usage_quotas")
      .upsert(
        {
          organization_id: tenantId,
          resource,
          usage: amount,
          limit: 1000,
          period: "monthly",
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
        },
        {
          onConflict: "organization_id, resource, period, period_start",
          ignoreDuplicates: false,
        },
      )
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function setQuota(tenantId, resource, limit) {
  try {
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data, error } = await supabaseAdmin
      .from("usage_quotas")
      .upsert(
        {
          organization_id: tenantId,
          resource,
          usage: 0,
          limit,
          period: "monthly",
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
        },
        {
          onConflict: "organization_id, resource, period, period_start",
        },
      )
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getUsageSummary(tenantId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("usage_quotas")
      .select("*")
      .eq("organization_id", tenantId)
      .eq("period", "monthly");

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Tenant Branding
// ——————————————————————————————————————

export async function updateBranding(tenantId, branding) {
  try {
    const { data, error } = await supabaseAdmin
      .from("tenant_settings")
      .update({
        branding,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", tenantId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getBranding(tenantId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("tenant_settings")
      .select("branding")
      .eq("organization_id", tenantId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.branding || {} };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Helpers
// ——————————————————————————————————————

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
