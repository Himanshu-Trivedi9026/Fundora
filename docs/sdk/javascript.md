# Fundora JavaScript SDK

> Developer documentation for integrating with the Fundora Public API using JavaScript or Node.js.

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Making API Requests](#making-api-requests)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Reference](#api-reference)
- [Examples](#examples)

---

## Quick Start

### Prerequisites

- Node.js 18+ (for built-in `fetch`) or a fetch polyfill for older environments
- A Fundora API key (generate one in the Fundora Dashboard → Settings → API Keys)

### Installation

No SDK package is required — use the standard `fetch` API or any HTTP client like `axios`.

```bash
# Optional: install axios if you prefer it over fetch
npm install axios
```

### Minimal Example

```javascript
const FUNDORA_API = "https://api.fundora.in";
const API_KEY = "fk_a1b2c3d4_..."; // Your API key

async function listCampaigns() {
  const res = await fetch(`${FUNDORA_API}/api/campaigns`, {
    headers: {
      "X-API-Key": API_KEY,
    },
  });

  const data = await res.json();
  console.log(data);
}
```

---

## Authentication

All API requests require an API key passed via the `X-API-Key` HTTP header.

### API Key Format

Fundora API keys follow the format:

```
fk_{prefix}_{body}
```

- **prefix**: 8-character hex string used for key lookup
- **body**: 64-character hex string (random)
- **Total length**: 75 characters

Example: `fk_a1b2c3d4_e5f6789012345678abcdef0123456789abcdef0123456789abcdef0123456789`

### Setting the Header

```javascript
// Using fetch
const response = await fetch("https://api.fundora.in/api/campaigns", {
  headers: {
    "X-API-Key": "fk_a1b2c3d4_...",
  },
});

// Using axios
const axios = require("axios");

const client = axios.create({
  baseURL: "https://api.fundora.in",
  headers: {
    "X-API-Key": "fk_a1b2c3d4_...",
  },
});
```

> **Security**: Store API keys in environment variables. Never commit them to source control.

```javascript
// .env
FUNDORA_API_KEY=fk_a1b2c3d4_...

// Usage
const API_KEY = process.env.FUNDORA_API_KEY;
```

---

## Making API Requests

### Using Fetch (Node.js 18+ / Browsers)

```javascript
const FUNDORA_API = "https://api.fundora.in";

// GET request
const response = await fetch(`${FUNDORA_API}/api/campaigns?limit=10`, {
  method: "GET",
  headers: {
    "X-API-Key": process.env.FUNDORA_API_KEY,
    "Content-Type": "application/json",
  },
});

const result = await response.json();
```

### Using Axios

```javascript
const axios = require("axios");

const fundora = axios.create({
  baseURL: "https://api.fundora.in",
  headers: {
    "X-API-Key": process.env.FUNDORA_API_KEY,
    "Content-Type": "application/json",
  },
});

// GET request
const { data } = await fundora.get("/api/campaigns", {
  params: { limit: 10 },
});
```

### POST Request with Body

```javascript
// fetch
const response = await fetch(`${FUNDORA_API}/api/donations`, {
  method: "POST",
  headers: {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    campaignId: "campaign-uuid",
    amount: 5000,
    currency: "INR",
  }),
});

// axios
const { data } = await fundora.post("/api/donations", {
  campaignId: "campaign-uuid",
  amount: 5000,
  currency: "INR",
});
```

---

## Error Handling

### Standard Error Response Format

All error responses follow a consistent JSON structure:

```json
{
  "error": "Description of the error"
}
```

### HTTP Status Codes

| Code  | Meaning               | Description                                     |
| ----- | --------------------- | ----------------------------------------------- |
| `200` | OK                    | Request succeeded                               |
| `201` | Created               | Resource created successfully                   |
| `400` | Bad Request           | Invalid request body or missing required fields |
| `401` | Unauthorized          | Missing, invalid, or expired API key            |
| `405` | Method Not Allowed    | HTTP method not supported on this endpoint      |
| `429` | Too Many Requests     | Rate limit exceeded                             |
| `500` | Internal Server Error | Unexpected server-side error                    |

### Handling Errors

```javascript
async function fundoraRequest(endpoint, options = {}) {
  const FUNDORA_API = "https://api.fundora.in";

  const response = await fetch(`${FUNDORA_API}${endpoint}`, {
    ...options,
    headers: {
      "X-API-Key": process.env.FUNDORA_API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    // Distinguish between error types
    if (response.status === 401) {
      console.error("Authentication failed. Check your API key.");
    } else if (response.status === 429) {
      const retryAfter = body.retryAfter;
      console.error(`Rate limited. Retry after ${retryAfter} seconds.`);
    } else if (response.status === 400) {
      console.error(`Bad request: ${body.error}`);
    } else {
      console.error(`API error (${response.status}): ${body.error}`);
    }
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return body;
}
```

---

## Rate Limiting

Every API key has configurable rate limits (default: 100 requests per 60-second window).

### Rate Limit Headers

Every response includes these headers:

| Header                  | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests allowed per window             |
| `X-RateLimit-Remaining` | Remaining requests in the current window        |
| `X-RateLimit-Reset`     | Unix timestamp (seconds) when the window resets |

### When Rate Limited (HTTP 429)

The response body includes a `retryAfter` field:

```json
{
  "error": "Too many requests",
  "retryAfter": 42
}
```

A `Retry-After` header is also sent.

### Respecting Rate Limits

```javascript
async function fetchWithRateLimit(endpoint, options = {}, retries = 3) {
  const response = await fetch(`${FUNDORA_API}${endpoint}`, {
    ...options,
    headers: {
      "X-API-Key": process.env.FUNDORA_API_KEY,
      ...options.headers,
    },
  });

  if (response.status === 429 && retries > 0) {
    const body = await response.json();
    const retryAfter = body.retryAfter || 60;

    console.log(`Rate limited. Waiting ${retryAfter}s before retry...`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

    return fetchWithRateLimit(endpoint, options, retries - 1);
  }

  // Check remaining quota for proactive throttling
  const remaining = parseInt(
    response.headers.get("X-RateLimit-Remaining") || "100",
    10,
  );
  if (remaining < 10) {
    const resetAt = parseInt(
      response.headers.get("X-RateLimit-Reset") || "0",
      10,
    );
    const waitTime = Math.max(0, resetAt - Math.floor(Date.now() / 1000));
    console.warn(
      `Low rate limit remaining (${remaining}). Res${waitTime}s until reset.`,
    );
  }

  return response;
}
```

---

## API Reference

### Campaigns

#### List Campaigns

```
GET /api/campaigns
```

| Parameter | Type   | Description                        |
| --------- | ------ | ---------------------------------- |
| `limit`   | number | Max results per page (default: 50) |
| `offset`  | number | Pagination offset (default: 0)     |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Clean Water Initiative",
      "description": "...",
      "goalAmount": 100000,
      "raisedAmount": 45000,
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 142
}
```

---

### Donations

#### Create a Donation

```
POST /api/donations
```

**Request Body:**

```json
{
  "campaignId": "uuid",
  "amount": 5000,
  "currency": "INR",
  "donorEmail": "donor@example.com",
  "note": "Keep up the great work!"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "donation-uuid",
    "campaignId": "uuid",
    "amount": 5000,
    "currency": "INR",
    "status": "completed",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Webhooks

#### List Webhooks

```
GET /api/webhooks
```

| Parameter        | Type   | Description               |
| ---------------- | ------ | ------------------------- |
| `organizationId` | string | Filter by organization    |
| `limit`          | number | Max results (default: 50) |
| `offset`         | number | Pagination offset         |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "url": "https://myapp.com/webhooks",
      "events": ["donation.received", "campaign.funded"],
      "status": "active",
      "failureCount": 0,
      "lastTriggeredAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 3
}
```

#### List Available Event Types

```
GET /api/webhooks?mode=events
```

**Response:**

```json
{
  "success": true,
  "data": [
    { "name": "VERIFICATION_COMPLETED", "value": "verification.completed" },
    { "name": "DONATION_RECEIVED", "value": "donation.received" },
    { "name": "ESCROW_FUNDED", "value": "escrow.funded" }
  ]
}
```

#### Create a Webhook

```
POST /api/webhooks
```

**Request Body:**

```json
{
  "action": "create",
  "url": "https://myapp.com/webhooks/fundora",
  "events": ["donation.received", "campaign.funded"],
  "description": "Production webhook for donation tracking"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "url": "https://myapp.com/webhooks/fundora",
    "secret": "whsec_abc123...",
    "events": ["donation.received", "campaign.funded"],
    "status": "active"
  },
  "message": "Store the webhook secret securely — it will not be shown again"
}
```

> **Important**: The `secret` is only returned once at creation time. Store it securely.

#### Update a Webhook

```
POST /api/webhooks
```

**Request Body:**

```json
{
  "action": "update",
  "webhookId": "uuid",
  "updates": {
    "events": ["donation.received", "campaign.funded", "escrow.released"],
    "status": "active"
  }
}
```

#### Delete a Webhook

```
POST /api/webhooks
```

**Request Body:**

```json
{
  "action": "delete",
  "webhookId": "uuid"
}
```

#### Test a Webhook

```
POST /api/webhooks/test
```

**Request Body:**

```json
{
  "webhookId": "uuid"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "delivered",
    "statusCode": 200
  }
}
```

#### Get Delivery History

```
GET /api/webhooks/deliveries?webhookId=uuid
```

| Parameter   | Type   | Description                                         |
| ----------- | ------ | --------------------------------------------------- |
| `webhookId` | string | **Required**. Webhook ID                            |
| `status`    | string | Filter by status: `delivered`, `failed`, `retrying` |
| `limit`     | number | Max results (default: 50)                           |
| `offset`    | number | Pagination offset                                   |

#### Retry a Failed Delivery

```
POST /api/webhooks/deliveries
```

**Request Body:**

```json
{
  "action": "retry",
  "deliveryId": "uuid"
}
```

---

### API Key Management

#### List API Keys

```
GET /api/api-platform/keys
```

| Parameter        | Type   | Description                            |
| ---------------- | ------ | -------------------------------------- |
| `organizationId` | string | Filter by organization                 |
| `status`         | string | Filter: `active`, `revoked`, `expired` |
| `limit`          | number | Max results (default: 50)              |
| `offset`         | number | Pagination offset                      |

#### Create an API Key

```
POST /api/api-platform/keys
```

**Request Body:**

```json
{
  "action": "create",
  "name": "Production Integration Key",
  "scopes": ["campaigns:read", "donations:write"],
  "rateLimit": 200,
  "rateWindowMs": 60000,
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "key": "fk_a1b2c3d4_...",
    "name": "Production Integration Key",
    "status": "active"
  },
  "message": "Store this API key securely — it will not be shown again"
}
```

#### Revoke an API Key

```
POST /api/api-platform/keys
```

**Request Body:**

```json
{
  "action": "revoke",
  "keyId": "uuid"
}
```

---

### Developer Apps

#### List Developer Apps

```
GET /api/api-platform/apps
```

#### Create a Developer App

```
POST /api/api-platform/apps
```

**Request Body:**

```json
{
  "action": "create",
  "name": "My Integration App",
  "description": "OAuth integration for mobile app",
  "appType": "mobile",
  "redirectUris": ["myapp://callback"]
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "client_id": "e5f67890abcdef1234567890abcdef12",
    "client_secret": "fks_abc123...",
    "name": "My Integration App",
    "app_type": "mobile"
  },
  "message": "Store the client_secret securely — it will not be shown again"
}
```

#### Revoke a Developer App

```
POST /api/api-platform/apps
```

**Request Body:**

```json
{
  "action": "revoke",
  "appId": "uuid"
}
```

---

### API Usage Logs

#### List API Logs

```
GET /api/api-platform/logs
```

| Parameter        | Type   | Description                    |
| ---------------- | ------ | ------------------------------ |
| `apiKeyId`       | string | Filter by API key              |
| `organizationId` | string | Filter by organization         |
| `method`         | string | Filter by HTTP method          |
| `responseStatus` | number | Filter by response status code |
| `startDate`      | string | ISO 8601 start date            |
| `endDate`        | string | ISO 8601 end date              |
| `limit`          | number | Max results (default: 100)     |
| `offset`         | number | Pagination offset              |

#### Usage Summary

```
GET /api/api-platform/logs?mode=summary
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "date": "2024-01-15",
      "total": 1523,
      "success": 1498,
      "errors": 25
    }
  ]
}
```

---

## Examples

### Complete CRUD Example with Fetch

```javascript
const FUNDORA_API = "https://api.fundora.in";
const API_KEY = process.env.FUNDORA_API_KEY;

