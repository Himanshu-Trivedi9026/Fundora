/**
 * Token Tracker — Per-user, per-day token usage tracking with cost calculation.
 *
 * Tracks:
 *   - Token usage by user, provider, model, and date
 *   - Cost calculation based on model-specific pricing
 *   - Daily usage summaries and limits
 *
 * All writes go to the `ai_usage` Supabase table.
 *
 * Security:
 *   - All operations logged via secureLogger
 *   - No PII exposed in logs
 *   - Usage limits enforced server-side
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";

// ─── Model Pricing ───

/**
 * Cost per 1k tokens in USD.
 * Costs are converted to cents internally (multiply by 100).
 */
export const MODEL_COSTS = {
  "gpt-4o": { inputPer1k: 2.5, outputPer1k: 10.0 },
  "gpt-4o-mini": { inputPer1k: 0.15, outputPer1k: 0.6 },
  "claude-3-opus-20240229": { inputPer1k: 15.0, outputPer1k: 75.0 },
  "claude-3-haiku-20240307": { inputPer1k: 0.25, outputPer1k: 1.25 },
  "text-embedding-3-small": { inputPer1k: 0.02, outputPer1k: 0 },
  "default": { inputPer1k: 1.0, outputPer1k: 3.0 },
};

// ─── Cost Calculation ───

/**
 * Calculate cost in cents for a given model and token counts.
 * @param {string} model — Model identifier
 * @param {number} inputTokens — Number of input/prompt tokens
 * @param {number} outputTokens — Number of output/completion tokens
 * @returns {number} Cost in cents
 */
export function calculateCost(model, inputTokens, outputTokens) {
  try {
    const pricing = MODEL_COSTS[model] || MODEL_COSTS["default"];
    const inputCost = (inputTokens / 1000) * pricing.inputPer1k;
    const outputCost = (outputTokens / 1000) * pricing.outputPer1k;
    // Convert USD to cents and round to 4 decimal places
    const costCents = parseFloat(((inputCost + outputCost) * 100).toFixed(4));
    return costCents;
  } catch (err) {
    logError("TokenTracker", "Cost calculation failed", { model, error: err.message });
    return 0;
  }
}

// ─── Track Token Usage ───

/**
 * Record token usage for a user, calculating cost and upserting into ai_usage.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} params.provider — Provider name (e.g. "openai", "anthropic")
 * @param {string} params.model — Model identifier
 * @param {number} params.inputTokens — Input/prompt token count
 * @param {number} params.outputTokens — Output/completion token count
 * @returns {{ success: boolean, data: { id: string, costCents: number } | null, error: string | null }}
 */
