# Compliance Engine

## Overview

The Compliance Engine manages regulatory compliance cases, evidence tracking, and platform governance. It provides a full case lifecycle with audit trails, escalation workflows, and a configurable policy engine for database-driven platform rules.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Compliance Engine                   │
├─────────────────────────────────────────────────┤
│  complianceEngine.js  │ Case Lifecycle & CRUD   │
│  complianceEvents.js  │ Audit Trail             │
│  policyEngine.js      │ Configurable Policies   │
│  index.js             │ Barrel Exports          │
└─────────────────────────────────────────────────┘
```

## Case Lifecycle

```
created → open → investigating → pending_review → resolved
                                                    ↓
                                                 closed
        ↑        ↓          ↓           ↓            ↓
      reopened ← closed  escalated  reopened     reopened
                  ↓
              investigating → resolved
```

Any resolved or closed case can be reopened. Escalation always sets priority to urgent.

## Case Types

| Type                  | Description                             |
| --------------------- | --------------------------------------- |
| `fraud_report`        | Suspected fraudulent activity by a user |
| `kyc_review`          | Know Your Customer verification review  |
| `aml_check`           | Anti-money laundering investigation     |
| `dispute`             | User or campaign dispute resolution     |
| `policy_violation`    | Violation of platform policies          |
| `suspicious_activity` | Unusual or suspicious behavior detected |
| `regulatory_request`  | External regulatory inquiry             |
| `internal_audit`      | Internal compliance audit               |
| `user_complaint`      | Formal user complaint                   |
| `campaign_review`     | Campaign content or behavior review     |

## Case Statuses

| Status           | Description                                   |
| ---------------- | --------------------------------------------- |
| `created`        | Case just created, not yet opened             |
| `open`           | Case is open and awaiting assignment          |
| `investigating`  | Actively being investigated                   |
| `pending_review` | Investigation complete, awaiting review       |
| `resolved`       | Case resolved with a resolution               |
| `closed`         | Case permanently closed                       |
| `reopened`       | Previously resolved/closed case reopened      |
| `escalated`      | Escalated to senior staff (priority = urgent) |

## Resolution Types

| Resolution                  | Description                        |
| --------------------------- | ---------------------------------- |
| `dismissed`                 | Complaint or report dismissed      |
| `confirmed_violation`       | Violation confirmed                |
| `warning_issued`            | Warning issued to subject          |
| `account_suspended`         | Subject account suspended          |
| `account_banned`            | Subject account permanently banned |
| `campaign_suspended`        | Subject campaign suspended         |
| `campaign_removed`          | Subject campaign removed           |
| `funds_frozen`              | Subject funds frozen               |
| `funds_released`            | Frozen funds released              |
| `no_action_required`        | No action needed                   |
| `referred_to_authorities`   | Referred to law enforcement        |
| `policy_change_recommended` | Policy change recommended          |

## Priority Levels

| Priority | Description                           |
| -------- | ------------------------------------- |
| `low`    | Low priority, routine review          |
| `medium` | Standard priority (default)           |
| `high`   | High priority, needs prompt attention |
| `urgent` | Urgent — auto-assigned on escalation  |

## Key Functions

### `createComplianceCase({ caseType, subjectUserId, subjectCampaignId, priority, description, evidenceUrls, metadata })`

Creates a new compliance case with auto-generated case number (COMP-YYYY-NNNNN).

**Parameters:**

- `caseType` (string, required) — Case type from COMPLIANCE_CASE_TYPES
- `subjectUserId` (string, optional) — User ID being investigated
- `subjectCampaignId` (string, optional) — Campaign ID being investigated
- `priority` (string, default: "medium") — Priority from COMPLIANCE_PRIORITIES
- `description` (string, optional) — Case description
- `evidenceUrls` (string[], default: []) — URLs to evidence files
- `metadata` (object, default: {}) — Additional metadata

**Returns:** `{ success: boolean, data?: Object, error?: string }`

At least one of `subjectUserId` or `subjectCampaignId` is required.

### `getComplianceCase(caseId)`

Fetches a compliance case by ID.

### `getComplianceCaseByNumber(caseNumber)`

Fetches a compliance case by case number (e.g., `COMP-2026-00001`).

### `getComplianceCases({ status, caseType, priority, assignedTo, limit, offset })`

Lists compliance cases with optional filters and pagination.

### `updateComplianceCase(caseId, updates, performedBy, performedByType)`

Updates a compliance case with status transition validation.

**Parameters:**

- `caseId` (string, required) — Case ID
- `updates` (object, required) — Fields to update (whitelist: status, priority, description, evidence_urls, metadata, assigned_to, resolution_type, resolution, resolved_at, closed_at, escalated_at, escalation_reason)
- `performedBy` (string, optional) — User ID performing the update
- `performedByType` (string, default: "admin") — Actor type

### `assignComplianceCase(caseId, assignTo, assignedBy)`

Assigns a case to an investigator. Cannot assign resolved or closed cases.

### `resolveComplianceCase(caseId, resolutionType, resolution, performedBy)`

Resolves a compliance case. Validates status transition and resolution type.

### `reopenComplianceCase(caseId, reason, performedBy)`

Reopens a resolved or closed case. Clears previous resolution data.

### `escalateComplianceCase(caseId, reason, performedBy)`

Escalates a case. Sets status to `escalated` and priority to `urgent`.

### `getComplianceStats()`

Returns aggregated statistics: total, open, investigating, resolved counts, plus breakdowns by type and priority.

## Compliance Events Audit Trail

### `recordComplianceEvent({ complianceCaseId, eventType, entityType, entityId, userId, action, oldStatus, newStatus, details, performedBy, performedByType, ipAddress })`

Records an audit event. Details are sanitized before storage. IP addresses are hashed.

### `getComplianceEvents({ complianceCaseId, entityType, entityId, limit, offset })`

Queries compliance events with filters and pagination.

### `getComplianceEventSummary(complianceCaseId)`

Returns aggregated event stats for a case (by event type, action, entity type, actor type).

## Event Types

`case.created`, `case.updated`, `case.status_changed`, `case.assigned`, `case.reassigned`, `case.resolved`, `case.reopened`, `case.escalated`, `case.closed`, `evidence.added`, `evidence.removed`, `note.added`, `review.submitted`, `review.completed`, `action.taken`, `flag.raised`, `flag.cleared`

## Policy Engine

Database-driven configurable policies with version history and context-based evaluation.

### Policy Categories

`verification`, `fraud`, `payout`, `escrow`, `milestone`, `compliance`, `kyc`, `aml`, `general`

### Policy Types

| Type        | Evaluation                                                     |
| ----------- | -------------------------------------------------------------- |
| `threshold` | `context.value < policyValue` → allowed (higher = higher risk) |
| `boolean`   | Returns `Boolean(value)` — simple enable/disable gate          |
| `array`     | Checks if policy value is a subset of context value            |
| `string`    | Returns value passively, caller decides                        |
| `number`    | Returns value passively, caller decides                        |
| `json`      | Returns value passively, caller decides                        |

### Key Functions

#### `createPolicy({ policyKey, name, description, category, policyType, value, defaultValue, minValue, maxValue, allowedValues, createdBy })`

Creates a new policy. Validates category and type.

#### `updatePolicyValue(policyId, newValue, changeReason, changedBy)`

Updates a policy value. Creates a `policy_versions` entry and increments version. Validates constraints (min/max, allowed values).

#### `evaluatePolicy(policyKey, context)`

Evaluates a policy against a context. Returns `{ success, allowed, value, reason }`.

#### `getPolicyVersions(policyId)`

Fetches version history for a policy.

#### `initializeDefaultPolicies()`

Creates default policies if they don't exist:

| Policy Key                         | Category     | Type      | Default                  |
| ---------------------------------- | ------------ | --------- | ------------------------ |
| `min_trust_score`                  | verification | threshold | 30                       |
| `required_verifications`           | verification | array     | ["email", "phone", "id"] |
| `fraud_block_threshold`            | fraud        | threshold | 75                       |
| `fraud_monitor_threshold`          | fraud        | threshold | 50                       |
| `max_payout_amount`                | payout       | threshold | 100000000                |
| `min_payout_amount`                | payout       | threshold | 1000                     |
| `escrow_fee_percentage`            | escrow       | threshold | 5.0                      |
| `auto_approve_milestone_threshold` | milestone    | threshold | 80                       |

## Usage Example

```javascript
import {
  createComplianceCase,
  resolveComplianceCase,
  escalateComplianceCase,
} from "../lib/compliance";

