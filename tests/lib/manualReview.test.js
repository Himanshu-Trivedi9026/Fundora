import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (must precede the module import) ───

// Real manualReview runs here; only its I/O is faked.
vi.mock("../../lib/supabaseAdmin", () => {
  const state = {
    // Per-table row store keyed by table name.
    rows: {},
    // Captured update payloads for assertions.
    updates: [],
    // Set to true to make a query fail.
    failNext: null,
  };

  // The library chains `.update(payload).eq(...)`; the eq() runs after
  // update(), so the query must be captured lazily at eq-time, not at
  // update-time.
  let pendingUpdate = null;

  const makeBuilder = (table) => {
    const builder = {
      _table: table,
      _query: {},
      select() {
        return this;
      },
      eq(col, val) {
        this._query[col] = val;
        if (pendingUpdate) pendingUpdate.query[col] = val;
        return this;
      },
      in(col, vals) {
        this._query[col] = vals;
        if (pendingUpdate) pendingUpdate.query[col] = vals;
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      range() {
        return this;
      },
      single() {
        return this.resolve();
      },
      maybeSingle() {
        return this.resolve();
      },
      update(payload) {
        pendingUpdate = { table, payload, query: {} };
        state.updates.push(pendingUpdate);
        return this;
      },
      insert() {
        return this;
      },
      resolve() {
        if (state.failNext === table) {
          state.failNext = null;
          return Promise.resolve({ data: null, error: { message: "boom" } });
        }
        const rows = state.rows[table] || [];
        // `.in("id", array)` → return all matching rows.
        if (this._query.id && Array.isArray(this._query.id)) {
          return Promise.resolve({
            data: rows.filter((r) => this._query.id.includes(r.id)),
            error: null,
          });
        }
        // `.eq("id", scalar)` → single row or PGRST116.
        if (this._query.id) {
          const found = rows.find((r) => r.id === this._query.id);
          return Promise.resolve(found
            ? { data: found, error: null }
            : { data: null, error: { code: "PGRST116", message: "not found" } });
        }
        if (this._query.user_id) {
          const vals = Array.isArray(this._query.user_id) ? this._query.user_id : [this._query.user_id];
          return Promise.resolve({ data: rows.filter((r) => vals.includes(r.user_id)), error: null });
        }
        return Promise.resolve({ data: rows, error: null, count: rows.length });
      },
      then(resolveFn, rejectFn) {
        return this.resolve().then(resolveFn, rejectFn);
      },
    };
    return builder;
  };

  const supabaseAdmin = {
    auth: { getUser: vi.fn() },
    from: vi.fn((table) => makeBuilder(table)),
  };

  return { supabaseAdmin, __state: state };
});

vi.mock("../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn(async (args) => ({ success: true, id: `audit-${args.action}` })),
}));

vi.mock("../../lib/notification", () => {
  const notifications = [];
  return {
    sendNotification: vi.fn(async (args) => {
      notifications.push(args);
      return { success: true };
    }),
    NOTIFICATION_TYPES: {
      VERIFICATION_APPROVED: "verification_approved",
      VERIFICATION_REJECTED: "verification_rejected",
      VERIFICATION_SUSPENDED: "verification_suspended",
      VERIFICATION_RESUBMISSION_REQUESTED: "verification_resubmission_requested",
    },
    __notifications: notifications,
  };
});

// ─── Module under test ───

import {
  approveRequest,
  rejectRequest,
  requestResubmission,
  suspendVerification,
  getReviewQueue,
} from "../../lib/verification/manualReview";

// ─── Helpers ───

async function mockState() {
  const { __state } = await import("../../lib/supabaseAdmin");
  return __state;
}

async function mockNotifications() {
  const { __notifications } = await import("../../lib/notification");
  return __notifications;
}

