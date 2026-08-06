# Bank Verification

Phase 4 — Bank account verification system for the Fundora Trust Center.

## Architecture

Bank verification enables creators to link and verify bank accounts for future payout support. Account numbers are encrypted at rest using AES-256-GCM. The system supports a full account lifecycle with 6 statuses.

### Data Model

```
creator_verifications (1:1)
  └── bank_verifications (1:1)
        └── bank_accounts (1:many per user)
```

**Tables:**
- `bank_accounts` — Account holder, encrypted account number (BYTEA), IFSC, bank/branch, account type, UPI ID, is_primary, status
- `bank_verifications` — Summary of bank verification status, total/verified counts

### Bank Account Lifecycle

```
draft → pending → verified
                 → rejected → pending (resubmit)
                 → disabled (user-initiated)
                 → archived (soft delete)
```

| Status | Description |
|--------|-------------|
| `draft` | Account created, details incomplete |
| `pending` | Submitted for verification |
| `verified` | Account verified and approved |
| `rejected` | Verification rejected (can resubmit) |
| `disabled` | User-initiated deactivation |
| `archived` | Soft deleted, no longer active |

### Account Types

- `savings` — Savings account
- `current` — Current/business account
- `salary` — Salary account

## Libraries

### `lib/verification/bankVerification.js`

Core bank account CRUD operations.

**Functions:**
- `createBankAccount(userId, accountData)` — Create with encrypted account number (starts in `draft` status)
- `updateBankAccount(userId, accountId, updates)` — Update account details
- `deleteBankAccount(userId, accountId)` — Soft delete (set status to `archived`)
- `getBankAccounts(userId)` — List with masked account numbers (show last 4)
- `setPrimaryAccount(userId, accountId)` — Set primary account
- `uploadBankDocument(userId, accountId, documentType, file)` — Upload cancelled cheque/passbook
- `getBankVerification(userId)` — Get verification summary
- `validateIFSC(ifsc)` — IFSC regex (11 chars: 4 alpha + 0 + 2 alpha + 4 digit)
- `maskAccountNumber(number)` — Show only last 4 digits
- `maskIFSC(ifsc)` — Show first 4 chars + mask rest

### `lib/verification/pennyDrop.js`

Penny drop verification — sends ₹1 to verify bank account ownership.

**Functions:**
- `initiatePennyDrop(userId, accountId)` — Submit for penny drop verification
- `checkPennyDropStatus(accountId)` — Check verification status
- `handlePennyDropWebhook(payload)` — Process webhook callback
- `getPennyDropHistory(userId)` — Get verification history

## API Endpoints

### `pages/api/verification/bank.js`

| Method | Action | Auth | Rate Limit |
|--------|--------|------|-----------|
| `GET` | List bank accounts | Required | 10/min |
| `POST` | Create bank account | Required | 10/min |
| `PUT` | Update bank account | Required | 10/min |
| `DELETE` | Archive bank account | Required | 10/min |

**POST body:**
```json
{
  "account_holder_name": "Rajesh Kumar",
  "account_number": "1234567890123456",
  "ifsc_code": "HDFC0123456",
  "bank_name": "HDFC Bank",
  "branch_name": "Andheri West",
  "account_type": "savings",
  "upi_id": "user@upi"
}
```

### `pages/api/verification/bank-documents.js`

| Method | Action | Auth | Rate Limit |
|--------|--------|------|-----------|
| `GET` | List bank documents | Required | 10/min |
| `POST` | Upload bank document | Required | 10/min |

**Document types:**
- `cancelled_cheque` — Cancelled cheque for account verification
- `bank_statement` — Recent bank statement
- `passbook` — Bank passbook (optional)
- `address_proof` — Address proof (optional)

### `pages/api/verification/penny-drop.js`

| Method | Action | Auth | Rate Limit |
|--------|--------|------|-----------|
| `POST` | Penny drop operations | Required | 10/min |

**POST body:**
```json
{
  "action": "initiate | status | history",
  "accountId": "uuid",
  "referenceId": "uuid"
}
```

## Admin Endpoints

### `pages/api/admin/bank-review.js`

| Method | Action | Auth | Rate Limit |
|--------|--------|------|-----------|
| `POST` | Approve/reject/resubmit | Admin | 10/min |

**POST body:**
```json
{
  "action": "approve | reject | resubmit",
  "verificationId": "uuid",
  "reason": "Optional reason for rejection",
  "notes": "Optional reviewer notes"
}
```

## Security

### Data Protection

- **Account numbers are encrypted at rest** using AES-256-GCM (stored as BYTEA)
- **Never expose raw account numbers** — API returns only masked versions (last 4 digits)
- **Never expose raw IFSC codes** — masked as first 4 chars + stars
- **Never expose raw UPI IDs** in public responses
- **Provider references are never exposed** to frontend
- All operations are audit-logged via `auditLog.js`
- Uses `storageAdapter` for storage (not direct Supabase imports)
- Uses `secureLogger` for all logging (PII redaction)

### Encryption

Account numbers are encrypted before storage:
```js
// lib/verification/bankVerification.js
const encrypted = encryptMetadata(accountNumber);
// Stored as BYTEA in bank_accounts.account_number_encrypted
```

### Masking

API responses use masked versions:
```js
// maskAccountNumber("1234567890123456") → "************3456"
// maskIFSC("HDFC0123456") → "HDFC*******"
```

### RLS Policies

- Users can only access their own bank accounts
- Service role has full access for admin operations
- Admin endpoints require admin role verification

## Trust Score Integration

Bank verification contributes to the trust score via configurable weights:

```js
// VERIFICATION_WEIGHTS.bank = 20 (base bonus)
// VERIFICATION_WEIGHTS.penny_drop = 10 (additional bonus on success)
// Total possible: 30 (bank + penny drop success)
```

## Penny Drop Flow

1. User creates bank account (status: `draft`)
2. User submits for verification (status: `pending`)
3. Penny drop initiated — ₹1 sent to account
4. Webhook callback confirms credit
5. Status updated to `verified` on success
6. Trust score updated with bank + penny drop bonus

## UI Components

- `BankAccountCard.jsx` — Displays single bank account with masked details
- `BankAccountForm.jsx` — Add/edit bank account form with validation
- `CompletionIndicator.jsx` — Verification completion percentage
- `PendingActions.jsx` — List of pending verification actions

## File Locations

| File | Purpose |
|------|---------|
| `lib/verification/bankVerification.js` | Core CRUD + validation |
| `lib/verification/pennyDrop.js` | Penny drop verification |
| `lib/verification/providers/bankVerificationProvider.js` | Mock provider |
| `lib/verification/providers/pennyDropProvider.js` | Penny drop mock provider |
| `pages/api/verification/bank.js` | Bank account API |
| `pages/api/verification/bank-documents.js` | Bank document API |
| `pages/api/verification/penny-drop.js` | Penny drop API |
| `pages/api/admin/bank-review.js` | Admin bank review |
| `components/verification/BankAccountCard.jsx` | Account card component |
| `components/verification/BankAccountForm.jsx` | Account form component |
