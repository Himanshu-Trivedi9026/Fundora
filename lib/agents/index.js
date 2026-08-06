// Agent Platform — barrel exports

export {
  createAgent,
  updateAgent,
  getAgent,
  listAgents,
  activateAgent,
  deactivateAgent,
  deleteAgent,
  runAgent,
  approveAgentRun,
  cancelAgentRun,
  getAgentRun,
  listAgentRuns,
  buildAgentContext,
  scheduleAgentRun,
  processScheduledRuns,
  listSchedules,
  toggleSchedule,
  storeMemory,
  recallMemory,
  recallByType,
  checkAgentPermission,
  grantAgentPermission,
} from "./agentEngine.js";

export {
  getAgentType,
  listAgentTypes,
  registerAgentType,
  createAgentInstance,
  getAgentInstance,
  listAgentInstances,
} from "./agentRegistry.js";

export {
  checkAgentPermission as checkPermission,
  checkAllPermissions,
  grantAgentPermission as grantPermission,
  revokeAgentPermission,
  requiresHumanApproval,
  getApprovalActions,
  AGENT_ACTIONS,
} from "./agentPermissions.js";

export {
  storeMemory as storeAgentMemory,
  recallMemory as recallAgentMemory,
  recallByType as recallAgentMemoryByType,
  forgetMemory,
  clearMemory,
  buildAgentContext as buildContext,
  storeConversationMessage,
  getConversationHistory,
} from "./agentMemory.js";

export {
  createWorkflow,
  executeWorkflow,
  createApprovalGate,
  WORKFLOW_STEPS,
  STEP_TYPES,
} from "./agentWorkflow.js";

export {
  scheduleAgentRun as scheduleRun,
  processScheduledRuns as processSchedules,
  listSchedules as listAgentSchedules,
  toggleSchedule as toggleAgentSchedule,
  deleteSchedule,
} from "./agentScheduler.js";

export {
  runAgent as executeAgent,
  approveAgentRun as approveRun,
  cancelAgentRun as cancelRun,
  getAgentRun as getRun,
  listAgentRuns as listRuns,
} from "./agentExecution.js";

export { buildAgentContext as buildExecutionContext } from "./agentContext.js";
