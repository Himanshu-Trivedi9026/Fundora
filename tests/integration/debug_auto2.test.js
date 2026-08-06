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
        single: vi.fn().mockResolvedValue({ data: result, error: null }),
      }),
    }),
  };
}

describe("debug auto2", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("multiple actions", async () => {
    const actions = [
      { type: ACTION_TYPES.SEND_NOTIFICATION, name: "step_1", config: { userId: "user-1", title: "First", message: "OK" } },
      { type: ACTION_TYPES.UPDATE_STATUS, name: "step_2", config: { entityType: "public_donations", entityId: "don-1", statusField: "status", statusValue: "active" } },
      { type: ACTION_TYPES.SEND_NOTIFICATION, name: "step_3", config: { userId: "user-2", title: "Third", message: "Should not run" } },
    ];
    const context = { workflowId: "wf-act", runId: "run-act", userId: "user-1" };

    // Step 1: workflow_logs insert
    supabaseAdmin.from.mockImplementationOnce(() => mockInsertSingle({ id: "log-1" }));
    // Step 1: notifications insert
    supabaseAdmin.from.mockImplementationOnce(() => mockInsertSingle({ id: "notif-1" }));
    // Step 1: workflow_logs update
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));

    // Step 2: workflow_logs insert
    supabaseAdmin.from.mockImplementationOnce(() => mockInsertSingle({ id: "log-2" }));
    // Step 2: UPDATE_STATUS — update entity succeeds
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));
    // Step 2: workflow_logs update
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));

    // Step 3: SEND_NOTIFICATION — workflow_logs insert
    supabaseAdmin.from.mockImplementationOnce(() => mockInsertSingle({ id: "log-3" }));
    // Step 3: notifications insert
    supabaseAdmin.from.mockImplementationOnce(() => mockInsertSingle({ id: "notif-3" }));
    // Step 3: workflow_logs update
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));

    const result = await executeActions({ actions, context });

    expect(result.success).toBe(true);
    expect(result.data.results.length).toBe(3);
  });
});
