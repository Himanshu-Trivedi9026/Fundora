# 🧪 Fundora — API Test Plan

**Document:** `docs/API_TEST_PLAN.md`  
**Author:** Senior Backend QA Engineer  
**Date:** 2026-07-30  
**Version:** 1.0  
**Total Endpoints:** 130+  
**Base URL (Dev):** `http://localhost:3000`  
**Response Format (Convention):** `{ success: boolean, data?: any, error?: string }`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Payments & Receipts](#2-payments--receipts)
3. [Projects & Creator](#3-projects--creator)
4. [Verification (Trust Center)](#4-verification-trust-center)
5. [Fraud Detection](#5-fraud-detection)
6. [Escrow, Milestones & Payouts](#6-escrow-milestones--payouts)
7. [Compliance, Reputation & Governance](#7-compliance-reputation--governance)
8. [Organizations & RBAC](#8-organizations--rbac)
9. [API Platform (Keys, Apps, Logs)](#9-api-platform)
10. [AI Platform](#10-ai-platform)
11. [Marketplace & Plugins](#11-marketplace--plugins)
12. [Events, Agents & Automation](#12-events-agents--automation)
13. [Connectors & MCP](#13-connectors--mcp)
14. [Exports, Tenants & Feature Flags](#14-exports-tenants--feature-flags)
15. [Infrastructure (Cache, Jobs, Webhooks, Notifications)](#15-infrastructure)
16. [Health, Diagnostics & Deployments](#16-health-diagnostics--deployments)
17. [Global Platform (i18n, Currency, Search, Storage, Backup, Observability, Mobile)](#17-global-platform)
18. [API Test Checklist](#18-api-test-checklist)

---

## 1. Authentication

### 1.1 `POST /api/account/delete`

| Field          | Detail                                                                |
| -------------- | --------------------------------------------------------------------- |
| **Method**     | `POST`                                                                |
| **URL**        | `/api/account/delete`                                                 |
| **Auth**       | Required — `withAuth` (session cookie)                                |
| **Headers**    | `Cookie: sb-...` (Supabase session); `Content-Type: application/json` |
| **Rate Limit** | 5 requests/min                                                        |

**Request Body:**

```json
{
  "confirmation": true
}
```

**Validation Rules:**

| Rule                          | Error                             |
| ----------------------------- | --------------------------------- |
| `confirmation` must be `true` | 400: `"confirmation is required"` |

**Expected Response (200):**

```json
{
  "success": true
}
```

**Failure Response (400):**

```json
{
  "error": "confirmation is required"
}
```

**Failure Response (405):**

```json
{
  "error": "Method not allowed"
}
```

**Database Effect:**

- User profile deleted or marked deleted
- Session invalidated
- Related records (projects, donations) preserved or reassigned based on policy

**Permissions:** Only the authenticated account owner.

**Test Cases:**

| TC-ID        | Scenario                           | Expected             |
| ------------ | ---------------------------------- | -------------------- |
| API-AUTH-001 | Valid confirm + authenticated user | 200, account deleted |
| API-AUTH-002 | `confirmation: false`              | 400 error            |
| API-AUTH-003 | No session cookie                  | 401                  |
| API-AUTH-004 | `GET` method                       | 405                  |

---

## 2. Payments & Receipts

### 2.1 `POST /api/razorpay/create-order`

| Field          | Detail                                                |
| -------------- | ----------------------------------------------------- |
| **Method**     | `POST`                                                |
| **URL**        | `/api/razorpay/create-order`                          |
| **Auth**       | Required — `withAuth`                                 |
| **Headers**    | `Cookie: <session>`; `Content-Type: application/json` |
| **Rate Limit** | 10 requests/min                                       |

**Request Body:**

```json
{
  "amount": 500,
  "projectId": "uuid-campaign-id"
}
```

**Validation Rules:**

| Rule                                    | Error                                  |
| --------------------------------------- | -------------------------------------- |
| `amount` must be > 0 and finite         | 400: `"Invalid amount"`                |
| `projectId` required                    | 400: `"projectId is required"`         |
| Project must exist                      | 404: `"Project not found"`             |
| Razorpay credentials must be configured | 500: `"Payment system not configured"` |

**Expected Response (200):**

```json
{
  "id": "order_P7abc123xyz",
  "orderId": "order_P7abc123xyz",
  "amount": 50000,
  "currency": "INR",
  "key": "rzp_live_xxxxxxxx"
}
```

**Failure Response (400/404/500):**

```json
{ "error": "Invalid amount" }
```

**Database Effect:** No direct DB write — creates order in Razorpay.

**Permissions:** Any authenticated user.

**Test Cases:**

| TC-ID       | Scenario                 | Expected              |
| ----------- | ------------------------ | --------------------- |
| API-PAY-001 | Valid amount + projectId | 200, orderId returned |
| API-PAY-002 | Zero or negative amount  | 400                   |
| API-PAY-003 | Non-numeric amount       | 400                   |
| API-PAY-004 | Missing projectId        | 400                   |
| API-PAY-005 | Non-existent projectId   | 404                   |
| API-PAY-006 | Unauthenticated          | 401                   |
| API-PAY-007 | POST rate limit exceeded | 429                   |
| API-PAY-008 | `GET` method             | 405                   |

---

### 2.2 `POST /api/razorpay/verify`

| Field          | Detail                                                |
| -------------- | ----------------------------------------------------- |
| **Method**     | `POST`                                                |
| **URL**        | `/api/razorpay/verify`                                |
| **Auth**       | Required — `withAuth`                                 |
| **Headers**    | `Cookie: <session>`; `Content-Type: application/json` |
| **Rate Limit** | 10 requests/min                                       |

**Request Body:**

```json
{
  "razorpay_payment_id": "pay_P7xyz",
  "razorpay_order_id": "order_P7abc",
  "razorpay_signature": "sig_hex_string",
  "projectId": "uuid-campaign-id",
  "amount": 500
}
```

**Validation Rules:**

| Rule                                           | Error                              |
| ---------------------------------------------- | ---------------------------------- |
| All Razorpay fields required + must be strings | 400                                |
| `projectId` required + must be string          | 400                                |
| `amount` must be > 0 and finite                | 400                                |
| Signature must match HMAC-SHA256               | 400: `"Invalid payment signature"` |
| Project must exist                             | 404                                |

**Expected Response (200):**

```json
{
  "success": true,
  "donationId": "uuid"
}
```

**Failure Response (400):**

```json
{ "error": "Invalid payment signature" }
```

**Database Effect:**

- `public_donations` row inserted with `status: "paid"`
- Project funding incremented via `increment_project_funding` RPC

**Permissions:** Any authenticated user.

**Test Cases:**

| TC-ID       | Scenario                           | Expected                  |
| ----------- | ---------------------------------- | ------------------------- |
| API-PAY-010 | Valid signature + valid project    | 200, donationId returned  |
| API-PAY-011 | Invalid signature                  | 400                       |
| API-PAY-012 | Missing any required field         | 400                       |
| API-PAY-013 | Duplicate payment_id (idempotency) | Depends on DB constraints |
| API-PAY-014 | Non-existent projectId             | 404                       |
| API-PAY-015 | Unauthenticated                    | 401                       |

---

### 2.3 `POST /api/razorpay/webhook`

| Field           | Detail                                                                |
| --------------- | --------------------------------------------------------------------- |
| **Method**      | `POST`                                                                |
| **URL**         | `/api/razorpay/webhook`                                               |
| **Auth**        | None — verified via HMAC signature                                    |
| **Headers**     | `x-razorpay-signature: <sha256hex>`; `Content-Type: application/json` |
| **Body Parser** | `bodyParser: false` (raw body read)                                   |
| **Rate Limit**  | No explicit per-route limit                                           |

**Request Body:**

```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_P7xyz",
        "amount": 50000,
        "email": "donor@example.com",
        "notes": {
          "projectId": "uuid-campaign-id"
        }
      }
    }
  }
}
```

**Validation Rules:**

| Rule                                                | Error                          |
| --------------------------------------------------- | ------------------------------ |
| HMAC-SHA256 signature must match                    | 400: `"Invalid signature"`     |
| Payload must be valid JSON                          | 400: `"Invalid JSON payload"`  |
| `payment.notes.projectId` must exist for processing | Skips with `{ success: true }` |

**Expected Response (200):**

```json
{ "success": true }
```

**Failure Response (400):**

```json
{ "error": "Invalid signature" }
```

**Database Effect:**

- `payment.captured` → inserts into `public_donations` (if not duplicate) + updates project funding via RPC
- `payment.failed` → logged only
- `refund.processed` → logged only
- Idempotent: skips if `payment_id` already exists

**Permissions:** None (webhook is external).

**Test Cases:**

| TC-ID       | Scenario                           | Expected                   |
| ----------- | ---------------------------------- | -------------------------- |
| API-PAY-020 | Valid signature + payment.captured | 200, donation recorded     |
| API-PAY-021 | Invalid signature                  | 400                        |
| API-PAY-022 | Duplicate payment ID               | 200, `{ duplicate: true }` |
| API-PAY-023 | Missing projectId in notes         | 200, skipped               |
| API-PAY-024 | payment.failed event               | 200, logged only           |
| API-PAY-025 | Invalid JSON body                  | 400                        |

---

### 2.4 `POST /api/receipts/generate`

| Field          | Detail                                                |
| -------------- | ----------------------------------------------------- |
| **Method**     | `POST`                                                |
| **URL**        | `/api/receipts/generate`                              |
| **Auth**       | Required — `withAuth`                                 |
| **Headers**    | `Cookie: <session>`; `Content-Type: application/json` |
| **Rate Limit** | 10 requests/min                                       |

**Request Body:**

```json
{
  "donationIds": ["uuid-1", "uuid-2"]
}
```

**Expected Response (200):**
PDF binary stream (Content-Type: application/pdf)

**Failure Response (400):**

```json
{ "error": "donationIds required" }
```

**Database Effect:** None (read-only).

**Permissions:** Authenticated user (their own donations) or admin.

---

### 2.5 `POST /api/export-analytics`

| Field          | Detail                                                |
| -------------- | ----------------------------------------------------- |
| **Method**     | `POST`                                                |
| **URL**        | `/api/export-analytics`                               |
| **Auth**       | Required — `withAuth`                                 |
| **Headers**    | `Cookie: <session>`; `Content-Type: application/json` |
| **Rate Limit** | 5 requests/min                                        |

**Request Body:**

```json
{
  "format": "pdf",
  "dateRange": { "start": "2026-01-01", "end": "2026-07-30" }
}
```

**Expected Response (200):**
PDF binary stream or JSON with download URL.

**Failure Response:**

```json
{ "success": false, "error": "message" }
```

---

## 3. Projects & Creator

### 3.1 `GET /api/creator/razorpay-config`

| Field       | Detail                         |
| ----------- | ------------------------------ |
| **Method**  | `GET`                          |
| **URL**     | `/api/creator/razorpay-config` |
| **Auth**    | Required — `withAuth`          |
| **Headers** | `Cookie: <session>`            |

**Expected Response (200):**

```json
{
  "success": true,
  "key": "rzp_live_xxxxxxxx",
  "hasCustomKeys": false
}
```

### 3.2 `GET /api/creator/balance`

| Field      | Detail                 |
| ---------- | ---------------------- |
| **Method** | `GET`                  |
| **URL**    | `/api/creator/balance` |
| **Auth**   | Required — `withAuth`  |

**Expected Response (200):**

```json
{
  "success": true,
  "balance": 25000.5,
  "pending": 5000.0,
  "withdrawn": 100000.0
}
```

### 3.3 `GET /api/creator/reputation`

| Field      | Detail                    |
| ---------- | ------------------------- |
| **Method** | `GET`                     |
| **URL**    | `/api/creator/reputation` |
| **Auth**   | Required — `withAuth`     |

**Expected Response (200):**

```json
{
  "success": true,
  "score": 850,
  "dimensions": {
    "identity": 95,
    "campaigns": 82,
    "community": 78,
    "payments": 90
  },
  "level": "trusted"
}
```

---

## 4. Verification (Trust Center)

Base path: `/api/verification/`  
Auth pattern: All use `withAuth`  
Rate limit: 10/min per endpoint  
Response format: `{ success: true, ... }` or `{ error: "message" }`

### 4.1 Business Verification

**`GET /api/verification/business`** — Fetch current business verification for user.

**`POST /api/verification/business`** — Create/update business verification.

**`PUT /api/verification/business`** — Upload business document.

**Request (POST):**

```json
{
  "verificationId": "uuid",
  "businessData": {
    "businessType": "sole_proprietorship",
    "businessName": "Acme Corp",
    "registrationNumber": "ABC123"
  }
}
```

**Request (PUT):**

```json
{
  "verificationId": "uuid",
  "documentType": "incorporation_certificate",
  "filename": "cert.pdf"
}
```

**Expected Response (POST 200):**

```json
{ "success": true }
```

**Database Effect:** `business_verifications` table create/update.

### 4.2 Bank Verification

**`GET /api/verification/bank`** — Fetch bank accounts.

**`POST /api/verification/bank`** — Add bank account.

**Request (POST):**

```json
{
  "accountNumber": "1234567890",
  "confirmAccountNumber": "1234567890",
  "ifscCode": "HDFC0001234",
  "accountHolderName": "John Doe",
  "bankName": "HDFC Bank"
}
```

**Validation:**

| Rule                                         | Error                                 |
| -------------------------------------------- | ------------------------------------- |
| Account numbers must match                   | 400: `"Account numbers do not match"` |
| IFSC format (4 letters + 0 + 6 alphanumeric) | 400: `"Invalid IFSC format"`          |
| All fields required                          | 400                                   |

**Database Effect:** `bank_accounts` table insert with AES-256-GCM encrypted account number.

### 4.3 Penny Drop

**`POST /api/verification/penny-drop`**

```json
{ "bankAccountId": "uuid" }
```

Verifies bank account via penny drop. Triggers provider call. Status → "Verified" or "Failed".

### 4.4 GST / PAN

**`POST /api/verification/gst`**

```json
{ "gstNumber": "27AABCU9603R1ZX" }
```

**`POST /api/verification/pan`**

```json
{ "panNumber": "ABCDE1234F" }
```

Both validated via mocking provider.

### 4.5 Documents

**`POST /api/verification/business-documents`** — Upload business document.
**`POST /api/verification/bank-documents`** — Upload bank document.

### 4.6 Admin Review

| Endpoint                     | Method   | Auth  | Purpose                     |
| ---------------------------- | -------- | ----- | --------------------------- |
| `/api/admin/business-review` | GET/POST | Admin | Review business submissions |
| `/api/admin/bank-review`     | GET/POST | Admin | Review bank submissions     |
| `/api/admin/review-queue`    | GET      | Admin | Pending review queue        |

---

## 5. Fraud Detection

### 5.1 `POST /api/fraud/evaluate`

| Field          | Detail                |
| -------------- | --------------------- |
| **Method**     | `POST`                |
| **URL**        | `/api/fraud/evaluate` |
| **Auth**       | Required — `withAuth` |
| **Rate Limit** | 10/min                |

**Request Body:**

```json
{
  "userId": "uuid (optional, defaults to caller)",
  "trigger": "api_request",
  "context": {
    "ipAddress": "...",
    "userAgent": "..."
  }
}
```

**Expected Response (200):**

```json
{
  "success": true,
  "riskLevel": "low",
  "decision": "allow",
  "riskScore": 15
}
```

**Response Sanitization:** Raw scoring details NOT exposed.

**Database Effect:** Reads risk signals, evaluates, returns result. May log to `fraud_events`.

### 5.2 `GET /api/fraud/events` — Get fraud events for user

### 5.3 `GET /api/fraud/profile` — Get risk profile

### 5.4 `GET /api/fraud/devices` — Get device fingerprints

### 5.5 `GET /api/fraud/history` — Get fraud event history

### 5.6 `GET /api/admin/fraud-dashboard` — Admin fraud case management

---

## 6. Escrow, Milestones & Payouts

### 6.1 Escrow Account

**`GET /api/escrow/account?campaignId=uuid`** — Get by campaign.  
**`GET /api/escrow/account`** — List creator's accounts.  
**`POST /api/escrow/account`** — Create.

**Request (POST):**

```json
{
  "campaignId": "uuid",
  "feePercentage": 5.0
}
```

**Validation:** `campaignId` required.

**Response Sanitization:** `metadata` field stripped from response.

**Database Effect:** `escrow_accounts` insert. Status → "open".

### 6.2 Escrow Ledger

**`GET /api/escrow/ledger?accountId=uuid`** — Append-only transaction log.

**Expected Response (200):**

```json
{
  "success": true,
  "entries": [
    {
      "type": "deposit",
      "amount": 500,
      "timestamp": "...",
      "idempotencyKey": "uuid"
    }
  ]
}
```

### 6.3 Escrow Release

**`POST /api/escrow/release`**

```json
{
  "action": "release",
  "escrowAccountId": "uuid",
  "amount": 500,
  "reason": "Milestone approved",
  "milestoneId": "uuid"
}
```

**Alternative action:** `"freeze"` — requires `reason`.

**Validation:** Both `escrowAccountId` and `reason` required for freeze; all required for release.

### 6.4 Milestones

| Endpoint                | Methods   | Purpose                              |
| ----------------------- | --------- | ------------------------------------ |
| `/api/milestone/index`  | GET, POST | List/create milestones               |
| `/api/milestone/submit` | POST      | Submit milestone complete + evidence |
| `/api/milestone/review` | POST      | Donor approve/reject milestone       |

**Milestone Submit Request:**

```json
{
  "milestoneId": "uuid",
  "evidenceUrl": "https://...",
  "notes": "Deliverable completed"
}
```

**Milestone Review Request:**

```json
{
  "milestoneId": "uuid",
  "decision": "approve",
  "notes": "Looks good"
}
```

### 6.5 Payouts

| Endpoint             | Methods   | Purpose              |
| -------------------- | --------- | -------------------- |
| `/api/payout/index`  | GET, POST | List/request payouts |
| `/api/payout/status` | GET       | Check payout status  |

**Payout Request (POST):**

```json
{
  "amount": 10000,
  "bankAccountId": "uuid"
}
```

**Validation:**

| Rule                             | Error                         |
| -------------------------------- | ----------------------------- |
| `amount` > available balance     | 400: `"Insufficient balance"` |
| `amount` must be > 0             | 400                           |
| `bankAccountId` must be verified | 400: `"Verify bank first"`    |

### 6.6 Admin Escrow/Payout

| Endpoint                      | Methods   | Purpose                |
| ----------------------------- | --------- | ---------------------- |
| `/api/admin/escrow-dashboard` | GET       | Escrow overview        |
| `/api/admin/payout-review`    | GET, POST | Review/approve payouts |

---

## 7. Compliance, Reputation & Governance

### 7.1 Compliance

**`GET /api/admin/compliance-dashboard`** — List compliance cases.  
**`POST /api/admin/compliance-dashboard`** — Create/resolve case, apply penalty.

**Request (POST):**

```json
{
  "action": "create",
  "userId": "uuid",
  "violationType": "fraud",
  "severity": "high"
}
```

**Other actions:** `"resolve"`, `"assign"`, `"penalty"`.

### 7.2 Appeals

**`GET /api/appeals/index`** — List appeals.  
**`POST /api/appeals/index`** — Submit appeal.

**Request (POST):**

```json
{
  "caseId": "uuid",
  "evidence": "url",
  "reason": "I disagree with the decision"
}
```

### 7.3 Reputation

**`GET /api/reputation/leaderboard`** — Get top creators by reputation.  
**`GET /api/creator/reputation`** — Get own reputation.

### 7.4 Policy Management

**`GET /api/admin/policy-management`** — List policies.  
**`POST /api/admin/policy-management`** — Create/update/disable policy.

### 7.5 Moderation

**`GET /api/admin/moderation-dashboard`** — Reported content queue.  
**`POST /api/moderation/report`** — Submit content report.

---

## 8. Organizations & RBAC

### 8.1 Organization CRUD

**`GET /api/organization/index`** — List orgs or get one.  
**Query params:** `orgId`, `slug`, `mode=my`, `type`, `status`, `limit`, `offset`

**`POST /api/organization/index`** — Create/update/delete/archive/transfer.

| Action               | Required              | Purpose     |
| -------------------- | --------------------- | ----------- |
| `create`             | `name`, `slug`        | New org     |
| `update`             | `orgId`, `updates`    | Edit org    |
| `delete`             | `orgId`               | Delete org  |
| `archive`            | `orgId`               | Archive org |
| `transfer_ownership` | `orgId`, `newOwnerId` | Transfer    |

**Rate Limit:** 30/min.

**Validation:**

| Rule                                                | Error |
| --------------------------------------------------- | ----- |
| `name` + `slug` required for create                 | 400   |
| `orgId` required for update/delete/archive/transfer | 400   |
| Slug must be unique                                 | 400   |

### 8.2 Organization Members

**`GET /api/organization/members?orgId=uuid`** — List members.  
**`POST /api/organization/members`** — Remove member / change role.

### 8.3 Organization Invitations

**`GET /api/organization/invitations?orgId=uuid`** — List pending.  
**`POST /api/organization/invitations`** — Invite member / accept / decline.

**Invite Request:**

```json
{
  "action": "invite",
  "orgId": "uuid",
  "email": "user@example.com",
  "role": "member"
}
```

### 8.4 Teams & Departments

**`GET /api/organization/teams?orgId=uuid`**  
**`POST /api/organization/teams`** — Create/update/delete team.

**`GET /api/organization/departments?orgId=uuid`**  
**`POST /api/organization/departments`** — Create/update/delete department.

### 8.5 Organization Settings & Analytics

**`GET/POST /api/organization/settings?orgId=uuid`** — Branding, preferences.  
**`GET /api/organization/analytics?orgId=uuid`** — Usage stats.

### 8.6 RBAC

**`GET /api/rbac/roles`** — List roles for org.  
**`POST /api/rbac/roles`** — Create/update/delete role.

**Request (POST):**

```json
{
  "action": "create",
  "orgId": "uuid",
  "name": "custom_role",
  "permissions": ["projects:read", "projects:write"]
}
```

### 8.7 Admin Organizations

**`GET /api/admin/organizations`** — All organizations for admin.

---

## 9. API Platform

### 9.1 API Keys

**`GET /api/api-platform/keys`** — List keys.  
**`POST /api/api-platform/keys`** — Generate/revoke key.

**Request (POST - Generate):**

```json
{
  "action": "generate",
  "name": "My API Key",
  "scopes": ["projects:read", "donations:read"]
}
```

**Expected Response (201):**

```json
{
  "success": true,
  "key": "fnd_live_xxxxx",
  "keyPrefix": "fnd_live_",
  "message": "Store the key securely — it will not be shown again"
}
```

**Request (POST - Revoke):**

```json
{ "action": "revoke", "keyId": "uuid" }
```

### 9.2 Developer Apps

**`GET /api/api-platform/apps`** — List apps.  
**`POST /api/api-platform/apps`** — Register/update/delete app.

**Register Request:**

```json
{
  "action": "register",
  "name": "My App",
  "redirectUris": ["https://app.example.com/callback"]
}
```

### 9.3 API Logs

**`GET /api/api-platform/logs?keyId=uuid`** — Usage logs for an API key.

---

## 10. AI Platform

Base path: `/api/ai/`  
Auth: All require `withAuth`  
Response format: `{ success: true, data: { ... } }` or `{ error: "..." }`

### 10.1 AI Chat (`POST /api/ai/chat`)

**Rate Limit:** 30/min

**Request:**

```json
{
  "question": "How can I improve my campaign?",
  "copilotType": "creator",
  "conversationId": "uuid (optional)"
}
```

**Validation:**

| Rule                   | Error |
| ---------------------- | ----- |
| `question` required    | 400   |
| `copilotType` required | 400   |

**Expected Response (200):**

```json
{
  "success": true,
  "data": {
    "answer": "Here are some tips...",
    "conversationId": "uuid",
    "tokensUsed": 150
  }
}
```

### 10.2 AI Agent (`POST /api/ai/agent`)

Executes AI agent with task description.

**Request:**

```json
{
  "agentType": "campaign_reviewer",
  "task": "Review this campaign for completeness"
}
```

### 10.3 AI Config (`GET /api/ai/config`, `POST /api/ai/config`)

Get/set AI provider configuration.

**POST Request:**

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "temperature": 0.7
}
```

### 10.4 AI Providers (`GET /api/ai/providers`, `POST /api/ai/providers`)

List and manage AI model providers.

### 10.5 AI Predictions (`GET /api/ai/predictions?campaignId=uuid`)

Get campaign success prediction.

**Response:**

```json
{
  "success": true,
  "prediction": {
    "successProbability": 0.78,
    "estimatedFunding": 45000,
    "riskFactors": ["low_social_proof"],
    "recommendations": ["Increase social sharing"]
  }
}
```

### 10.6 AI Recommendations (`GET /api/ai/recommendations`)

Personalized campaign recommendations.

### 10.7 AI Usage (`GET /api/ai/usage`)

Token/cost tracking per user.

### 10.8 AI Knowledge Base (`GET /api/ai/knowledge`, `POST /api/ai/knowledge`, `DELETE /api/ai/knowledge`)

CRUD for knowledge base articles with semantic search.

**POST Request:**

```json
{
  "title": "How to set up a campaign",
  "content": "Step-by-step guide...",
  "tags": ["guide", "campaign"]
}
```

**GET Query:** `?query=natural+language+search+terms`

### 10.9 AI Campaign Generate (`POST /api/ai/generate-campaign`)

Generate campaign description from keywords.

**Request:**

```json
{
  "keywords": ["education", "rural", "school"],
  "tone": "professional"
}
```

### 10.10 AI Funding Recommendation (`POST /api/ai/funding-recommendation`)

Get funding goal/timeline recommendations.

### 10.11 AI Campaign Score (`POST /api/ai/campaign/score`)

```json
{ "campaignId": "uuid" }
```

Response: score 0-100 with improvement tips.

### 10.12 AI Campaign Suggest (`POST /api/ai/campaign/suggest`)

```json
{ "keywords": ["health", "clinic"], "count": 3 }
```

Response: array of title suggestions.

### 10.13 AI Fraud Analyze (`POST /api/ai/fraud/analyze`)

AI-enhanced fraud analysis for suspicious patterns.

### 10.14 AI Moderation Classify (`POST /api/ai/moderation/classify`)

Classify content as safe/unsafe.

```json
{ "content": "Text to classify" }
```

### 10.15 AI Moderation Detect (`POST /api/ai/moderation/detect`)

Detect suspicious content patterns.

---

## 11. Marketplace & Plugins

### 11.1 Marketplace

| Endpoint                    | Methods | Purpose                  |
| --------------------------- | ------- | ------------------------ |
| `/api/marketplace/featured` | GET     | Featured plugins         |
| `/api/marketplace/list`     | GET     | All plugins with filters |
| `/api/marketplace/review`   | POST    | Admin review plugin      |

### 11.2 Developer

| Endpoint                    | Methods | Purpose               |
| --------------------------- | ------- | --------------------- |
| `/api/developer/register`   | POST    | Register as developer |
| `/api/developer/my-plugins` | GET     | Developer's plugins   |

### 11.3 Plugins

| Endpoint              | Methods   | Purpose                  |
| --------------------- | --------- | ------------------------ |
| `/api/plugins/list`   | GET       | List installed plugins   |
| `/api/plugins/[id]`   | GET, POST | Get/update/delete plugin |
| `/api/plugins/submit` | POST      | Submit plugin for review |

---

## 12. Events, Agents & Automation

### 12.1 Event Bus

| Endpoint                    | Methods   | Rate Limit | Purpose                      |
| --------------------------- | --------- | ---------- | ---------------------------- |
| `/api/events/index`         | GET, POST | Standard   | Publish/query events         |
| `/api/events/process`       | POST      | Standard   | Process scheduled/DLQ events |
| `/api/events/subscriptions` | GET, POST | Standard   | Manage subscriptions         |

**POST `/api/events/index` — Publish event:**

```json
{
  "eventType": "campaign.created",
  "payload": { "campaignId": "uuid" },
  "options": { "priority": "high" }
}
```

**Validation:** `eventType` and `payload` required.

### 12.2 Agents

| Endpoint                  | Methods                | Purpose                |
| ------------------------- | ---------------------- | ---------------------- |
| `/api/agents/index`       | GET, POST, PUT, DELETE | CRUD agents            |
| `/api/agents/approve`     | POST                   | Approve agent action   |
| `/api/agents/memory`      | GET, POST              | Agent memory context   |
| `/api/agents/permissions` | GET, POST              | Agent permission rules |
| `/api/agents/run`         | POST                   | Execute agent now      |
| `/api/agents/schedule`    | GET, POST              | Schedule agent runs    |

**Agent create (POST):**

```json
{
  "name": "ModeratorBot",
  "agentType": "moderator",
  "config": { "schedule": "*/30 * * * *" }
}
```

### 12.3 Automation Workflows

| Endpoint                                 | Methods          | Rate Limit | Purpose               |
| ---------------------------------------- | ---------------- | ---------- | --------------------- |
| `/api/automation/workflows`              | GET, POST        | 30/min     | List/create workflows |
| `/api/automation/workflows/[id]`         | GET, PUT, DELETE | 30/min     | CRUD single workflow  |
| `/api/automation/workflows/[id]/runs`    | GET              | 30/min     | Run history           |
| `/api/automation/workflows/[id]/trigger` | POST             | 30/min     | Manual trigger        |

**Workflow create (POST):**

```json
{
  "name": "New Campaign Alert",
  "description": "Notify team when campaign created",
  "trigger": {
    "event": "campaign.created",
    "filters": { "amount": { "gte": 10000 } }
  },
  "steps": [
    {
      "type": "send_notification",
      "config": { "channel": "slack", "message": "...", "template": "..." }
    }
  ],
  "config": { "maxRetries": 3 }
}
```

**Validation:** `name`, `trigger`, `steps` required. `steps` must be non-empty array.

---

## 13. Connectors & MCP

### 13.1 Connectors (`/api/connectors/index`)

| Method   | Purpose                                                                |
| -------- | ---------------------------------------------------------------------- |
| `GET`    | List connectors (optionally `?providers=true` for available providers) |
| `POST`   | Register new connector                                                 |
| `PUT`    | Connect/disconnect/send message (via `action` field)                   |
| `DELETE` | Remove connector                                                       |

**Register (POST):**

```json
{
  "provider": "slack",
  "config": { "webhookUrl": "https://hooks.slack.com/..." },
  "name": "Team Slack"
}
```

**Connect (PUT):**

```json
{ "action": "connect" }
```

**Send message (PUT):**

```json
{ "action": "send", "channel": "#general", "message": "Hello!" }
```

### 13.2 MCP Server (`/api/mcp/index`)

| Method | Purpose                  |
| ------ | ------------------------ |
| `GET`  | List available MCP tools |
| `POST` | Execute MCP tool         |

**GET Response:**

```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "getCampaign",
        "description": "Get campaign details",
        "parameters": {
          "type": "object",
          "properties": { "campaignId": { "type": "string" } },
          "required": ["campaignId"]
        }
      }
    ]
  }
}
```

**POST Request:**

```json
{
  "tool": "getCampaign",
  "parameters": { "campaignId": "uuid" }
}
```

---

## 14. Exports, Tenants & Feature Flags

### 14.1 Data Exports

| Endpoint                 | Methods   | Purpose             |
| ------------------------ | --------- | ------------------- |
| `/api/exports/index`     | GET, POST | List/create exports |
| `/api/exports/schedule`  | GET, POST | Scheduled exports   |
| `/api/exports/templates` | GET, POST | Export templates    |

**Create export (POST):**

```json
{
  "format": "csv",
  "entityType": "donations",
  "filters": { "dateRange": { "start": "...", "end": "..." } }
}
```

### 14.2 Tenants

| Endpoint                | Methods   | Purpose                |
| ----------------------- | --------- | ---------------------- |
| `/api/tenants/index`    | GET, POST | List/create tenants    |
| `/api/tenants/branding` | POST      | Update tenant branding |
| `/api/tenants/quotas`   | GET, POST | Get/set tenant quotas  |
| `/api/tenants/settings` | GET, POST | Tenant settings        |

### 14.3 Feature Flags

| Endpoint            | Methods   | Purpose                  |
| ------------------- | --------- | ------------------------ |
| `/api/flags/index`  | GET, POST | List/create/update flags |
| `/api/flags/abtest` | GET, POST | A/B test configuration   |

**Create flag (POST):**

```json
{
  "name": "new_onboarding_flow",
  "description": "New onboarding wizard",
  "rolloutPercentage": 25,
  "targeting": { "organizations": ["org-uuid"] }
}
```

---

## 15. Infrastructure

### 15.1 Cache (`/api/infrastructure/cache`)

| Method | Purpose                                   |
| ------ | ----------------------------------------- |
| `GET`  | Cache stats (hits, misses, size, backend) |
| `POST` | Invalidate/clear cache                    |

**POST Request:**

```json
{ "action": "invalidate", "key": "cache:key:pattern:*" }
```

### 15.2 Infrastructure Health (`/api/infrastructure/health`)

| Method | Purpose                       |
| ------ | ----------------------------- |
| `GET`  | Overall infrastructure health |

### 15.3 Queues (`/api/infrastructure/queues`)

| Method | Purpose         |
| ------ | --------------- |
| `GET`  | Job queue stats |

### 15.4 Jobs

| Endpoint             | Methods   | Purpose                      |
| -------------------- | --------- | ---------------------------- |
| `/api/jobs/index`    | GET, POST | List/enqueue/get/cancel jobs |
| `/api/jobs/process`  | POST      | Process next pending job     |
| `/api/jobs/schedule` | GET, POST | Job scheduling               |

**Enqueue (POST):**

```json
{
  "jobType": "send_email",
  "payload": { "to": "user@example.com", "template": "welcome" },
  "options": { "priority": "high", "delay": 0 }
}
```

**Validation:** `jobType` required.

### 15.5 Webhooks

| Endpoint                   | Methods   | Purpose                            |
| -------------------------- | --------- | ---------------------------------- |
| `/api/webhooks/index`      | GET, POST | List/create/update/delete webhooks |
| `/api/webhooks/deliveries` | GET       | Delivery logs                      |
| `/api/webhooks/test`       | POST      | Send test ping                     |

**Create webhook (POST):**

```json
{
  "action": "create",
  "url": "https://app.example.com/webhook",
  "events": ["campaign.created", "donation.received"],
  "description": "Send events to my app"
}
```

**Response includes:** Webhook secret (shown once).

### 15.6 Notifications

| Endpoint                         | Methods           | Purpose                             |
| -------------------------------- | ----------------- | ----------------------------------- |
| `/api/notifications/index`       | GET, POST, DELETE | List/mark-read/delete notifications |
| `/api/notifications/preferences` | GET, POST         | Notification channel preferences    |

**Mark read (POST):**

```json
{ "action": "mark_read", "notificationId": "uuid" }
```

**Mark all read:**

```json
{ "action": "mark_all_read" }
```

**Preferences (POST):**

```json
{
  "channels": { "in_app": true, "email": true, "push": false },
  "categories": { "donations": true, "follows": true, "system": false }
}
```

---

## 16. Health, Diagnostics & Deployments

### 16.1 Health

**`GET /api/health/index`** — System health (no auth required).

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2026-07-30T12:00:00.000Z",
  "uptime": 12345.67,
  "version": "1.0.0",
  "environment": "development",
  "checks": {
    "database": { "status": "ok", "responseTime": 5 },
    "memory": { "status": "ok", "usage": { ... } },
    "pool": { "active": 3, "acquired": 100, "max": 50 }
  }
}
```

**Response (503) — Degraded:**

```json
{
  "status": "unhealthy",
  "error": "Database unreachable",
  "timestamp": "..."
}
```

### 16.2 Database Health

**`GET /api/health/database`** — DB-specific health.

**Response:**

```json
{
  "success": true,
  "data": {
    "reachable": true,
    "responseTime": 5,
    "connectionPool": { "active": 2, "idle": 8, "max": 50 }
  }
}
```

### 16.3 Diagnostics

**`GET /api/diagnostics/index`** — Full system diagnostics (admin).

### 16.4 Deployments

| Endpoint                    | Methods   | Purpose                 |
| --------------------------- | --------- | ----------------------- |
| `/api/deployments/index`    | GET, POST | List/create deployments |
| `/api/deployments/rollback` | POST      | Rollback to version     |

### 16.5 Metrics

**`GET /api/metrics/index`** — Platform metrics (admin).

---

## 17. Global Platform

### 17.1 i18n

**`GET /api/i18n/translations?locale=hi`** — Load translations.

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "locale": "hi",
    "translations": { "welcome": "स्वागत है", "explore": "एक्सप्लोर करें" }
  }
}
```

### 17.2 Currency

**`GET /api/currency/rates`** — Exchange rates.

**`POST /api/currency/convert`** — Convert amount.

```json
{
  "amount": 1000,
  "from": "USD",
  "to": "EUR"
}
```

### 17.3 Search

**`GET /api/search?query=tech&entity=projects&page=1&limit=20`** — Unified search.

**`POST /api/search`** — Advanced search.

```json
{
  "query": "tech",
  "entities": ["projects", "creators"],
  "perEntityLimit": 5
}
```

**Validation:** `query` required for both methods.

### 17.4 Autocomplete

**`GET /api/search/autocomplete?query=te`** — Search suggestions.

### 17.5 Storage Upload

**`POST /api/storage/upload`**

```json
{
  "bucket": "campaigns",
  "path": "user123/image.jpg",
  "file": "<binary or base64>"
}
```

**Validation:** `bucket` and `path` required.

### 17.6 Signed URL

**`POST /api/storage/signed-url`**

```json
{
  "bucket": "campaigns",
  "path": "user123/image.jpg",
  "expiresIn": 3600
}
```

### 17.7 Backup

| Endpoint              | Methods   | Purpose             |
| --------------------- | --------- | ------------------- |
| `/api/backup/backups` | GET, POST | List/create backups |
| `/api/backup/restore` | POST      | Restore from backup |

### 17.8 Observability

| Endpoint                     | Methods   | Purpose               |
| ---------------------------- | --------- | --------------------- |
| `/api/observability/metrics` | GET       | Platform metrics      |
| `/api/observability/health`  | GET       | Component health      |
| `/api/observability/alerts`  | GET, POST | Alert rules + history |

### 17.9 Mobile Sync

**`POST /api/mobile/sync`** — Offline data sync with conflict resolution.

### 17.10 Analytics

| Endpoint                  | Methods   | Purpose             |
| ------------------------- | --------- | ------------------- |
| `/api/analytics/index`    | GET       | Platform analytics  |
| `/api/analytics/insights` | GET       | AI-powered insights |
| `/api/analytics/metrics`  | GET       | Realtime metrics    |
| `/api/analytics/reports`  | GET, POST | Custom reports      |

---

## 18. API Test Checklist

| #          | Category                            | State |
| ---------- | ----------------------------------- | ----- |
| 1.1-1.4    | Authentication                      | ☐     |
| 2.1-2.5    | Payments & Receipts                 | ☐     |
| 3.1-3.3    | Projects & Creator                  | ☐     |
| 4.1-4.6    | Verification (Trust Center)         | ☐     |
| 5.1-5.6    | Fraud Detection                     | ☐     |
| 6.1-6.6    | Escrow, Milestones & Payouts        | ☐     |
| 7.1-7.5    | Compliance, Reputation & Governance | ☐     |
| 8.1-8.7    | Organizations & RBAC                | ☐     |
| 9.1-9.3    | API Platform                        | ☐     |
| 10.1-10.15 | AI Platform                         | ☐     |
| 11.1-11.3  | Marketplace & Plugins               | ☐     |
| 12.1-12.3  | Events, Agents & Automation         | ☐     |
| 13.1-13.2  | Connectors & MCP                    | ☐     |
| 14.1-14.3  | Exports, Tenants & Feature Flags    | ☐     |
| 15.1-15.6  | Infrastructure                      | ☐     |
| 16.1-16.5  | Health, Diagnostics & Deployments   | ☐     |
| 17.1-17.10 | Global Platform                     | ☐     |

### Key Validation Patterns to Verify

**Response Format:** Every endpoint should return `{ success: boolean, data?: any, error?: string }`.

**HTTP Status Codes:**

- 200 — Success
- 201 — Created (POST for new resources)
- 400 — Validation error / bad request
- 401 — Unauthenticated (missing/invalid session)
- 403 — Forbidden (insufficient permissions)
- 404 — Resource not found
- 405 — Method not allowed
- 429 — Rate limit exceeded
- 500 — Internal server error
- 503 — Service unavailable

**Auth Enforcement:** Every endpoint (except webhooks and health) must use `withAuth` — verify 401 when no session cookie present.

**Rate Limiting:** Default 10/min (some endpoints use 30/min or 5/min) — verify 429 when exceeded.

**Sanitization:**

- Bank account numbers masked (`XXXX1234`)
- Webhook secrets stripped from GET responses
- Fraud raw scoring details excluded from evaluate response
- Escrow metadata stripped
- API keys shown once only

**Idempotency:** Razorpay webhook skips duplicate payment IDs; job queue prevents duplicate enqueue.

**Error Handling:** Every handler wrapped in try/catch — no unhandled promise rejections.

---

_End of API Test Plan_