async function fundoraFetch(path, options = {}) {
  const response = await fetch(`${FUNDORA_API}${path}`, {
    ...options,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

// List all active webhooks
async function getWebhooks() {
  return fundoraFetch("/api/webhooks?limit=50");
}

// Create a new webhook
async function createWebhook(url, events) {
  return fundoraFetch("/api/webhooks", {
    method: "POST",
    body: JSON.stringify({
      action: "create",
      url,
      events,
      description: "Automated webhook",
    }),
  });
}

// Test a webhook
async function testWebhook(webhookId) {
  return fundoraFetch("/api/webhooks/test", {
    method: "POST",
    body: JSON.stringify({ webhookId }),
  });
}

// Delete a webhook
async function deleteWebhook(webhookId) {
  return fundoraFetch("/api/webhooks", {
    method: "POST",
    body: JSON.stringify({
      action: "delete",
      webhookId,
    }),
  });
}

// --- Usage ---

async function main() {
  try {
    // Create webhook
    const { data: webhook } = await createWebhook(
      "https://myapp.com/webhooks/fundora",
      ["donation.received", "campaign.funded"],
    );
    console.log("Created webhook:", webhook.id);
    console.log("Secret:", webhook.secret); // Store this securely!

    // Test it
    const testResult = await testWebhook(webhook.id);
    console.log("Test result:", testResult.data);

    // List all webhooks
    const { data: webhooks, total } = await getWebhooks();
    console.log(`Found ${total} webhooks`);

    // Clean up
    await deleteWebhook(webhook.id);
  } catch (error) {
    if (error.status === 429) {
      console.error("Rate limited. Slow down your requests.");
    } else {
      console.error("API error:", error.message);
    }
  }
}

main();
```

### Webhook Receiver (Express.js)

```javascript
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "1mb" }));

