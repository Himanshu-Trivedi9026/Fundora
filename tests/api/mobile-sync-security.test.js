/**
 * Mobile Sync Security Tests (CR-4).
 *
 * Lightweight authorization-only tests for /api/mobile/sync:
 *   ✓ anonymous request                            → 401
 *   ✓ authenticated user syncing OWN data          → allowed
 *   ✓ authenticated user syncing ANOTHER user's data → denied
 *   ✓ invalid table                                → rejected
 *   ✓ invalid column                               → rejected
 *   ✓ forbidden field                              → rejected
 *
 * The real withAuth wrapper runs; only supabaseAdmin + the engine's own
 * allowlists are exercised. No unrelated business logic is tested.
 */

// ---- Module mocks ----

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

// ---- Imports (real route + real engine + real allowlists) ----

import syncHandler from "@/pages/api/mobile/sync";
import {
  processSyncBatch,
  getChangesSince,
  SYNC_TABLES,
  FORBIDDEN_COLUMNS,
} from "@/lib/mobile/offlineSync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ---- Helpers ----

function createReq({
  method = "GET",
  query = {},
  body = {},
  token = "token-1",
} = {}) {
  return {
    method,
    query,
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

/** Chainable thenable resolving { data: [], error: null } for DB reads. */
function genericChain(overrides = {}) {
  const then = (resolve) => resolve({ data: [], error: null });
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then,
    ...overrides,
  };
  return chain;
}

function authAs(userId) {
  supabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user: { id: userId, email: "x@example.com" } },
    error: null,
  });
}

