/**
 * Release Engine Tests — Unit tests for fund release logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

vi.mock("../../../lib/escrow/escrowLedger", () => ({
  createLedgerEntry: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../../lib/escrow/escrowEvents", () => ({
  recordEscrowEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import { releaseFunds, emergencyFreeze, emergencyCancel } from "../../../lib/escrow/releaseEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("ReleaseEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("releaseFunds", () => {
    it("should release funds successfully", async () => {
      const mockAccount = {
        id: "escrow-1",
        campaign_id: "campaign-1",
        locked_balance: 1000,
        released_balance: 0,
        creator_earnings: 0,
        fee_percentage: 5,
        status: "active",
      };

      // 1. Fetch account: select * eq id is deleted_at single
      // 2. Update account: update {balances} eq id eq status select single
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAccount, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...mockAccount, locked_balance: 500 }, error: null }),
                }),
              }),
            }),
          }),
        });

      const result = await releaseFunds({
        escrowAccountId: "escrow-1",
        amount: 500,
        reason: "Milestone completed",
        releasedBy: "admin-1",
        milestoneId: "milestone-1",
      });

      expect(result.success).toBe(true);
    });

    it("should reject release on frozen account", async () => {
      const mockAccount = {
        id: "escrow-1",
        locked_balance: 1000,
        status: "frozen",
      };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAccount, error: null }),
            }),
          }),
        }),
      });

      const result = await releaseFunds({
        escrowAccountId: "escrow-1",
        amount: 500,
        reason: "Test",
        releasedBy: "admin-1",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("emergencyFreeze", () => {
    it("should freeze escrow account", async () => {
      const mockAccount = { id: "escrow-1", status: "active", campaign_id: "campaign-1" };

      // 1. Fetch: select * eq id is deleted_at single
      // 2. Update: update {status: frozen} eq id eq status select single
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAccount, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...mockAccount, status: "frozen" }, error: null }),
                }),
              }),
            }),
          }),
        });

      const result = await emergencyFreeze("escrow-1", "Fraud detected", "admin-1");
      expect(result.success).toBe(true);
    });
  });

  describe("emergencyCancel", () => {
    it("should cancel and refund escrow", async () => {
      const mockAccount = {
        id: "escrow-1",
        locked_balance: 1000,
        refunded_balance: 0,
        status: "active",
        campaign_id: "campaign-1",
      };

      // 1. Fetch: select * eq id is deleted_at single
      // 2. Update: update {status: cancelled} eq id eq status select single
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAccount, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { ...mockAccount, status: "cancelled" }, error: null }),
                }),
              }),
            }),
          }),
        });

      const result = await emergencyCancel("escrow-1", "Campaign cancelled", "admin-1");
      expect(result.success).toBe(true);
    });
  });
});
