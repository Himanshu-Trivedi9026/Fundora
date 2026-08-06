# Escrow Engine

## Overview

The Escrow Engine manages secure fund holding for campaigns. It provides account lifecycle management, status transitions, and balance tracking.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Escrow Engine                     │
├─────────────────────────────────────────────────┤
│  escrowAccount.js    │ Account CRUD & Status     │
│  escrowLedger.js     │ Immutable Ledger          │
│  escrowRules.js      │ Business Rules            │
│  escrowEvents.js     │ Event Recording           │
│  releaseEngine.js    │ Fund Release              │
│  refundEngine.js     │ Refund Processing         │
│  settlementEngine.js │ Batch Settlement          │
│  providerAdapter.js  │ Payout Provider Abstraction│
│  escrowEngine.js     │ Main Orchestrator         │
└─────────────────────────────────────────────────┘
```

## Status Lifecycle

```
created → active → partially_released → fully_released
                    ↓                       ↓
                refunded / cancelled    refunded / cancelled
                    ↓                       ↓
                  closed                  closed
```

Any terminal state (fully_released, refunded, cancelled) → closed.

## Key Functions

### `createEscrowAccount({ campaignId, creatorId, feePercentage })`

Creates a new escrow account for a campaign.

**Parameters:**

- `campaignId` (string, required) — Campaign ID
- `creatorId` (string, required) — Creator's user ID
- `feePercentage` (number, required) — Platform fee percentage (0-100)

**Returns:** `{ success: boolean, account?: Object, error?: string }`

### `getEscrowAccount(escrowAccountId)`

Fetches an escrow account by ID.

### `getEscrowAccountByCampaign(campaignId)`

Fetches escrow account by campaign ID.

### `getEscrowAccountsByCreator(creatorId, { limit, offset, status })`

Lists all escrow accounts for a creator with pagination.

### `updateEscrowStatus(escrowAccountId, status, reason, performedBy)`

Updates escrow account status with validation and optimistic locking.

### `freezeEscrowAccount(escrowAccountId, reason, performedBy)`

Freezes an escrow account. Prevents all operations until unfrozen.

### `unfreezeEscrowAccount(escrowAccountId, performedBy)`

Unfreezes an escrow account. Returns it to active status.

### `closeEscrowAccount(escrowAccountId)`

Closes an escrow account. Only allowed in terminal states.

## Business Rules

### `canRelease(escrowAccount, amount)`

Checks if a fund release is allowed:

- Account is active or partially_released
- Account is not frozen
- Sufficient locked balance

### `canRefund(escrowAccount, amount)`

Checks if a refund is allowed:

- Account is not cancelled, closed, or fully_released
- Sufficient locked balance

### `canPayout(escrowAccount, amount)`

Checks if a payout is allowed:

- Account is active or partially_released
- Account is not frozen
- Sufficient creator earnings

### `calculatePlatformFee(amount, feePercentage)`

Calculates platform fee: `{ fee, net }`

### `validateAmount(amount)`

Validates monetary amount (100-100000000 cents).

## Usage Example

```javascript
import { createEscrowAccount, releaseFunds } from "../lib/escrow";

// Create escrow for campaign
const result = await createEscrowAccount({
  campaignId: "campaign-123",
  creatorId: "user-456",
  feePercentage: 5.0,
});

if (result.success) {
  console.log("Escrow created:", result.account.id);
}

// Release funds on milestone completion
const release = await releaseFunds({
  escrowAccountId: result.account.id,
  amount: 50000, // $500.00
  reason: "Milestone 1 completed",
  releasedBy: "admin-789",
  milestoneId: "milestone-101",
});
```

## Security

- All mutations are audit-logged
- Status transitions are validated against allowed transitions
- Optimistic locking prevents race conditions
- Uses `secureLogger` for all logging
- Uses `logAuditEvent` for append-only audit trail
