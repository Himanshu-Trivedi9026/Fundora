# Fundora Java SDK

> Developer documentation for integrating with the Fundora Public API using Java.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Authentication](#authentication)
- [Making API Requests](#making-api-requests)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Quick Start

### Prerequisites

- Java 17+ (for `java.net.http.HttpClient`)
- Maven or Gradle
- A Fundora API key (generate one in the Fundora Dashboard → Settings → API Keys)

### Minimal Example

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class FundoraExample {
    private static final String FUNDORA_API = "https://api.fundora.in";
    private static final String API_KEY = System.getenv("FUNDORA_API_KEY");

    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(FUNDORA_API + "/api/campaigns?limit=5"))
            .header("X-API-Key", API_KEY)
            .GET()
            .build();

        HttpResponse<String> response = client.send(
            request, HttpResponse.BodyHandlers.ofString()
        );

        System.out.println(response.body());
    }
}
```

---

## Installation

### Maven

```xml
<dependencies>
    <!-- No external HTTP library required — uses java.net.http.HttpClient -->
    <!-- For JSON parsing, add your preferred library: -->

    <!-- Jackson -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
        <version>2.17.0</version>
    </dependency>

    <!-- Or Gson -->
    <dependency>
        <groupId>com.google.code.gson</groupId>
        <artifactId>gson</artifactId>
        <version>2.11.0</version>
    </dependency>
</dependencies>
```

### Gradle

```groovy
dependencies {
    implementation "com.fasterxml.jackson.core:jackson-databind:2.17.0"
    // Or: implementation "com.google.code.gson:gson:2.11.0"
}
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

```java
public class FundoraConfig {
    public static final String BASE_URL = "https://api.fundora.in";
    public static final String API_KEY = System.getenv("FUNDORA_API_KEY");
}
```

> **Security**: Store API keys in environment variables or a secrets manager (AWS Secrets Manager, HashiCorp Vault). Never commit them to source control.

---

## Making API Requests

