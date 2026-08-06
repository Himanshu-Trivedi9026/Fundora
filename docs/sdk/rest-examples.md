# Fundora REST API — curl Examples

> Complete REST API reference with curl examples for every endpoint.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Responses](#error-responses)
- [Pagination](#pagination)
- [API Key Management](#api-key-management)
- [Developer Apps](#developer-apps)
- [Webhooks](#webhooks)
- [Webhook Delivery & Retry](#webhook-delivery--retry)
- [API Usage Logs](#api-usage-logs)
- [Webhook Payload Examples](#webhook-payload-examples)
- [HMAC Signature Verification](#hmac-signature-verification)

---

## Base URL

```
https://api.fundora.in
```

All endpoints are relative to this base URL.

---

## Authentication

Every request must include the `X-API-Key` header:

```bash
curl -H "X-API-Key: fk_a1b2c3d4_e5f67890..." \
     https://api.fundora.in/api/campaigns
```

### API Key Format

```
fk_{prefix}_{body}
```

- **prefix**: 8-character hex string
- **body**: 64-character hex string
- **Total**: 75 characters

---

## Rate Limiting

Every response includes rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1705320000
```

When rate limited (HTTP 429):

```bash
$ curl -s -w "\nHTTP Status: %{http_code}\n" \
    -H "X-API-Key: fk_..." \
    https://api.fundora.in/api/campaigns

{
  "error": "Too many requests",
  "retryAfter": 42
}
HTTP Status: 429
```

The `Retry-After` header is also returned.

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Description of what went wrong"
}
```

### Error Status Codes

| Status | Meaning            | Example                                                                 |
| ------ | ------------------ | ----------------------------------------------------------------------- |
| `400`  | Bad Request        | `"name is required"`, `"url is required"`, `"Invalid action"`           |
| `401`  | Unauthorized       | `"API key required (X-API-Key header)"`, `"Invalid or revoked API key"` |
| `405`  | Method Not Allowed | `"Method not allowed"`                                                  |
| `429`  | Rate Limited       | `"Too many requests"` with `retryAfter` field                           |
| `500`  | Server Error       | `"Internal server error"`, `"Failed to fetch API keys"`                 |

---

## Pagination

All list endpoints support pagination via `limit` and `offset` query parameters:

```
GET /api/campaigns?limit=20&offset=0
```

Response includes a `total` field:

```json
{
  "success": true,
  "data": [...],
  "total": 142
}
```

**Defaults:** `limit = 50`, `offset = 0`

---

## API Key Management

### List API Keys

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/api-platform/keys"
```

Filter by status:

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/api-platform/keys?status=active"
```

Filter by organization:

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/api-platform/keys?organizationId=uuid&limit=10"
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Production Key",
      "key_prefix": "a1b2c3d4",
      "scopes": ["campaigns:read"],
      "rate_limit": 100,
      "rate_window_ms": 60000,
      "status": "active",
      "user_id": "user-uuid",
      "organization_id": null,
      "expires_at": null,
      "last_used_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-10T08:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

> **Note**: The `key_hash` field is stripped from responses for security.

### Create an API Key

```bash
curl -X POST \
     -H "X-API-Key: fk_..." \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create",
       "name": "CI/CD Pipeline Key",
       "scopes": ["campaigns:read", "donations:write"],
       "rateLimit": 200,
       "rateWindowMs": 60000,
       "expiresAt": "2025-12-31T23:59:59Z"
     }' \
     https://api.fundora.in/api/api-platform/keys
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "key": "fk_a1b2c3d4_e5f6789012345678abcdef0123456789abcdef0123456789abcdef0123456789",
    "name": "CI/CD Pipeline Key",
    "key_prefix": "a1b2c3d4",
    "scopes": ["campaigns:read", "donations:write"],
    "rate_limit": 200,
    "rate_window_ms": 60000,
    "status": "active",
    "user_id": "user-uuid",
    "organization_id": null,
    "expires_at": "2025-12-31T23:59:59Z",
    "last_used_at": null,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "metadata": {}
  },
  "message": "Store this API key securely — it will not be shown again"
}
```

> **Important**: The plaintext `key` is only returned on creation. Store it immediately.

### Revoke an API Key

```bash
curl -X POST \
     -H "X-API-Key: fk_..." \
     -H "Content-Type: application/json" \
     -d '{
       "action": "revoke",
       "keyId": "550e8400-e29b-41d4-a716-446655440000"
     }' \
     https://api.fundora.in/api/api-platform/keys
```

**Response (200):**

```json
{
  "success": true
}
```

---

## Developer Apps

### List Developer Apps

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/api-platform/apps"
```

### Create a Developer App

```bash
curl -X POST \
     -H "X-API-Key: fk_..." \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create",
       "name": "My Mobile App",
       "description": "OAuth integration for iOS and Android",
       "appType": "mobile",
       "redirectUris": ["myapp://callback"]
     }' \
     https://api.fundora.in/api/api-platform/apps
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "app-uuid",
    "client_id": "e5f67890abcdef1234567890abcdef12",
    "client_secret": "fks_abc123def456...",
    "name": "My Mobile App",
    "description": "OAuth integration for iOS and Android",
    "app_type": "mobile",
    "redirect_uris": ["myapp://callback"],
    "status": "active",
    "user_id": "user-uuid",
    "organization_id": null,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "message": "Store the client_secret securely — it will not be shown again"
}
```

### Revoke a Developer App

```bash
curl -X POST \
     -H "X-API-Key: fk_..." \
     -H "Content-Type: application/json" \
     -d '{
       "action": "revoke",
       "appId": "app-uuid"
     }' \
     https://api.fundora.in/api/api-platform/apps
```

---

## Webhooks

### List Available Event Types

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/webhooks?mode=events"
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    { "name": "VERIFICATION_COMPLETED", "value": "verification.completed" },
    { "name": "VERIFICATION_FAILED", "value": "verification.failed" },
    { "name": "DONATION_RECEIVED", "value": "donation.received" },
    { "name": "DONATION_FAILED", "value": "donation.failed" },
    { "name": "ESCROW_FUNDED", "value": "escrow.funded" },
    { "name": "ESCROW_RELEASED", "value": "escrow.released" },
    { "name": "ESCROW_REFUNDED", "value": "escrow.refunded" },
    { "name": "MILESTONE_SUBMITTED", "value": "milestone.submitted" },
    { "name": "MILESTONE_APPROVED", "value": "milestone.approved" },
    { "name": "MILESTONE_REJECTED", "value": "milestone.rejected" },
    { "name": "FRAUD_ALERT", "value": "fraud.alert" },
    { "name": "COMPLIANCE_ALERT", "value": "compliance.alert" },
    { "name": "CAMPAIGN_CREATED", "value": "campaign.created" },
    { "name": "CAMPAIGN_FUNDED", "value": "campaign.funded" },
    { "name": "CAMPAIGN_COMPLETED", "value": "campaign.completed" },
    { "name": "PAYOUT_COMPLETED", "value": "payout.completed" },
    { "name": "MEMBER_ADDED", "value": "member.added" },
    { "name": "MEMBER_REMOVED", "value": "member.removed" }
  ]
}
```

### List Webhooks

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/webhooks?limit=50"
```

Filter by organization:

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/webhooks?organizationId=org-uuid"
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "webhook-uuid",
      "url": "https://myapp.com/webhooks/fundora",
      "events": ["donation.received", "campaign.funded"],
      "status": "active",
      "description": "Production webhook",
      "failure_count": 0,
      "last_triggered_at": "2024-01-15T10:30:00Z",
      "last_success_at": "2024-01-15T10:30:00Z",
      "last_error": null,
      "organization_id": null,
      "user_id": "user-uuid",
      "created_at": "2024-01-10T08:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

> **Note**: The `secret` field is stripped from list responses for security.

### Create a Webhook

```bash
curl -X POST \
     -H "X-API-Key: fk_..." \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create",
       "url": "https://myapp.com/webhooks/fundora",
       "events": ["donation.received", "campaign.funded", "escrow.released"],
       "description": "Production webhook for donation tracking"
     }' \
     https://api.fundora.in/api/webhooks
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "webhook-uuid",
    "url": "https://myapp.com/webhooks/fundora",
    "secret": "whsec_abc123def456...",
    "events": ["donation.received", "campaign.funded", "escrow.released"],
    "status": "active",
    "description": "Production webhook for donation tracking",
    "failure_count": 0,
    "organization_id": null,
    "user_id": "user-uuid",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "message": "Store the webhook secret securely — it will not be shown again"
}
```

> **Important**: The `secret` is only returned at creation time. Store it securely.

### Update a Webhook

```bash
curl -X POST \
     -H "X-API-Key: fk_..." \
     -H "Content-Type: application/json" \
     -d '{
       "action": "update",
       "webhookId": "webhook-uuid",
       "updates": {
         "events": ["donation.received", "campaign.funded", "escrow.released", "milestone.approved"],
         "status": "active"
       }
     }' \
     https://api.fundora.in/api/webhooks
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "webhook-uuid",
    "url": "https://myapp.com/webhooks/fundora",
    "events": [
      "donation.received",
      "campaign.funded",
      "escrow.released",
      "milestone.approved"
    ],
    "status": "active"
  }
}
```

### Delete a Webhook

```bash
curl -X POST \
     -H "X-API-Key: fk_..." \
     -H "Content-Type: application/json" \
     -d '{
       "action": "delete",
       "webhookId": "webhook-uuid"
     }' \
     https://api.fundora.in/api/webhooks
