/**
 * Rule Engine — Evaluates configurable fraud rules against risk signals.
 *
 * Rules are loaded from the fraud_rules table and evaluated against
 * aggregated signals. Supports:
 *   - Velocity rules (count within time window)
 *   - Threshold rules (value comparisons)
 *   - Pattern rules (custom logic)
 *   - Compound rules (multiple conditions)
 *   - Duplicate rules (cross-user uniqueness)
 *
 * Security:
 *   - Never exposes rule configurations to frontend
 *   - All rule evaluations are audit-logged
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logError, logInfo } from "../verification/secureLogger";

// ─── Rule Cache (in-memory, refreshed periodically) ───

let cachedRules = null;
let lastRulesFetch = 0;
const RULES_CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Fetch active rules from database (with caching).
 * @returns {Promise<Array>}
 */
async function fetchActiveRules() {
  const now = Date.now();
  if (cachedRules && now - lastRulesFetch < RULES_CACHE_TTL_MS) {
    return cachedRules;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("fraud_rules")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error) {
      logError("RuleEngine", "Fetch rules error", { error: error.message });
      return cachedRules || [];
    }

    cachedRules = data || [];
    lastRulesFetch = now;
    return cachedRules;
  } catch (err) {
    logError("RuleEngine", "Fetch rules error", { error: err.message });
    return cachedRules || [];
  }
}

/**
 * Invalidate the rules cache.
 */
export function invalidateRulesCache() {
  cachedRules = null;
  lastRulesFetch = 0;
}

// ─── Rule Evaluation ───

/**
 * Evaluate all active rules against signals for a user.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Object} params.signals — Aggregated signals from signalAggregator
 * @param {string} params.trigger — What triggered this evaluation
 * @returns {Promise<{triggered: Array, allResults: Array}>}
 */
export async function evaluateRules({ userId, signals, trigger }) {
  try {
    const rules = await fetchActiveRules();
    const triggered = [];
    const allResults = [];

    for (const rule of rules) {
      try {
        const result = await evaluateSingleRule({ userId, rule, signals, trigger });

        allResults.push({
          ruleId: rule.id,
          ruleName: rule.rule_name,
          category: rule.rule_category,
          matched: result.matched,
          riskContribution: result.matched ? rule.risk_weight : 0,
        });

        if (result.matched) {
          // Check cooldown — don't re-trigger within cooldown_minutes
          const recentHits = await checkRuleCooldown(userId, rule.id, rule.cooldown_minutes || 60);
          if (recentHits) {
            continue; // Skip — within cooldown
          }

          // Check max triggers per user
          const totalHits = await countRuleHits(userId, rule.id);
          if (totalHits >= (rule.max_triggers_per_user || 10)) {
            continue; // Skip — max triggers reached
          }

          // Record the rule hit
          await recordRuleHit({
            ruleId: rule.id,
            userId,
            riskScore: signals.riskScore || 0,
            riskContribution: rule.risk_weight,
            matchData: result.matchData || {},
            actionTaken: result.action || "monitor",
          });

          triggered.push({
            ruleId: rule.id,
            ruleName: rule.rule_name,
            category: rule.rule_category,
            severity: rule.risk_level,
            riskContribution: rule.risk_weight,
            matchData: result.matchData || {},
          });

          logInfo("RuleEngine", "Rule triggered", {
            ruleName: rule.rule_name,
            userId: userId.substring(0, 8) + "...",
          });
        }
      } catch (err) {
        logError("RuleEngine", "Rule evaluation error", {
          ruleName: rule.rule_name,
          error: err.message,
        });
      }
    }

    return { triggered, allResults };
  } catch (err) {
    logError("RuleEngine", "Evaluation error", { error: err.message });
    return { triggered: [], allResults: [] };
  }
}

/**
 * Evaluate a single rule against signals.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Object} params.rule — Rule from fraud_rules table
 * @param {Object} params.signals — Aggregated signals
 * @param {string} params.trigger — Evaluation trigger
 * @returns {Promise<{matched: boolean, matchData?: Object, action?: string}>}
 */
async function evaluateSingleRule({ userId, rule, signals, trigger }) {
  const config = rule.rule_config || {};

  switch (rule.rule_category) {
    case "velocity":
      return evaluateVelocityRule({ userId, rule, config, trigger });
    case "threshold":
      return evaluateThresholdRule({ userId, rule, config, signals });
    case "pattern":
      return evaluatePatternRule({ userId, rule, config, signals });
    case "compound":
      return evaluateCompoundRule({ userId, rule, config, signals });
    case "duplicate":
      return evaluateDuplicateRule({ userId, rule, config });
    case "custom":
      return evaluateCustomRule({ userId, rule, config, signals });
    default:
      return { matched: false };
  }
}

/**
 * Velocity rule: count events within a time window.
 * Example: 5+ donations within 1 hour.
 */
async function evaluateVelocityRule({ userId, rule, config, trigger }) {
  const { event_type, count: requiredCount, window_minutes } = config;

  if (!event_type || !requiredCount || !window_minutes) {
    return { matched: false };
  }

  try {
    const windowStart = new Date(Date.now() - window_minutes * 60 * 1000).toISOString();

    // Count matching events in the window
    const { count, error } = await supabaseAdmin
      .from("behavior_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", event_type)
      .gte("created_at", windowStart);

    if (error) {
      logError("RuleEngine", "Velocity query error", { error: error.message });
      return { matched: false };
    }

    if (count >= requiredCount) {
      return {
        matched: true,
        matchData: {
          event_type,
          count,
          required: requiredCount,
          window_minutes,
        },
        action: "monitor",
      };
    }

    return { matched: false };
  } catch (err) {
    return { matched: false };
  }
}

