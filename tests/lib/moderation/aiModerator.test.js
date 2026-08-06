/**
 * AI Moderator Tests — Unit tests for AI-powered content moderation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/ai/aiEngine.js", () => ({
  completeAIRequest: vi.fn().mockResolvedValue({
    success: true,
    data: { content: "analysis" },
  }),
  getAIConfig: vi.fn().mockResolvedValue({
    success: true,
    data: { enabled: true },
  }),
}));

import {
  classifyContent,
  detectSpam,
  detectDuplicateCampaign,
  detectSuspiciousDescription,
  analyzeMediaAuthenticity,
  suggestPolicyViolation,
  calculateModerationConfidence,
} from "../../../lib/moderation/aiModerator.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

// ─── Tests ───────────────────────────────────────────────────────────

describe("AIModerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── classifyContent ──────────────────────────────────────────────

  describe("classifyContent", () => {
    it("returns category, severity, confidence, and policy violations for clean content", async () => {
      const result = await classifyContent({
        entityType: "campaign",
        entityId: "camp-1",
        content: "Help us build a school in the local community with your generous support",
      });

      expect(result.success).toBe(true);
      expect(typeof result.data.category).toBe("string");
      expect(typeof result.data.severity).toBe("string");
      expect(typeof result.data.confidence).toBe("number");
      expect(result.data.confidence).toBeGreaterThanOrEqual(0);
      expect(result.data.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.data.policyViolations)).toBe(true);
    });

    it("detects spam content with high confidence", async () => {
      const result = await classifyContent({
        entityType: "comment",
        entityId: "com-1",
        content:
          "Click here for free money! Act now! Limited time offer! Congratulations you won! Buy now for guaranteed returns!",
      });

      expect(result.success).toBe(true);
      expect(result.data.category).toBe("spam");
      expect(result.data.severity).toBe("high");
      expect(result.data.policyViolations.length).toBeGreaterThan(0);
    });

    it("detects scam indicators", async () => {
      const result = await classifyContent({
        entityType: "campaign",
        entityId: "camp-scam",
        content:
          "Invest now for guaranteed profit and 100% return! This risk free opportunity will give you financial freedom guaranteed!",
      });

      expect(result.success).toBe(true);
      expect(result.data.category).toBe("scam");
      expect(result.data.severity).toBe("critical");
    });

    it("returns error when required params are missing", async () => {
      const noType = await classifyContent({ entityId: "1", content: "text" });
      expect(noType.success).toBe(false);
      expect(noType.error).toBe("entityType is required");

      const noId = await classifyContent({ entityType: "campaign", content: "text" });
      expect(noId.success).toBe(false);

      const noContent = await classifyContent({ entityType: "campaign", entityId: "1" });
      expect(noContent.success).toBe(false);
    });
  });

  // ─── detectSpam ───────────────────────────────────────────────────

  describe("detectSpam", () => {
    it("detects spam with multiple factors", async () => {
      const result = await detectSpam({
        content:
          "Buy now! Act now! Limited time offer! Click here for free money! Send money to us immediately!",
        authorId: "user-spam",
      });

      expect(result.success).toBe(true);
      expect(result.data.isSpam).toBe(true);
      expect(result.data.confidence).toBeGreaterThan(0.3);
      expect(Array.isArray(result.data.factors)).toBe(true);
      expect(result.data.factors.length).toBeGreaterThan(0);
      expect(result.data.recommendation).toContain("spam");
    });

    it("returns clean result for legitimate content", async () => {
      const result = await detectSpam({
        content:
          "I am working on a project to help our community build a new library. Your donation will help purchase books and equipment.",
        authorId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.isSpam).toBe(false);
      expect(result.data.confidence).toBeLessThan(0.6);
    });

    it("detects excessive URLs as spam indicator", async () => {
      const result = await detectSpam({
        content:
          "Check out https://example1.com and https://example2.com and https://example3.com and https://example4.com for details",
        authorId: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.factors.some((f) => f.includes("URL"))).toBe(true);
    });

    it("returns error when required params are missing", async () => {
      const noContent = await detectSpam({ authorId: "u1" });
      expect(noContent.success).toBe(false);

      const noAuthor = await detectSpam({ content: "text" });
      expect(noAuthor.success).toBe(false);
    });
  });

  // ─── detectDuplicateCampaign ──────────────────────────────────────

  describe("detectDuplicateCampaign", () => {
    it("finds similar campaigns via text similarity", async () => {
      const mockExisting = [
        { id: "existing-1", title: "Build a School in Rural Area", description: "Help build a school", creator_id: "other" },
        { id: "existing-2", title: "Build a Hospital", description: "Help build a hospital", creator_id: "other" },
      ];

      const mockOwn = [
        { id: "own-1", title: "My Previous School Campaign", description: "Build a school in another area", status: "active" },
      ];

      // Chain: from → select → eq → neq → in → order → limit
      const limitMock = vi.fn().mockResolvedValue({ data: mockExisting, error: null });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const inMock = vi.fn().mockReturnValue({ order: orderMock });
      const neqMock = vi.fn().mockReturnValue({ in: inMock });
      const eqCategoryMock = vi.fn().mockReturnValue({ neq: neqMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqCategoryMock });

      // own campaigns chain: from → select → eq → in → neq
      const ownNeq = vi.fn().mockResolvedValue({ data: mockOwn, error: null });
      const ownIn = vi.fn().mockReturnValue({ neq: ownNeq });
      const ownEq = vi.fn().mockReturnValue({ in: ownIn });
      const ownSelect = vi.fn().mockReturnValue({ eq: ownEq });

      supabaseAdmin.from
        .mockReturnValueOnce({ select: selectMock }) // existing campaigns
        .mockReturnValueOnce({ select: ownSelect }); // own campaigns

      const result = await detectDuplicateCampaign({
        title: "Build a School in Rural Area",
        description: "Help us build a school in a rural area that needs educational facilities",
        category: "education",
        creatorId: "creator-1",
      });

      expect(result.success).toBe(true);
      expect(typeof result.data.isDuplicate).toBe("boolean");
      expect(Array.isArray(result.data.similarCampaigns)).toBe(true);
      expect(typeof result.data.confidence).toBe("number");
    });

    it("returns no duplicates for unique content", async () => {
      const emptyChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      };

      supabaseAdmin.from
        .mockReturnValueOnce(emptyChain)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        });

      const result = await detectDuplicateCampaign({
        title: "Unique Quantum Computing Research Initiative",
        description:
          "A completely novel approach to quantum error correction that has never been explored before in the field of computational physics",
        category: "science",
        creatorId: "creator-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.isDuplicate).toBe(false);
      expect(result.data.similarCampaigns.length).toBe(0);
    });

    it("returns error when required params are missing", async () => {
      const noTitle = await detectDuplicateCampaign({
        description: "text",
        creatorId: "u1",
      });
      expect(noTitle.success).toBe(false);

      const noDesc = await detectDuplicateCampaign({
        title: "Title",
        creatorId: "u1",
      });
      expect(noDesc.success).toBe(false);

      const noCreator = await detectDuplicateCampaign({
        title: "Title",
        description: "text",
      });
      expect(noCreator.success).toBe(false);
    });
  });

  // ─── detectSuspiciousDescription ──────────────────────────────────

  describe("detectSuspiciousDescription", () => {
    it("identifies suspicious patterns in descriptions", async () => {
      const result = await detectSuspiciousDescription({
        description:
          "Invest now for guaranteed profit! 100% return guaranteed! Act fast, last chance! Send money to our bitcoin wallet immediately!",
        category: "business",
        goal: 100000,
      });

      expect(result.success).toBe(true);
      expect(result.data.suspicious).toBe(true);
      expect(result.data.flags.length).toBeGreaterThan(0);
      expect(result.data.confidence).toBeGreaterThan(0);
    });

    it("returns clean for legitimate descriptions", async () => {
      const result = await detectSuspiciousDescription({
        description:
          "We are building a community garden to provide fresh produce for local families. Our team of volunteers will maintain the garden and distribute produce to those in need. Funds will be used for soil preparation, seeds, and gardening equipment. We aim to serve at least 50 families per week during the growing season.",
        category: "community",
        goal: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.data.suspicious).toBe(false);
      expect(result.data.flags.length).toBe(0);
    });

    it("detects personal info exposure", async () => {
      const result = await detectSuspiciousDescription({
        description:
          "Please contact me at 555-123-4567 or email john@example.com. My address is 123 Main Street. You can also reach me by phone.",
        category: "community",
        goal: 10000,
      });

      expect(result.success).toBe(true);
      const personalInfoFlag = result.data.flags.find(
        (f) => f.type === "personal_info"
      );
      expect(personalInfoFlag).toBeDefined();
      expect(personalInfoFlag.severity).toBe("high");
    });

    it("returns error when description is missing", async () => {
      const result = await detectSuspiciousDescription({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("description is required");
    });
  });

  // ─── analyzeMediaAuthenticity ─────────────────────────────────────

  describe("analyzeMediaAuthenticity", () => {
    it("returns authenticity indicators for suspicious media", async () => {
      const result = await analyzeMediaAuthenticity({
        mediaUrls: [
          "http://shutterstock.com/photo-123.jpg",
          "http://example.com/malware.exe",
          "http://imgflip.com/meme-funny.jpg",
        ],
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.indicators)).toBe(true);
      expect(result.data.indicators.length).toBeGreaterThan(0);
      expect(typeof result.data.overallAuthenticity).toBe("number");
      expect(result.data.overallAuthenticity).toBeLessThan(1);

      // Should flag stock photo
      const stockFlag = result.data.indicators.find(
        (i) => i.type === "stock_photo"
      );
      expect(stockFlag).toBeDefined();

      // Should flag executable file
      const execFlag = result.data.indicators.find(
        (i) => i.type === "suspicious_file"
      );
      expect(execFlag).toBeDefined();
    });

    it("returns high authenticity for clean media", async () => {
      const result = await analyzeMediaAuthenticity({
        mediaUrls: [
          "https://example.com/photo1.jpg",
          "https://cdn.example.com/image2.png",
          "https://storage.example.com/video.mp4",
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.overallAuthenticity).toBeGreaterThan(0.8);
    });

    it("returns error for empty mediaUrls", async () => {
      const result = await analyzeMediaAuthenticity({ mediaUrls: [] });
      expect(result.success).toBe(false);
      expect(result.error).toContain("mediaUrls");
    });

    it("detects single media as low credibility indicator", async () => {
      const result = await analyzeMediaAuthenticity({
        mediaUrls: ["https://example.com/photo.jpg"],
      });

      expect(result.success).toBe(true);
      const singleFlag = result.data.indicators.find(
        (i) => i.type === "single_media"
      );
      expect(singleFlag).toBeDefined();
    });
  });

  // ─── suggestPolicyViolation ───────────────────────────────────────

  describe("suggestPolicyViolation", () => {
    it("matches content against policies and returns violations", async () => {
      const result = await suggestPolicyViolation({
        content:
          "This campaign offers guaranteed returns and 100% risk free investment! Act now for exclusive opportunity! My phone number is 555-867-5309",
        entityType: "campaign",
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.violations)).toBe(true);
      expect(result.data.violations.length).toBeGreaterThan(0);
      expect(typeof result.data.recommendation).toBe("string");

      // Should have personal info violation
      const personalInfoViolation = result.data.violations.find(
        (v) => v.policy === "NO_PERSONAL_INFO"
      );
      expect(personalInfoViolation).toBeDefined();
      expect(personalInfoViolation.severity).toBe("high");
    });

    it("returns no violations for clean content", async () => {
      const result = await suggestPolicyViolation({
        content:
          "We are building a community library to serve local families and children. Your support will help us purchase books, computers, and furniture for a welcoming learning space.",
        entityType: "campaign",
      });

      expect(result.success).toBe(true);
      expect(result.data.violations.length).toBe(0);
      expect(result.data.recommendation).toContain("No policy violations");
    });

    it("detects hate speech violations", async () => {
      const result = await suggestPolicyViolation({
        content:
          "I hate all muslims and want to destroy every single one of them. This is disgusting.",
        entityType: "comment",
      });

      expect(result.success).toBe(true);
      const hateViolation = result.data.violations.find(
        (v) => v.policy === "NO_HATE_SPEECH"
      );
      expect(hateViolation).toBeDefined();
      expect(hateViolation.severity).toBe("critical");
    });

    it("returns error when required params are missing", async () => {
      const noContent = await suggestPolicyViolation({ entityType: "campaign" });
      expect(noContent.success).toBe(false);

      const noType = await suggestPolicyViolation({ content: "text" });
      expect(noType.success).toBe(false);
    });
  });

  // ─── calculateModerationConfidence ────────────────────────────────

  describe("calculateModerationConfidence", () => {
    it("calculates weighted confidence from multiple signals", async () => {
      const result = await calculateModerationConfidence({
        signals: {
          spamScore: 0.8,
          toxicityScore: 0.3,
          fraudScore: 0.1,
        },
        aiResults: {
          classification: { confidence: 0.75 },
        },
        ruleResults: [
          { matched: true, confidence: 0.6 },
          { matched: true, confidence: 0.8 },
          { matched: false, confidence: 0 },
        ],
      });

      expect(result.success).toBe(true);
      expect(typeof result.data.overallConfidence).toBe("number");
      expect(result.data.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.data.overallConfidence).toBeLessThanOrEqual(1);

      expect(result.data.breakdown).toHaveProperty("signals");
      expect(result.data.breakdown).toHaveProperty("ai");
      expect(result.data.breakdown).toHaveProperty("rules");

      expect(result.data.breakdown.ai).toBe(0.75);
    });

    it("returns 0 confidence when no signals provided", async () => {
      const result = await calculateModerationConfidence({});

      expect(result.success).toBe(true);
      expect(result.data.overallConfidence).toBe(0);
      expect(result.data.breakdown.signals).toBe(0);
      expect(result.data.breakdown.ai).toBe(0);
      expect(result.data.breakdown.rules).toBe(0);
    });

    it("handles object-based rule results", async () => {
      const result = await calculateModerationConfidence({
        signals: { spamScore: 0.5 },
        aiResults: {},
        ruleResults: {
          rule1: { matched: true, confidence: 0.7 },
          rule2: { matched: false, confidence: 0.3 },
          rule3: { matched: true, confidence: 0.9 },
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.overallConfidence).toBeGreaterThan(0);
      expect(result.data.breakdown.rules).toBeGreaterThan(0);
    });

    it("weights AI results higher than signals", async () => {
      const withAi = await calculateModerationConfidence({
        signals: { spamScore: 0.5 },
        aiResults: { classification: { confidence: 0.9 } },
        ruleResults: [],
      });

      const withoutAi = await calculateModerationConfidence({
        signals: { spamScore: 0.5 },
        aiResults: {},
        ruleResults: [],
      });

      expect(withAi.data.overallConfidence).toBeGreaterThan(
        withoutAi.data.overallConfidence
      );
    });
  });
});
