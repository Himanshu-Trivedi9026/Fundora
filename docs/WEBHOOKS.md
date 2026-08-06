# Webhooks

Event-driven webhook delivery system for the Fundora platform. Provides webhook registration, HMAC-SHA256 payload signing, delivery with retries and exponential backoff, and automatic disabling after excessive failures.

## Overview

Webhooks allow external systems to receive real-time notifications when events occur on the Fundora platform. Webhooks deliver signed payloads via HTTP POST to registered endpoints.

All functions follow the `{ success: boolean, data?, error? }` return pattern and never throw.

### Key Design Principles

- **HMAC-SHA256 signing** — Every payload is signed with the webhook's secret. Receivers verify the `X-Fundora-Signature` header.
- **Exponential backoff** — Failed deliveries retry at increasing intervals: 1min → 5min → 30min → 2hr → 12hr.
- **Automatic disabling** — After 10 consecutive failures, a webhook is automatically set to `"failed"` status.
- **Ownership enforcement** — Only the webhook owner can update or delete their webhooks.
- **Test webhooks** — A `test.ping` event can be sent to verify endpoint connectivity.

## Constants

### `WEBHOOK_EVENTS`

```js
export const WEBHOOK_EVENTS = {
  VERIFICATION_COMPLETED: "verification.completed",
  VERIFICATION_FAILED: "verification.failed",
  DONATION_RECEIVED: "donation.received",
  DONATION_FAILED: "donation.failed",
  ESCROW_FUNDED: "escrow.funded",
  ESCROW_RELEASED: "escrow.released",
  ESCROW_REFUNDED: "escrow.refunded",
  MILESTONE_SUBMITTED: "milestone.submitted",
  MILESTONE_APPROVED: "milestone.approved",
  MILESTONE_REJECTED: "milestone.rejected",
  FRAUD_ALERT: "fraud.alert",
  COMPLIANCE_ALERT: "compliance.alert",
  CAMPAIGN_CREATED: "campaign.created",
  CAMPAIGN_FUNDED: "campaign.funded",
  CAMPAIGN_COMPLETED: "campaign.completed",
  PAYOUT_COMPLETED: "payout.completed",
  MEMBER_ADDED: "member.added",
  MEMBER_REMOVED: "member.removed",
};
```

### `WEBHOOK_STATUSES`

```js
export const WEBHOOK_STATUSES = ["active", "inactive", "failed"];
```

### `DELIVERY_STATUSES`

```js
export const DELIVERY_STATUSES = ["pending", "delivered", "failed", "retrying"];
```

### Retry Delays

```js
const RETRY_DELAYS = [
  60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
  30 * 60 * 1000, // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
  12 * 60 * 60 * 1000, // 12 hours
];
```

## Payload Signing

### `signPayload(payload, secret)`

Sign a payload using HMAC-SHA256. Accepts an object or string. Returns the hex-encoded signature.

```js
import { signPayload } from "@/lib/webhooks";

const signature = signPayload(
  { event: "donation.received", data: { amount: 1000 } },
  "whsec_...",
);
// "a1b2c3d4e5f6..." (HMAC-SHA256 hex)
```

**Parameters:**

| Parameter | Type               | Required | Description                                        |
| --------- | ------------------ | -------- | -------------------------------------------------- |
| `payload` | `object \| string` | Yes      | The payload to sign (objects are JSON-stringified) |
| `secret`  | `string`           | Yes      | The webhook's signing secret                       |

**Returns:** `string` — HMAC-SHA256 hex digest.

---

### `verifySignature(payload, signature, secret)`

Verify an HMAC-SHA256 signature. Compares the expected signature against the provided one.

```js
import { verifySignature } from "@/lib/webhooks";

const isValid = verifySignature(payload, receivedSignature, "whsec_...");
// true or false
```

**Parameters:**

| Parameter   | Type               | Required | Description                  |
| ----------- | ------------------ | -------- | ---------------------------- |
| `payload`   | `object \| string` | Yes      | The original payload         |
| `signature` | `string`           | Yes      | The signature to verify      |
| `secret`    | `string`           | Yes      | The webhook's signing secret |

**Returns:** `boolean` — `true` if the signature matches.

### Signature Verification (Receiver Side)

