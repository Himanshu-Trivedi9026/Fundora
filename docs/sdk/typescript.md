# Fundora TypeScript SDK

> Type-safe integration with the Fundora Public API using TypeScript.

## Table of Contents

- [Quick Start](#quick-start)
- [Type Definitions](#type-definitions)
- [Authentication](#authentication)
- [Making API Requests](#making-api-requests)
- [Typed Error Handling](#typed-error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Quick Start

### Prerequisites

- TypeScript 5.0+
- Node.js 18+ (for built-in `fetch`)

### Setup

```bash
npm install typescript @types/node --save-dev
```

### Minimal Example

```typescript
const FUNDORA_API = "https://api.fundora.in";
const API_KEY = process.env.FUNDORA_API_KEY!;

async function listCampaigns(): Promise<ApiResponse<Campaign[]>> {
  const res = await fetch(`${FUNDORA_API}/api/campaigns`, {
    headers: { "X-API-Key": API_KEY },
  });

  return res.json() as Promise<ApiResponse<Campaign[]>>;
}
```

---

## Type Definitions

All types are provided below for use throughout your codebase.

### Core Types

```typescript
// ─── API Response ──────────────────────────────────────────────

/** Standard successful API response */
interface ApiResponse<T> {
  success: true;
  data: T;
  total?: number;
  message?: string;
}

/** Standard error response */
interface ApiError {
  error: string;
}

/** Union type for all API responses */
type FundoraResponse<T> = ApiResponse<T> | ApiError;

// ─── Pagination ────────────────────────────────────────────────

interface PaginationParams {
  /** Max results per page (default: 50) */
  limit?: number;
  /** Pagination offset (default: 0) */
  offset?: number;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
}

// ─── Rate Limiting ─────────────────────────────────────────────

interface RateLimitInfo {
  /** Maximum requests per window */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp (seconds) when window resets */
  reset: number;
}

interface RateLimitError extends ApiError {
  error: "Too many requests";
  retryAfter: number;
}

// ─── HTTP ──────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
```

### Campaign Types

```typescript
type CampaignStatus = "draft" | "active" | "funded" | "completed" | "cancelled";

interface Campaign {
  id: string;
  title: string;
  description: string;
  goalAmount: number;
  raisedAmount: number;
  currency: string;
  status: CampaignStatus;
  creatorId: string;
  organizationId?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface ListCampaignsParams extends PaginationParams {
  status?: CampaignStatus;
  organizationId?: string;
}
```

### Donation Types

```typescript
type DonationStatus = "pending" | "completed" | "failed" | "refunded";

interface Donation {
  id: string;
  campaignId: string;
  amount: number;
  currency: string;
  donorEmail?: string;
  note?: string;
  status: DonationStatus;
  createdAt: string;
}

interface CreateDonationRequest {
  campaignId: string;
  amount: number;
  currency?: string;
  donorEmail?: string;
  note?: string;
}
```

### Webhook Types

```typescript
type WebhookStatus = "active" | "inactive" | "failed";
type DeliveryStatus = "pending" | "delivered" | "failed" | "retrying";

/** All available webhook event types */
type WebhookEvent =
  | "verification.completed"
  | "verification.failed"
  | "donation.received"
  | "donation.failed"
  | "escrow.funded"
  | "escrow.released"
  | "escrow.refunded"
  | "milestone.submitted"
  | "milestone.approved"
  | "milestone.rejected"
  | "fraud.alert"
  | "compliance.alert"
  | "campaign.created"
  | "campaign.funded"
  | "campaign.completed"
  | "payout.completed"
  | "member.added"
  | "member.removed";

interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  status: WebhookStatus;
  description?: string;
  failureCount: number;
  lastTriggeredAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  organizationId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface WebhookCreateRequest {
  action: "create";
  url: string;
  events?: WebhookEvent[];
  description?: string;
  organizationId?: string;
}

interface WebhookUpdateRequest {
  action: "update";
  webhookId: string;
  updates: {
    url?: string;
    events?: WebhookEvent[];
    description?: string;
    status?: WebhookStatus;
  };
}

interface WebhookDeleteRequest {
  action: "delete";
  webhookId: string;
}

type WebhookRequest = WebhookCreateRequest | WebhookUpdateRequest | WebhookDeleteRequest;

interface WebhookPayload<T = Record<string, unknown>> {
  event: WebhookEvent | "test.ping";
  timestamp: string;
  data: T;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: WebhookPayload;
  status: DeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt?: string;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  deliveredAt?: string;
  createdAt: string;
}

interface WebhookTestRequest {
  webhookId: string;
}

interface DeliveryRetryRequest {
  action: "retry";
  deliveryId: string;
}
```

### API Key Types

```typescript
type ApiKeyStatus = "active" | "revoked" | "expired";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  rateWindowMs: number;
  status: ApiKeyStatus;
  userId: string;
  organizationId?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiKeyCreateRequest {
  action: "create";
  name: string;
  scopes?: string[];
  rateLimit?: number;
  rateWindowMs?: number;
  expiresAt?: string;
  organizationId?: string;
}

/** Response returned only on key creation — contains the plaintext key */
interface ApiKeyCreateResponse extends ApiResponse<ApiKey> {
  data: ApiKey & { key: string };
  message: "Store this API key securely — it will not be shown again";
}

interface ApiKeyRevokeRequest {
  action: "revoke";
  keyId: string;
}
```

### Developer App Types

```typescript
type AppType = "web" | "mobile" | "server" | "cli" | "other";

interface DeveloperApp {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  appType: AppType;
  redirectUris: string[];
  status: "active" | "revoked";
  userId: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

interface DeveloperAppCreateRequest {
  action: "create";
  name: string;
  description?: string;
  appType?: AppType;
  redirectUris?: string[];
  organizationId?: string;
}

/** Response returned only on creation — contains the plaintext client_secret */
interface DeveloperAppCreateResponse extends ApiResponse<DeveloperApp> {
  data: DeveloperApp & { client_secret: string };
  message: "Store the client_secret securely — it will not be shown again";
}

interface DeveloperAppRevokeRequest {
  action: "revoke";
  appId: string;
}
```

### API Log Types

```typescript
interface ApiLogEntry {
  id: string;
  apiKeyId?: string;
  userId?: string;
  organizationId?: string;
  method: string;
  path: string;
  queryParams: Record<string, string>;
  responseStatus: number;
  responseTimeMs: number;
  userAgent?: string;
  scopeUsed?: string;
  errorMessage?: string;
  createdAt: string;
}

interface ApiUsageSummary {
  date: string;
  total: number;
  success: number;
  errors: number;
}

interface ApiLogsParams extends PaginationParams {
  apiKeyId?: string;
  organizationId?: string;
  method?: string;
  responseStatus?: number;
  startDate?: string;
  endDate?: string;
}
```

### Event Type Metadata

```typescript
interface WebhookEventInfo {
  name: string;
  value: WebhookEvent;
}
```

---

## Authentication

All requests require an `X-API-Key` header.

```typescript
const FUNDORA_API = "https://api.fundora.in";
const API_KEY = process.env.FUNDORA_API_KEY!;
```

---

## Making API Requests

### Generic Typed Fetch Helper

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
}

async function fundoraFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, params, headers: extraHeaders } = options;

  // Build query string
  let url = `${FUNDORA_API}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();

  if (!response.ok) {
    throw new FundoraApiError(response.status, json);
  }

  return json as T;
}
```

### Typed Endpoint Functions

```typescript
// Campaigns
async function listCampaigns(
  params?: ListCampaignsParams
): Promise<PaginatedResponse<Campaign>> {
  return fundoraFetch<PaginatedResponse<Campaign>>("/api/campaigns", { params });
}

// Donations
async function createDonation(
  donation: CreateDonationRequest
): Promise<ApiResponse<Donation>> {
  return fundoraFetch<ApiResponse<Donation>>("/api/donations", {
    method: "POST",
    body: donation,
  });
}

// Webhooks
async function listWebhooks(
  params?: PaginationParams & { organizationId?: string }
): Promise<PaginatedResponse<Webhook>> {
  return fundoraFetch<PaginatedResponse<Webhook>>("/api/webhooks", { params });
}

async function createWebhook(
  req: Omit<WebhookCreateRequest, "action">
): Promise<ApiResponse<Webhook & { secret: string }>> {
  return fundoraFetch("/api/webhooks", {
    method: "POST",
    body: { action: "create", ...req },
  });
}

async function updateWebhook(
  webhookId: string,
  updates: WebhookUpdateRequest["updates"]
): Promise<ApiResponse<Webhook>> {
  return fundoraFetch("/api/webhooks", {
    method: "POST",
    body: { action: "update", webhookId, updates },
  });
}

async function deleteWebhook(webhookId: string): Promise<{ success: true }> {
  return fundoraFetch("/api/webhooks", {
    method: "POST",
    body: { action: "delete", webhookId },
  });
}

async function testWebhook(
  webhookId: string
): Promise<ApiResponse<{ status: string; statusCode: number }>> {
  return fundoraFetch("/api/webhooks/test", {
    method: "POST",
    body: { webhookId },
  });
}
```

---

## Typed Error Handling

### Custom Error Class

```typescript
class FundoraApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | RateLimitError
  ) {
    super(body.error);
    this.name = "FundoraApiError";
  }

  /** Whether this error was caused by rate limiting */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** Whether this error was caused by authentication failure */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  /** Whether this error was caused by bad input */
  get isBadRequest(): boolean {
    return this.status === 400;
  }

  /** Seconds to wait before retrying (only for 429 errors) */
  get retryAfter(): number | undefined {
    if (this.isRateLimited && "retryAfter" in this.body) {
      return (this.body as RateLimitError).retryAfter;
    }
    return undefined;
  }
}
```

### Type-Safe Error Handling

```typescript
async function safeFundoraRequest<T>(
  path: string,
  options?: RequestOptions
): Promise<{ data: T; error: null } | { data: null; error: FundoraApiError }> {
  try {
    const data = await fundoraFetch<T>(path, options);
    return { data, error: null };
  } catch (err) {
    if (err instanceof FundoraApiError) {
      return { data: null, error: err };
    }
    throw err; // Re-throw unexpected errors
  }
}

// Usage
const result = await safeFundoraRequest<PaginatedResponse<Campaign>>(
  "/api/campaigns",
  { params: { limit: 10 } }
);

if (result.error) {
  console.error(`API error: ${result.error.message} (${result.error.status})`);

  if (result.error.isRateLimited) {
    const wait = result.error.retryAfter ?? 60;
    console.log(`Retry after ${wait}s`);
  }
} else {
  console.log(`Found ${result.data.total} campaigns`);
}
```

---

## Rate Limiting

### Reading Rate Limit Headers

```typescript
interface RateLimitHeaders {
  limit: number;
  remaining: number;
  reset: number;
}

function extractRateLimitHeaders(response: Response): RateLimitHeaders {
  return {
    limit: parseInt(response.headers.get("X-RateLimit-Limit") ?? "0", 10),
    remaining: parseInt(response.headers.get("X-RateLimit-Remaining") ?? "0", 10),
    reset: parseInt(response.headers.get("X-RateLimit-Reset") ?? "0", 10),
  };
}
```

### Proactive Throttling

```typescript
async function throttledFetch<T>(
  path: string,
  options?: RequestOptions
): Promise<{ data: T; rateLimit: RateLimitHeaders }> {
  const response = await fetch(`${FUNDORA_API}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const rateLimit = extractRateLimitHeaders(response);

  // Proactive throttle: wait if very few requests remain
  if (rateLimit.remaining < 5 && rateLimit.remaining > 0) {
    const now = Math.floor(Date.now() / 1000);
    const waitSeconds = Math.max(0, rateLimit.reset - now);
    if (waitSeconds > 0) {
      console.log(`Approaching rate limit. Waiting ${waitSeconds}s...`);
      await new Promise((r) => setTimeout(r, waitSeconds * 1000));
    }
  }

  const body = await response.json();

  if (!response.ok) {
    throw new FundoraApiError(response.status, body);
  }

  return { data: body as T, rateLimit };
}
```

---

## Examples

### Complete Integration Example

```typescript
import crypto from "crypto";

// ─── Types ─────────────────────────────────────────────────────
// (Import or define all types from the Type Definitions section above)

// ─── Client ────────────────────────────────────────────────────

const FUNDORA_API = "https://api.fundora.in";

class FundoraClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = FUNDORA_API) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = "GET", body, params } = options;

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) sp.set(k, String(v));
      }
      const qs = sp.toString();
      if (qs) url += `?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();
    if (!res.ok) throw new FundoraApiError(res.status, json);
    return json as T;
  }

  // Campaigns
  async listCampaigns(params?: ListCampaignsParams) {
    return this.request<PaginatedResponse<Campaign>>("/api/campaigns", {
      params,
    });
  }

  // Donations
  async createDonation(donation: CreateDonationRequest) {
    return this.request<ApiResponse<Donation>>("/api/donations", {
      method: "POST",
      body: donation,
    });
  }

  // Webhooks
  async listWebhooks(params?: PaginationParams) {
    return this.request<PaginatedResponse<Webhook>>("/api/webhooks", {
      params,
    });
  }

  async createWebhook(
    url: string,
    events: WebhookEvent[],
    description?: string
  ) {
    return this.request<
      ApiResponse<Webhook & { secret: string }>
    >("/api/webhooks", {
      method: "POST",
      body: { action: "create", url, events, description },
    });
  }

  async testWebhook(webhookId: string) {
    return this.request<
      ApiResponse<{ status: string; statusCode: number }>
    >("/api/webhooks/test", {
      method: "POST",
      body: { webhookId },
    });
  }

  // API Keys
  async createApiKey(name: string, options?: { scopes?: string[]; rateLimit?: number }) {
    return this.request<
      ApiResponse<ApiKey & { key: string }>
    >("/api/api-platform/keys", {
      method: "POST",
      body: { action: "create", name, ...options },
    });
  }

  // API Logs
  async getUsageSummary(params?: ApiLogsParams) {
    return this.request<ApiResponse<ApiUsageSummary[]>>(
      "/api/api-platform/logs",
      { params: { ...params, mode: "summary" } }
    );
  }
}

// ─── Webhook Verification ──────────────────────────────────────

function verifyWebhookSignature(
  payload: string | object,
  signature: string,
  secret: string
): boolean {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature, "utf8")
  );
}

// ─── Usage ─────────────────────────────────────────────────────

async function main() {
  const client = new FundoraClient(process.env.FUNDORA_API_KEY!);

  // List campaigns
  const { data: campaigns, total } = await client.listCampaigns({ limit: 5 });
  console.log(`${total} campaigns found`);

  for (const campaign of campaigns) {
    console.log(`  ${campaign.title} — ${campaign.raisedAmount}/${campaign.goalAmount}`);
  }

  // Create webhook
  const { data: webhook } = await client.createWebhook(
    "https://myapp.com/webhooks",
    ["donation.received", "campaign.funded"],
    "Production webhook"
  );
  console.log("Webhook created:", webhook.id);
  console.log("Store secret:", webhook.secret);

  // Test webhook
  const test = await client.testWebhook(webhook.id);
  console.log("Test delivery:", test.data.status);
}

main().catch(console.error);
```

