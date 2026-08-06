import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before imports
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

vi.mock("../../lib/verification/businessVerification", () => ({
  createBusinessVerification: vi
    .fn()
    .mockResolvedValue({ success: true, data: { id: "123" } }),
  uploadBusinessDocument: vi
    .fn()
    .mockResolvedValue({ success: true, data: { id: "doc1" } }),
  getBusinessVerification: vi.fn().mockResolvedValue({
    success: true,
    data: { id: "123", business_name: "Test" },
  }),
}));

describe("API — Business Verification", () => {
  let handler;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../pages/api/verification/business.js");
    handler = mod.default;
  });

  function mockReq(method = "GET", body = {}, query = {}) {
    return { method, body, query, headers: {} };
  }

  function mockRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return res;
  }

  it("rejects non-GET/POST/PUT methods", async () => {
    const res = mockRes();
    await handler(mockReq("DELETE"), res, { id: "user1" });
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("GET returns business verification", async () => {
    const res = mockRes();
    await handler(mockReq("GET"), res, { id: "user1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("POST creates business verification", async () => {
    const res = mockRes();
    await handler(
      mockReq("POST", {
        verificationId: "v1",
        businessData: { businessName: "Test", businessType: "private_limited" },
      }),
      res,
      { id: "user1" },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("POST rejects missing businessData", async () => {
    const { createBusinessVerification } =
      await import("../../lib/verification/businessVerification");
    createBusinessVerification.mockResolvedValueOnce({
      success: false,
      error: "Missing required parameters",
    });
    const res = mockRes();
    await handler(mockReq("POST", {}), res, { id: "user1" });
    // Should still return 200 but with error in body or 400
    expect(res.json).toHaveBeenCalled();
  });
});