Webhook receivers should verify the signature on incoming payloads:

```js
// In your webhook receiver endpoint:
const signature = req.headers["x-fundora-signature"];
const isValid = verifySignature(req.body, signature, YOUR_WEBHOOK_SECRET);

if (!isValid) {
  return res.status(401).json({ error: "Invalid signature" });
}

// Process the event
const { event, data } = req.body;
```

## Webhook Registration

### `createWebhook(options)`

Register a new webhook endpoint. The secret is returned **only on creation** and must be stored securely.

```js
import { createWebhook, WEBHOOK_EVENTS } from "@/lib/webhooks";

const result = await createWebhook({
  userId: "user-uuid",
  organizationId: "org-uuid", // optional
  url: "https://myapp.com/webhooks/fundora",
  events: [
    WEBHOOK_EVENTS.DONATION_RECEIVED,
    WEBHOOK_EVENTS.ESCROW_RELEASED,
    WEBHOOK_EVENTS.CAMPAIGN_COMPLETED,
  ],
  description: "Production webhook for donations",
});

// result.data.secret — "whsec_..." — STORE THIS SECURELY
```

**Parameters:**

| Parameter        | Type       | Required | Default | Description                                |
| ---------------- | ---------- | -------- | ------- | ------------------------------------------ |
| `userId`         | `string`   | Yes      | —       | Owner user UUID                            |
| `organizationId` | `string`   | No       | `null`  | Organization UUID                          |
| `url`            | `string`   | Yes      | —       | Endpoint URL (must be HTTPS in production) |
| `events`         | `string[]` | No       | `[]`    | Event types to subscribe to                |
| `description`    | `string`   | No       | —       | Human-readable description                 |

**Validation:** All event types must be valid values from `WEBHOOK_EVENTS`.

**Secret format:** `whsec_` prefix + 64 hex characters (32 random bytes).

**Side effects:** Logs a `webhook_created` audit event.

**Returns:**

```js
{
  success: true,
  data: {
    id: "uuid",
    url: "https://myapp.com/webhooks/fundora",
    secret: "whsec_...",  // Only returned on creation
    events: [...],
    status: "active",
    // ...
  }
}
```

---

### `updateWebhook(webhookId, updates, userId)`

Update a webhook's configuration. Only the owner can update.

```js
const result = await updateWebhook(
  "webhook-uuid",
  {
    url: "https://myapp.com/webhooks/fundora-v2",
    events: [WEBHOOK_EVENTS.DONATION_RECEIVED],
    status: "active",
  },
  user.id,
);
```

**Parameters:**

| Parameter   | Type     | Required | Description               |
| ----------- | -------- | -------- | ------------------------- |
| `webhookId` | `string` | Yes      | Webhook UUID              |
| `updates`   | `object` | Yes      | Fields to update          |
| `userId`    | `string` | Yes      | Must be the webhook owner |

**Allowed update fields:** `url`, `events`, `description`, `status`

---

### `deleteWebhook(webhookId, userId)`

Delete a webhook. Only the owner can delete.

```js
const result = await deleteWebhook("webhook-uuid", user.id);
```

---

### `getWebhooks(options)`

List webhooks for an organization or user.

```js
const result = await getWebhooks({
  organizationId: "org-uuid", // optional
  userId: "user-uuid", // optional
  limit: 50,
  offset: 0,
});
// result.data: Webhook[] (secrets included in raw data — strip before API responses)
```

**Note:** The API route at `/api/webhooks` strips the `secret` field from responses for security.

## Event Triggering

### `triggerWebhook(options)`

Trigger webhook deliveries for a specific event type. Queries all active webhooks that subscribe to the event and creates pending delivery records.

```js
import { triggerWebhook } from "@/lib/webhooks";

const result = await triggerWebhook({
  organizationId: "org-uuid", // optional — scope to specific org
  eventType: "donation.received",
  payload: {
    event: "donation.received",
    timestamp: "2024-01-15T10:30:00Z",
    data: {
      donationId: "donation-uuid",
      amount: 5000,
      currency: "INR",
      campaignId: "campaign-uuid",
    },
  },
});

// result.data: { delivered: 3, deliveryIds: ["uuid1", "uuid2", "uuid3"] }
```

**Parameters:**

