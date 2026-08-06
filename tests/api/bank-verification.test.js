import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies
vi.mock("../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock("../../lib/withAuth", () => ({
  withAuth: (fn) => fn,
}));

vi.mock("../../lib/rateLimit", () => ({
  rateLimit: () => () => true,
}));

vi.mock("../../lib/verification/bankVerification", () => ({
  createBankAccount: vi.fn().mockResolvedValue({ success: true, data: { id: "123" } }),
  updateBankAccount: vi.fn().mockResolvedValue({ success: true, data: { id: "123" } }),
  deleteBankAccount: vi.fn().mockResolvedValue({ success: true }),
  getBankAccounts: vi.fn().mockResolvedValue({ success: true, data: [] }),
  uploadBankDocument: vi.fn().mockResolvedValue({ success: true, data: { path: "masked" } }),
}));

describe("API — Bank Verification", () => {
  let handler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../pages/api/verification/bank.js");
    handler = mod.default;
  });

  function mockReq(method = "GET", body = {}, query = {}) {
    return { method, body, query, headers: {} };
  }

  function mockRes() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  }

  it("rejects non-allowed methods", async () => {
    const res = mockRes();
    await handler(mockReq("PATCH"), res, { id: "user1" });
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("GET returns bank accounts", async () => {
    const res = mockRes();
    await handler(mockReq("GET"), res, { id: "user1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("POST creates bank account", async () => {
    const res = mockRes();
    await handler(mockReq("POST", {
      accountHolderName: "John",
      accountNumber: "1234567890",
      ifscCode: "HDFC0123456",
    }), res, { id: "user1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("PUT updates bank account", async () => {
    const res = mockRes();
    await handler(mockReq("PUT", { accountId: "acc1", updates: { bankName: "SBI" } }), res, { id: "user1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("DELETE soft deletes bank account", async () => {
    const res = mockRes();
    await handler(mockReq("DELETE", { accountId: "acc1" }), res, { id: "user1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
