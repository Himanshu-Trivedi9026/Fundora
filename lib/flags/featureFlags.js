// Feature Flags — percentage/org/environment rollout with A/B testing support

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logAuditEvent } from "../verification/auditLog.js";

const _cache = new Map();
const CACHE_TTL = 60000; // 1 minute

// ——————————————————————————————————————
// Flag CRUD
// ——————————————————————————————————————

export async function createFlag(options) {
  try {
    const { data, error } = await supabaseAdmin
      .from("feature_flags")
      .insert({
        key: options.key,
        name: options.name,
        description: options.description || "",
        enabled: options.enabled !== false,
        rollout_percentage: options.rolloutPercentage || 100,
        targeting_rules: options.targetingRules || [],
        organization_ids: options.organizationIds || [],
        environments: options.environments || ["development", "staging", "production"],
        metadata: options.metadata || {},
        created_by: options.createdBy || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await logAuditEvent({
      action: "feature_flag.created",
      actorId: options.createdBy,
      targetType: "feature_flag",
      targetId: data.id,
      metadata: { key: options.key, enabled: options.enabled },
    });

    _cache.delete(options.key);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function updateFlag(flagId, updates) {
  try {
    const { data: existing } = await supabaseAdmin
      .from("feature_flags")
      .select("key")
      .eq("id", flagId)
      .single();

    const { data, error } = await supabaseAdmin
      .from("feature_flags")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", flagId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    if (existing) _cache.delete(existing.key);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getFlag(flagId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("feature_flags")
      .select("*")
      .eq("id", flagId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listFlags(options = {}) {
  try {
    let query = supabaseAdmin.from("feature_flags").select("*", { count: "exact" });
    if (options.enabled !== undefined) query = query.eq("enabled", options.enabled);
    if (options.search) query = query.or(`key.ilike.%${options.search}%,name.ilike.%${options.search}%`);
    query = query.order("key", { ascending: true });

    const limit = Math.min(options.limit || 100, 200);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteFlag(flagId) {
  try {
    const { data: existing } = await supabaseAdmin
      .from("feature_flags")
      .select("key")
      .eq("id", flagId)
      .single();

    const { error } = await supabaseAdmin
      .from("feature_flags")
      .delete()
      .eq("id", flagId);

    if (error) return { success: false, error: error.message };

    if (existing) _cache.delete(existing.key);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Flag Evaluation
// ——————————————————————————————————————

export async function isEnabled(flagKey, context = {}) {
  try {
    // Check cache
    const cached = _cache.get(flagKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return evaluateFlag(cached.data, context);
    }

    // Fetch from DB
    const { data, error } = await supabaseAdmin
      .from("feature_flags")
      .select("*")
      .eq("key", flagKey)
      .single();

    if (error) return false;

    // Update cache
    _cache.set(flagKey, { data, timestamp: Date.now() });

    return evaluateFlag(data, context);
  } catch {
    return false;
  }
}

export async function getEnabledFlags(context = {}) {
  try {
    const { data, error } = await supabaseAdmin
      .from("feature_flags")
      .select("*")
      .eq("enabled", true);

    if (error) return [];

    const enabled = [];
    for (const flag of data || []) {
      if (evaluateFlag(flag, context)) {
        enabled.push(flag.key);
      }
    }

    return enabled;
  } catch {
    return [];
  }
}

function evaluateFlag(flag, context) {
  if (!flag.enabled) return false;

  // Environment check
  const env = context.environment || process.env.NODE_ENV || "development";
  if (flag.environments && flag.environments.length > 0) {
    if (!flag.environments.includes(env)) return false;
  }

  // Organization check
  if (flag.organization_ids && flag.organization_ids.length > 0) {
    if (context.organizationId && flag.organization_ids.includes(context.organizationId)) {
      return true;
    }
    if (!context.organizationId) return false;
  }

  // Rollout percentage
  if (flag.rollout_percentage < 100) {
    const userId = context.userId || context.ip || "anonymous";
    const hash = hashCode(`${flag.key}:${userId}`);
    const bucket = hash % 100;
    if (bucket >= flag.rollout_percentage) return false;
  }

  // Targeting rules
  if (flag.targeting_rules && flag.targeting_rules.length > 0) {
    return evaluateTargetingRules(flag.targeting_rules, context);
  }

  return true;
}

function evaluateTargetingRules(rules, context) {
  if (!rules.length) return true;

  // OR logic across rules
  for (const rule of rules) {
    if (evaluateRule(rule, context)) return true;
  }
  return false;
}

function evaluateRule(rule, context) {
  const value = context[rule.attribute];
  if (value === undefined) return false;

  switch (rule.operator) {
    case "equals": return value === rule.value;
    case "not_equals": return value !== rule.value;
    case "contains": return String(value).includes(String(rule.value));
    case "in": return Array.isArray(rule.value) && rule.value.includes(value);
    case "not_in": return Array.isArray(rule.value) && !rule.value.includes(value);
    case "gt": return Number(value) > Number(rule.value);
    case "gte": return Number(value) >= Number(rule.value);
    case "lt": return Number(value) < Number(rule.value);
    case "lte": return Number(value) <= Number(rule.value);
    default: return false;
  }
}

// ——————————————————————————————————————
// A/B Testing
// ——————————————————————————————————————

export async function createABTest(options) {
  try {
    const flag = await createFlag({
      key: `ab_${options.key}`,
      name: options.name,
      description: options.description || "",
      enabled: true,
      rollout_percentage: 100,
      metadata: { ab_test: true, variants: options.variants, weights: options.weights || [50, 50] },
      targetingRules: options.targetingRules || [],
      createdBy: options.createdBy,
    });

    return flag;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getVariant(flagKey, userId) {
  try {
    const variantBucket = hashCode(`${flagKey}:variant:${userId}`) % 100;
    const flag = await supabaseAdmin
      .from("feature_flags")
      .select("metadata")
      .eq("key", flagKey)
      .single();

    if (flag.error) return { success: false, error: "Flag not found" };

    const metadata = flag.data?.metadata || {};
    const weights = metadata.weights || [50, 50];
    const variants = metadata.variants || ["control", "treatment"];

    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (variantBucket < cumulative) {
        return { success: true, data: { variant: variants[i], index: i } };
      }
    }

    return { success: true, data: { variant: variants[0], index: 0 } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function trackEvent(flagKey, userId, event, metadata = {}) {
  try {
    const { error } = await supabaseAdmin
      .from("feature_flag_events")
      .insert({
        flag_key: flagKey,
        user_id: userId,
        event,
        metadata,
      });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Cache Control
// ——————————————————————————————————————

export function invalidateCache(flagKey) {
  _cache.delete(flagKey);
}

export function clearCache() {
  _cache.clear();
}

// ——————————————————————————————————————
// Helper
// ——————————————————————————————————————

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