```

**Response (200):**

```json
{
  "success": true
}
```

### Test a Webhook

```bash
curl -X POST \
     -H "X-API-Key: fk_..." \
     -H "Content-Type: application/json" \
     -d '{
       "webhookId": "webhook-uuid"
     }' \
     https://api.fundora.in/api/webhooks/test
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "delivered",
    "statusCode": 200
  }
}
```

---

## Webhook Delivery & Retry

### Get Delivery History

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/webhooks/deliveries?webhookId=webhook-uuid"
```

Filter by status:

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/webhooks/deliveries?webhookId=webhook-uuid&status=failed"
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "delivery-uuid",
      "webhook_id": "webhook-uuid",
      "event_type": "donation.received",
      "payload": {
        "event": "donation.received",
        "timestamp": "2024-01-15T10:30:00Z",
        "data": {
          "donationId": "donation-uuid",
          "amount": 5000,
          "currency": "INR",
          "campaignId": "campaign-uuid"
        }
      },
      "status": "delivered",
      "attempt_count": 1,
      "max_attempts": 5,
      "next_retry_at": null,
      "response_status": 200,
      "response_body": "{\"received\": true}",
      "error_message": null,
      "delivered_at": "2024-01-15T10:30:01Z",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

### Retry a Failed Delivery

