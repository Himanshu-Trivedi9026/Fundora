# Automation Engine

## Overview

The automation engine (`lib/automation/workflowEngine.js`) provides configurable workflow automation for Fundora. It supports event-driven, schedule-based, manual, and webhook-triggered workflows with a full condition evaluation system and multi-type action pipeline.

All functions follow the "never throw" pattern and return `{ success: boolean, data?, error? }`.

## Workflow DSL

### Workflow Structure

```javascript
{
  name: "Campaign Quality Alert",
  description: "Notify admin when a new campaign has low quality score",
  triggerType: "event",         // event | schedule | manual | webhook
  conditions: [                 // Optional: all must match (AND logic at top level)
    { type: "equals", field: "campaignStatus", value: "active" },
    { type: "greater_than", field: "qualityScore", value: 80 }
  ],
  actions: [                    // Executed sequentially (fail-fast on error)
    { type: "send_notification", config: { userId: "...", title: "..." } },
    { type: "update_status", config: { entityType: "campaigns", ... } }
  ],
  retryConfig: {},              // Future: exponential backoff config
  scheduleConfig: {             // For schedule-type triggers
    intervalMs: 3600000,        // Run every hour
    lastRunAt: null
  }
}
```

## Trigger Types

| Type | Constant | Description | When to Use |
|------|----------|-------------|-------------|
| Event | `event` | Fires on platform events (donation, campaign creation, etc.) | Real-time reactions |
| Schedule | `schedule` | Fires on a time interval (configurable in `scheduleConfig.intervalMs`) | Periodic maintenance, reports |
| Manual | `manual` | Fires only when explicitly triggered via API | On-demand workflows |
| Webhook | `webhook` | Fires when an external webhook is received | Third-party integrations |

## Condition Types

Conditions are evaluated against a context object. All top-level conditions must match (AND semantics). Nested `and`/`or` conditions are supported for complex logic.

| Type | Constant | Parameters | Logic |
|------|----------|-----------|-------|
| Equals | `equals` | `field`, `value` | `context[field] === value` |
| Not Equals | `not_equals` | `field`, `value` | `context[field] !== value` |
| Greater Than | `greater_than` | `field`, `value` | `context[field] > value` |
| Less Than | `less_than` | `field`, `value` | `context[field] < value` |
| Contains | `contains` | `field`, `value` | `String(context[field]).includes(value)` |
| AND | `and` | `conditions[]` | All sub-conditions must match |
| OR | `or` | `conditions[]` | At least one sub-condition must match |

### Nested Conditions Example

```javascript
{
  type: "and",
  conditions: [
    { type: "equals", field: "status", value: "active" },
    { type: "or", conditions: [
      { type: "greater_than", field: "amount", value: 1000 },
      { type: "equals", field: "priority", value: "high" }
    ]}
  ]
}
```

## Action Types

Actions execute sequentially. If any action fails (returns `status: "error"`), execution stops immediately (fail-fast).

| Type | Constant | Config Fields | Description |
|------|----------|---------------|-------------|
| Send Notification | `send_notification` | `userId`, `notificationType`, `title`, `message`, `metadata` | Creates a notification record |
| Update Entity | `update_entity` | `entityType`, `entityId`, `updates` | Updates any database entity |
| Call API | `call_api` | `url`, `method`, `body`, `headers` | Makes an external HTTP request |
| Run AI | `run_ai` | `taskType`, ... | Triggers an AI operation (placeholder for background processing) |
| Send Webhook | `send_webhook` | `url`, `payload`, `secret` | Sends a webhook with optional HMAC signature |
| Update Status | `update_status` | `entityType`, `entityId`, `statusField`, `statusValue` | Updates a specific status field |
| Create Task | `create_task` | `title`, `description`, `assigneeId`, `priority`, `dueDate` | Creates a pending task |

## Execution Flow

```
triggerWorkflow()
  │
  ├─ 1. Load workflow from DB (verify exists and enabled)
  │
  ├─ 2. Create workflow_run record (status: "running")
  │
  ├─ 3. Evaluate conditions
  │     ├─ All matched → proceed to actions
  │     ├─ Not matched → status = "skipped"
  │     └─ Error → status = "failed"
  │
  ├─ 4. Execute actions sequentially
  │     ├─ Each action creates a workflow_log entry
  │     ├─ Success → continue to next action
  │     ├─ Error → fail-fast (stop execution)
  │     └─ All succeed → status = "completed"
  │         Some fail → status = "partial_failure"
  │
  ├─ 5. Update workflow_run with final status and output
  │
  └─ 6. Audit log the execution
```

