/**
 * AI Engine — Central orchestrator for all AI operations on Fundora.
 *
 * Every AI call flows through this engine, which handles:
 *   - Input validation
 *   - Usage limit enforcement
 *   - Model routing (automatic or explicit)
 *   - Provider selection and invocation
 *   - Token and cost tracking
 *   - Audit logging
 *   - Output sanitization
 *
 * Security:
 *   - Never throws — all errors are caught and returned as { success: false, error }
 *   - All AI calls are audit-logged
 *   - API keys are never exposed to callers
 *   - Output is sanitized before return
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError, logWarn } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";
import { getActiveModelProvider } from "./providerRegistry.js";
import { routeModel } from "./modelRouter.js";
import { trackTokenUsage, checkUsageLimit } from "./tokenTracker.js";
import { recordAICost } from "./costTracker.js";

// ─── Constants ───

const AI_CONFIG_DEFAULT = {
  enabled: true,
  defaultProvider: "mock",
  rateLimits: { maxRequestsPerMinute: 30, maxTokensPerDay: 100000 },
  features: { chat: true, recommendations: true, predictions: true, embeddings: true },
  fallbackToRules: true,
  maxRetries: 2,
  timeoutMs: 30000,
};

// ─── Core Functions ───

/**
 * Complete an AI request — the primary entry point for all AI calls.
 *
 * @param {Object} params
 * @param {string}   [params.userId]        — Requesting user ID (for usage tracking)
 * @param {string}    params.taskType        — e.g. "campaign_quality", "fraud_analysis"
 * @param {Array}     params.messages        — Array of { role, content } message objects
 * @param {string}   [params.model]          — Explicit model override (optional)
 * @param {number}   [params.temperature=0.7]
 * @param {number}   [params.maxTokens=2000]
 * @param {Array}    [params.tools]          — Tool definitions for function calling
 * @param {string}   [params.systemPrompt]   — System prompt override
 * @param {Object}   [params.context]        — Additional context for the request
 * @param {string}   [params.responseFormat] — e.g. "json", "text"
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function completeAIRequest({
  userId,
  taskType,
  messages,
  model,
  temperature = 0.7,
  maxTokens = 2000,
  tools,
  systemPrompt,
  context,
  responseFormat,
}) {
  try {
    // 1. Validate inputs
    if (!taskType) {
      return { success: false, error: "taskType is required" };
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { success: false, error: "messages array is required and must not be empty" };
    }

    // Check if AI is enabled
    const configResult = await getAIConfig();
    if (configResult.success && !configResult.data.enabled) {
      return { success: false, error: "AI engine is currently disabled" };
    }

    // 2. Check usage limit (if userId provided)
    if (userId) {
      const limitCheck = await checkUsageLimit(userId);
      if (!limitCheck.success) {
        logWarn("AI usage limit exceeded", { userId, taskType });
        return { success: false, error: limitCheck.error || "Usage limit exceeded" };
      }
    }

    // 3. Route to model (if model not specified)
    let resolvedModel = model;

    if (!resolvedModel) {
      const routeResult = await routeModel({ taskType, context, preferredProvider: configResult.data?.defaultProvider });
      if (!routeResult.success) {
        logWarn("Model routing failed, falling back to default", { taskType, error: routeResult.error });
        resolvedModel = null;
      } else {
        resolvedModel = routeResult.data.model;
      }
    }

    // 4. Get the active provider.
    // getActiveModelProvider() returns the active BaseModelProvider instance
    // directly (NOT a { success, data } envelope) — see providerRegistry.js.
    const provider = await getActiveModelProvider();
    if (!provider || typeof provider.chatCompletion !== "function") {
      logError("Failed to get active AI provider", { taskType });
      return { success: false, error: "No AI provider available" };
    }

    // Build final messages array with system prompt
    const finalMessages = [];
    if (systemPrompt) {
      finalMessages.push({ role: "system", content: systemPrompt });
    }
    finalMessages.push(...messages);

    // 5. Call provider.chatCompletion()
    const requestConfig = {
      messages: finalMessages,
      model: resolvedModel || provider.defaultModel,
      temperature,
      maxTokens,
      ...(tools && { tools }),
      ...(responseFormat && { response_format: { type: responseFormat } }),
    };

    const maxRetries = configResult.data?.maxRetries ?? AI_CONFIG_DEFAULT.maxRetries;
    const timeoutMs = configResult.data?.timeoutMs ?? AI_CONFIG_DEFAULT.timeoutMs;

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const completionPromise = provider.chatCompletion(requestConfig);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI request timed out")), timeoutMs)
        );

        const result = await Promise.race([completionPromise, timeoutPromise]);

        if (!result || !result.content) {
          throw new Error("Provider returned empty response");
        }

        // 6. Track tokens
        const inputTokens = result.tokens?.input ?? 0;
        const outputTokens = result.tokens?.output ?? 0;

        if (userId) {
          await trackTokenUsage({
            userId,
            taskType,
            model: result.model || resolvedModel || "unknown",
            provider: provider.name,
            inputTokens,
            outputTokens,
          });
        }

        // 7. Track cost
        const costResult = await recordAICost({
          userId,
          taskType,
          model: result.model || resolvedModel || "unknown",
          provider: provider.name,
          inputTokens,
          outputTokens,
        });

        const costCents = costResult.success ? costResult.data.costCents : 0;

        // 8. Audit log
        await logAuditEvent({
          action: "ai_request_completed",
          entityType: "ai_request",
          entityId: null,
          userId,
          metadata: {
            taskType,
            model: result.model || resolvedModel,
            provider: provider.name,
            inputTokens,
            outputTokens,
            costCents,
            attempt: attempt + 1,
          },
        });

        // 9. Sanitize and return
        const sanitizedContent = sanitizeAIOutput(result.content);

        logInfo("AI request completed", {
          taskType,
          model: result.model || resolvedModel,
          provider: provider.name,
          tokens: { input: inputTokens, output: outputTokens },
        });

        return {
          success: true,
          data: {
            content: sanitizedContent,
            model: result.model || resolvedModel,
            provider: provider.name,
            tokens: { input: inputTokens, output: outputTokens },
            costCents,
          },
        };
      } catch (attemptError) {
        lastError = attemptError;
        logWarn("AI request attempt failed", {
          taskType,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: attemptError.message,
        });

        if (attempt < maxRetries) {
          // Brief backoff before retry
          await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
        }
      }
    }

    // All retries exhausted
    logError("AI request failed after all retries", { taskType, error: lastError?.message });

    await logAuditEvent({
      action: "ai_request_failed",
      entityType: "ai_request",
      entityId: null,
      userId,
      metadata: {
        taskType,
        error: lastError?.message,
        attempts: maxRetries + 1,
      },
    });

    return {
      success: false,
      error: lastError?.message || "AI request failed after retries",
    };
  } catch (error) {
    logError("completeAIRequest unexpected error", { taskType, error: error.message });
    return { success: false, error: error.message };
  }
}

// ─── Config Management ───

/**
 * Get platform AI configuration.
 *
 * Tries the database first, falls back to defaults.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getAIConfig() {
  try {
    const { data, error } = await supabaseAdmin
      .from("platform_config")
      .select("value")
      .eq("key", "ai_config")
      .single();

    if (error || !data) {
      return { success: true, data: { ...AI_CONFIG_DEFAULT } };
    }

    const dbConfig = typeof data.value === "string" ? JSON.parse(data.value) : data.value;

    return {
      success: true,
      data: { ...AI_CONFIG_DEFAULT, ...dbConfig },
    };
  } catch (error) {
    logError("getAIConfig error", { error: error.message });
    return { success: true, data: { ...AI_CONFIG_DEFAULT } };
  }
}

/**
 * Update platform AI configuration (admin-only).
 *
 * @param {Object} config — Partial config to merge
 * @param {string} performedBy — Admin user ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateAIConfig(config, performedBy) {
  try {
    if (!config || typeof config !== "object") {
      return { success: false, error: "config object is required" };
    }
    if (!performedBy) {
      return { success: false, error: "performedBy is required" };
    }

    const currentResult = await getAIConfig();
    const currentConfig = currentResult.data || AI_CONFIG_DEFAULT;
    const mergedConfig = { ...currentConfig, ...config };

    const { error } = await supabaseAdmin
      .from("platform_config")
      .upsert(
        {
          key: "ai_config",
          value: JSON.stringify(mergedConfig),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (error) {
      logError("updateAIConfig DB error", { error: error.message });
      return { success: false, error: `Failed to update config: ${error.message}` };
    }

    await logAuditEvent({
      action: "ai_config_updated",
      entityType: "platform_config",
      entityId: "ai_config",
      userId: performedBy,
      metadata: { updatedFields: Object.keys(config) },
    });

    logInfo("AI config updated", { performedBy, updatedFields: Object.keys(config) });

    return { success: true, data: { updated: true } };
  } catch (error) {
    logError("updateAIConfig error", { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Sanitize AI output content.
 *
 * Strips potential PII patterns, limits length, removes code injection markers.
 *
 * @param {string} content — Raw AI output
 * @param {number} [maxLength=10000] — Maximum character length
 * @returns {string} Sanitized content
 */
