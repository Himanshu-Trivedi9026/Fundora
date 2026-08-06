# Moderation System

## Overview

The Moderation System handles content and user moderation with case management, escalation workflows, and an appeals process. It provides report submission, moderator assignment, resolution tracking, and a full appeal lifecycle.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Moderation System                   │
├─────────────────────────────────────────────────┤
│  moderationEngine.js │ Case Lifecycle & CRUD     │
│  appealsEngine.js    │ Appeal Lifecycle           │
│  index.js            │ Barrel Exports            │
└─────────────────────────────────────────────────┘
```

## Moderation Case Lifecycle

```
create → open → in_review → resolved
                      ↓
                   escalated (priority → critical)
                      ↓
                   action = escalated_to_admin

resolved → reopened (clears resolution, appends reopen history)
```

Cases in `resolved` or `escalated` status cannot be assigned. Escalation automatically sets priority to critical.

## Case Types

| Constant                | Value                     |
| ----------------------- | ------------------------- |
| `SPAM`                  | `"spam"`                  |
| `HARASSMENT`            | `"harassment"`            |
| `FRAUD`                 | `"fraud"`                 |
| `INAPPROPRIATE_CONTENT` | `"inappropriate_content"` |
| `COPYRIGHT`             | `"copyright"`             |
| `FAKE_CAMPAIGN`         | `"fake_campaign"`         |
| `MISUSE_OF_FUNDS`       | `"misuse_of_funds"`       |
| `VERIFICATION_ABUSE`    | `"verification_abuse"`    |
| `OTHER`                 | `"other"`                 |

## Case Statuses

| Status      | Description                              |
| ----------- | ---------------------------------------- |
| `open`      | Case reported, awaiting assignment       |
| `in_review` | Assigned to moderator, under review      |
| `resolved`  | Case resolved with action taken          |
| `escalated` | Escalated to admin (priority = critical) |
| `reopened`  | Previously resolved case reopened        |

## Moderation Actions

| Action                 | Description                     |
| ---------------------- | ------------------------------- |
| `none`                 | No action taken                 |
| `dismissed`            | Report dismissed                |
| `warning`              | Warning issued to reported user |
| `content_removal`      | Reported content removed        |
| `content_edit`         | Content edited or modified      |
| `temporary_suspension` | Account temporarily suspended   |
| `permanent_ban`        | Account permanently banned      |
| `account_restriction`  | Account restricted              |
| `campaign_restriction` | Campaign restricted             |
| `escalated_to_admin`   | Escalated to admin for review   |

## Key Functions

### `createModerationCase({ caseType, reporterId, reportedUserId, reportedCampaignId, reportedContentType, reportedContentId, description, evidenceUrls, metadata })`

Creates a moderation case with auto-generated case number (MOD-YYYY-NNNNN).

**Parameters:**

- `caseType` (string, required) — Type from MODERATION_CASE_TYPES
- `reporterId` (string, required) — Reporter's user ID
- `reportedUserId` (string, optional) — User being reported
- `reportedCampaignId` (string, optional) — Campaign being reported
- `reportedContentType` (string, optional) — Type of reported content
- `reportedContentId` (string, optional) — ID of reported content
- `description` (string, required) — Description of the issue
- `evidenceUrls` (string[], default: []) — Evidence URLs
- `metadata` (object, default: {}) — Additional metadata

**Returns:** `{ success: boolean, data?: Object, error?: string }`

### `getModerationCase(caseId)`

Fetches a moderation case by ID.

### `getModerationCaseByNumber(caseNumber)`

Fetches by case number (e.g., `MOD-2024-00001`).

### `getModerationCases({ status, caseType, priority, moderatorId, reporterId, limit, offset })`

Lists cases with optional filters and pagination.

### `assignModerationCase(caseId, moderatorId, assignedBy)`

Assigns a moderator. Transitions status to `in_review`. Blocked if resolved or escalated.

### `resolveModerationCase(caseId, actionTaken, resolution, moderatorNotes, performedBy)`

Resolves a case with an action. Blocked if already resolved.

**Parameters:**

- `caseId` (string, required) — Case ID
- `actionTaken` (string, required) — Action from MODERATION_ACTIONS
- `resolution` (string, required) — Resolution description
- `moderatorNotes` (string, optional) — Internal notes (never exposed to users)
- `performedBy` (string, required) — Moderator user ID

### `reopenModerationCase(caseId, reason, performedBy)`

Reopens a resolved case. Clears resolution, appends to reopen history in metadata.

### `escalateModerationCase(caseId, reason, performedBy)`

Escalates a case. Sets status to `escalated`, priority to `critical`, action to `escalated_to_admin`. Appends to escalation history.

### `getModerationStats()`

Returns aggregated statistics: total, open counts, by type, by action, by priority.

## Appeals System

### Appeal Lifecycle

```
submitted → under_review → decided (uphold/overturn/modify/escalate)
                ↓
         evidence_requested → (returns to reviewer)

