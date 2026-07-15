vi.mock("crypto", () => {
  const mockHmacInstance = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("a".repeat(64)),
  };
  return {
    default: {
      createHmac: vi.fn().mockReturnValue(mockHmacInstance),
      timingSafeEqual: vi.fn().mockReturnValue(true),
    },
    __mockHmacInstance: mockHmacInstance,
  };
});

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn(),
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

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import handler from "@/pages/api/razorpay/verify";

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

describe("POST /api/razorpay/verify", () => {
  const mockProjectSingle = vi.fn();
  const mockConfigMaybeSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret");
    // Reset timingSafeEqual to return true by default
    crypto.timingSafeEqual.mockReturnValue(true);

    // Default mock chain setup: projects query, creator_payment_configs query
    supabaseAdmin.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      });

    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-1", owner_id: "owner-1" },
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

  it("returns 400 for missing razorpay_payment_id", async () => {
    const req = createReq("POST", {
      razorpay_order_id: "order_123",
      razorpay_signature: "sig",
      projectId: "proj-1",
      amount: 500,
    });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "razorpay_payment_id is required" });
  });

  it("returns 400 when all required fields are missing", async () => {
    const req = createReq("POST", {});
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "razorpay_payment_id is required" });
  });

  it("returns 400 for invalid signature", async () => {
    crypto.timingSafeEqual.mockReturnValue(false);

    const req = createReq("POST", {
      razorpay_payment_id: "pay_123",
      razorpay_order_id: "order_123",
      razorpay_signature: "b".repeat(64),
      projectId: "proj-1",
      amount: 500,
    });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid payment signature" });
  });

  it("returns 200 with donationId on valid signature", async () => {
    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "donation-abc" },
              error: null,
            }),
          }),
        }),
      });

    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-1", owner_id: "owner-1" },
      error: null,
    });
    mockConfigMaybeSingle.mockResolvedValue({ data: null, error: null });

    const req = createReq("POST", {
      razorpay_payment_id: "pay_123",
      razorpay_order_id: "order_123",
      razorpay_signature: "a".repeat(64),
      projectId: "proj-1",
      amount: 500,
    });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      donationId: "donation-abc",
    });
  });

  it("inserts donation and calls RPC on success", async () => {
    const mockInsertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "donation-new" },
          error: null,
        }),
      }),
    });

    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      })
      .mockReturnValueOnce({
        insert: mockInsertFn,
      });

    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-2", owner_id: "owner-2" },
      error: null,
    });
    mockConfigMaybeSingle.mockResolvedValue({ data: null, error: null });

    const req = createReq("POST", {
      razorpay_payment_id: "pay_456",
      razorpay_order_id: "order_456",
      razorpay_signature: "a".repeat(64),
      projectId: "proj-2",
      amount: 1000,
    });
    const res = createRes();

    await handler(req, res);

    expect(mockInsertFn).toHaveBeenCalledWith({
      project_id: "proj-2",
      amount: 1000,
      payer_id: "test-user-id",
      razorpay_payment_id: "pay_456",
      razorpay_order_id: "order_456",
      status: "paid",
    });
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("increment_project_funding", {
      project_id: "proj-2",
      amount: 1000,
    });
  });

  it("returns 500 on database error", async () => {
    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      })
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "DB error" },
            }),
          }),
        }),
      });

    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-3", owner_id: "owner-3" },
      error: null,
    });
    mockConfigMaybeSingle.mockResolvedValue({ data: null, error: null });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = createReq("POST", {
      razorpay_payment_id: "pay_789",
      razorpay_order_id: "order_789",
      razorpay_signature: "a".repeat(64),
      projectId: "proj-3",
      amount: 200,
    });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to record donation" });
    consoleSpy.mockRestore();
  });
});
