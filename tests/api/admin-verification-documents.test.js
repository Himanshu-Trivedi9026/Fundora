import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (must precede the route import) ───

// Real withAuth + withRole run here so we can verify the 403 gate as well as
// the admin handler behavior. supabaseAdmin drives auth.getUser, the profiles
// role lookup, and the documents query.
vi.mock("../../lib/supabaseAdmin", () => {
  const opts = { role: null, documents: [] };
  const calls = { signedUrls: [] };

  const makeBuilder = (table) => {
    const builder = {
      _table: table,
      _query: {},
      select() {
        return this;
      },
      eq(col, val) {
        this._query[col] = val;
        return this;
      },
      in() {
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
      resolve() {
        if (table === "profiles") {
          if (!opts.role) return Promise.resolve({ data: null, error: null });
          return Promise.resolve({ data: { role: opts.role }, error: null });
        }
        if (table === "verification_documents") {
          if (this._query.id) {
            // The admin route awaits this chain (.eq(id).limit(1)) and expects
            // an array result (documents list semantics).
            const found = opts.documents.find((d) => d.id === this._query.id);
            return Promise.resolve({ data: found ? [found] : [], error: null });
          }
          return Promise.resolve({ data: opts.documents, error: null });
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
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "admin-1", email: "admin@example.com" } },
        error: null,
      }),
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async (path, seconds) => {
          calls.signedUrls.push({ path, seconds });
          return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
        }),
      })),
    },
    from: vi.fn((table) => makeBuilder(table)),
  };

  return { supabaseAdmin, __state: { opts, calls } };
});

const __signedCalls = [];

vi.mock("../../lib/verification/storage", async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    getSignedUrl: vi.fn(async (path) => {
      __signedCalls.push(path);
      return {
        success: true,
        url: "https://signed.example/doc",
        expiresAt: "2026-01-01T00:00:00.000Z",
      };
    }),
    sanitizeDoc: vi.fn((doc) => {
      const { storage_path, storage_bucket, ...rest } = doc || {};
      return rest;
    }),
  };
});

// ─── Helpers ───

function mockReq(method = "GET", query = {}, headers = {}) {
  return { method, body: {}, query, headers };
}

function mockRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res;
}

const AUTH_HEADERS = { authorization: "Bearer test-token" };

// ─── Tests ───

describe("API — Admin Verification Documents", () => {
  let handler;
  let state;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../pages/api/admin/verification/documents.js");
    handler = mod.default;
    const mockMod = await import("../../lib/supabaseAdmin");
    state = mockMod.__state;
    state.opts.role = null;
    state.opts.documents = [];
    state.calls.signedUrls.length = 0;
    __signedCalls.length = 0;
  });

  it("returns 403 when the caller is not a platform admin", async () => {
    state.opts.role = "creator";
    state.opts.documents = [{ id: "doc-1", user_id: "u1", document_type: "pan_card" }];

    const res = mockRes();
    await handler(mockReq("GET", {}, AUTH_HEADERS), res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when the profile cannot be resolved", async () => {
    // opts.role stays null → profiles lookup returns no row.
    const res = mockRes();
    await handler(mockReq("GET", {}, AUTH_HEADERS), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("lists documents with signed URLs for admins", async () => {
    state.opts.role = "platform_admin";
    state.opts.documents = [
      {
        id: "doc-1",
        user_id: "u1",
        document_type: "pan_card",
        document_name: "pan.jpg",
        storage_path: "u1/identity/secret.jpg",
        status: "uploaded",
      },
    ];

    const res = mockRes();
    await handler(mockReq("GET", {}, AUTH_HEADERS), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonBody = res.json.mock.calls[0][0];
    expect(jsonBody.count).toBe(1);
    expect(jsonBody.documents[0].signedUrl).toBe("https://signed.example/doc");
    // Raw path never leaves the server.
    expect(JSON.stringify(jsonBody)).not.toContain("storage_path");
    expect(JSON.stringify(jsonBody)).not.toContain("u1/identity/secret.jpg");
  });

  it("filters by documentId", async () => {
    state.opts.role = "platform_admin";
    state.opts.documents = [
      { id: "doc-1", user_id: "u1", document_type: "pan_card", storage_path: "a.jpg" },
      { id: "doc-2", user_id: "u1", document_type: "passport", storage_path: "b.jpg" },
    ];

    const res = mockRes();
    await handler(mockReq("GET", { documentId: "doc-2" }, AUTH_HEADERS), res);

    expect(res.status).toHaveBeenCalledWith(200);
    // Only the filtered document gets a signed URL.
    expect(__signedCalls.length).toBe(1);
  });

  it("rejects non-GET methods", async () => {
    state.opts.role = "platform_admin";
    const res = mockRes();
    await handler(mockReq("POST", {}, AUTH_HEADERS), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });
});
