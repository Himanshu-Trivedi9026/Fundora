/**
 * AI Engine Tests — Unit tests for the central AI orchestrator.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
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
  logWarn: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog.js", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../../lib/ai/providerRegistry.js", () => ({
  // getActiveModelProvider() returns the active BaseModelProvider instance
  // directly, NOT a { success, data } envelope (see providerRegistry.js).
  // This mock must match that shape — the same shape the other AI test files use.
  getActiveModelProvider: vi.fn().mockReturnValue({
    name: "mock-provider",
    defaultModel: "test-model",
    chatCompletion: vi.fn().mockResolvedValue({ content: "AI response", tokens: 10, costCents: 1 }),
    createEmbedding: vi.fn().mockResolvedValue({ embedding: Array(1536).fill(0.1) }),
  }),
}));

vi.mock("../../../lib/ai/tokenTracker.js", () => ({
  trackTokenUsage: vi.fn().mockResolvedValue({ success: true }),
  checkUsageLimit: vi.fn().mockResolvedValue({ success: true, data: { allowed: true } }),
}));

vi.mock("../../../lib/ai/costTracker.js", () => ({
  recordAICost: vi.fn().mockResolvedValue({ success: true, data: { costCents: 1 } }),
  checkCostBudget: vi.fn().mockResolvedValue({ success: true, data: { withinBudget: true } }),
}));

vi.mock("../../../lib/ai/modelRouter.js", () => ({
  routeModel: vi.fn().mockResolvedValue({ success: true, data: { provider: "mock", model: "test-model" } }),
}));

import {
  completeAIRequest,
  getAIConfig,
  updateAIConfig,
  sanitizeAIOutput,
} from "../../../lib/ai/aiEngine.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logAuditEvent } from "../../../lib/verification/auditLog.js";
import { checkUsageLimit, trackTokenUsage } from "../../../lib/ai/tokenTracker.js";
import { recordAICost } from "../../../lib/ai/costTracker.js";
import { routeModel } from "../../../lib/ai/modelRouter.js";
import { getActiveModelProvider } from "../../../lib/ai/providerRegistry.js";

describe("AIEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── completeAIRequest ───

  describe("completeAIRequest", () => {
    it("should return success with AI response on valid input", async () => {
      const result = await completeAIRequest({
        userId: "user-1",
        taskType: "campaign_quality",
        messages: [{ role: "user", content: "Analyze this campaign" }],
      });

      expect(result.success).toBe(true);
      expect(result.data.content).toBeDefined();
      expect(result.data.model).toBeDefined();
      expect(result.data.provider).toBeDefined();
    });

    it("should fail when taskType is missing", async () => {
      const result = await completeAIRequest({
        userId: "user-1",
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("taskType is required");
    });

    it("should fail when messages array is missing or empty", async () => {
      const resultNoMessages = await completeAIRequest({
        userId: "user-1",
        taskType: "campaign_quality",
      });

      expect(resultNoMessages.success).toBe(false);
      expect(resultNoMessages.error).toContain("messages");

      const resultEmptyMessages = await completeAIRequest({
        userId: "user-1",
        taskType: "campaign_quality",
        messages: [],
      });

      expect(resultEmptyMessages.success).toBe(false);
    });

    it("should check usage limits when userId is provided", async () => {
      await completeAIRequest({
        userId: "user-1",
        taskType: "campaign_quality",
        messages: [{ role: "user", content: "test" }],
      });

      expect(checkUsageLimit).toHaveBeenCalledWith("user-1");
    });

    it("should track tokens and cost after successful completion", async () => {
      await completeAIRequest({
        userId: "user-1",
        taskType: "campaign_quality",
        messages: [{ role: "user", content: "test" }],
      });

      expect(trackTokenUsage).toHaveBeenCalled();
      expect(recordAICost).toHaveBeenCalled();
    });

    it("should route to correct model when model is not specified", async () => {
      await completeAIRequest({
        userId: "user-1",
        taskType: "campaign_quality",
        messages: [{ role: "user", content: "test" }],
      });

      expect(routeModel).toHaveBeenCalledWith(
        expect.objectContaining({ taskType: "campaign_quality" })
      );
    });

    it("should bypass routing when model is explicitly provided", async () => {
      await completeAIRequest({
        userId: "user-1",
        taskType: "campaign_quality",
        messages: [{ role: "user", content: "test" }],
        model: "gpt-4",
      });

      expect(routeModel).not.toHaveBeenCalled();
    });
  });

  // ─── getAIConfig ───

  describe("getAIConfig", () => {
    it("should return config from DB when available", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { value: { enabled: false, defaultProvider: "openai" } },
              error: null,
            }),
          }),
        }),
      });

      const result = await getAIConfig();
      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(false);
      expect(result.data.defaultProvider).toBe("openai");
    });

    it("should fall back to defaults when DB returns no data", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await getAIConfig();
      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(true);
      expect(result.data.defaultProvider).toBe("mock");
      expect(result.data.rateLimits).toBeDefined();
    });
  });

  // ─── updateAIConfig ───

  describe("updateAIConfig", () => {
    it("should update config successfully", async () => {
      supabaseAdmin.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await updateAIConfig({ enabled: false }, "admin-1");
      expect(result.success).toBe(true);
      expect(result.data.updated).toBe(true);
    });

    it("should fail when config object is missing", async () => {
      const result = await updateAIConfig(null, "admin-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("config object is required");
    });

    it("should fail when performedBy is missing", async () => {
      const result = await updateAIConfig({ enabled: false }, null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("performedBy is required");
    });
  });

  // ─── sanitizeAIOutput ───

  describe("sanitizeAIOutput", () => {
    it("should redact email addresses", () => {
      const input = "Contact the user at john.doe@example.com for details.";
      const result = sanitizeAIOutput(input);
      expect(result).toContain("[EMAIL_REDACTED]");
      expect(result).not.toContain("john.doe@example.com");
    });

    it("should redact Indian phone numbers", () => {
      const input = "Call the creator at +91 9876543210 or 8765432100.";
      const result = sanitizeAIOutput(input);
      expect(result).toContain("[PHONE_REDACTED]");
      expect(result).not.toContain("9876543210");
    });

    it("should redact Aadhaar numbers", () => {
      const input = "Aadhaar: 1234 5678 9012 verified.";
      const result = sanitizeAIOutput(input);
      expect(result).toContain("[ID_REDACTED]");
    });

    it("should redact PAN card numbers", () => {
      const input = "PAN number is ABCDE1234F.";
      const result = sanitizeAIOutput(input);
      expect(result).toContain("[PAN_REDACTED]");
      expect(result).not.toContain("ABCDE1234F");
    });

    it("should return empty string for null/undefined/non-string input", () => {
      expect(sanitizeAIOutput(null)).toBe("");
      expect(sanitizeAIOutput(undefined)).toBe("");
      expect(sanitizeAIOutput(123)).toBe("");
    });
  });
});
