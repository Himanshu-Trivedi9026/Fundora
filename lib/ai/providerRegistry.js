/**
 * Provider Registry — General-purpose AI provider abstraction.
 *
 * Supports:
 *   - Chat completions
 *   - Embeddings
 *   - Health checks
 *
 * Providers:
 *   - Mock (dev/testing, deterministic)
 *   - OpenAI (via `openai` package)
 *   - OpenRouter (via fetch)
 *   - Gemini (via fetch)
 *   - Anthropic (via fetch)
 *   - Local / Ollama (via fetch)
 *
 * This is the PLATFORM AI registry — general-purpose, NOT risk-specific.
 * Risk-specific providers live in lib/fraud/providerAdapter.js.
 *
 * Security:
 *   - API keys read from environment variables only
 *   - Never exposed to frontend
 *   - All calls logged via secureLogger
 *   - Provider responses sanitized before storage
 */

import { logInfo, logError, logWarn } from "../verification/secureLogger.js";

// ─── Base Provider ───

/**
 * Base class for general-purpose model providers.
 * All providers must extend this class.
 */
export class BaseModelProvider {
  constructor(name) {
    this.name = name;
    this.apiKey = null;
    this.baseUrl = null;
    this.model = null;
    this.initialized = false;
  }

  /** Initialize with credentials. */
  async initialize(config) {
    throw new Error("initialize() must be implemented");
  }

  /** Send a chat completion request. */
  async chatCompletion(params) {
    throw new Error("chatCompletion() must be implemented");
  }

  /** Create an embedding vector. */
  async createEmbedding(params) {
    throw new Error("createEmbedding() must be implemented");
  }

  /** Check provider health. */
  async healthCheck() {
    return { healthy: this.initialized, provider: this.name };
  }
}

// ─── Mock Provider ───

/**
 * Mock model provider for development and testing.
 * Returns deterministic responses based on input.
 */
export class MockModelProvider extends BaseModelProvider {
  constructor() {
    super("mock");
    this.defaultModel = "mock-model";
  }

  async initialize() {
    this.model = this.defaultModel;
    this.initialized = true;
    logInfo("ModelProvider", "Mock provider initialized");
  }