```bash
curl -X POST \
     -H "X-API-Key: fk_..." \
     -H "Content-Type: application/json" \
     -d '{
       "action": "retry",
       "deliveryId": "delivery-uuid"
     }' \
     https://api.fundora.in/api/webhooks/deliveries
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "status": "delivered",
    "statusCode": 200
  }
}
```

### Retry Strategy

Failed deliveries are retried with exponential backoff:

| Attempt | Delay      | Cumulative Wait |
| ------- | ---------- | --------------- |
| 1       | 1 minute   | 1 min           |
| 2       | 5 minutes  | 6 min           |
| 3       | 30 minutes | 36 min          |
| 4       | 2 hours    | 2h 36m          |
| 5       | 12 hours   | 14h 36m         |

After `max_attempts` (default 5), the delivery is marked as `failed`.

If a webhook accumulates 10+ failed deliveries, its status is automatically set to `"failed"`.

---

## API Usage Logs

### List Logs

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/api-platform/logs?limit=50"
```

Filter by API key:

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/api-platform/logs?apiKeyId=key-uuid&responseStatus=429"
```

Filter by date range:

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/api-platform/logs?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z"
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid",
      "api_key_id": "key-uuid",
      "user_id": "user-uuid",
      "organization_id": null,
      "method": "GET",
      "path": "/api/campaigns?limit=10",
      "query_params": { "limit": "10" },
      "response_status": 200,
      "response_time_ms": 142,
      "user_agent": "MyApp/1.0",
      "scope_used": null,
      "error_message": null,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 42
}
```

### Usage Summary

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/api-platform/logs?mode=summary"
```

