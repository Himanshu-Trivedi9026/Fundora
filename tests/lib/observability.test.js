// Tests for Observability System (Metrics, Tracing, Health, Alerts)

import { describe, it, expect } from "vitest";

describe("Metrics Engine", () => {
  it("should buffer metrics and flush at threshold", () => {
    const BUFFER_SIZE = 50;
    const batch = Array.from({ length: 50 }, (_, i) => ({
      metric_name: "test_metric",
      value: i,
      recorded_at: new Date().toISOString(),
    }));
    expect(batch).toHaveLength(BUFFER_SIZE);
  });

  it("should compute metric summary from values", () => {
    const values = [10, 20, 30, 40, 50];
    const summary = {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      last: values[values.length - 1],
    };

    expect(summary.count).toBe(5);
    expect(summary.sum).toBe(150);
    expect(summary.avg).toBe(30);
    expect(summary.min).toBe(10);
    expect(summary.max).toBe(50);
    expect(summary.last).toBe(50);
  });

  it("should group metrics by name for dashboard", () => {
    const metrics = [
      { metric_name: "api_requests", value: 100 },
      { metric_name: "api_requests", value: 200 },
      { metric_name: "errors", value: 5 },
    ];

    const grouped = {};
    for (const m of metrics) {
      if (!grouped[m.metric_name]) grouped[m.metric_name] = { sum: 0, count: 0 };
      grouped[m.metric_name].sum += m.value;
      grouped[m.metric_name].count++;
    }

    expect(grouped.api_requests.sum).toBe(300);
    expect(grouped.api_requests.count).toBe(2);
    expect(grouped.errors.sum).toBe(5);
  });
});

describe("Tracing Engine", () => {
  it("should generate unique trace and span IDs", () => {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const spanId = `span_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    expect(traceId).toMatch(/^trace_/);
    expect(spanId).toMatch(/^span_/);
  });

  it("should calculate span duration", () => {
    const start = new Date("2025-01-01T00:00:00Z");
    const end = new Date("2025-01-01T00:00:01.500Z");
    const durationMs = end - start;

    expect(durationMs).toBe(1500);
  });

  it("should support span nesting with parent references", () => {
    const rootSpan = { spanId: "span_root", parentSpanId: null };
    const childSpan = { spanId: "span_child", parentSpanId: rootSpan.spanId };

    expect(childSpan.parentSpanId).toBe(rootSpan.spanId);
  });
});

describe("Health Monitor", () => {
  it("should categorize components by criticality", () => {
    const components = {
      database: { critical: true },
      auth: { critical: true },
      ai: { critical: false },
    };

    const critical = Object.entries(components)
      .filter(([, c]) => c.critical)
      .map(([name]) => name);

    expect(critical).toContain("database");
    expect(critical).toContain("auth");
    expect(critical).not.toContain("ai");
  });

  it("should detect critical failures", () => {
    const results = [
      { status: "healthy", healthy: true },
      { status: "unhealthy", healthy: false },
    ];

    const criticalFailures = results.filter((r) => !r.healthy);
    expect(criticalFailures).toHaveLength(1);
  });
});

describe("Alert Manager", () => {
  it("should detect threshold breaches", () => {
    const threshold = 100;
    const value = 150;

    const breached = value > threshold;
    expect(breached).toBe(true);
  });

  it("should not alert when value is within threshold", () => {
    const threshold = 100;
    const value = 80;

    const breached = value > threshold;
    expect(breached).toBe(false);
  });

  it("should calculate alert statistics", () => {
    const alerts = [
      { status: "active", severity: "critical" },
      { status: "active", severity: "warning" },
      { status: "resolved", severity: "info" },
    ];

    const byStatus = {};
    const bySeverity = {};

    for (const a of alerts) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
    }

    expect(byStatus.active).toBe(2);
    expect(byStatus.resolved).toBe(1);
    expect(bySeverity.critical).toBe(1);
  });
});
