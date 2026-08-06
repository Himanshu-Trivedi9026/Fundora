// Plugin Lifecycle — manages plugin state transitions
// States: draft → pending_review → approved → published → disabled/archived

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logAuditEvent } from "../verification/auditLog.js";
import { getPluginRegistry } from "./pluginRegistry.js";

export const PLUGIN_STATUSES = {
  DRAFT: "draft",
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  PUBLISHED: "published",
  DISABLED: "disabled",
  ARCHIVED: "archived",
};

const ALLOWED_TRANSITIONS = {
  [PLUGIN_STATUSES.DRAFT]: [PLUGIN_STATUSES.PENDING_REVIEW, PLUGIN_STATUSES.ARCHIVED],
  [PLUGIN_STATUSES.PENDING_REVIEW]: [PLUGIN_STATUSES.APPROVED, PLUGIN_STATUSES.REJECTED, PLUGIN_STATUSES.DRAFT],
  [PLUGIN_STATUSES.APPROVED]: [PLUGIN_STATUSES.PUBLISHED, PLUGIN_STATUSES.DISABLED],
  [PLUGIN_STATUSES.REJECTED]: [PLUGIN_STATUSES.DRAFT, PLUGIN_STATUSES.ARCHIVED],
  [PLUGIN_STATUSES.PUBLISHED]: [PLUGIN_STATUSES.DISABLED, PLUGIN_STATUSES.ARCHIVED],
  [PLUGIN_STATUSES.DISABLED]: [PLUGIN_STATUSES.PUBLISHED, PLUGIN_STATUSES.ARCHIVED],
  [PLUGIN_STATUSES.ARCHIVED]: [],
};

export function canTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export async function updatePluginStatus(pluginId, newStatus, performedBy) {
  if (!pluginId || !newStatus) {
    return { success: false, error: "pluginId and newStatus are required" };
  }

  try {
    const { data: plugin, error: fetchError } = await supabaseAdmin
      .from("plugins")
      .select("id, status, name")
      .eq("id", pluginId)
      .single();

    if (fetchError || !plugin) {
      return { success: false, error: "Plugin not found" };
    }

    if (!canTransition(plugin.status, newStatus)) {
      return {
        success: false,
        error: `Cannot transition from '${plugin.status}' to '${newStatus}'`,
      };
    }

    const updates = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === PLUGIN_STATUSES.PUBLISHED) {
      updates.published_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("plugins")
      .update(updates)
      .eq("id", pluginId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    await logAuditEvent({
      action: `plugin.status_${newStatus}`,
      entityType: "plugin",
      entityId: pluginId,
      userId: performedBy,
      details: { previousStatus: plugin.status, newStatus, pluginName: plugin.name },
    });

    return { success: true, data: { id: pluginId, status: newStatus, previousStatus: plugin.status } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function installPlugin(pluginId, userId, options = {}) {
  try {
    const { data: plugin } = await supabaseAdmin
      .from("plugins")
      .select("*")
      .eq("id", pluginId)
      .single();

    if (!plugin) return { success: false, error: "Plugin not found" };
    if (plugin.status !== PLUGIN_STATUSES.PUBLISHED) {
      return { success: false, error: "Plugin is not published" };
    }

    const registry = getPluginRegistry();
    const existing = registry.getPlugin(pluginId);
    if (existing) {
      return { success: true, data: { id: pluginId, alreadyInstalled: true } };
    }

    const pluginInstance = {
      id: plugin.id,
      name: plugin.name,
      manifest: plugin.manifest,
      enabled: true,
      status: "installed",
      version: plugin.version,
      config: options.config || {},
      metadata: {
        authorId: plugin.author_id,
        isSigned: plugin.is_signed,
        isVerified: plugin.is_verified,
      },
      hooks: {},
    };

    const registerResult = registry.registerPlugin(pluginId, pluginInstance);
    if (!registerResult.success) {
      return registerResult;
    }

    // Record download
    await supabaseAdmin.from("plugin_downloads").insert({
      plugin_id: pluginId,
      user_id: userId,
      installation_id: options.installationId,
    });

    // Increment download count
    await supabaseAdmin.rpc("increment_plugin_downloads", { plugin_id: pluginId });

    await logAuditEvent({
      action: "plugin.installed",
      entityType: "plugin",
      entityId: pluginId,
      userId,
      details: { pluginName: plugin.name },
    });

    return { success: true, data: { id: pluginId, name: plugin.name } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function uninstallPlugin(pluginId, userId) {
  try {
    const registry = getPluginRegistry();
    const plugin = registry.getPlugin(pluginId);
    if (!plugin) {
      return { success: false, error: "Plugin is not installed" };
    }

    registry.unregisterPlugin(pluginId);

    await logAuditEvent({
      action: "plugin.uninstalled",
      entityType: "plugin",
      entityId: pluginId,
      userId,
      details: { pluginName: plugin.instance.name },
    });

    return { success: true, data: { id: pluginId } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function enablePlugin(pluginId, userId) {
  return updatePluginStatus(pluginId, PLUGIN_STATUSES.PUBLISHED, userId);
}

export async function disablePlugin(pluginId, userId) {
  return updatePluginStatus(pluginId, PLUGIN_STATUSES.DISABLED, userId);
}
