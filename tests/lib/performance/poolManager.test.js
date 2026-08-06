// Pool Manager — Unit Tests
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [{ component: "database", status: "healthy", checked_at: new Date().toISOString() }], error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../../lib/analytics/index.js", () => ({
  recordMetric: vi.fn(() => Promise.resolve()),
}));

const {
  configurePool,
  acquireConnection,
  releaseConnection,
  getPoolStats,
  resetPoolMetrics,
  trackQuery,
  setSlowQueryThreshold,
  trackEndpoint,
  getEndpointMetrics,
  resetEndpointMetrics,
  checkDatabaseHealth,
  persistPoolMetrics,
} = await import("../../../lib/performance/poolManager.js");

describe("Pool Manager", () => {
  beforeEach(() => {
    resetPoolMetrics();
    resetEndpointMetrics();
  });

  describe("Connection Pool", () => {
    it("should configure pool options", () => {
      const result = configurePool({ maxConnections: 50, idleTimeout: 60000 });
      expect(result.success).toBe(true);
      expect(result.data.max).toBe(50);
    });

    it("should acquire and release connections", () => {
      const acquired = acquireConnection();
      expect(acquired.success).toBe(true);
      expect(acquired.data.poolActive).toBe(1);

      const released = releaseConnection();
      expect(released.success).toBe(true);

      const stats = getPoolStats();
      expect(stats.active).toBe(0);
      expect(stats.acquired).toBe(1);
      expect(stats.released).toBe(1);
    });

    it("should track pool exhaustion", () => {
      configurePool({ maxConnections: 1 });
      acquireConnection();
      const result = acquireConnection();
      expect(result.success).toBe(false);
      expect(result.error).toContain("exhausted");
    });

    it("should return pool stats", () => {
      configurePool({ maxConnections: 100 });
      acquireConnection();
      acquireConnection();
      releaseConnection();

      const stats = getPoolStats();
      expect(stats.active).toBe(1);
      expect(stats.acquired).toBe(2);
      expect(stats.max).toBe(100);
    });

    it("should reset pool metrics", () => {
      acquireConnection();
      resetPoolMetrics();
      const stats = getPoolStats();
      expect(stats.active).toBe(0);
      expect(stats.acquired).toBe(0);
    });
  });

  describe("Query Tracking", () => {
    it("should track query duration", async () => {
      const mockQuery = vi.fn().mockResolvedValue({ data: "result" });
      const result = await trackQuery("test-query", mockQuery);
      expect(result.data).toBe("result");
      expect(mockQuery).toHaveBeenCalled();
    });

    it("should propagate query errors", async () => {
      const mockQuery = vi.fn().mockRejectedValue(new Error("query failed"));
      await expect(trackQuery("failing-query", mockQuery)).rejects.toThrow("query failed");
    });

    it("should allow setting slow query threshold", () => {
      setSlowQueryThreshold(100);
      // No direct getter, but shouldn't throw
      setSlowQueryThreshold(500);
    });
  });

  describe("Endpoint Metrics", () => {
    it("should track endpoint calls", () => {
      trackEndpoint("GET", "/api/users", 200, 150);
      trackEndpoint("GET", "/api/users", 200, 200);
      trackEndpoint("POST", "/api/users", 201, 300);

      const metrics = getEndpointMetrics();
      expect(metrics).toHaveLength(2);

      const getUsers = metrics.find((m) => m.method === "GET" && m.path === "/api/users");
      expect(getUsers).toBeDefined();
      expect(getUsers.count).toBe(2);
      expect(getUsers.avgDuration).toBe(175);
      expect(getUsers.maxDuration).toBe(200);
      expect(getUsers.minDuration).toBe(150);
    });

    it("should reset endpoint metrics", () => {
      trackEndpoint("GET", "/test", 200, 100);
      resetEndpointMetrics();
      expect(getEndpointMetrics()).toHaveLength(0);
    });
  });

  describe("Database Health Check", () => {
    it("should check database health", async () => {
      const result = await checkDatabaseHealth();
      expect(result.success).toBe(true);
      expect(result.data.reachable).toBe(true);
      expect(result.data.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.data.connectionPool).toBeDefined();
    });
  });

  describe("Persist Pool Metrics", () => {
    it("should persist metrics to database", async () => {
      const result = await persistPoolMetrics();
      expect(result.success).toBe(true);
    });
  });
});
