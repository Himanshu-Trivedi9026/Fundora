/**
 * Escrow Account Tests — Unit tests for escrow account CRUD.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin before imports
vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
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
  hashIP: vi.fn().mockReturnValue("hashed-ip"),
}));

import {
  createEscrowAccount,
  getEscrowAccountByCampaign,
  freezeEscrowAccount,
} from "../../../lib/escrow/escrowAccount";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("EscrowAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createEscrowAccount", () => {
    it("should create escrow account with correct defaults", async () => {
      const mockAccount = {
        id: "escrow-1",
        campaign_id: "campaign-1",
        creator_id: "user-1",
        status: "created",
        locked_balance: 0,
        fee_percentage: 5.0,
      };

      // First call: check for existing account (returns null)
      // Second call: insert new account
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockAccount, error: null }),
            }),
          }),
        });

      const result = await createEscrowAccount({
        campaignId: "campaign-1",
        creatorId: "user-1",
        feePercentage: 5.0,
      });

      expect(result.success).toBe(true);
      expect(result.account.status).toBe("created");
      expect(result.account.fee_percentage).toBe(5.0);
    });

    it("should fail if campaignId is missing", async () => {
      const result = await createEscrowAccount({
        creatorId: "user-1",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getEscrowAccountByCampaign", () => {
    it("should return account when found", async () => {
      const mockAccount = {
        id: "escrow-1",
        campaign_id: "campaign-1",
        status: "active",
      };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockAccount, error: null }),
            }),
          }),
        }),
      });

      const result = await getEscrowAccountByCampaign("campaign-1");
      expect(result.success).toBe(true);
      expect(result.account.id).toBe("escrow-1");
    });

    it("should return not found when no account exists", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
            }),
          }),
        }),
      });

      const result = await getEscrowAccountByCampaign("nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("freezeEscrowAccount", () => {
    it("should freeze account with reason", async () => {
      const mockAccount = { id: "escrow-1", status: "active" };

      // First: fetch current account (select * eq id is deleted_at single)
      // Second: update status (update eq id eq status select single)
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockAccount, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...mockAccount, status: "frozen" },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        });

      const result = await freezeEscrowAccount(
        "escrow-1",
        "Fraud detected",
        "admin-1",
      );
      expect(result.success).toBe(true);
    });
  });
});