export async function trackTokenUsage({ userId, provider, model, inputTokens, outputTokens }) {
  try {
    if (!userId || !provider || !model) {
      throw new Error("userId, provider, and model are required");
    }

    const costCents = calculateCost(model, inputTokens, outputTokens);
    const totalTokens = (inputTokens || 0) + (outputTokens || 0);
    const today = new Date().toISOString().split("T")[0];

    // Upsert: aggregate if a record for this user+date+provider+model already exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("ai_usage")
      .select("id, input_tokens, output_tokens, total_tokens, cost_cents, request_count")
      .eq("user_id", userId)
      .eq("date", today)
      .eq("provider", provider)
      .eq("model", model)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows found, which is expected for first request
      throw new Error(`Database fetch error: ${fetchError.message}`);
    }

    let result;

    if (existing) {
      // Update existing record
      const newInputTokens = (existing.input_tokens || 0) + (inputTokens || 0);
      const newOutputTokens = (existing.output_tokens || 0) + (outputTokens || 0);
      const newTotalTokens = (existing.total_tokens || 0) + totalTokens;
      const newCostCents = parseFloat(
        ((existing.cost_cents || 0) + costCents).toFixed(4),
      );
      const newRequestCount = (existing.request_count || 0) + 1;

      const { data, error } = await supabaseAdmin
        .from("ai_usage")
        .update({
          input_tokens: newInputTokens,
          output_tokens: newOutputTokens,
          total_tokens: newTotalTokens,
          cost_cents: newCostCents,
          request_count: newRequestCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id, cost_cents")
        .single();

      if (error) throw new Error(`Database update error: ${error.message}`);
      result = { id: data.id, costCents: newCostCents };
    } else {
      // Insert new record
      const { data, error } = await supabaseAdmin
        .from("ai_usage")
        .insert({
          user_id: userId,
          date: today,
          provider,
          model,
          input_tokens: inputTokens || 0,
          output_tokens: outputTokens || 0,
          total_tokens: totalTokens,
          cost_cents: costCents,
          request_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id, cost_cents")
        .single();

      if (error) throw new Error(`Database insert error: ${error.message}`);
      result = { id: data.id, costCents };
    }

    logInfo("TokenTracker", "Usage tracked", {
      userId,
      provider,
      model,
      inputTokens,
      outputTokens,
      costCents,
    });

    return { success: true, data: result, error: null };
  } catch (err) {
    logError("TokenTracker", "Failed to track usage", { userId, provider, model, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

// ─── Get User Usage ───

/**
 * Get aggregated usage for a user on a given date (defaults to today).
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} [params.date] — Date string (YYYY-MM-DD), defaults to today
 * @returns {{ success: boolean, data: { totalTokens: number, totalCostCents: number, requestsByModel: Object } | null, error: string | null }}
 */
export async function getUserUsage({ userId, date }) {
  try {
    if (!userId) {
      throw new Error("userId is required");
    }

    const targetDate = date || new Date().toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("model, provider, total_tokens, cost_cents, request_count")
      .eq("user_id", userId)
      .eq("date", targetDate);

    if (error) throw new Error(`Database query error: ${error.message}`);

    const records = data || [];
    let totalTokens = 0;
    let totalCostCents = 0;
    const requestsByModel = {};

    for (const record of records) {
      totalTokens += record.total_tokens || 0;
      totalCostCents += record.cost_cents || 0;

      if (!requestsByModel[record.model]) {
        requestsByModel[record.model] = {
          tokens: 0,
          costCents: 0,
          requests: 0,
        };
      }
      requestsByModel[record.model].tokens += record.total_tokens || 0;
      requestsByModel[record.model].costCents += record.cost_cents || 0;
      requestsByModel[record.model].requests += record.request_count || 0;
    }

    totalCostCents = parseFloat(totalCostCents.toFixed(4));

    return {
      success: true,
      data: { totalTokens, totalCostCents, requestsByModel },
      error: null,
    };
  } catch (err) {
    logError("TokenTracker", "Failed to get user usage", { userId, date, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

// ─── Get Usage Stats ───

/**
 * Get aggregated usage statistics across users within a date range.
 *
 * @param {Object} params
 * @param {string} params.startDate — Start date (YYYY-MM-DD)
 * @param {string} params.endDate — End date (YYYY-MM-DD)
 * @param {string} [params.groupBy] — Group by "date", "provider", or "model"
 * @returns {{ success: boolean, data: Array<{ date: string, provider: string, model: string, tokens: number, cost: number, requests: number }> | null, error: string | null }}
 */
export async function getUsageStats({ startDate, endDate, groupBy = "date" }) {
  try {
    if (!startDate || !endDate) {
      throw new Error("startDate and endDate are required");
    }

    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("date, provider, model, total_tokens, cost_cents, request_count")
      .gte("date", startDate)
      .lte("date", endDate);

    if (error) throw new Error(`Database query error: ${error.message}`);

    const records = data || [];

    // Aggregate by the requested grouping
    const grouped = {};

    for (const record of records) {
      let key;
      switch (groupBy) {
        case "provider":
          key = `${record.date}|${record.provider}`;
          break;
        case "model":
          key = `${record.date}|${record.model}`;
          break;
        case "date":
        default:
          key = record.date;
          break;
      }

      if (!grouped[key]) {
        grouped[key] = {
          date: record.date,
          provider: record.provider,
          model: record.model,
          tokens: 0,
          cost: 0,
          requests: 0,
        };
      }

      grouped[key].tokens += record.total_tokens || 0;
      grouped[key].cost += record.cost_cents || 0;
      grouped[key].requests += record.request_count || 0;
    }

    // Convert to array and round costs
    const stats = Object.values(grouped).map((item) => ({
      ...item,
      cost: parseFloat(item.cost.toFixed(4)),
    }));

    // Sort by date
    stats.sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data: stats, error: null };
  } catch (err) {
    logError("TokenTracker", "Failed to get usage stats", { startDate, endDate, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

// ─── Check Usage Limit ───

/**
 * Check if a user has exceeded their daily cost limit.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {number} params.limit — Cost limit in cents
 * @returns {{ success: boolean, data: { allowed: boolean, current: number, limit: number } | null, error: string | null }}
 */
export async function checkUsageLimit({ userId, limit }) {
  try {
    if (!userId) {
      throw new Error("userId is required");
    }
    if (limit === undefined || limit === null) {
      throw new Error("limit (in cents) is required");
    }

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("cost_cents")
      .eq("user_id", userId)
      .eq("date", today);

    if (error) throw new Error(`Database query error: ${error.message}`);

    const totalCost = (data || []).reduce((sum, row) => sum + (row.cost_cents || 0), 0);
    const currentCost = parseFloat(totalCost.toFixed(4));
    const allowed = currentCost < limit;

    return {
      success: true,
      data: { allowed, current: currentCost, limit },
      error: null,
    };
  } catch (err) {
    logError("TokenTracker", "Failed to check usage limit", { userId, limit, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

// ─── getUserAIUsage (alias for backward compatibility) ───

/**
 * Get aggregated AI usage for a user over a timeframe.
 * Wraps getUserUsage and getUsageStats for backward compatibility.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} params.timeframe — Timeframe: "7d", "30d", or "90d"
 * @returns {Promise<{ success: boolean, data?: { totalTokens: number, totalCostCents: number, requestsByModel: Object }, error?: string }>}
 */
export async function getUserAIUsage({ userId, timeframe }) {
  try {
    if (!userId) {
      throw new Error("userId is required");
    }

    const days = parseInt(timeframe) || 30;
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
    const endDate = new Date().toISOString().split("T")[0];

    // Use getUsageStats for the date range
    const result = await getUsageStats({ startDate, endDate, groupBy: "date" });

    if (!result.success) {
      return { success: false, data: null, error: result.error };
    }

    // Aggregate the stats
    const records = result.data || [];
    let totalTokens = 0;
    let totalCostCents = 0;
    const requestsByModel = {};

    for (const record of records) {
      totalTokens += record.tokens || 0;
      totalCostCents += record.cost || 0;
      if (!requestsByModel[record.model]) {
        requestsByModel[record.model] = { tokens: 0, costCents: 0, requests: 0 };
      }
      requestsByModel[record.model].tokens += record.tokens || 0;
      requestsByModel[record.model].costCents += record.cost || 0;
      requestsByModel[record.model].requests += record.requests || 0;
    }

    totalCostCents = parseFloat(totalCostCents.toFixed(4));

    return {
      success: true,
      data: { totalTokens, totalCostCents, requestsByModel },
      error: null,
    };
  } catch (err) {
    logError("TokenTracker", "Failed to get user AI usage", { userId, timeframe, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}
