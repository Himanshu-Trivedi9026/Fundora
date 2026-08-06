// Observability — barrel exports

export {
  recordMetric,
  recordTiming,
  recordCount,
  recordGauge,
  flushMetrics,
  queryMetrics,
  getMetricSummary,
  getDashboardMetrics,
  stopMetricsCollector,
} from "./metricsEngine.js";

export {
  startTrace,
  startSpan,
  endSpan,
  endTrace,
  addSpanEvent,
  setSpanTag,
  queryTraces,
  getTraceDetail,
} from "./tracingEngine.js";

export {
  performHealthCheck,
  runAllHealthChecks,
  getHealthHistory,
  getHealthSummary,
  getComponents,
  checkDatabaseHealth,
} from "./healthMonitor.js";

export {
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  getAlerts,
  getAlertHistory,
  checkThresholdAlert,
  silenceAlert,
  getAlertStats,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERT_TYPES,
} from "./alertManager.js";

// Phase 12 OpenTelemetry Expansion
export {
  enableTracing,
  disableTracing,
  createTrace,
  createSpan,
  startSpan as otelStartSpan,
  endSpan as otelEndSpan,
  addSpanEvent as otelAddSpanEvent,
  setSpanAttribute,
  getTrace,
  getSpan,
  getActiveSpans,
  exportTrace,
  exportActiveTraces,
  clearTraces,
  structuredLog,
  formatMetricsForExport,
  registerErrorHook,
  runErrorHooks,
} from "./opentelemetry.js";