Filter by API key and date range:

```bash
curl -H "X-API-Key: fk_..." \
     "https://api.fundora.in/api/api-platform/logs?mode=summary&apiKeyId=key-uuid&startDate=2024-01-01&endDate=2024-01-31"
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-15",
      "total": 1523,
      "success": 1498,
      "errors": 25
    },
    {
      "date": "2024-01-14",
      "total": 1204,
      "success": 1189,
      "errors": 15
    }
  ]
}
```

---

## Webhook Payload Examples

Webhooks deliver JSON payloads with a standard envelope:

```json
{
  "event": "<event-type>",
  "timestamp": "<ISO 8601>",
  "data": { ... }
}
```

### `verification.completed`

```json
{
  "event": "verification.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "verificationId": "ver-uuid",
    "userId": "user-uuid",
    "type": "pan",
    "status": "verified",
    "verifiedAt": "2024-01-15T10:30:00Z"
  }
}
```

### `donation.received`

```json
{
  "event": "donation.received",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "donationId": "don-uuid",
    "amount": 5000,
    "currency": "INR",
    "campaignId": "camp-uuid",
    "donorEmail": "donor@example.com",
    "paymentId": "pay_abc123"
  }
}
```

### `escrow.funded`

```json
{
  "event": "escrow.funded",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "escrowId": "esc-uuid",
    "campaignId": "camp-uuid",
    "amount": 50000,
    "currency": "INR"
  }
}
```

### `escrow.released`

```json
{
  "event": "escrow.released",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "escrowId": "esc-uuid",
    "campaignId": "camp-uuid",
    "amount": 25000,
    "currency": "INR",
    "milestoneId": "mile-uuid",
    "releasedTo": "user-uuid"
  }
}
```

### `campaign.funded`

```json
{
  "event": "campaign.funded",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "campaignId": "camp-uuid",
    "title": "Clean Water Initiative",
    "goalAmount": 100000,
    "raisedAmount": 100000
  }
}
```

### `milestone.approved`

```json
{
  "event": "milestone.approved",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "milestoneId": "mile-uuid",
    "campaignId": "camp-uuid",
    "title": "Phase 1 Complete",
    "approvedBy": "admin-uuid",
    "amount": 25000
  }
}
```

### `fraud.alert`

```json
{
  "event": "fraud.alert",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "alertId": "alert-uuid",
    "userId": "user-uuid",
    "riskScore": 85,
    "reason": "Multiple rapid donations from same IP"
  }
}
```

### `test.ping`

```json
{
  "event": "test.ping",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "message": "This is a test webhook delivery"
  }
}
```

---

## HMAC Signature Verification

Every webhook delivery includes an `X-Fundora-Signature` header containing an HMAC-SHA256 signature of the payload body.

### Delivery Headers

```
POST /your-webhook-endpoint HTTP/1.1
Host: yourapp.com
Content-Type: application/json
X-Fundora-Signature: a1b2c3d4e5f6...
X-Fundora-Event: donation.received
X-Fundora-Delivery-Id: delivery-uuid
User-Agent: Fundora-Webhook/1.0
```

