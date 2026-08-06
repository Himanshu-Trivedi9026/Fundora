/**
 * Cost Tracker — Higher-level AI cost tracking with budget management.
 *
 * Provides:
 *   - Per-user and per-operation cost recording
 *   - Cost summaries by model, operation, and time range
 *   - Platform-wide cost aggregation with daily breakdowns
 *   - Budget checking for users, organizations, and the platform
 *
 * This sits above tokenTracker.js and provides a richer cost-management layer.
 *
 * All writes go to the `ai_usage` Supabase table (shared with tokenTracker).
 *
 * Security:
 *   - All operations logged via secureLogger
 *   - Budget limits enforced server-side
 *   - No PII exposed in logs
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";

// ─── Record AI Cost ───

/**
 * Record an AI operation cost, inserting into or updating ai_usage.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID performing the operation
 * @param {string} params.operation — Operation type (e.g. "chat", "embedding", "classification")
 * @param {string} params.provider — Provider name (e.g. "openai", "anthropic")
 * @param {string} params.model — Model identifier
 * @param {number} [params.tokensIn=0] — Input/prompt token count
 * @param {number} [params.tokensOut=0] — Output/completion token count
 * @param {number} params.costCents — Cost in cents
 * @param {Object} [params.metadata={}] — Additional metadata (e.g. requestId, taskType)
 * @returns {{ success: boolean, data: { id: string } | null, error: string | null }}
 */