| Parameter        | Type     | Required | Description                      |
| ---------------- | -------- | -------- | -------------------------------- |
| `organizationId` | `string` | No       | Scope to a specific organization |
| `eventType`      | `string` | Yes      | Event type from `WEBHOOK_EVENTS` |
| `payload`        | `object` | Yes      | Event payload (arbitrary JSON)   |

**Behavior:**

1. Queries all active webhooks (optionally scoped to an organization).
2. Filters to webhooks whose `events` array includes the `eventType`.
3. Creates `webhook_deliveries` records with status `"pending"`.
4. Updates `last_triggered_at` on each triggered webhook.
5. Returns the count of deliveries created and their IDs.

**Note:** Deliveries are created as pending records. Actual HTTP delivery is performed by `deliverWebhook`.

---

### `testWebhook(webhookId, userId)`

Send a test ping event to a webhook endpoint. Creates a delivery with a `test.ping` event and immediately attempts delivery.

```js
const result = await testWebhook("webhook-uuid", user.id);
```

**Parameters:**

| Parameter   | Type     | Required | Description               |
| ----------- | -------- | -------- | ------------------------- |
| `webhookId` | `string` | Yes      | Webhook UUID              |
| `userId`    | `string` | Yes      | Must be the webhook owner |

**Test payload:**

```json
{
  "event": "test.ping",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": { "message": "This is a test webhook delivery" }
}
```

## Delivery Engine

### `deliverWebhook(deliveryId)`

Execute a single webhook delivery. Signs the payload, POSTs to the webhook URL, and handles success/failure/retry logic.

```js
import { deliverWebhook } from "@/lib/webhooks";

const result = await deliverWebhook("delivery-uuid");
```

**Parameters:**

| Parameter    | Type     | Required | Description                             |
| ------------ | -------- | -------- | --------------------------------------- |
| `deliveryId` | `string` | Yes      | Delivery UUID from `webhook_deliveries` |

**Flow:**

1. Fetch the delivery record with its associated webhook (via join).
2. Check that the webhook is `active`.
3. Sign the payload with HMAC-SHA256.
4. POST to the webhook URL with the following headers:

| Header                  | Value                     |
| ----------------------- | ------------------------- |
| `Content-Type`          | `application/json`        |
| `X-Fundora-Signature`   | HMAC-SHA256 hex signature |
| `X-Fundora-Event`       | Event type string         |
| `X-Fundora-Delivery-Id` | Delivery UUID             |
| `User-Agent`            | `Fundora-Webhook/1.0`     |

5. **On success (2xx):**
   - Mark delivery as `"delivered"`.
   - Update webhook's `last_success_at`.
6. **On failure (non-2xx or network error):**
   - If `attempt_count >= max_attempts` (default 5): Mark as `"failed"`, increment webhook's `failure_count`. If `failure_count >= 10`, set webhook status to `"failed"`.
   - Otherwise: Schedule retry with exponential backoff. Set status to `"retrying"` and `next_retry_at`.

**Timeout:** 30 seconds per HTTP request (`DELIVERY_TIMEOUT_MS`).

---

### `retryDelivery(deliveryId)`

Manually retry a failed delivery. Resets the delivery to `"pending"` status and re-executes it.

```js
const result = await retryDelivery("delivery-uuid");
```

**Parameters:**

| Parameter    | Type     | Required | Description                  |
| ------------ | -------- | -------- | ---------------------------- |
| `deliveryId` | `string` | Yes      | Must be in `"failed"` status |

---

### `getWebhookDeliveries(webhookId, options)`

List deliveries for a webhook.

```js
const result = await getWebhookDeliveries("webhook-uuid", {
  status: "failed", // optional filter
  limit: 50,
  offset: 0,
});
// result.data: Delivery[]
```

---

### `getPendingRetries()`

Get all deliveries with status `"retrying"` whose `next_retry_at` has passed. Used by scheduled jobs to process retries.

```js
const result = await getPendingRetries();
// result.data: [{ id: "delivery-uuid" }, ...]
```

## Retry Strategy

Webhook deliveries that fail are retried with exponential backoff:

