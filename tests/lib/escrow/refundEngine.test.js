/**
 * Refund Engine Tests — Unit tests for refund processing.
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

import { processRefund, fullRefund } from "../../../lib/escrow/refundEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("RefundEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processRefund", () => {
    it("should process refund successfully", async () => {
      const mockAccount = {
        id: "escrow-1",
        locked_balance: 1000,
        refunded_balance: 0,
        status: "active",
        campaign_id: "campaign-1",
      };

      // 1. Fetch: select * eq id is deleted_at single
      // 2. Update: update {balances} eq id eq status select single
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

      const result = await processRefund({
        escrowAccountId: "escrow-1",
        amount: 500,
        reason: "Campaign cancelled",
        refundedBy: "admin-1",
      });

      expect(result.success).toBe(true);
    });

    it("should reject refund on cancelled account", async () => {
      const mockAccount = {
        id: "escrow-1",
        locked_balance: 1000,
        status: "cancelled",
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

      const result = await processRefund({
        escrowAccountId: "escrow-1",
        amount: 500,
        reason: "Test",
        refundedBy: "admin-1",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("fullRefund", () => {
    it("should refund entire locked balance", async () => {
      const mockAccount = {
        id: "escrow-1",
        locked_balance: 1000,
        refunded_balance: 0,
        status: "active",
        campaign_id: "campaign-1",
      };

      // 1. Fetch for fullRefund: select * eq id is deleted_at single
      // 2. Fetch for processRefund: select * eq id is deleted_at single
      // 3. Update: update {balances} eq id eq status select single
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
                  single: vi.fn().mockResolvedValue({ data: { ...mockAccount, locked_balance: 0 }, error: null }),
                }),
              }),
            }),
          }),
        });

      const result = await fullRefund({
        escrowAccountId: "escrow-1",
        reason: "Campaign cancelled",
        refundedBy: "admin-1",
      });

      expect(result.success).toBe(true);
    });
  });
});
