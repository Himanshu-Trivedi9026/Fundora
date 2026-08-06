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

vi.mock("../../lib/verification/sessionManager", () => ({
  createSession: vi.fn(),
  resumeSession: vi.fn(),
  updateSessionStep: vi.fn(),
  completeSession: vi.fn(),
  getSessionProgress: vi.fn(),
}));

vi.mock("../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
  hashIP: vi.fn(() => "ip-hash"),
}));

vi.mock("../../lib/supabaseAdmin", () => {
  // Mutable state for the verification_requests upsert.
  let existingRequest = null;
  // Number of verification_documents rows for the caller (used by the
  // "complete requires documents" gate).
  let docCount = 1;
  const opts = { insertError: null, updateError: null };
  const calls = { inserts: [], updates: [], selects: [] };

  const makeBuilder = (table) => {
    const builder = {
      _table: table,
      _query: {},
      _payload: null,
      select() {
        return this;
      },
      eq(col, val) {
        this._query[col] = val;
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle() {
        return this.resolve();
      },
      single() {
        return this.resolve();
      },
      insert(payload) {
        calls.inserts.push({ table, payload });
        this._payload = payload;
        return this;
      },
      update(payload) {
        calls.updates.push({ table, payload });
        this._payload = payload;
        return this;
      },
      resolve() {
        if (table === "verification_requests") {
          if (this._payload) {
            return Promise.resolve({
              data: { id: "req-1", ...this._payload },
              error: opts.insertError ? { message: "insert failed" } : null,
            });
          }
          if (existingRequest) {
            return Promise.resolve({
              data: existingRequest,
              error: opts.updateError ? { message: "update failed" } : null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }
        if (table === "creator_verifications") {
          return Promise.resolve({ data: { id: "verify-1" }, error: null });
        }
        if (table === "verification_documents") {
          // `.select("id", { count: "exact", head: true })` → count, not rows.
          return Promise.resolve({ data: null, count: docCount, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolveFn, rejectFn) {
        return this.resolve().then(resolveFn, rejectFn);
      },
    };
    return builder;
  };

  const supabaseAdmin = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: vi.fn((table) => makeBuilder(table)),
  };

  return {
    supabaseAdmin,
    __state: {
      opts,
      calls,
      setExisting: (r) => (existingRequest = r),
      setDocCount: (n) => (docCount = n),
    },
  };
});

// ─── Helpers ───

function mockReq(method = "GET", body = {}, query = {}, headers = {}) {
  return {
    method,
    body,
    query,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

// ─── Tests ───

describe("API — Verification Session", () => {
  let handler;
  let sessionManager;
  let state;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../pages/api/verification/session.js");
    handler = mod.default;
    sessionManager = await import("../../lib/verification/sessionManager");
    const mockMod = await import("../../lib/supabaseAdmin");
    state = mockMod.__state;
    state.opts.insertError = null;
    state.opts.updateError = null;
    state.setExisting(null);
    state.setDocCount(1);
    state.calls.inserts.length = 0;
    state.calls.updates.length = 0;
  });

  it("wires a per-user rate limiter", async () => {
    const rlMod = await import("../../lib/rateLimit");
    expect(rlMod.__rlOpts).toContainEqual({ windowMs: 60_000, max: 60 });
  });

  it("DELETE complete rejects when no documents have been uploaded", async () => {
    sessionManager.completeSession.mockResolvedValue({ success: true });
    state.setDocCount(0);

    const res = mockRes();
    await handler(
      mockReq("DELETE", { sessionId: "sess-1", action: "complete" }),
      res,
      { id: "user-1" },
    );

    expect(sessionManager.completeSession).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain("No documents uploaded");
  });

  it("GET resumes the caller's active session", async () => {
    sessionManager.getSessionProgress.mockResolvedValue({
      success: true,
      session: { id: "sess-1", current_step: "identity" },
    });

    const res = mockRes();
    await handler(mockReq("GET"), res, { id: "user-1" });

    expect(sessionManager.getSessionProgress).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].session.id).toBe("sess-1");
  });

  it("GET propagates a session error", async () => {
    sessionManager.getSessionProgress.mockResolvedValue({
      success: false,
      error: "boom",
    });

    const res = mockRes();
    await handler(mockReq("GET"), res, { id: "user-1" });

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("POST creates a session with the real user id and device metadata", async () => {
    sessionManager.createSession.mockResolvedValue({
      success: true,
      session: { id: "sess-new" },
    });

    const res = mockRes();
    await handler(
      mockReq("POST", {
        deviceMetadata: { browser: "chrome" },
        requestId: "req-1",
      }),
      res,
      { id: "user-1" },
    );

    expect(sessionManager.createSession).toHaveBeenCalledWith(
      "user-1",
      "req-1",
      { browser: "chrome" },
      "127.0.0.1",
      undefined,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("PATCH updates the current step with ownership", async () => {
    sessionManager.updateSessionStep.mockResolvedValue({ success: true });

    const res = mockRes();
    await handler(
      mockReq("PATCH", {
        sessionId: "sess-1",
        step: "phone",
        completedSteps: ["email"],
        wizardState: { phoneVerified: true },
      }),
      res,
      { id: "user-1" },
    );

    expect(sessionManager.updateSessionStep).toHaveBeenCalledWith(
      "sess-1",
      "phone",
      ["email"],
      { phoneVerified: true },
      "user-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("PATCH rejects missing sessionId/step", async () => {
    const res = mockRes();
    await handler(mockReq("PATCH", { sessionId: "sess-1" }), res, {
      id: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("DELETE complete upserts a verification_requests row for the review queue", async () => {
    sessionManager.completeSession.mockResolvedValue({ success: true });

    const res = mockRes();
    await handler(
      mockReq("DELETE", { sessionId: "sess-1", action: "complete" }),
      res,
      { id: "user-1" },
    );

    expect(sessionManager.completeSession).toHaveBeenCalledWith(
      "sess-1",
      "user-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);

    // New request row inserted (no existing request).
    const inserted = state.calls.inserts.find(
      (i) => i.table === "verification_requests",
    );
    expect(inserted).toBeTruthy();
    expect(inserted.payload).toMatchObject({
      user_id: "user-1",
      verification_id: "verify-1",
      verification_type: "identity",
      current_step: "complete",
      status: "submitted",
    });
    expect(inserted.payload.submitted_at).toBeTruthy();
  });

  it("DELETE complete updates an existing request instead of inserting", async () => {
    sessionManager.completeSession.mockResolvedValue({ success: true });
    state.setExisting({
      id: "req-old",
      user_id: "user-1",
      verification_type: "identity",
      metadata: {},
    });

    const res = mockRes();
    await handler(
      mockReq("DELETE", { sessionId: "sess-1", action: "complete" }),
      res,
      { id: "user-1" },
    );

    expect(
      state.calls.inserts.some((i) => i.table === "verification_requests"),
    ).toBe(false);
    const updated = state.calls.updates.find(
      (i) => i.table === "verification_requests",
    );
    expect(updated).toBeTruthy();
    expect(updated.payload).toMatchObject({
      current_step: "complete",
      status: "submitted",
    });
    expect(updated.payload.metadata).toMatchObject({ submitted_via: "wizard" });
  });

  it("DELETE complete requires a sessionId", async () => {
    const res = mockRes();
    await handler(mockReq("DELETE", { action: "complete" }), res, {
      id: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("DELETE rejects unknown delete actions", async () => {
    const res = mockRes();
    await handler(mockReq("DELETE", { action: "wipe" }), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects unsupported methods", async () => {
    const res = mockRes();
    await handler(mockReq("PUT"), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
