/**
 * withRole — API-route role enforcement (composes withAuth).
 *
 * The wrapper authenticates via withAuth, then checks the caller's role on
 * public.profiles against the allowed set. Tests the Supabase interactions
 * are scoped to the caller's own profile row.
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
import { withRole } from "@/lib/withAuth";
import { ROLES } from "@/lib/roles";

const USER = { id: "user-123", email: "x@y.com" };

function createReq() {
  return { method: "POST", headers: { authorization: "Bearer token-1" }, body: {} };
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

/** Returns the withRole-wrapped handler with a spy handler and fresh mocks. */
function setup(allowedRoles = [ROLES.ADMIN]) {
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null });
  const handler = vi.fn(async (req, res, user) => {
    res.status(200).json({ ok: true, userRole: req.userRole, userId: user.id });
  });
  return { wrapped: withRole(handler, allowedRoles), handler };
}

function mockProfileResult(value) {
  supabaseAdmin.maybeSingle.mockResolvedValue(value);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withRole", () => {
  it("lets an allowed role through and attaches req.userRole", async () => {
    const { wrapped, handler } = setup([ROLES.ADMIN]);
    mockProfileResult({ data: { role: ROLES.ADMIN }, error: null });
    const req = createReq();
    const res = createRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][2].id).toBe(USER.id);
    expect(req.userRole).toBe(ROLES.ADMIN);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res._body).toEqual({ ok: true, userRole: ROLES.ADMIN, userId: USER.id });
  });

  it("returns 403 for a role outside the allowed set", async () => {
    const { wrapped, handler } = setup([ROLES.ADMIN]);
    mockProfileResult({ data: { role: ROLES.INVESTOR }, error: null });
    const req = createReq();
    const res = createRes();

    await wrapped(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._body.error).toBe("Forbidden");
  });

  it("allows creator+admin into creator routes but not investors", async () => {
    const creatorRoute = setup([ROLES.CREATOR, ROLES.ADMIN]);
    mockProfileResult({ data: { role: ROLES.CREATOR }, error: null });
    await creatorRoute.wrapped(createReq(), createRes());
    expect(creatorRoute.handler).toHaveBeenCalledTimes(1);

    const investorRoute = setup([ROLES.CREATOR, ROLES.ADMIN]);
    mockProfileResult({ data: { role: ROLES.INVESTOR }, error: null });
    const res = createRes();
    await investorRoute.wrapped(createReq(), res);
    expect(investorRoute.handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when the profile row is missing", async () => {
    const { wrapped, handler } = setup([ROLES.ADMIN]);
    mockProfileResult({ data: null, error: null });
    const res = createRes();

    await wrapped(createReq(), res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when the role lookup errors", async () => {
    const { wrapped, handler } = setup([ROLES.ADMIN]);
    mockProfileResult({ data: null, error: { message: "boom" } });
    const res = createRes();

    await wrapped(createReq(), res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("scopes the role lookup to the authenticated user's own profile", async () => {
    const { wrapped } = setup([ROLES.ADMIN]);
    mockProfileResult({ data: { role: ROLES.ADMIN }, error: null });

    await wrapped(createReq(), createRes());

    expect(supabaseAdmin.from).toHaveBeenCalledWith("profiles");
    const selectCall = supabaseAdmin.from("profiles").select.mock.calls[0][0];
    expect(selectCall).toContain("role");
    expect(supabaseAdmin.from("profiles").eq).toHaveBeenCalledWith("id", USER.id);
  });

  it("returns 401 when not authenticated (withAuth path)", async () => {
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const handler = vi.fn();
    const wrapped = withRole(handler, [ROLES.ADMIN]);
    const res = createRes();

    await wrapped(createReq(), res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