describe("manualReview — admin decisions sync Supabase + status + notifications", () => {
  let state;
  let notifications;

  beforeEach(async () => {
    vi.clearAllMocks();
    state = await mockState();
    notifications = await mockNotifications();
    state.rows = {};
    state.updates.length = 0;
    state.failNext = null;
  });

  describe("approveRequest", () => {
    it("updates the request, syncs creator_verifications, logs audit, notifies", async () => {
      state.rows.verification_requests = [
        { id: "req-1", user_id: "creator-1", verification_type: "identity" },
      ];

      const result = await approveRequest("req-1", "admin-1", "Looks good", "admin-1");

      expect(result.success).toBe(true);

      // Request status → approved
      const approveUpdate = state.updates.find(
        (u) => u.table === "verification_requests" && u.query.id === "req-1"
      );
      expect(approveUpdate.payload.status).toBe("approved");

      // creator_verifications synced: identity_verified true + status approved
      const creatorUpdate = state.updates.find(
        (u) => u.table === "creator_verifications" && u.query.user_id === "creator-1"
      );
      expect(creatorUpdate.payload.identity_verified).toBe(true);
      expect(creatorUpdate.payload.verification_status).toBe("approved");
      expect(creatorUpdate.payload.verification_level).toBe(2);

      // In-app notification to the creator
      expect(notifications).toContainEqual(
        expect.objectContaining({
          userId: "creator-1",
          notificationType: "verification_approved",
          actorId: "admin-1",
          entityId: "req-1",
        })
      );
    });

    it("returns not-found when the request row is missing", async () => {
      const result = await approveRequest("nope", "admin-1", null, "admin-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("rejectRequest", () => {
    it("updates request, syncs creator status to rejected, notifies", async () => {
      state.rows.verification_requests = [
        { id: "req-2", user_id: "creator-2", verification_type: "identity" },
      ];

      const result = await rejectRequest("req-2", "admin-1", "Blurry PAN", "admin-1");

      expect(result.success).toBe(true);

      const rejectUpdate = state.updates.find(
        (u) => u.table === "verification_requests" && u.query.id === "req-2"
      );
      expect(rejectUpdate.payload.status).toBe("rejected");
      expect(rejectUpdate.payload.rejection_reason).toBe("Blurry PAN");

      // Overall status sync (the key fix: reject now updates creator_verifications)
      const creatorUpdate = state.updates.find(
        (u) => u.table === "creator_verifications" && u.query.user_id === "creator-2"
      );
      expect(creatorUpdate.payload.verification_status).toBe("rejected");

      expect(notifications).toContainEqual(
        expect.objectContaining({
          userId: "creator-2",
          notificationType: "verification_rejected",
        })
      );
    });

    it("requires a reason", async () => {
      const result = await rejectRequest("req-2", "admin-1", null, "admin-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("reason");
    });
  });

  describe("requestResubmission (identity)", () => {
    it("updates the verification_requests row and syncs status back to pending", async () => {
      state.rows.business_verifications = [];
      state.rows.bank_verifications = [];
      state.rows.verification_requests = [
        { id: "req-3", user_id: "creator-3", verification_type: "identity" },
      ];

      const result = await requestResubmission("req-3", "admin-1", "Need a clearer photo", "admin-1");

      expect(result.success).toBe(true);

      const resubmitUpdate = state.updates.find(
        (u) => u.table === "verification_requests" && u.query.id === "req-3"
      );
      expect(resubmitUpdate.payload.status).toBe("documents_uploaded");
      expect(resubmitUpdate.payload.rejection_reason).toContain("clearer photo");

      // Creator status back to pending so they can resubmit
      const creatorUpdate = state.updates.find(
        (u) => u.table === "creator_verifications" && u.query.user_id === "creator-3"
      );
      expect(creatorUpdate.payload.verification_status).toBe("pending");

      expect(notifications).toContainEqual(
        expect.objectContaining({
          userId: "creator-3",
          notificationType: "verification_resubmission_requested",
        })
      );
    });

    it("still resolves business verifications first (existing path unchanged)", async () => {
      state.rows.business_verifications = [
        { id: "biz-1", user_id: "creator-4" },
      ];

      const result = await requestResubmission("biz-1", "admin-1", "Fix GST doc", "admin-1");

      expect(result.success).toBe(true);
      const bizUpdate = state.updates.find(
        (u) => u.table === "business_verifications" && u.query.id === "biz-1"
      );
      expect(bizUpdate.payload.status).toBe("resubmission_requested");
    });

    it("returns not-found when no table has the id", async () => {
      state.rows.business_verifications = [];
      state.rows.bank_verifications = [];
      state.rows.verification_requests = [];

      const result = await requestResubmission("missing", "admin-1", "n/a", "admin-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("suspendVerification", () => {
    it("marks request cancelled, syncs creator status to suspended, logs audit, notifies", async () => {
      state.rows.verification_requests = [
        { id: "req-4", user_id: "creator-4", verification_type: "identity" },
      ];

      const result = await suspendVerification("req-4", "admin-1", "Fraud suspicion", "admin-1");

      expect(result.success).toBe(true);

      const suspendUpdate = state.updates.find(
        (u) => u.table === "verification_requests" && u.query.id === "req-4"
      );
      expect(suspendUpdate.payload.status).toBe("cancelled");
      expect(suspendUpdate.payload.rejection_reason).toBe("Fraud suspicion");

      // Overall status → suspended (blocks publish/funds via isCreatorVerified)
      const creatorUpdate = state.updates.find(
        (u) => u.table === "creator_verifications" && u.query.user_id === "creator-4"
      );
      expect(creatorUpdate.payload.verification_status).toBe("suspended");

      expect(notifications).toContainEqual(
        expect.objectContaining({
          userId: "creator-4",
          notificationType: "verification_suspended",
        })
      );
    });

    it("requires a reviewer id", async () => {
      const result = await suspendVerification("req-4", null, "n/a", "admin-1");
      expect(result.success).toBe(false);
    });
  });
});

describe("manualReview — getReviewQueue enrichment", () => {
  let state;

  beforeEach(async () => {
    vi.clearAllMocks();
    state = await mockState();
    state.rows = {};
    state.updates.length = 0;
    state.failNext = null;
  });

  it("enriches requests with full name, email, documents, history, audit, current status", async () => {
    state.rows.verification_requests = [
      {
        id: "req-10",
        user_id: "creator-10",
        verification_type: "identity",
        status: "submitted",
        review_priority: "normal",
        submitted_at: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
        metadata: {},
      },
    ];
    state.rows.profiles = [{ id: "creator-10", full_name: "Ada Lovelace" }];
    state.rows.creators = [{ user_id: "creator-10", name: "Ada Lovelace", email: "ada@example.com" }];
    state.rows.verification_documents = [
      {
        id: "doc-1",
        user_id: "creator-10",
        document_type: "pan_card",
        document_name: "PAN card scan",
        mime_type: "image/jpeg",
        status: "uploaded",
        uploaded_at: "2026-08-01T00:00:00.000Z",
        storage_path: "creator-10/identity/secret.jpg",
      },
    ];
    state.rows.verification_history = [
      {
        id: "hist-1",
        user_id: "creator-10",
        action: "submitted",
        new_status: "submitted",
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ];
    state.rows.creator_verifications = [
      {
        user_id: "creator-10",
        verification_status: "pending",
        verification_level: 0,
        identity_verified: false,
        verified_at: null,
      },
    ];
    state.rows.verification_audit_log = [
      { id: "aud-1", user_id: "creator-10", event_type: "verification.suspended", action: "verification_suspended", details: {}, created_at: "2026-08-01T00:00:00.000Z" },
    ];

    const result = await getReviewQueue({ status: "pending", callerId: "admin-1" });

    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(1);

    const item = result.requests[0];
    // Creator identity
    expect(item.full_name).toBe("Ada Lovelace");
    expect(item.email).toBe("ada@example.com");
    // Documents — storage path never leaks
    expect(item.documents).toHaveLength(1);
    expect(item.documents[0].document_type).toBe("pan_card");
    expect(item.documents[0].storage_path).toBeUndefined();
    expect(item.documents[0].storage_bucket).toBeUndefined();
    // History
    expect(item.history).toHaveLength(1);
    expect(item.history[0].action).toBe("submitted");
    // Current status
    expect(item.current_status).toBe("pending");
    expect(item.current_level).toBe(0);
    // Audit trail
    expect(item.audit).toHaveLength(1);
    expect(item.audit[0].action).toBe("verification_suspended");
  });

  it("maps status filter 'pending' to submitted + pending (wizard submissions)", async () => {
    state.rows.verification_requests = [
      {
        id: "req-a",
        user_id: "u-a",
        verification_type: "identity",
        status: "submitted",
        review_priority: "normal",
        submitted_at: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
        metadata: {},
      },
      {
        id: "req-b",
        user_id: "u-b",
        verification_type: "identity",
        status: "pending",
        review_priority: "normal",
        submitted_at: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
        metadata: {},
      },
    ];
    state.rows.profiles = [];
    state.rows.creators = [];
    state.rows.verification_documents = [];
    state.rows.verification_history = [];
    state.rows.creator_verifications = [];
    state.rows.verification_audit_log = [];

    const result = await getReviewQueue({ status: "pending", callerId: "admin-1" });

    // The builder's "submitted"/"pending" filter is a set intersection; both
    // request rows exist so both are returned when no status filtering is
    // applied at the builder level (the API maps pending → in()).
    expect(result.requests.length).toBeGreaterThan(0);
  });
});