### Using HttpClient (Java 17+)

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class FundoraClient {
    private static final String BASE_URL = "https://api.fundora.in";
    private final HttpClient httpClient;
    private final String apiKey;
    private final ObjectMapper objectMapper;

    public FundoraClient(String apiKey) {
        this.apiKey = apiKey;
        this.httpClient = HttpClient.newHttpClient();
        this.objectMapper = new ObjectMapper();
    }

    // ─── Generic Request ────────────────────────────────────

    public JsonNode request(String method, String path, String body)
            throws FundoraApiException {

        try {
            String url = BASE_URL + path;
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("X-API-Key", apiKey)
                .header("Content-Type", "application/json");

            switch (method) {
                case "GET":
                    builder.GET();
                    break;
                case "POST":
                    builder.POST(body != null
                        ? HttpRequest.BodyPublishers.ofString(body)
                        : HttpRequest.BodyPublishers.noBody());
                    break;
                default:
                    throw new IllegalArgumentException("Unsupported method: " + method);
            }

            HttpResponse<String> response = httpClient.send(
                builder.build(),
                HttpResponse.BodyHandlers.ofString()
            );

            JsonNode jsonNode = objectMapper.readTree(response.body());

            if (response.statusCode() >= 400) {
                String errorMessage = jsonNode.has("error")
                    ? jsonNode.get("error").asText()
                    : "HTTP " + response.statusCode();
                throw new FundoraApiException(response.statusCode(), errorMessage, jsonNode);
            }

            return jsonNode;

        } catch (FundoraApiException e) {
            throw e;
        } catch (Exception e) {
            throw new FundoraApiException(0, "Request failed: " + e.getMessage(), null);
        }
    }

    // ─── Convenience Methods ────────────────────────────────

    public JsonNode get(String path) throws FundoraApiException {
        return request("GET", path, null);
    }

    public JsonNode post(String path, Object body) throws FundoraApiException {
        String json = objectMapper.writeValueAsString(body);
        return request("POST", path, json);
    }

    // ─── Campaigns ──────────────────────────────────────────

    public JsonNode listCampaigns(int limit, int offset) throws FundoraApiException {
        return get("/api/campaigns?limit=" + limit + "&offset=" + offset);
    }

    // ─── Donations ──────────────────────────────────────────

    public JsonNode createDonation(String campaignId, int amount, String currency)
            throws FundoraApiException {
        Map<String, Object> body = Map.of(
            "campaignId", campaignId,
            "amount", amount,
            "currency", currency
        );
        return post("/api/donations", body);
    }

    // ─── Webhooks ───────────────────────────────────────────

    public JsonNode listWebhooks(int limit, int offset) throws FundoraApiException {
        return get("/api/webhooks?limit=" + limit + "&offset=" + offset);
    }

    public JsonNode createWebhook(String url, List<String> events, String description)
            throws FundoraApiException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("action", "create");
        body.put("url", url);
        body.put("events", events);
        if (description != null) {
            body.put("description", description);
        }
        return post("/api/webhooks", body);
    }

    public JsonNode testWebhook(String webhookId) throws FundoraApiException {
        return post("/api/webhooks/test", Map.of("webhookId", webhookId));
    }

    public JsonNode deleteWebhook(String webhookId) throws FundoraApiException {
        return post("/api/webhooks", Map.of(
            "action", "delete",
            "webhookId", webhookId
        ));
    }

    public JsonNode updateWebhook(String webhookId, Map<String, Object> updates)
            throws FundoraApiException {
        return post("/api/webhooks", Map.of(
            "action", "update",
            "webhookId", webhookId,
            "updates", updates
        ));
    }

    // ─── API Keys ───────────────────────────────────────────

    public JsonNode listApiKeys() throws FundoraApiException {
        return get("/api/api-platform/keys");
    }

    public JsonNode createApiKey(String name, List<String> scopes)
            throws FundoraApiException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("action", "create");
        body.put("name", name);
        if (scopes != null) {
            body.put("scopes", scopes);
        }
        return post("/api/api-platform/keys", body);
    }

    public JsonNode revokeApiKey(String keyId) throws FundoraApiException {
        return post("/api/api-platform/keys", Map.of(
            "action", "revoke",
            "keyId", keyId
        ));
    }

    // ─── API Logs ───────────────────────────────────────────

    public JsonNode getApiLogs(int limit, int offset) throws FundoraApiException {
        return get("/api/api-platform/logs?limit=" + limit + "&offset=" + offset);
    }

    public JsonNode getUsageSummary() throws FundoraApiException {
        return get("/api/api-platform/logs?mode=summary");
    }
}
```

---

## Error Handling

### Custom Exception

```java
import com.fasterxml.jackson.databind.JsonNode;

public class FundoraApiException extends Exception {
    private final int statusCode;
    private final String message;
    private final JsonNode body;

    public FundoraApiException(int statusCode, String message, JsonNode body) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.body = body;
    }

    public int getStatusCode() {
        return statusCode;
    }

    @Override
    public String getMessage() {
        return message;
    }

    public JsonNode getBody() {
        return body;
    }

    /** Whether this error was caused by rate limiting. */
    public boolean isRateLimited() {
        return statusCode == 429;
    }

    /** Whether this error was caused by authentication failure. */
    public boolean isAuthError() {
        return statusCode == 401;
    }

    /** Whether this error was caused by bad input. */
    public boolean isBadRequest() {
        return statusCode == 400;
    }

    /** Seconds to wait before retrying (only for 429 errors). */
    public int getRetryAfter() {
        if (isRateLimited() && body != null && body.has("retryAfter")) {
            return body.get("retryAfter").asInt();
        }
        return 60; // Default fallback
    }
}
```

### Error Handling Pattern

```java
public class FundoraExample {
    public static void main(String[] args) {
        FundoraClient client = new FundoraClient(System.getenv("FUNDORA_API_KEY"));

        try {
            JsonNode result = client.listCampaigns(10, 0);
            int total = result.get("total").asInt();
            System.out.println("Found " + total + " campaigns");

        } catch (FundoraApiException e) {
            if (e.isRateLimited()) {
                System.out.println("Rate limited. Retry after " + e.getRetryAfter() + "s");
            } else if (e.isAuthError()) {
                System.out.println("Authentication failed. Check your API key.");
            } else if (e.isBadRequest()) {
                System.out.println("Bad request: " + e.getMessage());
            } else {
                System.out.println("API error (" + e.getStatusCode() + "): " + e.getMessage());
            }
        } catch (Exception e) {
            System.out.println("Unexpected error: " + e.getMessage());
        }
    }
}
```

### Retry with Exponential Backoff

```java
import java.time.Duration;

