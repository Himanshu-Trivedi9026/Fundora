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

// The route re-fetches the payment + order from Razorpay server-side so the
// recorded amount / project binding can't be forged by the client.
const mockPaymentFetch = vi.hoisted(() => vi.fn());
const mockOrderFetch = vi.hoisted(() => vi.fn());

vi.mock("razorpay", () => ({
  default: class MockRazorpay {
    constructor() {
      this.payments = { fetch: mockPaymentFetch };
      this.orders = { fetch: mockOrderFetch };
    }
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

// Mock the notification engine so the donation → owner notification can be
// asserted without hitting the real (mocked) supabaseAdmin chain.
const mockSendNotification = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));
vi.mock("@/lib/notification", () => ({
  sendNotification: mockSendNotification,
  NOTIFICATION_TYPES: {
    DONATION_RECEIVED: "donation_received",
    CAMPAIGN_PUBLISHED: "campaign_published",
    CAMPAIGN_APPROVED: "campaign_approved",
    NEW_MESSAGE: "new_message",
    NEW_FOLLOWER: "new_follower",
    SYSTEM_ALERT: "system_alert",
  },
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
  const mockIdempotencyMaybeSingle = vi.fn();
  const mockProjectSingle = vi.fn();
  const mockVerificationMaybeSingle = vi.fn();
  const mockConfigMaybeSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret");
    // Reset timingSafeEqual to return true by default
    crypto.timingSafeEqual.mockReturnValue(true);

    // Default server-side re-verification response (payment bound to order,
    // order bound to project + payer).
    mockPaymentFetch.mockResolvedValue({
      id: "pay_123",
      order_id: "order_123",
      amount: 50000,
    });
    mockOrderFetch.mockResolvedValue({
      id: "order_123",
      notes: { project_id: "proj-1", payer_id: "test-user-id" },
    });

    // Default mock chain setup. The route makes 5 DB calls in order:
    //   1. public_donations idempotency check  -> maybeSingle (no existing)
    //   2. projects lookup                     -> single
    //   3. creator_verifications lookup        -> maybeSingle (owner approved)
    //   4. creator_payment_configs lookup      -> maybeSingle
    //   5. public_donations insert             -> insert(...).select().single()
    // mockReset() clears leftover queued chains from tests that short-circuit
    // (403 gate tests consume only 3 chains) so ordering stays aligned.
    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockIdempotencyMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      });

    mockIdempotencyMaybeSingle.mockResolvedValue({ data: null, error: null });
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
        eq: vi.fn().mockReturnValue({ maybeSingle: mockIdempotencyMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
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

    mockIdempotencyMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-1", owner_id: "owner-1" },
      error: null,
    });
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
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
        eq: vi.fn().mockReturnValue({ maybeSingle: mockIdempotencyMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      })
      .mockReturnValueOnce({
        insert: mockInsertFn,
      });

    mockIdempotencyMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-2", owner_id: "owner-2" },
      error: null,
    });
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
      error: null,
    });
    mockConfigMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Server-side re-verification for this payment/order/project.
    mockPaymentFetch.mockResolvedValue({
      id: "pay_456",
      order_id: "order_456",
      amount: 100000, // ₹1000 (paise)
    });
    mockOrderFetch.mockResolvedValue({
      id: "order_456",
      notes: { project_id: "proj-2", payer_id: "test-user-id" },
    });

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
    // Funding is incremented by the DB trigger on public_donations INSERT.
    // The handler must NOT call the RPC too, or the donation would double-count.
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });

  it("notifies the project owner when a donation is verified", async () => {
    const mockInsertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "donation-notif" },
          error: null,
        }),
      }),
    });

    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockIdempotencyMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockConfigMaybeSingle }),
      })
      .mockReturnValueOnce({
        insert: mockInsertFn,
      });

    mockIdempotencyMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-3", owner_id: "owner-3" },
      error: null,
    });
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
      error: null,
    });
    mockConfigMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSendNotification.mockResolvedValue({ success: true });

    // Server-side re-verification for this payment/order/project.
    mockPaymentFetch.mockResolvedValue({
      id: "pay_notif_1",
      order_id: "order_notif_1",
      amount: 25000, // ₹250 (paise)
    });
    mockOrderFetch.mockResolvedValue({
      id: "order_notif_1",
      notes: { project_id: "proj-3", payer_id: "test-user-id" },
    });

    const req = createReq("POST", {
      razorpay_payment_id: "pay_notif_1",
      razorpay_order_id: "order_notif_1",
      razorpay_signature: "a".repeat(64),
      projectId: "proj-3",
      amount: 250,
    });
    const res = createRes();

    await handler(req, res);

    // Fire-and-forget: give the notification call a microtask to resolve.
    await new Promise((r) => setTimeout(r, 0));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockSendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "owner-3",
        notificationType: "donation_received",
        actorId: "test-user-id",
        entityId: "proj-3",
      })
    );
  });


  it("returns 500 on database error", async () => {
    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockIdempotencyMaybeSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ single: mockProjectSingle }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
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

    mockIdempotencyMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockProjectSingle.mockResolvedValue({
      data: { id: "proj-3", owner_id: "owner-3" },
      error: null,
    });
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
      error: null,
    });
    mockConfigMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Server-side re-verification must succeed before the DB insert error path.
    mockPaymentFetch.mockResolvedValue({
      id: "pay_789",
      order_id: "order_789",
      amount: 20000, // ₹200 (paise)
    });
    mockOrderFetch.mockResolvedValue({
      id: "order_789",
      notes: { project_id: "proj-3", payer_id: "test-user-id" },
    });

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

  it("returns 403 when the project owner is not verified", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: { verification_status: "pending" },
      error: null,
    });

    const req = createReq("POST", {
      razorpay_payment_id: "pay_403",
      razorpay_order_id: "order_403",
      razorpay_signature: "a".repeat(64),
      projectId: "proj-1",
      amount: 500,
    });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "VerificationRequired" });
    // The donation insert must never run for an unverified owner.
    expect(supabaseAdmin.insert).not.toHaveBeenCalled();
  });

  it("returns 403 when the owner verification lookup errors (fail-closed)", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "db down" },
    });

    const req = createReq("POST", {
      razorpay_payment_id: "pay_failclosed",
      razorpay_order_id: "order_failclosed",
      razorpay_signature: "a".repeat(64),
      projectId: "proj-1",
      amount: 500,
    });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "VerificationRequired" });
  });
});
