// Alert Manager — alerting and notification for platform issues
// Handles threshold, anomaly, heartbeat, and custom alerts

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logAuditEvent } from "../verification/auditLog.js";
import { secureLogger } from "../verification/secureLogger.js";

export const ALERT_SEVERITIES = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
  DEBUG: "debug",
};
export const ALERT_STATUSES = {
  ACTIVE: "active",
  ACKNOWLEDGED: "acknowledged",
  RESOLVED: "resolved",
  SILENCED: "silenced",
};
export const ALERT_TYPES = {
  THRESHOLD: "threshold",
  ANOMALY: "anomaly",
  HEARTBEAT: "heartbeat",
  CUSTOM: "custom",
};

export async function createAlert(options) {
  try {
    const { data, error } = await supabaseAdmin
      .from("alerts")
      .insert({
        alert_name: options.name,
        alert_type: options.type || ALERT_TYPES.CUSTOM,
        severity: options.severity || ALERT_SEVERITIES.INFO,
        status: ALERT_STATUSES.ACTIVE,
        metric_name: options.metricName || null,
        condition: options.condition || {},
        value: options.value || null,
        threshold: options.threshold || null,
        message: options.message || null,
        source: options.source || "fundora",
        organization_id: options.organizationId || null,
        assigned_to: options.assignedTo || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Record alert event
    await supabaseAdmin.from("alert_events").insert({
      alert_id: data.id,
      event_type: "fired",
      value: options.value,
      message: options.message,
    });

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function acknowledgeAlert(alertId, userId) {
  try {
    const { error } = await supabaseAdmin
      .from("alerts")
      .update({
        status: ALERT_STATUSES.ACKNOWLEDGED,
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (error) return { success: false, error: error.message };

    await supabaseAdmin.from("alert_events").insert({
      alert_id: alertId,
      event_type: "acknowledged",
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function resolveAlert(alertId) {
  try {
    const { error } = await supabaseAdmin
      .from("alerts")
      .update({
        status: ALERT_STATUSES.RESOLVED,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (error) return { success: false, error: error.message };

    await supabaseAdmin.from("alert_events").insert({
      alert_id: alertId,
      event_type: "resolved",
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getAlerts(options = {}) {
  try {
    let query = supabaseAdmin.from("alerts").select("*", { count: "exact" });

    if (options.status) query = query.eq("status", options.status);
    if (options.severity) query = query.eq("severity", options.severity);
    if (options.alertType) query = query.eq("alert_type", options.alertType);
    if (options.source) query = query.eq("source", options.source);
    if (options.organizationId)
      query = query.eq("organization_id", options.organizationId);

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

export async function getAlertHistory(alertId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("alert_events")
      .select("*")
      .eq("alert_id", alertId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function checkThresholdAlert(
  metricName,
  value,
  threshold,
  options = {},
) {
  if (value > threshold) {
    return createAlert({
      name: `${metricName} threshold breached`,
      type: ALERT_TYPES.THRESHOLD,
      severity: options.severity || ALERT_SEVERITIES.WARNING,
      metricName,
      value,
      threshold,
      message: `${metricName} is ${value}, exceeding threshold of ${threshold}`,
      source: options.source || "fundora",
      organizationId: options.organizationId,
    });
  }
  return { success: true, data: null };
}

export async function silenceAlert(alertId) {
  try {
    const { error } = await supabaseAdmin
      .from("alerts")
      .update({
        status: ALERT_STATUSES.SILENCED,
        updated_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (error) return { success: false, error: error.message };

    await supabaseAdmin.from("alert_events").insert({
      alert_id: alertId,
      event_type: "silenced",
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getAlertStats() {
  try {
    const { data, error } = await supabaseAdmin
      .from("alerts")
      .select("status, severity, alert_type");

    if (error) return { success: false, error: error.message };

    const stats = { total: 0, byStatus: {}, bySeverity: {}, byType: {} };
    for (const alert of data || []) {
      stats.total++;
      stats.byStatus[alert.status] = (stats.byStatus[alert.status] || 0) + 1;
      stats.bySeverity[alert.severity] =
        (stats.bySeverity[alert.severity] || 0) + 1;
      stats.byType[alert.alert_type] =
        (stats.byType[alert.alert_type] || 0) + 1;
    }

    return { success: true, data: stats };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
