import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (must be before imports) ───

const mockFrom = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
}));

vi.mock("../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock("../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

const mockProvider = {
  submitVerification: vi.fn().mockResolvedValue({ referenceId: "test_ref_123", status: "initiated" }),
  checkStatus: vi.fn().mockResolvedValue({ status: "success" }),
  handleWebhook: vi.fn().mockResolvedValue({ status: "success" }),
  mapStatus: vi.fn((s) => s),
};

vi.mock("../../lib/verification/provider", () => ({
  getProvider: vi.fn(() => mockProvider),
}));

import {
  initiatePennyDrop,
  checkPennyDropStatus,
  handlePennyDropWebhook,
  getPennyDropHistory,
} from "../../lib/verification/pennyDrop";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { logAuditEvent } from "../../lib/verification/auditLog";
import { logInfo, logError } from "../../lib/verification/secureLogger";
import { getProvider } from "../../lib/verification/provider";

// ─── Helpers ───

function setupMockChain(data = null, error = null) {
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockNeq = vi.fn().mockReturnThis();
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data, error });
  const mockUpdate = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();

  supabaseAdmin.from.mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    neq: mockNeq,
    maybeSingle: mockMaybeSingle,
    single: vi.fn().mockResolvedValue({ data, error }),
    update: mockUpdate,
    insert: mockInsert,
    order: mockOrder,
    limit: vi.fn().mockReturnThis(),
  });

  return { mockSelect, mockEq, mockNeq, mockMaybeSingle, mockUpdate, mockInsert, mockOrder };
}

// ─── Tests ───

