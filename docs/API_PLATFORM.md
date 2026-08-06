# API Platform

Programmatic API access for the Fundora platform. Provides API key management, request logging, developer app registration, rate limiting, and a middleware for API key-based authentication.

## Overview

The API Platform enables external integrations and third-party developers to access Fundora's functionality programmatically. It consists of four components:

1. **API Key Engine** — Generate, validate, revoke, and list API keys with scopes and rate limits.
2. **API Log Engine** — Append-only logging of all API requests for audit trails and usage analytics.
3. **Developer App Engine** — Register OAuth-ready applications with client credentials.
4. **withApiKey Middleware** — Authentication middleware that validates API keys, applies per-key rate limiting, and logs requests.

### Key Design Principles

- **Keys are hashed** — API keys are stored as SHA-256 hashes. The plaintext is returned **only once** on creation.
- **Prefix-based lookup** — Keys use a `fk_` prefix format (`fk_{8-char prefix}_{body}`) for efficient lookup by prefix.
- **Per-key rate limits** — Each API key has configurable `rate_limit` and `rate_window_ms`.
- **Append-only logging** — API logs are never updated or deleted, providing a complete audit trail.
- **IP addresses hashed** — Raw IP addresses are hashed before storage in logs.

## API Key Management

### `hashApiKey(key)`

Hash an API key using SHA-256. This is the same hashing function used internally for storage and validation.

```js
import { hashApiKey } from "@/lib/apiPlatform";

const hash = hashApiKey("fk_abc12345_...");
// "e3b0c44298fc..." (SHA-256 hex)
```

**Parameters:**

| Parameter | Type     | Required | Description           |
| --------- | -------- | -------- | --------------------- |
| `key`     | `string` | Yes      | The plaintext API key |

**Returns:** `string` — SHA-256 hex digest.

---

### `createApiKey(options)`

Create a new API key. Returns the plaintext key **only on creation** — it cannot be retrieved later.

```js
import { createApiKey } from "@/lib/apiPlatform";

const result = await createApiKey({
  userId: "user-uuid",
  organizationId: "org-uuid", // optional
  name: "Production API Key",
  scopes: ["campaigns:read", "donations:write"], // optional, default: []
  rateLimit: 100, // optional, default: 100 requests
  rateWindowMs: 60000, // optional, default: 60 seconds
  expiresAt: "2025-12-31T23:59:59Z", // optional
});

// result.data.key — "fk_abc12345_..." — STORE THIS, it won't be shown again
```

**Parameters:**

| Parameter        | Type       | Required | Default | Description                   |
| ---------------- | ---------- | -------- | ------- | ----------------------------- |
| `userId`         | `string`   | Yes      | —       | Owner user UUID               |
| `organizationId` | `string`   | No       | `null`  | Organization UUID             |
| `name`           | `string`   | Yes      | —       | Human-readable key name       |
| `scopes`         | `string[]` | No       | `[]`    | Permission scopes             |
| `rateLimit`      | `number`   | No       | `100`   | Max requests per window       |
| `rateWindowMs`   | `number`   | No       | `60000` | Rate limit window in ms       |
| `expiresAt`      | `string`   | No       | `null`  | ISO 8601 expiration timestamp |

**Key Format:** `fk_{prefix}_{body}` where prefix is 8 hex chars and body is 64 hex chars (32 random bytes).

**Side effects:** Logs an `api_key_created` audit event.

**Returns:**

```js
{
  success: true,
  data: {
    id: "uuid",
    name: "Production API Key",
    key: "fk_abc12345_...",  // Only returned on creation
    key_hash: "...",
    key_prefix: "abc12345",
    scopes: [...],
    rate_limit: 100,
    rate_window_ms: 60000,
    status: "active",
    // ...
  }
}
```

---

### `validateApiKey(keyHash)`

Validate an API key by its SHA-256 hash. Checks that the key exists, is `active`, and has not expired. Updates `last_used_at` on successful validation.

```js
import { validateApiKey, hashApiKey } from "@/lib/apiPlatform";

const hash = hashApiKey(receivedKey);
const result = await validateApiKey(hash);
// result.data: { id, user_id, scopes, rate_limit, ... }
```

