# Fundora Observability v2

## Overview

Phase 12 extends the Phase 10 observability engine with OpenTelemetry integration, distributed tracing, structured logging, metrics export, and error aggregation hooks.

## Components

### OpenTelemetry Integration (`lib/observability/opentelemetry.js`)

Provides distributed tracing with span management:

```javascript
import { enableTracing, createTrace, startSpan, endSpan, exportTrace } from "../lib/observability/index.js";

// Enable distributed tracing
enableTracing();

// Create a trace
const traceId = createTrace({
  name: "process-payment",
  service: "fundora-payments",
  attributes: { amount: 50.00, currency: "USD" },
});

// Start spans (returns auto-created trace if none provided)
const span = startSpan("charge-card", {
  parentSpanId: null,
  attributes: { cardType: "visa" },
});

// Auto-end span
span.end();

// Export trace for analysis
const exported = exportTrace(traceId);
```

### Span Events & Attributes

```javascript
import { addSpanEvent, setSpanAttribute } from "../lib/observability/index.js";

addSpanEvent(spanId, "external-call", {
  service: "stripe",
  duration: 234,
});
setSpanAttribute(spanId, "error", false);
```

### Structured Logging

```javascript
import { structuredLog } from "../lib/observability/index.js";

// Automatically attaches trace/span context
const entry = structuredLog("info", "Payment authorized", {
  amount: 50,
  currency: "USD",
  traceId: "trace_...",
});
// { level: "info", message: "Payment authorized", amount: 50, ... }
```

### Metrics Export

Supports three formats:

```javascript
import { formatMetricsForExport } from "../lib/observability/index.js";

const metrics = [
  { name: "http_requests_total", help: "Total HTTP requests", type: "counter", value: 1500, labels: { method: "GET" } },
];

// Prometheus format (default)
console.log(formatMetricsForExport(metrics, "prometheus"));
// # HELP http_requests_total Total HTTP requests
// # TYPE http_requests_total counter
// http_requests_total{method="GET"} 1500

// JSON format
console.log(formatMetricsForExport(metrics, "json"));

// Datadog format
console.log(formatMetricsForExport(metrics, "datadog"));
// http_requests_total:1500|counter|#method:GET
```

### Error Aggregation Hooks

```javascript
import { registerErrorHook, runErrorHooks } from "../lib/observability/index.js";

// Register notification hooks
const unregisterSlack = registerErrorHook(async (error, context) => {
  await postToSlack(`Error: ${error.message}`, context);
});

const unregisterPagerDuty = registerErrorHook(async (error, context) => {
  await triggerPagerDutyAlert(error, context);
});

// On error
try {
  await riskyOperation();
} catch (err) {
  await runErrorHooks(err, { source: "payment-service" });
}

// Cleanup when no longer needed
unregisterSlack();
```

## Connect to External Tools

### Prometheus

Configure Prometheus to scrape `/api/metrics`:

```yaml
scrape_configs:
  - job_name: "fundora"
    metrics_path: "/api/metrics"
    static_configs:
      - targets: ["fundora-app:3000"]
```

### Grafana

Use the Prometheus data source to visualize:
- Connection pool metrics (`fundora_db_pool_*`)
- Cache metrics (`fundora_cache_*`)
- Endpoint metrics (`fundora_endpoint_*`)
- Memory metrics (`fundora_memory_*`)

### Datadog

Configure the agent to scrape the JSON-formatted metrics endpoint:

```yaml
# datadog.yaml
instances:
  - url: http://fundora-app:3000/api/metrics?format=datadog
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Application health (liveness/readiness) |
| `GET /api/health/database` | Database connectivity health |
| `GET /api/metrics` | Metrics in prometheus/json/datadog format |
| `GET /api/diagnostics` | System health diagnostics |

## Instrumentation Points

Key areas to add tracing in application code:

1. **API Handlers**: Wrap every request handler with a span
2. **Database Queries**: Wrap `supabaseAdmin` calls
3. **External HTTP Calls**: Wrap fetch/axios calls
4. **Job Processing**: Wrap job execution
5. **Authentication**: Wrap auth verification

```javascript
// Example: Instrument an API handler
import { startSpan, endSpan, addSpanEvent } from "../lib/observability/index.js";

export default async function handler(req, res) {
  const span = startSpan(`${req.method} ${req.url}`, {
    attributes: { method: req.method, path: req.url },
  });

  try {
    // ... handler logic ...
    addSpanEvent(span.spanId, "handler.completed", { statusCode: res.statusCode });
  } catch (err) {
    addSpanEvent(span.spanId, "handler.error", { message: err.message });
    throw err;
  } finally {
    endSpan(span.spanId);
  }
}
```
