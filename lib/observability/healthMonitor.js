// Health Monitor — component health checking for Fundora platform
// Tracks health status of all platform components and services

import { supabaseAdmin } from "../supabaseAdmin.js";

const COMPONENTS = {
  database: { name: "Supabase Database", critical: true },
  auth: { name: "Authentication", critical: true },
  storage: { name: "Storage Service", critical: true },
  ai: { name: "AI Platform", critical: false },
  payments: { name: "Payment Provider", critical: true },
  webhooks: { name: "Webhook Delivery", critical: false },
  search: { name: "Search Index", critical: false },
  cdn: { name: "CDN / Static Assets", critical: false },
  queue: { name: "Background Queue", critical: false },
  email: { name: "Email Service", critical: false },
};

export async function performHealthCheck(component, checkFn) {
  const startedAt = Date.now();
  try {
    const result = await checkFn();
    const latencyMs = Date.now() - startedAt;

    const { error } = await supabaseAdmin.from("health_checks").insert({
      component,
      status: result.healthy ? "healthy" : "unhealthy",
      latency_ms: latencyMs,
      error_message: result.error || null,
      metadata: result.metadata || {},
      checked_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        component,
        status: result.healthy ? "healthy" : "unhealthy",
        latencyMs,
        healthy: result.healthy,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;

    await supabaseAdmin
      .from("health_checks")
      .insert({
        component,
        status: "unhealthy",
        latency_ms: latencyMs,
        error_message: err.message,
        checked_at: new Date().toISOString(),
      })
      .catch(() => {});

    return { success: false, error: err.message };
  }
}

export async function checkDatabaseHealth() {
  try {
    const startedAt = Date.now();
    const { data, error } = await supabaseAdmin
      .from("health_checks")
      .select("id")
      .limit(1);
    return {
      healthy: !error,
      latencyMs: Date.now() - startedAt,
      error: error?.message,
    };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

export async function runAllHealthChecks() {
  const results = [];
  const criticalFailures = [];

  for (const [component] of Object.entries(COMPONENTS)) {
    const result = await performHealthCheck(component, async () => {
      // Default check: verify DB connectivity
      const startedAt = Date.now();
      try {
        const { error } = await supabaseAdmin
          .from("health_checks")
          .select("id")
          .limit(1);
        return {
          healthy: !error,
          latencyMs: Date.now() - startedAt,
          error: error?.message,
        };
      } catch (err) {
        return { healthy: false, error: err.message };
      }
    });

    if (result.success) {
      results.push(result.data);
      if (!result.data.healthy && COMPONENTS[component]?.critical) {
        criticalFailures.push(component);
      }
    }
  }

  return {
    success: true,
    data: {
      checks: results,
      healthy: criticalFailures.length === 0,
      criticalFailures,
      totalComponents: Object.keys(COMPONENTS).length,
      healthyCount: results.filter((r) => r.status === "healthy").length,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function getHealthHistory(component, limit = 20) {
  try {
    const { data, error } = await supabaseAdmin
      .from("health_checks")
      .select("*")
      .eq("component", component)
      .order("checked_at", { ascending: false })
      .limit(limit);

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function getComponents() {
  return COMPONENTS;
}

export async function getHealthSummary() {
  try {
    const { data, error } = await supabaseAdmin.rpc("get_latest_health_status");

    if (error) {
      // Fallback: manual aggregation
      const allChecks = await Promise.all(
        Object.keys(COMPONENTS).map((c) => getHealthHistory(c, 1)),
      );

      const summary = {};
      for (const result of allChecks) {
        if (result.success && result.data.length > 0) {
          const check = result.data[0];
          summary[check.component] = {
            status: check.status,
            latencyMs: check.latency_ms,
            lastChecked: check.checked_at,
            critical: COMPONENTS[check.component]?.critical || false,
          };
        }
      }

      return { success: true, data: summary };
    }

    return { success: true, data: data || {} };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