**Parameters:**

| Parameter | Type     | Required | Description                 |
| --------- | -------- | -------- | --------------------------- |
| `keyHash` | `string` | Yes      | SHA-256 hash of the API key |

**Returns:**

```js
// Success:
{ success: true, data: { id, user_id, organization_id, scopes, rate_limit, rate_window_ms, ... } }

// Invalid/revoked:
{ success: false, error: "Invalid or revoked API key" }

// Expired:
{ success: false, error: "API key has expired" }
```

---

### `revokeApiKey(keyId, userId)`

Revoke an API key. Sets status to `"revoked"`. Only the key owner can revoke.

```js
const result = await revokeApiKey("key-uuid", "user-uuid");
```

**Parameters:**

| Parameter | Type     | Required | Description           |
| --------- | -------- | -------- | --------------------- |
| `keyId`   | `string` | Yes      | API key UUID          |
| `userId`  | `string` | Yes      | Must be the key owner |

**Side effects:** Logs an `api_key_revoked` audit event.

---

### `listApiKeys(options)`

List API keys for a user or organization.

```js
const result = await listApiKeys({
  userId: "user-uuid", // optional
  organizationId: "org-uuid", // optional
  status: "active", // optional filter
  limit: 50, // default: 50
  offset: 0, // default: 0
});
// result.data: ApiKey[] (without key hashes for security)
```

**Parameters:**

| Parameter        | Type     | Required | Default | Description            |
| ---------------- | -------- | -------- | ------- | ---------------------- |
| `userId`         | `string` | No       | —       | Filter by owner        |
| `organizationId` | `string` | No       | —       | Filter by organization |
| `status`         | `string` | No       | —       | Filter by status       |
| `limit`          | `number` | No       | `50`    | Pagination limit       |
| `offset`         | `number` | No       | `0`     | Pagination offset      |

---

### `getApiKeyUsage(keyId, options)`

Get usage logs for an API key.

```js
const result = await getApiKeyUsage("key-uuid", {
  startDate: "2024-01-01T00:00:00Z",
  endDate: "2024-01-31T23:59:59Z",
  limit: 100,
  offset: 0,
});
```

## API Logging

### `logApiRequest(options)`

Log an API request. This is called automatically by the `withApiKey` middleware but can also be used standalone.

```js
import { logApiRequest } from "@/lib/apiPlatform";

await logApiRequest({
  apiKeyId: "key-uuid",
  userId: "user-uuid",
  organizationId: "org-uuid",
  method: "POST",
  path: "/api/campaigns",
  queryParams: { page: 1 },
  requestBodyHash: "sha256...", // optional
  responseStatus: 201,
  responseTimeMs: 142,
  ipAddress: "192.168.1.1", // automatically hashed
  userAgent: "MyApp/1.0",
  scopeUsed: "campaigns:write",
  errorMessage: null, // set on errors
});
```

**Parameters:**

| Parameter         | Type     | Required | Description                       |
| ----------------- | -------- | -------- | --------------------------------- |
| `apiKeyId`        | `string` | No       | API key UUID                      |
| `userId`          | `string` | No       | User UUID                         |
| `organizationId`  | `string` | No       | Organization UUID                 |
| `method`          | `string` | No       | HTTP method (default: `"GET"`)    |
| `path`            | `string` | No       | Request path (default: `"/"`)     |
| `queryParams`     | `object` | No       | Query parameters                  |
| `requestBodyHash` | `string` | No       | SHA-256 hash of request body      |
| `responseStatus`  | `number` | No       | HTTP response status              |
| `responseTimeMs`  | `number` | No       | Response time in milliseconds     |
| `ipAddress`       | `string` | No       | Client IP (hashed before storage) |
| `userAgent`       | `string` | No       | User-Agent header                 |
| `scopeUsed`       | `string` | No       | API scope used for the request    |
| `errorMessage`    | `string` | No       | Error message if request failed   |

**Note:** This function is fire-and-forget. Errors in logging do not propagate to the caller.

---

### `getApiLogs(options)`

Query API logs with filters.