public class FundoraRetryClient {
    private final FundoraClient client;
    private final int maxRetries;

    public FundoraRetryClient(String apiKey, int maxRetries) {
        this.client = new FundoraClient(apiKey);
        this.maxRetries = maxRetries;
    }

    public <T> T executeWithRetry(Callable<T> action) throws FundoraApiException {
        int attempts = 0;

        while (true) {
            try {
                return action.call();
            } catch (FundoraApiException e) {
                attempts++;
                if (!e.isRateLimited() || attempts >= maxRetries) {
                    throw e;
                }

                int retryAfter = e.getRetryAfter();
                System.out.printf("Rate limited (attempt %d/%d). Waiting %ds...%n",
                    attempts, maxRetries, retryAfter);

                try {
                    Thread.sleep(Duration.ofSeconds(retryAfter).toMillis());
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw e;
                }
            }
        }
    }
}

// Usage
FundoraRetryClient retryClient = new FundoraRetryClient(apiKey, 3);
JsonNode result = retryClient.executeWithRetry(() -> client.listCampaigns(10, 0));
```

---

## Rate Limiting

Every API key has configurable rate limits (default: 100 requests per 60-second window).

### Rate Limit Headers

Every response includes these headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed per window |
| `X-RateLimit-Remaining` | Remaining requests in the current window |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the window resets |

### Reading Rate Limit Headers

```java
public class RateLimitInfo {
    public final int limit;
    public final int remaining;
    public final long reset;

    public RateLimitInfo(int limit, int remaining, long reset) {
        this.limit = limit;
        this.remaining = remaining;
        this.reset = reset;
    }

    public static RateLimitInfo fromHeaders(HttpResponse<String> response) {
        int limit = Integer.parseInt(
            response.headers().firstValue("X-RateLimit-Limit").orElse("0")
        );
        int remaining = Integer.parseInt(
            response.headers().firstValue("X-RateLimit-Remaining").orElse("0")
        );
        long reset = Long.parseLong(
            response.headers().firstValue("X-RateLimit-Reset").orElse("0")
        );
        return new RateLimitInfo(limit, remaining, reset);
    }

    public boolean isApproachingLimit() {
        return remaining < 5;
    }
}
```

### Proactive Throttling

```java
public class ThrottledFundoraClient extends FundoraClient {
    private long lastResetTime = 0;

    public ThrottledFundoraClient(String apiKey) {
        super(apiKey);
    }