describe("Penny Drop Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider.submitVerification.mockResolvedValue({ referenceId: "test_ref_123", status: "initiated" });
    mockProvider.checkStatus.mockResolvedValue({ status: "success" });
    mockProvider.handleWebhook.mockResolvedValue({ status: "success" });
    mockProvider.mapStatus.mockImplementation((s) => s);
  });

  // ─── initiatePennyDrop ───
  describe("initiatePennyDrop", () => {
    it("returns error when userId is missing", async () => {
      const result = await initiatePennyDrop(null, "account-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing required parameters");
    });

    it("returns error when accountId is missing", async () => {
      const result = await initiatePennyDrop("user-123", null);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing required parameters");
    });

    it("returns error when both params are empty", async () => {
      const result = await initiatePennyDrop("", "");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing required parameters");
    });

    it("returns error when account is not found", async () => {
      setupMockChain(null, null);
      const result = await initiatePennyDrop("user-123", "account-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Bank account not found");
    });

    it("returns error when account is archived", async () => {
      setupMockChain({
        id: "account-123",
        user_id: "user-123",
        status: "archived",
        account_holder_name: "John",
        ifsc_code: "HDFC0123456",
      });
      const result = await initiatePennyDrop("user-123", "account-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Cannot verify archived account");
    });

    it("successfully initiates penny drop for a valid account", async () => {
      setupMockChain({
        id: "account-123",
        user_id: "user-123",
        status: "draft",
        account_holder_name: "John Doe",
        ifsc_code: "HDFC0123456",
      });

      const result = await initiatePennyDrop("user-123", "account-123");

      expect(result.success).toBe(true);
      expect(result.referenceId).toBe("test_ref_123");
      expect(mockProvider.submitVerification).toHaveBeenCalledWith({
        userId: "user-123",
        accountId: "account-123",
        accountHolderName: "John Doe",
        ifscCode: "HDFC0123456",
      });
    });

    it("calls logAuditEvent with correct details on success", async () => {
      setupMockChain({
        id: "account-123",
        user_id: "user-123",
        status: "draft",
        account_holder_name: "John",
        ifsc_code: "HDFC0123456",
      });

      await initiatePennyDrop("user-123", "account-123");

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "penny_drop.initiated",
          entityType: "bank_account",
          entityId: "account-123",
          userId: "user-123",
        })
      );
    });

    it("calls logInfo on successful initiation", async () => {
      setupMockChain({
        id: "account-123",
        user_id: "user-123",
        status: "draft",
        account_holder_name: "John",
        ifsc_code: "HDFC0123456",
      });

      await initiatePennyDrop("user-123", "account-123");

      expect(logInfo).toHaveBeenCalledWith("PennyDrop", "Penny drop initiated", expect.any(Object));
    });

    it("returns error on provider failure", async () => {
      setupMockChain({
        id: "account-123",
        user_id: "user-123",
        status: "draft",
        account_holder_name: "John",
        ifsc_code: "HDFC0123456",
      });
      mockProvider.submitVerification.mockRejectedValue(new Error("Provider unavailable"));

      const result = await initiatePennyDrop("user-123", "account-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to initiate penny drop");
      expect(logError).toHaveBeenCalled();
    });
  });

  // ─── checkPennyDropStatus ───
  describe("checkPennyDropStatus", () => {
    it("returns error when accountId is missing", async () => {
      const result = await checkPennyDropStatus(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Account ID is required");
    });

    it("returns error when accountId is empty string", async () => {
      const result = await checkPennyDropStatus("");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Account ID is required");
    });

    it("returns error when account is not found", async () => {
      setupMockChain(null, null);
      const result = await checkPennyDropStatus("account-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Bank account not found");
    });

    it("returns error when no provider_reference exists", async () => {
      setupMockChain({
        id: "account-123",
        provider_reference: null,
        verification_provider: "penny_drop_internal",
      });
      const result = await checkPennyDropStatus("account-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("No verification reference found");
    });

    it("successfully checks status and returns mapped status", async () => {
      setupMockChain({
        id: "account-123",
        provider_reference: "ref_123",
        verification_provider: "penny_drop_internal",
      });
      mockProvider.checkStatus.mockResolvedValue({ status: "approved" });
      mockProvider.mapStatus.mockReturnValue("approved");

      const result = await checkPennyDropStatus("account-123");

      expect(result.success).toBe(true);
      expect(result.status).toBe("approved");
      expect(mockProvider.checkStatus).toHaveBeenCalledWith("ref_123");
    });

    it("calls logAuditEvent on successful status check", async () => {
      setupMockChain({
        id: "account-123",
        provider_reference: "ref_123",
        verification_provider: "penny_drop_internal",
      });
      mockProvider.mapStatus.mockReturnValue("success");

      await checkPennyDropStatus("account-123");

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "penny_drop.status_checked",
          entityType: "bank_account",
          entityId: "account-123",
        })
      );
    });

    it("returns error on provider failure", async () => {
      setupMockChain({
        id: "account-123",
        provider_reference: "ref_123",
        verification_provider: "penny_drop_internal",
      });
      mockProvider.checkStatus.mockRejectedValue(new Error("Timeout"));

      const result = await checkPennyDropStatus("account-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to check status");
      expect(logError).toHaveBeenCalled();
    });
  });

  // ─── handlePennyDropWebhook ───
  describe("handlePennyDropWebhook", () => {
    it("returns error when payload is null", async () => {
      const result = await handlePennyDropWebhook(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid payload");
    });

    it("returns error when payload has no referenceId", async () => {
      const result = await handlePennyDropWebhook({ someField: "value" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid payload");
    });

    it("returns error when payload is empty object", async () => {
      const result = await handlePennyDropWebhook({});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid payload");
    });

    it("successfully processes webhook with valid payload", async () => {
      // Setup chain for finding account by provider_reference
      setupMockChain({
        id: "account-456",
        user_id: "user-789",
      });

      const result = await handlePennyDropWebhook({ referenceId: "ref_123" });

      expect(result.success).toBe(true);
      expect(mockProvider.handleWebhook).toHaveBeenCalledWith({ referenceId: "ref_123" });
    });

    it("calls logAuditEvent on successful webhook processing", async () => {
      setupMockChain({
        id: "account-456",
        user_id: "user-789",
      });

      await handlePennyDropWebhook({ referenceId: "ref_123" });

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "penny_drop.completed",
          entityType: "bank_account",
          entityId: "account-456",
          userId: "user-789",
        })
      );
    });

    it("returns success even when account not found by reference", async () => {
      setupMockChain(null, null);
      const result = await handlePennyDropWebhook({ referenceId: "nonexistent_ref" });
      expect(result.success).toBe(true);
    });

    it("returns error on provider failure", async () => {
      mockProvider.handleWebhook.mockRejectedValue(new Error("Provider error"));

      const result = await handlePennyDropWebhook({ referenceId: "ref_123" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Webhook processing failed");
      expect(logError).toHaveBeenCalled();
    });
  });

  // ─── getPennyDropHistory ───
  describe("getPennyDropHistory", () => {
    it("returns error when userId is missing", async () => {
      const result = await getPennyDropHistory(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe("User ID is required");
    });

    it("returns error when userId is empty string", async () => {
      const result = await getPennyDropHistory("");
      expect(result.success).toBe(false);
      expect(result.error).toBe("User ID is required");
    });

    it("returns empty array when no history exists", async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: mockOrder,
      });

      const result = await getPennyDropHistory("user-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns history data when available", async () => {
      const historyData = [
        { id: "acc-1", account_holder_name: "John", status: "verified", penny_drop_status: "success" },
        { id: "acc-2", account_holder_name: "Jane", status: "draft", penny_drop_status: "initiated" },
      ];
      const mockOrder = vi.fn().mockResolvedValue({ data: historyData, error: null });
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: mockOrder,
      });

      const result = await getPennyDropHistory("user-123");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe("acc-1");
    });

    it("returns error on database failure", async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: mockOrder,
      });

      const result = await getPennyDropHistory("user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get history");
      expect(logError).toHaveBeenCalled();
    });

    it("returns error on unexpected exception", async () => {
      supabaseAdmin.from.mockImplementation(() => {
        throw new Error("Unexpected");
      });

      const result = await getPennyDropHistory("user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get history");
    });
  });
});
