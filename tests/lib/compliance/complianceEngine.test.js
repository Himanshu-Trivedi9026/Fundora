/**
 * Compliance Engine Tests — Unit tests for compliance case management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  createComplianceCase,
  getComplianceCase,
  getComplianceCases,
  updateComplianceCase,
  resolveComplianceCase,
  escalateComplianceCase,
  getComplianceStats,
  COMPLIANCE_CASE_TYPES,
  COMPLIANCE_STATUSES,
} from "../../../lib/compliance/complianceEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("ComplianceEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createComplianceCase", () => {
    it("should create a compliance case", async () => {
      const mockCase = {
        id: "case-1",
        case_number: "COMP-2026-00001",
        case_type: "fraud_report",
        status: "open",
        priority: "medium",
      };

      // 1. Get next sequence: select case_number like order limit
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            like: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        })
        // 2. Insert case: insert({...}).select().single()
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCase, error: null }),
            }),
          }),
        });

      const result = await createComplianceCase({
        caseType: "fraud_report",
        subjectUserId: "user-1",
        priority: "medium",
        description: "Suspicious activity detected",
      });

      expect(result.success).toBe(true);
    });

    it("should validate required fields", async () => {
      const result = await createComplianceCase({});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should validate case type", async () => {
      const result = await createComplianceCase({ caseType: "invalid_type", subjectUserId: "user-1" });
      expect(result.success).toBe(false);
    });
  });

  describe("getComplianceCases", () => {
    it("should list compliance cases", async () => {
      // select("*", { count: "exact" }).order(...).range(...)
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ data: [{ id: "case-1" }], count: 1, error: null }),
          }),
        }),
      });

      const result = await getComplianceCases({ limit: 10, offset: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe("resolveComplianceCase", () => {
    it("should resolve a compliance case", async () => {
      const mockCase = { id: "case-1", status: "investigating", case_number: "COMP-2026-00001" };
      const mockResolved = { ...mockCase, status: "resolved", resolution_type: "dismissed" };

      // 1. Fetch case: select("*").eq("id", caseId).single()
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCase, error: null }),
            }),
          }),
        })
        // 2. Update case: update({...}).eq("id", caseId).select().single()
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockResolved, error: null }),
              }),
            }),
          }),
        });

      const result = await resolveComplianceCase("case-1", "dismissed", "No evidence found", "admin-1");
      expect(result.success).toBe(true);
    });

    it("should require all params", async () => {
      const result = await resolveComplianceCase("case-1", "dismissed", null, "admin-1");
      expect(result.success).toBe(false);
    });
  });

  describe("escalateComplianceCase", () => {
    it("should escalate a compliance case", async () => {
      const mockCase = { id: "case-1", status: "open", priority: "medium", case_number: "COMP-2026-00001" };
      const mockEscalated = { ...mockCase, status: "escalated", priority: "urgent" };

      // 1. Fetch case
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCase, error: null }),
            }),
          }),
        })
        // 2. Update case
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockEscalated, error: null }),
              }),
            }),
          }),
        });

      const result = await escalateComplianceCase("case-1", "Needs higher authority", "admin-1");
      expect(result.success).toBe(true);
    });
  });

  describe("constants", () => {
    it("should have valid case types", () => {
      expect(COMPLIANCE_CASE_TYPES).toContain("fraud_report");
      expect(COMPLIANCE_CASE_TYPES).toContain("kyc_review");
    });

    it("should have valid statuses", () => {
      expect(COMPLIANCE_STATUSES).toContain("open");
      expect(COMPLIANCE_STATUSES).toContain("resolved");
    });
  });
});