At any point before closed:
  → withdrawn (appellant only)
```

Appeals have a **7-day review deadline** from submission.

### Appeal Types

| Constant              | Value                   |
| --------------------- | ----------------------- |
| `ACCOUNT_SUSPENSION`  | `"account_suspension"`  |
| `CAMPAIGN_REMOVAL`    | `"campaign_removal"`    |
| `PAYMENT_DISPUTE`     | `"payment_dispute"`     |
| `FRAUD_ALLEGATION`    | `"fraud_allegation"`    |
| `CONTENT_REMOVAL`     | `"content_removal"`     |
| `TRUST_SCORE_DISPUTE` | `"trust_score_dispute"` |
| `MILESTONE_REJECTION` | `"milestone_rejection"` |
| `PAYOUT_REJECTION`    | `"payout_rejection"`    |
| `OTHER`               | `"other"`               |

### Appeal Statuses

| Status               | Description                                     |
| -------------------- | ----------------------------------------------- |
| `draft`              | Draft (not yet submitted)                       |
| `submitted`          | Submitted, awaiting review                      |
| `under_review`       | Assigned to reviewer                            |
| `evidence_requested` | Additional evidence requested                   |
| `decided`            | Decision made (uphold/overturn/modify/escalate) |
| `closed`             | Appeal closed                                   |
| `withdrawn`          | Withdrawn by appellant                          |

### Appeal Decisions

| Decision   | Description                  |
| ---------- | ---------------------------- |
| `uphold`   | Original decision upheld     |
| `overturn` | Original decision overturned |
| `modify`   | Original decision modified   |
| `escalate` | Escalated to senior reviewer |

### Key Functions

#### `createAppeal({ appealType, appellantId, originalAction, originalActionId, originalActionType, reason, evidenceUrls, metadata })`

Creates an appeal with auto-generated number (APL-YYYY-NNNNN) and 7-day deadline.

#### `assignAppealReviewer(appealId, reviewerId, assignedBy)`

Assigns a reviewer. Transitions to `under_review`. Blocked if closed or withdrawn.

#### `requestEvidence(appealId, reason, performedBy)`

Sets status to `evidence_requested`. Blocked if closed or withdrawn.

#### `reviewAppeal(appealId, reviewerDecision, decisionReason, reviewerNotes, performedBy)`

Reviews an appeal with a decision. Sets status to `decided`. Blocked if closed or withdrawn.

#### `withdrawAppeal(appealId, performedBy)`

Only the appellant can withdraw their own appeal. Blocked if closed or withdrawn.

#### `getAppealsStats()`

Returns aggregated stats: total, pending, by type, by status.

## Usage Example

```javascript
import {
  createModerationCase,
  resolveModerationCase,
  escalateModerationCase,
} from "../lib/moderation";

import { createAppeal, reviewAppeal } from "../lib/appeals";

// Report content
const report = await createModerationCase({
  caseType: "spam",
  reporterId: "user-123",
  reportedUserId: "user-456",
  description: "Spam campaign posting fake information",
  evidenceUrls: ["https://evidence.example.com/screenshot.png"],
});

// Resolve with warning
await resolveModerationCase(
  report.data.id,
  "warning",
  "User warned for spam behavior",
  "First offense, low severity",
  "moderator-789",
);

// User appeals the decision
const appeal = await createAppeal({
  appealType: "content_removal",
  appellantId: "user-456",
  originalAction: "warning issued",
  originalActionId: report.data.id,
  originalActionType: "moderation_case",
  reason: "Content was misclassified as spam",
});

// Review appeal
await reviewAppeal(
  appeal.data.id,
  "overturn",
  "Content verified as legitimate after review",
  null,
  "admin-001",
);
```

## Security

- Case numbers auto-generated (MOD-YYYY-NNNNN format)
- All state transitions are audit-logged
- Moderator notes are internal only — never exposed to users or API responses
- Escalation history tracked in metadata (append-only)
- Reopen history tracked in metadata (append-only)
- Only the appellant can withdraw their own appeals (enforced in code)
- Unauthorized withdrawal attempts are logged as warnings
- User IDs truncated in logs (PII protection)
- Uses `secureLogger` for all logging
- Uses `supabaseAdmin` for all DB operations
- RLS policies restrict moderation and appeals tables to service role only
