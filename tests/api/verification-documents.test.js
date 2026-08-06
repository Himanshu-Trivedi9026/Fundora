import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Shared mutable state (reset in beforeEach) ───
// Both module mocks below record into this so assertions can inspect
// cross-module side effects (storage removals flow through the storage
// module's deleteDocument; uploads through supabaseAdmin.storage).
const __shared = {
  uploads: [],
  removes: [],
  inserts: [],
  deletes: [],
  signedUrls: [],
};

function resetShared() {
  __shared.uploads = [];
  __shared.removes = [];
  __shared.inserts = [];
  __shared.deletes = [];
  __shared.signedUrls = [];
}

// ─── Mocks (must precede the route import) ───

// Keep real constants (DOCUMENT_TYPES) but stub the validators.
vi.mock("../../lib/verification/documentValidator", async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    validateDocument: vi.fn().mockReturnValue({ valid: true }),
    validateCorruption: vi.fn().mockReturnValue({ valid: true }),
  };
});

// Storage helpers: keep real constants but stub side-effect functions.
// deleteDocument records into __shared.removes so tests can assert cleanup.
vi.mock("../../lib/verification/storage", async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    generateStoragePath: vi.fn(() => "user-1/identity/1700000000000-a1b2c3d4.jpg"),
    getStorageFolder: vi.fn(() => "identity"),
    deleteDocument: vi.fn(async (path) => {
      __shared.removes.push(path);
      return { success: true };
    }),
    getSignedUrl: vi.fn().mockResolvedValue({
      success: true,
      url: "https://signed.example/doc",
      expiresAt: "2026-01-01T00:00:00.000Z",
    }),
    sanitizeDoc: vi.fn((doc) => {
      // Mirror sanitizeDocumentResponse: strip raw path + bucket, mask name.
      const { storage_path, storage_bucket, ...rest } = doc || {};
      return {
        ...rest,
        document_name: doc?.document_name ? `***${doc.document_name.slice(-4)}` : null,
      };
    }),
  };
});

vi.mock("../../lib/api/parseMultipartFile", () => ({
  parseMultipartFile: vi.fn(),
}));

vi.mock("../../lib/withAuth", () => ({
  withAuth: (fn) => fn,
}));

vi.mock("../../lib/supabaseAdmin", () => {
  let cv = null; // creator_verifications row
  const opts = {
    documents: [],
    uploadError: null,
    insertError: null,
  };

  const makeBuilder = (table) => {
    const builder = {
      _table: table,
      _select: null,
      _query: {},
      _payload: null,
      select(fields) {
        this._select = fields;
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
      insert(payload) {
        __shared.inserts.push({ table, payload });
        this._payload = payload;
        if (table === "creator_verifications") {
          cv = { id: "verify-1", ...payload };
        }
        return this;
      },
      update(payload) {
        __shared.updates = __shared.updates || [];
        __shared.updates.push({ table, payload });
        return this;
      },
      delete() {
        this._isDelete = true;
        return this;
      },
      resolve() {
        if (this._isDelete) {
          __shared.deletes.push({ table, query: { ...this._query } });
          return Promise.resolve({ data: null, error: null });
        }
        if (table === "creator_verifications") {
          if (cv) return Promise.resolve({ data: cv, error: null });
          return Promise.resolve({ data: null, error: null });
        }
        if (table === "verification_documents") {
          if (this._payload) {
            if (opts.insertError) {
              return Promise.resolve({ data: null, error: { message: "insert failed" } });
            }
            return Promise.resolve({
              data: { id: "doc-1", ...this._payload },
              error: null,
            });
          }
          if (this._query.document_type) {
            const found = opts.documents.find(
              (d) => d.document_type === this._query.document_type
            );
            return Promise.resolve({ data: found || null, error: null });
          }
          if (this._query.id) {
            const found = opts.documents.find((d) => d.id === this._query.id);
            return Promise.resolve({ data: found || null, error: null });
          }
          // List (by user or all) — the GET handler awaits the chain directly.
          return Promise.resolve({ data: opts.documents, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      // Make the builder awaitable (route does `await query` for list queries).
      then(resolve, reject) {
        return this.resolve().then(resolve, reject);
      },
    };
    return builder;
  };

  const supabaseAdmin = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async (path, buffer) => {
          __shared.uploads.push({ path, size: buffer?.length || 0 });
          if (opts.uploadError) return { error: { message: opts.uploadError } };
          return { error: null };
        }),
        remove: vi.fn(async (paths) => {
          __shared.removes.push(...paths);
          return { error: null };
        }),
        createSignedUrl: vi.fn(async (path, seconds) => {
          __shared.signedUrls.push({ path, seconds });
          return { data: { signedUrl: "https://signed.example/doc" }, error: null };
        }),
      })),
    },
    from: vi.fn((table) => makeBuilder(table)),
  };

  return { supabaseAdmin, __state: { opts, setCv: (row) => (cv = row) } };
});