export function sanitizeAIOutput(content, maxLength = 10000) {
  if (!content || typeof content !== "string") {
    return "";
  }

  let sanitized = content;

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Strip common PII patterns
  // Email addresses
  sanitized = sanitized.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    "[EMAIL_REDACTED]"
  );

  // Indian phone numbers (10 digits with optional country code)
  sanitized = sanitized.replace(
    /(?:\+91[\s-]?)?[6-9]\d{9}/g,
    "[PHONE_REDACTED]"
  );

  // Aadhaar numbers (12 digits, optionally space-separated)
  sanitized = sanitized.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    "[ID_REDACTED]"
  );

  // PAN card numbers
  sanitized = sanitized.replace(
    /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    "[PAN_REDACTED]"
  );

  // Strip potential code injection patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");

  return sanitized;
}

// ─── Prediction Functions ───

/**
 * Get a prediction for an entity using AI analysis.
 *
 * @param {Object} params
 * @param {string} params.entityType — Type of entity ("campaign", "user", "donation")
 * @param {string} params.entityId — Entity ID
 * @param {string} params.predictionType — Type of prediction
 * @param {string} params.requestedBy — User ID requesting prediction
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getPrediction({ entityType, entityId, predictionType, requestedBy }) {
  try {
    if (!entityType || !entityId || !predictionType) {
      return { success: false, error: "entityType, entityId, and predictionType are required" };
    }

    const taskType = `prediction_${predictionType}`;
    const messages = [
      {
        role: "user",
        content: JSON.stringify({
          action: "predict",
          entityType,
          entityId,
          predictionType,
        }),
      },
    ];

    return await completeAIRequest({
      userId: requestedBy,
      taskType,
      messages,
      temperature: 0.3,
      maxTokens: 500,
    });
  } catch (err) {
    logError("AIEngine", "getPrediction failed", { entityType, entityId, predictionType, error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Score a campaign's quality using AI analysis.
 *
 * @param {Object} params
 * @param {string} params.campaignId — Campaign ID
 * @param {string} params.scoredBy — User ID scoring the campaign
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function scoreCampaign({ campaignId, scoredBy }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    // Fetch campaign data
    const { data: campaign, error } = await supabaseAdmin
      .from("campaigns")
      .select("title, description, goal, category, creator_id")
      .eq("id", campaignId)
      .single();

    if (error || !campaign) {
      return { success: false, error: "Campaign not found" };
    }

    const messages = [
      {
        role: "user",
        content: JSON.stringify({
          action: "score_campaign",
          title: campaign.title,
          description: campaign.description,
          goal: campaign.goal,
          category: campaign.category,
        }),
      },
    ];

    return await completeAIRequest({
      userId: scoredBy,
      taskType: "campaign_quality",
      messages,
      temperature: 0.3,
      maxTokens: 1000,
    });
  } catch (err) {
    logError("AIEngine", "scoreCampaign failed", { campaignId, error: err.message });
    return { success: false, error: err.message };
  }
}
