import { vi } from "vitest";

// ---- Hoisted mocks for vi.mock factories ----
const mockSelect = vi.hoisted(() => vi.fn().mockReturnThis());
const mockEq = vi.hoisted(() => vi.fn().mockReturnThis());
const mockMaybeSingle = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: null, error: null }),
);
// creator_verifications lookup performed by isCreatorVerified — approved by
// default so the normal captured-payment path proceeds.
const mockVerificationMaybeSingle = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    data: { verification_status: "approved" },
    error: null,
  }),
);
// projects owner lookup added by the verification gate (webhook.js).
const mockSingle = vi.hoisted(() =>
  vi
    .fn()
    .mockResolvedValue({ data: { owner_id: "owner-verified" }, error: null }),
);
const mockInsert = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: null, error: null }),
);
const mockUpdate = vi.hoisted(() => vi.fn().mockReturnThis());
const mockRpc = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ data: null, error: null }),
);
const mockTimingSafeEqual = vi.hoisted(() => vi.fn().mockReturnValue(true));
// Server-side order resolution (project binding comes from the ORDER, never
// from client-controllable payment notes).
const mockOrderFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    // Fluent chain, per-table. The route calls, in order:
    //   public_donations idempotency       -> maybeSingle
    //   projects owner lookup              -> single   (verification gate)
    //   creator_verifications status       -> maybeSingle (isCreatorVerified)
    //   public_donations insert / update
    from: vi.fn((table) => {
      const chain = {
        select: mockSelect,
        eq: mockEq,
        maybeSingle:
          table === "creator_verifications"
            ? mockVerificationMaybeSingle
            : mockMaybeSingle,
        single: mockSingle,
        insert: mockInsert,
        update: mockUpdate,
      };
      return chain;
    }),
    rpc: mockRpc,
  },
}));

vi.mock("crypto", async () => {
  const actual = await vi.importActual("crypto");
  return {
    default: {
      ...actual,
      createHmac: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("a".repeat(64)),
      timingSafeEqual: mockTimingSafeEqual,
    },
  };
});

vi.mock("razorpay", () => ({
  default: class MockRazorpay {
    constructor() {
      this.orders = { fetch: mockOrderFetch };
    }
  },
}));

import handler from "@/pages/api/razorpay/webhook";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ---- Helpers ----
function createMockReq(method = "POST", body = "", headers = {}) {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const buffer = Buffer.from(bodyStr, "utf8");
  const stream = {
    [Symbol.asyncIterator]: async function* () {
      yield buffer;
    },
  };
  return Object.assign(stream, {
    method,
    headers: {
      "x-razorpay-signature": "a".repeat(64),
      ...headers,
    },
  });
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
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

// ---- Tests ----
describe("POST /api/razorpay/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: { owner_id: "owner-verified" },
      error: null,
    });
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockTimingSafeEqual.mockReturnValue(true);
    mockOrderFetch.mockResolvedValue({ notes: { project_id: "proj-abc" } });
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "rzp_test_secret");
  });

  it("returns 405 for non-POST methods", async () => {
    const req = createMockReq("GET");
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns 400 for invalid signature", async () => {
    mockTimingSafeEqual.mockReturnValue(false);

    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_1",
            notes: { projectId: "proj-1" },
            amount: 10000,
            email: "a@b.com",
          },
        },
      },
    };
    const req = createMockReq("POST", event);
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid signature" });
  });

  it("returns 400 for invalid JSON payload", async () => {
    const req = createMockReq("POST", "not-json");
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid JSON payload" });
  });

  it("processes payment.captured — inserts donation (funding is incremented by DB trigger)", async () => {
    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test123",
            order_id: "order_test123",
            amount: 50000,
            email: "donor@test.com",
          },
        },
      },
    };
    const req = createMockReq("POST", event);
    const res = createMockRes();
    await handler(req, res);

    expect(supabaseAdmin.from).toHaveBeenCalledWith("public_donations");
    expect(mockInsert).toHaveBeenCalledWith({
      project_id: "proj-abc",
      amount: 500,
      razorpay_payment_id: "pay_test123",
      name: "donor@test.com",
      status: "success",
    });
    // Funding is incremented by the DB trigger on public_donations INSERT.
    // The webhook must NOT call the RPC too, or the donation would double-count.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("skips donation credit when the project owner is not verified", async () => {
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "pending" },
      error: null,
    });

    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_unverified",
            order_id: "order_unverified",
            amount: 50000,
            email: "donor@test.com",
          },
        },
      },
    };
    const req = createMockReq("POST", event);
    const res = createMockRes();
    await handler(req, res);

    // Money is never credited to an unverified owner; return success so
    // Razorpay does not retry. verify.js (authoritative) 403s the frontend.
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      skipped: "creator_not_verified",
    });
  });

  it("skips donation credit when the owner lookup errors or owner is missing (fail-closed)", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "db down" } });

    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_missingowner",
            order_id: "order_missingowner",
            amount: 50000,
            email: "donor@test.com",
          },
        },
      },
    };
    const req = createMockReq("POST", event);
    const res = createMockRes();
    await handler(req, res);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      skipped: "creator_not_verified",
    });
  });

  it("skips insert for duplicate donation (idempotency)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "existing-donation" },
      error: null,
    });

    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_existing",
            notes: { projectId: "proj-1" },
            amount: 10000,
            email: "a@b.com",
          },
        },
      },
    };
    const req = createMockReq("POST", event);
    const res = createMockRes();
    await handler(req, res);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, duplicate: true });
  });

  it("defers to verify.js when the project cannot be resolved from the order", async () => {
    // Order lookup returns no project binding (creator-owned order, or the
    // order can't be fetched with the platform key) → the webhook defers to
    // verify.js rather than guessing the project from client-controllable
    // payment notes.
    mockOrderFetch.mockResolvedValue({ notes: {} });

    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_noid",
            order_id: "order_noid",
            amount: 10000,
            email: "a@b.com",
          },
        },
      },
    };
    const req = createMockReq("POST", event);
    const res = createMockRes();
    await handler(req, res);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, deferred: true });
  });

  it("returns 500 on insert error", async () => {
    mockInsert.mockResolvedValue({
      data: null,
      error: { message: "insert failed" },
    });

    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_err",
            order_id: "order_err",
            amount: 10000,
            email: "a@b.com",
          },
        },
      },
    };
    const req = createMockReq("POST", event);
    const res = createMockRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Donation insert failed" });
  });

  it("handles payment.failed event", async () => {
    const event = {
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_fail" } } },
    };
    const req = createMockReq("POST", event);
    const res = createMockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("handles refund.processed event", async () => {
    const event = {
      event: "refund.processed",
      payload: { refund: { entity: { id: "ref_1" } } },
    };
    const req = createMockReq("POST", event);
    const res = createMockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
