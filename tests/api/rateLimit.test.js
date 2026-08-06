vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

// Import rateLimit after mocks so the store is accessible
import { rateLimit } from "@/lib/rateLimit";

function createReq(ip = "127.0.0.1", token = null) {
  const headers = { "x-forwarded-for": ip };
  if (token) headers.authorization = `Bearer ${token}`;
  return { headers, socket: { remoteAddress: "127.0.0.1" } };
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

// Helper: get unique IP per test to avoid cross-test state pollution
let ipCounter = 0;

describe("rateLimit middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    ipCounter++;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when under limit", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 5 });
    const req = createReq(`10.0.0.${ipCounter}`);
    const res = createRes();

    const result = limiter(req, res);

    expect(result).toBe(true);
  });

  it("returns false and sends 429 when over limit", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 3 });
    const ip = `10.0.1.${ipCounter}`;
    const res = createRes();

    limiter(createReq(ip), res);
    limiter(createReq(ip), res);
    limiter(createReq(ip), res);
    res.status.mockClear();
    res.json.mockClear();
    res.setHeader.mockClear();

    const result = limiter(createReq(ip), res);

    expect(result).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Too many requests" }),
    );
  });

  it("sets X-RateLimit-* headers", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 10 });
    const req = createReq(`10.0.2.${ipCounter}`);
    const res = createRes();

    limiter(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "10");
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "9");
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-RateLimit-Reset",
      expect.any(String),
    );
  });

  it("sets Retry-After header when rate limited", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });
    const ip = `10.0.3.${ipCounter}`;

    const res1 = createRes();
    limiter(createReq(ip), res1); // count 1 - allowed

    const res2 = createRes();
    limiter(createReq(ip), res2); // count 2 - blocked

    expect(res2.setHeader).toHaveBeenCalledWith(
      "Retry-After",
      expect.any(String),
    );
    expect(res2.status).toHaveBeenCalledWith(429);
  });

  it("creates separate entries for different keys", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2 });
    const req1 = createReq(`10.0.4.${ipCounter}`);
    const req2 = createReq(`10.0.5.${ipCounter}`); // different IP
    const res1 = createRes();
    const res2 = createRes();

    limiter(req1, res1);
    limiter(req1, res1); // hits limit for req1
    const result2 = limiter(req2, res2); // req2 should still be fine

    expect(result2).toBe(true);
    expect(res2.status).not.toHaveBeenCalledWith(429);
  });

  it("resets after window expires", () => {
    const limiter = rateLimit({ windowMs: 10_000, max: 2 });
    const ip = `10.0.6.${ipCounter}`;
    const res1 = createRes();

    limiter(createReq(ip), res1);
    limiter(createReq(ip), res1); // hits limit

    vi.advanceTimersByTime(11_000); // window expires

    const res2 = createRes();
    const result = limiter(createReq(ip), res2);

    expect(result).toBe(true);
    expect(res2.status).not.toHaveBeenCalledWith(429);
  });

  it("uses custom keyFn when provided", () => {
    const keyFn = vi.fn((req) => `custom:${req.headers["x-custom-id"]}`);
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyFn });
    const req1 = {
      headers: { "x-custom-id": "aaa" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const req2 = {
      headers: { "x-custom-id": "bbb" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res1 = createRes();
    const res2 = createRes();

    limiter(req1, res1); // uses key "custom:aaa"
    limiter(req2, res2); // uses key "custom:bbb"

    expect(keyFn).toHaveBeenCalledTimes(2);
    expect(res1.status).not.toHaveBeenCalledWith(429);
    expect(res2.status).not.toHaveBeenCalledWith(429);
  });
});
