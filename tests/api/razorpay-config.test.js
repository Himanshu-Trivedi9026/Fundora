import { vi } from "vitest";

// ---- Mocks ----
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      upsert: mockUpsert,
    })),
  },
}));

vi.mock("@/lib/withAuth", () => ({
  withAuth: (handler) => (req, res) => {
    req.user = { id: "test-user-123", email: "test@example.com" };
    return handler(req, res, req.user);
  },
}));

import handler from "@/pages/api/creator/razorpay-config";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function createMockReq(method = "GET", body = {}) {
  return {
    method,
    body,
    headers: { authorization: "Bearer test-token" },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockImplementation((data) => {
      res.body = data;
      return res;
    }),
  };
  return res;
}

describe("GET/POST /api/creator/razorpay-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ data: null, error: null });
  });

  // ---- GET ----
  it("GET returns configured: false when no config exists", async () => {
    const req = createMockReq("GET");
    const res = createMockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      configured: false,
      keyId: "",
    });
  });

  it("GET returns configured: true when config exists", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { razorpay_key_id: "rzp_live_test123" },
      error: null,
    });

    const req = createMockReq("GET");
    const res = createMockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      configured: true,
      keyId: "rzp_live_test123",
    });
  });

  it("GET returns 500 on database error", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "db error" },
    });

    const req = createMockReq("GET");
    const res = createMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to load Razorpay config" });
  });

  // ---- POST ----
  it("POST saves config with keyId and keySecret", async () => {
    const req = createMockReq("POST", { keyId: "rzp_test_abc", keySecret: "secret_123" });
    const res = createMockRes();
    await handler(req, res);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_user_id: "test-user-123",
        razorpay_key_id: "rzp_test_abc",
        razorpay_key_secret: "secret_123",
      }),
      { onConflict: "creator_user_id" }
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("POST returns 400 when keyId is missing", async () => {
    const req = createMockReq("POST", { keySecret: "secret_123" });
    const res = createMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "keyId and keySecret are required" });
  });

  it("POST returns 400 when keySecret is missing", async () => {
    const req = createMockReq("POST", { keyId: "rzp_test_abc" });
    const res = createMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("POST returns 400 when both are missing", async () => {
    const req = createMockReq("POST", {});
    const res = createMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("POST returns 500 on database error", async () => {
    mockUpsert.mockResolvedValue({ data: null, error: { message: "db error" } });

    const req = createMockReq("POST", { keyId: "rzp_test", keySecret: "secret" });
    const res = createMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to save Razorpay config" });
  });

  // ---- METHOD ----
  it("returns 405 for DELETE method", async () => {
    const req = createMockReq("DELETE");
    const res = createMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns 405 for PATCH method", async () => {
    const req = createMockReq("PATCH");
    const res = createMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });
});
