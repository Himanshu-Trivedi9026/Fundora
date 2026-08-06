/**
 * Workflow Engine Tests — Unit tests for workflow automation engine.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───

vi.mock("../../../lib/supabaseAdmin.js", () => {
  // Chainable mock: all chain methods return `this`, `.single()` and `.then()` resolve.
  // `.then()` makes `await chain` work for functions like listWorkflows that don't call .single().
  // `.single()` resolves for functions like getWorkflow that terminate with .single().
  function createChain(result) {
    const c = {};
    c._result = result;
    c.select = vi.fn(() => c);
    c.insert = vi.fn(() => c);
    c.update = vi.fn(() => c);
    c.delete = vi.fn(() => c);
    c.eq = vi.fn(() => c);
    c.order = vi.fn(() => c);
    c.range = vi.fn(() => c);
    c.single = vi.fn().mockResolvedValue(result);
    c.maybeSingle = vi.fn().mockResolvedValue(result);
    // Thenable: makes `await chain` resolve to result
    c.then = (resolve) => resolve(result);
    return c;
  }

  return {
    supabaseAdmin: {
      from: vi.fn(() => createChain({ data: null, error: null })),
    },
  };
});

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog.js", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  enableWorkflow,
  disableWorkflow,
  listWorkflows,
  getWorkflow,
  triggerWorkflow,
  executeActions,
  evaluateConditions,
  retryWorkflowRun,
  createWorkflowTemplate,
  instantiateFromTemplate,
  processScheduledWorkflows,
  verifyWorkflowOwnership,
  validateActionConfig,
  isSafeOutboundUrl,
  ALLOWED_ENTITY_TABLES,
  TRIGGER_TYPES,
  ACTION_TYPES,
  CONDITION_TYPES,
} from "../../../lib/automation/workflowEngine.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logAuditEvent } from "../../../lib/verification/auditLog.js";

// ─── Helper: chain that resolves with `result` via .single() and .then() ───
function chainResult(result) {
  const c = {};
  c._result = result;
  c.select = vi.fn(() => c);
  c.insert = vi.fn(() => c);
  c.update = vi.fn(() => c);
  c.delete = vi.fn(() => c);
  c.eq = vi.fn(() => c);
  c.order = vi.fn(() => c);
  c.range = vi.fn(() => c);
  c.single = vi.fn().mockResolvedValue(result);
  c.maybeSingle = vi.fn().mockResolvedValue(result);
  c.then = (resolve) => resolve(result);
  return c;
}

describe("WorkflowEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createWorkflow ───

  describe("createWorkflow", () => {
    it("should create a workflow successfully", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: { id: "wf-1", name: "Test Workflow", enabled: true }, error: null })
      );

      const result = await createWorkflow({
        name: "Test Workflow",
        triggerType: TRIGGER_TYPES.EVENT,
        createdBy: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("wf-1");
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "workflow.created", entityType: "workflows" })
      );
    });

    it("should reject workflow without name", async () => {
      const result = await createWorkflow({ triggerType: TRIGGER_TYPES.EVENT, createdBy: "user-1" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("name is required");
    });

    it("should reject workflow with invalid triggerType", async () => {
      const result = await createWorkflow({ name: "Test", triggerType: "bad", createdBy: "user-1" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("triggerType must be one of");
    });

    it("should validate action types", async () => {
      const result = await createWorkflow({
        name: "Test", triggerType: TRIGGER_TYPES.EVENT, createdBy: "user-1",
        actions: [{ type: "invalid_action", config: {} }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid action type");
    });

    it("should validate condition types", async () => {
      const result = await createWorkflow({
        name: "Test", triggerType: TRIGGER_TYPES.EVENT, createdBy: "user-1",
        conditions: [{ type: "invalid_condition", field: "x", value: 1 }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid condition type");
    });

    it("should reject workflow without createdBy", async () => {
      const result = await createWorkflow({ name: "Test", triggerType: TRIGGER_TYPES.EVENT });
      expect(result.success).toBe(false);
      expect(result.error).toContain("createdBy is required");
    });
  });

  // ─── updateWorkflow ───

  describe("updateWorkflow", () => {
    it("should update workflow fields", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: { id: "wf-1", name: "Updated Name" }, error: null })
      );

      const result = await updateWorkflow("wf-1", { name: "Updated Name" }, "user-1");
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Updated Name");
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "workflow.updated" })
      );
    });

    it("should reject empty updates", async () => {
      const result = await updateWorkflow("wf-1", {}, "user-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("must not be empty");
    });

    it("should sanitize allowed fields only", async () => {
      const mockChain = chainResult({ data: { id: "wf-1" }, error: null });
      supabaseAdmin.from.mockReturnValueOnce(mockChain);

      await updateWorkflow("wf-1", { name: "New", created_by: "hacker", id: "hack-id" }, "user-1");

      // The update mock should have been called with only allowed fields
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New" })
      );
      // Disallowed fields should not be present
      expect(mockChain.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: "hack-id" })
      );
    });
  });

  // ─── deleteWorkflow ───

  describe("deleteWorkflow", () => {
    it("should delete a workflow", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(chainResult({ data: { id: "wf-1", name: "Test" }, error: null }))
        .mockReturnValueOnce(chainResult({ error: null }));

      const result = await deleteWorkflow("wf-1", "user-1");
      expect(result.success).toBe(true);
      expect(result.data.deleted).toBe(true);
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "workflow.deleted" })
      );
    });

    it("should handle not found", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: null, error: { code: "PGRST116" } })
      );

      const result = await deleteWorkflow("wf-missing", "user-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ─── enableWorkflow / disableWorkflow ───

  describe("enableWorkflow / disableWorkflow", () => {
    it("should enable a workflow", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: { id: "wf-1", enabled: true }, error: null })
      );

      const result = await enableWorkflow("wf-1", "user-1");
      expect(result.success).toBe(true);
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "workflow.enabled" })
      );
    });

    it("should disable a workflow", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: { id: "wf-1", enabled: false }, error: null })
      );

      const result = await disableWorkflow("wf-1", "user-1");
      expect(result.success).toBe(true);
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "workflow.disabled" })
      );
    });
  });

  // ─── listWorkflows ───

  describe("listWorkflows", () => {
    it("should return paginated results with filters", async () => {
      const workflows = [{ id: "wf-1" }, { id: "wf-2" }];
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: workflows, error: null, count: 2 })
      );

      const result = await listWorkflows({
        organizationId: "org-1",
        enabled: true,
        triggerType: TRIGGER_TYPES.EVENT,
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data.workflows).toHaveLength(2);
      expect(result.data.total).toBe(2);
    });
  });

  // ─── getWorkflow ───

  describe("getWorkflow", () => {
    it("should return workflow by ID", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: { id: "wf-1", name: "Test" }, error: null })
      );

      const result = await getWorkflow("wf-1");
      expect(result.success).toBe(true);
      expect(result.data.id).toBe("wf-1");
    });

    it("should handle not found", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: null, error: { code: "PGRST116" } })
      );

      const result = await getWorkflow("wf-missing");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ─── triggerWorkflow ───

  describe("triggerWorkflow", () => {
    it("should trigger a workflow successfully", async () => {
      supabaseAdmin.from
        // getWorkflow
        .mockReturnValueOnce(chainResult({
          data: { id: "wf-1", enabled: true, conditions: [], actions: [] },
          error: null,
        }))
        // workflow_runs insert
        .mockReturnValueOnce(chainResult({
          data: { id: "run-1", status: "running" },
          error: null,
        }))
        // workflow_runs update (status)
        .mockReturnValueOnce(chainResult({ error: null }));

      const result = await triggerWorkflow({
        workflowId: "wf-1",
        triggerEvent: "test_event",
        input: { key: "value" },
        triggeredBy: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe("completed");
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "workflow.triggered" })
      );
    });

    it("should reject disabled workflow", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({
          data: { id: "wf-1", enabled: false, conditions: [], actions: [] },
          error: null,
        })
      );

      const result = await triggerWorkflow({
        workflowId: "wf-1",
        triggerEvent: "test_event",
        triggeredBy: "user-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("disabled");
    });
  });

  // ─── executeActions ───

  describe("executeActions", () => {
    it("should process action types", async () => {
      supabaseAdmin.from
        // workflow_logs insert
        .mockReturnValueOnce(chainResult({ data: { id: "log-1" }, error: null }))
        // notifications insert
        .mockReturnValueOnce(chainResult({ data: { id: "notif-1" }, error: null }))
        // workflow_logs update
        .mockReturnValueOnce(chainResult({ error: null }));

      const result = await executeActions({
        actions: [{
          type: ACTION_TYPES.SEND_NOTIFICATION,
          config: { userId: "user-1", title: "Hello", message: "Test" },
        }],
        context: { workflowId: "wf-1", runId: "run-1" },
      });

      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].status).toBe("success");
    });

    it("should fail fast on error", async () => {
      supabaseAdmin.from
        // workflow_logs insert for first action
        .mockReturnValueOnce(chainResult({ data: { id: "log-1" }, error: null }))
        // workflow_logs update for failed step
        .mockReturnValueOnce(chainResult({ error: null }));

      const result = await executeActions({
        actions: [
          { type: ACTION_TYPES.UPDATE_ENTITY, config: {} }, // missing entityType/entityId/updates → error
          { type: ACTION_TYPES.SEND_NOTIFICATION, config: {} }, // should never run
        ],
        context: { workflowId: "wf-1", runId: "run-1" },
      });

      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0].status).toBe("error");
    });
  });

  // ─── evaluateConditions ───

  describe("evaluateConditions", () => {
    it("should evaluate equals conditions", async () => {
      const result = await evaluateConditions({
        conditions: [{ type: CONDITION_TYPES.EQUALS, field: "status", value: "active" }],
        context: { status: "active" },
      });
      expect(result.success).toBe(true);
      expect(result.data.matched).toBe(true);
    });

    it("should evaluate AND conditions", async () => {
      const result = await evaluateConditions({
        conditions: [{
          type: CONDITION_TYPES.AND,
          conditions: [
            { type: CONDITION_TYPES.EQUALS, field: "a", value: 1 },
            { type: CONDITION_TYPES.EQUALS, field: "b", value: 2 },
          ],
        }],
        context: { a: 1, b: 2 },
      });
      expect(result.success).toBe(true);
      expect(result.data.matched).toBe(true);
    });

    it("should evaluate OR conditions", async () => {
      const result = await evaluateConditions({
        conditions: [{
          type: CONDITION_TYPES.OR,
          conditions: [
            { type: CONDITION_TYPES.EQUALS, field: "a", value: 1 },
            { type: CONDITION_TYPES.EQUALS, field: "b", value: 99 },
          ],
        }],
        context: { a: 1, b: 2 },
      });
      expect(result.success).toBe(true);
      expect(result.data.matched).toBe(true);
    });

    it("should evaluate greater_than conditions", async () => {
      const result = await evaluateConditions({
        conditions: [{ type: CONDITION_TYPES.GREATER_THAN, field: "amount", value: 100 }],
        context: { amount: 200 },
      });
      expect(result.success).toBe(true);
      expect(result.data.matched).toBe(true);
    });

    it("should return matched false when conditions fail", async () => {
      const result = await evaluateConditions({
        conditions: [{ type: CONDITION_TYPES.EQUALS, field: "x", value: "yes" }],
        context: { x: "no" },
      });
      expect(result.success).toBe(true);
      expect(result.data.matched).toBe(false);
    });
  });

  // ─── retryWorkflowRun ───

  describe("retryWorkflowRun", () => {
    it("should retry a failed run", async () => {
      supabaseAdmin.from
        // 1. Fetch original run
        .mockReturnValueOnce(chainResult({
          data: { id: "run-1", status: "failed", workflow_id: "wf-1", trigger_event: "test", input: {} },
          error: null,
        }))
        // 2. getWorkflow (inside triggerWorkflow)
        .mockReturnValueOnce(chainResult({
          data: { id: "wf-1", enabled: true, conditions: [], actions: [] },
          error: null,
        }))
        // 3. workflow_runs insert
        .mockReturnValueOnce(chainResult({
          data: { id: "run-2", status: "running" },
          error: null,
        }))
        // 4. workflow_runs update (status)
        .mockReturnValueOnce(chainResult({ error: null }));

      const result = await retryWorkflowRun("run-1", "user-1");
      expect(result.success).toBe(true);
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "workflow.run.retried" })
      );
    });

    it("should reject retry of non-failed run", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: { id: "run-1", status: "completed", workflow_id: "wf-1" }, error: null })
      );

      const result = await retryWorkflowRun("run-1", "user-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot retry");
    });
  });

  // ─── createWorkflowTemplate / instantiateFromTemplate ───

  describe("createWorkflowTemplate", () => {
    it("should create a template", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: { id: "tpl-1", name: "My Template" }, error: null })
      );

      const result = await createWorkflowTemplate({
        name: "My Template",
        triggerType: TRIGGER_TYPES.EVENT,
        actions: [{ type: ACTION_TYPES.SEND_NOTIFICATION, config: {} }],
        createdBy: "user-1",
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe("tpl-1");
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "workflow.template.created" })
      );
    });

    it("should reject template without createdBy", async () => {
      const result = await createWorkflowTemplate({
        name: "Template",
        triggerType: TRIGGER_TYPES.EVENT,
        actions: [{ type: ACTION_TYPES.SEND_NOTIFICATION, config: {} }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("createdBy is required");
    });
  });

  describe("instantiateFromTemplate", () => {
    it("should instantiate workflow from template", async () => {
      supabaseAdmin.from
        // Fetch template
        .mockReturnValueOnce(chainResult({
          data: {
            id: "tpl-1",
            name: "Base Template",
            trigger_type: TRIGGER_TYPES.EVENT,
            conditions: [],
            actions: [{ type: ACTION_TYPES.SEND_NOTIFICATION, config: {} }],
          },
          error: null,
        }))
        // createWorkflow insert
        .mockReturnValueOnce(chainResult({
          data: { id: "wf-new", name: "Base Template (copy)", enabled: true },
          error: null,
        }));

      const result = await instantiateFromTemplate({ templateId: "tpl-1", createdBy: "user-1" });
      expect(result.success).toBe(true);
      expect(result.data.id).toBe("wf-new");
    });
  });

  // ─── processScheduledWorkflows ───

  describe("processScheduledWorkflows", () => {
    it("should find due workflows and trigger them", async () => {
      supabaseAdmin.from
        // 1. Fetch scheduled workflows
        .mockReturnValueOnce(chainResult({
          data: [{
            id: "wf-sched",
            enabled: true,
            trigger_type: TRIGGER_TYPES.SCHEDULE,
            schedule_config: { intervalMs: 1000, lastRunAt: "2020-01-01T00:00:00Z" },
            conditions: [],
            actions: [],
          }],
          error: null,
        }))
        // 2. getWorkflow (inside triggerWorkflow)
        .mockReturnValueOnce(chainResult({
          data: { id: "wf-sched", enabled: true, conditions: [], actions: [] },
          error: null,
        }))
        // 3. workflow_runs insert
        .mockReturnValueOnce(chainResult({
          data: { id: "run-sched", status: "running" },
          error: null,
        }))
        // 4. workflow_runs update (status)
        .mockReturnValueOnce(chainResult({ error: null }))
        // 5. Update schedule_config lastRunAt
        .mockReturnValueOnce(chainResult({ error: null }));

      const result = await processScheduledWorkflows();
      expect(result.success).toBe(true);
      expect(result.data.processed).toBeGreaterThanOrEqual(1);
      expect(result.data.triggered).toBeGreaterThanOrEqual(1);
    });

    it("should return zeros when no workflows are due", async () => {
      supabaseAdmin.from.mockReturnValueOnce(chainResult({ data: [], error: null }));

      const result = await processScheduledWorkflows();
      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(0);
      expect(result.data.triggered).toBe(0);
    });
  });
});

// ─── Security hardening tests ───
// Verifies CR-2 fixes: allowlists, forbidden columns, SSRF, ownership.

describe("WorkflowEngine Security (CR-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── validateActionConfig: invalid table ───

  describe("validateActionConfig", () => {
    it("rejects an unknown table (invalid table)", () => {
      const result = validateActionConfig({
        type: ACTION_TYPES.UPDATE_ENTITY,
        config: { entityType: "auth.users", entityId: "x", updates: { email: "a@b.c" } },
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowlisted");
    });

    it("rejects an invalid column for an allowed table", () => {
      const result = validateActionConfig({
        type: ACTION_TYPES.UPDATE_ENTITY,
        config: { entityType: "public_donations", entityId: "d1", updates: { password_hash: "x" } },
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowlisted");
    });

    it("rejects a forbidden column (role / owner_id / user_id / organization_id)", () => {
      for (const col of ["role", "owner_id", "creator_id", "user_id", "organization_id"]) {
        const result = validateActionConfig({
          type: ACTION_TYPES.UPDATE_ENTITY,
          config: { entityType: "public_donations", entityId: "d1", updates: { [col]: "hacked" } },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain(col);
      }
    });

    it("rejects update_status with a forbidden status field", () => {
      const result = validateActionConfig({
        type: ACTION_TYPES.UPDATE_STATUS,
        config: { entityType: "public_donations", entityId: "d1", statusField: "owner_id", statusValue: "x" },
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("owner_id");
    });

    it("accepts a valid update on an allowlisted table/column", () => {
      const result = validateActionConfig({
        type: ACTION_TYPES.UPDATE_STATUS,
        config: { entityType: "public_donations", entityId: "d1", statusField: "status", statusValue: "active" },
      });
      expect(result.valid).toBe(true);
    });

    it("rejects http (non-HTTPS) URLs", () => {
      const result = validateActionConfig({
        type: ACTION_TYPES.CALL_API,
        config: { url: "http://example.com/hook" },
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("HTTPS");
    });
  });

  // ─── createWorkflow: rejects malicious stored configs ───

  describe("createWorkflow config validation", () => {
    it("rejects a workflow whose action targets an unknown table", async () => {
      const result = await createWorkflow({
        name: "Bad",
        triggerType: TRIGGER_TYPES.EVENT,
        createdBy: "user-1",
        actions: [{ type: ACTION_TYPES.UPDATE_ENTITY, config: { entityType: "profiles", entityId: "p1", updates: { role: "platform_admin" } } }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not allowlisted");
    });

    it("rejects a workflow whose action writes a forbidden column", async () => {
      const result = await createWorkflow({
        name: "Bad",
        triggerType: TRIGGER_TYPES.EVENT,
        createdBy: "user-1",
        actions: [{ type: ACTION_TYPES.UPDATE_ENTITY, config: { entityType: "public_donations", entityId: "d1", updates: { owner_id: "attacker" } } }],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("owner_id");
    });
  });

  // ─── executeActions: execution-time enforcement (legacy configs) ───

  describe("executeActions execution-time enforcement", () => {
    it("fails an action that attempts to update a forbidden column at execution time", async () => {
      // workflow_logs insert
      supabaseAdmin.from.mockReturnValueOnce(chainResult({ data: { id: "log-1" }, error: null }));

      const result = await executeActions({
        actions: [{ type: ACTION_TYPES.UPDATE_ENTITY, config: { entityType: "public_donations", entityId: "d1", updates: { owner_id: "attacker" } } }],
        context: { workflowId: "wf-1", runId: "run-1" },
      });

      expect(result.success).toBe(true);
      expect(result.data.results[0].status).toBe("error");
      expect(result.data.results[0].output.error).toContain("owner_id");
    });

    it("fails an action targeting an unknown table at execution time", async () => {
      supabaseAdmin.from.mockReturnValueOnce(chainResult({ data: { id: "log-1" }, error: null }));

      const result = await executeActions({
        actions: [{ type: ACTION_TYPES.UPDATE_ENTITY, config: { entityType: "profiles", entityId: "p1", updates: { role: "x" } } }],
        context: { workflowId: "wf-1", runId: "run-1" },
      });

      expect(result.success).toBe(true);
      expect(result.data.results[0].status).toBe("error");
      expect(result.data.results[0].output.error).toContain("not allowlisted");
    });
  });

  // ─── isSafeOutboundUrl: SSRF attempts ───

  describe("isSafeOutboundUrl (SSRF)", () => {
    it("blocks http:// (non-HTTPS)", async () => {
      const r = await isSafeOutboundUrl("http://example.com");
      expect(r.safe).toBe(false);
    });

    it("blocks localhost", async () => {
      const r = await isSafeOutboundUrl("https://localhost/admin");
      expect(r.safe).toBe(false);
      expect(r.reason).toContain("Localhost");
    });

    it("blocks 127.0.0.1", async () => {
      const r = await isSafeOutboundUrl("https://127.0.0.1:5432/");
      expect(r.safe).toBe(false);
    });

    it("blocks 0.0.0.0", async () => {
      const r = await isSafeOutboundUrl("https://0.0.0.0/");
      expect(r.safe).toBe(false);
    });

    it("blocks private IP ranges (192.168.x, 10.x, 172.16-31.x, link-local)", async () => {
      for (const host of ["192.168.1.10", "10.0.0.5", "172.20.0.1", "169.254.10.10"]) {
        const r = await isSafeOutboundUrl(`https://${host}/`);
        expect(r.safe).toBe(false);
        expect(r.reason).toContain("Private");
      }
    });

    it("blocks *.local hosts", async () => {
      const r = await isSafeOutboundUrl("https://intranet.local/api");
      expect(r.safe).toBe(false);
      expect(r.reason).toContain(".local");
    });

    it("blocks cloud metadata endpoints (169.254.169.254 and metadata hostnames)", async () => {
      const r1 = await isSafeOutboundUrl("https://169.254.169.254/latest/meta-data/");
      expect(r1.safe).toBe(false);
      const r2 = await isSafeOutboundUrl("https://metadata.google.internal/computeMetadata/v1/");
      expect(r2.safe).toBe(false);
    });

    it("accepts a public HTTPS URL", async () => {
      const r = await isSafeOutboundUrl("https://example.com/hook");
      expect(r.safe).toBe(true);
    });

    it("blocks bracketed IPv6 loopback and unspecified addresses (::1 / ::)", async () => {
      for (const url of ["https://[::1]/", "https://[::1]:8080/", "https://[::]/"]) {
        const r = await isSafeOutboundUrl(url);
        expect(r.safe, url).toBe(false);
      }
    });

    it("blocks IPv4-mapped IPv6 loopback/private addresses (::ffff:a.b.c.d)", async () => {
      for (const url of [
        "https://[::ffff:127.0.0.1]/",
        "https://[::ffff:0a00:0001]/", // ::ffff:10.0.0.1 (hex form)
        "https://[::ffff:7f00:1]/", // ::ffff:127.0.0.1 (hex form)
      ]) {
        const r = await isSafeOutboundUrl(url);
        expect(r.safe, url).toBe(false);
      }
    });

    it("blocks IPv6 link-local (fe80::/10) and unique-local (fc00::/7) addresses", async () => {
      for (const url of ["https://[fe80::1]/", "https://[fd00::1]/", "https://[fc00::1]/"]) {
        const r = await isSafeOutboundUrl(url);
        expect(r.safe, url).toBe(false);
      }
    });

    it("accepts a public IPv6 literal", async () => {
      const r = await isSafeOutboundUrl("https://[2606:4700:4700::1111]/");
      expect(r.safe).toBe(true);
    });
  });

  // ─── verifyWorkflowOwnership ───

  describe("verifyWorkflowOwnership", () => {
    it("allows the workflow owner", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: { created_by: "user-1" }, error: null })
      );
      const result = await verifyWorkflowOwnership({ workflowId: "wf-1", userId: "user-1" });
      expect(result.success).toBe(true);
      expect(result.allowed).toBe(true);
    });

    it("denies a non-owner", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(chainResult({ data: { created_by: "owner-1" }, error: null }))
        .mockReturnValueOnce(chainResult({ data: { role: "donor" }, error: null }));
      const result = await verifyWorkflowOwnership({ workflowId: "wf-1", userId: "attacker" });
      expect(result.success).toBe(true);
      expect(result.allowed).toBe(false);
    });

    it("allows a platform_admin on someone else's workflow (ownership bypass blocked for non-admins)", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(chainResult({ data: { created_by: "owner-1" }, error: null }))
        .mockReturnValueOnce(chainResult({ data: { role: "platform_admin" }, error: null }));
      const result = await verifyWorkflowOwnership({ workflowId: "wf-1", userId: "admin-1" });
      expect(result.success).toBe(true);
      expect(result.allowed).toBe(true);
    });

    it("returns not-found for a missing workflow", async () => {
      supabaseAdmin.from.mockReturnValueOnce(
        chainResult({ data: null, error: { code: "PGRST116" } })
      );
      const result = await verifyWorkflowOwnership({ workflowId: "wf-missing", userId: "user-1" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ─── listWorkflows ownership scoping ───

  describe("listWorkflows ownership scoping", () => {
    it("scopes results to the requesting user (non-admin)", async () => {
      const mockChain = chainResult({ data: [{ id: "wf-1" }], error: null, count: 1 });
      supabaseAdmin.from
        // listWorkflows builds the workflows query FIRST, then the profiles lookup
        .mockReturnValueOnce(mockChain) // workflows
        .mockReturnValueOnce(chainResult({ data: { role: "donor" }, error: null })); // profiles

      const result = await listWorkflows({ userId: "user-1" });
      expect(result.success).toBe(true);
      expect(mockChain.eq).toHaveBeenCalledWith("created_by", "user-1");
    });

    it("does not scope results for a platform_admin", async () => {
      const mockChain = chainResult({ data: [{ id: "wf-1" }], error: null, count: 1 });
      supabaseAdmin.from
        .mockReturnValueOnce(mockChain) // workflows
        .mockReturnValueOnce(chainResult({ data: { role: "platform_admin" }, error: null })); // profiles

      const result = await listWorkflows({ userId: "admin-1" });
      expect(result.success).toBe(true);
      expect(mockChain.eq).not.toHaveBeenCalledWith("created_by", "admin-1");
    });
  });
});