export async function recordAICost({
  userId,
  operation,
  provider,
  model,
  tokensIn = 0,
  tokensOut = 0,
  costCents,
  metadata = {},
}) {
  try {
    if (!userId || !operation || !provider || !model || costCents === undefined) {
      throw new Error("userId, operation, provider, model, and costCents are required");
    }

    const today = new Date().toISOString().split("T")[0];
    const totalTokens = (tokensIn || 0) + (tokensOut || 0);

    // Check for an existing record with the same user+date+provider+model+operation
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("ai_usage")
      .select("id, cost_cents, request_count, input_tokens, output_tokens, total_tokens")
      .eq("user_id", userId)
      .eq("date", today)
      .eq("provider", provider)
      .eq("model", model)
      .eq("operation", operation)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(`Database fetch error: ${fetchError.message}`);
    }

    let resultId;

    if (existing) {
      // Update: aggregate tokens and costs
      const newCostCents = parseFloat(((existing.cost_cents || 0) + costCents).toFixed(4));
      const newInputTokens = (existing.input_tokens || 0) + tokensIn;
      const newOutputTokens = (existing.output_tokens || 0) + tokensOut;
      const newTotalTokens = (existing.total_tokens || 0) + totalTokens;
      const newRequestCount = (existing.request_count || 0) + 1;

      const { data, error } = await supabaseAdmin
        .from("ai_usage")
        .update({
          cost_cents: newCostCents,
          input_tokens: newInputTokens,
          output_tokens: newOutputTokens,
          total_tokens: newTotalTokens,
          request_count: newRequestCount,
          metadata: { ...(existing.metadata || {}), ...metadata },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .single();

      if (error) throw new Error(`Database update error: ${error.message}`);
      resultId = data.id;
    } else {
      // Insert new record
      const { data, error } = await supabaseAdmin
        .from("ai_usage")
        .insert({
          user_id: userId,
          date: today,
          operation,
          provider,
          model,
          input_tokens: tokensIn,
          output_tokens: tokensOut,
          total_tokens: totalTokens,
          cost_cents: costCents,
          request_count: 1,
          metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw new Error(`Database insert error: ${error.message}`);
      resultId = data.id;
    }

    logInfo("CostTracker", "AI cost recorded", {
      userId,
      operation,
      provider,
      model,
      costCents,
    });

    return { success: true, data: { id: resultId }, error: null };
  } catch (err) {
    logError("CostTracker", "Failed to record cost", { userId, operation, model, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

// ─── Get Cost Summary ───

/**
 * Aggregate costs by model and operation for a user within a date range.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} params.startDate — Start date (YYYY-MM-DD)
 * @param {string} params.endDate — End date (YYYY-MM-DD)
 * @returns {{ success: boolean, data: { totalCostCents: number, byModel: Object, byOperation: Object } | null, error: string | null }}
 */
export async function getCostSummary({ userId, startDate, endDate }) {
  try {
    if (!userId || !startDate || !endDate) {
      throw new Error("userId, startDate, and endDate are required");
    }

    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("model, operation, cost_cents, total_tokens, request_count")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (error) throw new Error(`Database query error: ${error.message}`);

    const records = data || [];
    let totalCostCents = 0;
    const byModel = {};
    const byOperation = {};

    for (const record of records) {
      const cost = record.cost_cents || 0;
      const tokens = record.total_tokens || 0;
      const requests = record.request_count || 0;
      totalCostCents += cost;

      // Aggregate by model
      if (!byModel[record.model]) {
        byModel[record.model] = { costCents: 0, tokens: 0, requests: 0 };
      }
      byModel[record.model].costCents += cost;
      byModel[record.model].tokens += tokens;
      byModel[record.model].requests += requests;

      // Aggregate by operation
      const op = record.operation || "unknown";
      if (!byOperation[op]) {
        byOperation[op] = { costCents: 0, tokens: 0, requests: 0 };
      }
      byOperation[op].costCents += cost;
      byOperation[op].tokens += tokens;
      byOperation[op].requests += requests;
    }

    // Round costs
    totalCostCents = parseFloat(totalCostCents.toFixed(4));
    for (const key of Object.keys(byModel)) {
      byModel[key].costCents = parseFloat(byModel[key].costCents.toFixed(4));
    }
    for (const key of Object.keys(byOperation)) {
      byOperation[key].costCents = parseFloat(byOperation[key].costCents.toFixed(4));
    }

    return {
      success: true,
      data: { totalCostCents, byModel, byOperation },
      error: null,
    };
  } catch (err) {
    logError("CostTracker", "Failed to get cost summary", { userId, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

// ─── Get Platform AI Costs ───

/**
 * Platform-wide AI cost aggregation.
 *
 * @param {Object} params
 * @param {string} params.startDate — Start date (YYYY-MM-DD)
 * @param {string} params.endDate — End date (YYYY-MM-DD)
 * @param {string} [params.granularity="day"] — "day", "week", or "month"
 * @returns {{ success: boolean, data: { totalCostCents: number, dailyBreakdown: Array, topUsers: Array } | null, error: string | null }}
 */
export async function getPlatformAICosts({ startDate, endDate, granularity = "day" }) {
  try {
    if (!startDate || !endDate) {
      throw new Error("startDate and endDate are required");
    }

    const { data, error } = await supabaseAdmin
      .from("ai_usage")
      .select("date, user_id, cost_cents, total_tokens, request_count")
      .gte("date", startDate)
      .lte("date", endDate);

    if (error) throw new Error(`Database query error: ${error.message}`);

    const records = data || [];
    let totalCostCents = 0;
    const dailyMap = {};
    const userMap = {};

    for (const record of records) {
      const cost = record.cost_cents || 0;
      totalCostCents += cost;

      // Daily breakdown
      let bucketDate = record.date;

      if (granularity === "week") {
        // Group by ISO week start (Monday)
        const d = new Date(record.date);
        const dayOfWeek = d.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setDate(d.getDate() + mondayOffset);
        bucketDate = monday.toISOString().split("T")[0];
      } else if (granularity === "month") {
        bucketDate = record.date.substring(0, 7); // YYYY-MM
      }

      if (!dailyMap[bucketDate]) {
        dailyMap[bucketDate] = { date: bucketDate, costCents: 0, tokens: 0, requests: 0 };
      }
      dailyMap[bucketDate].costCents += cost;
      dailyMap[bucketDate].tokens += record.total_tokens || 0;
      dailyMap[bucketDate].requests += record.request_count || 0;

      // User aggregation
      const uid = record.user_id;
      if (!userMap[uid]) {
        userMap[uid] = { userId: uid, costCents: 0, requests: 0 };
      }
      userMap[uid].costCents += cost;
      userMap[uid].requests += record.request_count || 0;
    }

    // Convert daily map to sorted array
    const dailyBreakdown = Object.values(dailyMap)
      .map((item) => ({
        ...item,
        costCents: parseFloat(item.costCents.toFixed(4)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top users by cost (top 10)
    const topUsers = Object.values(userMap)
      .sort((a, b) => b.costCents - a.costCents)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        costCents: parseFloat(item.costCents.toFixed(4)),
      }));

    totalCostCents = parseFloat(totalCostCents.toFixed(4));

    return {
      success: true,
      data: { totalCostCents, dailyBreakdown, topUsers },
      error: null,
    };
  } catch (err) {
    logError("CostTracker", "Failed to get platform costs", { startDate, endDate, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}

// ─── Check Cost Budget ───

/**
 * Check whether an entity (user, organization, or platform) is within its budget.
 *
 * Budget limits are stored in the `ai_budgets` table with columns:
 *   - entity_type: "user" | "organization" | "platform"
 *   - entity_id: the user/org ID, or "platform" for global limits
 *   - budget_cents: limit in cents
 *   - period: "daily" | "monthly" | "total"
 *
 * Falls back to env vars for platform-level budgets:
 *   AI_BUDGET_DAILY_CENTS, AI_BUDGET_MONTHLY_CENTS
 *
 * @param {Object} params
 * @param {string} params.entity — Entity ID (user ID, org ID, or "platform")
 * @param {string} [params.budgetType="daily"] — "daily", "monthly", or "total"
 * @returns {{ success: boolean, data: { withinBudget: boolean, spent: number, limit: number, remaining: number } | null, error: string | null }}
 */
export async function checkCostBudget({ entity, budgetType = "daily" }) {
  try {
    if (!entity) {
      throw new Error("entity is required");
    }

    // 1. Look up budget limit from ai_budgets table
    let limitCents = null;

    const { data: budgetRecord, error: budgetError } = await supabaseAdmin
      .from("ai_budgets")
      .select("budget_cents")
      .eq("entity_id", entity)
      .eq("period", budgetType)
      .single();

    if (budgetError && budgetError.code !== "PGRST116") {
      throw new Error(`Budget lookup error: ${budgetError.message}`);
    }

    if (budgetRecord) {
      limitCents = budgetRecord.budget_cents;
    } else {
      // Fallback to env vars for platform-level budgets
      if (entity === "platform") {
        if (budgetType === "daily") {
          limitCents = parseFloat(process.env.AI_BUDGET_DAILY_CENTS || "10000");
        } else if (budgetType === "monthly") {
          limitCents = parseFloat(process.env.AI_BUDGET_MONTHLY_CENTS || "200000");
        }
      }

      // If still no limit found, allow everything (no budget enforced)
      if (limitCents === null) {
        return {
          success: true,
          data: { withinBudget: true, spent: 0, limit: -1, remaining: -1 },
          error: null,
        };
      }
    }

    // 2. Calculate spent amount based on budget type
    const now = new Date();
    let spentQuery = supabaseAdmin
      .from("ai_usage")
      .select("cost_cents");

    if (entity !== "platform") {
      spentQuery = spentQuery.eq("user_id", entity);
    }

    // Apply date filter based on budget period
    if (budgetType === "daily") {
      const today = now.toISOString().split("T")[0];
      spentQuery = spentQuery.eq("date", today);
    } else if (budgetType === "monthly") {
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      spentQuery = spentQuery.gte("date", monthStart);
    }
    // "total" — no date filter

    const { data: usageRecords, error: usageError } = await spentQuery;

    if (usageError) throw new Error(`Usage lookup error: ${usageError.message}`);

    const spent = (usageRecords || []).reduce(
      (sum, record) => sum + (record.cost_cents || 0),
      0,
    );
    const spentRounded = parseFloat(spent.toFixed(4));
    const remaining = parseFloat((limitCents - spentRounded).toFixed(4));

    return {
      success: true,
      data: {
        withinBudget: spentRounded < limitCents,
        spent: spentRounded,
        limit: limitCents,
        remaining,
      },
      error: null,
    };
  } catch (err) {
    logError("CostTracker", "Failed to check budget", { entity, budgetType, error: err.message });
    return { success: false, data: null, error: err.message };
  }
}