### Run Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Created but not yet started |
| `running` | Currently executing |
| `completed` | All actions succeeded |
| `failed` | Condition evaluation failed or all actions failed |
| `partial_failure` | Some actions succeeded, some failed |
| `skipped` | Conditions were not met |

## CRUD Operations

### Create

```javascript
createWorkflow({
  name: "string",          // Required, max 255 chars
  description: "string",   // Optional
  triggerType: "event",    // Required: event|schedule|manual|webhook
  conditions: [],          // Optional array of condition objects
  actions: [],             // Optional array of action objects
  retryConfig: {},         // Optional
  scheduleConfig: {},      // Optional (for schedule triggers)
  createdBy: "userId",    // Required
  organizationId: "orgId"  // Optional
})
```

### Update

```javascript
updateWorkflow(workflowId, {
  name: "new name",
  conditions: [...],
  actions: [...],
  enabled: false
}, performedBy)
```

Allowed update fields: `name`, `description`, `trigger_type`, `conditions`, `actions`, `retry_config`, `schedule_config`, `enabled`.

### Delete

```javascript
deleteWorkflow(workflowId, performedBy)
```

### Enable / Disable

```javascript
enableWorkflow(workflowId, performedBy)
disableWorkflow(workflowId, performedBy)
```

### List

```javascript
listWorkflows({
  organizationId: "orgId",  // Optional filter
  enabled: true,            // Optional filter
  triggerType: "event",     // Optional filter
  limit: 20,                // Default 20, max 100
  offset: 0                 // Pagination
})
```

## Retry Logic

### Manual Retry

```javascript
retryWorkflowRun(runId, performedBy)
```

- Only `failed` or `partial_failure` runs can be retried
- Creates a new run with the same workflow and input
- Trigger event is prefixed with `retry_`
- Creates an audit log entry

### Automatic Retry (Planned)

The `retryConfig` on workflows supports future automatic retry with exponential backoff. Currently, retries are manual.

## Template System

### Create Template

```javascript
createWorkflowTemplate({
  name: "string",
  description: "string",
  triggerType: "event",
  conditions: [],
  actions: [],
  category: "general",     // Optional categorisation
  createdBy: "userId"
})
```

### Instantiate from Template

```javascript
instantiateFromTemplate({
  templateId: "uuid",
  customizations: {
    name: "Custom Workflow Name",
    actions: [...],         // Override template actions
    conditions: [...],      // Override template conditions
    organizationId: "orgId"
  },
  createdBy: "userId"
})
```

Templates are stored in `workflow_templates` and create new workflow instances with optional field overrides.

## Scheduling

### Process Scheduled Workflows

```javascript
processScheduledWorkflows()
```

This function is designed to be called by a cron job or scheduler:

1. Fetches all enabled workflows with `trigger_type = "schedule"`
2. For each, checks `schedule_config.intervalMs` against `schedule_config.lastRunAt`
3. If due, triggers the workflow with `triggerEvent: "schedule"`
4. Updates `lastRunAt` in the schedule config

Default interval: 1 hour (3,600,000 ms).

## Run History

### Get Runs

```javascript
getWorkflowRuns({
  workflowId: "uuid",
  limit: 20,
  offset: 0,
  status: "completed"      // Optional filter
})
```

### Get Single Run with Logs

```javascript
getWorkflowRun(runId)
// Returns run data + associated workflow_logs
```

## Audit Events

| Event Type | Trigger |
|------------|---------|
| `workflow.created` | New workflow created |
| `workflow.updated` | Workflow modified |
| `workflow.deleted` | Workflow deleted |
| `workflow.enabled` | Workflow enabled |
| `workflow.disabled` | Workflow disabled |
| `workflow.triggered` | Workflow executed |
| `workflow.run.retried` | Failed run retried |
| `workflow.template.created` | Template created |
| `workflow.instantiated_from_template` | Workflow created from template |

## Database Tables

| Table | Purpose |
|-------|---------|
| `workflow_templates` | Workflow definitions and templates |
| `workflow_runs` | Execution records with status and timing |
| `workflow_logs` | Step-level execution details |
