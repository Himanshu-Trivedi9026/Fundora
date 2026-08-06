// Connector Manager — provider registry and lifecycle management
// Registers, connects, and manages enterprise integration connectors

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logAuditEvent } from "../verification/auditLog.js";
import {
  SlackConnector,
  TeamsConnector,
  DiscordConnector,
  GoogleWorkspaceConnector,
  GitHubConnector,
  JiraConnector,
  NotionConnector,
} from "./baseConnector.js";

const CONNECTOR_CLASSES = {
  slack: SlackConnector,
  teams: TeamsConnector,
  discord: DiscordConnector,
  google_workspace: GoogleWorkspaceConnector,
  github: GitHubConnector,
  jira: JiraConnector,
  notion: NotionConnector,
};

const _instances = new Map();

export async function registerConnector(options) {
  try {
    const { data, error } = await supabaseAdmin
      .from("connector_configs")
      .insert({
        provider: options.provider,
        label: options.label || options.provider,
        config: options.config || {},
        credentials: options.credentials || {},
        status: "disconnected",
        webhook_url: options.webhookUrl || null,
        organization_id: options.organizationId || null,
        created_by: options.createdBy || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await logAuditEvent({
      action: "connector.registered",
      actorId: options.createdBy,
      targetType: "connector_config",
      targetId: data.id,
      metadata: { provider: options.provider },
    });

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function connectConnector(connectorId) {
  try {
    const { data: config, error } = await supabaseAdmin
      .from("connector_configs")
      .select("*")
      .eq("id", connectorId)
      .single();

    if (error || !config)
      return { success: false, error: "Connector config not found" };

    const ConnectorClass = CONNECTOR_CLASSES[config.provider];
    if (!ConnectorClass)
      return { success: false, error: `Unknown provider: ${config.provider}` };

    const instance = new ConnectorClass(config);
    const result = await instance.connect();

    if (result.success) {
      await supabaseAdmin
        .from("connector_configs")
        .update({
          status: "connected",
          is_active: true,
          last_connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectorId);

      _instances.set(connectorId, instance);
    } else {
      await supabaseAdmin
        .from("connector_configs")
        .update({
          status: "error",
          last_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectorId);
    }

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function disconnectConnector(connectorId) {
  try {
    const instance = _instances.get(connectorId);
    if (instance) {
      await instance.disconnect();
      _instances.delete(connectorId);
    }

    await supabaseAdmin
      .from("connector_configs")
      .update({
        status: "disconnected",
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectorId);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendConnectorMessage(connectorId, channel, message) {
  try {
    const instance = _instances.get(connectorId);
    if (!instance) {
      // Auto-connect
      const connectResult = await connectConnector(connectorId);
      if (!connectResult.success) return connectResult;
    }

    const connectedInstance = _instances.get(connectorId);
    return await connectedInstance.sendMessage(channel, message);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getConnectorStatus(connectorId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("connector_configs")
      .select(
        "id, provider, label, status, is_active, last_connected_at, last_error, metadata",
      )
      .eq("id", connectorId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listConnectors(options = {}) {
  try {
    let query = supabaseAdmin
      .from("connector_configs")
      .select("*", { count: "exact" });

    if (options.provider) query = query.eq("provider", options.provider);
    if (options.organizationId)
      query = query.eq("organization_id", options.organizationId);
    if (options.status) query = query.eq("status", options.status);

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

export async function deleteConnector(connectorId) {
  try {
    await disconnectConnector(connectorId);
    const { error } = await supabaseAdmin
      .from("connector_configs")
      .delete()
      .eq("id", connectorId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function getConnectorInstance(connectorId) {
  return _instances.get(connectorId) || null;
}

export function getAvailableProviders() {
  return Object.keys(CONNECTOR_CLASSES);
}
