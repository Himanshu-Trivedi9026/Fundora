# Observability System

Production monitoring infrastructure for the Fundora platform.

## Architecture

```
lib/observability/
├── index.js              # Barrel exports
├── metricsEngine.js      # Counter, gauge, timing metrics
├── tracingEngine.js      # Distributed tracing
├── healthMonitor.js      # Component health checks
└── alertManager.js       # Alerting and notification
```

## Metrics Engine

- **Counter**: Incremental counters (e.g., API requests)
- **Gauge**: Point-in-time values (e.g., active users)
- **Timing**: Duration measurements (e.g., response times)
- **Buffered Flush**: Batched writes every 50 metrics or 10 seconds
- **Summary**: Computes count, sum, avg, min, max, last
- **Dashboard**: Groups metrics by name for overview

## Tracing Engine

- **Trace**: Root operation with unique trace ID
- **Span**: Individual operation within trace
- **Parent References**: Span nesting for distributed tracing
- **Events**: Named events within spans
- **Tags**: Key-value metadata per span
- **Duration**: Automatic span duration calculation

## Health Monitor

Monitors 10 components: database, auth, storage, AI, payments, webhooks, search, CDN, queue, email. Critical components: database, auth, storage, payments.

## Alert Manager

- **Severities**: debug, info, warning, critical
- **Statuses**: active, acknowledged, resolved, silenced
- **Types**: threshold, anomaly, heartbeat, custom
- **Threshold Alerts**: Auto-fire when metric exceeds threshold

## API Routes

- `GET/POST /api/observability/metrics` — Query/record metrics
- `GET /api/observability/health` — Health check status
- `GET/POST/PUT /api/observability/alerts` — Alert management
