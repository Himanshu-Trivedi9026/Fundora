// OpenTelemetry Integration — Unit Tests
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logDebug: vi.fn(),
}));

import {
  enableTracing,
  disableTracing,
  createTrace,
  startSpan,
  endSpan,
  addSpanEvent,
  setSpanAttribute,
  getTrace,
  getSpan,
  getActiveSpans,
  exportTrace,
  exportActiveTraces,
  clearTraces,
  structuredLog,
  registerErrorHook,
  runErrorHooks,
} from "../../../lib/observability/opentelemetry.js";

describe("OpenTelemetry Integration", () => {
  beforeEach(() => {
    clearTraces();
    disableTracing();
  });

  describe("Trace Management", () => {
    it("should create a trace with root span", () => {
      const traceId = createTrace({ name: "test-trace", service: "test-svc" });
      expect(traceId).toBeDefined();
      expect(traceId.startsWith("trace_")).toBe(true);

      const trace = getTrace(traceId);
      expect(trace).toBeDefined();
      expect(trace.name).toBe("test-trace");
      expect(trace.service).toBe("test-svc");
      expect(trace.spans.length).toBe(1);
    });

    it("should start and end spans", () => {
      enableTracing();
      const span = startSpan("test-span");
      expect(span).toBeDefined();
      expect(span.spanId).toBeDefined();
      expect(span.traceId).toBeDefined();
      expect(span.noop).toBeUndefined();

      endSpan(span.spanId);
      const endedSpan = getSpan(span.spanId);
      expect(endedSpan.status).toBe("completed");
      expect(endedSpan.duration).toBeGreaterThanOrEqual(0);
    });

    it("should return noop span when tracing disabled", () => {
      const span = startSpan("noop-test");
      expect(span.noop).toBe(true);
    });

    it("should add events to spans", () => {
      enableTracing();
      const span = startSpan("event-span");
      addSpanEvent(span.spanId, "test-event", { key: "value" });

      const stored = getSpan(span.spanId);
      expect(stored.events).toHaveLength(1);
      expect(stored.events[0].name).toBe("test-event");
      expect(stored.events[0].attributes.key).toBe("value");
    });

    it("should set span attributes", () => {
      enableTracing();
      const span = startSpan("attr-span");
      setSpanAttribute(span.spanId, "color", "blue");

      const stored = getSpan(span.spanId);
      expect(stored.attributes.color).toBe("blue");
    });

    it("should export a trace", () => {
      enableTracing();
      const traceId = createTrace({ name: "export-me" });
      const exported = exportTrace(traceId);
      expect(exported).toBeDefined();
      expect(exported.traceId).toBe(traceId);
      expect(exported.name).toBe("export-me");
      expect(exported.spanCount).toBe(1);
    });

    it("should return active spans", () => {
      enableTracing();
      const span1 = startSpan("active-1");
      const span2 = startSpan("active-2");
      endSpan(span1.spanId);

      const active = getActiveSpans();
      // Each startSpan creates a trace (with root span) + the named span
      // The ended span1 and its root span are filtered out, but span2 + its root remain
      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(active.some((s) => s.name === "active-2")).toBe(true);
    });

    it("should export all active traces", () => {
      enableTracing();
      createTrace({ name: "trace-1" });
      createTrace({ name: "trace-2" });

      const traces = exportActiveTraces();
      expect(traces).toHaveLength(2);
    });
  });

  describe("Structured Logging", () => {
    it("should produce a structured log entry", () => {
      const entry = structuredLog("info", "test message", { userId: "123" });
      expect(entry).toBeDefined();
      expect(entry.level).toBe("info");
      expect(entry.message).toBe("test message");
      expect(entry.userId).toBe("123");
      expect(entry.service).toBe("fundora");
      expect(entry.timestamp).toBeDefined();
    });

    it("should handle error level", () => {
      const entry = structuredLog("error", "something broke", {
        stack: "Error...",
      });
      expect(entry.level).toBe("error");
    });
  });

  describe("Error Aggregation Hooks", () => {
    it("should register and run error hooks", async () => {
      const hook = vi.fn().mockResolvedValue("handled");
      const unregister = registerErrorHook(hook);

      const results = await runErrorHooks(new Error("test error"), {
        source: "unit-test",
      });
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("handled");
      expect(hook).toHaveBeenCalledWith(expect.any(Error), {
        source: "unit-test",
      });

      unregister();
      const afterUnregister = await runErrorHooks(new Error("after"));
      expect(afterUnregister).toHaveLength(0);
    });

    it("should handle hook failures gracefully", async () => {
      registerErrorHook(() => {
        throw new Error("hook-error");
      });
      registerErrorHook(() => Promise.resolve("ok"));

      const results = await runErrorHooks(new Error("original"));
      // Failed hooks are caught and logged but don't push to results
      expect(results).toHaveLength(1);
      expect(results[0]).toBe("ok");
    });
  });

  describe("Metrics Export", () => {
    it("should create a trace with custom attributes", () => {
      const traceId = createTrace({
        name: "http-request",
        attributes: { method: "GET", path: "/api/users" },
        sampled: true,
      });

      const trace = getTrace(traceId);
      expect(trace.attributes.method).toBe("GET");
      expect(trace.sampled).toBe(true);
    });
  });
});
