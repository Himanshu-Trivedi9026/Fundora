/**
 * /api/payout — creator payout API.
 *
 * Phase 1 gate: POST (create payout / withdraw) requires the creator's
 * verification to be "approved" → otherwise 403. GET (balance / list) stays
 * open (read-only) so the creator can still view their numbers.
 */
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => vi.fn(() => true)),
}));

vi.mock("@/lib/verification/secureLogger", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/payout/payoutEngine", () => ({
  createPayoutRequest: vi.fn(),
  getCreatorPayoutRequests: vi.fn(),
  getCreatorBalance: vi.fn(),
}));

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createPayoutRequest,
  getCreatorBalance,
} from "@/lib/payout/payoutEngine";
import handler from "@/pages/api/payout";

const USER = { id: "creator-1", email: "creator@test.com" };

function createReq(method = "POST", body = {}, query = {}) {
  return { method, body, query, headers: { authorization: "Bearer token-1" } };
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

describe("/api/payout", () => {
  const mockVerificationMaybeSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: USER },
      error: null,
    });
    supabaseAdmin.from.mockReset().mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
    });
    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
      error: null,
    });
  });

  it("returns 403 for POST (withdraw) when the creator is not verified", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: { verification_status: "pending" },
      error: null,
    });
    const res = createRes();

    await handler(
      createReq("POST", {
        escrowAccountId: "esc-1",
        bankAccountId: "bank-1",
        amount: 1000,
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._body.error).toBe("VerificationRequired");
    expect(createPayoutRequest).not.toHaveBeenCalled();
  });

  it("returns 403 for POST when the verification lookup errors (fail-closed)", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "db down" },
    });
    const res = createRes();

    await handler(
      createReq("POST", {
        escrowAccountId: "esc-1",
        bankAccountId: "bank-1",
        amount: 1000,
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(createPayoutRequest).not.toHaveBeenCalled();
  });

  it("returns 201 for POST when the creator is verified", async () => {
    createPayoutRequest.mockResolvedValue({
      success: true,
      request: { id: "payout-1", amount: 1000 },
    });
    const res = createRes();

    await handler(
      createReq("POST", {
        escrowAccountId: "esc-1",
        bankAccountId: "bank-1",
        amount: 1000,
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res._body.success).toBe(true);
    expect(createPayoutRequest).toHaveBeenCalledWith({
      creatorId: USER.id,
      escrowAccountId: "esc-1",
      bankAccountId: "bank-1",
      amount: 1000,
    });
  });

  it("returns 400 for POST when required fields are missing", async () => {
    const res = createRes();

    await handler(createReq("POST", { escrowAccountId: "esc-1" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createPayoutRequest).not.toHaveBeenCalled();
  });

  it("returns 401 for a guest", async () => {
    supabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const res = createRes();

    await handler(
      createReq("POST", {
        escrowAccountId: "esc-1",
        bankAccountId: "bank-1",
        amount: 1000,
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(createPayoutRequest).not.toHaveBeenCalled();
  });

  it("GET balance stays open (read-only) for an unverified creator", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: { verification_status: "pending" },
      error: null,
    });
    getCreatorBalance.mockResolvedValue({
      success: true,
      balance: { available: 500 },
    });
    const res = createRes();

    await handler(createReq("GET", {}, { mode: "balance" }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res._body.balance).toEqual({ available: 500 });
  });
});
