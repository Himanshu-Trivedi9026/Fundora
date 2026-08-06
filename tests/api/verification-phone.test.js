import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (must precede the route import) ───

vi.mock("../../lib/withAuth", () => ({
  withAuth: (fn) => fn,
}));

vi.mock("../../lib/rateLimit", () => {
  const rlOpts = [];
  return {
    rateLimit: vi.fn((opts) => {
      rlOpts.push(opts);
      return vi.fn(() => true);
    }),
    __rlOpts: rlOpts,
  };
});

vi.mock("../../lib/verification/phoneVerification", () => ({
  createOTP: vi.fn(),
  verifyOTP: vi.fn(),
  getOTPStatus: vi.fn(),
  resendOTP: vi.fn(),
}));

vi.mock("../../lib/supabaseAdmin", () => {
  const calls = { updates: [] };
  const supabaseAdmin = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn((payload) => {
        calls.updates.push(payload);
        return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };
  return { supabaseAdmin, __state: { calls } };
});

// ─── Helpers ───

function mockReq(method = "POST", body = {}) {
  return { method, body, query: {}, headers: {} };
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

// ─── Tests ───

describe("API — Verification Phone", () => {
  let handler;
  let phone;
  let state;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../pages/api/verification/phone.js");
    handler = mod.default;
    phone = await import("../../lib/verification/phoneVerification");
    const mockMod = await import("../../lib/supabaseAdmin");
    state = mockMod.__state;
    state.calls.updates.length = 0;
  });

  it("wires a per-user rate limiter", async () => {
    const rlMod = await import("../../lib/rateLimit");
    expect(rlMod.__rlOpts).toContainEqual({ windowMs: 60_000, max: 30 });
  });

  it("POST send calls createOTP with the real user id", async () => {
    phone.createOTP.mockResolvedValue({ success: true });

    const res = mockRes();
    await handler(
      mockReq("POST", { action: "send", phone: "+919999999999" }),
      res,
      { id: "user-1" },
    );

    expect(phone.createOTP).toHaveBeenCalledWith("user-1", "+919999999999");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("POST send propagates cooldown errors", async () => {
    phone.createOTP.mockResolvedValue({
      success: false,
      error: "Please wait 30 seconds",
      cooldown: 30,
    });

    const res = mockRes();
    await handler(
      mockReq("POST", { action: "send", phone: "+919999999999" }),
      res,
      { id: "user-1" },
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].cooldown).toBe(30);
  });

  it("POST send requires a phone", async () => {
    const res = mockRes();
    await handler(mockReq("POST", { action: "send" }), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("POST verify marks phone_verified on success", async () => {
    phone.verifyOTP.mockResolvedValue({ success: true });

    const res = mockRes();
    await handler(
      mockReq("POST", {
        action: "verify",
        phone: "+919999999999",
        otp: "123456",
      }),
      res,
      { id: "user-1" },
    );

    expect(phone.verifyOTP).toHaveBeenCalledWith(
      "user-1",
      "+919999999999",
      "123456",
    );
    // Server-side flag set on the creator_verifications row.
    expect(state.calls.updates).toContainEqual({ phone_verified: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("POST verify propagates a wrong-OTP error", async () => {
    phone.verifyOTP.mockResolvedValue({
      success: false,
      error: "Invalid OTP. 2 attempts remaining.",
    });

    const res = mockRes();
    await handler(
      mockReq("POST", {
        action: "verify",
        phone: "+919999999999",
        otp: "000000",
      }),
      res,
      { id: "user-1" },
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain("Invalid OTP");
  });

  it("POST verify requires phone and otp", async () => {
    const res = mockRes();
    await handler(
      mockReq("POST", { action: "verify", phone: "+919999999999" }),
      res,
      { id: "user-1" },
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("POST status returns OTP status for the user", async () => {
    phone.getOTPStatus.mockResolvedValue({
      canSend: false,
      cooldownRemaining: 12,
      attemptsUsed: 1,
      maxAttempts: 3,
    });

    const res = mockRes();
    await handler(
      mockReq("POST", { action: "status", phone: "+919999999999" }),
      res,
      { id: "user-1" },
    );

    expect(phone.getOTPStatus).toHaveBeenCalledWith("user-1", "+919999999999");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].cooldownRemaining).toBe(12);
  });

  it("POST rejects an unknown action", async () => {
    const res = mockRes();
    await handler(mockReq("POST", { action: "nonsense" }), res, {
      id: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects unsupported methods", async () => {
    const res = mockRes();
    await handler(mockReq("GET"), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
