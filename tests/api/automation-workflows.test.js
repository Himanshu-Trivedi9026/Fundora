/**
 * Automation Workflows API Route Tests — Unit tests for /api/automation/workflows routes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/withAuth.js", () => ({
  withAuth: vi.fn((handler) => {
    return async function (req, res) {
      req.user = req.user || { id: "test-user-id", email: "test@example.com" };
      return handler(req, res);
    };
  }),
}));

vi.mock("@/lib/rateLimit.js", () => ({
  rateLimit: vi.fn(() => vi.fn((handler) => handler)),
}));

vi.mock("@/lib/automation/workflowEngine.js", () => ({
  listWorkflows: vi.fn().mockResolvedValue({
    success: true,
    data: {
      workflows: [{ id: "wf-1", name: "Test" }],
      total: 1,
      limit: 20,
      offset: 0,
    },
  }),
  createWorkflow: vi.fn().mockResolvedValue({
    success: true,
    data: { id: "wf-new", name: "New Workflow", enabled: true },
  }),
  getWorkflow: vi.fn().mockResolvedValue({
    success: true,
    data: { id: "wf-1", name: "Test Workflow", enabled: true },
  }),
  updateWorkflow: vi.fn().mockResolvedValue({
    success: true,
    data: { id: "wf-1", name: "Updated" },
  }),
  deleteWorkflow: vi.fn().mockResolvedValue({
    success: true,
    data: { deleted: true, workflowId: "wf-1" },
  }),
  triggerWorkflow: vi.fn().mockResolvedValue({
    success: true,
    data: { runId: "run-1", status: "completed", output: {} },
  }),
  getWorkflowRuns: vi.fn().mockResolvedValue({
    success: true,
    data: {
      runs: [{ id: "run-1", status: "completed" }],
      total: 1,
      limit: 20,
      offset: 0,
    },
  }),
  verifyWorkflowOwnership: vi.fn().mockResolvedValue({
    success: true,
    allowed: true,
    workflow: { created_by: "test-user-id" },
  }),
  validateActionConfig: vi.fn().mockReturnValue({ valid: true }),
  isSafeOutboundUrl: vi.fn().mockResolvedValue({ safe: true }),
  ALLOWED_ENTITY_TABLES: [],
}));

import workflowsHandler from "@/pages/api/automation/workflows.js";
import workflowIdHandler from "@/pages/api/automation/workflows/[id].js";
import triggerHandler from "@/pages/api/automation/workflows/[id]/trigger.js";
import runsHandler from "@/pages/api/automation/workflows/[id]/runs.js";
import {
  listWorkflows,
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  triggerWorkflow,
  getWorkflowRuns,
  verifyWorkflowOwnership,
} from "@/lib/automation/workflowEngine.js";

function createMockReq(
  method = "GET",
  body = {},
  query = {},
  user = { id: "test-user-id" },
) {
  return { method, body, query, user };
}

function createMockRes() {
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

// ─── /api/automation/workflows ───

describe("/api/automation/workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list workflows on GET", async () => {
    const req = createMockReq("GET", {}, { limit: "10", offset: "0" });
    const res = createMockRes();

    await workflowsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ workflows: expect.any(Array) }),
    );
    expect(listWorkflows).toHaveBeenCalled();
  });

  it("should create a workflow on POST", async () => {
    const req = createMockReq("POST", {
      name: "New Workflow",
      trigger: "event",
      steps: [{ type: "send_notification", config: {} }],
    });
    const res = createMockRes();

    await workflowsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: "wf-new" }),
    );
    expect(createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Workflow" }),
    );
  });

  it("should return 400 when name is missing on POST", async () => {
    const req = createMockReq("POST", {
      trigger: "event",
      steps: [{ type: "test" }],
    });
    const res = createMockRes();

    await workflowsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("name") }),
    );
  });

  it("should return 400 when steps is empty array", async () => {
    const req = createMockReq("POST", {
      name: "Test",
      trigger: "event",
      steps: [],
    });
    const res = createMockRes();

    await workflowsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("non-empty") }),
    );
  });

  it("should return 405 for DELETE", async () => {
    const req = createMockReq("DELETE");
    const res = createMockRes();

    await workflowsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ─── /api/automation/workflows/[id] ───

describe("/api/automation/workflows/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get a workflow on GET", async () => {
    const req = createMockReq("GET", {}, { id: "wf-1" });
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getWorkflow).toHaveBeenCalled();
  });

  it("should update a workflow on PUT", async () => {
    const req = createMockReq("PUT", { name: "Updated Name" }, { id: "wf-1" });
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(updateWorkflow).toHaveBeenCalled();
  });

  it("should return 400 when PUT body is empty", async () => {
    const req = createMockReq("PUT", {}, { id: "wf-1" });
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("update") }),
    );
  });

  it("should delete a workflow on DELETE", async () => {
    const req = createMockReq("DELETE", {}, { id: "wf-1" });
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("deleted") }),
    );
  });

  it("should return 400 when id is missing", async () => {
    const req = createMockReq("GET", {}, {});
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should return 405 for unsupported methods", async () => {
    const req = createMockReq("PATCH", {}, { id: "wf-1" });
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("should return 403 on GET when the user does not own the workflow", async () => {
    verifyWorkflowOwnership.mockResolvedValueOnce({
      success: true,
      allowed: false,
      reason: "Not the workflow owner",
    });
    const req = createMockReq("GET", {}, { id: "wf-other" });
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(getWorkflow).not.toHaveBeenCalled();
  });

  it("should return 403 on PUT (unauthorized update) when the user does not own the workflow", async () => {
    verifyWorkflowOwnership.mockResolvedValueOnce({
      success: true,
      allowed: false,
      reason: "Not the workflow owner",
    });
    const req = createMockReq("PUT", { name: "Hacked" }, { id: "wf-other" });
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(updateWorkflow).not.toHaveBeenCalled();
  });

  it("should return 403 on DELETE when the user does not own the workflow", async () => {
    verifyWorkflowOwnership.mockResolvedValueOnce({
      success: true,
      allowed: false,
      reason: "Not the workflow owner",
    });
    const req = createMockReq("DELETE", {}, { id: "wf-other" });
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(deleteWorkflow).not.toHaveBeenCalled();
  });

  it("should return 404 when the workflow does not exist (ownership lookup fails)", async () => {
    verifyWorkflowOwnership.mockResolvedValueOnce({
      success: false,
      error: "Workflow not found",
    });
    const req = createMockReq("GET", {}, { id: "wf-missing" });
    const res = createMockRes();

    await workflowIdHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── /api/automation/workflows/[id]/trigger ───

describe("/api/automation/workflows/[id]/trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should trigger a workflow on POST", async () => {
    const req = createMockReq(
      "POST",
      { input: { key: "value" } },
      { id: "wf-1" },
    );
    const res = createMockRes();

    await triggerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(triggerWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: "wf-1" }),
    );
  });

  it("should return 405 for GET", async () => {
    const req = createMockReq("GET", {}, { id: "wf-1" });
    const res = createMockRes();

    await triggerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("should return 400 when id is missing", async () => {
    const req = createMockReq("POST", {}, {});
    const res = createMockRes();

    await triggerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should return 403 on unauthorized trigger", async () => {
    verifyWorkflowOwnership.mockResolvedValueOnce({
      success: true,
      allowed: false,
      reason: "Not the workflow owner",
    });
    const req = createMockReq("POST", { input: { x: 1 } }, { id: "wf-other" });
    const res = createMockRes();

    await triggerHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(triggerWorkflow).not.toHaveBeenCalled();
  });
});

// ─── /api/automation/workflows/[id]/runs ───

describe("/api/automation/workflows/[id]/runs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get run history on GET", async () => {
    const req = createMockReq("GET", {}, { id: "wf-1", limit: "5" });
    const res = createMockRes();

    await runsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(getWorkflowRuns).toHaveBeenCalled();
  });

  it("should return 405 for POST", async () => {
    const req = createMockReq("POST", {}, { id: "wf-1" });
    const res = createMockRes();

    await runsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("should return 400 when id is missing", async () => {
    const req = createMockReq("GET", {}, {});
    const res = createMockRes();

    await runsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should return 400 for invalid status filter", async () => {
    const req = createMockReq("GET", {}, { id: "wf-1", status: "invalid" });
    const res = createMockRes();

    await runsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("status") }),
    );
  });
});
