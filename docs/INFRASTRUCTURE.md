# Fundora Infrastructure Guide

## Architecture Overview

Fundora's infrastructure layer provides production-grade observability, caching, job processing, secrets management, performance optimization, and disaster recovery.

```
┌─────────────────────────────────────────────────────┐
│                    Application Layer                 │
├─────────────────────────────────────────────────────┤
│  lib/observability/  │  lib/cache/  │  lib/jobs/    │
├─────────────────────────────────────────────────────┤
│  lib/secrets/  │  lib/performance/  │  lib/recovery/ │
├─────────────────────────────────────────────────────┤
│         Supabase (DB + Auth)  │  Redis              │
└─────────────────────────────────────────────────────┘
```

## Observability (`lib/observability/`)

### Components

| Module | File | Description |
|--------|------|-------------|
| Metrics Engine | `metricsEngine.js` | Metric recording, querying, dashboards |
| Tracing Engine | `tracingEngine.js` | Distributed trace spans |
| Health Monitor | `healthMonitor.js` | Component health checks |
| Alert Manager | `alertManager.js` | Alert creation, thresholds, routing |
| OpenTelemetry | `opentelemetry.js` | OpenTelemetry tracing, structured logging, metrics export |

### OpenTelemetry Integration

```javascript
import { enableTracing, startSpan, endSpan, structuredLog } from "../lib/observability/index.js";

// Enable tracing
enableTracing();

// Create a trace span
const span = startSpan("process-payment", {
  attributes: { amount: 100, currency: "USD" }
});

// Add events
addSpanEvent(span.spanId, "payment.authorized", { provider: "stripe" });

// Structured logging
structuredLog("info", "Payment processed", {
  amount: 100,
  traceId: span.traceId,
});

// End span
endSpan(span.spanId);
```

### Error Aggregation Hooks

```javascript
import { registerErrorHook, runErrorHooks } from "../lib/observability/index.js";

// Register a hook
const unregister = registerErrorHook(async (error, context) => {
  await notifySlack(error, context);
});

// Run hooks on error
await runErrorHooks(new Error("Payment failed"), { amount: 100 });

// Unregister when done
unregister();
```

### Metrics Export Formats

Supported formats: `prometheus`, `json`, `datadog`

```javascript
import { formatMetricsForExport } from "../lib/observability/index.js";

const prometheusOutput = formatMetricsForExport(metrics, "prometheus");
// Content-Type: text/plain
```

## Cache Platform (`lib/cache/`)

### Backends

| Backend | Storage | Use Case |
|---------|---------|----------|
| `memory` | In-process Map | Development, single-instance |
| `redis` | Redis | Production, distributed |
| `database` | Supabase | Persistent cache with TTL |

### Usage

```javascript
import { get, set, getOrSet, acquireLock, checkRateLimit } from "../lib/cache/index.js";

// Basic caching
await set("user:123", profileData, { ttl: 300 }); // 5 min TTL
const profile = await get("user:123");

// Cache-aside pattern
const data = await getOrSet("expensive:query", async () => {
  return await fetchExpensiveData();
}, { ttl: 60 });

// Distributed locking
const lock = await acquireLock("payment:order-456", { ttl: 30000 });
if (lock.success) {
  try {
    // Critical section
  } finally {
    await releaseLock("payment:order-456");
  }
}

// Rate limiting
const rateCheck = await checkRateLimit("api:user-789", { maxRequests: 100, windowMs: 60000 });
if (!rateCheck.success) {
  throw new Error("Rate limit exceeded");
}
```

## Job Platform (`lib/jobs/`)

### Queue Management

```javascript
import { enqueue, registerHandler, processQueue } from "../lib/jobs/index.js";

// Register a handler
registerHandler("email.send", async (payload) => {
  await sendEmail(payload.to, payload.subject, payload.body);
});

// Enqueue a job
await enqueue("email.send", {
  to: "user@example.com",
  subject: "Welcome!",
  body: "Thanks for joining",
}, { priority: "high", maxRetries: 5 });

// Process the queue
await processQueue("default", { batchSize: 10 });
```

### Retry Engine

- Exponential backoff: `2^n × 1s` (capped at 30s)
- Max retries configurable per job (default: 3)
- Dead letter queue after max retries exhausted

