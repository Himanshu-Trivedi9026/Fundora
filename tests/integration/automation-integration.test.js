/**
 * Workflow Automation Integration Tests — Cross-module workflow engine workflows.
 *
 * Verifies that the workflow automation system's CRUD, execution, condition
 * evaluation, action execution, templates, retry, and scheduled processing
 * work together correctly through real function-to-function call chains.
 *
 * External dependencies (DB, logger, audit) are mocked; internal module
 * interactions are exercised through the actual code paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (BEFORE imports) ─────────────────────────────────────────────────

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

// ─── Imports ────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import {
  createWorkflow,
  enableWorkflow,
  disableWorkflow,
  triggerWorkflow,
  evaluateConditions,
  executeActions,
  getWorkflowRuns,
  getWorkflowRun,
  retryWorkflowRun,
  createWorkflowTemplate,
  instantiateFromTemplate,
  processScheduledWorkflows,
  TRIGGER_TYPES,
  ACTION_TYPES,
  CONDITION_TYPES,
} from "../../lib/automation/workflowEngine";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Mock supabaseAdmin.from().insert().select().single() to resolve with `result`.
 */
function mockInsertSingle(result) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

/**
 * Mock supabaseAdmin.from().update().eq().select().single() to resolve with `result`.
 */
function mockUpdateSingle(result) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

/**
 * Mock supabaseAdmin.from().select().eq().single() to resolve with `result`.
 */
function mockSelectSingle(result) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

/**
 * Build a minimal valid workflow definition for testing.
 */
