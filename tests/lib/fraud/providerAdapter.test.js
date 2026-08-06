/**
 * Provider Adapter Tests — Unit tests for AI provider abstraction.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  BaseAIProvider,
  MockAIProvider,
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  LocalProvider,
  registerProvider,
  getProvider,
  setActiveProvider,
  getActiveProvider,
  listProviders,
  initializeDefaultProviders,
} from "../../../lib/fraud/providerAdapter";

describe("ProviderAdapter", () => {
  describe("BaseAIProvider", () => {
    it("should be instantiable as base class", () => {
      const provider = new BaseAIProvider("test");
      expect(provider.name).toBe("test");
      expect(provider.initialized).toBe(false);
    });

    it("should require initialize method", async () => {
      class TestProvider extends BaseAIProvider {
        constructor() {
          super("test");
        }
      }
      const provider = new TestProvider();
      await expect(provider.initialize()).rejects.toThrow("must be implemented");
    });

    it("should require analyzeRisk method", async () => {
      class TestProvider extends BaseAIProvider {
        constructor() {
          super("test");
        }
        async initialize() {}
      }
      const provider = new TestProvider();
      await expect(provider.analyzeRisk({})).rejects.toThrow("must be implemented");
    });
  });

  describe("MockAIProvider", () => {
    let provider;

    beforeEach(() => {
      provider = new MockAIProvider();
    });

    it("should initialize successfully", async () => {
      await provider.initialize();
      expect(provider.initialized).toBe(true);
    });

    it("should return risk analysis", async () => {
      await provider.initialize();
      const result = await provider.analyzeRisk({
        verificationLevel: 3,
        trustScore: 70,
        deviceCount24h: 1,
        accountAgeDays: 30,
        recentVerificationAttempts: 0,
      });

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.factors)).toBe(true);
      expect(typeof result.explanation).toBe("string");
    });

    it("should return higher risk for suspicious context", async () => {
      await provider.initialize();
      const result = await provider.analyzeRisk({
        verificationLevel: 0,
        trustScore: 10,
        deviceCount24h: 5,
        accountAgeDays: 2,
        recentVerificationAttempts: 5,
      });

      expect(result.riskScore).toBeGreaterThan(30);
    });

    it("should explain decision", async () => {
      await provider.initialize();
      const result = await provider.explainDecision({
        decision: "block",
        riskScore: 85,
        factors: ["low_trust_score", "multiple_devices"],
      });

      expect(result.explanation).toBeDefined();
      expect(Array.isArray(result.keyFactors)).toBe(true);
    });

    it("should detect anomalies", async () => {
      await provider.initialize();
      const result = await provider.detectAnomalies({
        deviceCount24h: 10,
        recentActivityCount: 25,
      });

      expect(Array.isArray(result.anomalies)).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should report healthy after initialization", async () => {
      await provider.initialize();
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.provider).toBe("mock");
    });
  });

  describe("Provider Registry", () => {
    beforeEach(() => {
      initializeDefaultProviders();
    });

    it("should register providers", () => {
      const providers = listProviders();
      expect(providers).toContain("mock");
      expect(providers).toContain("openai");
      expect(providers).toContain("gemini");
      expect(providers).toContain("anthropic");
      expect(providers).toContain("local");
    });

    it("should get provider by name", () => {
      const mock = getProvider("mock");
      expect(mock).toBeInstanceOf(MockAIProvider);
    });

    it("should return null for unknown provider", () => {
      const unknown = getProvider("nonexistent");
      expect(unknown).toBeNull();
    });

    it("should set active provider", () => {
      setActiveProvider("openai");
      const active = getActiveProvider();
      expect(active).toBeInstanceOf(OpenAIProvider);
    });

    it("should fall back to mock for unknown active provider", () => {
      setActiveProvider("nonexistent");
      const active = getActiveProvider();
      expect(active).toBeInstanceOf(MockAIProvider);
    });

    it("should reject non-BaseAIProvider instances", () => {
      expect(() => registerProvider("bad", {})).toThrow("must extend BaseAIProvider");
    });
  });

  describe("Placeholder Providers", () => {
    it("OpenAIProvider should initialize with API key", async () => {
      const provider = new OpenAIProvider();
      await provider.initialize({ apiKey: "test-key" });
      expect(provider.initialized).toBe(true);
    });

    it("OpenAIProvider should return not initialized without key", async () => {
      const provider = new OpenAIProvider();
      await provider.initialize();
      const result = await provider.analyzeRisk({});
      expect(result.riskScore).toBe(0);
    });

    it("GeminiProvider should initialize with API key", async () => {
      const provider = new GeminiProvider();
      await provider.initialize({ apiKey: "test-key" });
      expect(provider.initialized).toBe(true);
    });

    it("AnthropicProvider should initialize with API key", async () => {
      const provider = new AnthropicProvider();
      await provider.initialize({ apiKey: "test-key" });
      expect(provider.initialized).toBe(true);
    });

    it("LocalProvider should initialize with default URL", async () => {
      const provider = new LocalProvider();
      await provider.initialize();
      expect(provider.initialized).toBe(true);
      expect(provider.baseUrl).toBe("http://localhost:11434");
    });
  });
});