    // Override request to add throttling
    public JsonNode throttledGet(String path) throws FundoraApiException {
        // Check if we should wait before making the request
        if (System.currentTimeMillis() / 1000 < lastResetTime) {
            long waitSeconds = lastResetTime - System.currentTimeMillis() / 1000;
            if (waitSeconds > 0 && waitSeconds < 60) {
                System.out.printf("Approaching rate limit. Waiting %ds...%n", waitSeconds);
                try {
                    Thread.sleep(Duration.ofSeconds(waitSeconds).toMillis());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }

        return get(path);
    }
}
```

---

## Examples

### Complete Integration

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;

public class FundoraIntegration {
    private static final FundoraClient client =
        new FundoraClient(System.getenv("FUNDORA_API_KEY"));
    private static final ObjectMapper mapper = new ObjectMapper();

    public static void main(String[] args) throws Exception {
        // ─── List Campaigns ─────────────────────────────────
        JsonNode campaigns = client.listCampaigns(5, 0);
        System.out.println("Campaigns: " + campaigns.get("total").asInt());

        for (JsonNode campaign : campaigns.get("data")) {
            System.out.printf("  %s — ₹%d/%d%n",
                campaign.get("title").asText(),
                campaign.get("raisedAmount").asInt(),
                campaign.get("goalAmount").asInt());
        }

        // ─── Create Donation ────────────────────────────────
        JsonNode donation = client.createDonation(
            "campaign-uuid",
            5000,
            "INR"
        );
        System.out.println("Donation: " + donation.get("data").get("id").asText());

        // ─── Create Webhook ─────────────────────────────────
        JsonNode webhook = client.createWebhook(
            "https://myapp.com/webhooks/fundora",
            List.of("donation.received", "campaign.funded", "escrow.released"),
            "Production webhook"
        );

        String webhookId = webhook.get("data").get("id").asText();
        String secret = webhook.get("data").get("secret").asText();
        System.out.println("Webhook created: " + webhookId);
        System.out.println("Secret: " + secret);  // Store securely!

        // ─── Test Webhook ───────────────────────────────────
        JsonNode testResult = client.testWebhook(webhookId);
        System.out.println("Test: " + testResult.get("data").get("status").asText());

        // ─── List API Logs ──────────────────────────────────
        JsonNode logs = client.getApiLogs(20, 0);
        System.out.println("Log entries: " + logs.get("total").asInt());

        // ─── Usage Summary ──────────────────────────────────
        JsonNode summary = client.getUsageSummary();
        for (JsonNode day : summary.get("data")) {
            System.out.printf("  %s — %d requests (%d errors)%n",
                day.get("date").asText(),
                day.get("total").asInt(),
                day.get("errors").asInt());
        }
    }
}
```

### Webhook Receiver (Spring Boot)

```java
import org.springframework.web.bind.annotation.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/webhooks/fundora")
public class FundoraWebhookController {

    private static final String WEBHOOK_SECRET = System.getenv("FUNDORA_WEBHOOK_SECRET");

    @PostMapping
    public ResponseEntity<Map<String, Object>> handleWebhook(
            @RequestBody String payload,
            @RequestHeader("X-Fundora-Signature") String signature,
            @RequestHeader("X-Fundora-Event") String eventType,
            @RequestHeader("X-Fundora-Delivery-Id") String deliveryId) {

        // Verify HMAC-SHA256 signature
        if (!verifySignature(payload, signature, WEBHOOK_SECRET)) {
            return ResponseEntity.status(401)
                .body(Map.of("error", "Invalid signature"));
        }

        ObjectMapper mapper = new ObjectMapper();
        try {
            JsonNode body = mapper.readTree(payload);
            String event = body.get("event").asText();

            switch (event) {
                case "donation.received":
                    JsonNode donationData = body.get("data");
                    System.out.printf("Donation: %s %s for campaign %s%n",
                        donationData.get("amount"),
                        donationData.get("currency"),
                        donationData.get("campaignId"));
                    break;

                case "campaign.funded":
                    System.out.println("Campaign funded: " +
                        body.get("data").get("campaignId"));
                    break;

                case "escrow.released":
                    System.out.println("Escrow released: " +
                        body.get("data").get("escrowId"));
                    break;

                case "test.ping":
                    System.out.println("Test ping received");
                    break;

                default:
                    System.out.println("Unhandled event: " + event);
            }
        } catch (Exception e) {
            System.err.println("Error processing webhook: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of("received", true));
    }

    private boolean verifySignature(String payload, String signature, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expectedBytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));

            StringBuilder sb = new StringBuilder();
            for (byte b : expectedBytes) {
                sb.append(String.format("%02x", b));
            }
            String expected = sb.toString();

            return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                (signature != null ? signature : "").getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            return false;
        }
    }
}
```

### Pagination Helper

```java
public List<JsonNode> fetchAllCampaigns(FundoraClient client) throws FundoraApiException {
    List<JsonNode> allCampaigns = new ArrayList<>();
    int offset = 0;
    int limit = 50;

    while (true) {
        JsonNode result = client.listCampaigns(limit, offset);
        JsonNode data = result.get("data");

        for (JsonNode campaign : data) {
            allCampaigns.add(campaign);
        }

        int total = result.get("total").asInt();
        if (allCampaigns.size() >= total || data.size() < limit) {
            break;
        }

        offset += limit;
    }

    return allCampaigns;
}
```
