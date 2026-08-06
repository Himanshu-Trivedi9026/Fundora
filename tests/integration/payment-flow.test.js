import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks — must be declared before route imports                      */
/* ------------------------------------------------------------------ */

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-123", email: "test@example.com" } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockReturnValue(Promise.resolve({ data: null, error: null })),
    maybeSingle: vi
      .fn()
      .mockReturnValue(Promise.resolve({ data: null, error: null })),
    rpc: vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null })),
  },
}));

vi.mock("@/lib/withAuth", () => ({
  withAuth: (handler) => (req, res) => {
    req.user = { id: "test-user-123", email: "test@example.com" };
    return handler(req, res, req.user);
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: () => () => true,
}));

vi.mock("razorpay", () => ({
  default: class MockRazorpay {
    constructor() {
      this.orders = {
        create: vi.fn().mockResolvedValue({
          id: "order_test_abc123",
          amount: 50000,
          currency: "INR",
        }),
        // Server-side re-verification: order bound to project + payer.
        fetch: vi.fn().mockResolvedValue({
          id: "order_test_abc123",
          notes: { project_id: "project-456", payer_id: "test-user-123" },
        }),
      };
      this.payments = {
        // Payment bound to the same order, amount ₹500 (paise).
        fetch: vi.fn().mockResolvedValue({
          id: "pay_test_xyz789",
          order_id: "order_test_abc123",
          amount: 50000,
        }),
      };
    }
  },
}));

/* ------------------------------------------------------------------ */
/*  Import route handlers AFTER mocks are registered                   */
/* ------------------------------------------------------------------ */

import createOrderHandler from "../../pages/api/razorpay/create-order.js";
import verifyHandler from "../../pages/api/razorpay/verify.js";
import receiptHandler from "../../pages/api/receipts/generate.js";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import crypto from "crypto";

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

function createMockReq(method = "POST", body = {}, headers = {}) {
  return {
    method,
    body,
    headers: {
      authorization: "Bearer test-token-123",
      ...headers,
    },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockImplementation((data) => {
      res.body = data;
      return res;
    }),
    setHeader: vi.fn().mockImplementation((key, value) => {
      res.headers[key] = value;
      return res;
    }),
  };
  return res;
}

/* ------------------------------------------------------------------ */
/*  Shared mock data                                                   */
/* ------------------------------------------------------------------ */

const mockProject = {
  id: "project-456",
  owner_id: "creator-789",
};

const mockCreatorConfig = {
  razorpay_key_id: "rzp_test_key",
  razorpay_key_secret: "rzp_test_secret_abcdef",
};

const mockDonation = {
  id: "donat-123",
  amount: 500,
  created_at: "2026-07-15T12:00:00Z",
  payer_id: "test-user-123",
  projects: { title: "Test Project" },
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Payment Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Track which table from() was last called with, so single() can
    // return the correct data for the current query chain.
    supabaseAdmin.from.mockImplementation(function (table) {
      this._currentTable = table;
      return this;
    });

    // Route single() to the right mock data based on the tracked table
    supabaseAdmin.single.mockImplementation(function () {
      switch (this._currentTable) {
        case "projects":
          return Promise.resolve({ data: mockProject, error: null });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    });

    // maybeSingle is used by create-order/verify for (1) the idempotency check
    // on public_donations (must be null — no existing donation), (2) the
    // creator_verifications lookup (owner must be approved for the Phase 1
    // gate), and (3) the creator_payment_configs lookup. Route by table so the
    // idempotency check doesn't see the creator config as an already-processed
    // payment, and the verification gate sees an approved owner.
    supabaseAdmin.maybeSingle.mockImplementation(function () {
      if (this._currentTable === "creator_payment_configs") {
        return Promise.resolve({ data: mockCreatorConfig, error: null });
      }
      if (this._currentTable === "creator_verifications") {
        return Promise.resolve({
          data: { verification_status: "approved" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    // Insert donation → chainable .select().single() returning donation id
    supabaseAdmin.insert.mockImplementation(() => ({
      select: () => ({
        single: () =>
          Promise.resolve({ data: { id: "donat-123" }, error: null }),
      }),
    }));

    // RPC for funding increment
    supabaseAdmin.rpc.mockResolvedValue({ data: null, error: null });
  });

  /* ================================================================ */
  it("creates an order, verifies payment, and generates receipt", async () => {
    /* Step 1: Create order */
    const createReq = createMockReq("POST", {
      amount: 500,
      projectId: "project-456",
    });
    const createRes = createMockRes();

    await createOrderHandler(createReq, createRes);

    expect(createRes.status).toHaveBeenCalledWith(200);
    expect(createRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order_test_abc123",
        amount: 50000,
        currency: "INR",
      }),
    );

    /* Step 2: Verify payment */
    const order = "order_test_abc123";
    const paymentId = "pay_test_xyz789";
    const secret = mockCreatorConfig.razorpay_key_secret;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${order}|${paymentId}`)
      .digest("hex");

    const verifyReq = createMockReq("POST", {
      razorpay_payment_id: paymentId,
      razorpay_order_id: order,
      razorpay_signature: signature,
      projectId: "project-456",
      amount: 500,
    });
    const verifyRes = createMockRes();

    await verifyHandler(verifyReq, verifyRes);

    expect(verifyRes.status).toHaveBeenCalledWith(200);
    expect(verifyRes.json).toHaveBeenCalledWith({
      success: true,
      donationId: "donat-123",
    });

    /* Step 3: Generate receipt */
    // Override single for receipt handler's donation lookup
    supabaseAdmin.single.mockImplementation(function () {
      if (this._currentTable === "public_donations") {
        return Promise.resolve({ data: mockDonation, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const receiptReq = createMockReq("POST", { donationId: "donat-123" });
    const receiptRes = createMockRes();

    await receiptHandler(receiptReq, receiptRes);

    expect(receiptRes.status).toHaveBeenCalledWith(200);
    expect(receiptRes.json).toHaveBeenCalledWith({
      success: true,
      receipt: expect.objectContaining({
        receiptId: "RCPT-DONAT-",
        amount: 500,
        project: "Test Project",
        donor: "test-user-123",
      }),
    });
  });

  /* ================================================================ */
  it("rejects verify with invalid signature", async () => {
    const verifyReq = createMockReq("POST", {
      razorpay_payment_id: "pay_test_xyz789",
      razorpay_order_id: "order_test_abc123",
      razorpay_signature: "invalid_signature_value_here_1234567890abcdef",
      projectId: "project-456",
      amount: 500,
    });
    const verifyRes = createMockRes();

    await verifyHandler(verifyReq, verifyRes);

    expect(verifyRes.status).toHaveBeenCalledWith(400);
    expect(verifyRes.json).toHaveBeenCalledWith({
      error: "Invalid payment signature",
    });
  });

  /* ================================================================ */
  it("rejects receipt for non-existent donation", async () => {
    // Override single to return null for all tables
    supabaseAdmin.single.mockResolvedValue({ data: null, error: null });

    const receiptReq = createMockReq("POST", {
      donationId: "non-existent-donation",
    });
    const receiptRes = createMockRes();

    await receiptHandler(receiptReq, receiptRes);

    expect(receiptRes.status).toHaveBeenCalledWith(404);
    expect(receiptRes.json).toHaveBeenCalledWith({
      error: "Donation not found",
    });
  });

  /* ================================================================ */
  it("returns 405 for GET requests on POST-only routes", async () => {
    const getReq = createMockReq("GET");

    const createRes = createMockRes();
    await createOrderHandler(getReq, createRes);
    expect(createRes.status).toHaveBeenCalledWith(405);

    const verifyRes = createMockRes();
    await verifyHandler(getReq, verifyRes);
    expect(verifyRes.status).toHaveBeenCalledWith(405);

    const receiptRes = createMockRes();
    await receiptHandler(getReq, receiptRes);
    expect(receiptRes.status).toHaveBeenCalledWith(405);
  });

  /* ================================================================ */
  it("returns 400 when create-order is called with invalid amount", async () => {
    const req = createMockReq("POST", {
      amount: -10,
      projectId: "project-456",
    });
    const res = createMockRes();

    await createOrderHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid amount" });
  });

  /* ================================================================ */
  it("returns 400 when create-order is called without projectId", async () => {
    const req = createMockReq("POST", { amount: 500 });
    const res = createMockRes();

    await createOrderHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "projectId is required",
    });
  });

  /* ================================================================ */
  it("returns 400 when verify is called with missing fields", async () => {
    const req = createMockReq("POST", { razorpay_payment_id: "pay_123" });
    const res = createMockRes();

    await verifyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "razorpay_order_id is required",
    });
  });

  /* ================================================================ */
  it("returns 400 when receipt is called without donationId", async () => {
    const req = createMockReq("POST", {});
    const res = createMockRes();

    await receiptHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Donation ID is required",
    });
  });

  /* ================================================================ */
  it("returns 500 when creator payment config is missing", async () => {
    // Owner stays approved (verification gate passes); only the creator
    // payment config lookup is empty.
    supabaseAdmin.maybeSingle.mockImplementation(function () {
      if (this._currentTable === "creator_verifications") {
        return Promise.resolve({
          data: { verification_status: "approved" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const req = createMockReq("POST", {
      amount: 500,
      projectId: "project-456",
    });
    const res = createMockRes();

    await createOrderHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Payment system not configured",
    });
  });

  /* ================================================================ */
  it("returns 404 when project does not exist for create-order", async () => {
    supabaseAdmin.single.mockResolvedValue({ data: null, error: null });

    const req = createMockReq("POST", {
      amount: 500,
      projectId: "nonexistent-project",
    });
    const res = createMockRes();

    await createOrderHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Project not found" });
  });
});
