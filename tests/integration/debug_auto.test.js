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
import { createWorkflowTemplate, instantiateFromTemplate, TRIGGER_TYPES, ACTION_TYPES } from "../../lib/automation/workflowEngine";

function mockInsertSingle(result) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

function mockSelectSingle(result) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe("debug auto", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("template", async () => {
    const templateId = "tpl-001";
    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: {
          id: templateId,
          name: "Welcome Notification",
          trigger_type: "event",
          actions: [{ type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Welcome!" } }],
        },
        error: null,
      })
    );

    const tplResult = await createWorkflowTemplate({
      name: "Welcome Notification",
      description: "Sends a welcome notification",
      triggerType: TRIGGER_TYPES.EVENT,
      actions: [{ type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Welcome!" } }],
      createdBy: "admin-1",
    });

    console.log("tplResult:", JSON.stringify(tplResult));

    supabaseAdmin.from.mockImplementationOnce(() =>
      mockSelectSingle({
        data: {
          id: templateId,
          name: "Welcome Notification",
          trigger_type: "event",
          conditions: [],
          actions: [{ type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Welcome!" } }],
        },
        error: null,
      })
    );

    supabaseAdmin.from.mockImplementationOnce(() =>
      mockInsertSingle({
        data: { id: "wf-from-tpl", name: "Customized Welcome", trigger_type: "event" },
        error: null,
      })
    );

    const instanceResult = await instantiateFromTemplate({
      templateId,
      customizations: {
        name: "Customized Welcome",
        actions: [{ type: ACTION_TYPES.SEND_NOTIFICATION, config: { title: "Custom Welcome!" } }],
      },
      createdBy: "admin-1",
    });

    console.log("instanceResult:", JSON.stringify(instanceResult));
  });
});