### Express Webhook Handler with TypeScript

```typescript
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

const WEBHOOK_SECRET = process.env.FUNDORA_WEBHOOK_SECRET!;

// ─── Handler ───────────────────────────────────────────────────

app.post("/webhooks/fundora", (req, res) => {
  const signature = req.headers["x-fundora-signature"] as string;
  const eventType = req.headers["x-fundora-event"] as WebhookEvent | "test.ping";
  const deliveryId = req.headers["x-fundora-delivery-id"] as string;

  // Verify signature
  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""))) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Type the payload based on event
  const payload = req.body as WebhookPayload;

  switch (eventType) {
    case "donation.received": {
      const data = payload.data as { donationId: string; amount: number; currency: string };
      console.log(`Donation received: ${data.amount} ${data.currency}`);
      break;
    }
    case "campaign.funded": {
      const data = payload.data as { campaignId: string };
      console.log(`Campaign funded: ${data.campaignId}`);
      break;
    }
    case "escrow.released": {
      const data = payload.data as { escrowId: string; amount: number };
      console.log(`Escrow released: ${data.amount}`);
      break;
    }
    case "test.ping":
      console.log("Test ping received");
      break;
    default:
      console.log(`Unhandled event: ${eventType}`);
  }

  res.status(200).json({ received: true });
});

app.listen(3000, () => console.log("Server running on port 3000"));
```
