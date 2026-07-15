import { vi } from "vitest";

// ---- Hoisted mocks for vi.mock factories ----
const mockSelect = vi.hoisted(() => vi.fn().mockReturnThis());
const mockEq = vi.hoisted(() => vi.fn().mockReturnThis());
const mockMaybeSingle = vi.hoisted(() => vi.fn().mockResolvedValue({ data: null, error: null }));
const mockInsert = vi.hoisted(() => vi.fn().mockResolvedValue({ data: null, error: null }));
const mockRpc = vi.hoisted(() => vi.fn().mockResolvedValue({ data: null, error: null }));
const mockTimingSafeEqual = vi.hoisted(() => vi.fn().mockReturnValue(true));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      insert: mockInsert,
    })),
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
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockTimingSafeEqual.mockReturnValue(true);
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

    const event = { event: "payment.captured", payload: { payment: { entity: { id: "pay_1", notes: { projectId: "proj-1" }, amount: 10000, email: "a@b.com" } } } };
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

  it("processes payment.captured — inserts donation and increments funding", async () => {
    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_test123",
            notes: { projectId: "proj-abc" },
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
      payer_email: "donor@test.com",
      payment_id: "pay_test123",
      status: "success",
    });
    expect(mockRpc).toHaveBeenCalledWith("increment_project_funding", {
      project_id: "proj-abc",
      amount: 500,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("skips insert for duplicate donation (idempotency)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "existing-donation" }, error: null });

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

  it("skips processing when projectId is missing from notes", async () => {
    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_noid",
            notes: {},
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
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("returns 500 on insert error", async () => {
    mockInsert.mockResolvedValue({ data: null, error: { message: "insert failed" } });

    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_err",
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

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Donation insert failed" });
  });

  it("returns 500 on RPC error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rpcerr",
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

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Funding update failed" });
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
