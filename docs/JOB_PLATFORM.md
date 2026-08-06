# Fundora Job Platform

## Overview

The job platform provides reliable background job processing with priority queues, retry with exponential backoff, dead letter queues, and cron-based scheduling.

## Architecture

```
                    ┌─────────────┐
                    │   enqueue()  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   job_queue  │
                    │  (Supabase) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼────┐ ┌────▼────┐ ┌────▼─────┐
        │  Pending  │ │ Running │ │ Retrying  │
        └─────┬────┘ └────┬────┘ └────┬──────┘
              │           │           │
              │     ┌─────▼─────┐     │
              └────►│ Completed │◄────┘
                    └──────┬────┘
                           │
                    ┌──────▼──────┐
                    │ Dead Letter  │
                    │  (exhausted) │
                    └─────────────┘
```

## Features

### 1. Priority Queues

Jobs have priority levels (1-10):
- `low` = 1
- `normal` = 5
- `high` = 8
- `critical` = 10

Higher priority jobs are processed first.

### 2. Retry with Backoff

```
Retry 0 → 1s delay
Retry 1 → 2s delay
Retry 2 → 4s delay
Retry 3 → 8s delay
Retry 4 → 16s delay
Retry 5+ → 30s (capped)
```

### 3. Dead Letter Queue

After exhausting max retries, jobs move to `dead_letter` status. They can be:
- **Requeued**: Reset retries and return to pending
- **Purged**: Permanently deleted

### 4. Scheduled Jobs

Cron-based scheduling for recurring tasks:
- Daily cleanup jobs
- Periodic reports
- Data sync operations
- Maintenance tasks

## Usage

### Registering Handlers

```javascript
import { registerHandler } from "../lib/jobs/index.js";

registerHandler("notification.push", async (payload, { jobId }) => {
  await sendPushNotification(payload.userId, payload.message);
});
```

### Enqueuing Jobs

```javascript
import { enqueue, enqueueBulk } from "../lib/jobs/index.js";

// Single job
await enqueue("email.send", {
  to: "user@example.com",
  template: "welcome",
}, {
  queueName: "mailers",
  priority: "high",
  maxRetries: 5,
  scheduledAt: "2026-08-01T00:00:00Z",
});

// Bulk
await enqueueBulk([
  { jobType: "resize.image", payload: { imageId: 1 } },
  { jobType: "resize.image", payload: { imageId: 2 } },
]);
```

### Processing the Queue

```javascript
import { processQueue, processScheduledJobs } from "../lib/jobs/index.js";

// Process 10 jobs from default queue
await processQueue("default", { batchSize: 10, maxJobsPerMinute: 60 });

// Process scheduled jobs
await processScheduledJobs();
```

### Managing Dead Letters

```javascript
import { requeueDeadLetters, purgeDeadLetters } from "../lib/jobs/index.js";

// Requeue up to 50 dead letters
await requeueDeadLetters("default", { limit: 50 });

// Purge all dead letters
await purgeDeadLetters("default");
```

### Creating Schedules

```javascript
import { createSchedule, toggleSchedule, listSchedules } from "../lib/jobs/index.js";

// Create a daily schedule at midnight
await createSchedule({
  name: "Daily cleanup",
  jobType: "cleanup.expired_sessions",
  queueName: "maintenance",
  scheduleCron: "0 0 * * *",
  maxRuns: 365, // run for one year
});

// Toggle schedule on/off
await toggleSchedule(scheduleId);

// List all schedules
const { data: schedules } = await listSchedules({ isActive: true });
```

## Database Tables

### `job_queue`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| queue_name | TEXT | Queue identifier |
| job_type | TEXT | Handler type identifier |
| payload | JSONB | Job data |
| priority | INTEGER | 1-10, higher = first |
| status | TEXT | pending/running/completed/retrying/dead_letter/cancelled |
| retry_count | INTEGER | Current retry attempt |
| max_retries | INTEGER | Max retry attempts (default 3) |
| last_error | TEXT | Last error message |
| scheduled_at | TIMESTAMPTZ | Delayed execution |
| started_at | TIMESTAMPTZ | When processing began |
| completed_at | TIMESTAMPTZ | When processing ended |

### `scheduled_jobs`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Human-readable name |
| job_type | TEXT | Handler to invoke |
| schedule_cron | TEXT | Cron expression |
| is_active | BOOLEAN | Whether schedule is enabled |
| max_runs | INTEGER | Max executions (null = unlimited) |
| run_count | INTEGER | Times executed |
| next_run_at | TIMESTAMPTZ | Next scheduled execution |

## Error Handling

Jobs that throw an error are automatically retried. If max retries are exhausted, the job enters the dead letter queue. An audit event is logged for all dead letter transitions.

```javascript
// Handler with error handling
registerHandler("unreliable.job", async (payload) => {
  try {
    // Risky operation
    await externalService.call(payload);
  } catch (err) {
    // Log context
    console.error(`Job failed: ${err.message}`, { jobId });
    throw err; // Re-throw to trigger retry
  }
});
```
