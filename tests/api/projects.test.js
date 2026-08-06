/**
 * POST /api/projects — the single supported publish path (wrapped in
 * withVerified). Covers the Phase 1 authorization matrix:
 *   guest → 401, investor (pending verification) → 403,
 *   unverified creator → 403, verified creator → 201.
 *
 * withVerified/withAuth are kept real; auth is driven by
 * supabaseAdmin.auth.getUser and verification by the mocked
 * creator_verifications lookup.
 */
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => vi.fn(() => true)),
}));

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import handler from "@/pages/api/projects";

const USER = { id: "test-user-id", email: "creator@test.com" };

function createReq(method = "POST", body = {}) {
  return { method, body, headers: { authorization: "Bearer token-1" } };
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

const validBody = {
  title: "Eco Bamboo Bikes",
  short: "Sustainable bikes from fast-growing bamboo.",
  description: "A longer description of the campaign.",
  goal: 50000,
  deadline: "2026-12-31",
  prototypeUrl: "https://example.com/proto",
  categories: ["environment", "transport"],
};

describe("POST /api/projects", () => {
  const mockVerificationMaybeSingle = vi.fn();
  const mockInsert = vi.fn();
  const mockInsertSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated creator, verification approved, insert succeeds.
    // mockReset() clears leftover queued chains from tests that short-circuit
    // (403/400/405 gate tests consume only the verification chain) so ordering
    // stays aligned across tests.
    mockInsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockInsertSingle }) });
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
    supabaseAdmin.from
      .mockReset()
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ maybeSingle: mockVerificationMaybeSingle }),
      })
      .mockReturnValueOnce({
        insert: mockInsert,
      });

    mockVerificationMaybeSingle.mockResolvedValue({
      data: { verification_status: "approved" },
      error: null,
    });
    mockInsertSingle.mockResolvedValue({
      data: { id: "project-1", title: "Eco Bamboo Bikes" },
      error: null,
    });
  });

  it("returns 201 with the created project for a verified creator", async () => {
    const req = createReq("POST", validBody);
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res._body.project.id).toBe("project-1");
    // owner_id/creator_id are bound server-side to the authenticated user.
    const insertArg = mockInsert.mock.calls[0][0][0];
    expect(insertArg.owner_id).toBe(USER.id);
    expect(insertArg.creator_id).toBe(USER.id);
  });

  it("returns 401 for a guest (no valid session)", async () => {
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = createRes();

    await handler(createReq("POST", validBody), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 403 for an investor (pending verification)", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: { verification_status: "pending" },
      error: null,
    });
    const res = createRes();

    await handler(createReq("POST", validBody), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._body.error).toBe("VerificationRequired");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 403 for a missing verification row", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = createRes();

    await handler(createReq("POST", validBody), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 403 when the verification lookup errors (fail-closed)", async () => {
    mockVerificationMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "db down" },
    });
    const res = createRes();

    await handler(createReq("POST", validBody), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 400 for missing title", async () => {
    const res = createRes();
    await handler(createReq("POST", { ...validBody, title: "" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._body.error).toBe("Title is required");
  });

  it("returns 400 for invalid goal", async () => {
    const res = createRes();
    await handler(createReq("POST", { ...validBody, goal: -10 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._body.error).toBe("Goal must be a positive number");
  });

  it("returns 405 for non-POST methods", async () => {
    const res = createRes();
    await handler(createReq("GET"), res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res._body.error).toBe("Method not allowed");
  });

  it("returns 500 when the insert fails", async () => {
    mockInsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = createRes();

    await handler(createReq("POST", validBody), res);

    expect(res.status).toHaveBeenCalledWith(500);
    consoleSpy.mockRestore();
  });
});
