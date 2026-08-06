# AI Platform Architecture

## Overview

Fundora's AI platform provides a unified, multi-provider AI infrastructure that powers campaign analysis, recommendations, predictions, copilots, knowledge search, and workflow automation. The architecture follows a provider-agnostic design where all AI operations flow through a central orchestrator (`aiEngine.js`) that handles routing, tracking, security, and output sanitisation.

## Provider Abstraction

### BaseModelProvider

All AI providers extend the `BaseModelProvider` abstract class, which defines a standard interface:

```javascript
class BaseModelProvider {
  async initialize(config)    // Set up credentials and client
  async chatCompletion(params) // Send chat/completion requests
  async createEmbedding(params) // Generate vector embeddings
  async healthCheck()          // Verify provider availability
}
```

### Supported Providers

| Provider       | Class                     | Default Model             | Embeddings               | Env Variable         | Priority     |
| -------------- | ------------------------- | ------------------------- | ------------------------ | -------------------- | ------------ |
| Mock           | `MockModelProvider`       | `mock-model`              | 1536-dim deterministic   | Always registered    | 100 (lowest) |
| OpenAI         | `OpenAIModelProvider`     | `gpt-4o-mini`             | `text-embedding-3-small` | `OPENAI_API_KEY`     | 10           |
| Anthropic      | `AnthropicModelProvider`  | `claude-3-haiku-20240307` | Not supported            | `ANTHROPIC_API_KEY`  | 15           |
| Gemini         | `GeminiModelProvider`     | `gemini-1.5-flash`        | `text-embedding-004`     | `GEMINI_API_KEY`     | 20           |
| OpenRouter     | `OpenRouterModelProvider` | `openai/gpt-4o-mini`      | `text-embedding-3-small` | `OPENROUTER_API_KEY` | 25           |
| Local (Ollama) | `LocalModelProvider`      | `llama3`                  | `nomic-embed-text`       | `LOCAL_AI_URL`       | 30           |

### Provider Registry (Singleton)

The registry is a `Map<string, {provider, config}>` with priority-based fallback ordering:

```javascript
registerModelProvider(name, provider, config); // Register a provider
getModelProvider(name); // Retrieve by name
setActiveModelProvider(name); // Set the active provider
getActiveModelProvider(); // Get active (falls back to mock)
listModelProviders(); // List all with status
initializeModelProviders(); // Auto-register from env vars
```

On startup, `initializeModelProviders()` reads environment variables and auto-registers each configured provider. The active provider is set from `AI_MODEL_PROVIDER` env var or the first non-mock provider by priority.

## Model Routing

The model router selects optimal models based on task type, cost constraints, and provider health.

### Task Types

| Task             | Primary Provider | Primary Model            | Purpose                      |
| ---------------- | ---------------- | ------------------------ | ---------------------------- |
| `chat`           | openai           | `gpt-4o-mini`            | General conversation         |
| `classification` | openai           | `gpt-4o-mini`            | Content classification       |
| `embedding`      | openai           | `text-embedding-3-small` | Vector embeddings            |
| `generation`     | openai           | `gpt-4o`                 | Long-form content generation |
| `analysis`       | anthropic        | `claude-3-haiku`         | Deep analysis tasks          |
| `extraction`     | openai           | `gpt-4o-mini`            | Data extraction              |

### Routing Algorithm

1. Look up the primary provider/model for the task type
2. Build a candidate list: primary → fallback model → cross-provider fallbacks
3. For each candidate, check provider availability and cost estimate
4. Select the first healthy, affordable candidate
5. If no candidate meets constraints, use the active provider as emergency fallback

### Fallback Chain

```
openai → anthropic → openrouter → local → mock
```

### Cost Limits

- Default maximum cost per request: 500 cents
- Configurable via `updateRouterConfig()`
- Cost estimation uses model-specific per-1k-token pricing

### Provider Health Monitoring

Health checks are cached for 60 seconds with exponential moving average error rates:

```javascript
getProviderHealth(); // Returns [{ provider, status, latencyMs, errorRate }]
```

## Central Orchestrator (aiEngine.js)

`completeAIRequest()` is the single entry point for all AI calls:

```
Input validation → Usage limit check → Model routing → Provider selection
→ Chat completion with retry → Token tracking → Cost tracking
→ Audit logging → Output sanitisation → Response
```

### Key Parameters

| Parameter      | Type   | Description                         |
| -------------- | ------ | ----------------------------------- |
| `userId`       | string | Requesting user (for tracking)      |
| `taskType`     | string | Task classification                 |
| `messages`     | array  | `[{role, content}]` message array   |
| `model`        | string | Explicit model override (optional)  |
| `temperature`  | number | Sampling temperature (default: 0.7) |
| `maxTokens`    | number | Max output tokens (default: 2000)   |
| `systemPrompt` | string | System prompt override              |
| `context`      | object | Additional context for routing      |

### Retry Logic

- Maximum 2 retries with linear backoff (200ms × attempt)
- 30-second timeout per attempt
- All failures are audit-logged

### Configuration

Stored in `platform_config` table under key `ai_config`:

```javascript
{
  enabled: true,
  defaultProvider: "mock",
  rateLimits: { maxRequestsPerMinute: 30, maxTokensPerDay: 100000 },
  features: { chat: true, recommendations: true, predictions: true, embeddings: true },
  fallbackToRules: true,
  maxRetries: 2,
  timeoutMs: 30000,
}
```

## Token & Cost Tracking

### Token Tracker (tokenTracker.js)

