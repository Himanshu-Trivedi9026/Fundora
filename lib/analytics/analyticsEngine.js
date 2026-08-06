// Analytics Engine — analytics studio with dashboards, reports, KPIs, and AI insights

import { supabaseAdmin } from "../supabaseAdmin.js";
import { secureLogger } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";

// ——————————————————————————————————————
// Dashboard Management
// ——————————————————————————————————————

export async function createDashboard(options) {
  try {
    const { data, error } = await supabaseAdmin
      .from("analytics_dashboards")
      .insert({
        name: options.name,
        description: options.description || "",
        widgets: options.widgets || [],
        layout: options.layout || null,
        config: options.config || {},
        is_public: options.isPublic || false,
        created_by: options.createdBy || null,
        organization_id: options.organizationId || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function updateDashboard(dashboardId, updates) {
  try {
    const { data, error } = await supabaseAdmin
      .from("analytics_dashboards")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dashboardId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getDashboard(dashboardId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("analytics_dashboards")
      .select("*")
      .eq("id", dashboardId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listDashboards(options = {}) {
  try {
    let query = supabaseAdmin.from("analytics_dashboards").select("*", { count: "exact" });
    if (options.organizationId) query = query.eq("organization_id", options.organizationId);
    if (options.isPublic) query = query.eq("is_public", true);
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

export async function deleteDashboard(dashboardId) {
  try {
    const { error } = await supabaseAdmin
      .from("analytics_dashboards")
      .delete()
      .eq("id", dashboardId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// KPI & Metrics
// ——————————————————————————————————————

export async function recordMetric(metricName, value, options = {}) {
  try {
    const { data, error } = await supabaseAdmin
      .from("analytics_snapshots")
      .insert({
        metric_name: metricName,
        value,
        dimensions: options.dimensions || {},
        labels: options.labels || {},
        recorded_at: new Date().toISOString(),
        organization_id: options.organizationId || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getMetrics(metricName, period = "7d") {
  try {
    const since = periodToDate(period);

    const { data, error } = await supabaseAdmin
      .from("analytics_snapshots")
      .select("*")
      .eq("metric_name", metricName)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true });

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: {
        metric: metricName,
        period,
        dataPoints: data || [],
        summary: summarizeMetric(data || []),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getPlatformMetrics() {
  try {
    const [
      totalCampaigns,
      activeCampaigns,
      totalUsers,
      totalDonations,
    ] = await Promise.all([
      supabaseAdmin.from("campaigns").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("escrow_transactions").select("amount", { count: "exact", head: true }),
    ]);

    return {
      success: true,
      data: {
        totalCampaigns: totalCampaigns.count || 0,
        activeCampaigns: activeCampaigns.count || 0,
        totalUsers: totalUsers.count || 0,
        totalDonations: totalDonations.count || 0,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Report Templates
// ——————————————————————————————————————

export async function createReport(options) {
  try {
    const { data, error } = await supabaseAdmin
      .from("report_templates")
      .insert({
        name: options.name,
        description: options.description || "",
        report_type: options.reportType,
        config: options.config || {},
        schedule_cron: options.scheduleCron || null,
        is_active: options.isActive !== false,
        created_by: options.createdBy || null,
        organization_id: options.organizationId || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listReports(options = {}) {
  try {
    let query = supabaseAdmin.from("report_templates").select("*", { count: "exact" });
    if (options.organizationId) query = query.eq("organization_id", options.organizationId);
    if (options.reportType) query = query.eq("report_type", options.reportType);
    query = query.order("name", { ascending: true });

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

export async function generateReport(reportId) {
  try {
    const { data: template, error: fetchError } = await supabaseAdmin
      .from("report_templates")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchError || !template) return { success: false, error: "Report template not found" };

    const metrics = await aggregateReportMetrics(template.config);
    return { success: true, data: { template: template.name, generatedAt: new Date().toISOString(), metrics } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// AI Insights
// ——————————————————————————————————————

export async function generateInsights(metricName) {
  try {
    const { data: snapshot } = await supabaseAdmin
      .from("analytics_snapshots")
      .select("*")
      .eq("metric_name", metricName)
      .order("recorded_at", { ascending: false })
      .limit(30);

    const dataPoints = snapshot || [];
    if (dataPoints.length < 2) {
      return { success: true, data: { insight: "Not enough data for analysis", confidence: "low" } };
    }

    const values = dataPoints.map((d) => d.value);
    const trend = values[0] > values[values.length - 1] ? "up" : "down";
    const change = ((values[0] - values[values.length - 1]) / (values[values.length - 1] || 1) * 100).toFixed(1);

    return {
      success: true,
      data: {
        metric: metricName,
        insight: `${metricName} is trending ${trend} with a ${change}% change over ${dataPoints.length} data points.`,
        trend,
        changePercent: parseFloat(change),
        dataPoints: dataPoints.length,
        confidence: dataPoints.length > 10 ? "high" : "medium",
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Helpers
// ——————————————————————————————————————

function periodToDate(period) {
  const now = Date.now();
  switch (period) {
    case "24h": return new Date(now - 86400000).toISOString();
    case "7d": return new Date(now - 7 * 86400000).toISOString();
    case "30d": return new Date(now - 30 * 86400000).toISOString();
    case "90d": return new Date(now - 90 * 86400000).toISOString();
    case "1y": return new Date(now - 365 * 86400000).toISOString();
    default: return new Date(now - 7 * 86400000).toISOString();
  }
}

function summarizeMetric(dataPoints) {
  if (!dataPoints.length) return { min: 0, max: 0, avg: 0, total: 0 };
  const values = dataPoints.map((d) => d.value);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    total: values.reduce((a, b) => a + b, 0),
  };
}

async function aggregateReportMetrics(config) {
  return {
    generated: true,
    timestamp: new Date().toISOString(),
    config: config || {},
  };
}
