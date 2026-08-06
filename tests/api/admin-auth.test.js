/**
 * Admin API Authorization Security Tests (CR-3).
 *
 * These tests verify ONLY role enforcement for every route under
 * pages/api/admin/**:
 *   - anonymous request  → 401 (withAuth rejects missing token)
 *   - donor request      → 403 (withRole rejects non-admin role)
 *   - creator request    → 403 (withRole rejects non-admin role)
 *   - platform_admin     → reaches the handler (not blocked by 401/403)
 *
 * No admin engine (escrow, fraud, payouts, analytics, moderation, appeals,
 * compliance, policy, verification) is mocked — those are exercised by their
 * own suites. The real withAuth/withRole wrappers ARE used, so these tests
 * prove the routes' actual authorization behavior.
 */

// ---- Minimal mocks: only auth substrate + rate limiter ----

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => vi.fn(() => true)),
}));

// ---- Route imports (real withAuth/withRole wrappers applied) ----

import appealsHandler from "@/pages/api/admin/appeals-dashboard";
import identityReviewHandler from "@/pages/api/admin/identity-review";
import bankReviewHandler from "@/pages/api/admin/bank-review";
import businessReviewHandler from "@/pages/api/admin/business-review";
import complianceHandler from "@/pages/api/admin/compliance-dashboard";
import escrowHandler from "@/pages/api/admin/escrow-dashboard";
import fraudHandler from "@/pages/api/admin/fraud-dashboard";
import moderationHandler from "@/pages/api/admin/moderation-dashboard";
import payoutReviewHandler from "@/pages/api/admin/payout-review";
import analyticsHandler from "@/pages/api/admin/platform-analytics";
import policyHandler from "@/pages/api/admin/policy-management";
import reviewQueueHandler from "@/pages/api/admin/review-queue";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ROLES } from "@/lib/roles";

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

/**
 * Chainable thenable supabase query used ONLY so that any route-internal DB
 * read after the auth gate resolves instead of hanging. Route business logic
 * is not asserted on; the response code simply must not be 401/403.
 */
function genericChain() {
  const then = (resolve) => resolve({ data: [], error: null });
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    like: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
    then,
  };
  return chain;
}

/** withRole looks up the caller's role on public.profiles via maybeSingle. */
function setRole(role) {
  supabaseAdmin.from.mockImplementation((table) => {
    if (table === "profiles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: role ? { role } : null, error: null })
            ),
          })),
        })),
      };
    }
    return genericChain();
  });
}

function authOk() {
  supabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user: { id: "user-123", email: "admin@example.com" } },
    error: null,
  });
}

function authNone() {
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
}

// Each entry: a request an authorized platform_admin would make. The route's
// business logic is not asserted; we only assert the auth gate lets it through.
const ADMIN_ROUTES = [
  { name: "appeals-dashboard", handler: appealsHandler, req: { method: "GET", query: {}, body: {} } },
  { name: "bank-review", handler: bankReviewHandler, req: { method: "POST", query: {}, body: { action: "approve", verificationId: "v-1" } } },
  { name: "business-review", handler: businessReviewHandler, req: { method: "POST", query: {}, body: { action: "approve", verificationId: "v-1" } } },
  { name: "compliance-dashboard", handler: complianceHandler, req: { method: "GET", query: {}, body: {} } },
  { name: "escrow-dashboard", handler: escrowHandler, req: { method: "GET", query: {}, body: {} } },
  { name: "fraud-dashboard", handler: fraudHandler, req: { method: "GET", query: {}, body: {} } },
  { name: "identity-review", handler: identityReviewHandler, req: { method: "POST", query: {}, body: { action: "approve", verificationId: "v-1" } } },
  { name: "moderation-dashboard", handler: moderationHandler, req: { method: "GET", query: {}, body: {} } },
  { name: "payout-review", handler: payoutReviewHandler, req: { method: "GET", query: {}, body: {} } },
  { name: "platform-analytics", handler: analyticsHandler, req: { method: "GET", query: {}, body: {} } },
  { name: "policy-management", handler: policyHandler, req: { method: "GET", query: {}, body: {} } },
  { name: "review-queue", handler: reviewQueueHandler, req: { method: "GET", query: {}, body: {} } },
];

describe("Admin API Authorization (CR-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authNone();
  });

  for (const { name, handler, req } of ADMIN_ROUTES) {
    describe(`/api/admin/${name}`, () => {
      it("rejects anonymous requests with 401", async () => {
        const res = createRes();
        await handler(createReq({ ...req, token: null }), res);
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it("rejects donor with 403", async () => {
        setRole(ROLES.INVESTOR);
        authOk();
        const res = createRes();
        await handler(createReq(req), res);
        expect(res.status).toHaveBeenCalledWith(403);
      });

      it("rejects creator with 403", async () => {
        setRole(ROLES.CREATOR);
        authOk();
        const res = createRes();
        await handler(createReq(req), res);
        expect(res.status).toHaveBeenCalledWith(403);
      });

      it("allows platform_admin through to the handler", async () => {
        setRole(ROLES.ADMIN);
        authOk();
        const res = createRes();
        // The handler may throw downstream (its engines are not mocked here);
        // that is irrelevant to role enforcement. The auth gate must NOT
        // reject with 401/403.
        await handler(createReq(req), res).catch(() => {});
        expect(res.status).not.toHaveBeenCalledWith(401);
        expect(res.status).not.toHaveBeenCalledWith(403);
      });
    });
  }
});