### Scheduled Jobs

```javascript
import { createSchedule, processScheduledJobs } from "../lib/jobs/index.js";

await createSchedule({
  name: "Daily cleanup",
  jobType: "cleanup.expired",
  scheduleCron: "0 0 * * *", // daily at midnight
  maxRuns: null, // unlimited
});
```

## Secrets Management (`lib/secrets/`)

### Providers

| Provider | Storage | Use Case |
|----------|---------|----------|
| `env` | Environment variables | Development, CI/CD |
| `database` | Supabase `secrets` table | Production |
| `vault` | External vault (HashiCorp, AWS) | Enterprise |

### Usage

```javascript
import { getSecret, rotateSecret, generateSecurityAudit } from "../lib/secrets/index.js";

// Get a secret
const apiKey = await getSecret("STRIPE_API_KEY", { provider: "database" });

// Rotate a secret
await rotateSecret("STRIPE_API_KEY", generateNewKey, {
  createdBy: "admin",
});

// Security audit
const audit = await generateSecurityAudit({ daysBeforeExpiry: 7 });
if (audit.data.summary.critical > 0) {
  // Take action
}
```

## Performance (`lib/performance/`)

### Connection Pool Management

```javascript
import { configurePool, acquireConnection, releaseConnection } from "../lib/performance/index.js";

// Configure pool
configurePool({ maxConnections: 50, idleTimeout: 30000 });

// Acquire/release
const conn = acquireConnection();
// ... use connection ...
releaseConnection();
```

### Query & Endpoint Tracking

```javascript
import { trackQuery, trackEndpoint } from "../lib/performance/index.js";

// Track a database query
await trackQuery("getUsers", async () => {
  return await db.query("SELECT * FROM users");
});

// Track an API endpoint
trackEndpoint("GET", "/api/users", 200, durationMs);
```

### Health Check

```javascript
import { checkDatabaseHealth } from "../lib/performance/index.js";

const health = await checkDatabaseHealth();
// { reachable: true, responseTime: 42, connectionPool: { active: 3, max: 100, ... } }
```

## Disaster Recovery (`lib/recovery/`)

### Backup Verification

```javascript
import { verifyBackup, verifyAllBackups } from "../lib/recovery/index.js";

// Verify a specific backup
const result = await verifyBackup("backup-id");
if (result.data.checksumValid) {
  // Backup is intact
}

// Verify all backups
const summary = await verifyAllBackups();
// { total: 10, healthy: 8, corrupt: 2 }
```

### Recovery Plans

```javascript
import { createRecoveryPlan, initiateFailover } from "../lib/recovery/index.js";

createRecoveryPlan("my-plan", {
  description: "Custom recovery plan",
  priority: "high",
  rto: "5 minutes",
  rpo: "1 minute",
  playbook: ["Step 1", "Step 2"],
});

// Initiate failover
await initiateFailover({ plan: "my-plan", reason: "Region outage" });
```

### Runbooks

```javascript
import { createRunbook, executeRunbook } from "../lib/recovery/index.js";

createRunbook("incident-response", [
  { action: "Assess impact", critical: true },
  { action: "Notify on-call", critical: true },
  { action: "Scale up replicas", critical: false },
]);

// Execute runbook
const result = await executeRunbook("incident-response");
// { succeeded: 3, failed: 0 }
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (liveness/readiness) |
| `/api/health/database` | GET | Database-specific health |
| `/api/metrics` | GET | Prometheus metrics |
| `/api/diagnostics` | GET | System diagnostics |
| `/api/infrastructure/health` | GET | Infrastructure health dashboard data |
| `/api/infrastructure/cache` | GET/POST | Cache stats and management |
| `/api/infrastructure/queues` | GET | Queue infrastructure status |
| `/api/jobs` | GET/POST | Job queue listing and enqueue |
| `/api/jobs/process` | POST | Process queues and scheduled jobs |
| `/api/jobs/schedule` | GET/POST/PUT/DELETE | Scheduled job management |
| `/api/deployments` | GET/POST | Deployment history and creation |
| `/api/deployments/rollback` | POST | Rollback a deployment |