```js
const result = await getApiLogs({
  apiKeyId: "key-uuid", // optional
  userId: "user-uuid", // optional
  organizationId: "org-uuid", // optional
  method: "POST", // optional
  responseStatus: 429, // optional
  startDate: "2024-01-01T00:00:00Z",
  endDate: "2024-01-31T23:59:59Z",
  limit: 100,
  offset: 0,
});
```

---

### `getApiUsageSummary(options)`

Get an aggregated usage summary by day. Returns total requests, successes, and errors per day.

```js
const result = await getApiUsageSummary({
  apiKeyId: "key-uuid", // optional
  organizationId: "org-uuid", // optional
  startDate: "2024-01-01T00:00:00Z",
  endDate: "2024-01-31T23:59:59Z",
  limit: 30, // number of days
});
// result.data: [
//   { date: "2024-01-15", total: 1523, success: 1498, errors: 25 },
//   { date: "2024-01-14", total: 1204, success: 1189, errors: 15 },
//   ...
// ]
```

## Developer App Registration

Developer apps enable OAuth-style integrations. Each app has a `client_id` and `client_secret` (returned only on creation).

### `createDeveloperApp(options)`

Register a new developer application.

```js
import { createDeveloperApp } from "@/lib/apiPlatform";

const result = await createDeveloperApp({
  userId: "user-uuid",
  organizationId: "org-uuid", // optional
  name: "My Integration App",
  description: "Integrates with Fundora campaigns",
  appType: "web", // optional, default: "web"
  redirectUris: ["https://myapp.com/callback"], // optional
});

// result.data.client_secret — "fks_..." — STORE THIS securely
```

**Parameters:**

| Parameter        | Type       | Required | Default | Description                                                 |
| ---------------- | ---------- | -------- | ------- | ----------------------------------------------------------- |
| `userId`         | `string`   | Yes      | —       | Owner user UUID                                             |
| `organizationId` | `string`   | No       | `null`  | Organization UUID                                           |
| `name`           | `string`   | Yes      | —       | Application name                                            |
| `description`    | `string`   | No       | —       | Application description                                     |
| `appType`        | `string`   | No       | `"web"` | One of: `"web"`, `"mobile"`, `"server"`, `"cli"`, `"other"` |
| `redirectUris`   | `string[]` | No       | `[]`    | OAuth redirect URIs                                         |

**Client ID format:** 32 hex characters (16 random bytes).
**Client Secret format:** `fks_` prefix + 64 hex characters (32 random bytes).

**Side effects:** Logs a `developer_app_created` audit event.

---

### `validateDeveloperApp(clientId, clientSecret)`

Validate a developer app's credentials by comparing the SHA-256 hash of the provided secret against the stored hash.

```js
const result = await validateDeveloperApp("client-id", "fks_...");
// result.data: { id, name, app_type, redirect_uris, ... }
```

**Parameters:**

| Parameter      | Type     | Required | Description               |
| -------------- | -------- | -------- | ------------------------- |
| `clientId`     | `string` | Yes      | Application client ID     |
| `clientSecret` | `string` | Yes      | Application client secret |

**Returns:**

```js
// Success:
{ success: true, data: { id, name, app_type, redirect_uris, status: "active", ... } }

// Invalid:
{ success: false, error: "Invalid client secret" }
```

---

### `revokeDeveloperApp(appId, userId)`

Revoke a developer application. Sets status to `"revoked"`. Only the app owner can revoke.

```js
const result = await revokeDeveloperApp("app-uuid", "user-uuid");
```

**Side effects:** Logs a `developer_app_revoked` audit event.

---

### `listDeveloperApps(options)`

List developer apps for a user or organization.

```js
const result = await listDeveloperApps({
  userId: "user-uuid", // optional
  organizationId: "org-uuid", // optional
  limit: 50,
  offset: 0,
});
```

---

### `getDeveloperApp(clientId)`

Get a developer app by its client ID.

```js
const result = await getDeveloperApp("client-id-32chars");
```

## withApiKey Middleware

The `withApiKey` middleware wraps API route handlers to require API key authentication via the `X-API-Key` header.

### Usage