// ─── Helpers ───

function mockReq(method = "GET", body = {}, query = {}) {
  return { method, body, query, headers: {} };
}

function mockRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res;
}

const PAN_FILE = {
  fieldName: "file",
  originalFilename: "pan.jpg",
  mimeType: "image/jpeg",
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  size: 6,
};

// ─── Tests ───

describe("API — Verification Documents", () => {
  let handler;
  let state;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetShared();
    const mod = await import("../../pages/api/verification/documents.js");
    handler = mod.default;
    const mockMod = await import("../../lib/supabaseAdmin");
    state = mockMod.__state;
    state.opts.documents = [];
    state.opts.uploadError = null;
    state.opts.insertError = null;
    state.setCv(null);
  });

  it("rejects unsupported methods", async () => {
    const res = mockRes();
    await handler(mockReq("PUT"), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("POST rejects missing documentType", async () => {
    const parse = await import("../../lib/api/parseMultipartFile");
    parse.parseMultipartFile.mockResolvedValue({ fields: {}, files: [PAN_FILE] });
    const res = mockRes();
    await handler(mockReq("POST"), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("POST rejects unsupported documentType", async () => {
    const parse = await import("../../lib/api/parseMultipartFile");
    parse.parseMultipartFile.mockResolvedValue({
      fields: { documentType: "utility_bill" },
      files: [PAN_FILE],
    });
    const res = mockRes();
    await handler(mockReq("POST"), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("POST rejects empty file list", async () => {
    const parse = await import("../../lib/api/parseMultipartFile");
    parse.parseMultipartFile.mockResolvedValue({
      fields: { documentType: "pan_card" },
      files: [],
    });
    const res = mockRes();
    await handler(mockReq("POST"), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("POST valid upload persists the REAL storage path (not masked)", async () => {
    state.setCv({ id: "verify-1" });
    const parse = await import("../../lib/api/parseMultipartFile");
    parse.parseMultipartFile.mockResolvedValue({
      fields: { documentType: "pan_card" },
      files: [PAN_FILE],
    });

    const res = mockRes();
    await handler(mockReq("POST"), res, { id: "user-1" });

    expect(res.status).toHaveBeenCalledWith(201);
    const insert = __shared.inserts.find((i) => i.table === "verification_documents");
    expect(insert).toBeTruthy();
    // Real, unmasked path persisted.
    expect(insert.payload.storage_path).toBe("user-1/identity/1700000000000-a1b2c3d4.jpg");
    expect(insert.payload.storage_path).not.toContain("***");
    expect(insert.payload.user_id).toBe("user-1");
    expect(insert.payload.verification_id).toBe("verify-1");
    expect(insert.payload.status).toBe("uploaded");

    // Response never exposes the raw path.
    const jsonBody = res.json.mock.calls[0][0];
    expect(JSON.stringify(jsonBody)).not.toContain("storage_path");
    expect(JSON.stringify(jsonBody)).not.toContain("user-1/identity");
  });

  it("POST legacy user (no creator_verifications row) backstops with the trigger statement", async () => {
    // No creator_verifications row → route must INSERT the backstop row first.
    const parse = await import("../../lib/api/parseMultipartFile");
    parse.parseMultipartFile.mockResolvedValue({
      fields: { documentType: "pan_card" },
      files: [PAN_FILE],
    });

    const res = mockRes();
    await handler(mockReq("POST"), res, { id: "user-1" });

    const backstop = __shared.inserts.find(
      (i) => i.table === "creator_verifications" && i.payload.user_id === "user-1"
    );
    expect(backstop).toBeTruthy();
    // Mirrors migration-001 trigger exactly.
    expect(backstop.payload).toMatchObject({
      verification_level: 0,
      verification_status: "pending",
      email_verified: false,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("POST blocks when the document type is already verified", async () => {
    state.setCv({ id: "verify-1" });
    state.opts.documents = [
      { id: "doc-verified", user_id: "user-1", document_type: "pan_card", storage_path: "old/path.jpg", status: "verified" },
    ];
    const parse = await import("../../lib/api/parseMultipartFile");
    parse.parseMultipartFile.mockResolvedValue({
      fields: { documentType: "pan_card" },
      files: [PAN_FILE],
    });

    const res = mockRes();
    await handler(mockReq("POST"), res, { id: "user-1" });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(__shared.uploads.length).toBe(0);
  });

  it("POST replaces a pending document (deletes old object + row, inserts new)", async () => {
    state.setCv({ id: "verify-1" });
    state.opts.documents = [
      { id: "doc-pending", user_id: "user-1", document_type: "pan_card", storage_path: "old/path.jpg", status: "uploaded" },
    ];
    const parse = await import("../../lib/api/parseMultipartFile");
    parse.parseMultipartFile.mockResolvedValue({
      fields: { documentType: "pan_card" },
      files: [PAN_FILE],
    });

    const res = mockRes();
    await handler(mockReq("POST"), res, { id: "user-1" });

    expect(res.status).toHaveBeenCalledWith(201);
    // Old storage object removed.
    expect(__shared.removes).toContain("old/path.jpg");
    // Old row deleted.
    expect(__shared.deletes.some((d) => d.query.id === "doc-pending")).toBe(true);
    const jsonBody = res.json.mock.calls[0][0];
    expect(jsonBody.document.replaced).toBe(true);
  });

  it("POST cleans up the storage object when the DB insert fails", async () => {
    state.setCv({ id: "verify-1" });
    state.opts.insertError = "db down";
    const parse = await import("../../lib/api/parseMultipartFile");
    parse.parseMultipartFile.mockResolvedValue({
      fields: { documentType: "pan_card" },
      files: [PAN_FILE],
    });

    const res = mockRes();
    await handler(mockReq("POST"), res, { id: "user-1" });

    expect(res.status).toHaveBeenCalledWith(500);
    // The just-uploaded object was cleaned up (not orphaned).
    expect(__shared.removes).toContain("user-1/identity/1700000000000-a1b2c3d4.jpg");
  });

  it("POST upload error returns 500 and persists nothing", async () => {
    state.setCv({ id: "verify-1" });
    state.opts.uploadError = "bucket full";
    const parse = await import("../../lib/api/parseMultipartFile");
    parse.parseMultipartFile.mockResolvedValue({
      fields: { documentType: "pan_card" },
      files: [PAN_FILE],
    });

    const res = mockRes();
    await handler(mockReq("POST"), res, { id: "user-1" });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(
      __shared.inserts.some((i) => i.table === "verification_documents")
    ).toBe(false);
  });

  it("GET lists only the caller's documents with signed URLs and no raw path", async () => {
    state.opts.documents = [
      {
        id: "doc-1",
        user_id: "user-1",
        document_type: "pan_card",
        document_name: "pan.jpg",
        storage_path: "user-1/identity/secret.jpg",
        mime_type: "image/jpeg",
        status: "uploaded",
      },
    ];

    const res = mockRes();
    await handler(mockReq("GET"), res, { id: "user-1" });

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonBody = res.json.mock.calls[0][0];
    expect(jsonBody.documents.length).toBe(1);
    expect(jsonBody.documents[0].signedUrl).toBe("https://signed.example/doc");
    expect(JSON.stringify(jsonBody)).not.toContain("storage_path");
    expect(JSON.stringify(jsonBody)).not.toContain("user-1/identity/secret.jpg");
  });

  it("DELETE own document removes storage object and row", async () => {
    state.opts.documents = [
      { id: "doc-1", user_id: "user-1", storage_path: "user-1/identity/a.jpg" },
    ];

    const res = mockRes();
    await handler(mockReq("DELETE", {}, { documentId: "doc-1" }), res, { id: "user-1" });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(__shared.removes).toContain("user-1/identity/a.jpg");
    expect(__shared.deletes.some((d) => d.query.id === "doc-1")).toBe(true);
  });

  it("DELETE another user's document is forbidden", async () => {
    state.opts.documents = [
      { id: "doc-other", user_id: "user-2", storage_path: "user-2/identity/a.jpg" },
    ];

    const res = mockRes();
    await handler(mockReq("DELETE", {}, { documentId: "doc-other" }), res, { id: "user-1" });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(__shared.removes.length).toBe(0);
  });

  it("DELETE missing documentId returns 400", async () => {
    const res = mockRes();
    await handler(mockReq("DELETE", {}, {}), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("DELETE unknown document returns 404", async () => {
    const res = mockRes();
    await handler(mockReq("DELETE", {}, { documentId: "nope" }), res, { id: "user-1" });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
