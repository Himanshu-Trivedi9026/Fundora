// Metrics Engine — production observability for Fundora
// Tracks counters, gauges, histograms, timings across all platform components

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logError } from "../verification/secureLogger.js";

let _metricsBuffer = [];
let _flushInterval = null;
const BUFFER_SIZE = 50;
const FLUSH_INTERVAL_MS = 10000;

export async function recordMetric(
  metricName,
  value,
  metricType = "counter",
  tags = {},
  options = {},
) {
  try {
    const entry = {
      metric_name: metricName,
      value,
      metric_type: metricType,
      tags,
      unit: options.unit || null,
      source: options.source || "fundora",
      organization_id: options.organizationId || null,
      recorded_at: new Date().toISOString(),
    };

    _metricsBuffer.push(entry);

    if (_metricsBuffer.length >= BUFFER_SIZE) {
      await flushMetrics();
    }

    if (!_flushInterval) {
      _flushInterval = setInterval(flushMetrics, FLUSH_INTERVAL_MS);
    }

    return { success: true };
  } catch (err) {
    logError("Failed to record metric", { error: err.message, metricName });
    return { success: false, error: err.message };
  }
}

export async function flushMetrics() {
  if (_metricsBuffer.length === 0) return;

  const batch = _metricsBuffer.splice(0, BUFFER_SIZE);
  try {
    const { error } = await supabaseAdmin.from("metrics").insert(batch);
    if (error) {
      secureLogger.error("Failed to flush metrics", {
        error: error.message,
        count: batch.length,
      });
    }
  } catch (err) {
    secureLogger.error("Metrics flush error", { error: err.message });
  }
}

export async function queryMetrics(metricName, options = {}) {
  try {
    let query = supabaseAdmin
      .from("metrics")
      .select("*")
      .eq("metric_name", metricName)
      .order("recorded_at", { ascending: false });

    if (options.since) query = query.gte("recorded_at", options.since);
    if (options.until) query = query.lte("recorded_at", options.until);
    if (options.source) query = query.eq("source", options.source);

    const limit = Math.min(options.limit || 100, 1000);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getMetricSummary(metricName, options = {}) {
  try {
    const { data, error } = await supabaseAdmin
      .from("metrics")
      .select("value, recorded_at")
      .eq("metric_name", metricName)
      .gte(
        "recorded_at",
        options.since || new Date(Date.now() - 86400000).toISOString(),
      )
      .order("recorded_at", { ascending: true });

    if (error) return { success: false, error: error.message };

    const values = (data || []).map((d) => Number(d.value));
    if (values.length === 0) {
      return {
        success: true,
        data: { count: 0, sum: 0, avg: 0, min: 0, max: 0, last: 0 },
      };
    }

    return {
      success: true,
      data: {
        count: values.length,
        sum: values.reduce((a, b) => a + b, 0),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        last: values[values.length - 1],
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getDashboardMetrics(organizationId, options = {}) {
  try {
    const since =
      options.since || new Date(Date.now() - 7 * 86400000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("metrics")
      .select("metric_name, value, recorded_at, tags")
      .gte("recorded_at", since);

    if (error) return { success: false, error: error.message };

    const grouped = {};
    for (const m of data || []) {
      if (!grouped[m.metric_name]) {
        grouped[m.metric_name] = { values: [], count: 0, sum: 0 };
      }
      grouped[m.metric_name].values.push(m.value);
      grouped[m.metric_name].count++;
      grouped[m.metric_name].sum += Number(m.value);
    }

    const summary = {};
    for (const [name, stats] of Object.entries(grouped)) {
      summary[name] = {
        total: stats.count,
        sum: stats.sum,
        avg: stats.sum / stats.count,
        last: stats.values[stats.values.length - 1],
      };
    }

    return { success: true, data: summary };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function stopMetricsCollector() {
  if (_flushInterval) {
    clearInterval(_flushInterval);
    _flushInterval = null;
  }
  return { success: true };
}

// — Standard metric helpers —

export function recordTiming(name, durationMs, tags = {}) {
  return recordMetric(name, durationMs, "timing", tags, { unit: "ms" });
}

export function recordCount(name, increment = 1, tags = {}) {
  return recordMetric(name, increment, "counter", tags);
}

export function recordGauge(name, value, tags = {}) {
  return recordMetric(name, value, "gauge", tags);
}
