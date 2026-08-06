/**
 * withVerified — API-route creator-verification enforcement (composes withAuth).
 *
 * The wrapper authenticates via withAuth, then requires the caller's
 * creator_verifications.verification_status to be "approved". Tests the Supabase
 * interactions are scoped to the caller's own verification row, and that the
 * gate is fail-closed (missing row / lookup error → 403).
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

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { withVerified } from "@/lib/withAuth";

const USER = { id: "user-123", email: "x@y.com" };

function createReq() {
  return {
    method: "POST",
    headers: { authorization: "Bearer token-1" },
    body: {},
  };
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

/** Returns the withVerified-wrapped handler with a spy handler and fresh mocks. */
function setup() {
  supabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user: USER },
    error: null,
  });
  const handler = vi.fn(async (req, res, user) => {
    res.status(200).json({ ok: true, userId: user.id });
  });
  return { wrapped: withVerified(handler), handler };
}

function mockVerificationResult(value) {
  supabaseAdmin.maybeSingle.mockResolvedValue(value);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withVerified", () => {
  it("lets an approved creator through and calls the handler", async () => {
    const { wrapped, handler } = setup();
    mockVerificationResult({
      data: { verification_status: "approved" },
      error: null,
    });
    const req = createReq();
    const res = createRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][2].id).toBe(USER.id);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 403 for an unverified creator (pending)", async () => {
    const { wrapped, handler } = setup();
    mockVerificationResult({
      data: { verification_status: "pending" },
      error: null,
    });
    const res = createRes();

    await wrapped(createReq(), res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._body.error).toBe("VerificationRequired");
  });

  it("returns 403 when the verification row is missing", async () => {
    const { wrapped, handler } = setup();
    mockVerificationResult({ data: null, error: null });
    const res = createRes();

    await wrapped(createReq(), res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when the verification lookup errors (fail-closed)", async () => {
    const { wrapped, handler } = setup();
    mockVerificationResult({ data: null, error: { message: "boom" } });
    const res = createRes();

    await wrapped(createReq(), res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("scopes the verification lookup to the authenticated user's own row", async () => {
    const { wrapped } = setup();
    mockVerificationResult({
      data: { verification_status: "approved" },
      error: null,
    });

    await wrapped(createReq(), createRes());

    expect(supabaseAdmin.from).toHaveBeenCalledWith("creator_verifications");
    const selectCall = supabaseAdmin.from("creator_verifications").select.mock
      .calls[0][0];
    expect(selectCall).toContain("verification_status");
    expect(supabaseAdmin.from("creator_verifications").eq).toHaveBeenCalledWith(
      "user_id",
      USER.id,
    );
  });

  it("returns 401 when not authenticated (withAuth path)", async () => {
    supabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const handler = vi.fn();
    const wrapped = withVerified(handler);
    const res = createRes();

    await wrapped(createReq(), res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