### Verification Algorithm

1. Receive the raw request body (exact bytes sent by Fundora)
2. Compute `HMAC-SHA256(webhook_secret, raw_body)`
3. Compare the computed hex digest against `X-Fundora-Signature`
4. **Use constant-time comparison** to prevent timing attacks

### curl — Test Signature Verification

```bash
# Generate the expected signature for a known payload
PAYLOAD='{"event":"test.ping","timestamp":"2024-01-15T10:30:00Z","data":{"message":"Test"}}'
SECRET="whsec_abc123..."

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

echo "Expected signature: $SIGNATURE"
```

### Node.js Verification

```javascript
const crypto = require("crypto");

function verifyFundoraSignature(payload, signature, secret) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature || "", "utf8"),
  );
}

// In your Express handler:
app.post("/webhooks/fundora", (req, res) => {
  const signature = req.headers["x-fundora-signature"];

  if (!verifyFundoraSignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Process the event
  res.status(200).json({ received: true });
});
```

### Python Verification

```python
import hmac
import hashlib


def verify_fundora_signature(payload: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8") if isinstance(payload, str) else payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")
```

### Java Verification

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public class WebhookVerifier {
    public static boolean verifySignature(String payload, String signature, String secret)
            throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] expectedBytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));

        StringBuilder sb = new StringBuilder();
        for (byte b : expectedBytes) {
            sb.append(String.format("%02x", b));
        }

        return MessageDigest.isEqual(
            sb.toString().getBytes(StandardCharsets.UTF_8),
            (signature != null ? signature : "").getBytes(StandardCharsets.UTF_8)
        );
    }
}
```

---

## Complete curl Workflow

This example demonstrates a full integration flow: create a webhook, test it, check delivery, and clean up.

```bash
#!/bin/bash
set -euo pipefail

API_KEY="fk_your_api_key_here"
BASE="https://api.fundora.in"

# ─── 1. Create Webhook ───────────────────────────────────────
echo "Creating webhook..."
CREATE_RESPONSE=$(curl -s -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "url": "https://myapp.com/webhooks/fundora",
    "events": ["donation.received", "campaign.funded"],
    "description": "CI test webhook"
  }' \
  "$BASE/api/webhooks")

echo "$CREATE_RESPONSE" | jq .

WEBHOOK_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id')
WEBHOOK_SECRET=$(echo "$CREATE_RESPONSE" | jq -r '.data.secret')

echo "Webhook ID: $WEBHOOK_ID"
echo "Webhook Secret: $WEBHOOK_SECRET"
echo ""

# ─── 2. Test Webhook ─────────────────────────────────────────
echo "Sending test ping..."
TEST_RESPONSE=$(curl -s -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"webhookId\": \"$WEBHOOK_ID\"}" \
  "$BASE/api/webhooks/test")

echo "$TEST_RESPONSE" | jq .
echo ""

# ─── 3. Check Delivery ───────────────────────────────────────
echo "Checking delivery history..."
sleep 2

DELIVERIES=$(curl -s \
  -H "X-API-Key: $API_KEY" \
  "$BASE/api/webhooks/deliveries?webhookId=$WEBHOOK_ID")

echo "$DELIVERIES" | jq .
echo ""

# ─── 4. List Webhooks ────────────────────────────────────────
echo "All webhooks:"
curl -s \
  -H "X-API-Key: $API_KEY" \
  "$BASE/api/webhooks" | jq '.data[] | {id, url, status, events}'
echo ""

# ─── 5. Cleanup ──────────────────────────────────────────────
echo "Deleting webhook..."
curl -s -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"action\": \"delete\", \"webhookId\": \"$WEBHOOK_ID\"}" \
  "$BASE/api/webhooks" | jq .

echo "Done."
```
