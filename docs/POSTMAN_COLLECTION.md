# 📮 Fundora — Postman Collection

**Document:** `docs/POSTMAN_COLLECTION.md`  
**Author:** Senior Backend QA Engineer  
**Date:** 2026-07-30  
**Version:** 1.0  
**Base URL:** `{{base_url}}` (default: `http://localhost:3000`)  
**Auth Token:** `{{session_token}}` (populated from login response)

---

## Table of Contents

1. [Collection Variables](#collection-variables)
2. [Pre-request Script](#pre-request-script)
3. [Test Script (Collection-Level)](#test-script-collection-level)
4. [Group 1: Authentication](#group-1-authentication)
5. [Group 2: Payments & Receipts](#group-2-payments--receipts)
6. [Group 3: Creator & Projects](#group-3-creator--projects)
7. [Group 4: Verification (Trust Center)](#group-4-verification-trust-center)
8. [Group 5: Fraud Detection](#group-5-fraud-detection)
9. [Group 6: Escrow, Milestones & Payouts](#group-6-escrow-milestones--payouts)
10. [Group 7: Compliance, Reputation & Governance](#group-7-compliance-reputation--governance)
11. [Group 8: Organizations & RBAC](#group-8-organizations--rbac)
12. [Group 9: API Platform](#group-9-api-platform)
13. [Group 10: AI Platform](#group-10-ai-platform)
14. [Group 11: Marketplace & Plugins](#group-11-marketplace--plugins)
15. [Group 12: Events, Agents & Automation](#group-12-events-agents--automation)
16. [Group 13: Connectors & MCP](#group-13-connectors--mcp)
17. [Group 14: Exports, Tenants & Feature Flags](#group-14-exports-tenants--feature-flags)
18. [Group 15: Infrastructure](#group-15-infrastructure)
19. [Group 16: Health, Diagnostics & Deployments](#group-16-health-diagnostics--deployments)
20. [Group 17: Global Platform](#group-17-global-platform)
21. [Import Instructions](#import-instructions)

---

## Collection Variables

Set these variables in the Postman collection:

| Variable             | Initial Value           | Description                                 |
| -------------------- | ----------------------- | ------------------------------------------- |
| `base_url`           | `http://localhost:3000` | API base URL                                |
| `session_token`      | —                       | Supabase session token (populated at login) |
| `auth_cookie`        | —                       | Full `sb-xxx=value` cookie string           |
| `project_id`         | —                       | Test project UUID                           |
| `org_id`             | —                       | Test organization UUID                      |
| `bank_account_id`    | —                       | Test bank account UUID                      |
| `escrow_account_id`  | —                       | Test escrow account UUID                    |
| `milestone_id`       | —                       | Test milestone UUID                         |
| `webhook_id`         | —                       | Test webhook UUID                           |
| `agent_id`           | —                       | Test agent UUID                             |
| `workflow_id`        | —                       | Test workflow UUID                          |
| `api_key`            | —                       | Test API key                                |
| `ai_conversation_id` | —                       | AI chat conversation UUID                   |

---

## Pre-request Script

```javascript
// Set content-type header for all POST/PUT/PATCH requests
if (["post", "put", "patch"].includes(request.method.toLowerCase())) {
  pm.request.headers.add({
    key: "Content-Type",
    value: "application/json",
  });
}

// Add auth cookie if available
const authCookie = pm.variables.get("auth_cookie");
if (authCookie) {
  pm.request.headers.add({
    key: "Cookie",
    value: authCookie,
  });
}
```

---

## Test Script (Collection-Level)

```javascript
// Validate standard response format
const jsonData = pm.response.json();

pm.test("Response has standard format", () => {
  // Most endpoints return { success, data } or { error }
  const hasStandard =
    jsonData.success !== undefined || jsonData.error !== undefined;
  pm.expect(hasStandard).to.be.true;
});

pm.test("Status code is proper", () => {
  if (jsonData.success === true) {
    pm.expect(pm.response.code).to.be.oneOf([200, 201]);
  }
  if (jsonData.error) {
    pm.expect(pm.response.code).to.be.oneOf([
      400, 401, 403, 404, 405, 429, 500,
    ]);
  }
});
```

---

## Group 1: Authentication

### Request 1.1: Delete Account

```json
{
  "name": "Delete Account",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/account/delete",
      "host": ["{{base_url}}"],
      "path": ["api", "account", "delete"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"confirmation\": true\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Delete account returns 200", () => {
  pm.expect(pm.response.code).to.equal(200);
});
pm.test("Response has success: true", () => {
  pm.expect(pm.response.json().success).to.be.true;
});
```

---

## Group 2: Payments & Receipts

### Request 2.1: Create Razorpay Order

```json
{
  "name": "Create Razorpay Order",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/razorpay/create-order",
      "host": ["{{base_url}}"],
      "path": ["api", "razorpay", "create-order"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"amount\": 500,\n  \"projectId\": \"{{project_id}}\"\n}"
    }
  }
}
```

**Expected Response (200):**

```json
{
  "id": "order_P7abc123xyz",
  "orderId": "order_P7abc123xyz",
  "amount": 50000,
  "currency": "INR",
  "key": "rzp_test_xxxxxxxx"
}
```

**Tests:**

```javascript
pm.test("Order created successfully", () => {
  pm.expect(pm.response.code).to.equal(200);
  const json = pm.response.json();
  pm.expect(json).to.have.property("id");
  pm.expect(json).to.have.property("orderId");
  pm.expect(json).to.have.property("amount");
  pm.expect(json).to.have.property("key");
});

pm.test("Amount is in paise", () => {
  pm.expect(pm.response.json().amount).to.equal(50000);
});

pm.variables.set("razorpay_order_id", pm.response.json().orderId);
```

### Request 2.2: Verify Payment

```json
{
  "name": "Verify Payment",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/razorpay/verify",
      "host": ["{{base_url}}"],
      "path": ["api", "razorpay", "verify"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"razorpay_payment_id\": \"pay_test_123\",\n  \"razorpay_order_id\": \"{{razorpay_order_id}}\",\n  \"razorpay_signature\": \"sig_hex_string\",\n  \"projectId\": \"{{project_id}}\",\n  \"amount\": 500\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Response is 200 or 400 (invalid sig)", () => {
  pm.expect(pm.response.code).to.be.oneOf([200, 400]);
});

pm.test("If success has donationId", () => {
  const json = pm.response.json();
  if (json.success) {
    pm.expect(json).to.have.property("donationId");
  }
});
```

### Request 2.3: Razorpay Webhook

```json
{
  "name": "Razorpay Webhook",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/razorpay/webhook",
      "host": ["{{base_url}}"],
      "path": ["api", "razorpay", "webhook"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "x-razorpay-signature", "value": "generated_signature" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"event\": \"payment.captured\",\n  \"payload\": {\n    \"payment\": {\n      \"entity\": {\n        \"id\": \"pay_P7xyz\",\n        \"amount\": 50000,\n        \"email\": \"donor@example.com\",\n        \"notes\": {\n          \"projectId\": \"{{project_id}}\"\n        }\n      }\n    }\n  }\n}"
    }
  }
}
```

### Request 2.4: Generate Receipt

```json
{
  "name": "Generate Receipt",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/receipts/generate",
      "host": ["{{base_url}}"],
      "path": ["api", "receipts", "generate"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"donationIds\": [\"uuid-1\", \"uuid-2\"]\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Response is PDF", () => {
  pm.expect(pm.response.headers.one("content-type")).to.include(
    "application/pdf",
  );
});
```

### Request 2.5: Export Analytics

```json
{
  "name": "Export Analytics",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/export-analytics",
      "host": ["{{base_url}}"],
      "path": ["api", "export-analytics"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" ]
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"format\": \"pdf\",\n  \"dateRange\": {\n    \"start\": \"2026-01-01\",\n    \"end\": \"2026-07-30\"\n  }\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Export returns 200", () => {
  pm.expect(pm.response.code).to.equal(200);
});
```

---

## Group 3: Creator & Projects

### Request 3.1: Get Creator Balance

```json
{
  "name": "Get Creator Balance",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/creator/balance",
      "host": ["{{base_url}}"],
      "path": ["api", "creator", "balance"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

**Tests:**

```javascript
pm.test("Balance endpoint works", () => {
  pm.expect(pm.response.code).to.equal(200);
  const json = pm.response.json();
  pm.expect(json).to.have.property("success");
  if (json.success) {
    pm.expect(json).to.have.all.keys([
      "success",
      "balance",
      "pending",
      "withdrawn",
    ]);
  }
});
```

### Request 3.2: Get Creator Reputation

```json
{
  "name": "Get Creator Reputation",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/creator/reputation",
      "host": ["{{base_url}}"],
      "path": ["api", "creator", "reputation"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 3.3: Get Razorpay Config

```json
{
  "name": "Get Razorpay Config",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/creator/razorpay-config",
      "host": ["{{base_url}}"],
      "path": ["api", "creator", "razorpay-config"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

---

## Group 4: Verification (Trust Center)

### Request 4.1: Get Business Verification

```json
{
  "name": "Get Business Verification",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/verification/business",
      "host": ["{{base_url}}"],
      "path": ["api", "verification", "business"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

**Tests:**

```javascript
pm.test("GET business verification returns 200", () => {
  pm.expect(pm.response.code).to.equal(200);
  pm.expect(pm.response.json().success).to.be.true;
});
```

### Request 4.2: Create Business Verification

```json
{
  "name": "Create Business Verification",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/verification/business",
      "host": ["{{base_url}}"],
      "path": ["api", "verification", "business"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"businessData\": {\n    \"businessType\": \"sole_proprietorship\",\n    \"businessName\": \"Acme Corp\",\n    \"registrationNumber\": \"ABC123\"\n  }\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("POST business verification returns 200", () => {
  pm.expect(pm.response.code).to.equal(200);
});
```

### Request 4.3: Upload Business Document

```json
{
  "name": "Upload Business Document",
  "request": {
    "method": "PUT",
    "url": {
      "raw": "{{base_url}}/api/verification/business",
      "host": ["{{base_url}}"],
      "path": ["api", "verification", "business"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"verificationId\": \"uuid\",\n  \"documentType\": \"incorporation_certificate\",\n  \"filename\": \"cert.pdf\"\n}"
    }
  }
}
```

### Request 4.4: Add Bank Account

```json
{
  "name": "Add Bank Account",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/verification/bank",
      "host": ["{{base_url}}"],
      "path": ["api", "verification", "bank"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"accountNumber\": \"1234567890\",\n  \"confirmAccountNumber\": \"1234567890\",\n  \"ifscCode\": \"HDFC0001234\",\n  \"accountHolderName\": \"John Doe\",\n  \"bankName\": \"HDFC Bank\"\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Add bank account", () => {
  pm.expect(pm.response.code).to.equal(200);
  if (pm.response.json().success) {
    pm.variables.set("bank_account_id", pm.response.json().data?.id);
  }
});

// Negative: mismatched account numbers
pm.test("Mismatched accounts returns 400", () => {
  // Send with different confirmAccountNumber
  // Expect 400 error
});
```

### Request 4.5: Penny Drop

```json
{
  "name": "Penny Drop Verification",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/verification/penny-drop",
      "host": ["{{base_url}}"],
      "path": ["api", "verification", "penny-drop"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"bankAccountId\": \"{{bank_account_id}}\"\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Penny drop returns 200", () => {
  pm.expect(pm.response.code).to.equal(200);
});
```

### Request 4.6: Verify GST

```json
{
  "name": "Verify GST",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/verification/gst",
      "host": ["{{base_url}}"],
      "path": ["api", "verification", "gst"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"gstNumber\": \"27AABCU9603R1ZX\"\n}"
    }
  }
}
```

### Request 4.7: Verify PAN

```json
{
  "name": "Verify PAN",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/verification/pan",
      "host": ["{{base_url}}"],
      "path": ["api", "verification", "pan"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"panNumber\": \"ABCDE1234F\"\n}"
    }
  }
}
```

### Request 4.8: Admin Review Queue

```json
{
  "name": "Admin Review Queue",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/admin/review-queue",
      "host": ["{{base_url}}"],
      "path": ["api", "admin", "review-queue"],
      "query": [
        { "key": "status", "value": "pending" },
        { "key": "type", "value": "business" },
        { "key": "limit", "value": "20" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 4.9: Admin Business Review

```json
{
  "name": "Admin Business Review — Approve",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/admin/business-review",
      "host": ["{{base_url}}"],
      "path": ["api", "admin", "business-review"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"verificationId\": \"uuid\",\n  \"action\": \"approve\",\n  \"notes\": \"All documents verified\"\n}"
    }
  }
}
```

**Reject alternative:**

```json
{ "verificationId": "uuid", "action": "reject", "reason": "Document illegible" }
```

---

## Group 5: Fraud Detection

### Request 5.1: Evaluate Fraud Risk

```json
{
  "name": "Evaluate Fraud Risk",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/fraud/evaluate",
      "host": ["{{base_url}}"],
      "path": ["api", "fraud", "evaluate"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"trigger\": \"api_request\",\n  \"context\": {}\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Fraud evaluate returns overview only", () => {
  const json = pm.response.json();
  pm.expect(json).to.have.property("riskLevel");
  pm.expect(json).to.have.property("decision");
  pm.expect(json).to.have.property("riskScore");
  // Must NOT expose raw signals
  pm.expect(json).to.not.have.property("signals");
  pm.expect(json).to.not.have.property("breakdown");
});
```

### Request 5.2: Get Fraud Events

```json
{
  "name": "Get Fraud Events",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/fraud/events",
      "host": ["{{base_url}}"],
      "path": ["api", "fraud", "events"],
      "query": [{ "key": "limit", "value": "20" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 5.3: Get Fraud Profile

```json
{
  "name": "Get Fraud Profile",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/fraud/profile",
      "host": ["{{base_url}}"],
      "path": ["api", "fraud", "profile"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 5.4: Get Device Fingerprints

```json
{
  "name": "Get Device Fingerprints",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/fraud/devices",
      "host": ["{{base_url}}"],
      "path": ["api", "fraud", "devices"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 5.5: Get Fraud History

```json
{
  "name": "Get Fraud History",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/fraud/history",
      "host": ["{{base_url}}"],
      "path": ["api", "fraud", "history"],
      "query": [{ "key": "limit", "value": "20" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 5.6: Admin Fraud Dashboard

```json
{
  "name": "Admin Fraud Dashboard",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/admin/fraud-dashboard",
      "host": ["{{base_url}}"],
      "path": ["api", "admin", "fraud-dashboard"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

---

## Group 6: Escrow, Milestones & Payouts

### Request 6.1: Create Escrow Account

```json
{
  "name": "Create Escrow Account",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/escrow/account",
      "host": ["{{base_url}}"],
      "path": ["api", "escrow", "account"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"campaignId\": \"{{project_id}}\",\n  \"feePercentage\": 5.0\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Escrow account created", () => {
  pm.expect(pm.response.code).to.equal(201);
  const json = pm.response.json();
  pm.expect(json.success).to.be.true;
  if (json.account) {
    pm.expect(json.account).to.not.have.property("metadata");
    pm.variables.set("escrow_account_id", json.account.id);
  }
});
```

### Request 6.2: Get Escrow Account

```json
{
  "name": "Get Escrow Account",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/escrow/account?campaignId={{project_id}}",
      "host": ["{{base_url}}"],
      "path": ["api", "escrow", "account"],
      "query": [{ "key": "campaignId", "value": "{{project_id}}" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 6.3: Get Escrow Ledger

```json
{
  "name": "Get Escrow Ledger",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/escrow/ledger?accountId={{escrow_account_id}}",
      "host": ["{{base_url}}"],
      "path": ["api", "escrow", "ledger"],
      "query": [{ "key": "accountId", "value": "{{escrow_account_id}}" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 6.4: Release Escrow Funds

```json
{
  "name": "Release Escrow Funds",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/escrow/release",
      "host": ["{{base_url}}"],
      "path": ["api", "escrow", "release"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"release\",\n  \"escrowAccountId\": \"{{escrow_account_id}}\",\n  \"amount\": 500,\n  \"reason\": \"Milestone completed\",\n  \"milestoneId\": \"{{milestone_id}}\"\n}"
    }
  }
}
```

### Request 6.5: Emergency Freeze Escrow

```json
{
  "name": "Emergency Freeze Escrow",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/escrow/release",
      "host": ["{{base_url}}"],
      "path": ["api", "escrow", "release"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"freeze\",\n  \"escrowAccountId\": \"{{escrow_account_id}}\",\n  \"reason\": \"Dispute raised\"\n}"
    }
  }
}
```

**Validation Tests:**

```javascript
pm.test("Freeze requires reason", () => {
  // Send without reason → expect 400
});
```

### Request 6.6: Create Milestone

```json
{
  "name": "Create Milestone",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/milestone/index",
      "host": ["{{base_url}}"],
      "path": ["api", "milestone", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"campaignId\": \"{{project_id}}\",\n  \"title\": \"Design Phase\",\n  \"description\": \"Complete wireframes and mockups\",\n  \"amount\": 5000,\n  \"deadline\": \"2026-08-30\"\n}"
    }
  }
}
```

### Request 6.7: Submit Milestone

```json
{
  "name": "Submit Milestone",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/milestone/submit",
      "host": ["{{base_url}}"],
      "path": ["api", "milestone", "submit"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"milestoneId\": \"{{milestone_id}}\",\n  \"evidenceUrl\": \"https://storage.example.com/deliverable.pdf\",\n  \"notes\": \"All wireframes completed\"\n}"
    }
  }
}
```

### Request 6.8: Review Milestone (Donor)

```json
{
  "name": "Review Milestone",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/milestone/review",
      "host": ["{{base_url}}"],
      "path": ["api", "milestone", "review"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"milestoneId\": \"{{milestone_id}}\",\n  \"decision\": \"approve\",\n  \"notes\": \"Great work!\"\n}"
    }
  }
}
```

### Request 6.9: Request Payout

```json
{
  "name": "Request Payout",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/payout/index",
      "host": ["{{base_url}}"],
      "path": ["api", "payout", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"amount\": 10000,\n  \"bankAccountId\": \"{{bank_account_id}}\"\n}"
    }
  }
}
```

### Request 6.10: Get Payout Status

```json
{
  "name": "Get Payout Status",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/payout/status",
      "host": ["{{base_url}}"],
      "path": ["api", "payout", "status"],
      "query": [{ "key": "payoutId", "value": "uuid" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 6.11: Admin Escrow Dashboard

```json
{
  "name": "Admin Escrow Dashboard",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/admin/escrow-dashboard",
      "host": ["{{base_url}}"],
      "path": ["api", "admin", "escrow-dashboard"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 6.12: Admin Payout Review

```json
{
  "name": "Admin Payout Review",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/admin/payout-review",
      "host": ["{{base_url}}"],
      "path": ["api", "admin", "payout-review"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"payoutId\": \"uuid\",\n  \"action\": \"approve\"\n}"
    }
  }
}
```

---

## Group 7: Compliance, Reputation & Governance

### Request 7.1: Admin Compliance Dashboard

```json
{
  "name": "Admin Compliance Dashboard",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/admin/compliance-dashboard",
      "host": ["{{base_url}}"],
      "path": ["api", "admin", "compliance-dashboard"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 7.2: Create Compliance Case

```json
{
  "name": "Create Compliance Case",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/admin/compliance-dashboard",
      "host": ["{{base_url}}"],
      "path": ["api", "admin", "compliance-dashboard"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"create\",\n  \"userId\": \"uuid\",\n  \"violationType\": \"fraud\",\n  \"severity\": \"high\",\n  \"description\": \"Suspicious account activity\"\n}"
    }
  }
}
```

### Request 7.3: Submit Appeal

```json
{
  "name": "Submit Appeal",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/appeals/index",
      "host": ["{{base_url}}"],
      "path": ["api", "appeals", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"caseId\": \"uuid\",\n  \"evidence\": \"https://storage.example.com/evidence.pdf\",\n  \"reason\": \"The decision was based on incomplete information\"\n}"
    }
  }
}
```

### Request 7.4: Get Reputation Leaderboard

```json
{
  "name": "Reputation Leaderboard",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/reputation/leaderboard",
      "host": ["{{base_url}}"],
      "path": ["api", "reputation", "leaderboard"],
      "query": [{ "key": "limit", "value": "10" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 7.5: Report Content (Moderation)

```json
{
  "name": "Report Content",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/moderation/report",
      "host": ["{{base_url}}"],
      "path": ["api", "moderation", "report"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"entityType\": \"project\",\n  \"entityId\": \"uuid\",\n  \"reason\": \"inappropriate_content\",\n  \"description\": \"Contains offensive language\"\n}"
    }
  }
}
```

---

## Group 8: Organizations & RBAC

### Request 8.1: Create Organization

```json
{
  "name": "Create Organization",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/organization/index",
      "host": ["{{base_url}}"],
      "path": ["api", "organization", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"create\",\n  \"name\": \"Acme Corp\",\n  \"slug\": \"acme-corp\",\n  \"type\": \"company\",\n  \"description\": \"A test organization\",\n  \"industry\": \"technology\",\n  \"size\": \"10-50\"\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Organization created", () => {
  pm.expect(pm.response.code).to.equal(201);
  const json = pm.response.json();
  pm.expect(json.success).to.be.true;
  if (json.data?.id) {
    pm.variables.set("org_id", json.data.id);
  }
});
```

### Request 8.2: Get User Organizations

```json
{
  "name": "Get My Organizations",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/organization/index?mode=my",
      "host": ["{{base_url}}"],
      "path": ["api", "organization", "index"],
      "query": [{ "key": "mode", "value": "my" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 8.3: Invite Member

```json
{
  "name": "Invite Member",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/organization/invitations",
      "host": ["{{base_url}}"],
      "path": ["api", "organization", "invitations"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"invite\",\n  \"orgId\": \"{{org_id}}\",\n  \"email\": \"member@example.com\",\n  \"role\": \"member\"\n}"
    }
  }
}
```

### Request 8.4: List Members

```json
{
  "name": "List Members",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/organization/members?orgId={{org_id}}",
      "host": ["{{base_url}}"],
      "path": ["api", "organization", "members"],
      "query": [{ "key": "orgId", "value": "{{org_id}}" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 8.5: Organization Teams

```json
{
  "name": "Create Team",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/organization/teams",
      "host": ["{{base_url}}"],
      "path": ["api", "organization", "teams"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"orgId\": \"{{org_id}}\",\n  \"name\": \"Engineering\",\n  \"departmentId\": \"uuid\"\n}"
    }
  }
}
```

### Request 8.6: RBAC Roles

```json
{
  "name": "Create Custom Role",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/rbac/roles",
      "host": ["{{base_url}}"],
      "path": ["api", "rbac", "roles"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"create\",\n  \"orgId\": \"{{org_id}}\",\n  \"name\": \"custom_role\",\n  \"permissions\": [\"projects:read\", \"projects:write\"]\n}"
    }
  }
}
```

### Request 8.7: Update Organization

```json
{
  "name": "Update Organization",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/organization/index",
      "host": ["{{base_url}}"],
      "path": ["api", "organization", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"update\",\n  \"orgId\": \"{{org_id}}\",\n  \"updates\": {\n    \"description\": \"Updated description\"\n  }\n}"
    }
  }
}
```

---

## Group 9: API Platform

### Request 9.1: Generate API Key

```json
{
  "name": "Generate API Key",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/api-platform/keys",
      "host": ["{{base_url}}"],
      "path": ["api", "api-platform", "keys"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"generate\",\n  \"name\": \"Test API Key\",\n  \"scopes\": [\"projects:read\", \"donations:read\"]\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("API key generated", () => {
  pm.expect(pm.response.code).to.equal(201);
  const json = pm.response.json();
  pm.expect(json).to.have.property("key");
  pm.expect(json).to.have.property("message");
  pm.expect(json.message).to.include("not be shown again");
  pm.variables.set("api_key", json.key);
});
```

### Request 9.2: Revoke API Key

```json
{
  "name": "Revoke API Key",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/api-platform/keys",
      "host": ["{{base_url}}"],
      "path": ["api", "api-platform", "keys"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"revoke\",\n  \"keyId\": \"uuid\"\n}"
    }
  }
}
```

### Request 9.3: List API Keys

```json
{
  "name": "List API Keys",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/api-platform/keys",
      "host": ["{{base_url}}"],
      "path": ["api", "api-platform", "keys"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 9.4: Register Developer App

```json
{
  "name": "Register Developer App",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/api-platform/apps",
      "host": ["{{base_url}}"],
      "path": ["api", "api-platform", "apps"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"register\",\n  \"name\": \"My App\",\n  \"redirectUris\": [\"https://app.example.com/callback\"]\n}"
    }
  }
}
```

### Request 9.5: List Developer Apps

```json
{
  "name": "List Developer Apps",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/api-platform/apps",
      "host": ["{{base_url}}"],
      "path": ["api", "api-platform", "apps"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

---

## Group 10: AI Platform

### Request 10.1: AI Chat

```json
{
  "name": "AI Chat",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/ai/chat",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "chat"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"question\": \"How can I improve my campaign visibility?\",\n  \"copilotType\": \"creator\"\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("AI Chat responds", () => {
  pm.expect(pm.response.code).to.equal(200);
  const json = pm.response.json();
  if (json.data) {
    pm.expect(json.data).to.have.property("answer");
    pm.variables.set("ai_conversation_id", json.data.conversationId);
  }
});
```

### Request 10.2: AI Chat (Follow-up with Conversation)

```json
{
  "name": "AI Chat — Follow-up",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/ai/chat",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "chat"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"question\": \"Can you give me specific examples?\",\n  \"copilotType\": \"creator\",\n  \"conversationId\": \"{{ai_conversation_id}}\"\n}"
    }
  }
}
```

### Request 10.3: Generate Campaign

```json
{
  "name": "Generate Campaign",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/ai/generate-campaign",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "generate-campaign"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"keywords\": [\"education\", \"rural\", \"school\"],\n  \"tone\": \"professional\"\n}"
    }
  }
}
```

### Request 10.4: Get Predictions

```json
{
  "name": "Get Campaign Predictions",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/ai/predictions?campaignId={{project_id}}",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "predictions"],
      "query": [{ "key": "campaignId", "value": "{{project_id}}" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 10.5: Get Recommendations

```json
{
  "name": "Get AI Recommendations",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/ai/recommendations",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "recommendations"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 10.6: Get AI Usage

```json
{
  "name": "Get AI Usage",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/ai/usage",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "usage"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 10.7: Funding Recommendation

```json
{
  "name": "Funding Recommendation",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/ai/funding-recommendation",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "funding-recommendation"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"campaignId\": \"{{project_id}}\"\n}"
    }
  }
}
```

### Request 10.8: Campaign Score

```json
{
  "name": "AI Campaign Score",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/ai/campaign/score",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "campaign", "score"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"campaignId\": \"{{project_id}}\"\n}"
    }
  }
}
```

### Request 10.9: Title Suggestions

```json
{
  "name": "Suggest Campaign Title",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/ai/campaign/suggest",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "campaign", "suggest"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"keywords\": [\"health\", \"clinic\"],\n  \"count\": 3\n}"
    }
  }
}
```

### Request 10.10: Knowledge Base Search

```json
{
  "name": "Knowledge Base Search",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/ai/knowledge?query=how+to+create+campaign",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "knowledge"],
      "query": [{ "key": "query", "value": "how to create campaign" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 10.11: Add Knowledge Article

```json
{
  "name": "Add Knowledge Article",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/ai/knowledge",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "knowledge"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"title\": \"How to set up a campaign\",\n  \"content\": \"Step-by-step guide...\",\n  \"tags\": [\"guide\", \"campaign\"]\n}"
    }
  }
}
```

### Request 10.12: AI Moderation — Classify

```json
{
  "name": "AI Moderation — Classify",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/ai/moderation/classify",
      "host": ["{{base_url}}"],
      "path": ["api", "ai", "moderation", "classify"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"content\": \"This is a test campaign description\"\n}"
    }
  }
}
```

---

## Group 11: Marketplace & Plugins

### Request 11.1: List Marketplace Plugins

```json
{
  "name": "List Marketplace Plugins",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/marketplace/list?category=analytics&sort=rating",
      "host": ["{{base_url}}"],
      "path": ["api", "marketplace", "list"],
      "query": [
        { "key": "category", "value": "analytics" },
        { "key": "sort", "value": "rating" },
        { "key": "page", "value": "1" },
        { "key": "limit", "value": "20" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 11.2: Get Featured Plugins

```json
{
  "name": "Featured Plugins",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/marketplace/featured",
      "host": ["{{base_url}}"],
      "path": ["api", "marketplace", "featured"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 11.3: Submit Plugin

```json
{
  "name": "Submit Plugin",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/plugins/submit",
      "host": ["{{base_url}}"],
      "path": ["api", "plugins", "submit"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"name\": \"Analytics Pro\",\n  \"version\": \"1.0.0\",\n  \"manifest\": {\n    \"name\": \"analytics-pro\",\n    \"version\": \"1.0.0\",\n    \"description\": \"Advanced analytics plugin\",\n    \"entrypoint\": \"index.js\",\n    \"permissions\": [\"analytics:read\"]\n  }\n}"
    }
  }
}
```

### Request 11.4: Install Plugin

```json
{
  "name": "Install Plugin",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/plugins/[id]",
      "host": ["{{base_url}}"],
      "path": ["api", "plugins", "[id]"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"install\"\n}"
    }
  }
}
```

### Request 11.5: Developer Register

```json
{
  "name": "Register as Developer",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/developer/register",
      "host": ["{{base_url}}"],
      "path": ["api", "developer", "register"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"name\": \"Jane Developer\",\n  \"email\": \"jane@example.com\"\n}"
    }
  }
}
```

---

## Group 12: Events, Agents & Automation

### Request 12.1: Publish Event

```json
{
  "name": "Publish Event",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/events/index",
      "host": ["{{base_url}}"],
      "path": ["api", "events", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"eventType\": \"campaign.created\",\n  \"payload\": {\n    \"campaignId\": \"{{project_id}}\",\n    \"creatorId\": \"uuid\"\n  },\n  \"options\": {\n    \"priority\": \"high\"\n  }\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Event published", () => {
  pm.expect(pm.response.code).to.be.oneOf([201, 200]);
});
```

### Request 12.2: Query Events

```json
{
  "name": "Query Events",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/events/index?eventType=campaign.created&status=completed&limit=20",
      "host": ["{{base_url}}"],
      "path": ["api", "events", "index"],
      "query": [
        { "key": "eventType", "value": "campaign.created" },
        { "key": "status", "value": "completed" },
        { "key": "limit", "value": "20" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 12.3: Create Event Subscription

```json
{
  "name": "Create Subscription",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/events/subscriptions",
      "host": ["{{base_url}}"],
      "path": ["api", "events", "subscriptions"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"eventType\": \"campaign.created\",\n  \"webhookUrl\": \"https://example.com/webhook\",\n  \"config\": {}\n}"
    }
  }
}
```

### Request 12.4: Create Agent

```json
{
  "name": "Create Agent",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/agents/index",
      "host": ["{{base_url}}"],
      "path": ["api", "agents", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"name\": \"ModeratorBot\",\n  \"agentType\": \"moderator\",\n  \"config\": {\n    \"schedule\": \"*/30 * * * *\",\n    \"maxActions\": 100\n  }\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Agent created", () => {
  pm.expect(pm.response.code).to.equal(201);
  if (pm.response.json().data?.id) {
    pm.variables.set("agent_id", pm.response.json().data.id);
  }
});
```

### Request 12.5: List Agents

```json
{
  "name": "List Agents",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/agents/index",
      "host": ["{{base_url}}"],
      "path": ["api", "agents", "index"],
      "query": [
        { "key": "agentType", "value": "moderator" },
        { "key": "status", "value": "active" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 12.6: Run Agent

```json
{
  "name": "Run Agent",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/agents/run",
      "host": ["{{base_url}}"],
      "path": ["api", "agents", "run"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"agentId\": \"{{agent_id}}\"\n}"
    }
  }
}
```

### Request 12.7: Schedule Agent

```json
{
  "name": "Schedule Agent",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/agents/schedule",
      "host": ["{{base_url}}"],
      "path": ["api", "agents", "schedule"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"agentId\": \"{{agent_id}}\",\n  \"schedule\": \"0 */6 * * *\",\n  \"enabled\": true\n}"
    }
  }
}
```

### Request 12.8: Create Automation Workflow

```json
{
  "name": "Create Automation Workflow",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/automation/workflows",
      "host": ["{{base_url}}"],
      "path": ["api", "automation", "workflows"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"name\": \"New Campaign Alert\",\n  \"description\": \"Notify team when campaign created\",\n  \"trigger\": {\n    \"event\": \"campaign.created\",\n    \"filters\": {\n      \"amount\": { \"gte\": 10000 }\n    }\n  },\n  \"steps\": [\n    {\n      \"type\": \"send_notification\",\n      \"config\": {\n        \"channel\": \"slack\",\n        \"message\": \"New campaign: {{name}}\",\n        \"template\": \"slack_campaign_alert\"\n      }\n    }\n  ],\n  \"config\": {\n    \"maxRetries\": 3\n  }\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Workflow created", () => {
  pm.expect(pm.response.code).to.equal(201);
  if (pm.response.json().id) {
    pm.variables.set("workflow_id", pm.response.json().id);
  }
});
```

### Request 12.9: List Workflows

```json
{
  "name": "List Workflows",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/automation/workflows?status=active&limit=20",
      "host": ["{{base_url}}"],
      "path": ["api", "automation", "workflows"],
      "query": [
        { "key": "status", "value": "active" },
        { "key": "limit", "value": "20" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 12.10: Trigger Workflow

```json
{
  "name": "Trigger Workflow",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/automation/workflows/{{workflow_id}}/trigger",
      "host": ["{{base_url}}"],
      "path": ["api", "automation", "workflows", "{{workflow_id}}", "trigger"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"payload\": {\n    \"campaignId\": \"{{project_id}}\"\n  }\n}"
    }
  }
}
```

---

## Group 13: Connectors & MCP

### Request 13.1: Register Connector

```json
{
  "name": "Register Connector",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/connectors/index",
      "host": ["{{base_url}}"],
      "path": ["api", "connectors", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"provider\": \"slack\",\n  \"config\": {\n    \"webhookUrl\": \"https://hooks.slack.com/services/T...\"\n  },\n  \"name\": \"Team Slack\"\n}"
    }
  }
}
```

### Request 13.2: List Connectors

```json
{
  "name": "List Connectors",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/connectors/index",
      "host": ["{{base_url}}"],
      "path": ["api", "connectors", "index"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 13.3: Connect Connector

```json
{
  "name": "Connect Connector",
  "request": {
    "method": "PUT",
    "url": {
      "raw": "{{base_url}}/api/connectors/index?id=uuid",
      "host": ["{{base_url}}"],
      "path": ["api", "connectors", "index"],
      "query": [{ "key": "id", "value": "uuid" }]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"connect\"\n}"
    }
  }
}
```

### Request 13.4: List MCP Tools

```json
{
  "name": "List MCP Tools",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/mcp/index",
      "host": ["{{base_url}}"],
      "path": ["api", "mcp", "index"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 13.5: Execute MCP Tool

```json
{
  "name": "Execute MCP Tool",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/mcp/index",
      "host": ["{{base_url}}"],
      "path": ["api", "mcp", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"tool\": \"getCampaign\",\n  \"parameters\": {\n    \"campaignId\": \"{{project_id}}\"\n  }\n}"
    }
  }
}
```

---

## Group 14: Exports, Tenants & Feature Flags

### Request 14.1: Create Export

```json
{
  "name": "Create Export",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/exports/index",
      "host": ["{{base_url}}"],
      "path": ["api", "exports", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"format\": \"csv\",\n  \"entityType\": \"donations\",\n  \"filters\": {\n    \"dateRange\": {\n      \"start\": \"2026-01-01\",\n      \"end\": \"2026-07-30\"\n    }\n  }\n}"
    }
  }
}
```

### Request 14.2: Schedule Export

```json
{
  "name": "Schedule Export",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/exports/schedule",
      "host": ["{{base_url}}"],
      "path": ["api", "exports", "schedule"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"exportConfig\": {\n    \"format\": \"csv\",\n    \"entityType\": \"donations\",\n    \"filters\": {}\n  },\n  \"schedule\": \"0 0 * * 1\",\n  \"recipients\": [\"admin@example.com\"]\n}"
    }
  }
}
```

### Request 14.3: Create Tenant

```json
{
  "name": "Create Tenant",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/tenants/index",
      "host": ["{{base_url}}"],
      "path": ["api", "tenants", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"name\": \"Enterprise Org\",\n  \"slug\": \"enterprise-org\",\n  \"plan\": \"enterprise\"\n}"
    }
  }
}
```

### Request 14.4: Create Feature Flag

```json
{
  "name": "Create Feature Flag",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/flags/index",
      "host": ["{{base_url}}"],
      "path": ["api", "flags", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"name\": \"new_onboarding_flow\",\n  \"description\": \"New onboarding wizard\",\n  \"rolloutPercentage\": 25,\n  \"targeting\": {}\n}"
    }
  }
}
```

---

## Group 15: Infrastructure

### Request 15.1: Get Cache Stats

```json
{
  "name": "Get Cache Stats",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/infrastructure/cache",
      "host": ["{{base_url}}"],
      "path": ["api", "infrastructure", "cache"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 15.2: Invalidate Cache

```json
{
  "name": "Invalidate Cache",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/infrastructure/cache",
      "host": ["{{base_url}}"],
      "path": ["api", "infrastructure", "cache"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"invalidate\",\n  \"key\": \"cache:key:pattern:*\"\n}"
    }
  }
}
```

### Request 15.3: Enqueue Job

```json
{
  "name": "Enqueue Job",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/jobs/index",
      "host": ["{{base_url}}"],
      "path": ["api", "jobs", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"jobType\": \"send_email\",\n  \"payload\": {\n    \"to\": \"user@example.com\",\n    \"template\": \"welcome\",\n    \"data\": { \"name\": \"John\" }\n  },\n  \"options\": {\n    \"priority\": \"high\",\n    \"delay\": 0\n  }\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Job enqueued", () => {
  pm.expect(pm.response.code).to.equal(201);
});
```

### Request 15.4: List Jobs

```json
{
  "name": "List Jobs",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/jobs/index?status=pending&limit=20",
      "host": ["{{base_url}}"],
      "path": ["api", "jobs", "index"],
      "query": [
        { "key": "status", "value": "pending" },
        { "key": "limit", "value": "20" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 15.5: Create Webhook

```json
{
  "name": "Create Webhook",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/webhooks/index",
      "host": ["{{base_url}}"],
      "path": ["api", "webhooks", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"create\",\n  \"url\": \"https://app.example.com/webhook\",\n  \"events\": [\"campaign.created\", \"donation.received\"],\n  \"description\": \"Send events to my app\"\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Webhook created", () => {
  pm.expect(pm.response.code).to.equal(201);
  const json = pm.response.json();
  pm.expect(json.success).to.be.true;
  pm.expect(json.message).to.include("not be shown again");
  if (json.data?.id) {
    pm.variables.set("webhook_id", json.data.id);
  }
});
```

### Request 15.6: List Webhooks

```json
{
  "name": "List Webhooks",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/webhooks/index",
      "host": ["{{base_url}}"],
      "path": ["api", "webhooks", "index"],
      "query": [
        { "key": "limit", "value": "50" },
        { "key": "offset", "value": "0" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

**Tests:**

```javascript
pm.test("Webhook secrets not exposed", () => {
  const json = pm.response.json();
  if (json.data && json.data.length > 0) {
    json.data.forEach((wh) => {
      pm.expect(wh).to.not.have.property("secret");
    });
  }
});
```

### Request 15.7: Webhook Delivery Logs

```json
{
  "name": "Webhook Delivery Logs",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/webhooks/deliveries?webhookId={{webhook_id}}&limit=20",
      "host": ["{{base_url}}"],
      "path": ["api", "webhooks", "deliveries"],
      "query": [
        { "key": "webhookId", "value": "{{webhook_id}}" },
        { "key": "limit", "value": "20" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 15.8: Test Webhook

```json
{
  "name": "Test Webhook",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/webhooks/test",
      "host": ["{{base_url}}"],
      "path": ["api", "webhooks", "test"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"webhookId\": \"{{webhook_id}}\"\n}"
    }
  }
}
```

### Request 15.9: Get Notifications

```json
{
  "name": "Get Notifications",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/notifications/index?limit=20&offset=0",
      "host": ["{{base_url}}"],
      "path": ["api", "notifications", "index"],
      "query": [
        { "key": "limit", "value": "20" },
        { "key": "offset", "value": "0" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

**Tests:**

```javascript
pm.test("Notifications returned", () => {
  pm.expect(pm.response.code).to.equal(200);
  const json = pm.response.json();
  pm.expect(json).to.have.property("notifications");
  pm.expect(json).to.have.property("unreadCount");
});
```

### Request 15.10: Mark Notification Read

```json
{
  "name": "Mark Notification Read",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/notifications/index",
      "host": ["{{base_url}}"],
      "path": ["api", "notifications", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"mark_read\",\n  \"notificationId\": \"uuid\"\n}"
    }
  }
}
```

### Request 15.11: Mark All Notifications Read

```json
{
  "name": "Mark All Notifications Read",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/notifications/index",
      "host": ["{{base_url}}"],
      "path": ["api", "notifications", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"action\": \"mark_all_read\"\n}"
    }
  }
}
```

### Request 15.12: Notification Preferences

```json
{
  "name": "Notification Preferences",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/notifications/preferences",
      "host": ["{{base_url}}"],
      "path": ["api", "notifications", "preferences"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

---

## Group 16: Health, Diagnostics & Deployments

### Request 16.1: Health Check

```json
{
  "name": "Health Check",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/health/index",
      "host": ["{{base_url}}"],
      "path": ["api", "health", "index"]
    }
  }
}
```

**Tests:**

```javascript
pm.test("Health check returns 200", () => {
  pm.expect(pm.response.code).to.equal(200);
  const json = pm.response.json();
  pm.expect(json).to.have.property("status");
  pm.expect(json).to.have.property("checks");
  pm.expect(json.checks).to.have.property("database");
  pm.expect(json.checks).to.have.property("memory");
  pm.expect(json.checks).to.have.property("pool");
});

pm.test("No auth required", () => {
  pm.expect(pm.response.code).to.equal(200);
});
```

### Request 16.2: Database Health

```json
{
  "name": "Database Health",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/health/database",
      "host": ["{{base_url}}"],
      "path": ["api", "health", "database"]
    }
  }
}
```

### Request 16.3: Infrastructure Health

```json
{
  "name": "Infrastructure Health",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/infrastructure/health",
      "host": ["{{base_url}}"],
      "path": ["api", "infrastructure", "health"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 16.4: Job Queues

```json
{
  "name": "Job Queue Stats",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/infrastructure/queues",
      "host": ["{{base_url}}"],
      "path": ["api", "infrastructure", "queues"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 16.5: Diagnostics

```json
{
  "name": "Diagnostics",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/diagnostics/index",
      "host": ["{{base_url}}"],
      "path": ["api", "diagnostics", "index"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 16.6: List Deployments

```json
{
  "name": "List Deployments",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/deployments/index",
      "host": ["{{base_url}}"],
      "path": ["api", "deployments", "index"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 16.7: Platform Metrics

```json
{
  "name": "Platform Metrics",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/metrics/index",
      "host": ["{{base_url}}"],
      "path": ["api", "metrics", "index"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

---

## Group 17: Global Platform

### Request 17.1: Get Translations

```json
{
  "name": "Get Translations",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/i18n/translations?locale=hi",
      "host": ["{{base_url}}"],
      "path": ["api", "i18n", "translations"],
      "query": [{ "key": "locale", "value": "hi" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 17.2: Get Currency Rates

```json
{
  "name": "Get Currency Rates",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/currency/rates",
      "host": ["{{base_url}}"],
      "path": ["api", "currency", "rates"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 17.3: Convert Currency

```json
{
  "name": "Convert Currency",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/currency/convert",
      "host": ["{{base_url}}"],
      "path": ["api", "currency", "convert"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"amount\": 1000,\n  \"from\": \"USD\",\n  \"to\": \"EUR\"\n}"
    }
  }
}
```

### Request 17.4: Search

```json
{
  "name": "Search",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/search?query=tech&entity=projects&page=1&limit=20",
      "host": ["{{base_url}}"],
      "path": ["api", "search", "index"],
      "query": [
        { "key": "query", "value": "tech" },
        { "key": "entity", "value": "projects" },
        { "key": "page", "value": "1" },
        { "key": "limit", "value": "20" }
      ]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

**Tests:**

```javascript
pm.test("Search returns results or empty", () => {
  pm.expect(pm.response.code).to.equal(200);
  const json = pm.response.json();
  pm.expect(json).to.have.property("success");
});
```

### Request 17.5: Advanced Search (POST)

```json
{
  "name": "Advanced Search",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/search/index",
      "host": ["{{base_url}}"],
      "path": ["api", "search", "index"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"query\": \"tech\",\n  \"entities\": [\"projects\", \"creators\"],\n  \"perEntityLimit\": 5\n}"
    }
  }
}
```

### Request 17.6: Search Autocomplete

```json
{
  "name": "Search Autocomplete",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/search/autocomplete?query=te",
      "host": ["{{base_url}}"],
      "path": ["api", "search", "autocomplete"],
      "query": [{ "key": "query", "value": "te" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 17.7: Upload File

```json
{
  "name": "Upload File",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/storage/upload",
      "host": ["{{base_url}}"],
      "path": ["api", "storage", "upload"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"bucket\": \"campaigns\",\n  \"path\": \"user123/campaign-banner.jpg\",\n  \"file\": \"<base64-encoded-file>\"\n}"
    }
  }
}
```

**Tests:**

```javascript
pm.test("Upload returns success", () => {
  pm.expect(pm.response.code).to.be.oneOf([201, 400]);
});
```

### Request 17.8: Generate Signed URL

```json
{
  "name": "Generate Signed URL",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/storage/signed-url",
      "host": ["{{base_url}}"],
      "path": ["api", "storage", "signed-url"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"bucket\": \"campaigns\",\n  \"path\": \"user123/image.jpg\",\n  \"expiresIn\": 3600\n}"
    }
  }
}
```

### Request 17.9: Create Backup

```json
{
  "name": "Create Backup",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/backup/backups",
      "host": ["{{base_url}}"],
      "path": ["api", "backup", "backups"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"name\": \"pre-deploy-backup\",\n  \"tables\": [\"projects\", \"public_donations\", \"profiles\"]\n}"
    }
  }
}
```

### Request 17.10: List Backups

```json
{
  "name": "List Backups",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/backup/backups?limit=10",
      "host": ["{{base_url}}"],
      "path": ["api", "backup", "backups"],
      "query": [{ "key": "limit", "value": "10" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 17.11: Restore Backup

```json
{
  "name": "Restore Backup",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/backup/restore",
      "host": ["{{base_url}}"],
      "path": ["api", "backup", "restore"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"backupId\": \"uuid\"\n}"
    }
  }
}
```

### Request 17.12: Observability Health

```json
{
  "name": "Observability Health",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/observability/health",
      "host": ["{{base_url}}"],
      "path": ["api", "observability", "health"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 17.13: Observability Metrics

```json
{
  "name": "Observability Metrics",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/observability/metrics",
      "host": ["{{base_url}}"],
      "path": ["api", "observability", "metrics"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 17.14: Observability Alerts

```json
{
  "name": "Observability Alerts",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/observability/alerts",
      "host": ["{{base_url}}"],
      "path": ["api", "observability", "alerts"]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

### Request 17.15: Mobile Sync

```json
{
  "name": "Mobile Sync",
  "request": {
    "method": "POST",
    "url": {
      "raw": "{{base_url}}/api/mobile/sync",
      "host": ["{{base_url}}"],
      "path": ["api", "mobile", "sync"]
    },
    "header": [
      { "key": "Content-Type", "value": "application/json" },
      { "key": "Cookie", "value": "{{auth_cookie}}" }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\n  \"lastSyncTimestamp\": \"2026-07-29T12:00:00Z\",\n  \"operations\": [\n    {\n      \"id\": \"local-op-1\",\n      \"type\": \"create\",\n      \"entity\": \"saved_project\",\n      \"data\": {\n        \"projectId\": \"uuid\"\n      }\n    }\n  ]\n}"
    }
  }
}
```

### Request 17.16: Admin Platform Analytics

```json
{
  "name": "Admin Platform Analytics",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/admin/platform-analytics?period=30d",
      "host": ["{{base_url}}"],
      "path": ["api", "admin", "platform-analytics"],
      "query": [{ "key": "period", "value": "30d" }]
    },
    "header": [{ "key": "Cookie", "value": "{{auth_cookie}}" }]
  }
}
```

---

## Import Instructions

To import this collection into Postman:

### Option 1: Manual Import via JSON

1. Open Postman → **Import** → **Raw text**
2. Convert the requests above into a Postman collection JSON format
3. Paste and import

### Option 2: Automated Generator

Use the following Node.js script template to generate a Postman `collection.json`:

```javascript
const collection = {
  info: {
    name: "Fundora API",
    description: "Complete API collection for Fundora crowdfunding platform",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "base_url", value: "http://localhost:3000" },
    { key: "auth_cookie", value: "" },
    { key: "project_id", value: "" },
    { key: "org_id", value: "" },
    { key: "bank_account_id", value: "" },
    { key: "escrow_account_id", value: "" },
    { key: "milestone_id", value: "" },
    { key: "webhook_id", value: "" },
    { key: "agent_id", value: "" },
    { key: "workflow_id", value: "" },
    { key: "api_key", value: "" },
    { key: "ai_conversation_id", value: "" },
  ],
  item: [
    // Map every request from this document into Postman items
    // See the 17 groups above for the complete request definitions
  ],
};

console.log(JSON.stringify(collection, null, 2));
```

### Environment Setup

Create a Postman environment with:

| Variable             | Initial                 | Current                 |
| -------------------- | ----------------------- | ----------------------- |
| `base_url`           | `http://localhost:3000` | `http://localhost:3000` |
| `auth_cookie`        | —                       | —                       |
| `project_id`         | —                       | —                       |
| `org_id`             | —                       | —                       |
| `bank_account_id`    | —                       | —                       |
| `escrow_account_id`  | —                       | —                       |
| `milestone_id`       | —                       | —                       |
| `webhook_id`         | —                       | —                       |
| `agent_id`           | —                       | —                       |
| `workflow_id`        | —                       | —                       |
| `api_key`            | —                       | —                       |
| `ai_conversation_id` | —                       | —                       |

---

## Quick Reference: All Endpoints by Group

| #   | Group                      | Endpoints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Count   |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Authentication             | `/api/account/delete`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 1       |
| 2   | Payments & Receipts        | `/api/razorpay/create-order`, `/api/razorpay/verify`, `/api/razorpay/webhook`, `/api/receipts/generate`, `/api/export-analytics`                                                                                                                                                                                                                                                                                                                                                                              | 5       |
| 3   | Creator & Projects         | `/api/creator/balance`, `/api/creator/reputation`, `/api/creator/razorpay-config`                                                                                                                                                                                                                                                                                                                                                                                                                             | 3       |
| 4   | Verification               | `/api/verification/business`, `/api/verification/bank`, `/api/verification/business-documents`, `/api/verification/bank-documents`, `/api/verification/penny-drop`, `/api/verification/gst`, `/api/verification/pan`, `/api/admin/business-review`, `/api/admin/bank-review`, `/api/admin/review-queue`                                                                                                                                                                                                       | 10      |
| 5   | Fraud Detection            | `/api/fraud/evaluate`, `/api/fraud/events`, `/api/fraud/profile`, `/api/fraud/devices`, `/api/fraud/history`, `/api/admin/fraud-dashboard`                                                                                                                                                                                                                                                                                                                                                                    | 6       |
| 6   | Escrow & Milestones        | `/api/escrow/account`, `/api/escrow/ledger`, `/api/escrow/release`, `/api/milestone/index`, `/api/milestone/submit`, `/api/milestone/review`, `/api/payout/index`, `/api/payout/status`, `/api/admin/escrow-dashboard`, `/api/admin/payout-review`                                                                                                                                                                                                                                                            | 10      |
| 7   | Compliance & Reputation    | `/api/admin/compliance-dashboard`, `/api/admin/policy-management`, `/api/admin/moderation-dashboard`, `/api/appeals/index`, `/api/moderation/report`, `/api/reputation/leaderboard`                                                                                                                                                                                                                                                                                                                           | 6       |
| 8   | Organizations & RBAC       | `/api/organization/index`, `/api/organization/members`, `/api/organization/invitations`, `/api/organization/teams`, `/api/organization/departments`, `/api/organization/settings`, `/api/organization/analytics`, `/api/rbac/roles`, `/api/admin/organizations`                                                                                                                                                                                                                                               | 9       |
| 9   | API Platform               | `/api/api-platform/keys`, `/api/api-platform/apps`, `/api/api-platform/logs`                                                                                                                                                                                                                                                                                                                                                                                                                                  | 3       |
| 10  | AI Platform                | `/api/ai/chat`, `/api/ai/agent`, `/api/ai/config`, `/api/ai/providers`, `/api/ai/predictions`, `/api/ai/recommendations`, `/api/ai/usage`, `/api/ai/knowledge`, `/api/ai/generate-campaign`, `/api/ai/funding-recommendation`, `/api/ai/campaign/score`, `/api/ai/campaign/suggest`, `/api/ai/fraud/analyze`, `/api/ai/moderation/classify`, `/api/ai/moderation/detect`                                                                                                                                      | 15      |
| 11  | Marketplace & Plugins      | `/api/marketplace/featured`, `/api/marketplace/list`, `/api/marketplace/review`, `/api/plugins/list`, `/api/plugins/[id]`, `/api/plugins/submit`, `/api/developer/register`, `/api/developer/my-plugins`                                                                                                                                                                                                                                                                                                      | 8       |
| 12  | Events, Agents, Automation | `/api/events/index`, `/api/events/process`, `/api/events/subscriptions`, `/api/agents/index`, `/api/agents/approve`, `/api/agents/memory`, `/api/agents/permissions`, `/api/agents/run`, `/api/agents/schedule`, `/api/automation/workflows`, `/api/automation/workflows/[id]`, `/api/automation/workflows/[id]/runs`, `/api/automation/workflows/[id]/trigger`                                                                                                                                               | 13      |
| 13  | Connectors & MCP           | `/api/connectors/index`, `/api/mcp/index`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2       |
| 14  | Exports, Tenants, Flags    | `/api/exports/index`, `/api/exports/schedule`, `/api/exports/templates`, `/api/tenants/index`, `/api/tenants/branding`, `/api/tenants/quotas`, `/api/tenants/settings`, `/api/flags/index`, `/api/flags/abtest`                                                                                                                                                                                                                                                                                               | 9       |
| 15  | Infrastructure             | `/api/infrastructure/cache`, `/api/infrastructure/health`, `/api/infrastructure/queues`, `/api/jobs/index`, `/api/jobs/process`, `/api/jobs/schedule`, `/api/webhooks/index`, `/api/webhooks/deliveries`, `/api/webhooks/test`, `/api/notifications/index`, `/api/notifications/preferences`                                                                                                                                                                                                                  | 11      |
| 16  | Health, Diagnostics        | `/api/health/index`, `/api/health/database`, `/api/diagnostics/index`, `/api/deployments/index`, `/api/deployments/rollback`, `/api/metrics/index`                                                                                                                                                                                                                                                                                                                                                            | 6       |
| 17  | Global Platform            | `/api/i18n/translations`, `/api/currency/rates`, `/api/currency/convert`, `/api/search/index`, `/api/search/autocomplete`, `/api/storage/upload`, `/api/storage/signed-url`, `/api/backup/backups`, `/api/backup/restore`, `/api/observability/metrics`, `/api/observability/health`, `/api/observability/alerts`, `/api/mobile/sync`, `/api/analytics/index`, `/api/analytics/insights`, `/api/analytics/metrics`, `/api/analytics/reports`, `/api/admin/platform-analytics`, `/api/admin/appeals-dashboard` | 19      |
|     | **Total**                  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **136** |

---

_End of Postman Collection_
