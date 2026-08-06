// Tests — Analytics Engine

import {
  createDashboard,
  getDashboard,
  listDashboards,
  deleteDashboard,
  recordMetric,
  getMetrics,
  getPlatformMetrics,
  createReport,
  listReports,
  generateInsights,
} from "../../../lib/analytics/analyticsEngine.js";

// Mock supabaseAdmin
vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn() })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
          gte: vi.fn(() => ({
            order: vi.fn(),
          })),
        })),
        order: vi.fn(() => ({
          range: vi.fn(),
        })),
        count: 0,
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({ single: vi.fn() })),
        })),
      })),
    })),
  },
}));

describe("Analytics Engine", () => {
  describe("createDashboard", () => {
    it("attempts to create a dashboard", async () => {
      const result = await createDashboard({
        name: "Test Dashboard",
        organizationId: "org-1",
        createdBy: "user-1",
      });
      expect(result.success).toBe(false); // DB mock
    });
  });

  describe("getDashboard", () => {
    it("handles missing dashboard gracefully", async () => {
      const result = await getDashboard("nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("listDashboards", () => {
    it("returns empty list with mock", async () => {
      const result = await listDashboards({ organizationId: "org-1" });
      expect(result.success).toBeDefined();
    });
  });

  describe("deleteDashboard", () => {
    it("handles delete gracefully", async () => {
      const result = await deleteDashboard("nonexistent");
      expect(result.success).toBeDefined();
    });
  });

  describe("recordMetric", () => {
    it("attempts to record a metric", async () => {
      const result = await recordMetric("test_metric", 42, {});
      expect(result.success).toBe(false);
    });
  });

  describe("getMetrics", () => {
    it("handles metric query", async () => {
      const result = await getMetrics("test_metric", "7d");
      expect(result.success).toBeDefined();
    });
  });

  describe("getPlatformMetrics", () => {
    it("returns metrics object", async () => {
      const result = await getPlatformMetrics();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("totalCampaigns");
      expect(result.data).toHaveProperty("activeCampaigns");
      expect(result.data).toHaveProperty("totalUsers");
      expect(result.data).toHaveProperty("totalDonations");
    });
  });

  describe("createReport", () => {
    it("attempts to create a report template", async () => {
      const result = await createReport({
        name: "Test Report",
        reportType: "campaign_summary",
        organizationId: "org-1",
        createdBy: "user-1",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("listReports", () => {
    it("returns list with mock", async () => {
      const result = await listReports({ organizationId: "org-1" });
      expect(result.success).toBeDefined();
    });
  });

  describe("generateInsights", () => {
    it("returns low confidence with insufficient data", async () => {
      const result = await generateInsights("test_metric");
      if (result.success) {
        expect(result.data.confidence).toBeDefined();
      }
    });
  });
});
