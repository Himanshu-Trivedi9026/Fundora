import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { executeActions, ACTION_TYPES } from "../../lib/automation/workflowEngine";

function mockInsertSingle(result) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe("debug auto3", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("multiple actions", async () => {
    const actions = [
      { type: ACTION_TYPES.SEND_NOTIFICATION, name: "step_1", config: { userId: "user-1", title: "First", message: "OK" } },
      { type: ACTION_TYPES.UPDATE_STATUS, name: "step_2", config: { entityType: "public_donations", entityId: "don-1", statusField: "status", statusValue: "active" } },
    ];
    const context = { workflowId: "wf-act", runId: "run-act", userId: "user-1" };

    // Step 1: workflow_logs insert
    supabaseAdmin.from.mockImplementationOnce(function() {
      console.log("MOCK 1: workflow_logs insert");
      return mockInsertSingle({ id: "log-1" });
    });
    // Step 1: notifications insert
    supabaseAdmin.from.mockImplementationOnce(function() {
      console.log("MOCK 2: notifications insert");
      return mockInsertSingle({ id: "notif-1" });
    });
    // Step 1: workflow_logs update
    supabaseAdmin.from.mockImplementationOnce(function() {
      console.log("MOCK 3: workflow_logs update");
      return {
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    // Step 2: workflow_logs insert
    supabaseAdmin.from.mockImplementationOnce(function() {
      console.log("MOCK 4: step2 workflow_logs insert");
      return mockInsertSingle({ id: "log-2" });
    });
    // Step 2: UPDATE_STATUS — update entity
    supabaseAdmin.from.mockImplementationOnce(function() {
      console.log("MOCK 5: UPDATE_STATUS entity update");
      return {
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });
    // Step 2: workflow_logs update
    supabaseAdmin.from.mockImplementationOnce(function() {
      console.log("MOCK 6: step2 workflow_logs update");
      return {
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    // Spy on from to see what's happening
    const origFrom = supabaseAdmin.from;
    supabaseAdmin.from = vi.fn(function(...args) {
      console.log("FROM called:", args[0], "remaining mocks:", supabaseAdmin.from.mock.results.filter(r => r.type === 'return').length);
      const r = origFrom.apply(this, args);
      return r;
    });
    // Restore implementations from origFrom's queue
    // Actually, this approach won't work since we already captured origFrom

    try {
      const result = await executeActions({ actions, context });
      console.log("RESULT:", JSON.stringify(result, null, 2));
    } catch(e) {
      console.log("ERROR:", e.message);
    }
  });
});
