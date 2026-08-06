/**
 * Admin identity review endpoint — pages/api/admin/identity-review.js
 *
 * Verifies:
 *   - Role gate: anonymous 401, donor 403, creator 403, admin passes through.
 *   - Method gate: non-POST → 405.
 *   - Validation: missing action/verificationId → 400; reject/resubmit without
 *     reason → 400; unknown action → 400.
 *   - Dispatch: each action routes to the correct manualReview engine function
 *     with the caller's id; success → 200; engine failure → 400; thrown error → 500.
 */

vi.mock("../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock("../../lib/rateLimit", () => ({
  rateLimit: vi.fn(() => vi.fn(() => true)),
}));

vi.mock("../../lib/verification/manualReview", () => ({
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  requestResubmission: vi.fn(),
  suspendVerification: vi.fn(),
}));

// Real withRole/withAuth wrappers; only auth substrate is mocked above.
import handler from "../../pages/api/admin/identity-review";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { ROLES } from "../../lib/roles";
import {
  approveRequest,
  rejectRequest,
  requestResubmission,
  suspendVerification,
} from "../../lib/verification/manualReview";

function createReq({ method = "POST", body = {}, token = "token-1" } = {}) {
  return {
    method,
    query: {},
    body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
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

function genericChain() {
  const then = (resolve) => resolve({ data: [], error: null });
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    like: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    then,
  };
  return chain;
}

function setRole(role) {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: role ? { role } : null, error: null })
            ),
          })),
        })),
      };
    }
    return genericChain();
  });
}

function authOk() {
  supabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user: { id: "admin-9", email: "admin@example.com" } },
    error: null,
  });
}

describe("GET /api/admin/identity-review — method gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole(ROLES.ADMIN);
    authOk();
  });

  it("rejects non-POST with 405", async () => {
    const res = createRes();
    await handler(createReq({ method: "GET" }), res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res._body.error).toContain("Method not allowed");
  });
});

describe("POST /api/admin/identity-review — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole(ROLES.ADMIN);
    authOk();
  });

  it("rejects missing verificationId with 400", async () => {
    const res = createRes();
    await handler(createReq({ body: { action: "approve" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._body.error).toContain("Action and verification ID are required");
  });

  it("rejects unknown action with 400", async () => {
    const res = createRes();
    await handler(
      createReq({ body: { action: "explode", verificationId: "req-1" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._body.error).toContain("Invalid action");
  });

  it("reject without reason → 400, engine not called", async () => {
    const res = createRes();
    await handler(
      createReq({ body: { action: "reject", verificationId: "req-1" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(rejectRequest).not.toHaveBeenCalled();
  });

  it("resubmit without reason → 400, engine not called", async () => {
    const res = createRes();
    await handler(
      createReq({ body: { action: "resubmit", verificationId: "req-1" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(requestResubmission).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/identity-review — action dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole(ROLES.ADMIN);
    authOk();
  });

  it("approve → approveRequest(verificationId, admin id, notes, admin id), 200", async () => {
    approveRequest.mockResolvedValue({ success: true });
    const res = createRes();
    await handler(
      createReq({
        body: { action: "approve", verificationId: "req-1", notes: "good" },
      }),
      res
    );
    expect(approveRequest).toHaveBeenCalledWith("req-1", "admin-9", "good", "admin-9");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res._body.success).toBe(true);
  });

  it("reject → rejectRequest with the reason, 200", async () => {
    rejectRequest.mockResolvedValue({ success: true });
    const res = createRes();
    await handler(
      createReq({
        body: { action: "reject", verificationId: "req-2", reason: "Blurry" },
      }),
      res
    );
    expect(rejectRequest).toHaveBeenCalledWith("req-2", "admin-9", "Blurry", "admin-9");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("resubmit → requestResubmission with the reason, 200", async () => {
    requestResubmission.mockResolvedValue({ success: true });
    const res = createRes();
    await handler(
      createReq({
        body: { action: "resubmit", verificationId: "req-3", reason: "New docs" },
      }),
      res
    );
    expect(requestResubmission).toHaveBeenCalledWith("req-3", "admin-9", "New docs", "admin-9");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("suspend → suspendVerification, 200", async () => {
    suspendVerification.mockResolvedValue({ success: true });
    const res = createRes();
    await handler(
      createReq({
        body: { action: "suspend", verificationId: "req-4", reason: "Fraud" },
      }),
      res
    );
    expect(suspendVerification).toHaveBeenCalledWith("req-4", "admin-9", "Fraud", "admin-9");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("engine failure surfaces as 400 with the engine error", async () => {
    rejectRequest.mockResolvedValue({ success: false, error: "not found" });
    const res = createRes();
    await handler(
      createReq({
        body: { action: "reject", verificationId: "nope", reason: "why" },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._body.error).toBe("not found");
  });

  it("engine throw surfaces as 500", async () => {
    approveRequest.mockRejectedValue(new Error("db down"));
    const res = createRes();
    await handler(
      createReq({ body: { action: "approve", verificationId: "req-1" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("POST /api/admin/identity-review — role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
  });

  it("rejects anonymous with 401", async () => {
    authNone();
    const res = createRes();
    await handler(createReq({ token: null }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  function authNone() {
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  }

  it("rejects donor with 403", async () => {
    setRole(ROLES.INVESTOR);
    const res = createRes();
    await handler(createReq({}), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects creator with 403", async () => {
    setRole(ROLES.CREATOR);
    const res = createRes();
    await handler(createReq({}), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows platform_admin through to the handler", async () => {
    setRole(ROLES.ADMIN);
    approveRequest.mockResolvedValue({ success: true });
    const res = createRes();
    await handler(
      createReq({ body: { action: "approve", verificationId: "req-1" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