Records per-user, per-day token usage with model-specific pricing:

| Model                  | Input (per 1k) | Output (per 1k) |
| ---------------------- | -------------- | --------------- |
| gpt-4o                 | $2.50          | $10.00          |
| gpt-4o-mini            | $0.15          | $0.60           |
| claude-3-opus          | $15.00         | $75.00          |
| claude-3-haiku         | $0.25          | $1.25           |
| text-embedding-3-small | $0.02          | $0.00           |

Usage is aggregated daily per user+provider+model via upsert into `ai_usage`.

### Cost Tracker (costTracker.js)

Higher-level cost management:

- `recordAICost()` — Record costs with operation-level granularity
- `getCostSummary()` — Per-user cost breakdown by model and operation
- `getPlatformAICosts()` — Platform-wide aggregation with daily/weekly/monthly granularity and top-10 users
- `checkCostBudget()` — Budget enforcement for users, organizations, and the platform

Budget limits are stored in `ai_budgets` table with fallback to `AI_BUDGET_DAILY_CENTS` and `AI_BUDGET_MONTHLY_CENTS` env vars.

## Security Considerations

### API Key Protection

- All API keys are read from environment variables only
- Never exposed to frontend or logged
- Provider responses are sanitised before storage

### PII Redaction (sanitizeAIOutput)

All AI output is automatically sanitised before returning to callers:

| Pattern                          | Replacement        |
| -------------------------------- | ------------------ |
| Email addresses                  | `[EMAIL_REDACTED]` |
| Indian phone numbers             | `[PHONE_REDACTED]` |
| Aadhaar numbers (12 digits)      | `[ID_REDACTED]`    |
| PAN card numbers                 | `[PAN_REDACTED]`   |
| `<script>` tags                  | Removed            |
| `javascript:` protocol           | Removed            |
| Event handlers (`onload=`, etc.) | Removed            |

### Rate Limiting

- All API routes use `rateLimit` middleware (default: 30 requests per minute)
- Per-user daily token limits enforced server-side
- Usage limits checked before every AI request

### Audit Logging

Every AI operation produces audit events:

| Event                  | Trigger                            |
| ---------------------- | ---------------------------------- |
| `ai_request_completed` | Successful AI call                 |
| `ai_request_failed`    | Failed AI call (after all retries) |
| `ai_config_updated`    | Admin changes AI configuration     |

### Error Handling

The entire AI platform follows a "never throw" pattern — all errors are caught and returned as `{ success: false, error: string }`. This prevents unhandled exceptions from propagating to API callers.

## AI Module Inventory

| Module                | File                      | Description                                                    |
| --------------------- | ------------------------- | -------------------------------------------------------------- |
| AI Engine             | `aiEngine.js`             | Central orchestrator for all AI requests                       |
| Provider Registry     | `providerRegistry.js`     | Multi-provider abstraction with singleton registry             |
| Model Router          | `modelRouter.js`          | Task-based routing with cost-aware fallback chains             |
| Token Tracker         | `tokenTracker.js`         | Per-user daily token usage with model pricing                  |
| Cost Tracker          | `costTracker.js`          | Higher-level cost management and budget enforcement            |
| Campaign AI           | `campaignAI.js`           | Campaign quality scoring, title suggestions, SEO analysis      |
| Recommendation Engine | `recommendationEngine.js` | Multi-signal personalized recommendations                      |
| Prediction Engine     | `predictionEngine.js`     | Rule-based predictive analytics with confidence scores         |
| Copilot Engine        | `copilotEngine.js`        | Role-specific AI assistants (creator, donor, admin, moderator) |
| Knowledge Engine      | `knowledgeEngine.js`      | Knowledge base with semantic search and article management     |
| Embedding Engine      | `embeddingEngine.js`      | Vector embedding CRUD and similarity search                    |
| Context Builder       | `contextBuilder.js`       | Rich context objects for AI prompts                            |
| Conversation Memory   | `conversationMemory.js`   | Persistent conversation management with context windowing      |
| Prompt Engine         | `promptEngine.js`         | DB-driven prompt templates with variable substitution          |

## Integration Points

### Existing Fundora Systems

- **Authentication**: All AI routes use `withAuth` middleware
- **RBAC**: Admin routes use `withAuthAndPermission("ai:manage")`
- **Rate Limiting**: Reuses existing `rateLimit` middleware
- **Audit Logging**: Uses existing `logAuditEvent` from `lib/verification/auditLog.js`
- **Secure Logging**: All logging via `secureLogger` with PII redaction
- **Supabase Admin**: All DB operations use the service role client

### Database Tables (10 new in Phase 9)

1. `ai_conversations` — Chat sessions for copilot features
2. `ai_messages` — Individual messages with token/cost tracking
3. `ai_embeddings` — Vector storage for semantic search (pgvector)
4. `ai_recommendations` — Cached recommendation results
5. `prediction_results` — Cached prediction outputs
6. `workflow_templates` — Reusable automation templates
7. `workflow_runs` — Workflow execution logs
8. `workflow_logs` — Step-level execution logs
9. `ai_usage` — Per-user daily token/cost tracking
10. `ai_provider_metrics` — Provider health tracking

### File Count

- **15 library modules** in `lib/ai/` and `lib/automation/`
- **15 API routes** in `pages/api/ai/` and `pages/api/automation/`
- **1 database migration** (`009_ai_platform.sql`)
- **24 test files** across `tests/lib/ai/`, `tests/lib/automation/`, and `tests/api/`
