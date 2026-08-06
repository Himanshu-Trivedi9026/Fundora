/**
 * Campaign AI Tests — Unit tests for AI-powered campaign analysis and suggestions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/ai/aiEngine.js", () => ({
  completeAIRequest: vi.fn().mockResolvedValue({ success: true, data: { content: "AI suggestion" } }),
  getAIConfig: vi.fn().mockResolvedValue({ success: true, data: { enabled: true } }),
}));

import {
  scoreCampaignQuality,
  suggestCampaignTitles,
  improveCampaignDescription,
  recommendFundingGoal,
  predictCategory,
  observeCampaignRisk,
  generateSEOSuggestions,
  analyzeCompleteness,
  batchQualityCheck,
} from "../../../lib/ai/campaignAI.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

// ─── Helper: build chainable mock returning terminal result ───────────

function mockChain(terminalKey, terminalValue, eqCount = 0) {
  if (eqCount === 0) {
    return { [terminalKey]: vi.fn().mockResolvedValue(terminalValue) };
  }
  return {
    eq: vi.fn().mockReturnValue(mockChain(terminalKey, terminalValue, eqCount - 1)),
  };
}

function mockFromChain(terminalKey, terminalValue, eqCount = 0) {
  return {
    select: vi.fn().mockReturnValue(mockChain(terminalKey, terminalValue, eqCount)),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("CampaignAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── scoreCampaignQuality ─────────────────────────────────────────

  describe("scoreCampaignQuality", () => {
    it("returns scores across dimensions for a valid campaign", async () => {
      const mockCampaign = {
        id: "camp-1",
        title: "Help Us Build an Innovative Technology Platform",
        description:
          "We are building an innovative software platform that will transform how communities connect. Our team has spent years developing this groundbreaking solution that empowers people to make a difference.",
        goal_amount: 25000,
        category: "technology",
        media_urls: ["img1.jpg", "img2.jpg", "img3.jpg"],
        creator_id: "user-1",
      };

      supabaseAdmin.from.mockReturnValueOnce(
        mockFromChain("single", { data: mockCampaign, error: null }, 1)
      );
      // creator_profiles query
      supabaseAdmin.from.mockReturnValueOnce(
        mockFromChain("single", { data: { trust_score: 70 }, error: null }, 1)
      );

      const result = await scoreCampaignQuality({ campaignId: "camp-1" });

      expect(result.success).toBe(true);
      expect(result.data.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.data.overallScore).toBeLessThanOrEqual(100);
      expect(result.data.breakdown).toHaveProperty("title");
      expect(result.data.breakdown).toHaveProperty("description");
      expect(result.data.breakdown).toHaveProperty("media");
      expect(result.data.breakdown).toHaveProperty("goal");
      expect(result.data.breakdown).toHaveProperty("category");
      expect(result.data.breakdown).toHaveProperty("creator");
      expect(Array.isArray(result.data.suggestions)).toBe(true);
    });

    it("returns error when campaignId is missing", async () => {
      const result = await scoreCampaignQuality({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("campaignId is required");
    });

    it("returns error when campaign is not found", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        mockFromChain("single", { data: null, error: { message: "not found" } }, 1)
      );

      const result = await scoreCampaignQuality({ campaignId: "nonexistent" });
      expect(result.success).toBe(false);
    });
  });

  // ─── suggestCampaignTitles ────────────────────────────────────────

  describe("suggestCampaignTitles", () => {
    it("generates title variations with power words", async () => {
      const result = await suggestCampaignTitles({
        title: "My Project Needs Funding",
        category: "technology",
        goal: 30000,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(2);

      // First entry should be the original title
      expect(result.data[0].title).toBe("My Project Needs Funding");
      expect(result.data[0].reason).toBe("Your current title");

      // Suggested titles should have scores
      for (const suggestion of result.data) {
        expect(suggestion).toHaveProperty("title");
        expect(suggestion).toHaveProperty("score");
        expect(suggestion).toHaveProperty("reason");
        expect(typeof suggestion.score).toBe("number");
      }
    });

    it("returns error when title is missing", async () => {
      const result = await suggestCampaignTitles({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("title is required");
    });

    it("adds number variation when title has no digits", async () => {
      const result = await suggestCampaignTitles({
        title: "Clean Water for Everyone",
        category: "environment",
        goal: 50000,
      });

      expect(result.success).toBe(true);
      const numberSuggestion = result.data.find((s) => s.title.includes("$"));
      expect(numberSuggestion).toBeDefined();
    });
  });

  // ─── improveCampaignDescription ───────────────────────────────────

  describe("improveCampaignDescription", () => {
    it("suggests improvements for a short description", async () => {
      const result = await improveCampaignDescription({
        title: "Help Build Schools",
        description: "We need help.",
        category: "education",
        goal: 15000,
      });

      expect(result.success).toBe(true);
      expect(result.data.original).toBe("We need help.");
      expect(typeof result.data.improved).toBe("string");
      expect(Array.isArray(result.data.suggestions)).toBe(true);
      expect(result.data.suggestions.length).toBeGreaterThan(0);

      // Short description should trigger length suggestion
      expect(result.data.suggestions.some((s) => s.includes("short"))).toBe(true);
    });

    it("returns error when description is missing", async () => {
      const result = await improveCampaignDescription({
        title: "Test",
        description: "",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("description is required");
    });

    it("adds CTA when none present and provides improved text", async () => {
      const longDesc =
        "This project is about building something meaningful for the community. We want to create a lasting impact that improves the lives of many people in need. Our team is dedicated and passionate about making change happen. This initiative will focus on sustainability and long-term results. We aim to achieve measurable outcomes and demonstrate real impact through our efforts.";
      const result = await improveCampaignDescription({
        title: "Community Impact",
        description: longDesc,
        category: "community",
        goal: 20000,
      });

      expect(result.success).toBe(true);
      expect(result.data.improved.length).toBeGreaterThanOrEqual(longDesc.length);
    });
  });

  // ─── recommendFundingGoal ─────────────────────────────────────────

  describe("recommendFundingGoal", () => {
    it("calculates range from category averages", async () => {
      const result = await recommendFundingGoal({
        category: "technology",
        campaignType: "business",
      });

      expect(result.success).toBe(true);
      expect(result.data.recommended).toBeGreaterThan(0);
      expect(result.data.range.min).toBeLessThanOrEqual(result.data.recommended);
      expect(result.data.range.max).toBeGreaterThanOrEqual(result.data.recommended);
      expect(typeof result.data.reason).toBe("string");
    });

    it("adjusts based on similar campaigns", async () => {
      const result = await recommendFundingGoal({
        category: "health",
        campaignType: "nonprofit",
        similarCampaigns: [
          { goal_amount: 40000, status: "funded", raised: 42000 },
          { goal_amount: 60000, status: "funded", raised: 65000 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data.recommended).toBeGreaterThan(0);
      expect(result.data.reason).toContain("successful");
    });

    it("applies campaign type multipliers", async () => {
      const personal = await recommendFundingGoal({
        category: "arts",
        campaignType: "personal",
      });
      const nonprofit = await recommendFundingGoal({
        category: "arts",
        campaignType: "nonprofit",
      });

      expect(personal.success).toBe(true);
      expect(nonprofit.success).toBe(true);
      // nonprofit multiplier (1.2) > personal multiplier (0.6)
      expect(nonprofit.data.recommended).toBeGreaterThanOrEqual(personal.data.recommended);
    });
  });

  // ─── predictCategory ──────────────────────────────────────────────

  describe("predictCategory", () => {
    it("returns matching categories from keywords", async () => {
      const result = await predictCategory({
        title: "AI Software Platform",
        description: "Building an innovative machine learning and blockchain platform",
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      // Should identify technology as top match
      const techMatch = result.data.find((r) => r.category === "technology");
      expect(techMatch).toBeDefined();
      expect(techMatch.confidence).toBeGreaterThan(0);
    });

    it("returns community as default when no keywords match", async () => {
      const result = await predictCategory({
        title: "Hello World",
        description: "Just a test with no matching keywords whatsoever",
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].category).toBe("community");
    });

    it("returns error when both title and description are missing", async () => {
      const result = await predictCategory({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("At least one of title or description is required");
    });
  });

  // ─── observeCampaignRisk ──────────────────────────────────────────

  describe("observeCampaignRisk", () => {
    it("identifies risks without blocking", async () => {
      const mockCampaign = {
        id: "camp-risk",
        title: "Test",
        description: "Short",
        goal_amount: 200000,
        category: "arts",
        media_urls: [],
        creator_id: "user-new",
        status: "active",
        created_at: new Date().toISOString(),
      };
      const mockCreator = {
        trust_score: 20,
        campaigns_created: 1,
        total_raised: 0,
        kyc_status: "pending",
      };

      supabaseAdmin.from.mockReturnValueOnce(
        mockFromChain("single", { data: mockCampaign, error: null }, 1)
      );
      supabaseAdmin.from.mockReturnValueOnce(
        mockFromChain("single", { data: mockCreator, error: null }, 1)
      );

      const result = await observeCampaignRisk({ campaignId: "camp-risk" });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.observations)).toBe(true);
      expect(result.data.observations.length).toBeGreaterThan(0);

      // Should flag various risks for this problematic campaign
      const types = result.data.observations.map((o) => o.type);
      expect(types).toContain("unrealistic_goal");
      expect(types).toContain("no_media");
    });

    it("returns error when campaignId is missing", async () => {
      const result = await observeCampaignRisk({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("campaignId is required");
    });

    it("returns empty observations for a well-formed campaign", async () => {
      const mockCampaign = {
        id: "camp-good",
        title: "Help Build a Community Center",
        description:
          "We are building a community center that will serve hundreds of families with after-school programs, job training, and health services.",
        goal_amount: 20000,
        category: "community",
        media_urls: ["img1.jpg", "img2.jpg"],
        creator_id: "user-trusted",
        status: "active",
        created_at: new Date().toISOString(),
      };
      const mockCreator = {
        trust_score: 80,
        campaigns_created: 5,
        total_raised: 50000,
        kyc_status: "verified",
      };

      supabaseAdmin.from.mockReturnValueOnce(
        mockFromChain("single", { data: mockCampaign, error: null }, 1)
      );
      supabaseAdmin.from.mockReturnValueOnce(
        mockFromChain("single", { data: mockCreator, error: null }, 1)
      );

      const result = await observeCampaignRisk({ campaignId: "camp-good" });

      expect(result.success).toBe(true);
      expect(result.data.observations.length).toBe(0);
    });
  });

  // ─── generateSEOSuggestions ───────────────────────────────────────

  describe("generateSEOSuggestions", () => {
    it("produces keywords and meta description", async () => {
      const result = await generateSEOSuggestions({
        title: "Revolutionary AI Education Platform for Students",
        description:
          "An innovative machine learning platform designed to transform education and help students learn programming skills through interactive technology courses.",
        category: "technology",
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.keywords)).toBe(true);
      expect(result.data.keywords.length).toBeGreaterThan(0);
      expect(typeof result.data.metaDescription).toBe("string");
      expect(result.data.metaDescription.length).toBeLessThanOrEqual(160);
      expect(Array.isArray(result.data.titleSuggestions)).toBe(true);
    });

    it("returns error when both title and description are missing", async () => {
      const result = await generateSEOSuggestions({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("At least one of title or description is required");
    });

    it("adds category to keywords when missing from content", async () => {
      const result = await generateSEOSuggestions({
        title: "Help us build something great",
        description: "We are building something meaningful for everyone to enjoy",
        category: "arts",
      });

      expect(result.success).toBe(true);
      expect(result.data.keywords).toContain("arts");
    });
  });

  // ─── analyzeCompleteness ──────────────────────────────────────────

  describe("analyzeCompleteness", () => {
    it("scores completeness and identifies missing fields", async () => {
      const mockCampaign = {
        id: "camp-inc",
        title: "Help Build a School",
        description: "",
        goal_amount: 0,
        category: "",
        media_urls: [],
        end_date: null,
        tags: [],
        short_description: "",
        location: "",
        video_url: "",
      };

      supabaseAdmin.from.mockReturnValueOnce(
        mockFromChain("single", { data: mockCampaign, error: null }, 1)
      );

      const result = await analyzeCompleteness({ campaignId: "camp-inc" });

      expect(result.success).toBe(true);
      expect(typeof result.data.score).toBe("number");
      expect(result.data.score).toBeGreaterThanOrEqual(0);
      expect(result.data.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.data.missing)).toBe(true);
      expect(Array.isArray(result.data.improvements)).toBe(true);

      // Short title, empty description, zero goal, empty category = missing required fields
      expect(result.data.missing.length).toBeGreaterThan(0);
      expect(result.data.missing).toContain("Description");
    });

    it("returns error when campaignId is missing", async () => {
      const result = await analyzeCompleteness({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("campaignId is required");
    });

    it("scores 100% for a fully complete campaign", async () => {
      const mockCampaign = {
        id: "camp-full",
        title: "Help Build a School in Rural Area",
        description:
          "This is a detailed description of our campaign that provides all the necessary information about building a new school in a rural community that currently lacks educational infrastructure.",
        goal_amount: 50000,
        category: "education",
        media_urls: ["img1.jpg", "img2.jpg"],
        end_date: "2026-12-31",
        tags: ["education", "school", "community"],
        short_description: "Building a school",
        location: "Rural District, State",
        video_url: "https://example.com/video.mp4",
      };

      supabaseAdmin.from.mockReturnValueOnce(
        mockFromChain("single", { data: mockCampaign, error: null }, 1)
      );

      const result = await analyzeCompleteness({ campaignId: "camp-full" });

      expect(result.success).toBe(true);
      expect(result.data.score).toBe(100);
      expect(result.data.missing.length).toBe(0);
    });
  });

  // ─── batchQualityCheck ────────────────────────────────────────────

  describe("batchQualityCheck", () => {
    it("processes multiple campaigns", async () => {
      const mockCampaigns = [
        {
          id: "c1",
          title: "Help Build an Innovative Technology",
          description:
            "We are creating a groundbreaking software platform that will transform education through machine learning and innovative technology solutions.",
          goal_amount: 20000,
          category: "technology",
          media_urls: ["img1.jpg", "img2.jpg"],
        },
        {
          id: "c2",
          title: "Short",
          description: "Brief",
          goal_amount: 100,
          category: "arts",
          media_urls: [],
        },
      ];

      supabaseAdmin.from.mockReturnValueOnce(
        Object.assign(
          {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockCampaigns, error: null }),
            }),
          },
          { select: vi.fn() }
        )
      );
      // Fix: build proper chain for .in()
      supabaseAdmin.from.mockReset();
      const mockIn = vi.fn().mockResolvedValue({ data: mockCampaigns, error: null });
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: mockIn,
        }),
      });

      const result = await batchQualityCheck({ campaignIds: ["c1", "c2"] });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
      expect(result.data[0]).toHaveProperty("campaignId");
      expect(result.data[0]).toHaveProperty("score");
      expect(result.data[0]).toHaveProperty("flags");
    });

    it("returns error when campaignIds is empty", async () => {
      const result = await batchQualityCheck({ campaignIds: [] });
      expect(result.success).toBe(false);
      expect(result.error).toContain("campaignIds");
    });

    it("returns error when campaignIds is not an array", async () => {
      const result = await batchQualityCheck({ campaignIds: "not-array" });
      expect(result.success).toBe(false);
    });
  });
});
