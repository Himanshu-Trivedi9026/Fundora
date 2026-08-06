# Fundora Python SDK

> Developer documentation for integrating with the Fundora Public API using Python.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Authentication](#authentication)
- [Making API Requests](#making-api-requests)
- [Async Support](#async-support)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Quick Start

### Prerequisites

- Python 3.9+
- A Fundora API key (generate one in the Fundora Dashboard → Settings → API Keys)

### Installation

```bash
pip install requests
# For async support:
pip install httpx
```

### Minimal Example

```python
import os
import requests

FUNDORA_API = "https://api.fundora.in"
API_KEY = os.environ["FUNDORA_API_KEY"]

response = requests.get(
    f"{FUNDORA_API}/api/campaigns",
    headers={"X-API-Key": API_KEY},
)
print(response.json())
```

---

## Authentication

All requests require an `X-API-Key` header with a valid Fundora API key.

### API Key Format

Fundora API keys follow the format:

```
fk_{prefix}_{body}
```

- **prefix**: 8-character hex string used for key lookup
- **body**: 64-character hex string (random)
- **Total length**: 75 characters

Example: `fk_a1b2c3d4_e5f6789012345678abcdef0123456789abcdef0123456789abcdef0123456789`

### Setting Up

```python
import os

FUNDORA_API = "https://api.fundora.in"
API_KEY = os.environ["FUNDORA_API_KEY"]  # Set in .env or shell
```

> **Security**: Store API keys in environment variables or a secrets manager. Never commit them to version control.

---

## Making API Requests

### Synchronous (requests)

```python
import os
import requests

FUNDORA_API = "https://api.fundora.in"
API_KEY = os.environ["FUNDORA_API_KEY"]

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
}

# GET request
response = requests.get(
    f"{FUNDORA_API}/api/campaigns",
    headers=headers,
    params={"limit": 10},
)
data = response.json()

# POST request
response = requests.post(
    f"{FUNDORA_API}/api/donations",
    headers=headers,
    json={
        "campaignId": "campaign-uuid",
        "amount": 5000,
        "currency": "INR",
    },
)
data = response.json()
```

### Reusable Client

```python
import os
import requests
from typing import Any, Optional


class FundoraClient:
    """Fundora API client using requests."""

    def __init__(self, api_key: str, base_url: str = "https://api.fundora.in"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        })

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict] = None,
        json_body: Optional[dict] = None,
    ) -> dict[str, Any]:
        response = self.session.request(
            method,
            f"{self.base_url}{path}",
            params=params,
            json=json_body,
        )
        body = response.json()
        if not response.ok:
            raise FundoraApiError(response.status_code, body)
        return body

    def get(self, path: str, params: Optional[dict] = None) -> dict[str, Any]:
        return self._request("GET", path, params=params)

    def post(self, path: str, body: Optional[dict] = None) -> dict[str, Any]:
        return self._request("POST", path, json_body=body)

    # ─── Campaigns ───────────────────────────────────────────

    def list_campaigns(
        self, limit: int = 50, offset: int = 0, **kwargs
    ) -> dict[str, Any]:
        return self.get("/api/campaigns", params={"limit": limit, "offset": offset, **kwargs})

    # ─── Donations ───────────────────────────────────────────

    def create_donation(
        self,
        campaign_id: str,
        amount: int,
        currency: str = "INR",
        donor_email: Optional[str] = None,
        note: Optional[str] = None,
    ) -> dict[str, Any]:
        body = {
            "campaignId": campaign_id,
            "amount": amount,
            "currency": currency,
        }
        if donor_email:
            body["donorEmail"] = donor_email
        if note:
            body["note"] = note
        return self.post("/api/donations", body)

    # ─── Webhooks ────────────────────────────────────────────

    def list_webhooks(self, limit: int = 50, offset: int = 0) -> dict[str, Any]:
        return self.get("/api/webhooks", params={"limit": limit, "offset": offset})

    def list_webhook_events(self) -> dict[str, Any]:
        return self.get("/api/webhooks", params={"mode": "events"})

    def create_webhook(
        self,
        url: str,
        events: list[str],
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"action": "create", "url": url, "events": events}
        if description:
            body["description"] = description
        return self.post("/api/webhooks", body)

    def update_webhook(
        self, webhook_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        return self.post("/api/webhooks", {
            "action": "update",
            "webhookId": webhook_id,
            "updates": updates,
        })

    def delete_webhook(self, webhook_id: str) -> dict[str, Any]:
        return self.post("/api/webhooks", {
            "action": "delete",
            "webhookId": webhook_id,
        })

    def test_webhook(self, webhook_id: str) -> dict[str, Any]:
        return self.post("/api/webhooks/test", {"webhookId": webhook_id})

    # ─── API Keys ────────────────────────────────────────────

    def list_api_keys(self, **kwargs) -> dict[str, Any]:
        return self.get("/api/api-platform/keys", params=kwargs)

    def create_api_key(
        self, name: str, scopes: Optional[list[str]] = None, **kwargs
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"action": "create", "name": name}
        if scopes:
            body["scopes"] = scopes
        body.update(kwargs)
        return self.post("/api/api-platform/keys", body)

    def revoke_api_key(self, key_id: str) -> dict[str, Any]:
        return self.post("/api/api-platform/keys", {
            "action": "revoke",
            "keyId": key_id,
        })

    # ─── API Logs ────────────────────────────────────────────

    def get_api_logs(self, **kwargs) -> dict[str, Any]:
        return self.get("/api/api-platform/logs", params=kwargs)

    def get_usage_summary(self, **kwargs) -> dict[str, Any]:
        params = {"mode": "summary", **kwargs}
        return self.get("/api/api-platform/logs", params=params)
```

---

## Async Support

### Using httpx

```python
import os
import httpx
from typing import Any, Optional


class AsyncFundoraClient:
    """Async Fundora API client using httpx."""

    def __init__(self, api_key: str, base_url: str = "https://api.fundora.in"):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def close(self):
        await self.client.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict] = None,
        json_body: Optional[dict] = None,
    ) -> dict[str, Any]:
        response = await self.client.request(
            method, path, params=params, json=json_body
        )
        body = response.json()
        if response.status_code >= 400:
            raise FundoraApiError(response.status_code, body)
        return body

    # ─── Campaigns ───────────────────────────────────────────

    async def list_campaigns(
        self, limit: int = 50, offset: int = 0
    ) -> dict[str, Any]:
        return await self._request("GET", "/api/campaigns", params={"limit": limit, "offset": offset})

    # ─── Donations ───────────────────────────────────────────

    async def create_donation(
        self,
        campaign_id: str,
        amount: int,
        currency: str = "INR",
        donor_email: Optional[str] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "campaignId": campaign_id,
            "amount": amount,
            "currency": currency,
        }
        if donor_email:
            body["donorEmail"] = donor_email
        return await self._request("POST", "/api/donations", json_body=body)

    # ─── Webhooks ────────────────────────────────────────────

    async def list_webhooks(self, limit: int = 50) -> dict[str, Any]:
        return await self._request("GET", "/api/webhooks", params={"limit": limit})

    async def create_webhook(
        self,
        url: str,
        events: list[str],
        description: Optional[str] = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"action": "create", "url": url, "events": events}
        if description:
            body["description"] = description
        return await self._request("POST", "/api/webhooks", json_body=body)

    async def delete_webhook(self, webhook_id: str) -> dict[str, Any]:
        return await self._request("POST", "/api/webhooks", json_body={
            "action": "delete",
            "webhookId": webhook_id,
        })

    async def test_webhook(self, webhook_id: str) -> dict[str, Any]:
        return await self._request("POST", "/api/webhooks/test", json_body={
            "webhookId": webhook_id,
        })
```

### Async Usage

```python
import asyncio
import os


async def main():
    client = AsyncFundoraClient(os.environ["FUNDORA_API_KEY"])

    try:
        # List campaigns
        result = await client.list_campaigns(limit=5)
        print(f"Found {result['total']} campaigns")

        for campaign in result["data"]:
            print(f"  {campaign['title']} — ₹{campaign['raisedAmount']}/{campaign['goalAmount']}")

        # Create webhook
        webhook_result = await client.create_webhook(
            url="https://myapp.com/webhooks",
            events=["donation.received", "campaign.funded"],
            description="Production webhook",
        )
        webhook = webhook_result["data"]
        print(f"Webhook created: {webhook['id']}")
        print(f"Secret: {webhook['secret']}")  # Store securely — shown only once

        # Test webhook
        test_result = await client.test_webhook(webhook["id"])
        print(f"Test delivery: {test_result['data']['status']}")

        # Clean up
        await client.delete_webhook(webhook["id"])

    finally:
        await client.close()


asyncio.run(main())
```

### Parallel Requests

```python
import asyncio
import os


async def fetch_multiple_endpoints():
    client = AsyncFundoraClient(os.environ["FUNDORA_API_KEY"])

    try:
        # Run multiple requests concurrently
        campaigns, webhooks, logs = await asyncio.gather(
            client.list_campaigns(limit=10),
            client.list_webhooks(limit=10),
            client.get_api_logs(limit=10),
        )

        print(f"Campaigns: {campaigns['total']}")
        print(f"Webhooks: {webhooks['total']}")
        print(f"Log entries: {logs['total']}")

    finally:
        await client.close()


asyncio.run(fetch_multiple_endpoints())
```

---

## Error Handling

### Custom Exception

```python
class FundoraApiError(Exception):
    """Raised when the Fundora API returns an error response."""

    def __init__(self, status_code: int, body: dict):
        self.status_code = status_code
        self.body = body
        self.message = body.get("error", f"HTTP {status_code}")
        super().__init__(self.message)

    @property
    def is_rate_limited(self) -> bool:
        return self.status_code == 429

    @property
    def is_auth_error(self) -> bool:
        return self.status_code == 401

    @property
    def is_bad_request(self) -> bool:
        return self.status_code == 400

    @property
    def retry_after(self) -> int | None:
        if self.is_rate_limited:
            return self.body.get("retryAfter")
        return None
```

### Error Handling Pattern

```python
import requests


def fundora_request(method: str, path: str, **kwargs):
    """Make a request to the Fundora API with error handling."""
    try:
        response = requests.request(
            method,
            f"https://api.fundora.in{path}",
            headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
            **kwargs,
        )
        body = response.json()

        if response.status_code == 401:
            raise FundoraApiError(401, body)
        elif response.status_code == 429:
            retry_after = body.get("retryAfter", 60)
            print(f"Rate limited. Retry after {retry_after}s")
            raise FundoraApiError(429, body)
        elif response.status_code == 400:
            print(f"Bad request: {body.get('error')}")
            raise FundoraApiError(400, body)
        elif response.status_code >= 400:
            raise FundoraApiError(response.status_code, body)

        return body

    except requests.exceptions.RequestException as e:
        print(f"Network error: {e}")
        raise
```

### Retry with Backoff

```python
import time
import requests


def fundora_request_with_retry(
    method: str,
    path: str,
    max_retries: int = 3,
    **kwargs,
):
    """Make a request with automatic retry on rate limiting."""
    for attempt in range(max_retries):
        response = requests.request(
            method,
            f"https://api.fundora.in{path}",
            headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
            **kwargs,
        )

        if response.status_code != 429:
            body = response.json()
            if response.status_code >= 400:
                raise FundoraApiError(response.status_code, body)
            return body

        # Rate limited — wait and retry
        retry_after = response.json().get("retryAfter", 60)
        if attempt < max_retries - 1:
            print(f"Rate limited (attempt {attempt + 1}/{max_retries}). "
                  f"Waiting {retry_after}s...")
            time.sleep(retry_after)

    raise FundoraApiError(429, {"error": "Rate limited after max retries"})
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

### Reading Rate Limit Headers

```python
response = requests.get(
    "https://api.fundora.in/api/campaigns",
    headers={"X-API-Key": API_KEY},
)

limit = int(response.headers.get("X-RateLimit-Limit", 0))
remaining = int(response.headers.get("X-RateLimit-Remaining", 0))
reset = int(response.headers.get("X-RateLimit-Reset", 0))

print(f"Remaining: {remaining}/{limit}")
print(f"Resets at: {reset}")
```

### Proactive Throttling

```python
import time


class ThrottledClient(FundoraClient):
    """Client that automatically pauses when approaching rate limits."""

    def _request(self, method, path, params=None, json_body=None):
        response = self.session.request(
            method,
            f"{self.base_url}{path}",
            params=params,
            json=json_body,
        )

        remaining = int(response.headers.get("X-RateLimit-Remaining", 100))
        reset = int(response.headers.get("X-RateLimit-Reset", 0))

        if remaining < 5:
            now = int(time.time())
            wait = max(0, reset - now)
            if wait > 0:
                print(f"Approaching rate limit. Waiting {wait}s...")
                time.sleep(wait)

        body = response.json()
        if not response.ok:
            raise FundoraApiError(response.status_code, body)
        return body
```

---

## Examples

### List All Campaigns with Pagination

```python
client = FundoraClient(API_KEY)

all_campaigns = []
offset = 0
limit = 50

while True:
    result = client.list_campaigns(limit=limit, offset=offset)
    all_campaigns.extend(result["data"])

    if len(all_campaigns) >= result["total"] or len(result["data"]) < limit:
        break

    offset += limit

print(f"Total campaigns: {len(all_campaigns)}")
for campaign in all_campaigns:
    print(f"  {campaign['title']} — ₹{campaign['raisedAmount']}")
```

### Create Donation

```python
client = FundoraClient(API_KEY)

result = client.create_donation(
    campaign_id="uuid-of-campaign",
    amount=5000,
    currency="INR",
    donor_email="donor@example.com",
    note="Keep up the great work!",
)

donation = result["data"]
print(f"Donation created: {donation['id']} — Status: {donation['status']}")
```

### Manage Webhooks

```python
client = FundoraClient(API_KEY)

# List available event types
events = client.list_webhook_events()
for event in events["data"]:
    print(f"  {event['name']}: {event['value']}")

# Create a webhook
webhook_result = client.create_webhook(
    url="https://myapp.com/webhooks/fundora",
    events=["donation.received", "campaign.funded", "escrow.released"],
    description="Production webhook for donation tracking",
)

webhook = webhook_result["data"]
print(f"Webhook created: {webhook['id']}")
print(f"Secret: {webhook['secret']}")  # Store this securely!

# Test the webhook
test_result = client.test_webhook(webhook["id"])
print(f"Test status: {test_result['data']['status']}")

# Update webhook events
client.update_webhook(
    webhook["id"],
    {"events": ["donation.received", "campaign.funded", "escrow.released", "milestone.approved"]},
)

# List webhooks
result = client.list_webhooks(limit=10)
for wh in result["data"]:
    print(f"  {wh['url']} — {wh['status']} ({len(wh['events'])} events)")

# Delete webhook
client.delete_webhook(webhook["id"])
print("Webhook deleted")
```

### API Key Management

```python
client = FundoraClient(API_KEY)

# Create a new API key
result = client.create_api_key(
    name="CI/CD Pipeline Key",
    scopes=["campaigns:read", "donations:write"],
    rateLimit=200,
    rateWindowMs=60000,
)

key = result["data"]
print(f"API key created: {key['id']}")
print(f"Key: {key['key']}")  # Store this securely!

# List all keys
keys = client.list_api_keys(status="active")
for k in keys["data"]:
    print(f"  {k['name']} — prefix: {k['key_prefix']}... — status: {k['status']}")

# Revoke a key
client.revoke_api_key(key["id"])
```

### Webhook Receiver (Flask)

```python
import hmac
import hashlib
import os
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = os.environ["FUNDORA_WEBHOOK_SECRET"]


def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify the HMAC-SHA256 signature from Fundora webhooks."""
    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


@app.route("/webhooks/fundora", methods=["POST"])
def fundora_webhook():
    signature = request.headers.get("X-Fundora-Signature", "")
    event_type = request.headers.get("X-Fundora-Event", "")
    delivery_id = request.headers.get("X-Fundora-Delivery-Id", "")

    if not verify_signature(request.data, signature, WEBHOOK_SECRET):
        return jsonify({"error": "Invalid signature"}), 401

    payload = request.json

    if event_type == "donation.received":
        data = payload["data"]
        print(f"Donation: {data['amount']} {data['currency']} for campaign {data['campaignId']}")

    elif event_type == "campaign.funded":
        data = payload["data"]
        print(f"Campaign fully funded: {data['campaignId']}")

    elif event_type == "escrow.released":
        data = payload["data"]
        print(f"Escrow released: {data.get('escrowId', 'N/A')}")

    elif event_type == "test.ping":
        print("Test ping received")

    else:
        print(f"Unhandled event: {event_type}")

    return jsonify({"received": True}), 200


if __name__ == "__main__":
    app.run(port=3000)
```