// Create a compliance case
const result = await createComplianceCase({
  caseType: "fraud_report",
  subjectUserId: "user-123",
  priority: "high",
  description: "Suspicious donation pattern detected",
  evidenceUrls: ["https://evidence.example.com/report-001.pdf"],
});

// Escalate the case
await escalateComplianceCase(
  result.data.id,
  "Pattern matches known fraud ring",
  "admin-456",
);

// Resolve the case
await resolveComplianceCase(
  result.data.id,
  "confirmed_violation",
  "Account suspended after investigation",
  "admin-456",
);

// Evaluate a policy
import { evaluatePolicy } from "../lib/policy";

const evaluation = await evaluatePolicy("fraud_block_threshold", {
  value: 82,
});
// { success: true, allowed: false, value: 75, reason: "Value 82 meets or exceeds threshold 75" }
```

## Security

- All mutations are audit-logged via `logAuditEvent`
- Status transitions are validated against strict allowed-transition map
- Case numbers auto-generated (COMP-YYYY-NNNNN format)
- Field whitelisting on updates prevents mass-assignment attacks
- IP addresses are hashed before storage (never stored raw)
- Sensitive details (tokens, keys, passwords, OTPs) are stripped before event storage
- Uses `secureLogger` for all logging with PII redaction
- Uses `supabaseAdmin` for all DB operations (service role)
- RLS policies restrict compliance tables to service role only
- Policy changes are versioned with full audit trail
- Moderator notes, internal compliance notes, and risk formulas are never exposed to end users