function makeWorkflow(overrides = {}) {
  return {
    name: "Test Workflow",
    description: "A test workflow",
    triggerType: TRIGGER_TYPES.EVENT,
    conditions: [],
    actions: [
      {
        type: ACTION_TYPES.SEND_NOTIFICATION,
        name: "send_welcome",
        config: {
          userId: "user-1",
          notificationType: "system",
          title: "Welcome",
          message: "Hello!",
        },
      },
    ],
    retryConfig: {},
    scheduleConfig: {},
    createdBy: "admin-1",
    organizationId: null,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Workflow Automation Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks does NOT clear mockImplementationOnce queues.
    // Reset the from mock to prevent leftover mocks from previous tests leaking.
    supabaseAdmin.from.mockReset();
    supabaseAdmin.from.mockReturnThis();
  });

  // ─── Test 1: Full workflow lifecycle ───────────────────────────────────────

  it("workflow lifecycle: create → enable → trigger → verify run → disable", async () => {
    const workflowId = "wf-001";
    const runId = "run-001";

    // ── Step 1: Create ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: { id: workflowId, name: "Lifecycle Test", enabled: true, trigger_type: "event" },
        error: null,
      })
    );

    const createResult = await createWorkflow(makeWorkflow({
      name: "Lifecycle Test",
    }));

    expect(createResult.success).toBe(true);
    expect(createResult.data).toBeDefined();

    // ── Step 2: Enable (already enabled, but verify call) ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockUpdateSingle({
        data: { id: workflowId, enabled: true },
        error: null,
      })
    );

    const enableResult = await enableWorkflow(workflowId, "admin-1");
    expect(enableResult.success).toBe(true);

    // ── Step 3: Trigger ──
    // First: getWorkflow fetch
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockSelectSingle({
        data: {
          id: workflowId,
          name: "Lifecycle Test",
          enabled: true,
          trigger_type: "event",
          conditions: [],
          actions: [
            {
              type: ACTION_TYPES.SEND_NOTIFICATION,
              config: { userId: "user-1", title: "Test", message: "Hi" },
            },
          ],
        },
        error: null,
      })
    );

    // workflow_runs insert
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: { id: runId, workflow_id: workflowId, status: "running" },
        error: null,
      })
    );

    // Action: notifications insert
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: { id: "notif-1" },
        error: null,
      })
    );

    // workflow_logs insert (step log)
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: { id: "log-1" },
        error: null,
      })
    );

    // workflow_logs update (step completed)
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }));

    // workflow_runs update (run completed)
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }));

    const triggerResult = await triggerWorkflow({
      workflowId,
      triggerEvent: "user.signup",
      input: { userId: "user-1" },
      triggeredBy: "system",
    });

    expect(triggerResult.success).toBe(true);
    expect(triggerResult.data.runId).toBe(runId);
    expect(triggerResult.data.status).toBe("completed");

    // ── Step 4: Verify run record ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockSelectSingle({
        data: { id: runId, workflow_id: workflowId, status: "completed" },
        error: null,
      })
    );
    // Also fetch logs
    supabaseAdmin.from.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }));

    const runDetail = await getWorkflowRun(runId);
    expect(runDetail.success).toBe(true);
    expect(runDetail.data.status).toBe("completed");

    // ── Step 5: Disable ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockUpdateSingle({
        data: { id: workflowId, enabled: false },
        error: null,
      })
    );

    const disableResult = await disableWorkflow(workflowId, "admin-1");
    expect(disableResult.success).toBe(true);
  });

  // ─── Test 2: Condition evaluation before action execution ─────────────────

  it("conditions evaluated before action execution — skipped if not met", async () => {
    const workflowId = "wf-conds";
    const runId = "run-conds";

    // getWorkflow returns workflow with conditions
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockSelectSingle({
        data: {
          id: workflowId,
          name: "Conditional WF",
          enabled: true,
          trigger_type: "event",
          conditions: [
            { type: CONDITION_TYPES.EQUALS, field: "userRole", value: "admin" },
          ],
          actions: [
            { type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Admin alert" } },
          ],
        },
        error: null,
      })
    );

    // workflow_runs insert
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: { id: runId, workflow_id: workflowId, status: "running" },
        error: null,
      })
    );

    // workflow_runs update (status = skipped)
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }));

    // Trigger with input where userRole !== "admin"
    const result = await triggerWorkflow({
      workflowId,
      triggerEvent: "user.signup",
      input: { userRole: "donor" },
      triggeredBy: "system",
    });

    expect(result.success).toBe(true);
    // Conditions not met → skipped
    expect(result.data.status).toBe("skipped");
    expect(result.data.output.message).toMatch(/conditions not met/i);

    // Verify evaluateConditions works standalone
    const evalResult = await evaluateConditions({
      conditions: [
        { type: CONDITION_TYPES.EQUALS, field: "status", value: "active" },
        { type: CONDITION_TYPES.GREATER_THAN, field: "amount", value: 100 },
      ],
      context: { status: "active", amount: 200 },
    });

    expect(evalResult.success).toBe(true);
    expect(evalResult.data.matched).toBe(true);

    // Failing condition
    const failResult = await evaluateConditions({
      conditions: [
        { type: CONDITION_TYPES.EQUALS, field: "status", value: "active" },
        { type: CONDITION_TYPES.GREATER_THAN, field: "amount", value: 500 },
      ],
      context: { status: "active", amount: 200 },
    });

    expect(failResult.success).toBe(true);
    expect(failResult.data.matched).toBe(false);
  });

  // ─── Test 3: Action execution — sequential, stop on failure ────────────────

  it("multiple actions run sequentially and stop on first failure", async () => {
    const actions = [
      {
        type: ACTION_TYPES.SEND_NOTIFICATION,
        name: "step_1",
        config: { userId: "user-1", title: "First", message: "OK" },
      },
      {
        type: ACTION_TYPES.UPDATE_ENTITY,
        name: "step_2",
        config: {
          entityType: "public_donations",
          entityId: "don-1",
          updates: { status: "active" },
        },
      },
      {
        type: ACTION_TYPES.SEND_NOTIFICATION,
        name: "step_3",
        config: { userId: "user-2", title: "Third", message: "Should not run" },
      },
    ];

    const context = { workflowId: "wf-act", runId: "run-act", userId: "user-1" };

    // Step 1: workflow_logs insert + notifications insert (success)
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({ data: { id: "log-1" }, error: null })
    );
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({ data: { id: "notif-1" }, error: null })
    );
    // Step 1: workflow_logs update
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));

    // Step 2: workflow_logs insert + update entity FAILS
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({ data: { id: "log-2" }, error: null })
    );
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Entity not found" },
            }),
          }),
        }),
      }),
    }));
    // Step 2: workflow_logs update (error status)
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));

    const result = await executeActions({ actions, context });

    expect(result.success).toBe(true);
    expect(result.data.results.length).toBe(2); // stopped after step_2
    expect(result.data.results[0].status).toBe("success");
    expect(result.data.results[1].status).toBe("error");
    // Step 3 was never attempted
  });

  // ─── Test 4: Template instantiation ───────────────────────────────────────

  it("template → customize → create workflow", async () => {
    const templateId = "tpl-001";
    const newWorkflowId = "wf-from-tpl";

    // ── Create template ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: {
          id: templateId,
          name: "Welcome Notification",
          trigger_type: "event",
          actions: [
            { type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Welcome!" } },
          ],
        },
        error: null,
      })
    );

    const tplResult = await createWorkflowTemplate({
      name: "Welcome Notification",
      description: "Sends a welcome notification",
      triggerType: TRIGGER_TYPES.EVENT,
      actions: [
        { type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Welcome!" } },
      ],
      createdBy: "admin-1",
    });

    expect(tplResult.success).toBe(true);

    // ── Instantiate from template with customizations ──
    // Fetch template
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockSelectSingle({
        data: {
          id: templateId,
          name: "Welcome Notification",
          trigger_type: "event",
          conditions: [],
          actions: [
            { type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Welcome!" } },
          ],
        },
        error: null,
      })
    );

    // Create workflow from template
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: {
          id: newWorkflowId,
          name: "Customized Welcome",
          trigger_type: "event",
        },
        error: null,
      })
    );

    const instanceResult = await instantiateFromTemplate({
      templateId,
      customizations: {
        name: "Customized Welcome",
        actions: [
          { type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Custom Welcome!" } },
        ],
      },
      createdBy: "admin-1",
    });

    expect(instanceResult.success).toBe(true);
    expect(instanceResult.data.id).toBe(newWorkflowId);
    expect(instanceResult.data.name).toBe("Customized Welcome");
  });

  // ─── Test 5: Retry flow ───────────────────────────────────────────────────

  it("failed run → retry creates a new run", async () => {
    const workflowId = "wf-retry";
    const originalRunId = "run-fail-1";
    const newRunId = "run-retry-1";

    // ── Fetch original (failed) run ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockSelectSingle({
        data: {
          id: originalRunId,
          workflow_id: workflowId,
          status: "failed",
          trigger_event: "user.signup",
          input: { userId: "user-1" },
        },
        error: null,
      })
    );

    // ── Retry: getWorkflow ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockSelectSingle({
        data: {
          id: workflowId,
          name: "Retry WF",
          enabled: true,
          trigger_type: "event",
          conditions: [],
          actions: [
            { type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Retry!" } },
          ],
        },
        error: null,
      })
    );

    // ── Retry: create new run ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: { id: newRunId, workflow_id: workflowId, status: "running" },
        error: null,
      })
    );

    // ── Retry: action execution (log insert first, then notification) ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({ data: { id: "log-retry" }, error: null })
    );
    // notification insert
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({ data: { id: "notif-2" }, error: null })
    );
    // workflow_logs update
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));
    // workflow_runs update (completed)
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));

    const retryResult = await retryWorkflowRun(originalRunId, "admin-1");

    expect(retryResult.success).toBe(true);
    expect(retryResult.data.runId).toBe(newRunId);
    expect(retryResult.data.status).toBe("completed");

    // Cannot retry a non-failed run
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockSelectSingle({
        data: { id: "run-completed", status: "completed" },
        error: null,
      })
    );

    const invalidRetry = await retryWorkflowRun("run-completed", "admin-1");
    expect(invalidRetry.success).toBe(false);
    expect(invalidRetry.error).toMatch(/cannot retry/i);
  });

  // ─── Test 6: Scheduled workflow processing ────────────────────────────────

  it("processScheduledWorkflows finds due workflows and triggers them", async () => {
    const wfId1 = "wf-sched-1";
    const wfId2 = "wf-sched-2";

    // ── Fetch enabled scheduled workflows ──
    supabaseAdmin.from.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: wfId1,
                name: "Hourly Cleanup",
                enabled: true,
                trigger_type: "schedule",
                schedule_config: {
                  intervalMs: 3600000,
                  lastRunAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago → due
                },
                conditions: [],
                actions: [
                  { type: ACTION_TYPES.UPDATE_STATUS, config: { entityType: "public_donations", entityId: "c1", statusField: "status", statusValue: "reviewed" } },
                ],
              },
              {
                id: wfId2,
                name: "Daily Report",
                enabled: true,
                trigger_type: "schedule",
                schedule_config: {
                  intervalMs: 86400000,
                  lastRunAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago → NOT due
                },
                conditions: [],
                actions: [],
              },
            ],
            error: null,
          }),
        }),
      }),
    }));

    // ── For wfId1: triggerWorkflow calls getWorkflow ──
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockSelectSingle({
        data: {
          id: wfId1,
          name: "Hourly Cleanup",
          enabled: true,
          trigger_type: "schedule",
          conditions: [],
          actions: [
            { type: ACTION_TYPES.UPDATE_STATUS, config: { entityType: "public_donations", entityId: "c1", statusField: "status", statusValue: "reviewed" } },
          ],
        },
        error: null,
      })
    );

    // workflow_runs insert
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: { id: "run-sched-1", workflow_id: wfId1, status: "running" },
        error: null,
      })
    );

    // workflow_logs insert (first in executeActions loop)
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({ data: { id: "log-sched" }, error: null })
    );

    // Action: UPDATE_STATUS → update entity
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));
    // workflow_logs update
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));
    // workflow_runs update (completed)
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));

    // Update schedule_config with lastRunAt
    supabaseAdmin.from.mockImplementationOnce(() => ({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }));

    const result = await processScheduledWorkflows();

    expect(result.success).toBe(true);
    expect(result.data.processed).toBe(1); // only wfId1 was due
    expect(result.data.triggered).toBe(1);
  });
});
