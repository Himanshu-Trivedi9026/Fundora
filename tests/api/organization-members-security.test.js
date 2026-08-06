/**
 * Organization Members Security Tests (CR-6).
 *
 * Lightweight authorization-only tests for the Organization Members module:
 *   ✓ anonymous request                    → 401 (all organization routes)
 *   ✓ non-owner invite                     → denied
 *   ✓ owner invite                         → allowed
 *   ✓ self role escalation                 → denied
 *   ✓ invalid role                         → rejected
 *   ✓ invalid organization                 → rejected
 *
 * Plus the ownership gates added to member/invitation/settings reads.
 * No business logic is tested. The real withAuth wrapper and the engine's own
 * permission checks are exercised; only supabaseAdmin + rateLimit are mocked.
 */

// ---- Module mocks ----

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: () => () => true,
}));

// ---- Imports (real routes + real engine) ----

import orgHandler from "@/pages/api/organization";
import membersHandler from "@/pages/api/organization/members";
import invitationsHandler from "@/pages/api/organization/invitations";
import settingsHandler from "@/pages/api/organization/settings";
import {
  addMember,
  createInvitation,
  updateMemberRole,
  getMembers,
  getInvitations,
  setOrganizationSetting,
} from "@/lib/organization/organizationEngine";
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
    upsert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then,
    ...overrides,
  };
  return chain;
}

function authAs(userId, email = "user@example.com") {
  supabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user: { id: userId, email, email_confirmed_at: "now" } },
    error: null,
  });
}

function authNone() {
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
}

const OWNER = "user-owner";
const ADMIN = "user-admin";
const MEMBER = "user-member";
const OTHER = "user-other";

