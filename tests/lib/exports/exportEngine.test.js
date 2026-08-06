// Tests — Data Export Engine

import {
  exportData,
  createExportTemplate,
  getSupportedFormats,
} from "../../../lib/exports/exportEngine.js";

// Mock supabaseAdmin
vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn() })),
      })),
      select: vi.fn(() => ({
        limit: vi.fn(),
      })),
      order: vi.fn(() => ({
        range: vi.fn(),
      })),
    })),
  },
}));

describe("Data Export Engine", () => {
  describe("exportData", () => {
    it("rejects unsupported format", async () => {
      const result = await exportData({ format: "xml", source: "campaigns" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported format");
    });
  });

  describe("createExportTemplate", () => {
    it("attempts to create a template", async () => {
      const result = await createExportTemplate({
        name: "Test Template",
        source: "campaigns",
        format: "csv",
        createdBy: "user-1",
      });
      expect(result.success).toBe(false); // DB mock won't insert
    });
  });

  describe("getSupportedFormats", () => {
    it("returns all supported formats", () => {
      const formats = getSupportedFormats();
      expect(formats).toContain("csv");
      expect(formats).toContain("excel");
      expect(formats).toContain("json");
      expect(formats).toContain("pdf");
      expect(formats.length).toBe(4);
    });
  });
});
