# Fundora Disaster Recovery Guide

## Overview

The disaster recovery system provides backup verification, restore validation, failover coordination, and runbook automation to ensure business continuity.

## Recovery Plans

Two default plans are initialized on startup:

### Default Plan

- **RTO**: 15 minutes
- **RPO**: 5 minutes
- Standard recovery for single-region deployment

### Critical Plan

- **RTO**: 5 minutes
- **RPO**: 1 minute
- High-availability recovery for multi-region deployment

## Backup Verification

### Verify Individual Backups

```javascript
import { verifyBackup } from "../lib/recovery/index.js";

const result = await verifyBackup("backup-uuid");
if (result.success) {
  console.log({
    checksumValid: result.data.checksumValid,
    sizeValid: result.data.sizeValid,
    retentionValid: result.data.retentionValid,
  });
}
```

### Bulk Verification

```javascript
import { verifyAllBackups } from "../lib/recovery/index.js";

const summary = await verifyAllBackups({ limit: 50 });
console.log(
  `Healthy: ${summary.data.healthy}, Corrupt: ${summary.data.corrupt}`,
);
```

## Restore Operations

### Validate Restore Plan

```javascript
import { validateRestorePlan } from "../lib/recovery/index.js";

const plan = await validateRestorePlan("backup-uuid", { critical: true });
if (plan.data.restorePossible) {
  // Proceed with restore
  console.log("Estimated downtime:", plan.data.estimatedDowntime);
  console.log("Steps:", plan.data.steps);
}
```

### Perform Restore

```javascript
import { performRestore } from "../lib/recovery/index.js";

const result = await performRestore("backup-uuid", {
  reason: "Data corruption incident #123",
  critical: true,
  tables: ["campaigns", "donations"],
});
// Audit events logged for restore start, completion, and failure
```

## Failover

```javascript
import { initiateFailover } from "../lib/recovery/index.js";

// Initiate cross-region failover
const result = await initiateFailover({
  plan: "critical",
  reason: "Primary region outage (us-east-1)",
  sourceRegion: "us-east-1",
  targetRegion: "us-west-2",
});
// { status: "completed", newPrimary: "us-west-2" }
```

## Runbooks

### Creating Runbooks

```javascript
import { createRunbook } from "../lib/recovery/index.js";

createRunbook("database-recovery", [
  { action: "Verify database health", critical: true },
  { action: "Check replication lag", critical: false },
  { action: "Initiate failover if needed", critical: true },
  { action: "Restore from backup if data corruption", critical: true },
  { action: "Verify data integrity post-recovery", critical: true },
]);
```

### Executing Runbooks

```javascript
import { executeRunbook } from "../lib/recovery/index.js";

const result = await executeRunbook("database-recovery");
// {
//   succeeded: 5,
//   failed: 0,
//   results: [
//     { step: 1, action: "Verify database health", status: "completed" },
//     ...
//   ]
// }
```

### Default Runbooks

The following runbooks are initialized automatically:

1. **database-recovery**: Database health check, replication, failover, restore, integrity verification
2. **infrastructure-incident**: Impact assessment, on-call notification, service isolation, scale-up, recovery, post-mortem

## API Endpoints

| Endpoint               | Method | Description                  |
| ---------------------- | ------ | ---------------------------- |
| `/api/health`          | GET    | Application health check     |
| `/api/health/database` | GET    | Database connectivity health |
| `/api/diagnostics`     | GET    | System diagnostics           |

## Runbook Best Practices

1. **Critical first**: Mark essential recovery steps as `critical: true` — the runbook stops mid-execution if a critical step fails
2. **Idempotent actions**: Each step should be safe to re-run
3. **Audit trail**: All runbook steps are logged to the audit log
4. **Parallel steps**: Run independent recovery actions concurrently
5. **Test regularly**: Execute runbooks in staging quarterly

## Monitoring Recovery Health

Regularly verify backup integrity:

```bash
# Via API
curl http://localhost:3000/api/diagnostics

# Check backup health in monitoring
# - Alert if corrupt backups > 0
# - Alert if no recent backups (older than RPO)
# - Alert if failover was attempted in last 24h
```