const WEBHOOK_SECRET = process.env.FUNDORA_WEBHOOK_SECRET;

function verifyWebhookSignature(payload, signature) {
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(typeof payload === "string" ? payload : JSON.stringify(payload))
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature || "", "utf8"),
  );
}

app.post("/webhooks/fundora", (req, res) => {
  const signature = req.headers["x-fundora-signature"];
  const eventType = req.headers["x-fundora-event"];
  const deliveryId = req.headers["x-fundora-delivery-id"];

  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Process the event
  switch (eventType) {
    case "donation.received":
      console.log("New donation:", req.body.data);
      break;
    case "campaign.funded":
      console.log("Campaign fully funded:", req.body.data);
      break;
    case "escrow.released":
      console.log("Escrow released:", req.body.data);
      break;
    default:
      console.log("Unhandled event:", eventType);
  }

  // Always respond 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

app.listen(3000, () => console.log("Webhook server running on port 3000"));
```

### Pagination Helper

```javascript
async function fetchAllCampaigns() {
  const allCampaigns = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const response = await fundoraFetch(
      `/api/campaigns?limit=${limit}&offset=${offset}`,
    );

    allCampaigns.push(...response.data);

    if (allCampaigns.length >= response.total || response.data.length < limit) {
      break;
    }

    offset += limit;
  }

  return allCampaigns;
}
```
