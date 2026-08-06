/**
 * Model Router Tests — Unit tests for AI model routing and fallback logic.
 *
 * Covers:
 *   - routeModel: picks first healthy provider, fallback on failure, cost limits
 *   - getRouterConfig: returns config
 *   - updateRouterConfig: merges config
 *   - getProviderHealth: returns metrics
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (before imports) ───

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/ai/providerRegistry.js", () => ({
  getActiveModelProvider: vi.fn().mockReturnValue({
    name: "mock",
    initialized: true,
    healthCheck: vi.fn().mockResolvedValue({ healthy: true, provider: "mock" }),
  }),
  listModelProviders: vi.fn().mockReturnValue({
    success: true,
    data: [
      { name: "mock", initialized: true, isActive: true },
      { name: "openai", initialized: true, isActive: false },
    ],
    error: null,
  }),
  getModelProvider: vi.fn().mockReturnValue({
    success: true,
    data: {
      healthCheck: vi
        .fn()
        .mockResolvedValue({ healthy: true, provider: "openai" }),
    },
    error: null,
  }),
}));

// ─── Imports ───

import {
  routeModel,
  getRouterConfig,
  updateRouterConfig,
  getProviderHealth,
  TASK_TYPES,
} from "../../../lib/ai/modelRouter.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logInfo, logError } from "../../../lib/verification/secureLogger.js";
import {
  getActiveModelProvider,
  listModelProviders,
  getModelProvider,
} from "../../../lib/ai/providerRegistry.js";

// ─── Tests ───

describe("Model Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── routeModel ───

  describe("routeModel", () => {
    it("routes to the first available healthy provider", async () => {
      const result = await routeModel({ taskType: "chat" });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.provider).toBeDefined();
      expect(result.data.model).toBeDefined();
      expect(result.data.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(result.data.reason).toBeDefined();
    });

    it("returns error when taskType is missing", async () => {
      const result = await routeModel({});
      expect(result.success).toBe(false);
      expect(result.error).toContain("taskType is required");
    });

    it("returns error for unknown task type", async () => {
      const result = await routeModel({ taskType: "nonexistent" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown task type");
    });

    it("respects maxCostCents constraint", async () => {
      // Set a very low cost limit that should skip expensive models
      const result = await routeModel({
        taskType: "chat",
        maxCostCents: 0.001,
      });

      // With such a low limit, it should either find a cheap model or use emergency fallback
      expect(result.success).toBe(true);
      expect(result.data.estimatedCost).toBeLessThanOrEqual(0.001);
    });

    it("returns all TASK_TYPES values", () => {
      expect(TASK_TYPES.CHAT).toBe("chat");
      expect(TASK_TYPES.CLASSIFICATION).toBe("classification");
      expect(TASK_TYPES.EMBEDDING).toBe("embedding");
      expect(TASK_TYPES.GENERATION).toBe("generation");
      expect(TASK_TYPES.ANALYSIS).toBe("analysis");
      expect(TASK_TYPES.EXTRACTION).toBe("extraction");
    });
  });

  // ─── getRouterConfig ───

  describe("getRouterConfig", () => {
    it("returns the current router configuration", async () => {
      const result = await getRouterConfig();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.taskRoutes).toBeDefined();
      expect(result.data.fallbackChain).toBeDefined();
      expect(result.data.costLimits).toBeDefined();
      expect(Array.isArray(result.data.fallbackChain)).toBe(true);
    });

    it("includes expected default task routes", async () => {
      const result = await getRouterConfig();

      expect(result.data.taskRoutes).toHaveProperty("chat");
      expect(result.data.taskRoutes).toHaveProperty("embedding");
      expect(result.data.taskRoutes).toHaveProperty("classification");
      expect(result.data.taskRoutes.chat.provider).toBeDefined();
      expect(result.data.taskRoutes.chat.model).toBeDefined();
    });
  });

  // ─── updateRouterConfig ───

  describe("updateRouterConfig", () => {
    it("merges task routes with existing config", async () => {
      const result = await updateRouterConfig({
        taskRoutes: {
          chat: { provider: "anthropic", model: "claude-3-haiku-20240307" },
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.updated).toBe(true);

      // Verify the change persisted
      const config = await getRouterConfig();
      expect(config.data.taskRoutes.chat.provider).toBe("anthropic");
    });

    it("updates fallback chain when provided", async () => {
      const result = await updateRouterConfig({
        fallbackChain: ["anthropic", "openai", "mock"],
      });

      expect(result.success).toBe(true);

      const config = await getRouterConfig();
      expect(config.data.fallbackChain).toEqual([
        "anthropic",
        "openai",
        "mock",
      ]);
    });

    it("returns error when config is not an object", async () => {
      const result = await updateRouterConfig(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });
  });

  // ─── getProviderHealth ───

  describe("getProviderHealth", () => {
    it("returns health status for all providers", async () => {
      const result = await getProviderHealth();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      const first = result.data[0];
      expect(first.provider).toBeDefined();
      expect(["healthy", "unhealthy"]).toContain(first.status);
      expect(typeof first.latencyMs).toBe("number");
      expect(typeof first.errorRate).toBe("number");
    });

    it("returns empty array when no providers registered", async () => {
      listModelProviders.mockReturnValueOnce({
        success: true,
        data: [],
        error: null,
      });

      const result = await getProviderHealth();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });
});
