/**
 * Payout Engine Tests — Unit tests for payout management with fraud integration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
  hashIP: vi.fn().mockReturnValue("hashed-ip"),
}));

vi.mock("../../../lib/fraud", () => ({
  evaluateUser: vi.fn().mockResolvedValue({
    success: true,
    result: { decision: { action: "allow" }, riskScore: 25 },
  }),
}));

import {
  createPayoutRequest,
  approvePayout,
} from "../../../lib/payout/payoutEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { evaluateUser } from "../../../lib/fraud";

describe("PayoutEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPayoutRequest", () => {
    it("should create payout request after fraud check", async () => {
      const mockAccount = {
        id: "escrow-1",
        creator_id: "user-1",
        available_balance: 5000,
        locked_balance: 0,
        status: "active",
      };

      const mockRequest = {
        id: "payout-1",
        escrow_account_id: "escrow-1",
        creator_id: "user-1",
        amount: 1000,
        status: "pending",
      };

      // 1. Fetch escrow account: select id, creator_id, available_balance, status eq id single
      // 2. Lock funds: update available_balance, locked_balance eq id eq available_balance
      // 3. Insert payout request: insert {...} select single
      // 4. Insert ledger entry: insert {...}
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockAccount, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockRequest, error: null }),
            }),
          }),
        });

      const result = await createPayoutRequest({
        creatorId: "user-1",
        escrowAccountId: "escrow-1",
        bankAccountId: "bank-1",
        amount: 1000,
      });

      expect(result.success).toBe(true);
      expect(evaluateUser).toHaveBeenCalled();
    });

    it("should reject payout if fraud engine blocks", async () => {
      evaluateUser.mockResolvedValueOnce({
        success: true,
        result: { decision: { action: "block" }, riskScore: 95 },
      });

      const mockAccount = {
        id: "escrow-1",
        creator_id: "user-1",
        available_balance: 5000,
        status: "active",
      };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: mockAccount, error: null }),
          }),
        }),
      });

      const result = await createPayoutRequest({
        creatorId: "user-1",
        escrowAccountId: "escrow-1",
        bankAccountId: "bank-1",
        amount: 1000,
      });

      expect(result.success).toBe(false);
    });

    it("should reject payout if insufficient balance", async () => {
      evaluateUser.mockResolvedValueOnce({
        success: true,
        result: { decision: { action: "allow" }, riskScore: 10 },
      });

      const mockAccount = {
        id: "escrow-1",
        creator_id: "user-1",
        available_balance: 100,
        status: "active",
      };

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: mockAccount, error: null }),
          }),
        }),
      });

      const result = await createPayoutRequest({
        creatorId: "user-1",
        escrowAccountId: "escrow-1",
        bankAccountId: "bank-1",
        amount: 500,
      });

      expect(result.success).toBe(false);
    });
  });

  describe("approvePayout", () => {
    it("should approve pending payout", async () => {
      const mockRequest = {
        id: "payout-1",
        status: "pending",
        amount: 1000,
      };

      // 1. Fetch payout: select * eq id single
      // 2. Update payout: update {status: approved} eq id select single
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: mockRequest, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ...mockRequest, status: "approved" },
                  error: null,
                }),
              }),
            }),
          }),
        });

      const result = await approvePayout("payout-1", "admin-1");
      expect(result.success).toBe(true);
    });
  });
});
