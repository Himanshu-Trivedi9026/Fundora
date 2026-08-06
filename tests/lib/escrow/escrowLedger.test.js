/**
 * Escrow Ledger Tests — Unit tests for immutable ledger operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
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

import { createLedgerEntry, getLedgerEntries, getLedgerBalance, getLedgerSummary } from "../../../lib/escrow/escrowLedger";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("EscrowLedger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLedgerEntry", () => {
    it("should create a donation ledger entry", async () => {
      const mockEntry = {
        id: "ledger-1",
        escrow_account_id: "escrow-1",
        entry_type: "deposit",
        amount: 1000,
        balance_after: 1000,
        description: "Donation received",
      };

      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockEntry, error: null }),
          }),
        }),
      });

      const result = await createLedgerEntry({
        escrowAccountId: "escrow-1",
        campaignId: "campaign-1",
        entryType: "deposit",
        amount: 1000,
        balanceAfter: 1000,
        description: "Donation received",
      });

      expect(result.success).toBe(true);
      expect(result.entry.entry_type).toBe("deposit");
    });

    it("should fail with invalid entry type", async () => {
      const result = await createLedgerEntry({
        escrowAccountId: "escrow-1",
        campaignId: "campaign-1",
        entryType: "invalid_type",
        amount: 1000,
        balanceAfter: 1000,
        description: "Test",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("getLedgerEntries", () => {
    it("should return entries with pagination", async () => {
      const mockEntries = [
        { id: "1", entry_type: "deposit", amount: 1000 },
        { id: "2", entry_type: "fee", amount: -50 },
      ];

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({ data: mockEntries, error: null, count: 2 }),
            }),
          }),
        }),
      });

      const result = await getLedgerEntries({
        escrowAccountId: "escrow-1",
        limit: 50,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(2);
    });
  });

  describe("getLedgerBalance", () => {
    it("should calculate balance from ledger", async () => {
      const mockData = [
        { amount: 1000 },
        { amount: 500 },
        { amount: -75 },
        { amount: -200 },
      ];

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await getLedgerBalance("escrow-1");
      expect(result.success).toBe(true);
      expect(result.balance).toBe(1225);
    });
  });

  describe("getLedgerSummary", () => {
    it("should aggregate by entry type", async () => {
      const mockData = [
        { entry_type: "deposit", amount: 1000 },
        { entry_type: "deposit", amount: 500 },
        { entry_type: "fee", amount: -75 },
      ];

      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      });

      const result = await getLedgerSummary("escrow-1");
      expect(result.success).toBe(true);
      expect(result.summary.totalEntries).toBe(3);
      expect(result.summary.totalDeposits).toBe(1500);
    });
  });
});