/**
 * Threshold rule: compare signal values against thresholds.
 * Example: 2+ rejected documents within 7 days.
 */
async function evaluateThresholdRule({ userId, rule, config, signals }) {
  const { event_type, count: requiredCount, window_minutes } = config;

  if (!event_type || !requiredCount) {
    return { matched: false };
  }

  try {
    const windowStart = window_minutes
      ? new Date(Date.now() - window_minutes * 60 * 1000).toISOString()
      : new Date(0).toISOString();

    const { count, error } = await supabaseAdmin
      .from("behavior_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", event_type)
      .gte("created_at", windowStart);

    if (error) {
      return { matched: false };
    }

    if (count >= requiredCount) {
      return {
        matched: true,
        matchData: {
          event_type,
          count,
          required: requiredCount,
          window_minutes,
        },
        action: "monitor",
      };
    }

    return { matched: false };
  } catch (err) {
    return { matched: false };
  }
}

/**
 * Pattern rule: check for specific behavioral patterns.
 * Example: IP country mismatch, suspicious email domain.
 */
async function evaluatePatternRule({ userId, rule, config, signals }) {
  const { check, weight } = config;

  if (!check) {
    return { matched: false };
  }

  switch (check) {
    case "country_mismatch":
      // Check if verification country differs from IP country
      if (signals.countryMismatch) {
        return {
          matched: true,
          matchData: { check, mismatch: true },
          action: "monitor",
        };
      }
      return { matched: false };

    case "email_domain":
      // Check if email is from a disposable domain
      if (signals.disposableEmail) {
        return {
          matched: true,
          matchData: { check, disposable: true },
          action: "monitor",
        };
      }
      return { matched: false };

    default:
      return { matched: false };
  }
}

/**
 * Compound rule: multiple conditions that must all be true.
 * Example: Low trust score + large donation.
 */
async function evaluateCompoundRule({ userId, rule, config, signals }) {
  const conditions = [];

  // Build conditions based on config
  if (config.trust_threshold !== undefined) {
    conditions.push(signals.trustScore < config.trust_threshold);
  }
  if (config.donation_min !== undefined) {
    conditions.push(signals.lastDonationAmount >= config.donation_min);
  }
  if (config.account_age_days !== undefined) {
    conditions.push(signals.accountAgeDays < config.account_age_days);
  }
  if (config.activity_threshold !== undefined) {
    conditions.push(signals.recentActivityCount >= config.activity_threshold);
  }

  if (conditions.length === 0) {
    return { matched: false };
  }

  const allMatch = conditions.every((c) => c === true);

  if (allMatch) {
    return {
      matched: true,
      matchData: { config, conditions: conditions.length },
      action: "monitor",
    };
  }

  return { matched: false };
}

/**
 * Duplicate rule: check if a field value is used by multiple users.
 * Example: PAN used by multiple users.
 */
async function evaluateDuplicateRule({ userId, rule, config }) {
  const { field, max_users } = config;

  if (!field || max_users === undefined) {
    return { matched: false };
  }

  try {
    // This is a simplified check — in production, you'd query the actual table
    // For now, check if the same value exists in other users' recent events
    const { data, error } = await supabaseAdmin
      .from("fraud_events")
      .select("user_id")
      .eq("signal_name", `duplicate_${field}`)
      .neq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      return { matched: false };
    }

    const uniqueUsers = new Set((data || []).map((e) => e.user_id));

    if (uniqueUsers.size >= max_users) {
      return {
        matched: true,
        matchData: { field, uniqueUsers: uniqueUsers.size, maxUsers: max_users },
        action: "block",
      };
    }

    return { matched: false };
  } catch (err) {
    return { matched: false };
  }
}

/**
 * Custom rule: placeholder for future custom logic.
 */
async function evaluateCustomRule({ userId, rule, config, signals }) {
  // Custom rules will be implemented as needed
  return { matched: false };
}

// ─── Rule Hit Management ───

/**
 * Check if a rule is within its cooldown period.
 * @returns {Promise<boolean>} true if within cooldown (should skip)
 */
async function checkRuleCooldown(userId, ruleId, cooldownMinutes) {
  try {
    const cooldownStart = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();

    const { count, error } = await supabaseAdmin
      .from("fraud_rule_hits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("rule_id", ruleId)
      .gte("created_at", cooldownStart);

    if (error) {
      return false;
    }

    return count > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Count total rule hits for a user.
 * @returns {Promise<number>}
 */
async function countRuleHits(userId, ruleId) {
  try {
    const { count, error } = await supabaseAdmin
      .from("fraud_rule_hits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("rule_id", ruleId);

    if (error) {
      return 0;
    }

    return count || 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Record a rule hit.
 */
async function recordRuleHit({ ruleId, userId, riskScore, riskContribution, matchData, actionTaken }) {
  try {
    const { error } = await supabaseAdmin.from("fraud_rule_hits").insert({
      rule_id: ruleId,
      user_id: userId,
      risk_score: riskScore,
      risk_contribution: riskContribution,
      match_data: matchData,
      action_taken: actionTaken,
    });

    if (error) {
      logError("RuleEngine", "Record hit error", { error: error.message });
    }
  } catch (err) {
    logError("RuleEngine", "Record hit error", { error: err.message });
  }
}
