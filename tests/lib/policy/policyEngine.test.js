/**
 * Policy Engine Tests — Unit tests for database-driven policy management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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
  createPolicy,
  getPolicyByKey,
  getPolicies,
  updatePolicyValue,
  evaluatePolicy,
  getActivePolicies,
  initializeDefaultPolicies,
  POLICY_CATEGORIES,
  POLICY_TYPES,
} from "../../../lib/policy/policyEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("PolicyEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPolicy", () => {
    it("should create a policy", async () => {
      const mockPolicy = {
        id: "policy-1",
        policy_key: "min_trust_score",
        name: "Minimum Trust Score",
        category: "verification",
        policy_type: "threshold",
        value: 30,
        is_active: true,
        version: 1,
      };

      // createPolicy first checks for duplicate (.from("policies").select("id").eq().single()),
      // then inserts (.from("policies").insert({...}).select().single())
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockPolicy, error: null }),
            }),
          }),
        });

      const result = await createPolicy({
        policyKey: "min_trust_score",
        name: "Minimum Trust Score",
        category: "verification",
        policyType: "threshold",
        value: 30,
      });

      expect(result.success).toBe(true);
    });

    it("should validate required fields", async () => {
      const result = await createPolicy({ policyKey: "test" });
      expect(result.success).toBe(false);
    });
  });

  describe("getPolicyByKey", () => {
    it("should fetch a policy by key", async () => {
      const mockPolicy = {
        id: "policy-1",
        policy_key: "min_trust_score",
        name: "Minimum Trust Score",
        value: 30,
        policy_type: "threshold",
        is_active: true,
        version: 1,
      };

      // getPolicyByKey uses: .from("policies").select("*").eq("policy_key", policyKey).single()
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: mockPolicy, error: null }),
          }),
        }),
      });

      const result = await getPolicyByKey("min_trust_score");
      expect(result.success).toBe(true);
      expect(result.data.policy_key).toBe("min_trust_score");
    });
  });

  describe("updatePolicyValue", () => {
    it("should update policy value and create version", async () => {
      const mockPolicy = {
        id: "policy-1",
        version: 1,
        policy_key: "min_trust_score",
        policy_type: "threshold",
        value: 30,
        min_value: null,
        max_value: null,
        allowed_values: null,
      };
      const mockUpdated = { ...mockPolicy, version: 2, value: 40 };

      // Source: 3 supabaseAdmin.from() calls in order:
      // 1. Fetch current policy: .from("policies").select("*").eq("id", policyId).single()
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockPolicy, error: null }),
            }),
          }),
        })
        // 2. Insert version history: .from("policy_versions").insert({...})
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValue({ error: null }),
        })
        // 3. Update policy: .from("policies").update({...}).eq("id", policyId).select().single()
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockUpdated, error: null }),
              }),
            }),
          }),
        });

      const result = await updatePolicyValue(
        "policy-1",
        40,
        "Increased threshold",
        "admin-1",
      );
      expect(result.success).toBe(true);
      expect(result.data.version).toBe(2);
    });
  });

  describe("evaluatePolicy", () => {
    it("should evaluate a threshold policy", async () => {
      const mockPolicy = {
        id: "policy-1",
        policy_key: "min_trust_score",
        policy_type: "threshold",
        value: 30,
        is_active: true,
        default_value: 30,
      };

      // evaluatePolicy calls getPolicyByKey internally which uses:
      // .from("policies").select("*").eq("policy_key", policyKey).single()
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: mockPolicy, error: null }),
          }),
        }),
      });

      const result = await evaluatePolicy("min_trust_score", { value: 20 });
      expect(result.success).toBe(true);
      expect(result.allowed).toBe(true); // 20 < 30 → allowed
    });

    it("should return not allowed when value exceeds threshold", async () => {
      const mockPolicy = {
        id: "policy-1",
        policy_key: "min_trust_score",
        policy_type: "threshold",
        value: 30,
        is_active: true,
        default_value: 30,
      };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: mockPolicy, error: null }),
          }),
        }),
      });

      const result = await evaluatePolicy("min_trust_score", { value: 50 });
      expect(result.success).toBe(true);
      expect(result.allowed).toBe(false); // 50 >= 30 → not allowed
    });

    it("should return error for missing policy", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "not found" },
            }),
          }),
        }),
      });

      const result = await evaluatePolicy("nonexistent", {});
      expect(result.success).toBe(false);
    });
  });

  describe("constants", () => {
    it("should have valid categories", () => {
      expect(POLICY_CATEGORIES).toContain("verification");
      expect(POLICY_CATEGORIES).toContain("fraud");
    });

    it("should have valid types", () => {
      expect(POLICY_TYPES).toContain("threshold");
      expect(POLICY_TYPES).toContain("boolean");
    });
  });
});
