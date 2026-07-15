import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { withAuth } from "@/lib/withAuth";

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

function createReq(overrides = {}) {
  return {
    headers: {},
    ...overrides,
  };
}

function createRes() {
  const res = {
    _status: null,
    _body: null,
    _headers: {},
    status: vi.fn(function (code) {
      res._status = code;
      return res;
    }),
    json: vi.fn(function (body) {
      res._body = body;
      return res;
    }),
    setHeader: vi.fn(function (name, value) {
      res._headers[name] = value;
      return res;
    }),
  };
  return res;
}

describe("withAuth middleware", () => {
  let handler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = vi.fn(async (req, res, user) => {
      return res.status(200).json({ ok: true, userId: user.id });
    });
  });

  it("returns 401 when no Authorization header", async () => {
    const req = createReq();
    const res = createRes();
    const authedHandler = withAuth(handler);

    await authedHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when token doesn't start with Bearer", async () => {
    const req = createReq({ headers: { authorization: "Token abc123" } });
    const res = createRes();
    const authedHandler = withAuth(handler);

    await authedHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when supabaseAdmin.auth.getUser returns an error", async () => {
    supabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });

    const req = createReq({ headers: { authorization: "Bearer validtoken123" } });
    const res = createRes();
    const authedHandler = withAuth(handler);

    await authedHandler(req, res);

    expect(supabaseAdmin.auth.getUser).toHaveBeenCalledWith("validtoken123");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when user is null", async () => {
    supabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = createReq({ headers: { authorization: "Bearer validtoken123" } });
    const res = createRes();
    const authedHandler = withAuth(handler);

    await authedHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler with user on success", async () => {
    const mockUser = { id: "user-123", email: "test@example.com" };
    supabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const req = createReq({ headers: { authorization: "Bearer validtoken123" } });
    const res = createRes();
    const authedHandler = withAuth(handler);

    await authedHandler(req, res);

    expect(handler).toHaveBeenCalledWith(req, res, mockUser);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, userId: "user-123" });
  });

  it("attaches user to req.user", async () => {
    const mockUser = { id: "user-456", email: "attach@example.com" };
    supabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const req = createReq({ headers: { authorization: "Bearer validtoken123" } });
    const res = createRes();
    const authedHandler = withAuth(handler);

    await authedHandler(req, res);

    expect(req.user).toEqual(mockUser);
  });

  it("returns 500 on exception", async () => {
    supabaseAdmin.auth.getUser.mockRejectedValue(new Error("Unexpected failure"));

    const req = createReq({ headers: { authorization: "Bearer validtoken123" } });
    const res = createRes();
    const authedHandler = withAuth(handler);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await authedHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    expect(handler).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