| Attempt | Delay      | Cumulative Wait |
| ------- | ---------- | --------------- |
| 1       | 1 minute   | 1 min           |
| 2       | 5 minutes  | 6 min           |
| 3       | 30 minutes | 36 min          |
| 4       | 2 hours    | 2 hr 36 min     |
| 5       | 12 hours   | 14 hr 36 min    |

After 5 failed attempts (default `max_attempts`), the delivery is marked as `"failed"` and the webhook's `failure_count` is incremented. When `failure_count` reaches 10, the webhook is automatically disabled (`status = "failed"`).

## Webhook Lifecycle

```
Webhook created (status: "active")
    │
    ▼
Event occurs → triggerWebhook()
    │
    ▼
Deliveries created (status: "pending")
    │
    ▼
deliverWebhook() — POST to endpoint
    │
    ├── 2xx response → status: "delivered" ✓
    │
    ├── Non-2xx / timeout → attempt_count++
    │   │
    │   ├── attempt_count < max_attempts → status: "retrying"
    │   │   └── Schedule retry with exponential backoff
    │   │
    │   └── attempt_count >= max_attempts → status: "failed"
    │       └── failure_count++ on webhook
    │           └── failure_count >= 10 → webhook disabled
    │
    └── Manual retry → retryDelivery() → reset to "pending" → re-execute
```

## API Routes

| Route                      | Method | Description                                                                               |
| -------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `/api/webhooks`            | GET    | List webhooks (`?mode=events` for available event types). Secrets stripped from response. |
| `/api/webhooks`            | POST   | `create`, `update`, `delete` actions                                                      |
| `/api/webhooks/deliveries` | GET    | List deliveries for a webhook                                                             |
| `/api/webhooks/test`       | POST   | Send a test ping to a webhook                                                             |

### GET `/api/webhooks?mode=events`

Returns the list of available webhook event types:

```json
{
  "success": true,
  "data": [
    { "name": "VERIFICATION_COMPLETED", "value": "verification.completed" },
    { "name": "DONATION_RECEIVED", "value": "donation.received" },
    ...
  ]
}
```

### POST `/api/webhooks` (create)

```json
{
  "action": "create",
  "url": "https://myapp.com/webhooks",
  "events": ["donation.received", "escrow.released"],
  "description": "Production webhook",
  "organizationId": "org-uuid"
}
```

**Response includes a warning:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Store the webhook secret securely — it will not be shown again"
}
```

## Database Tables

| Table                | Description                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| `webhooks`           | Webhook registrations with URL, secret, events, failure tracking          |
| `webhook_deliveries` | Individual delivery attempts with status, retry scheduling, response data |

### Key Fields in `webhooks`

| Field               | Type          | Description                                     |
| ------------------- | ------------- | ----------------------------------------------- |
| `url`               | `text`        | Target endpoint URL                             |
| `secret`            | `text`        | HMAC-SHA256 signing secret                      |
| `events`            | `text[]`      | Subscribed event types                          |
| `status`            | `text`        | `active`, `inactive`, or `failed`               |
| `failure_count`     | `integer`     | Consecutive failure count (auto-disables at 10) |
| `last_triggered_at` | `timestamptz` | Last time webhooks were triggered               |
| `last_success_at`   | `timestamptz` | Last successful delivery                        |
| `last_error`        | `text`        | Last error message                              |

### Key Fields in `webhook_deliveries`

| Field             | Type          | Description                                     |
| ----------------- | ------------- | ----------------------------------------------- |
| `event_type`      | `text`        | Event that triggered this delivery              |
| `payload`         | `jsonb`       | The event payload                               |
| `status`          | `text`        | `pending`, `delivered`, `failed`, or `retrying` |
| `attempt_count`   | `integer`     | Number of delivery attempts                     |
| `max_attempts`    | `integer`     | Maximum retries (default: 5)                    |
| `next_retry_at`   | `timestamptz` | When the next retry should occur                |
| `response_status` | `integer`     | HTTP status of last attempt                     |
| `error_message`   | `text`        | Error from last failed attempt                  |

## Tests

- `tests/lib/webhooks/webhookEngine.test.js` — Webhook CRUD, signing, and trigger tests
- `tests/lib/webhooks/webhookDelivery.test.js` — Delivery execution, retry logic, and failure handling tests
- `tests/api/webhook.test.js` — API route integration tests
