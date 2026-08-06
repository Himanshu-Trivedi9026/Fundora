// Agent Workflow — agent workflow definition and execution
// Defines workflow steps, transitions, and approval gates

import { supabaseAdmin } from "../supabaseAdmin.js";

export const WORKFLOW_STEPS = {
  ANALYZE: "analyze",
  DECIDE: "decide",
  EXECUTE: "execute",
  VERIFY: "verify",
  REPORT: "report",
};

export const STEP_TYPES = {
  AI: "ai",
  ACTION: "action",
  APPROVAL: "approval",
  CONDITION: "condition",
  WAIT: "wait",
};

export async function createWorkflow(agentId, steps, options = {}) {
  try {
    const workflow = {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      steps: steps.map((step, i) => ({
        order: i + 1,
        id: step.id || `step_${i + 1}`,
        type: step.type || STEP_TYPES.AI,
        name: step.name || `Step ${i + 1}`,
        prompt: step.prompt || "",
        action: step.action || null,
        condition: step.condition || null,
        requiresApproval: step.requiresApproval || false,
        timeout: step.timeout || 30000,
        retryCount: 0,
        maxRetries: step.maxRetries || 2,
      })),
      status: "pending",
      currentStep: 0,
      results: [],
      errors: [],
      createdAt: new Date().toISOString(),
      ...options,
    };

    return { success: true, data: workflow };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function executeWorkflow(workflow, context = {}) {
  try {
    const results = [];
    const errors = [];

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      workflow.currentStep = i;

      // Check approval gate
      if (step.requiresApproval) {
        return {
          success: true,
          data: {
            workflowId: workflow.id,
            status: "pending_approval",
            currentStep: i,
            step: step.name,
            results,
            message: `Step "${step.name}" requires human approval`,
          },
        };
      }

      // Execute step
      const stepResult = await executeStep(step, context, results);
      if (stepResult.error) {
        errors.push({ step: step.name, error: stepResult.error });
        if (stepResult.fatal) break;
      }

      results.push(stepResult);
    }

    return {
      success: true,
      data: {
        workflowId: workflow.id,
        status: errors.length > 0 ? "completed_with_errors" : "completed",
        steps: workflow.steps.length,
        results,
        errors,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function executeStep(step, context, previousResults) {
  try {
    switch (step.type) {
      case STEP_TYPES.AI:
        return await executeAIStep(step, context, previousResults);
      case STEP_TYPES.ACTION:
        return await executeActionStep(step, context);
      case STEP_TYPES.APPROVAL:
        return { status: "pending_approval", step: step.name };
      case STEP_TYPES.CONDITION:
        return await executeConditionStep(step, context, previousResults);
      case STEP_TYPES.WAIT:
        return { status: "waiting", step: step.name };
      default:
        return { error: `Unknown step type: ${step.type}` };
    }
  } catch (err) {
    return { error: err.message, step: step.name };
  }
}

async function executeAIStep(step, context, previousResults) {
  // In production: call AI provider with step.prompt + context
  return {
    status: "completed",
    step: step.name,
    output: { analysis: `AI analysis for: ${step.prompt}` },
    timestamp: new Date().toISOString(),
  };
}

async function executeActionStep(step, context) {
  return {
    status: "completed",
    step: step.name,
    action: step.action,
    timestamp: new Date().toISOString(),
  };
}

async function executeConditionStep(step, context, previousResults) {
  return {
    status: "completed",
    step: step.name,
    condition: step.condition,
    result: true,
    timestamp: new Date().toISOString(),
  };
}

export function createApprovalGate(stepName, timeout = 86400000) {
  return {
    type: STEP_TYPES.APPROVAL,
    name: `Approval: ${stepName}`,
    requiresApproval: true,
    timeout,
  };
}
