# Ledger Model

## Overview

The Escrow Ledger is an **immutable append-only** ledger for all escrow transactions. Entries are never updated or deleted by the application.

## Design Principles

1. **Immutable** — Entries cannot be modified or deleted
2. **Append-only** — Only INSERT operations are allowed
3. **Idempotent** — Idempotency keys prevent duplicate entries
4. **Auditable** — Every entry is permanently recorded
5. **Verifiable** — Balance integrity can be validated on demand

## Entry Types

| Type | Description | Amount Sign |
|------|-------------|-------------|
| `deposit` | Funds added to escrow (donations) | Positive (+) |
| `release` | Funds released to creator | Negative (-) |
| `refund` | Funds refunded to donors | Negative (-) |
| `fee` | Platform fees deducted | Negative (-) |
| `adjustment` | Manual balance adjustments (admin only) | +/- |

## Schema

```sql
CREATE TABLE escrow_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_account_id UUID NOT NULL REFERENCES escrow_accounts(id),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('deposit', 'release', 'refund', 'fee', 'adjustment')),
  amount NUMERIC(12,2) NOT NULL,  -- Positive for credits, negative for debits
  balance_after NUMERIC(12,2) NOT NULL,  -- Balance after this entry
  reference_type TEXT,  -- 'donation', 'milestone', 'payout_request', etc.
  reference_id UUID,    -- ID of the referenced entity
  description TEXT,     -- Human-readable description
  idempotency_key TEXT UNIQUE,  -- Prevents duplicate entries
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Key Functions

### `createLedgerEntry({ escrowAccountId, campaignId, entryType, amount, balanceAfter, referenceType, referenceId, description, idempotencyKey, metadata })`

Appends a ledger entry. Validates idempotency_key uniqueness before insert.

**Parameters:**
- `escrowAccountId` (string, required) — Escrow account ID
- `campaignId` (string, required) — Campaign ID
- `entryType` (string, required) — 'deposit' | 'release' | 'refund' | 'fee' | 'adjustment'
- `amount` (number, required) — Transaction amount (positive = credit, negative = debit)
- `balanceAfter` (number, required) — Account balance after this entry
- `referenceType` (string, optional) — Reference entity type
- `referenceId` (string, optional) — Reference entity ID
- `description` (string, optional) — Human-readable description
- `idempotencyKey` (string, optional) — Unique key to prevent duplicates
- `metadata` (object, optional) — Additional metadata (sensitive fields are stripped)

**Returns:** `{ success: boolean, entry?: Object, error?: string }`

### `getLedgerEntries({ escrowAccountId, entryType, limit, offset, startDate, endDate })`

Queries ledger entries with filters and pagination.

### `getLedgerBalance(escrowAccountId)`

Calculates current balance from ledger entries. Sums all amounts.

### `getLedgerSummary(escrowAccountId)**

Returns aggregated totals by entry type.

### `validateLedgerIntegrity(escrowAccountId)`

Validates ledger integrity by comparing calculated balance with account fields.

## Balance Calculation

```javascript
// From ledger entries
balance = entries.reduce((sum, entry) => sum + entry.amount, 0);

// From account fields
expectedBalance = lockedBalance - releasedBalance - refundedBalance;

// Integrity check
valid = Math.abs(calculatedBalance - expectedBalance) < 0.01;
```

## Idempotency

Idempotency keys prevent duplicate entries:

```javascript
await createLedgerEntry({
  escrowAccountId: "escrow-1",
  campaignId: "campaign-1",
  entryType: "deposit",
  amount: 10000,
  balanceAfter: 10000,
  idempotencyKey: "donation_donor123_2024-01-15",
});
```

If the same `idempotencyKey` is used again, the entry is rejected.

## Metadata Sanitization

Sensitive fields are automatically stripped from metadata:
- `ip_address`
- `session_token`
- `encryption_key`
- `api_key`
- `secret`
- `password`

## Usage Example

```javascript
import { createLedgerEntry, getLedgerBalance, validateLedgerIntegrity } from "../lib/escrow/escrowLedger";

// Record a donation
await createLedgerEntry({
  escrowAccountId: "escrow-1",
  campaignId: "campaign-1",
  entryType: "deposit",
  amount: 50000, // $500.00
  balanceAfter: 50000,
  referenceType: "donation",
  referenceId: "donation-123",
  description: "Donation from John Doe",
  idempotencyKey: "donation_donor123_2024-01-15",
});

// Check balance
const balance = await getLedgerBalance("escrow-1");
console.log("Current balance:", balance.balance); // 50000

// Validate integrity
const integrity = await validateLedgerIntegrity("escrow-1");
console.log("Ledger valid:", integrity.valid); // true
```

## Security

- Entries are **never** updated or deleted
- All entries are audit-logged
- Metadata is sanitized before storage
- Uses `secureLogger` for all logging
- Balance integrity can be validated on demand