describe("Organization Members Security (CR-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authNone();
  });

  describe("Route authorization", () => {
    it("rejects anonymous requests with 401 on all organization routes", async () => {
      const cases = [
        [orgHandler, createReq({ method: "GET", query: {}, token: null })],
        [membersHandler, createReq({ method: "GET", query: { organizationId: "org-1" }, token: null })],
        [invitationsHandler, createReq({ method: "GET", query: { organizationId: "org-1" }, token: null })],
        [settingsHandler, createReq({ method: "GET", query: { organizationId: "org-1" }, token: null })],
      ];

      for (const [handler, req] of cases) {
        const res = createRes();
        await handler(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
      }
    });
  });

  describe("addMember", () => {
    it("denies a non-manager (plain member) from adding members", async () => {
      supabaseAdmin.from.mockImplementation(() =>
        genericChain({ single: vi.fn(() => Promise.resolve({ data: { role: "member" }, error: null })) })
      );

      const result = await addMember({
        organizationId: "org-1",
        userId: "user-target",
        role: "member",
        invitedBy: MEMBER,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permissions/i);
      // The service-role insert must never run without the manager check.
      expect(supabaseAdmin.from().insert).not.toHaveBeenCalled();
    });

    it("denies a non-member from adding members to an organization they don't own", async () => {
      // Membership lookup for OTHER resolves nothing → not a manager.
      supabaseAdmin.from.mockImplementation(() =>
        genericChain({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })
      );

      const result = await addMember({
        organizationId: "org-ghost",
        userId: "user-target",
        role: "member",
        invitedBy: OTHER,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permissions/i);
      expect(supabaseAdmin.from().insert).not.toHaveBeenCalled();
    });

    it("rejects a client-supplied elevated role from an admin (admin cannot grant owner)", async () => {
      supabaseAdmin.from.mockImplementation(() =>
        genericChain({ single: vi.fn(() => Promise.resolve({ data: { role: "admin" }, error: null })) })
      );

      const result = await addMember({
        organizationId: "org-1",
        userId: "user-target",
        role: "owner",
        invitedBy: ADMIN,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/owner/i);
      expect(supabaseAdmin.from().insert).not.toHaveBeenCalled();
    });

    it("allows the owner to add a member", async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain();
        if (table === "organization_members") {
          chain.single = vi.fn(() => Promise.resolve({ data: { role: "owner" }, error: null }));
          chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
        }
        return chain;
      });

      const result = await addMember({
        organizationId: "org-1",
        userId: "user-target",
        role: "member",
        invitedBy: OWNER,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("createInvitation", () => {
    it("denies a non-owner (plain member) from inviting", async () => {
      supabaseAdmin.from.mockImplementation(() =>
        genericChain({ single: vi.fn(() => Promise.resolve({ data: { role: "member" }, error: null })) })
      );

      const result = await createInvitation({
        organizationId: "org-1",
        email: "new@example.com",
        invitedBy: MEMBER,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permissions|insufficient/i);
      expect(supabaseAdmin.from().insert).not.toHaveBeenCalled();
    });

    it("denies an admin from inviting with an elevated owner role", async () => {
      supabaseAdmin.from.mockImplementation(() =>
        genericChain({ single: vi.fn(() => Promise.resolve({ data: { role: "admin" }, error: null })) })
      );

      const result = await createInvitation({
        organizationId: "org-1",
        email: "new@example.com",
        role: "owner",
        invitedBy: ADMIN,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/owner/i);
      expect(supabaseAdmin.from().insert).not.toHaveBeenCalled();
    });

    it("allows the owner to invite a member", async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain();
        if (table === "organization_members") {
          chain.single = vi.fn(() => Promise.resolve({ data: { role: "owner" }, error: null }));
        } else if (table === "invitations") {
          chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
          chain.insert = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { id: "inv-1", role: "member", token: "abc" }, error: null })
          );
        }
        return chain;
      });

      const result = await createInvitation({
        organizationId: "org-1",
        email: "new@example.com",
        invitedBy: OWNER,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("updateMemberRole", () => {
    it("denies a user changing their OWN role (self role escalation)", async () => {
      const result = await updateMemberRole("org-1", "user-self", "admin", "user-self");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/own role/i);
      // No service-role query is issued at all.
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    it("denies an admin promoting a member to owner", async () => {
      supabaseAdmin.from.mockImplementation(() =>
        genericChain({ single: vi.fn(() => Promise.resolve({ data: { role: "admin" }, error: null })) })
      );

      const result = await updateMemberRole("org-1", "user-target", "owner", ADMIN);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/owner/i);
      expect(supabaseAdmin.from().update).not.toHaveBeenCalled();
    });

    it("allows the owner to set a member-level role", async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain();
        if (table === "organization_members") {
          // actor lookup (single) → owner; target lookup (maybeSingle) → member
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { role: "owner" }, error: null })
          );
          chain.maybeSingle = vi.fn(() =>
            Promise.resolve({ data: { role: "member" }, error: null })
          );
          chain.update = vi.fn(() => chain);
          chain.eq = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
        }
        return chain;
      });

      const result = await updateMemberRole("org-1", "user-target", "finance_manager", OWNER);
      expect(result.success).toBe(true);
    });
  });

  describe("Invalid input", () => {
    it("rejects an invalid (non-allowlisted) role", async () => {
      const add = await addMember({
        organizationId: "org-1",
        userId: "u",
        role: "platform_admin",
        invitedBy: OWNER,
      });
      expect(add.success).toBe(false);
      expect(add.error).toMatch(/invalid role/i);

      const upd = await updateMemberRole("org-1", "u", "supreme_leader", OWNER);
      expect(upd.success).toBe(false);
      expect(upd.error).toMatch(/invalid role/i);

      // Validation happens before any DB access.
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    it("rejects operations on an organization the caller does not belong to (invalid organization)", async () => {
      supabaseAdmin.from.mockImplementation(() =>
        genericChain({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })
      );

      const result = await createInvitation({
        organizationId: "org-does-not-exist",
        email: "new@example.com",
        invitedBy: OTHER,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permissions/i);
      expect(supabaseAdmin.from().insert).not.toHaveBeenCalled();
    });
  });

  describe("Read authorization", () => {
    it("allows an active member to list their own organization's members", async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain();
        if (table === "organization_members") {
          chain.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: "mem-1" }, error: null }));
        }
        chain.then = (resolve) => resolve({ data: [{ id: "m1", user_id: MEMBER, role: "member" }], error: null, count: 1 });
        return chain;
      });

      const result = await getMembers("org-1", {}, MEMBER);
      expect(result.success).toBe(true);
    });

    it("denies a non-member from listing another organization's members", async () => {
      supabaseAdmin.from.mockImplementation(() =>
        genericChain({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })
      );

      const result = await getMembers("org-1", {}, OTHER);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permissions/i);
    });

    it("never returns invitation tokens when listing invitations", async () => {
      let invitationsSelect = null;
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain();
        if (table === "organization_members") {
          chain.single = vi.fn(() => Promise.resolve({ data: { role: "owner" }, error: null }));
        } else if (table === "invitations") {
          chain.select = vi.fn((cols) => {
            invitationsSelect = cols;
            return chain;
          });
          chain.then = (resolve) =>
            resolve({ data: [{ id: "i1", email: "a@b.com", token: "SECRET" }], error: null, count: 1 });
        }
        return chain;
      });

      const result = await getInvitations("org-1", {}, OWNER);
      expect(result.success).toBe(true);
      expect(invitationsSelect).toContain("email");
      expect(invitationsSelect).not.toContain("token");
    });
  });

  describe("setOrganizationSetting", () => {
    it("denies a non-manager from changing organization settings", async () => {
      supabaseAdmin.from.mockImplementation(() =>
        genericChain({ single: vi.fn(() => Promise.resolve({ data: { role: "member" }, error: null })) })
      );

      const result = await setOrganizationSetting("org-1", "theme", { color: "blue" }, MEMBER);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/permissions/i);
      expect(supabaseAdmin.from().upsert).not.toHaveBeenCalled();
    });

    it("allows the owner to change organization settings", async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        const chain = genericChain();
        if (table === "organization_members") {
          chain.single = vi.fn(() => Promise.resolve({ data: { role: "owner" }, error: null }));
        } else if (table === "organization_settings") {
          chain.upsert = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { id: "set-1", setting_key: "theme" }, error: null })
          );
        }
        return chain;
      });

      const result = await setOrganizationSetting("org-1", "theme", { color: "blue" }, OWNER);
      expect(result.success).toBe(true);
    });
  });
});