```js
import { withApiKey } from "@/lib/apiPlatform";

export default withApiKey(async function handler(req, res) {
  // req.apiKey — full API key record
  // req.user — { id: keyData.user_id }
  // Rate limiting already applied

  return res.status(200).json({ message: "Authenticated via API key" });
});
```

### Authentication Flow

```
Request arrives with X-API-Key header
    │
    ├── No header → 401: "API key required (X-API-Key header)"
    │
    ▼
Hash the key with SHA-256
    │
    ▼
validateApiKey(hash)
    │
    ├── Invalid/revoked → 401: "Invalid API key"
    ├── Expired → 401: "API key has expired"
    │
    ▼
Attach req.apiKey and req.user
    │
    ▼
Apply per-key rate limiting
    │
    ├── Rate limit exceeded → 429: "Too many requests"
    │
    ▼
Intercept res.json to log the request
    │
    ▼
Call handler(req, res)
```

### Rate Limiting

Rate limiting is applied per API key using the key's configured `rate_limit` and `rate_window_ms` values. The middleware uses the existing `rateLimit` function from `lib/rateLimit.js`.

**Rate limit headers:**

| Header                  | Description                                 |
| ----------------------- | ------------------------------------------- |
| `X-RateLimit-Limit`     | Max requests per window                     |
| `X-RateLimit-Remaining` | Remaining requests in current window        |
| `X-RateLimit-Reset`     | Unix timestamp when the window resets       |
| `Retry-After`           | Seconds until the next window (only on 429) |

### Request Logging

The middleware intercepts `res.json()` to automatically log every API request to `api_logs`. The log includes:

- API key ID, user ID, organization ID
- HTTP method, path, query parameters
- Response status code and response time
- User-Agent header

Logging is fire-and-forget — if logging fails, it does not affect the API response.

## Barrel Exports

All functions are re-exported from `lib/apiPlatform/index.js`:

```js
// API Key Engine
export {
  createApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
  getApiKeyUsage,
  hashApiKey,
};

// API Log Engine
export { logApiRequest, getApiLogs, getApiUsageSummary };

// Developer App Engine
export {
  createDeveloperApp,
  validateDeveloperApp,
  revokeDeveloperApp,
  listDeveloperApps,
  getDeveloperApp,
};

// Middleware
export { withApiKey };
```

## Database Tables

| Table            | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `api_keys`       | API key records with hashed key, prefix, scopes, rate limits, expiration |
| `api_logs`       | Append-only API request logs with response status and timing             |
| `developer_apps` | OAuth-ready application registrations with client credentials            |

### Key Indexes

- `api_keys.key_hash` — Primary lookup for validation
- `api_keys.key_prefix` — Prefix-based key identification
- `api_logs.api_key_id` — Usage queries per key
- `api_logs.created_at` — Time-range queries
- `developer_apps.client_id` — App credential lookup

## API Routes

| Route                    | Method   | Description                                     |
| ------------------------ | -------- | ----------------------------------------------- |
| `/api/api-platform/keys` | GET/POST | API key management (create, list, revoke)       |
| `/api/api-platform/logs` | GET      | Query API logs and usage summaries              |
| `/api/api-platform/apps` | GET/POST | Developer app management (create, list, revoke) |

## Security Considerations

- **Plaintext keys shown once** — The full API key is returned only in the creation response. It cannot be retrieved later.
- **Keys stored as hashes** — Only SHA-256 hashes are stored in the database.
- **IP addresses hashed** — Raw IP addresses are hashed via `hashIP` before storage in `api_logs`.
- **Request body hashed** — Request bodies are not stored; only their SHA-256 hash is logged.
- **Audit trail** — All key creation and revocation events are audit-logged.
- **Expiration support** — Keys can have an optional expiration date.
- **Ownership enforcement** — Only the key owner can revoke their keys.

## Tests

- `tests/lib/apiPlatform/apiKeyEngine.test.js` — API key CRUD and validation tests
- `tests/lib/apiPlatform/apiLogEngine.test.js` — Logging and query tests
- `tests/lib/apiPlatform/developerAppEngine.test.js` — Developer app registration and validation tests
