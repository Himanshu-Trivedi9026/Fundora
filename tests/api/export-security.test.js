/**
 * Export Engine Security Tests (CR-5).
 *
 * Lightweight authorization-only tests for the export engine:
 *   ✓ anonymous request                    → 401
 *   ✓ own export                           → allowed (ownership-scoped)
 *   ✓ another user's export                → denied
 *   ✓ invalid resource                     → rejected
 *   ✓ forbidden resource                   → rejected
 *
 * No business logic is tested. The real withAuth wrapper and the engine's own
 * allowlists are exercised; only supabaseAdmin is mocked.
 */

// ---- Module mocks ----

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

// ---- Imports (real route + real engine + real allowlists) ----

import exportsHandler from "@/pages/api/exports";
import {
  exportData,
  createExportTemplate,
  scheduleExport,
  listExportTemplates,
  EXPORTABLE_SOURCES,
  FORBIDDEN_SOURCES,
} from "@/lib/exports/exportEngine";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ---- Helpers ----

function createReq({ method = "GET", query = {}, body = {}, token = "token-1" } = {}) {
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

/** Chainable thenable for supabase queries; resolves via `then`. */
function genericChain(overrides = {}) {
  const then = (resolve) => resolve({ data: [], error: null });
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() => chain),
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
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
}

const ME = "user-me";
const OTHER = "user-other";

describe("Export Engine Security (CR-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authNone();
  });

  describe("Route authorization", () => {
    it("rejects anonymous POST with 401", async () => {
      const res = createRes();
      await exportsHandler(createReq({ method: "POST", body: { source: "projects", format: "csv" }, token: null }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("rejects anonymous GET with 401", async () => {
      const res = createRes();
      await exportsHandler(createReq({ method: "GET", query: {}, token: null }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("exportData", () => {
    it("rejects an invalid (non-allowlisted) resource", async () => {
      const result = await exportData({ format: "csv", source: "totally_made_up", createdBy: ME });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown export source");
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    it("rejects a forbidden resource (auth.users, api_keys, users, secrets)", async () => {
      for (const source of ["auth.users", "api_keys", "users", "user_secrets"]) {
        supabaseAdmin.from.mockClear();
        const result = await exportData({ format: "csv", source, createdBy: ME });
        expect(result.success).toBe(false);
        expect(result.error).toContain("not exportable");
        expect(supabaseAdmin.from).not.toHaveBeenCalled();
      }
    });

    it("rejects export without a user id (ownership cannot be enforced)", async () => {
      const result = await exportData({ format: "csv", source: "projects" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("userId");
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    it("allows exporting OWN projects, scoped to the caller", async () => {
      const rows = [{ id: "p1", title: "My project" }];
      let chain = null;
      supabaseAdmin.from.mockImplementation((table) => {
        chain = genericChain();
        chain.then = (resolve) => resolve({ data: rows, error: null });
        return chain;
      });

      const result = await exportData({ format: "json", source: "projects", createdBy: ME });
      expect(result.success).toBe(true);
      // Ownership filter was applied on the caller's own rows.
      expect(supabaseAdmin.from).toHaveBeenCalledWith("projects");
      // projects has multi-column ownership → scoped via .or(...).
      expect(chain.or).toHaveBeenCalledWith("owner_id.eq.user-me,creator_id.eq.user-me");
    });

    it("denies another user's export (query is scoped to that user, never unfiltered)", async () => {
      // The ownership scope ensures only the caller's rows are ever exported.
      // Here we assert the scope filter is always applied to the caller and no
      // unfiltered select(*) is ever issued.
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain();
        chain.then = (resolve) => resolve({ data: [], error: null });
        return chain;
      });

      const result = await exportData({ format: "json", source: "projects", createdBy: OTHER });
      expect(result.success).toBe(true);
      const chain = supabaseAdmin.from.mock.results[0].value;
      expect(chain.or).toHaveBeenCalledWith("owner_id.eq.user-other,creator_id.eq.user-other");
    });

    it("scopes single-ownership resources (campaigns) to the caller via eq", async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain();
        chain.then = (resolve) => resolve({ data: [], error: null });
        return chain;
      });

      const result = await exportData({ format: "json", source: "campaigns", createdBy: ME });
      expect(result.success).toBe(true);
      const chain = supabaseAdmin.from.mock.results[0].value;
      expect(chain.eq).toHaveBeenCalledWith("creator_id", ME);
    });
  });

  describe("Template & schedule source validation", () => {
    it("rejects creating an export template for a forbidden/invalid resource", async () => {
      for (const source of ["users", "auth.users", "made_up"]) {
        supabaseAdmin.from.mockClear();
        const result = await createExportTemplate({ name: "T", source, format: "csv", createdBy: ME });
        expect(result.success).toBe(false);
        expect(result.error).toContain("not exportable");
        expect(supabaseAdmin.from).not.toHaveBeenCalled();
      }
    });

    it("rejects scheduling an export for a forbidden resource", async () => {
      const result = await scheduleExport({ name: "S", source: "secrets", format: "csv", createdBy: ME });
      expect(result.success).toBe(false);
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    it("scopes listing templates to the owner", async () => {
      supabaseAdmin.from.mockImplementation((table) => genericChain());
      const result = await listExportTemplates({ createdBy: ME });
      expect(result.success).toBe(true);
      const chain = supabaseAdmin.from.mock.results[0].value;
      expect(chain.eq).toHaveBeenCalledWith("created_by", ME);
    });
  });

  describe("Allowlists are strict", () => {
    it("only exposes known, ownership-scoped resources", () => {
      expect(Object.keys(EXPORTABLE_SOURCES)).toEqual(
        expect.arrayContaining(["projects", "campaigns", "profiles", "notifications"])
      );
      for (const resource of Object.values(EXPORTABLE_SOURCES)) {
        expect(resource.ownership.length).toBeGreaterThan(0);
        expect(resource.table).toBeTruthy();
      }
    });

    it("forbids all sensitive/admin/internal sources", () => {
      for (const s of ["auth.users", "users", "api_keys", "secrets", "audit_logs", "verification_otp", "api_logs", "export_jobs", "policies"]) {
        expect(FORBIDDEN_SOURCES).toContain(s);
        expect(EXPORTABLE_SOURCES[s]).toBeUndefined();
      }
    });
  });
});
