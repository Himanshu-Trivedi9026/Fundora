// Tracing Engine — distributed tracing for Fundora platform
// Supports trace creation, span management, and querying

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logWarn } from "../verification/secureLogger.js";

let _currentTrace = null;
let _currentSpan = null;

export function startTrace(operationName, service = "fundora", tags = {}) {
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const spanId = `span_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  _currentTrace = {
    traceId,
    rootSpanId: spanId,
    service,
    startedAt: new Date(),
    spans: [],
  };

  _currentSpan = {
    traceId,
    spanId,
    parentSpanId: null,
    operationName,
    service,
    tags,
    events: [],
    startedAt: new Date(),
  };

  return { traceId, spanId };
}

export function startSpan(operationName, tags = {}) {
  if (!_currentTrace) {
    return startTrace(operationName, "fundora", tags);
  }

  const spanId = `span_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  _currentSpan = {
    traceId: _currentTrace.traceId,
    spanId,
    parentSpanId: _currentSpan?.spanId || _currentTrace.rootSpanId,
    operationName,
    service: _currentTrace.service,
    tags,
    events: [],
    startedAt: new Date(),
  };

  return { traceId: _currentTrace.traceId, spanId };
}

export function addSpanEvent(name, data = {}) {
  if (!_currentSpan) return;
  _currentSpan.events.push({
    name,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function setSpanTag(key, value) {
  if (!_currentSpan) return;
  _currentSpan.tags[key] = value;
}

export async function endSpan(status = "ok") {
  if (!_currentSpan) return null;

  const endedAt = new Date();
  const durationMs = endedAt - _currentSpan.startedAt;

  const span = {
    trace_id: _currentSpan.traceId,
    span_id: _currentSpan.spanId,
    parent_span_id: _currentSpan.parentSpanId,
    operation_name: _currentSpan.operationName,
    service: _currentSpan.service,
    duration_ms: durationMs,
    status,
    tags: _currentSpan.tags,
    events: _currentSpan.events,
    started_at: _currentSpan.startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabaseAdmin.from("traces").insert(span);
    if (error) {
      logWarn("Failed to store trace span", {
        error: error.message,
        spanId: _currentSpan.spanId,
      });
    }
  } catch (err) {
    logWarn("Trace storage error", { error: err.message });
  }

  return span;
}

export async function endTrace(status = "ok") {
  if (!_currentTrace) return null;
  await endSpan(status);
  const result = { ..._currentTrace, endedAt: new Date() };
  _currentTrace = null;
  _currentSpan = null;
  return result;
}

export async function queryTraces(options = {}) {
  try {
    let query = supabaseAdmin
      .from("traces")
      .select("*")
      .order("started_at", { ascending: false });

    if (options.operationName)
      query = query.eq("operation_name", options.operationName);
    if (options.service) query = query.eq("service", options.service);
    if (options.status) query = query.eq("status", options.status);
    if (options.since) query = query.gte("started_at", options.since);
    if (options.userId) query = query.eq("user_id", options.userId);
    if (options.traceId) query = query.eq("trace_id", options.traceId);

    const limit = Math.min(options.limit || 50, 500);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getTraceDetail(traceId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("traces")
      .select("*")
      .eq("trace_id", traceId)
      .order("started_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