  async chatCompletion(params) {
    try {
      const messages = params.messages || [];
      const model = params.model || this.defaultModel;
      const lastMessage = messages[messages.length - 1];
      const prompt = lastMessage?.content || "";

      // Deterministic token count based on input length
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(inputTokens * 0.6) + 10;

      return {
        success: true,
        data: {
          id: `mock-${Date.now()}`,
          model,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: `Mock response for: "${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}"`,
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
          },
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "Mock chatCompletion failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async createEmbedding(params) {
    try {
      const model = params.model || "mock-embedding";
      const input = Array.isArray(params.input) ? params.input : [params.input || ""];
      const dimension = 1536;

      // Deterministic: all same value derived from input
      const seed = input[0]?.charCodeAt(0) || 42;
      const value = (seed % 100) / 100;
      const vector = new Array(dimension).fill(parseFloat(value.toFixed(6)));

      const totalTokens = input.reduce((sum, text) => sum + Math.ceil((text?.length || 0) / 4), 0);

      return {
        success: true,
        data: {
          object: "list",
          model,
          data: input.map((_, i) => ({
            object: "embedding",
            index: i,
            embedding: vector,
          })),
          usage: {
            prompt_tokens: totalTokens,
            total_tokens: totalTokens,
          },
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "Mock createEmbedding failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async healthCheck() {
    return { healthy: this.initialized, provider: this.name };
  }
}

// ─── OpenAI Provider ───

/**
 * OpenAI model provider using the `openai` npm package.
 * Requires OPENAI_API_KEY environment variable.
 */
export class OpenAIModelProvider extends BaseModelProvider {
  constructor() {
    super("openai");
    this.client = null;
    this.defaultModel = "gpt-4o-mini";
  }

  async initialize(config = {}) {
    try {
      this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
      this.baseUrl = config.baseUrl || "https://api.openai.com/v1";
      this.model = config.model || this.defaultModel;

      if (!this.apiKey) {
        logWarn("ModelProvider", "OpenAI API key not configured");
        return;
      }

      // Dynamic import of openai package
      const { default: OpenAI } = await import("openai");
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
      });

      this.initialized = true;
      logInfo("ModelProvider", "OpenAI provider initialized", { model: this.model });
    } catch (err) {
      logError("ModelProvider", "OpenAI initialization failed", { error: err.message });
    }
  }

  async chatCompletion(params) {
    if (!this.initialized || !this.client) {
      return { success: false, data: null, error: "OpenAI provider not initialized" };
    }

    try {
      const response = await this.client.chat.completions.create({
        model: params.model || this.model,
        messages: params.messages || [],
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens || 2048,
        ...(params.tools && { tools: params.tools }),
        ...(params.response_format && { response_format: params.response_format }),
      });

      logInfo("ModelProvider", "OpenAI chat completion", {
        model: response.model,
        tokens: response.usage?.total_tokens,
      });

      return {
        success: true,
        data: {
          id: response.id,
          model: response.model,
          choices: response.choices,
          usage: response.usage,
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "OpenAI chatCompletion failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async createEmbedding(params) {
    if (!this.initialized || !this.client) {
      return { success: false, data: null, error: "OpenAI provider not initialized" };
    }

    try {
      const response = await this.client.embeddings.create({
        model: params.model || "text-embedding-3-small",
        input: params.input,
      });

      return {
        success: true,
        data: {
          object: "list",
          model: response.model,
          data: response.data,
          usage: response.usage,
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "OpenAI createEmbedding failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, provider: this.name };
    }
    try {
      await this.client.models.list({ limit: 1 });
      return { healthy: true, provider: this.name };
    } catch (err) {
      return { healthy: false, provider: this.name, error: err.message };
    }
  }
}

// ─── OpenRouter Provider ───

/**
 * OpenRouter model provider via fetch.
 * Uses OpenRouter API (https://openrouter.ai/api/v1) which provides
 * a unified interface to many models.
 */
export class OpenRouterModelProvider extends BaseModelProvider {
  constructor() {
    super("openrouter");
    this.defaultModel = "openai/gpt-4o-mini";
  }

  async initialize(config = {}) {
    try {
      this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
      this.baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";
      this.model = config.model || this.defaultModel;

      if (!this.apiKey) {
        logWarn("ModelProvider", "OpenRouter API key not configured");
        return;
      }

      this.initialized = true;
      logInfo("ModelProvider", "OpenRouter provider initialized", { model: this.model });
    } catch (err) {
      logError("ModelProvider", "OpenRouter initialization failed", { error: err.message });
    }
  }

  async chatCompletion(params) {
    if (!this.initialized) {
      return { success: false, data: null, error: "OpenRouter provider not initialized" };
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "https://fundora.app",
          "X-Title": "Fundora",
        },
        body: JSON.stringify({
          model: params.model || this.model,
          messages: params.messages || [],
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens || 2048,
          ...(params.tools && { tools: params.tools }),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();

      logInfo("ModelProvider", "OpenRouter chat completion", {
        model: data.model,
        tokens: data.usage?.total_tokens,
      });

      return {
        success: true,
        data: {
          id: data.id,
          model: data.model,
          choices: data.choices,
          usage: data.usage,
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "OpenRouter chatCompletion failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async createEmbedding(params) {
    if (!this.initialized) {
      return { success: false, data: null, error: "OpenRouter provider not initialized" };
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "https://fundora.app",
          "X-Title": "Fundora",
        },
        body: JSON.stringify({
          model: params.model || "openai/text-embedding-3-small",
          input: params.input,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter embeddings API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          object: "list",
          model: data.model,
          data: data.data,
          usage: data.usage,
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "OpenRouter createEmbedding failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, provider: this.name };
    }
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return { healthy: response.ok, provider: this.name };
    } catch (err) {
      return { healthy: false, provider: this.name, error: err.message };
    }
  }
}

// ─── Gemini Provider ───

/**
 * Google Gemini model provider via fetch.
 * Uses Google AI Generative Language API.
 */
export class GeminiModelProvider extends BaseModelProvider {
  constructor() {
    super("gemini");
    this.defaultModel = "gemini-1.5-flash";
  }

  async initialize(config = {}) {
    try {
      this.apiKey = config.apiKey || process.env.GEMINI_API_KEY;
      this.model = config.model || this.defaultModel;

      if (!this.apiKey) {
        logWarn("ModelProvider", "Gemini API key not configured");
        return;
      }

      this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
      this.initialized = true;
      logInfo("ModelProvider", "Gemini provider initialized", { model: this.model });
    } catch (err) {
      logError("ModelProvider", "Gemini initialization failed", { error: err.message });
    }
  }

  async chatCompletion(params) {
    if (!this.initialized) {
      return { success: false, data: null, error: "Gemini provider not initialized" };
    }

    try {
      const model = params.model || this.model;

      // Convert OpenAI-style messages to Gemini format
      const contents = (params.messages || []).map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const response = await fetch(
        `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: params.temperature ?? 0.7,
              maxOutputTokens: params.maxTokens || 2048,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Estimate tokens (Gemini doesn't always return exact counts)
      const inputTokens = (params.messages || []).reduce(
        (sum, msg) => sum + Math.ceil((msg.content?.length || 0) / 4),
        0,
      );
      const outputTokens = Math.ceil(text.length / 4);

      logInfo("ModelProvider", "Gemini chat completion", { model, tokens: inputTokens + outputTokens });

      return {
        success: true,
        data: {
          id: `gemini-${Date.now()}`,
          model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: text },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
          },
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "Gemini chatCompletion failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async createEmbedding(params) {
    if (!this.initialized) {
      return { success: false, data: null, error: "Gemini provider not initialized" };
    }

    try {
      const model = params.model || "text-embedding-004";
      const input = Array.isArray(params.input) ? params.input : [params.input];

      const response = await fetch(
        `${this.baseUrl}/${model}:embedContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text: input[0] || "" }] },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini embeddings error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const embedding = data.embedding?.values || [];

      return {
        success: true,
        data: {
          object: "list",
          model,
          data: [{ object: "embedding", index: 0, embedding }],
          usage: { prompt_tokens: Math.ceil((input[0]?.length || 0) / 4), total_tokens: Math.ceil((input[0]?.length || 0) / 4) },
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "Gemini createEmbedding failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, provider: this.name };
    }
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.model}?key=${this.apiKey}`,
      );
      return { healthy: response.ok, provider: this.name };
    } catch (err) {
      return { healthy: false, provider: this.name, error: err.message };
    }
  }
}

// ─── Anthropic Provider ───

/**
 * Anthropic model provider via fetch.
 * Uses Anthropic Messages API (https://api.anthropic.com/v1).
 */
export class AnthropicModelProvider extends BaseModelProvider {
  constructor() {
    super("anthropic");
    this.defaultModel = "claude-3-haiku-20240307";
  }

  async initialize(config = {}) {
    try {
      this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
      this.baseUrl = config.baseUrl || "https://api.anthropic.com/v1";
      this.model = config.model || this.defaultModel;

      if (!this.apiKey) {
        logWarn("ModelProvider", "Anthropic API key not configured");
        return;
      }

      this.initialized = true;
      logInfo("ModelProvider", "Anthropic provider initialized", { model: this.model });
    } catch (err) {
      logError("ModelProvider", "Anthropic initialization failed", { error: err.message });
    }
  }

  async chatCompletion(params) {
    if (!this.initialized) {
      return { success: false, data: null, error: "Anthropic provider not initialized" };
    }

    try {
      const model = params.model || this.model;

      // Convert OpenAI-style messages to Anthropic format
      // Extract system message separately
      const messages = (params.messages || [])
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      const systemMsg = (params.messages || []).find((msg) => msg.role === "system");

      const body = {
        model,
        messages,
        max_tokens: params.maxTokens || 2048,
        temperature: params.temperature ?? 0.7,
      };

      if (systemMsg) {
        body.system = systemMsg.content;
      }

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "";

      // Anthropic returns token counts directly
      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;

      logInfo("ModelProvider", "Anthropic chat completion", {
        model: data.model,
        tokens: inputTokens + outputTokens,
      });

      return {
        success: true,
        data: {
          id: data.id,
          model: data.model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: text },
              finish_reason: data.stop_reason || "stop",
            },
          ],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
          },
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "Anthropic chatCompletion failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async createEmbedding(params) {
    // Anthropic does not currently offer an embeddings API
    // Return a structured error so callers can fall back
    logWarn("ModelProvider", "Anthropic does not support embeddings — use another provider");
    return {
      success: false,
      data: null,
      error: "Anthropic does not provide an embeddings API. Use OpenAI or another provider.",
    };
  }

  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, provider: this.name };
    }
    try {
      // Anthropic has no lightweight /models endpoint; do a minimal message call
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 1,
        }),
      });
      return { healthy: response.ok || response.status === 400, provider: this.name };
    } catch (err) {
      return { healthy: false, provider: this.name, error: err.message };
    }
  }
}

// ─── Local / Ollama Provider ───

/**
 * Local model provider via fetch.
 * Connects to Ollama (http://localhost:11434) or compatible local server.
 */
export class LocalModelProvider extends BaseModelProvider {
  constructor() {
    super("local");
    this.defaultModel = "llama3";
  }

  async initialize(config = {}) {
    try {
      this.baseUrl = config.baseUrl || process.env.LOCAL_AI_URL || "http://localhost:11434";
      this.model = config.model || this.defaultModel;

      this.initialized = true;
      logInfo("ModelProvider", "Local provider initialized", {
        baseUrl: this.baseUrl,
        model: this.model,
      });
    } catch (err) {
      logError("ModelProvider", "Local provider initialization failed", { error: err.message });
    }
  }

  async chatCompletion(params) {
    if (!this.initialized) {
      return { success: false, data: null, error: "Local provider not initialized" };
    }

    try {
      const model = params.model || this.model;

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: params.messages || [],
          stream: false,
          options: {
            temperature: params.temperature ?? 0.7,
            num_predict: params.maxTokens || 2048,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Local API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const text = data.message?.content || "";

      const inputTokens = data.prompt_eval_count || 0;
      const outputTokens = data.eval_count || 0;

      logInfo("ModelProvider", "Local chat completion", {
        model,
        tokens: inputTokens + outputTokens,
      });

      return {
        success: true,
        data: {
          id: `local-${Date.now()}`,
          model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: text },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
          },
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "Local chatCompletion failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async createEmbedding(params) {
    if (!this.initialized) {
      return { success: false, data: null, error: "Local provider not initialized" };
    }

    try {
      const model = params.model || "nomic-embed-text";
      const input = Array.isArray(params.input) ? params.input : [params.input || ""];

      const embeddings = [];

      for (const text of input) {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: text }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Local embeddings error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        embeddings.push(data.embedding || []);
      }

      const totalTokens = input.reduce((sum, text) => sum + Math.ceil((text.length || 0) / 4), 0);

      return {
        success: true,
        data: {
          object: "list",
          model,
          data: embeddings.map((embedding, i) => ({
            object: "embedding",
            index: i,
            embedding,
          })),
          usage: { prompt_tokens: totalTokens, total_tokens: totalTokens },
        },
        error: null,
      };
    } catch (err) {
      logError("ModelProvider", "Local createEmbedding failed", { error: err.message });
      return { success: false, data: null, error: err.message };
    }
  }

  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, provider: this.name };
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return { healthy: response.ok, provider: this.name };
    } catch (err) {
      return { healthy: false, provider: this.name, error: err.message };
    }
  }
}

// ─── Provider Registry (Singleton) ───

const modelProviders = new Map();
let activeModelProvider = null;
const fallbackOrder = [];

/**
 * Register a model provider.
 * @param {string} name
 * @param {BaseModelProvider} provider
 * @param {Object} [config]
 * @returns {{ success: boolean, data: { name: string } | null, error: string | null }}
 */
export function registerModelProvider(name, provider, config = {}) {
  try {
    if (!(provider instanceof BaseModelProvider)) {
      throw new Error("Provider must extend BaseModelProvider");
    }

    modelProviders.set(name, { provider, config });

    if (config.priority !== undefined) {
      fallbackOrder.push({ name, priority: config.priority });
      fallbackOrder.sort((a, b) => a.priority - b.priority);
    }

    logInfo("ModelRegistry", `Provider registered: ${name}`);
    return { success: true, data: { name }, error: null };
  } catch (err) {
    logError("ModelRegistry", "Failed to register provider", { name, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Get a registered model provider by name.
 * @param {string} name
 * @returns {{ success: boolean, data: BaseModelProvider | null, error: string | null }}
 */
export function getModelProvider(name) {
  try {
    const entry = modelProviders.get(name);
    if (!entry) {
      return { success: false, data: null, error: `Provider '${name}' not found` };
    }
    return { success: true, data: entry.provider, error: null };
  } catch (err) {
    logError("ModelRegistry", "Failed to get provider", { name, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Set the active model provider.
 * @param {string} name
 * @returns {{ success: boolean, data: { name: string } | null, error: string | null }}
 */
export function setActiveModelProvider(name) {
  try {
    const entry = modelProviders.get(name);
    if (!entry) {
      throw new Error(`Provider '${name}' not found`);
    }

    activeModelProvider = entry.provider;
    logInfo("ModelRegistry", `Active provider set to: ${name}`);
    return { success: true, data: { name }, error: null };
  } catch (err) {
    logError("ModelRegistry", "Failed to set active provider", { name, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Get the active model provider.
 * Falls back to mock if none set.
 * @returns {BaseModelProvider}
 */
export function getActiveModelProvider() {
  return activeModelProvider || modelProviders.get("mock")?.provider || new MockModelProvider();
}

/**
 * List all registered model providers with their status.
 * @returns {{ success: boolean, data: Array<{ name: string, initialized: boolean }> | null, error: string | null }}
 */
export function listModelProviders() {
  try {
    const providers = Array.from(modelProviders.entries()).map(([name, { provider }]) => ({
      name,
      initialized: provider.initialized,
      isActive: provider === activeModelProvider,
    }));

    return { success: true, data: providers, error: null };
  } catch (err) {
    logError("ModelRegistry", "Failed to list providers", { error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

/**
 * Initialize all model providers based on environment variables.
 *
 * 1. Always registers MockModelProvider
 * 2. Checks for OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, LOCAL_AI_URL
 * 3. Registers each configured provider
 * 4. Sets active provider from AI_MODEL_PROVIDER env var, or first available
 *
 * @returns {{ success: boolean, data: { active: string, registered: string[] } | null, error: string | null }}
 */
export async function initializeModelProviders() {
  try {
    const registered = [];

    // 1. Always register mock
    const mock = new MockModelProvider();
    await mock.initialize();
    registerModelProvider("mock", mock, { priority: 100 });
    registered.push("mock");

    // 2. Check and register each provider from env vars
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAIModelProvider();
      await openai.initialize({ apiKey: process.env.OPENAI_API_KEY });
      registerModelProvider("openai", openai, { priority: 10 });
      registered.push("openai");
    }

    if (process.env.GEMINI_API_KEY) {
      const gemini = new GeminiModelProvider();
      await gemini.initialize({ apiKey: process.env.GEMINI_API_KEY });
      registerModelProvider("gemini", gemini, { priority: 20 });
      registered.push("gemini");
    }

    if (process.env.ANTHROPIC_API_KEY) {
      const anthropic = new AnthropicModelProvider();
      await anthropic.initialize({ apiKey: process.env.ANTHROPIC_API_KEY });
      registerModelProvider("anthropic", anthropic, { priority: 15 });
      registered.push("anthropic");
    }

    if (process.env.OPENROUTER_API_KEY) {
      const openrouter = new OpenRouterModelProvider();
      await openrouter.initialize({ apiKey: process.env.OPENROUTER_API_KEY });
      registerModelProvider("openrouter", openrouter, { priority: 25 });
      registered.push("openrouter");
    }

    if (process.env.LOCAL_AI_URL || process.env.AI_USE_LOCAL === "true") {
      const local = new LocalModelProvider();
      await local.initialize({ baseUrl: process.env.LOCAL_AI_URL });
      registerModelProvider("local", local, { priority: 30 });
      registered.push("local");
    }

    // 3. Set active provider from AI_MODEL_PROVIDER env var, or first non-mock available
    const envProvider = process.env.AI_MODEL_PROVIDER;
    let activeName = "mock";

    if (envProvider && modelProviders.has(envProvider)) {
      activeName = envProvider;
    } else {
      // Prefer first registered non-mock provider by priority
      const nonMock = fallbackOrder.find((f) => f.name !== "mock");
      if (nonMock) {
        activeName = nonMock.name;
      }
    }

    setActiveModelProvider(activeName);

    logInfo("ModelRegistry", "Providers initialized", {
      registered,
      active: activeName,
    });

    return {
      success: true,
      data: { active: activeName, registered },
      error: null,
    };
  } catch (err) {
    logError("ModelRegistry", "Failed to initialize providers", { error: err.message });
    return { success: false, data: null, error: err.message };
  }
}
