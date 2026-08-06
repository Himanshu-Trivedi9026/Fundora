// OpenTelemetry Integration — distributed tracing and metrics export
// Extends the Phase 10 observability engine with OpenTelemetry support

import {
  logInfo,
  logWarn,
  logError,
  logDebug,
} from "../verification/secureLogger.js";

const _spans = new Map();
const _traceContext = new Map();
let _tracingEnabled = false;
let _spanIdCounter = 0;

// ——————————————————————————————————————
// Trace Management
// ——————————————————————————————————————

export function enableTracing() {
  _tracingEnabled = true;
}

export function disableTracing() {
  _tracingEnabled = false;
}

export function createTrace(options = {}) {
  const traceId = generateId("trace");
  const rootSpanId = generateId("span");

  const trace = {
    traceId,
    name: options.name || "unknown",
    service: options.service || "fundora",
    spans: [],
    startTime: Date.now(),
    attributes: options.attributes || {},
    sampled: options.sampled !== undefined ? options.sampled : true,
  };

  const rootSpan = {
    spanId: rootSpanId,
    traceId,
    parentSpanId: null,
    name: options.name || "root",
    status: "active",
    startTime: Date.now(),
    endTime: null,
    attributes: options.attributes || {},
    events: [],
  };
  trace.spans.push(rootSpan);
  _spans.set(rootSpanId, rootSpan);
  _traceContext.set(traceId, { trace, rootSpan });
  return traceId;
}

export function createSpan(traceId, spanId, options = {}) {
  if (!traceId) {
    traceId = createTrace({ name: options.name }).traceId;
  }

  const span = {
    spanId: spanId || generateId("span"),
    traceId,
    parentSpanId: options.parentSpanId || null,
    name: options.name || "span",
    status: "active",
    startTime: Date.now(),
    endTime: null,
    attributes: options.attributes || {},
    events: [],
  };

  const context = _traceContext.get(traceId);
  if (context) {
    context.trace.spans.push(span);
    _spans.set(span.spanId, span);
  }

  return span;
}

export function startSpan(name, options = {}) {
  if (!_tracingEnabled) return { noop: true };
  const traceId = options.traceId || createTrace({ name });
  const spanId = generateId("span");

  const span = createSpan(traceId, spanId, {
    name,
    parentSpanId: options.parentSpanId || null,
    attributes: options.attributes || {},
  });

  return { spanId, traceId, end: () => endSpan(spanId) };
}

export function endSpan(spanId) {
  const span = _spans.get(spanId);
  if (!span) return;
  span.status = "completed";
  span.endTime = Date.now();
  span.duration = span.endTime - span.startTime;
}

export function addSpanEvent(spanId, name, attributes = {}) {
  const span = _spans.get(spanId);
  if (!span) return;
  span.events.push({ name, timestamp: Date.now(), attributes });
}

export function setSpanAttribute(spanId, key, value) {
  const span = _spans.get(spanId);
  if (!span) return;
  span.attributes[key] = value;
}

export function getTrace(traceId) {
  const context = _traceContext.get(traceId);
  return context?.trace || null;
}

export function getSpan(spanId) {
  return _spans.get(spanId) || null;
}

export function getActiveSpans() {
  return Array.from(_spans.values()).filter((s) => s.status === "active");
}

export function exportTrace(traceId) {
  const context = _traceContext.get(traceId);
  if (!context) return null;

  const trace = context.trace;
  const duration = Date.now() - trace.startTime;

  return {
    traceId: trace.traceId,
    name: trace.name,
    service: trace.service,
    duration,
    sampled: trace.sampled,
    spanCount: trace.spans.length,
    attributes: trace.attributes,
    spans: trace.spans.map((s) => ({
      spanId: s.spanId,
      parentSpanId: s.parentSpanId,
      name: s.name,
      status: s.status,
      duration: s.endTime ? s.endTime - s.startTime : Date.now() - s.startTime,
      attributes: s.attributes,
      events: s.events,
    })),
  };
}

export function exportActiveTraces() {
  return Array.from(_traceContext.keys())
    .map((id) => exportTrace(id))
    .filter(Boolean);
}

export function clearTraces() {
  _spans.clear();
  _traceContext.clear();
}

// ——————————————————————————————————————
// Structured Logging
// ——————————————————————————————————————

export function structuredLog(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: meta.service || "fundora",
    traceId: meta.traceId || null,
    spanId: meta.spanId || null,
    ...meta,
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      logError(message, meta);
      break;
    case "warn":
      logWarn(message, meta);
      break;
    case "info":
      logInfo(message, meta);
      break;
    case "debug":
      logDebug(message, meta);
      break;
    default:
      logInfo(message, meta);
  }

  return entry;
}

// ——————————————————————————————————————
// Metrics Export
// ——————————————————————————————————————

export function formatMetricsForExport(metrics, format = "prometheus") {
  switch (format) {
    case "prometheus":
      return metrics
        .map((m) => {
          const labels = Object.entries(m.labels || {})
            .map(([k, v]) => `${k}="${v}"`)
            .join(",");
          const labelStr = labels ? `{${labels}}` : "";
          return `# HELP ${m.name} ${m.help || ""}\n# TYPE ${m.name} ${m.type || "gauge"}\n${m.name}${labelStr} ${m.value}`;
        })
        .join("\n");

    case "json":
      return JSON.stringify(metrics, null, 2);

    case "datadog":
      return metrics
        .map((m) => {
          const tags = Object.entries(m.labels || {})
            .map(([k, v]) => `${k}:${v}`)
            .join(",");
          return `${m.name}:${m.value}|${m.type || "gauge"}|#${tags}`;
        })
        .join("\n");

    default:
      return JSON.stringify(metrics);
  }
}

// ——————————————————————————————————————
// Error Aggregation Hook
// ——————————————————————————————————————

const _errorHooks = [];

export function registerErrorHook(hook) {
  _errorHooks.push(hook);
  return () => {
    const idx = _errorHooks.indexOf(hook);
    if (idx >= 0) _errorHooks.splice(idx, 1);
  };
}

export async function runErrorHooks(error, context = {}) {
  const results = [];
  for (const hook of _errorHooks) {
    try {
      results.push(await hook(error, context));
    } catch (err) {
      logError("Error hook failed", {
        original: error.message,
        hookError: err.message,
      });
    }
  }
  return results;
}

// ——————————————————————————————————————
// Helpers
// ——————————————————————————————————————

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
