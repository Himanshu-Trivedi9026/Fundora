# Payout Architecture

## Overview

The Payout System manages creator payouts with fraud integration, admin approval workflow, and provider abstraction.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Payout System                      │
├─────────────────────────────────────────────────┤
│  payoutEngine.js      │ Payout Management        │
│  providerAdapter.js   │ Provider Abstraction      │
│  (fraud)              │ Fraud Integration         │
└─────────────────────────────────────────────────┘
```

## Payout Lifecycle

```
request → pending → approved → processing → completed/failed
                ↓
              rejected
                ↓
              cancelled
```

## Key Functions

### `createPayoutRequest({ creatorId, escrowAccountId, bankAccountId, amount })`

Creates a payout request. Calculates fees and runs fraud evaluation.

**Parameters:**
- `creatorId` (string, required) — Creator ID
- `escrowAccountId` (string, required) — Escrow account ID
- `bankAccountId` (string, required) — Bank account ID for payout
- `amount` (number, required) — Payout amount in cents

**Returns:** `{ success: boolean, data?: Object, error?: string }`

### `getPayoutRequest(payoutRequestId)`

Fetches a payout request by ID with related data.

### `getCreatorPayoutRequests(creatorId)`

Fetches all payout requests for a creator.

### `getPendingPayouts({ limit, offset })`

Fetches pending payout requests (admin view).

### `approvePayout(payoutRequestId, adminId)`

Admin approves a pending payout (pending → approved).

### `rejectPayout(payoutRequestId, adminId, reason)`

Admin rejects a payout (pending/approved → rejected).

### `cancelPayout(payoutRequestId, userId)`

Cancels a pending payout (creator or admin).

### `processPayout(payoutRequestId)`

Processes an approved payout via payment provider.

### `retryPayout(payoutRequestId)`

Retries a failed payout (max 3 attempts).

### `getPayoutHistory(creatorId, limit, offset)`

Fetches payout history for a creator.

### `getCreatorBalance(creatorId)`

Returns creator's escrow balance breakdown.

## Fraud Integration

**Every payout request** is evaluated by the fraud engine:

1. `createPayoutRequest` calls `evaluateUser` with trigger `payout_request`
2. `processPayout` calls `evaluateUser` again with trigger `payout_processing`
3. `retryPayout` calls `evaluateUser` with trigger `payout_retry`

If fraud decision is `block`, the payout is denied.

## Fee Structure

- **Default fee:** 5%
- **Minimum payout:** $10.00 (1000 cents)
- **Maximum payout:** $1,000,000.00 (100000000 cents)

Fee calculation:
```javascript
feeAmount = Math.round(amount × (feePercentage / 100))
netAmount = amount - feeAmount
```

## Provider Architecture

```javascript
// Base class
class BasePayoutProvider {
  async createPayout(params) { /* abstract */ }
  async checkStatus(transactionId) { /* abstract */ }
  async cancelPayout(transactionId) { /* abstract */ }
}

// Implementations
class MockPayoutProvider extends BasePayoutProvider { ... }
class RazorpayPayoutProvider extends BasePayoutProvider { ... }
class CashfreePayoutProvider extends BasePayoutProvider { ... }
class StripePayoutProvider extends BasePayoutProvider { ... }
```

### Registry

```javascript
import { registerProvider, setActiveProvider, getActiveProvider } from "../lib/escrow/providerAdapter";

// Register providers
registerProvider("mock", new MockPayoutProvider());
registerProvider("razorpay", new RazorpayPayoutProvider({ apiKey: "..." }));

// Set active provider
setActiveProvider("razorpay");

// Get active provider
const provider = getActiveProvider();
```

## Balance Breakdown

```javascript
import { getCreatorBalance } from "../lib/payout";

const balance = await getCreatorBalance("user-123");

// Returns:
{
  totalAvailable: 50000,    // Available for payout
  totalLocked: 10000,       // Locked in pending payouts
  totalReleased: 25000,     // Already paid out
  totalPending: 5000,       // In pending payout requests
  accounts: [
    {
      escrowAccountId: "escrow-1",
      campaignId: "campaign-1",
      available: 30000,
      locked: 5000,
      released: 15000,
      status: "active"
    }
  ]
}
```

## Usage Example

```javascript
import { createPayoutRequest, approvePayout, processPayout } from "../lib/payout";

// Creator requests payout
const request = await createPayoutRequest({
  creatorId: "user-123",
  escrowAccountId: "escrow-456",
  bankAccountId: "bank-789",
  amount: 50000, // $500.00
});

// Admin approves
await approvePayout(request.data.id, "admin-001");

// Process via provider
const result = await processPayout(request.data.id);
```

## Security

- Every payout consults the fraud engine
- Admin-only approval/rejection
- All actions audit-logged
- Optimistic locking for concurrent safety
- Uses `secureLogger` for all logging
