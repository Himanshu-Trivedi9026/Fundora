const mockCreateOrder = vi
  .fn()
  .mockResolvedValue({ id: "order_test123", amount: 50000, currency: "INR" });

vi.mock("razorpay", () => ({
  default: vi.fn(function () {
    return { orders: { create: mockCreateOrder } };
  }),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("@/lib/withAuth", () => ({
  withAuth: vi.fn((handler) => {
    return async function (req, res) {
      const user = { id: "test-user-id", email: "test@example.com" };
      return handler(req, res, user);
    };
  }),
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => vi.fn(() => true)),
}));

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import handler from "@/pages/api/razorpay/create-order";

function createReq(method = "POST", body = {}) {
  return { method, body };
}

function createRes() {
  const res = {
    _status: null,
    _body: null,
    status: vi.fn(function (code) {
      res._status = code;
      return res;
    }),
    json: vi.fn(function (body) {
      res._body = body;
      return res;
    }),
  };
  return res;
}

describe("POST /api/razorpay/create-order", () => {
  const mockProjectSingle = vi.fn();
  const mockVerificationMaybeSingle = vi.fn();
  const mockConfigMaybeSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOrder.mockResolvedValue({
      id: "order_test123",
      amount: 50000,
      currency: "INR",
    });
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "rzp_test_secret");

    // Default: project found, owner verified, no creator config.
    // Chain order: projects → creator_verifications → creator_payment_configs.
    // mockReset() clears leftover queued chains from tests that short-circuit
    // (403 gate tests consume only 2 chains) so ordering stays aligned.
    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi
          .fn()
          .mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      });

    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-1", owner_id: "owner-1" },
      error: null,
    });
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
      error: null,
    });
    mockConfigMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 405 for non-POST methods", async () => {
    const req = createReq("GET");
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns 400 for missing amount", async () => {
    const req = createReq("POST", { projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid amount" });
  });

  it("returns 400 for negative amount", async () => {
    const req = createReq("POST", { amount: -100, projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid amount" });
  });

  it("returns 400 for zero amount", async () => {
    const req = createReq("POST", { amount: 0, projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid amount" });
  });

  it("returns 400 for non-numeric string amount", async () => {
    const req = createReq("POST", { amount: "abc", projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid amount" });
  });

  it("returns 400 for Infinity amount", async () => {
    const req = createReq("POST", { amount: Infinity, projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid amount" });
  });

  it("returns 400 for missing projectId", async () => {
    const req = createReq("POST", { amount: 100 });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "projectId is required" });
  });

  it("returns 200 with orderId on success", async () => {
    const req = createReq("POST", { amount: 500, projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      id: "order_test123",
      orderId: "order_test123",
      amount: 50000,
      currency: "INR",
      key: "rzp_test_key",
    });
  });

  it("returns 500 when payment not configured", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi
          .fn()
          .mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      });
    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-1", owner_id: "owner-1" },
      error: null,
    });
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
      error: null,
    });
    mockConfigMaybeSingle.mockResolvedValue({ data: null, error: null });

    const req = createReq("POST", { amount: 500, projectId: "proj-1" });
    const res = createRes();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Payment system not configured",
    });
    consoleSpy.mockRestore();
  });

  it("uses creator config when available", async () => {
    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi
          .fn()
          .mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      });

    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-2", owner_id: "owner-2" },
      error: null,
    });
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
      error: null,
    });
    mockConfigMaybeSingle.mockResolvedValue({
      data: {
        razorpay_key_id: "rzp_custom_key",
        razorpay_key_secret: "rzp_custom_secret",
      },
      error: null,
    });

    const req = createReq("POST", { amount: 200, projectId: "proj-2" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      id: "order_test123",
      orderId: "order_test123",
      amount: 50000,
      currency: "INR",
      key: "rzp_custom_key",
    });
  });

  it("converts amount to paise correctly", async () => {
    const req = createReq("POST", { amount: 10.5, projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(mockCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1050, currency: "INR" }),
    );
  });

  it("returns 403 when the project owner is not verified", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: { verification_status: "pending" },
      error: null,
    });

    const req = createReq("POST", { amount: 500, projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "VerificationRequired" });
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("returns 403 when the owner verification row is missing", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const req = createReq("POST", { amount: 500, projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "VerificationRequired" });
  });

  it("returns 403 when the owner verification lookup errors (fail-closed)", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "db down" },
    });

    const req = createReq("POST", { amount: 500, projectId: "proj-1" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "VerificationRequired" });
  });
});
