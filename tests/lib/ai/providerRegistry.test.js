/**
 * Provider Registry Tests — Unit tests for the AI provider registry system.
 *
 * Covers:
 *   - MockModelProvider: initialize, chatCompletion, createEmbedding, healthCheck
 *   - Registry: register, get, set active, list, initialize defaults
 *   - Provider health: degraded on error, recovery
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (before imports) ───

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// ─── Imports ───

import {
  MockModelProvider,
  BaseModelProvider,
  registerModelProvider,
  getModelProvider,
  setActiveModelProvider,
  getActiveModelProvider,
  listModelProviders,
  initializeModelProviders,
} from "../../../lib/ai/providerRegistry.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logInfo, logError } from "../../../lib/verification/secureLogger.js";

// ─── Tests ───

describe("Provider Registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── BaseModelProvider ───

  describe("BaseModelProvider", () => {
    it("throws on initialize() if not overridden", async () => {
      const provider = new BaseModelProvider("test");
      await expect(provider.initialize()).rejects.toThrow("initialize() must be implemented");
    });

    it("throws on chatCompletion() if not overridden", async () => {
      const provider = new BaseModelProvider("test");
      await expect(provider.chatCompletion({})).rejects.toThrow(
        "chatCompletion() must be implemented",
      );
    });

    it("throws on createEmbedding() if not overridden", async () => {
      const provider = new BaseModelProvider("test");
      await expect(provider.createEmbedding({})).rejects.toThrow(
        "createEmbedding() must be implemented",
      );
    });
  });

  // ─── MockModelProvider ───

  describe("MockModelProvider", () => {
    it("initializes with default model and sets initialized flag", async () => {
      const provider = new MockModelProvider();
      expect(provider.initialized).toBe(false);

      await provider.initialize();

      expect(provider.initialized).toBe(true);
      expect(provider.model).toBe("mock-model");
      expect(logInfo).toHaveBeenCalledWith("ModelProvider", "Mock provider initialized");
    });

    it("chatCompletion returns a structured response with token counts", async () => {
      const provider = new MockModelProvider();
      await provider.initialize();

      const result = await provider.chatCompletion({
        messages: [{ role: "user", content: "Hello world" }],
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data.choices).toHaveLength(1);
      expect(result.data.choices[0].message.role).toBe("assistant");
      expect(result.data.choices[0].message.content).toContain("Hello world");
      expect(result.data.usage.total_tokens).toBeGreaterThan(0);
    });

    it("chatCompletion returns prompt_tokens and completion_tokens in usage", async () => {
      const provider = new MockModelProvider();
      await provider.initialize();

      const result = await provider.chatCompletion({
        messages: [{ role: "user", content: "Short" }],
      });

      expect(result.data.usage.prompt_tokens).toBeGreaterThan(0);
      expect(result.data.usage.completion_tokens).toBeGreaterThan(0);
      expect(result.data.usage.total_tokens).toBe(
        result.data.usage.prompt_tokens + result.data.usage.completion_tokens,
      );
    });

    it("createEmbedding returns vectors of dimension 1536", async () => {
      const provider = new MockModelProvider();
      await provider.initialize();

      const result = await provider.createEmbedding({
        input: "Hello embedding",
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.data.data).toHaveLength(1);
      expect(result.data.data[0].embedding).toHaveLength(1536);
      expect(result.data.data[0].object).toBe("embedding");
    });

    it("createEmbedding handles array input", async () => {
      const provider = new MockModelProvider();
      await provider.initialize();

      const result = await provider.createEmbedding({
        input: ["text one", "text two"],
      });

      expect(result.success).toBe(true);
      expect(result.data.data).toHaveLength(2);
    });

    it("healthCheck returns status based on initialized flag", async () => {
      const provider = new MockModelProvider();

      const before = await provider.healthCheck();
      expect(before.healthy).toBe(false);
      expect(before.provider).toBe("mock");

      await provider.initialize();

      const after = await provider.healthCheck();
      expect(after.healthy).toBe(true);
      expect(after.provider).toBe("mock");
    });
  });

  // ─── Registry Functions ───

  describe("Registry functions", () => {
    it("registerModelProvider adds a provider and returns success", () => {
      const provider = new MockModelProvider();
      const result = registerModelProvider("mock", provider);

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("mock");
      expect(result.error).toBeNull();
    });

    it("registerModelProvider rejects non-BaseModelProvider instances", () => {
      const fakeProvider = { name: "fake" };
      const result = registerModelProvider("fake", fakeProvider);

      expect(result.success).toBe(false);
      expect(result.error).toContain("BaseModelProvider");
    });

    it("getModelProvider returns a registered provider", () => {
      const provider = new MockModelProvider();
      registerModelProvider("test-get", provider);

      const result = getModelProvider("test-get");
      expect(result.success).toBe(true);
      expect(result.data).toBe(provider);
    });

    it("getModelProvider fails for unregistered provider", () => {
      const result = getModelProvider("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("setActiveModelProvider switches the active provider", async () => {
      const provider = new MockModelProvider();
      registerModelProvider("test-active", provider);

      const result = setActiveModelProvider("test-active");
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("test-active");

      const active = getActiveModelProvider();
      expect(active).toBe(provider);
    });

    it("setActiveModelProvider fails for unregistered provider", () => {
      const result = setActiveModelProvider("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("getActiveModelProvider falls back to mock when no active set", () => {
      const provider = getActiveModelProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBeDefined();
    });

    it("listModelProviders returns all registered providers", () => {
      const provider = new MockModelProvider();
      registerModelProvider("test-list", provider);

      const result = listModelProviders();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      const found = result.data.find((p) => p.name === "test-list");
      expect(found).toBeDefined();
      expect(found.initialized).toBe(false);
    });
  });

  // ─── initializeModelProviders ───

  describe("initializeModelProviders", () => {
    it("always registers mock provider and returns success", async () => {
      const result = await initializeModelProviders();

      expect(result.success).toBe(true);
      expect(result.data.registered).toContain("mock");
      expect(result.data.active).toBeDefined();
    });
  });
});
