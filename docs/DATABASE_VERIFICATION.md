# 🗄️ Fundora Database Verification Guide

**Generated:** 2026-07-29
**Role:** Senior Database Architect
**Project:** Fundora (Next.js 16 + Supabase + PostgreSQL)
**Scope:** All 12 Migrations (001–012) — 60+ Tables

---

## 📋 Table of Contents

1. [Conventions & Notation](#conventions--notation)
2. [Migration 001: Creator Verifications](#migration-001-creator-verifications)
3. [Migration 002: Verification History & Documents](#migration-002-verification-history--documents)
4. [Migration 003: Verification Requests, Sessions & OTP](#migration-003-verification-requests-sessions--otp)
5. [Migration 004: Business & Bank Verification](#migration-004-business--bank-verification)
6. [Migration 005: Fraud Detection](#migration-005-fraud-detection)
7. [Migration 006: Escrow, Milestones & Payouts](#migration-006-escrow-milestones--payouts)
8. [Migration 007: Compliance, Reputation & Governance](#migration-007-compliance-reputation--governance)
9. [Migration 008: Enterprise Organizations & API](#migration-008-enterprise-organizations--api)
10. [Migration 009: AI Platform](#migration-009-ai-platform)
11. [Migration 010: Global Platform & Marketplace](#migration-010-global-platform--marketplace)
12. [Migration 011: Ecosystem & Agent Platform](#migration-011-ecosystem--agent-platform)
13. [Migration 012: Infrastructure Platform](#migration-012-infrastructure-platform)
14. [DATABASE HEALTH CHECKLIST](#database-health-checklist)

---

## Conventions & Notation

All verification queries use PostgreSQL-compatible syntax for Supabase.

| Icon               | Meaning                                     |
| ------------------ | ------------------------------------------- |
| ✅ **PASS**        | Verification query returned expected result |
| ❌ **FAIL**        | Verification query found unexpected state   |
| ⚠️ **WARN**        | Non-critical issue or deprecation notice    |
| 🔍 **INVESTIGATE** | Manual inspection required                  |

### Common Helpers

```sql
-- Check if a table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = '<table_name>';

-- Count rows
SELECT COUNT(*) FROM <table_name>;

-- List columns with types
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = '<table_name>';
```

---

## Migration 001: Creator Verifications

### Schema Overview

**Tables Created:** `creator_verifications`

| Column                  | Type        | Constraints                                                         |
| ----------------------- | ----------- | ------------------------------------------------------------------- |
| `id`                    | UUID PK     | `DEFAULT gen_random_uuid()`                                         |
| `user_id`               | UUID        | FK → `auth.users(id)` ON DELETE CASCADE, UNIQUE                     |
| `verification_level`    | INTEGER     | CHECK (0–5)                                                         |
| `email_verified`        | BOOLEAN     | DEFAULT FALSE                                                       |
| `phone_verified`        | BOOLEAN     | DEFAULT FALSE                                                       |
| `identity_verified`     | BOOLEAN     | DEFAULT FALSE                                                       |
| `bank_verified`         | BOOLEAN     | DEFAULT FALSE                                                       |
| `business_verified`     | BOOLEAN     | DEFAULT FALSE                                                       |
| `selfie_verified`       | BOOLEAN     | DEFAULT FALSE                                                       |
| `verification_status`   | TEXT        | CHECK: `pending`, `under_review`, `approved`, `rejected`, `expired` |
| `trust_score`           | INTEGER     | CHECK (0–100)                                                       |
| `risk_score`            | INTEGER     | CHECK (0–100)                                                       |
| `verification_provider` | TEXT        |                                                                     |
| `provider_reference`    | TEXT        |                                                                     |
| `verified_at`           | TIMESTAMPTZ |                                                                     |
| `created_at`            | TIMESTAMPTZ | NOT NULL DEFAULT NOW()                                              |
| `updated_at`            | TIMESTAMPTZ | NOT NULL DEFAULT NOW()                                              |
| `verification_notes`    | TEXT        |                                                                     |

**Foreign Keys:** `user_id → auth.users(id) ON DELETE CASCADE`

**Indexes:**

- `idx_creator_verifications_user_id` — on `user_id`
- `idx_creator_verifications_status` — on `verification_status`
- `idx_creator_verifications_level` — on `verification_level`

**RLS Policies:** 4 policies

1. **User SELECT** — `auth.uid() = user_id`
2. **User INSERT** — `auth.uid() = user_id`
3. **User UPDATE** — `auth.uid() = user_id`
4. **Service Role ALL** — `auth.role() = 'service_role'`

**Triggers:**

- `trigger_creator_verifications_updated_at` — BEFORE UPDATE, calls `update_creator_verifications_updated_at()`

**Functions:**

- `handle_new_user_verification()` — trigger function on `auth.users` INSERT
- `get_user_verification_summary()` — returns verification summary for a user
- `recalculate_verification_level()` — recalculates level based on verified fields

**External Trigger:** `on_auth_user_created` on `auth.users` AFTER INSERT

### Verification Queries

<details>
<summary><strong>INSERT Verification</strong></summary>

```sql
-- Verify INSERT via service_role (simulates trigger on auth.users)
INSERT INTO creator_verifications (user_id, verification_status)
VALUES ('00000000-0000-0000-0000-000000000001', 'pending')
RETURNING id, user_id, verification_status, created_at;

-- Expected: Row created with id, user_id, status='pending', created_at=NOW()
-- Row count: 1
```

</details>

<details>
<summary><strong>UPDATE Verification</strong></summary>

```sql
-- Verify UPDATE and updated_at trigger
UPDATE creator_verifications
SET email_verified = TRUE, verification_level = 1
WHERE user_id = '00000000-0000-0000-0000-000000000001'
RETURNING id, email_verified, verification_level, updated_at;

-- Expected: email_verified=TRUE, verification_level=1
-- updated_at should be > created_at
-- Verify trigger: updated_at changed
SELECT updated_at > created_at AS trigger_updated
FROM creator_verifications
WHERE user_id = '00000000-0000-0000-0000-000000000001';
```

</details>

<details>
<summary><strong>SELECT Verification</strong></summary>

```sql
-- Verify RLS: user can only see own record
SELECT * FROM creator_verifications WHERE user_id = auth.uid();

-- Verify UNIQUE constraint on user_id
SELECT user_id, COUNT(*) FROM creator_verifications
GROUP BY user_id HAVING COUNT(*) > 1;
-- Expected: 0 rows (UNIQUE enforced)

-- Verify CHECK constraints
SELECT * FROM creator_verifications
WHERE verification_level < 0 OR verification_level > 5;
-- Expected: 0 rows

SELECT * FROM creator_verifications
WHERE trust_score < 0 OR trust_score > 100;
-- Expected: 0 rows

SELECT * FROM creator_verifications
WHERE risk_score < 0 OR risk_score > 100;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>DELETE Verification</strong></summary>

```sql
-- Verify CASCADE DELETE from auth.users
-- NOTE: Cannot delete from auth.users directly in most environments
-- Instead, verify FK exists
SELECT tc.constraint_name, tc.constraint_type,
       ccu.table_schema AS foreign_schema,
       ccu.table_name AS foreign_table,
       ccu.column_name AS foreign_column,
       rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.table_name = 'creator_verifications'
  AND tc.constraint_type = 'FOREIGN KEY';
-- Expected: delete_rule = 'CASCADE'
```

</details>

<details>
<summary><strong>Relationship Integrity</strong></summary>

```sql
-- Find orphaned records (user_id without matching auth.users)
SELECT cv.* FROM creator_verifications cv
LEFT JOIN auth.users u ON cv.user_id = u.id
WHERE u.id IS NULL;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Index Verification</strong></summary>

```sql
-- Verify indexes exist
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'creator_verifications';

-- Check index usage (run after queries)
SELECT relname, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
FROM pg_stat_all_tables
WHERE relname = 'creator_verifications';
-- Expected: idx_scan > 0 after SELECT queries
```

</details>

<details>
<summary><strong>RLS Verification</strong></summary>

```sql
-- Verify RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'creator_verifications';
-- Expected: relrowsecurity = true

-- List RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'creator_verifications';
-- Expected: 4 policies listed
```

</details>

<details>
<summary><strong>Performance Check</strong></summary>

```sql
-- Analyze table
ANALYZE creator_verifications;

-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('creator_verifications')) AS total_size,
       pg_size_pretty(pg_relation_size('creator_verifications')) AS table_size,
       pg_size_pretty(pg_total_relation_size('creator_verifications') - pg_relation_size('creator_verifications')) AS index_size;

-- Check for table bloat
SELECT schemaname, tablename, n_dead_tup, n_live_tup,
       round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_all_tables
WHERE relname = 'creator_verifications';
-- Expected: dead_pct < 20 (VACUUM if higher)
```

</details>

---

## Migration 002: Verification History & Documents

### Schema Overview

**Tables Created:**

1. `verification_history` — immutable audit log
2. `verification_documents` — uploaded verification documents

#### verification_history

| Column              | Type        | Constraints                                                                     |
| ------------------- | ----------- | ------------------------------------------------------------------------------- |
| `id`                | UUID PK     | `DEFAULT gen_random_uuid()`                                                     |
| `verification_id`   | UUID        | FK → `creator_verifications(id)` ON DELETE CASCADE                              |
| `user_id`           | UUID        | FK → `auth.users(id)` ON DELETE CASCADE                                         |
| `action`            | TEXT        | CHECK (17 types including `created`, `submitted`, `approved`, `rejected`, etc.) |
| `old_status`        | TEXT        |                                                                                 |
| `new_status`        | TEXT        |                                                                                 |
| `old_level`         | INTEGER     |                                                                                 |
| `new_level`         | INTEGER     |                                                                                 |
| `performed_by`      | UUID        |                                                                                 |
| `performed_by_type` | TEXT        | CHECK: `system`, `user`, `admin`, `provider`                                    |
| `reason`            | TEXT        |                                                                                 |
| `metadata`          | JSONB       | DEFAULT '{}'                                                                    |
| `created_at`        | TIMESTAMPTZ | NOT NULL DEFAULT NOW()                                                          |

**Immutable:** REVOKE UPDATE, DELETE ON `verification_history` FROM `authenticated`

#### verification_documents

| Column               | Type        | Constraints                                        |
| -------------------- | ----------- | -------------------------------------------------- |
| `id`                 | UUID PK     |                                                    |
| `verification_id`    | UUID        | FK → `creator_verifications(id)` ON DELETE CASCADE |
| `user_id`            | UUID        | FK → `auth.users(id)` ON DELETE CASCADE            |
| `document_type`      | TEXT        | CHECK (12 types)                                   |
| `document_name`      | TEXT        |                                                    |
| `storage_bucket`     | TEXT        |                                                    |
| `storage_path`       | TEXT        |                                                    |
| `mime_type`          | TEXT        |                                                    |
| `file_size`          | BIGINT      |                                                    |
| `status`             | TEXT        | CHECK                                              |
| `rejection_reason`   | TEXT        |                                                    |
| `provider_reference` | TEXT        |                                                    |
| `uploaded_at`        | TIMESTAMPTZ |                                                    |
| `verified_at`        | TIMESTAMPTZ |                                                    |
| `expires_at`         | TIMESTAMPTZ |                                                    |
| `created_at`         | TIMESTAMPTZ | NOT NULL DEFAULT NOW()                             |
| `updated_at`         | TIMESTAMPTZ | NOT NULL DEFAULT NOW()                             |

**Alters from 001:** `creator_verifications` ADD COLUMN `expires_at`, `expiry_status`

**Indexes:**

- `idx_verification_history_verification` — on `verification_id`
- `idx_verification_history_user` — on `user_id`
- `idx_verification_history_created` — on `created_at DESC`
- `idx_verification_history_action` — on `action`
- `idx_verification_documents_verification` — on `verification_id`
- `idx_verification_documents_user` — on `user_id`
- `idx_verification_documents_type` — on `document_type`
- `idx_verification_documents_status` — on `status`

**RLS Policies:** 6 policies across both tables

**Functions:**

- `record_verification_event()` — inserts into verification_history
- `get_public_verification()` — returns public verification data
- `get_verification_expiry_status()` — calculates expiry status

### Verification Queries

<details>
<summary><strong>Immutable Table Check (verification_history)</strong></summary>

```sql
-- Verify UPDATE is revoked on verification_history
-- Run as authenticated user (not service_role):
-- UPDATE verification_history SET reason = 'changed' WHERE id = '<id>';
-- Expected: permission denied for table verification_history

-- Verify DELETE is revoked on verification_history
-- Run as authenticated user:
-- DELETE FROM verification_history WHERE id = '<id>';
-- Expected: permission denied for table verification_history

-- Check privileges
SELECT table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'verification_history'
  AND grantee = 'authenticated';
-- Expected: Only INSERT, SELECT (no UPDATE, DELETE)
```

</details>

<details>
<summary><strong>Cascade Delete Verification</strong></summary>

```sql
-- Verify CASCADE from creator_verifications to verification_history
SELECT tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'verification_history'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE';
-- Expected: At least 1 row with CASCADE

-- Verify CASCADE from creator_verifications to verification_documents
SELECT tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'verification_documents'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE';
-- Expected: At least 1 row with CASCADE
```

</details>

<details>
<summary><strong>Data Integrity</strong></summary>

```sql
-- Orphaned history records
SELECT vh.* FROM verification_history vh
LEFT JOIN creator_verifications cv ON vh.verification_id = cv.id
WHERE cv.id IS NULL;
-- Expected: 0 rows

-- Orphaned documents
SELECT vd.* FROM verification_documents vd
LEFT JOIN creator_verifications cv ON vd.verification_id = cv.id
WHERE cv.id IS NULL;
-- Expected: 0 rows
```

</details>

---

## Migration 003: Verification Requests, Sessions & OTP

### Schema Overview

**Tables Created:**

1. `verification_requests` — verification request lifecycle
2. `verification_sessions` — resumable wizard sessions
3. `verification_otp` — phone verification OTP codes
4. `verification_audit_log` — append-only audit trail

**Alters from 001/002:**

- `creator_verifications.verification_status` CHECK extended (added `documents_uploaded`, `automatic_validation`, `manual_review`, `cancelled`)
- `verification_documents` ADD COLUMN `metadata_encrypted` (BYTEA), `metadata_hash` (TEXT)
- `verification_history.action` CHECK extended (14 new phase 3 actions)
- `verification_history.old_status`/`new_status` CHECK extended

#### verification_requests

| Column                           | Key Details                                             |
| -------------------------------- | ------------------------------------------------------- |
| `id`                             | UUID PK                                                 |
| `user_id`                        | UUID FK → `auth.users(id)` CASCADE                      |
| `verification_id`                | UUID FK → `creator_verifications(id)` SET NULL          |
| `verification_type`              | TEXT CHECK: identity/phone/bank/business/address/selfie |
| `current_step`                   | TEXT                                                    |
| `status`                         | TEXT CHECK: 10-value lifecycle                          |
| `provider`, `provider_reference` | TEXT                                                    |
| `reviewer_id`                    | UUID                                                    |
| `review_priority`                | TEXT CHECK                                              |
| `rejection_reason`               | TEXT                                                    |
| `submitted_at`, `completed_at`   | TIMESTAMPTZ                                             |
| `created_at`, `updated_at`       | TIMESTAMPTZ                                             |
| `metadata`                       | JSONB                                                   |

**Indexes:** 4 on requests, 3 on sessions, 2 on OTP, 4 on audit_log

**Immutability:** REVOKE UPDATE/DELETE ON `verification_audit_log` FROM `authenticated`

**Functions:**

- `get_active_session()` — retrieves current active session
- `cleanup_expired_sessions()` — removes expired sessions
- `cleanup_expired_otps()` — removes expired OTP codes

### Verification Queries

<details>
<summary><strong>Encrypted Columns Check</strong></summary>

```sql
-- Verify metadata_encrypted is BYTEA type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'verification_documents'
  AND column_name = 'metadata_encrypted';
-- Expected: data_type = 'bytea'

-- Verify metadata_hash is TEXT
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'verification_documents'
  AND column_name = 'metadata_hash';
-- Expected: data_type = 'text'
```

</details>

<details>
<summary><strong>Status Lifecycle Verification</strong></summary>

```sql
-- Verify verification_requests status CHECK constraint values
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'verification_requests'::regclass
  AND contype = 'c';
-- Expected: CHECK contains 10 status values
```

</details>

<details>
<summary><strong>OTP Expiry Check</strong></summary>

```sql
-- Find expired OTPs that cleanup_expired_otps() should remove
SELECT * FROM verification_otp
WHERE expires_at < NOW();
-- Expected: 0 rows if cleanup is working (or non-zero that cleanup will handle)
```

</details>

<details>
<summary><strong>Audit Log Immutability</strong></summary>

```sql
-- Check privileges on verification_audit_log
SELECT table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'verification_audit_log'
  AND grantee = 'authenticated';
-- Expected: Only SELECT, INSERT (no UPDATE, DELETE)
```

</details>

---

## Migration 004: Business & Bank Verification

### Schema Overview

**Tables Created:** (6 tables)

1. `business_verifications` — UNIQUE(user_id), UNIQUE(verification_id), 11 business types CHECK
2. `business_documents` — 18 document types CHECK, FK chain
3. `bank_accounts` — AES-256-GCM encrypted account_number_encrypted (BYTEA), 6-status lifecycle, penny_drop_status CHECK
4. `bank_verifications` — UNIQUE(user_id), UNIQUE(verification_id), primary_account_id FK
5. `verification_providers` — UNIQUE(name), 8 provider types CHECK, RLS: authenticated SELECT where is_active
6. `verification_events` — 6 entity types CHECK

**Key Columns: bank_accounts**

| Column                     | Details                                                 |
| -------------------------- | ------------------------------------------------------- |
| `account_number_encrypted` | BYTEA (encrypted with AES-256-GCM)                      |
| `ifsc_code`                | TEXT                                                    |
| `account_holder_name`      | TEXT                                                    |
| `bank_name`                | TEXT                                                    |
| `account_type`             | TEXT CHECK                                              |
| `penny_drop_status`        | TEXT CHECK                                              |
| `status`                   | TEXT: draft→pending→verified→rejected→disabled→archived |
| `is_primary`               | BOOLEAN                                                 |

**Indexes:** 14 total across 6 tables

**Triggers:** Updates on all 6 tables using generic `update_updated_at()`

**Functions:**

- `get_business_verification_summary()`
- `get_bank_verification_summary()`
- `recalculate_bank_verification()`
- `update_updated_at()` — generic function

### Verification Queries

<details>
<summary><strong>Encrypted Bank Account Verification</strong></summary>

```sql
-- Verify account_number_encrypted is BYTEA
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bank_accounts'
  AND column_name = 'account_number_encrypted';
-- Expected: data_type = 'bytea'

-- Verify no plaintext account numbers exist (should be impossible by schema)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bank_accounts'
  AND column_name IN ('account_number', 'account_number_plain');
-- Expected: 0 rows — no plaintext column should exist
```

</details>

<details>
<summary><strong>Bank Account Status Lifecycle</strong></summary>

```sql
-- Verify CHECK constraint on status
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'bank_accounts'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%status%';
-- Expected: Contains draft, pending, verified, rejected, disabled, archived
```

</details>

<details>
<summary><strong>Relationship Integrity</strong></summary>

```sql
-- Bank accounts without matching user
SELECT ba.* FROM bank_accounts ba
LEFT JOIN auth.users u ON ba.user_id = u.id
WHERE u.id IS NULL;
-- Expected: 0 rows

-- Bank verifications referencing non-existent primary account
SELECT bv.* FROM bank_verifications bv
LEFT JOIN bank_accounts ba ON bv.primary_account_id = ba.id
WHERE ba.id IS NULL AND bv.primary_account_id IS NOT NULL;
-- Expected: 0 rows

-- Duplicate primary bank accounts per user
SELECT user_id, COUNT(*) FROM bank_accounts
WHERE is_primary = TRUE
GROUP BY user_id HAVING COUNT(*) > 1;
-- Expected: 0 rows (only one primary per user)
```

</details>

<details>
<summary><strong>Provider Active Check</strong></summary>

```sql
-- Count active verification providers
SELECT COUNT(*) FROM verification_providers WHERE is_active = TRUE;
-- Expected: >= 1 (at least one active provider)
```

</details>

---

## Migration 005: Fraud Detection

### Schema Overview

**Tables Created:** (9 tables)

1. `fraud_profiles` — UNIQUE(user_id), risk_level CHECK, decision CHECK
2. `fraud_events` — event_category CHECK, severity CHECK
3. `risk_signals` — UNIQUE(user_id, signal_name)
4. `risk_scores` — calculation_method CHECK
5. `device_fingerprints` — fingerprint_hash, risk_flags TEXT[]
6. `behavior_events` — device_fingerprint_id FK → device_fingerprints SET NULL
7. `fraud_rules` — UNIQUE(rule_name), 18 default rules inserted
8. `fraud_rule_hits` — FK → fraud_rules, FK → users
9. `manual_overrides` — override_type CHECK, created_by, revoked_by

**Key Constraints:**

- `fraud_profiles.risk_level` CHECK: low/medium/high/critical
- `fraud_profiles.decision` CHECK: allow/monitor/manual_review/limit/block/escalate
- `fraud_events.severity` CHECK: info/warning/critical
- 18 default fraud rules seeded

**Indexes:** 31 total across 9 tables

**RLS:** 18 policies across 9 tables

### Verification Queries

<details>
<summary><strong>Default Fraud Rules Verification</strong></summary>

```sql
-- Verify all 18 default fraud rules exist
SELECT rule_name, rule_category, risk_weight, risk_level, is_active
FROM fraud_rules
ORDER BY rule_name;
-- Expected: 18 rows
-- Should include: rapid_donations, failed_verification_spam, multiple_devices,
-- rapid_profile_edits, password_reset_frequency, rejected_documents,
-- multiple_payout_accounts, duplicate_pan, duplicate_gst, duplicate_bank_account,
-- duplicate_phone, duplicate_upi, ip_country_mismatch, suspicious_email_domain,
-- low_trust_high_donation, new_account_high_activity, rapid_bank_changes,
-- document_resubmission_loop
```

</details>

<details>
<summary><strong>Fraud Profile Constraints</strong></summary>

```sql
-- Verify risk_level values
SELECT DISTINCT risk_level FROM fraud_profiles;
-- Expected subset of: low, medium, high, critical

-- Verify no orphaned fraud_profiles
SELECT fp.* FROM fraud_profiles fp
LEFT JOIN auth.users u ON fp.user_id = u.id
WHERE u.id IS NULL;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Risk Signal Uniqueness</strong></summary>

```sql
-- Violations of UNIQUE(user_id, signal_name)
SELECT user_id, signal_name, COUNT(*)
FROM risk_signals
GROUP BY user_id, signal_name
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Device Fingerprint Risk Flags</strong></summary>

```sql
-- Check risk_flags is TEXT array
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'device_fingerprints'
  AND column_name = 'risk_flags';
-- Expected: data_type = 'ARRAY' or 'text[]'
```

</details>

<details>
<summary><strong>Fraud Rule Hit Integrity</strong></summary>

```sql
-- Orphaned fraud_rule_hits (rule deleted)
SELECT frh.* FROM fraud_rule_hits frh
LEFT JOIN fraud_rules fr ON frh.rule_id = fr.id
WHERE fr.id IS NULL;
-- Expected: 0 rows

-- Orphaned fraud_rule_hits (user deleted)
SELECT frh.* FROM fraud_rule_hits frh
LEFT JOIN auth.users u ON frh.user_id = u.id
WHERE u.id IS NULL;
-- Expected: 0 rows
```

</details>

---

## Migration 006: Escrow, Milestones & Payouts

### Schema Overview

**Tables Created:** (9 tables)

1. `escrow_accounts` — UNIQUE(campaign_id), 7-status lifecycle, NUMERIC(12,2) balances
2. `escrow_ledger` — entry_type CHECK (8 types), idempotency_key UNIQUE
3. `campaign_milestones` — FK → projects, FK → users, 9-status lifecycle
4. `milestone_submissions` — submission_type CHECK, JSONB files
5. `milestone_reviews` — UNIQUE(milestone_id, reviewer_id), vote_weight
6. `payout_requests` — FK → bank_accounts, FK → escrow_accounts
7. `payout_transactions` — UNIQUE(idempotency_key), 5-status lifecycle
8. `escrow_events` — 8 entity types CHECK
9. `settlement_batches` — UNIQUE(batch_number)

**Key Columns: escrow_accounts**

| Column              | Details                                            |
| ------------------- | -------------------------------------------------- |
| `campaign_id`       | UUID UNIQUE, FK → projects                         |
| `balance`           | NUMERIC(12,2) NOT NULL DEFAULT 0, CHECK ≥ 0        |
| `escrow_balance`    | NUMERIC(12,2) NOT NULL DEFAULT 0, CHECK ≥ 0        |
| `pending_balance`   | NUMERIC(12,2) NOT NULL DEFAULT 0, CHECK ≥ 0        |
| `available_balance` | NUMERIC(12,2) NOT NULL DEFAULT 0, CHECK ≥ 0        |
| `total_fees`        | NUMERIC(12,2) NOT NULL DEFAULT 0, CHECK ≥ 0        |
| `total_disbursed`   | NUMERIC(12,2) NOT NULL DEFAULT 0, CHECK ≥ 0        |
| `status`            | TEXT CHECK: active/frozen/closed/disabled/archived |
| `fee_percentage`    | NUMERIC(5,2) CHECK 0–100                           |

**Indexes:** 24 total across 9 tables

**Functions:**

- `recalculate_escrow_balance()` — recalculates escrow balance from ledger
- `recalculate_milestone_approval()` — recalculates milestone approval status

### Verification Queries

<details>
<summary><strong>Balance Constraint Verification</strong></summary>

```sql
-- Verify no negative balances
SELECT id, campaign_id, balance, escrow_balance, pending_balance,
       available_balance, total_fees, total_disbursed
FROM escrow_accounts
WHERE balance < 0 OR escrow_balance < 0 OR pending_balance < 0
   OR available_balance < 0 OR total_fees < 0 OR total_disbursed < 0;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Ledger Idempotency</strong></summary>

```sql
-- Verify UNIQUE idempotency_key
SELECT idempotency_key, COUNT(*)
FROM escrow_ledger
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Milestone Status Lifecycle</strong></summary>

```sql
-- Find milestones stuck in invalid states
SELECT status, COUNT(*)
FROM campaign_milestones
GROUP BY status;
-- All statuses should be in: pending, active, submitted, under_review,
-- changes_requested, approved, rejected, paid, cancelled
```

</details>

<details>
<summary><strong>Payout Request Integrity</strong></summary>

```sql
-- Payouts referencing deleted bank accounts
SELECT pr.* FROM payout_requests pr
LEFT JOIN bank_accounts ba ON pr.bank_account_id = ba.id
WHERE ba.id IS NULL AND pr.bank_account_id IS NOT NULL;
-- Expected: 0 rows (or intentional SET NULL)

-- Payouts with fraud_decision but no fraud_risk_score
SELECT * FROM payout_requests
WHERE fraud_decision IS NOT NULL AND fraud_risk_score IS NULL;
-- Expected: 0 rows (every decision should have a score)
```

</details>

<details>
<summary><strong>Settlement Batch Uniqueness</strong></summary>

```sql
-- Duplicate batch numbers
SELECT batch_number, COUNT(*)
FROM settlement_batches
GROUP BY batch_number
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Escrow Balance Consistency</strong></summary>

```sql
-- Verify: balance = escrow_balance + pending_balance + total_fees - total_disbursed
-- Run the recalculate function to verify
-- (approximate; actual formula depends on business logic)
SELECT id, campaign_id, balance,
       (escrow_balance + pending_balance + total_fees - total_disbursed) AS calculated_balance
FROM escrow_accounts
WHERE ABS(balance - (escrow_balance + pending_balance + total_fees - total_disbursed)) > 0.01;
-- Expected: 0 rows (or minimal delta explained by in-flight transactions)
```

</details>

---

## Migration 007: Compliance, Reputation & Governance

### Schema Overview

**Tables Created:** (12 tables)

1. `compliance_cases` — UNIQUE(case_number), auto-number (COMP-YYYY-NNNNN), 8 case_types, 7-status, soft delete
2. `compliance_events` — event tracking
3. `policies` — UNIQUE(policy_key), 8 categories, 5 policy_types, versioned
4. `policy_versions` — FK → policies CASCADE, versioned JSONB diffs
5. `creator_reputation` — UNIQUE(creator_id), 5 dimension scores + verification_score
6. `donor_reputation` — UNIQUE(donor_id), 4 dimension scores
7. `campaign_reputation` — UNIQUE(campaign_id), 6 dimension scores + red_flag_count
8. `moderation_cases` — UNIQUE(case_number), auto-number (MOD-YYYY-NNNNN), 9 case_types
9. `appeals` — UNIQUE(appeal_number), auto-number (APL-YYYY-NNNNN), 8 appeal_types
10. `notifications` — 14 notification_types, TEXT[] sent_via
11. `notification_preferences` — UNIQUE(user_id), JSONB category_preferences
12. `platform_metrics` — UNIQUE(metric_type, metric_date, aggregation_period), 12 metric types

**Indexes:** 43 total across 12 tables

**Auto-Number Functions:**

- `generate_compliance_case_number()` — BEFORE INSERT trigger, outputs `COMP-YYYY-NNNNN`
- `generate_moderation_case_number()` — BEFORE INSERT trigger, outputs `MOD-YYYY-NNNNN`
- `generate_appeal_number()` — BEFORE INSERT trigger, outputs `APL-YYYY-NNNNN`

### Verification Queries

<details>
<summary><strong>Auto-Number Generation</strong></summary>

```sql
-- Verify compliance case number auto-generation
-- Insert test record:
INSERT INTO compliance_cases (case_type, status, title, description)
VALUES ('fraud', 'open', 'Test Case', 'Testing auto-number')
RETURNING case_number;
-- Expected: case_number LIKE 'COMP-2026-%'

-- Verify uniqueness
SELECT case_number, COUNT(*)
FROM compliance_cases
GROUP BY case_number
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Verify moderation case number format
SELECT case_number, COUNT(*)
FROM moderation_cases
GROUP BY case_number
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Verify appeal number format
SELECT appeal_number, COUNT(*)
FROM appeals
GROUP BY appeal_number
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Soft Delete Verification</strong></summary>

```sql
-- Verify compliance_cases has deleted_at column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'compliance_cases' AND column_name = 'deleted_at';
-- Expected: 1 row (TIMESTAMPTZ, nullable)
```

</details>

<details>
<summary><strong>Reputation Score Constraints</strong></summary>

```sql
-- Verify dimension scores are within expected range (typically 0-100 or 0-1)
-- creator_reputation
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'creator_reputation'
  AND column_name LIKE '%score%';
-- Verify CHECK constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'creator_reputation'::regclass AND contype = 'c';

-- donor_reputation
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'donor_reputation'
  AND column_name LIKE '%score%';

-- campaign_reputation with red_flag_count
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'campaign_reputation'
  AND column_name LIKE '%score%' OR column_name = 'red_flag_count';
```

</details>

<details>
<summary><strong>Policy Versioning</strong></summary>

```sql
-- Verify policy_versions FK CASCADE
SELECT tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'policy_versions'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE';
-- Expected: CASCADE for policies FK

-- Orphaned policy versions
SELECT pv.* FROM policy_versions pv
LEFT JOIN policies p ON pv.policy_id = p.id
WHERE p.id IS NULL;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Notification Channel Verification</strong></summary>

```sql
-- Verify sent_via is TEXT array
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notifications'
  AND column_name = 'sent_via';
-- Expected: data_type = 'ARRAY' or 'text[]'

-- Verify notification_type CHECK values
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'notifications'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%notification_type%';
-- Expected: 14 notification types listed
```

</details>

<details>
<summary><strong>Platform Metrics Uniqueness</strong></summary>

```sql
-- Duplicate metric records
SELECT metric_type, metric_date, aggregation_period, COUNT(*)
FROM platform_metrics
GROUP BY metric_type, metric_date, aggregation_period
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

---

## Migration 008: Enterprise Organizations & API

### Schema Overview

**Tables Created:** (13 tables)

1. `organizations` — UNIQUE(slug), 7 org types, 7 sizes, 4-status, soft delete
2. `organization_members` — UNIQUE(org_id, user_id), 9 roles, 4-status
3. `departments` — UNIQUE(org_id, name), self-referencing parent FK
4. `teams` — UNIQUE(org_id, name), FK → departments
5. `team_members` — UNIQUE(team_id, user_id), 3 roles
6. `invitations` — UNIQUE(token), role CHECK
7. `organization_roles` — UNIQUE(org_id, name), permissions TEXT[]
8. `organization_settings` — UNIQUE(org_id, setting_key)
9. `api_keys` — UNIQUE(key_hash), status CHECK, scopes TEXT[]
10. `api_logs` — FK → api_keys SET NULL
11. `developer_apps` — UNIQUE(client_id), 5 app types, redirect_uris TEXT[]
12. `webhooks` — secret TEXT, events TEXT[], 3-status
13. `webhook_deliveries` — FK → webhooks CASCADE, 4-status

**Functions:**

- `is_org_member(org_id, user_id)` — returns BOOLEAN
- `is_org_admin(org_id, user_id)` — returns BOOLEAN
- `get_user_org_role(org_id, user_id)` — returns TEXT role

### Verification Queries

<details>
<summary><strong>Organization Slug Uniqueness</strong></summary>

```sql
-- Duplicate slugs
SELECT slug, COUNT(*)
FROM organizations
GROUP BY slug
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Member Role Constraints</strong></summary>

```sql
-- Verify roles CHECK values
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'organization_members'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%role%';
-- Expected: 9 roles including owner, admin, member, etc.

-- Duplicate active memberships
SELECT organization_id, user_id, COUNT(*)
FROM organization_members
WHERE status = 'active'
GROUP BY organization_id, user_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Department Hierarchy</strong></summary>

```sql
-- Verify self-referencing FK
SELECT tc.constraint_name, ccu.column_name, ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'departments'
  AND tc.constraint_type = 'FOREIGN KEY';
-- Expected: parent_department_id → departments(id)

-- Circular reference detection (departments referencing themselves)
WITH RECURSIVE dept_tree AS (
  SELECT id, parent_department_id, 1 AS depth
  FROM departments
  WHERE parent_department_id IS NOT NULL
  UNION ALL
  SELECT d.id, d.parent_department_id, dt.depth + 1
  FROM departments d
  JOIN dept_tree dt ON d.parent_department_id = dt.id
  WHERE dt.depth < 10
)
SELECT * FROM dept_tree WHERE depth >= 10;
-- Expected: 0 rows (no circular references deeper than 10)
```

</details>

<details>
<summary><strong>API Key Hash Verification</strong></summary>

```sql
-- Verify key_hash is NOT NULL for all active keys
SELECT * FROM api_keys
WHERE key_hash IS NULL AND status = 'active';
-- Expected: 0 rows

-- Verify no duplicate key hashes
SELECT key_hash, COUNT(*)
FROM api_keys
GROUP BY key_hash
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Webhook Integrity</strong></summary>

```sql
-- Orphaned webhook deliveries (webhook deleted)
SELECT wd.* FROM webhook_deliveries wd
LEFT JOIN webhooks w ON wd.webhook_id = w.id
WHERE w.id IS NULL;
-- Expected: 0 rows (CASCADE should handle this)

-- Webhooks with excessive failures
SELECT id, url, events, failure_count, status
FROM webhooks
WHERE failure_count > 10 AND status = 'active';
-- Expected: 0 rows (should be disabled after repeated failures)
```

</details>

<details>
<summary><strong>Developer App Uniqueness</strong></summary>

```sql
-- Duplicate client_id
SELECT client_id, COUNT(*)
FROM developer_apps
GROUP BY client_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

---

## Migration 009: AI Platform

### Schema Overview

**Tables Created:** (10 tables)

1. `ai_conversations` — FK → auth.users CASCADE, copilot_type CHECK (5 types)
2. `ai_messages` — FK → ai_conversations CASCADE, role CHECK, token_count, cost_cents
3. `ai_embeddings` — entity_type CHECK (4 types), VECTOR(1536), content_hash
4. `ai_recommendations` — FK → auth.users CASCADE, recommendation_type CHECK (4 types), score NUMERIC(5,4)
5. `prediction_results` — entity_type CHECK (3 types), prediction_type CHECK (7 types), confidence NUMERIC(5,4)
6. `workflow_templates` — FK → auth.users CASCADE, FK → organizations CASCADE
7. `workflow_runs` — FK → workflow_templates CASCADE, status CHECK
8. `workflow_logs` — FK → workflow_runs CASCADE
9. `ai_usage` — FK → auth.users CASCADE, UNIQUE(user_id, date, provider, model)
10. `ai_provider_metrics` — status CHECK (healthy/degraded/down)

**Vector Support:** `ai_embeddings.embedding` is `VECTOR(1536)` — requires `pgvector` extension

**Indexes:** 50+ across all tables

### Verification Queries

<details>
<summary><strong>Vector Extension Check</strong></summary>

```sql
-- Verify pgvector extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';
-- Expected: 1 row
-- If missing: CREATE EXTENSION IF NOT EXISTS vector;
```

</details>

<details>
<summary><strong>Embedding Tables</strong></summary>

```sql
-- Verify VECTOR column type
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'ai_embeddings'
  AND column_name = 'embedding';
-- Expected: udt_name = 'vector'

-- Verify entity_type CHECK values
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ai_embeddings'::regclass
  AND contype = 'c';
-- Expected: campaign, donor, creator, knowledge_article
```

</details>

<details>
<summary><strong>Recommendation Score Range</strong></summary>

```sql
-- Out of range scores
SELECT * FROM ai_recommendations
WHERE score < 0 OR score > 1;
-- Expected: 0 rows

-- Prediction confidence range
SELECT * FROM prediction_results
WHERE confidence < 0 OR confidence > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>AI Usage Uniqueness</strong></summary>

```sql
-- Duplicate usage records
SELECT user_id, date, provider, model, COUNT(*)
FROM ai_usage
GROUP BY user_id, date, provider, model
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Workflow Run Status</strong></summary>

```sql
-- Stuck workflow runs
SELECT * FROM workflow_runs
WHERE status IN ('pending', 'running')
  AND created_at < NOW() - INTERVAL '24 hours';
-- Expected: 0 rows (or actively running long jobs)

-- Orphaned workflow runs (template deleted)
SELECT wr.* FROM workflow_runs wr
LEFT JOIN workflow_templates wt ON wr.workflow_id = wt.id
WHERE wt.id IS NULL;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Provider Metrics</strong></summary>

```sql
-- Providers marked as down
SELECT provider, model, status, avg_latency_ms, error_rate
FROM ai_provider_metrics
WHERE status = 'down';
-- Expected: 0 rows (or investigate if present)

-- High error rates
SELECT provider, model, error_rate
FROM ai_provider_metrics
WHERE error_rate > 0.1;
-- Expected: 0 rows or flagged for investigation
```

</details>

---

## Migration 010: Global Platform & Marketplace

### Schema Overview

**Tables Created:** (24 tables)

| Group             | Tables                                                                |
| ----------------- | --------------------------------------------------------------------- |
| Plugin Platform   | `plugins`, `plugin_versions`, `plugin_reviews`, `plugin_downloads`    |
| Marketplace       | `marketplace_categories` (self-referencing parent_id)                 |
| i18n              | `language_packs`, `translation_entries`                               |
| Multi-Currency    | `currencies` (PK = code TEXT), `exchange_rates`                       |
| Observability     | `metrics`, `alerts`, `alert_events`, `health_checks`, `traces`        |
| Backup & Recovery | `backup_policies`, `backups`, `recovery_points`, `restore_operations` |
| Search Platform   | `search_indexes` (tsvector + GIN), `search_analytics`                 |
| CDN & Storage     | `storage_providers`, `storage_objects`                                |
| Developer Portal  | `api_versions`, `api_rate_limits`                                     |

**Seed Data:**

- 5 API rate limit tiers (free/basic/pro/enterprise/custom)
- 1 API version (v1)
- 10 currencies (INR, USD, EUR, GBP, CAD, AUD, JPY, SGD, AED, CHF)
- 10 marketplace categories
- 20 language packs
- 1 default backup policy

**Triggers:** 10 updated_at triggers + 1 search_vector auto-update trigger

**Function:** `update_search_vector()` — sets tsvector weights on search_indexes

### Verification Queries

<details>
<summary><strong>Seed Data Verification</strong></summary>

```sql
-- Verify API rate limit tiers
SELECT tier, requests_per_minute, requests_per_day
FROM api_rate_limits ORDER BY requests_per_day;
-- Expected: 5 rows (free=5000, basic=10000, pro=50000, enterprise=200000, custom=10000)

-- Verify currencies
SELECT code, name, is_active, is_display_currency, is_settlement_currency
FROM currencies ORDER BY code;
-- Expected: 10 rows

-- Verify marketplace categories
SELECT slug, name, display_order
FROM marketplace_categories ORDER BY display_order;
-- Expected: 10 rows

-- Verify language packs
SELECT locale, name, is_rtl, is_default
FROM language_packs WHERE is_active = TRUE;
-- Expected: Active language packs listed
```

</details>

<details>
<summary><strong>Currency PK Check</strong></summary>

```sql
-- Verify currencies uses TEXT PK code
SELECT tc.constraint_type, ccu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'currencies'
  AND tc.constraint_type = 'PRIMARY KEY';
-- Expected: PRIMARY KEY on 'code' column
```

</details>

<details>
<summary><strong>Search Index tsvector</strong></summary>

```sql
-- Verify search_vector is populated when content exists
SELECT id, title, search_vector
FROM search_indexes
WHERE search_vector IS NULL;
-- Expected: 0 rows (or new rows not yet processed by trigger)

-- Verify GIN index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'search_indexes'
  AND indexdef LIKE '%GIN%';
-- Expected: idx_search_indexes_gin on search_vector
```

</details>

<details>
<summary><strong>Self-Referencing Category</strong></summary>

```sql
-- Verify marketplace_categories self-referencing FK
SELECT tc.constraint_name, ccu.column_name, ccu.table_name AS ref_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'marketplace_categories'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'marketplace_categories';
-- Expected: Self-referencing FK (parent_id → id)
```

</details>

<details>
<summary><strong>Exchange Rate Uniqueness</strong></summary>

```sql
-- Duplicate exchange rates at same timestamp
SELECT from_currency, to_currency, recorded_at, COUNT(*)
FROM exchange_rates
GROUP BY from_currency, to_currency, recorded_at
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Backup Policy Seed</strong></summary>

```sql
-- Verify default backup policy
SELECT name, schedule_cron, retention_days, backup_type, is_active
FROM backup_policies;
-- Expected: At least row for 'Daily Full Backup', cron='0 2 * * *', 30 days
```

</details>

---

## Migration 011: Ecosystem & Agent Platform

### Schema Overview

**Tables Created:** (17 tables)

| Group                 | Tables                                                                         |
| --------------------- | ------------------------------------------------------------------------------ |
| Agent Platform        | `agents`, `agent_runs`, `agent_memory`, `agent_permissions`, `agent_schedules` |
| Event Bus             | `event_bus`, `event_subscriptions`                                             |
| Enterprise Connectors | `connector_configs`                                                            |
| Tenant Management     | `tenant_settings`                                                              |
| Feature Flags         | `feature_flags`, `feature_flag_events`                                         |
| Data Export           | `export_templates`, `export_jobs`, `scheduled_exports`                         |
| Analytics Studio      | `report_templates`, `analytics_snapshots`                                      |
| Usage Quotas          | `usage_quotas`                                                                 |

**Seed Data:**

- 4 system report templates (Platform Overview, Campaign Performance, Security Overview, Monthly Report)
- 8 feature flags (agent-platform, mcp-server, enterprise-connectors, event-bus, analytics-studio, data-export, new-dashboard, dark-mode)

**RLS Pattern:** Organization-isolation based on `auth.jwt() ->> 'organization_id'`

### Verification Queries

<details>
<summary><strong>Agent Slug Uniqueness</strong></summary>

```sql
-- Duplicate slugs
SELECT slug, COUNT(*)
FROM agents
GROUP BY slug
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Agent Memory Uniqueness</strong></summary>

```sql
-- Duplicate agent memory (violating UNIQUE(agent_id, memory_type, key))
SELECT agent_id, memory_type, key, COUNT(*)
FROM agent_memory
GROUP BY agent_id, memory_type, key
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Event Bus Status</strong></summary>

```sql
-- Stuck events (pending > 1 hour)
SELECT id, event_type, source, status, retry_count, created_at
FROM event_bus
WHERE status IN ('pending', 'processing')
  AND created_at < NOW() - INTERVAL '1 hour';
-- Expected: 0 rows

-- Dead letter queue
SELECT id, event_type, status, retry_count, last_error
FROM event_bus
WHERE status = 'dead_letter';
-- Investigate any rows found
```

</details>

<details>
<summary><strong>Feature Flag Seed Data</strong></summary>

```sql
-- Verify default feature flags
SELECT flag_key, name, flag_type, is_enabled, rollout_percentage
FROM feature_flags ORDER BY flag_key;
-- Expected: 8 rows
-- boolean: agent-platform (disabled), mcp-server (disabled),
--          enterprise-connectors (disabled), event-bus (enabled),
--          analytics-studio (enabled), data-export (enabled),
--          dark-mode (enabled)
-- percentage: new-dashboard (disabled, 0%)
```

</details>

<details>
<summary><strong>Organization Isolation RLS</summary>

```sql
-- Verify RLS policies use org isolation pattern
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename IN ('agents', 'agent_runs', 'tenant_settings')
  AND qual LIKE '%organization_id%';
-- Expected: Policies referencing auth.jwt() ->> 'organization_id'
```

</details>

<details>
<summary><strong>Usage Quota Period Constraints</summary>

```sql
-- Quotas where period_end <= period_start
SELECT * FROM usage_quotas
WHERE period_end <= period_start;
-- Expected: 0 rows

-- Overlapping quotas for same resource
SELECT organization_id, resource, period, COUNT(*)
FROM usage_quotas
GROUP BY organization_id, resource, period
HAVING COUNT(*) > 1;
-- Expected: 0 rows (UNIQUE handles this)
```

</details>

<details>
<summary><strong>Analytics Snapshot Uniqueness</strong></summary>

```sql
-- Duplicate snapshots
SELECT snapshot_type, snapshot_date, organization_id, COUNT(*)
FROM analytics_snapshots
GROUP BY snapshot_type, snapshot_date, organization_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

</details>

---

## Migration 012: Infrastructure Platform

### Schema Overview

**Tables Created:** (7 tables)

| Table                     | Key Details                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| `job_queue`               | status CHECK (7-state), priority 1–10, FK → organizations SET NULL |
| `scheduled_jobs`          | schedule_cron NOT NULL, next_run_at NOT NULL, FK → users SET NULL  |
| `cache_metadata`          | cache_key TEXT, ttl_seconds, UNIQUE index on cache_key             |
| `deployment_history`      | environment CHECK (5 envs), status CHECK (7-state)                 |
| `audit_archives`          | archive_type CHECK (5 types), compressed BOOLEAN                   |
| `system_health`           | status CHECK (4-state), metric_value DOUBLE PRECISION              |
| `connection_pool_metrics` | active/idle/waiting/max_connections, timed_out_count               |

**Indexes:** 19 total

**Triggers:** 4 updated_at triggers using `update_infra_updated_at()`

### Verification Queries

<details>
<summary><strong>Job Queue Priority Range</strong></summary>

```sql
-- Out of range priorities
SELECT * FROM job_queue
WHERE priority < 1 OR priority > 10;
-- Expected: 0 rows

-- Stuck jobs
SELECT * FROM job_queue
WHERE status IN ('pending', 'running', 'retrying')
  AND created_at < NOW() - INTERVAL '24 hours';
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Scheduled Job Cron Validity</strong></summary>

```sql
-- Jobs with null/empty cron
SELECT * FROM scheduled_jobs
WHERE schedule_cron IS NULL OR schedule_cron = '';
-- Expected: 0 rows

-- Overdue scheduled jobs
SELECT id, name, next_run_at, is_active
FROM scheduled_jobs
WHERE next_run_at < NOW() AND is_active = TRUE;
-- Expected: 0 rows (or jobs that scheduler should have picked up)
```

</details>

<details>
<summary><strong>Cache TTL Verification</strong></summary>

```sql
-- Expired cache entries
SELECT COUNT(*) FROM cache_metadata
WHERE expires_at < NOW();
-- Ideally: 0 (cleanup should remove expired entries)

-- Negative TTL
SELECT * FROM cache_metadata
WHERE ttl_seconds < 0;
-- Expected: 0 rows
```

</details>

<details>
<summary><strong>Deployment History</strong></summary>

```sql
-- Deployments stuck in non-terminal state
SELECT * FROM deployment_history
WHERE status IN ('pending', 'building', 'testing', 'deploying')
  AND created_at < NOW() - INTERVAL '2 hours';
-- Expected: 0 rows

-- Failed health checks
SELECT * FROM deployment_history
WHERE health_check_passed = FALSE;
-- Investigate
```

</details>

<details>
<summary><strong>System Health Status</strong></summary>

```sql
-- Components marked as down
SELECT component, metric_name, metric_value, threshold, message
FROM system_health
WHERE status = 'down';
-- Investigate

-- Component with most recent failures
SELECT component, COUNT(*) AS failure_count
FROM system_health
WHERE status IN ('degraded', 'down', 'unknown')
  AND checked_at > NOW() - INTERVAL '24 hours'
GROUP BY component
ORDER BY failure_count DESC;
```

</details>

<details>
<summary><strong>Connection Pool Metrics</strong></summary>

```sql
-- Pools near capacity
SELECT pool_name, active_connections, max_connections,
       ROUND(active_connections * 100.0 / NULLIF(max_connections, 0), 2) AS utilization_pct
FROM connection_pool_metrics
WHERE active_connections > max_connections * 0.8;
-- Warning if any rows: pool near capacity

-- High timeout rates
SELECT pool_name, timed_out_count, acquired_count,
       ROUND(timed_out_count * 100.0 / NULLIF(acquired_count, 0), 2) AS timeout_pct
FROM connection_pool_metrics
WHERE timed_out_count > 0 AND acquired_count > 0;
```

</details>

---

## DATABASE HEALTH CHECKLIST

Use the following SQL queries to perform a comprehensive health check on the entire database. Run these periodically (weekly recommended) and after any deployment.

### 🟢 Section 1: Table Counts & Growth

```sql
-- Row counts for ALL tables
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
  n_dead_tup AS dead_rows,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_all_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- IMPORTANT: Flag if dead_pct > 20 for any table — needs VACUUM
```

### 🟢 Section 2: Missing Rows (Orphaned Records)

```sql
-- All orphan checks in one query
SELECT 'migration_001_creator_verifications' AS check_name,
       COUNT(*) AS orphan_count
FROM creator_verifications cv
LEFT JOIN auth.users u ON cv.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'migration_002_verification_history',
       COUNT(*)
FROM verification_history vh
LEFT JOIN creator_verifications cv ON vh.verification_id = cv.id
WHERE cv.id IS NULL

UNION ALL

SELECT 'migration_003_verification_requests',
       COUNT(*)
FROM verification_requests vr
LEFT JOIN auth.users u ON vr.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'migration_004_bank_accounts',
       COUNT(*)
FROM bank_accounts ba
LEFT JOIN auth.users u ON ba.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'migration_005_fraud_profiles',
       COUNT(*)
FROM fraud_profiles fp
LEFT JOIN auth.users u ON fp.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'migration_006_escrow_accounts',
       COUNT(*)
FROM escrow_accounts ea
LEFT JOIN projects p ON ea.campaign_id = p.id
WHERE p.id IS NULL

UNION ALL

SELECT 'migration_007_notifications',
       COUNT(*)
FROM notifications n
LEFT JOIN auth.users u ON n.user_id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 'migration_008_organization_members',
       COUNT(*)
FROM organization_members om
LEFT JOIN organizations o ON om.organization_id = o.id
WHERE o.id IS NULL

UNION ALL

SELECT 'migration_009_ai_messages',
       COUNT(*)
FROM ai_messages am
LEFT JOIN ai_conversations ac ON am.conversation_id = ac.id
WHERE ac.id IS NULL

UNION ALL

SELECT 'migration_010_plugin_versions',
       COUNT(*)
FROM plugin_versions pv
LEFT JOIN plugins p ON pv.plugin_id = p.id
WHERE p.id IS NULL

UNION ALL

SELECT 'migration_011_agent_runs',
       COUNT(*)
FROM agent_runs ar
LEFT JOIN agents a ON ar.agent_id = a.id
WHERE a.id IS NULL

UNION ALL

SELECT 'migration_012_webhook_deliveries',
       COUNT(*)
FROM webhook_deliveries wd
LEFT JOIN webhooks w ON wd.webhook_id = w.id
WHERE w.id IS NULL

-- Expected: ALL counts = 0
```

### 🟢 Section 3: Broken Foreign Keys

```sql
-- Check all foreign key constraints for violations
SELECT
  tc.constraint_name,
  tc.table_name AS source_table,
  ccu.table_name AS target_table,
  ccu.column_name AS target_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Run dynamic FK violation check (service_role required for auth.users access)
DO $$
DECLARE
  fk_record RECORD;
  violation_count INTEGER;
BEGIN
  FOR fk_record IN
    SELECT
      tc.constraint_name,
      tc.table_name AS src_table,
      kcu.column_name AS src_column,
      ccu.table_name AS ref_table,
      ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM %I src LEFT JOIN %I ref ON src.%I = ref.%I WHERE ref.%I IS NULL AND src.%I IS NOT NULL',
      fk_record.src_table, fk_record.ref_table,
      fk_record.src_column, fk_record.ref_column,
      fk_record.ref_column, fk_record.src_column
    ) INTO violation_count;

    IF violation_count > 0 THEN
      RAISE WARNING 'FK VIOLATION: %.% → %.% : % rows',
        fk_record.src_table, fk_record.src_column,
        fk_record.ref_table, fk_record.ref_column,
        violation_count;
    END IF;
  END LOOP;
END $$;
```

### 🟢 Section 4: Duplicate Records

```sql
-- Check UNIQUE constraint violations across key tables
SELECT 'creator_verifications_user_id' AS table_constraint, user_id, COUNT(*)
FROM creator_verifications GROUP BY user_id HAVING COUNT(*) > 1

UNION ALL

SELECT 'organizations_slug', slug, COUNT(*)
FROM organizations GROUP BY slug HAVING COUNT(*) > 1

UNION ALL

SELECT 'organization_members', organization_id || ':' || user_id, COUNT(*)
FROM organization_members
WHERE status = 'active'
GROUP BY organization_id, user_id HAVING COUNT(*) > 1

UNION ALL

SELECT 'fraud_profiles_user_id', user_id, COUNT(*)
FROM fraud_profiles GROUP BY user_id HAVING COUNT(*) > 1

UNION ALL

SELECT 'escrow_accounts_campaign_id', campaign_id::TEXT, COUNT(*)
FROM escrow_accounts GROUP BY campaign_id HAVING COUNT(*) > 1

UNION ALL

SELECT 'escrow_ledger_idempotency', idempotency_key, COUNT(*)
FROM escrow_ledger GROUP BY idempotency_key HAVING COUNT(*) > 1

UNION ALL

SELECT 'api_keys_key_hash', key_hash, COUNT(*)
FROM api_keys GROUP BY key_hash HAVING COUNT(*) > 1

UNION ALL

SELECT 'agents_slug', slug, COUNT(*)
FROM agents GROUP BY slug HAVING COUNT(*) > 1

-- All expected: 0 rows
```

### 🟢 Section 5: Invalid References

```sql
-- Verify all enum/CHECK constraint values are valid
-- Escrow statuses
SELECT DISTINCT status FROM escrow_accounts
WHERE status NOT IN ('active', 'frozen', 'closed', 'disabled', 'archived');

-- Campaign milestone statuses
SELECT DISTINCT status FROM campaign_milestones
WHERE status NOT IN ('pending', 'active', 'submitted', 'under_review',
                     'changes_requested', 'approved', 'rejected', 'paid', 'cancelled');

-- Verification statuses
SELECT DISTINCT verification_status FROM creator_verifications
WHERE verification_status NOT IN ('pending', 'under_review', 'approved',
                                   'rejected', 'expired', 'documents_uploaded',
                                   'automatic_validation', 'manual_review', 'cancelled');

-- Risk levels
SELECT DISTINCT risk_level FROM fraud_profiles
WHERE risk_level NOT IN ('low', 'medium', 'high', 'critical');

-- Bank account statuses
SELECT DISTINCT status FROM bank_accounts
WHERE status NOT IN ('draft', 'pending', 'verified', 'rejected', 'disabled', 'archived');
```

### 🟢 Section 6: Missing Indexes

```sql
-- Find tables without indexes
SELECT
  t.relname AS table_name,
  pg_size_pretty(pg_relation_size(t.oid)) AS table_size
FROM pg_class t
LEFT JOIN pg_index i ON t.oid = i.indrelid
WHERE t.relkind = 'r'
  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND i.indexrelid IS NULL
ORDER BY pg_relation_size(t.oid) DESC;

-- Find tables with sequential scans (potential missing indexes)
SELECT
  schemaname,
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  ROUND(seq_tup_read::numeric / NULLIF(seq_scan, 0), 0) AS avg_tuples_per_seq_scan
FROM pg_stat_all_tables
WHERE schemaname = 'public'
  AND seq_scan > 100
  AND seq_tup_read > 10000
ORDER BY seq_tup_read DESC;

-- Check for FK columns that lack indexes
WITH fk_columns AS (
  SELECT
    tc.table_name,
    kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
)
SELECT
  fc.table_name,
  fc.column_name
FROM fk_columns fc
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes pi
  WHERE pi.tablename = fc.table_name
    AND pi.indexdef LIKE '%' || fc.column_name || '%'
)
ORDER BY fc.table_name, fc.column_name;
```

### 🟢 Section 7: Migration Status

```sql
-- Check Supabase migrations
SELECT version, name, applied_at, success
FROM supabase_migrations
WHERE schema = 'public'
ORDER BY version;

-- Verify all 12 migrations applied
SELECT
  COUNT(*) AS total_migrations,
  MIN(version) AS first_version,
  MAX(version) AS last_version,
  COUNT(*) FILTER (WHERE success = FALSE) AS failed_migrations
FROM supabase_migrations
WHERE schema = 'public';
-- Expected: total_migrations = 12, failed_migrations = 0

-- Check for outstanding migrations (difference between migration files and applied)
-- Run from shell: ls supabase/migrations/*.sql | wc -l
-- Should match total_migrations count
```

### 🟢 Section 8: RLS Policy Audit

```sql
-- Summary of all RLS policies across all tables
SELECT
  schemaname,
  tablename,
  COUNT(*) AS policy_count,
  STRING_AGG(DISTINCT policyname, ', ') AS policy_names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Tables with RLS enabled but NO policies
SELECT
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relrowsecurity = TRUE
  AND n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = c.relname
  );

-- Tables WITHOUT RLS enabled that may need it
SELECT
  c.relname AS table_name,
  pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relrowsecurity = FALSE
  AND n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT IN ('schema_migrations')
ORDER BY c.relname;
```

### 🟢 Section 9: Performance & Bloat

```sql
-- Table bloat estimate
SELECT
  schemaname,
  relname,
  n_dead_tup,
  n_live_tup,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct,
  CASE
    WHEN ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) > 50 THEN 'URGENT'
    WHEN ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) > 20 THEN 'VACUUM NEEDED'
    WHEN ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) > 10 THEN 'WARN'
    ELSE 'OK'
  END AS action
FROM pg_stat_all_tables
WHERE schemaname = 'public'
  AND n_live_tup > 0
ORDER BY dead_pct DESC;

-- Cache hit ratio
SELECT
  SUM(heap_blks_hit) * 100.0 / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0) AS cache_hit_ratio
FROM pg_statio_all_tables
WHERE schemaname = 'public';

-- Index hit ratio
SELECT
  SUM(idx_blks_hit) * 100.0 / NULLIF(SUM(idx_blks_hit) + SUM(idx_blks_read), 0) AS index_hit_ratio
FROM pg_statio_all_indexes;

-- Top 10 largest tables
SELECT
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS data_size,
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
FROM pg_stat_all_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```

### 🟢 Section 10: Trigger Audit

```sql
-- List all triggers in the public schema
SELECT
  tgname AS trigger_name,
  relname AS table_name,
  pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND NOT tgisinternal
ORDER BY relname, tgname;

-- Verify all updated_at triggers have matching functions
SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND NOT tgisinternal
ORDER BY c.relname;

-- Verify auto-number triggers (compliance, moderation, appeals)
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND action_statement LIKE '%generate_%number%'
ORDER BY event_object_table;
```

### 🟢 Section 11: Sequence & Auto-Increment Status

```sql
-- Check all sequences (auto-number generators)
SELECT
  sequence_schema,
  sequence_name,
  data_type,
  start_value,
  minimum_value,
  maximum_value,
  increment
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- Check compliance case number sequence
SELECT last_value, is_called
FROM compliance_case_number_seq;
-- Expected: last_value reflects total case count

-- Check moderation case number sequence
SELECT last_value, is_called
FROM moderation_case_number_seq;

-- Check appeal number sequence
SELECT last_value, is_called
FROM appeal_number_seq;
```

### 🟢 Section 12: Database Connection & Load

```sql
-- Current connections
SELECT
  state,
  COUNT(*) AS connection_count,
  COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting_count
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;

-- Long running queries (> 5 minutes)
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE now() - pg_stat_activity.query_start > INTERVAL '5 minutes'
  AND state != 'idle'
  AND datname = current_database()
ORDER BY duration DESC;

-- Database size
SELECT
  pg_database_size(current_database()) AS total_bytes,
  pg_size_pretty(pg_database_size(current_database())) AS total_pretty;

-- Vacuum status
SELECT
  relname,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  vacuum_count,
  autovacuum_count,
  analyze_count,
  autoanalyze_count
FROM pg_stat_all_tables
WHERE schemaname = 'public'
ORDER BY COALESCE(last_autovacuum, '1970-01-01') ASC
LIMIT 10;
-- Tables without recent vacuum should be flagged
```

---

## 📊 Master Health Checklist

| #   | Check                               | SQL Ref       | Frequency       | Status |
| --- | ----------------------------------- | ------------- | --------------- | ------ |
| 1   | All 12 migrations applied           | Section 7     | After deploy    | □      |
| 2   | No failed migrations                | Section 7     | After deploy    | □      |
| 3   | All tables have RLS enabled         | Section 8     | Weekly          | □      |
| 4   | No tables missing RLS policies      | Section 8     | Weekly          | □      |
| 5   | Zero orphaned records               | Section 2     | Daily           | □      |
| 6   | Zero FK violations                  | Section 3     | Daily           | □      |
| 7   | Zero duplicate records              | Section 4     | Daily           | □      |
| 8   | No invalid CHECK constraint values  | Section 5     | Weekly          | □      |
| 9   | All FK columns indexed              | Section 6     | After migration | □      |
| 10  | No sequential scans on large tables | Section 6     | Weekly          | □      |
| 11  | Table bloat < 20% dead rows         | Section 9     | Weekly          | □      |
| 12  | Cache hit ratio > 95%               | Section 9     | Weekly          | □      |
| 13  | Index hit ratio > 95%               | Section 9     | Weekly          | □      |
| 14  | All triggers active and valid       | Section 10    | After migration | □      |
| 15  | No long-running queries (>5 min)    | Section 12    | Daily           | □      |
| 16  | Connection count within limits      | Section 12    | Daily           | □      |
| 17  | Auto-number sequences healthy       | Section 11    | Weekly          | □      |
| 18  | pgvector extension installed        | Migration 009 | After deploy    | □      |
| 19  | Search tsvector GIN index exists    | Migration 010 | After deploy    | □      |
| 20  | No expired cache entries            | Section 012   | Weekly          | □      |
| 21  | Escrow balance consistency          | Section 006   | Daily           | □      |
| 22  | Fraud rules all 18 seeded           | Section 005   | After deploy    | □      |
| 23  | No events in dead_letter queue      | Section 011   | Daily           | □      |
| 24  | Deployment history clean            | Section 012   | After deploy    | □      |
| 25  | System health all components OK     | Section 012   | Daily           | □      |

---

## 🚨 Quick Diagnostics (5-Min Health Check)

Run these 5 queries for a rapid health assessment:

```sql
-- 1. Migration status
SELECT version, name, applied_at, success
FROM supabase_migrations
WHERE schema = 'public'
ORDER BY version;

-- 2. Orphan count
WITH orphans AS (
  SELECT 'creator_verifications' AS tbl, COUNT(*) AS cnt FROM creator_verifications cv LEFT JOIN auth.users u ON cv.user_id = u.id WHERE u.id IS NULL
  UNION ALL SELECT 'escrow_accounts', COUNT(*) FROM escrow_accounts ea LEFT JOIN projects p ON ea.campaign_id = p.id WHERE p.id IS NULL
  UNION ALL SELECT 'fraud_profiles', COUNT(*) FROM fraud_profiles fp LEFT JOIN auth.users u ON fp.user_id = u.id WHERE u.id IS NULL
  UNION ALL SELECT 'organization_members', COUNT(*) FROM organization_members om LEFT JOIN organizations o ON om.organization_id = o.id WHERE o.id IS NULL
  UNION ALL SELECT 'agent_runs', COUNT(*) FROM agent_runs ar LEFT JOIN agents a ON ar.agent_id = a.id WHERE a.id IS NULL
)
SELECT 'ORPHANS' AS check_name, SUM(cnt) AS total_violations FROM orphans
UNION ALL
SELECT 'DUPLICATES', SUM(cnt) FROM (
  SELECT COUNT(*) AS cnt FROM creator_verifications GROUP BY user_id HAVING COUNT(*) > 1
  UNION ALL SELECT COUNT(*) FROM organizations GROUP BY slug HAVING COUNT(*) > 1
  UNION ALL SELECT COUNT(*) FROM api_keys GROUP BY key_hash HAVING COUNT(*) > 1
  UNION ALL SELECT COUNT(*) FROM agents GROUP BY slug HAVING COUNT(*) > 1
) dupes;

-- 3. Table counts top 10
SELECT relname, n_live_tup AS rows
FROM pg_stat_all_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC LIMIT 10;

-- 4. Bloat check
SELECT relname, ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_all_tables
WHERE schemaname = 'public' AND n_live_tup > 0
  AND n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0) > 20;

-- 5. Escrow balance accuracy
SELECT COUNT(*) AS mismatched_balances
FROM escrow_accounts
WHERE ABS(balance - (escrow_balance + pending_balance + total_fees - total_disbursed)) > 0.01;
```

---

_End of Database Verification Guide. This document covers all 12 migrations, 60+ tables, and provides comprehensive SQL verification queries for every schema object type._