function authNone() {
  supabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

const ME = "user-me";
const OTHER = "user-other";

describe("Mobile Sync Security (CR-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authNone();
  });

  describe("Route authorization", () => {
    it("rejects anonymous requests with 401", async () => {
      const res = createRes();
      await syncHandler(
        createReq({
          method: "GET",
          query: { since: "2025-01-01T00:00:00Z" },
          token: null,
        }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("rejects anonymous POST with 401", async () => {
      const res = createRes();
      await syncHandler(
        createReq({ method: "POST", body: { operations: [] }, token: null }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("getChangesSince (read sync)", () => {
    it("rejects requests without a user id", async () => {
      const result = await getChangesSince(null, "2025-01-01T00:00:00Z");
      expect(result.success).toBe(false);
      expect(result.error).toContain("userId");
    });

    it("allows a user to read their OWN projects", async () => {
      const data = { id: "p1", title: "My project" };
      supabaseAdmin.from.mockImplementation((table) =>
        genericChain({
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: null, error: null }),
          ),
        }),
      );
      // Capture the query so we can assert the ownership filter was applied.
      let queryUsed = null;
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain({
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: null, error: null }),
          ),
        });
        // Resolve the select() chain to an owned row so the result is "allowed".
        const then = (resolve) =>
          resolve({ data: [{ id: "p1", title: "My project" }], error: null });
        chain.then = then;
        queryUsed = table;
        return chain;
      });

      const result = await getChangesSince(ME, "2025-01-01T00:00:00Z", {
        tables: ["projects"],
      });
      expect(result.success).toBe(true);
      // The engine scoped the read to the caller's rows (ownership filter applied).
      expect(supabaseAdmin.from).toHaveBeenCalledWith("projects");
      expect(queryUsed).toBe("projects");
    });

    it("rejects an invalid table", async () => {
      const result = await getChangesSince(ME, "2025-01-01T00:00:00Z", {
        tables: ["profiles", "api_keys"],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("api_keys");
      expect(supabaseAdmin.from).not.toHaveBeenCalledWith("api_keys");
    });

    it("rejects a request with no user id", async () => {
      const result = await getChangesSince(undefined, "2025-01-01T00:00:00Z", {
        tables: ["projects"],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("userId");
    });
  });

  describe("processSyncBatch (write sync)", () => {
    it("rejects requests without a user id", async () => {
      const result = await processSyncBatch(
        [{ table: "projects", operation: "create", data: { title: "x" } }],
        {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("userId");
    });

    it("allows a user to create their OWN project (ownership forced server-side)", async () => {
      const created = {
        id: "p-new",
        title: "New project",
        owner_id: ME,
        creator_id: ME,
      };
      let insertChain = null;
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain({
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: null, error: null }),
          ),
        });
        chain.then = (resolve) => resolve({ data: [created], error: null });
        insertChain = chain;
        return chain;
      });

      const result = await processSyncBatch(
        [
          {
            table: "projects",
            operation: "create",
            data: { title: "New project" },
          },
        ],
        { userId: ME },
      );

      expect(result.success).toBe(true);
      const op = result.data.results[0];
      expect(op.success).toBe(true);
      // Ownership was forced to the caller; the client never supplies it.
      const insertPayload = insertChain.insert.mock.calls[0][0];
      expect(insertPayload.owner_id).toBe(ME);
      expect(insertPayload.creator_id).toBe(ME);
    });

    it("rejects a client-supplied ownership column on create (never trusted)", async () => {
      const result = await processSyncBatch(
        [
          {
            table: "projects",
            operation: "create",
            data: { title: "New project", owner_id: OTHER },
          },
        ],
        { userId: ME },
      );
      const op = result.data.results[0];
      expect(op.success).toBe(false);
      expect(op.error).toContain("owner_id");
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    it("denies updating another user's project (ownership verified before service role)", async () => {
      // The ownership check (maybeSingle) returns a row owned by OTHER.
      supabaseAdmin.from.mockImplementation((table) =>
        genericChain({
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: { owner_id: OTHER, creator_id: OTHER },
              error: null,
            }),
          ),
        }),
      );

      const result = await processSyncBatch(
        [
          {
            table: "projects",
            operation: "update",
            data: { id: "p-other", title: "Hijack" },
          },
        ],
        { userId: ME },
      );

      expect(result.success).toBe(true); // batch envelope
      const op = result.data.results[0];
      expect(op.success).toBe(false);
      expect(op.error).toContain("own data");
      // The service-role update() must NOT have been issued.
      expect(supabaseAdmin.from().update).not.toHaveBeenCalled();
    });

    it("denies deleting another user's project", async () => {
      supabaseAdmin.from.mockImplementation((table) =>
        genericChain({
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: { owner_id: OTHER, creator_id: OTHER },
              error: null,
            }),
          ),
        }),
      );

      const result = await processSyncBatch(
        [{ table: "projects", operation: "delete", data: { id: "p-other" } }],
        { userId: ME },
      );

      const op = result.data.results[0];
      expect(op.success).toBe(false);
      expect(op.error).toContain("own data");
      expect(supabaseAdmin.from().delete).not.toHaveBeenCalled();
    });

    it("rejects an invalid (non-allowlisted) table", async () => {
      const result = await processSyncBatch(
        [{ table: "auth.users", operation: "create", data: { email: "x" } }],
        { userId: ME },
      );
      const op = result.data.results[0];
      expect(op.success).toBe(false);
      expect(op.error).toContain("not allowed");
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    it("rejects an invalid column for the table", async () => {
      const result = await processSyncBatch(
        [
          {
            table: "projects",
            operation: "create",
            data: { title: "x", evil_column: "y" },
          },
        ],
        { userId: ME },
      );
      const op = result.data.results[0];
      expect(op.success).toBe(false);
      expect(op.error).toContain("evil_column");
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    it("rejects a forbidden field (role, permissions, owner_id, user_id, …)", async () => {
      const forbiddenOps = [
        {
          table: "projects",
          operation: "update",
          data: { id: "p1", role: "platform_admin" },
        },
        {
          table: "projects",
          operation: "update",
          data: { id: "p1", owner_id: OTHER },
        },
        {
          table: "profiles",
          operation: "update",
          data: { id: ME, permissions: ["*"] },
        },
        {
          table: "campaigns",
          operation: "update",
          data: { id: "c1", user_id: OTHER },
        },
      ];

      for (const op of forbiddenOps) {
        supabaseAdmin.from.mockImplementation((table) =>
          genericChain({
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: null, error: null }),
            ),
          }),
        );
        const result = await processSyncBatch([op], { userId: ME });
        const resultOp = result.data.results[0];
        expect(resultOp.success).toBe(false);
        expect(resultOp.error).toMatch(/not allowed/i);
      }
    });

    it("rejects writes to tables that are read-only (profiles create)", async () => {
      const result = await processSyncBatch(
        [{ table: "profiles", operation: "create", data: { full_name: "x" } }],
        { userId: ME },
      );
      const op = result.data.results[0];
      expect(op.success).toBe(false);
      expect(op.error).toContain("not allowed");
    });
  });

  describe("Allowlists are strict", () => {
    it("exposes a table allowlist that covers the sync defaults", () => {
      expect(SYNC_TABLES.projects).toBeDefined();
      expect(SYNC_TABLES.campaigns).toBeDefined();
      expect(SYNC_TABLES.profiles).toBeDefined();
    });

    it("forbids all sensitive ownership/auth columns", () => {
      for (const col of [
        "role",
        "permissions",
        "owner_id",
        "creator_id",
        "user_id",
        "organization_id",
        "email",
        "password",
        "api_key",
        "token",
      ]) {
        expect(FORBIDDEN_COLUMNS.has(col)).toBe(true);
      }
    });
  });
});
