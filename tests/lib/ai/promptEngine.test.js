/**
 * Prompt Engine Tests — Unit tests for DB-driven prompt template management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import {
  getPromptTemplate,
  createPromptTemplate,
  listPromptTemplates,
  renderPrompt,
} from "../../../lib/ai/promptEngine.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

describe("PromptEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getPromptTemplate ───

  describe("getPromptTemplate", () => {
    it("should return the default template when no DB override exists", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      const result = await getPromptTemplate("campaign_quality", {
        title: "Test Campaign",
        description: "A test",
        goal: "100000",
        category: "education",
        trustScore: "85",
      });

      expect(result.success).toBe(true);
      expect(result.data.systemPrompt).toContain("campaign quality analyst");
      expect(result.data.userPrompt).toContain("Test Campaign");
      expect(result.data.userPrompt).toContain("100000");
    });

    it("should return a DB template when it exists", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  name: "custom_template",
                  category: "custom",
                  system_template: "Custom system prompt",
                  user_template: "Custom user prompt with {{variable}}",
                  variables: ["variable"],
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await getPromptTemplate("custom_template", {
        variable: "test-value",
      });

      expect(result.success).toBe(true);
      expect(result.data.systemPrompt).toBe("Custom system prompt");
      expect(result.data.userPrompt).toBe("Custom user prompt with test-value");
    });

    it("should return error for unknown template name", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      const result = await getPromptTemplate("nonexistent_template");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should fail when templateName is missing", async () => {
      const result = await getPromptTemplate(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("templateName is required");
    });
  });

  // ─── createPromptTemplate ───

  describe("createPromptTemplate", () => {
    it("should create a template successfully", async () => {
      // First from() call: check for duplicate (no existing template)
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        })
        // Second from() call: insert
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "template-1" },
                error: null,
              }),
            }),
          }),
        });

      const result = await createPromptTemplate({
        name: "my_custom_template",
        category: "campaign",
        systemTemplate: "You are a helpful assistant.",
        userTemplate: "Help me with {{topic}}",
        variables: ["topic"],
        createdBy: "admin-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("template-1");
    });

    it("should fail when required fields are missing", async () => {
      const result = await createPromptTemplate({
        name: "incomplete_template",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("should fail when template name already exists", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "existing-id" },
              error: null,
            }),
          }),
        }),
      });

      const result = await createPromptTemplate({
        name: "duplicate_template",
        systemTemplate: "System",
        userTemplate: "User {{var}}",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });
  });

  // ─── listPromptTemplates ───

  describe("listPromptTemplates", () => {
    it("should return all templates including defaults", async () => {
      // listPromptTemplates without args: from().select().order() — terminal is order
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const result = await listPromptTemplates();
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      // Should include default templates
      const names = result.data.map((t) => t.name);
      expect(names).toContain("campaign_quality");
      expect(names).toContain("fraud_analysis");
    });

    it("should merge DB templates with defaults, avoiding duplicates", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "db-1",
                name: "campaign_quality",
                category: "campaign",
                system_template: "DB override",
                user_template: "DB user template",
                variables: [],
                enabled: true,
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await listPromptTemplates();
      expect(result.success).toBe(true);

      // DB version should be included
      const dbTemplate = result.data.find(
        (t) => t.name === "campaign_quality" && t.id === "db-1",
      );
      expect(dbTemplate).toBeDefined();

      // campaign_quality should NOT appear again from defaults
      const defaultCampaignQuality = result.data.filter(
        (t) => t.name === "campaign_quality" && t.id === null,
      );
      expect(defaultCampaignQuality).toHaveLength(0);
    });
  });

  // ─── renderPrompt ───

  describe("renderPrompt", () => {
    it("should replace {{variables}} with provided values", () => {
      const result = renderPrompt("Hello {{name}}, your goal is ₹{{goal}}", {
        name: "Ravi",
        goal: "50000",
      });

      expect(result.success).toBe(true);
      expect(result.data.rendered).toBe("Hello Ravi, your goal is ₹50000");
    });

    it("should leave unreplaced variables when values are missing", () => {
      const result = renderPrompt("Hello {{name}}, your goal is ₹{{goal}}", {
        name: "Ravi",
      });

      expect(result.success).toBe(true);
      expect(result.data.rendered).toContain("Ravi");
      expect(result.data.rendered).toContain("{{goal}}");
    });

    it("should return original string when no variables match", () => {
      const result = renderPrompt("No variables here", { name: "test" });
      expect(result.success).toBe(true);
      expect(result.data.rendered).toBe("No variables here");
    });

    it("should fail when template is not a string", () => {
      const result = renderPrompt(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("template string is required");
    });
  });
});
