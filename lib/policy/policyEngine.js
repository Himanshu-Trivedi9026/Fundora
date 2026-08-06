/**
 * Policy Engine — Database-driven configurable policies.
 *
 * Manages platform policies that can be configured without code changes.
 * Supports versioning, validation, and context-based evaluation.
 *
 * Features:
 *   - CRUD operations for policies
 *   - Version history tracking on every value change
 *   - Context-based policy evaluation
 *   - Default policy initialization
 *
 * Security:
 *   - All mutations are audit-logged
 *   - Uses secureLogger for all logging
 *   - Uses supabaseAdmin for all DB operations
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logInfo, logError, logWarn } from "../verification/secureLogger";
import { logAuditEvent } from "../verification/auditLog";

// ─── Constants ───

/**
 * Valid policy categories.
 * @type {string[]}
 */
export const POLICY_CATEGORIES = [
  "verification",
  "fraud",
  "payout",
  "escrow",
  "milestone",
  "compliance",
  "kyc",
  "aml",
  "general",
];

/**
 * Valid policy types.
 * @type {string[]}
 */
export const POLICY_TYPES = [
  "threshold",
  "boolean",
  "string",
  "number",
  "array",
  "json",
];

// ─── Core Functions ───

/**
 * Create a new policy.
 *
 * @param {Object} params
 * @param {string} params.policyKey — Unique policy key (e.g., 'min_trust_score')
 * @param {string} params.name — Human-readable policy name
 * @param {string} [params.description] — Policy description
 * @param {string} params.category — Policy category from POLICY_CATEGORIES
 * @param {string} params.policyType — Policy type from POLICY_TYPES
 * @param {*} params.value — Policy value
 * @param {*} [params.defaultValue] — Default value (used for reset)
 * @param {number} [params.minValue] — Minimum allowed value (for threshold/number types)
 * @param {number} [params.maxValue] — Maximum allowed value (for threshold/number types)
 * @param {Array} [params.allowedValues] — Allowed values (for string/array types)
 * @param {string} [params.createdBy] — User ID of the creator
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createPolicy({
  policyKey,
  name,
  description,
  category,
  policyType,
  value,
  defaultValue,
  minValue,
  maxValue,
  allowedValues,
  createdBy,
}) {
  try {
    if (!policyKey || !name || !category || !policyType || value === undefined) {
      return {
        success: false,
        error: "policyKey, name, category, policyType, and value are required",
      };
    }

    if (!POLICY_CATEGORIES.includes(category)) {
      return {
        success: false,
        error: `Invalid category: ${category}. Must be one of: ${POLICY_CATEGORIES.join(", ")}`,
      };
    }

    if (!POLICY_TYPES.includes(policyType)) {
      return {
        success: false,
        error: `Invalid policyType: ${policyType}. Must be one of: ${POLICY_TYPES.join(", ")}`,
      };
    }

    // Check for duplicate policy key
    const { data: existing } = await supabaseAdmin
      .from("policies")
      .select("id")
      .eq("policy_key", policyKey)
      .single();

    if (existing) {
      return { success: false, error: `Policy with key '${policyKey}' already exists` };
    }

    const { data, error } = await supabaseAdmin
      .from("policies")
      .insert({
        policy_key: policyKey,
        name,
        description: description || null,
        category,
        policy_type: policyType,
        value,
        default_value: defaultValue !== undefined ? defaultValue : value,
        min_value: minValue !== undefined ? minValue : null,
        max_value: maxValue !== undefined ? maxValue : null,
        allowed_values: allowedValues || null,
        version: 1,
        is_active: true,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) {
      logError("PolicyEngine", "Create policy error", { error: error.message, policyKey });
      return { success: false, error: "Failed to create policy" };
    }

    logInfo("PolicyEngine", "Policy created", {
      policyId: data.id,
      policyKey,
      category,
      policyType,
    });

    await logAuditEvent({
      eventType: "policy.created",
      entityType: "policies",
      entityId: data.id,
      userId: createdBy,
      action: "create_policy",
      details: { policyKey, name, category, policyType, value },
    });

    return { success: true, data };
  } catch (err) {
    logError("PolicyEngine", "Create policy error", { error: err.message });
    return { success: false, error: "Failed to create policy" };
  }
}

/**
 * Get a policy by ID.
 *
 * @param {string} policyId — Policy ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getPolicy(policyId) {
  try {
    if (!policyId) {
      return { success: false, error: "policyId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("policies")
      .select("*")
      .eq("id", policyId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Policy not found" };
      }
      logError("PolicyEngine", "Fetch policy error", { error: error.message, policyId });
      return { success: false, error: "Failed to fetch policy" };
    }

    return { success: true, data };
  } catch (err) {
    logError("PolicyEngine", "Fetch policy error", { error: err.message });
    return { success: false, error: "Failed to fetch policy" };
  }
}

/**
 * Get a policy by its unique key.
 *
 * @param {string} policyKey — Policy key
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getPolicyByKey(policyKey) {
  try {
    if (!policyKey) {
      return { success: false, error: "policyKey is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("policies")
      .select("*")
      .eq("policy_key", policyKey)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Policy not found" };
      }
      logError("PolicyEngine", "Fetch policy by key error", { error: error.message, policyKey });
      return { success: false, error: "Failed to fetch policy" };
    }

    return { success: true, data };
  } catch (err) {
    logError("PolicyEngine", "Fetch policy by key error", { error: err.message });
    return { success: false, error: "Failed to fetch policy" };
  }
}

/**
 * List policies with filters and pagination.
 *
 * @param {Object} params
 * @param {string} [params.category] — Filter by category
 * @param {boolean} [params.isActive] — Filter by active status
 * @param {string} [params.policyType] — Filter by policy type
 * @param {number} [params.limit=50] — Max results
 * @param {number} [params.offset=0] — Offset
 * @returns {Promise<{success: boolean, data?: Object[], total?: number, error?: string}>}
 */
export async function getPolicies({
  category,
  isActive,
  policyType,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabaseAdmin
      .from("policies")
      .select("*", { count: "exact" });

    if (category) query = query.eq("category", category);
    if (isActive !== undefined) query = query.eq("is_active", isActive);
    if (policyType) query = query.eq("policy_type", policyType);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logError("PolicyEngine", "List policies error", { error: error.message });
      return { success: false, error: "Failed to fetch policies" };
    }

    return {
      success: true,
      data: data || [],
      total: count || 0,
    };
  } catch (err) {
    logError("PolicyEngine", "List policies error", { error: err.message });
    return { success: false, error: "Failed to fetch policies" };
  }
}

/**
 * Update a policy's value. Creates a policy_version entry and increments version.
 *
 * @param {string} policyId — Policy ID
 * @param {*} newValue — New policy value
 * @param {string} changeReason — Reason for the change
 * @param {string} changedBy — User ID making the change
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updatePolicyValue(policyId, newValue, changeReason, changedBy) {
  try {
    if (!policyId || newValue === undefined || !changeReason || !changedBy) {
      return {
        success: false,
        error: "policyId, newValue, changeReason, and changedBy are required",
      };
    }

    // Fetch current policy
    const { data: current, error: fetchError } = await supabaseAdmin
      .from("policies")
      .select("*")
      .eq("id", policyId)
      .single();

    if (fetchError || !current) {
      return { success: false, error: "Policy not found" };
    }

    // Validate value against constraints
    if (current.policy_type === "threshold" || current.policy_type === "number") {
      if (typeof newValue !== "number") {
        return { success: false, error: "Value must be a number for this policy type" };
      }

      if (current.min_value !== null && newValue < current.min_value) {
        return {
          success: false,
          error: `Value must be at least ${current.min_value}`,
        };
      }

      if (current.max_value !== null && newValue > current.max_value) {
        return {
          success: false,
          error: `Value must be at most ${current.max_value}`,
        };
      }
    }

    if (current.allowed_values && current.allowed_values.length > 0) {
      const valueToCheck = Array.isArray(newValue) ? newValue : [newValue];
      const allAllowed = valueToCheck.every((v) => current.allowed_values.includes(v));
      if (!allAllowed) {
        return {
          success: false,
          error: `Value must be one of: ${current.allowed_values.join(", ")}`,
        };
      }
    }

    const now = new Date().toISOString();
    const newVersion = current.version + 1;

    // Create version history entry
    const { error: versionError } = await supabaseAdmin
      .from("policy_versions")
      .insert({
        policy_id: policyId,
        policy_key: current.policy_key,
        previous_value: current.value,
        new_value: newValue,
        version: newVersion,
        change_reason: changeReason,
        changed_by: changedBy,
      });

    if (versionError) {
      logError("PolicyEngine", "Create version entry error", { error: versionError.message, policyId });
      return { success: false, error: "Failed to record policy version" };
    }

    // Update the policy value
    const { data, error } = await supabaseAdmin
      .from("policies")
      .update({
        value: newValue,
        version: newVersion,
        updated_at: now,
      })
      .eq("id", policyId)
      .select()
      .single();

    if (error) {
      logError("PolicyEngine", "Update policy value error", { error: error.message, policyId });
      return { success: false, error: "Failed to update policy value" };
    }

    logInfo("PolicyEngine", "Policy value updated", {
      policyId,
      policyKey: current.policy_key,
      previousVersion: current.version,
      newVersion,
      changedBy,
    });

    await logAuditEvent({
      eventType: "policy.value_updated",
      entityType: "policies",
      entityId: policyId,
      userId: changedBy,
      action: "update_policy_value",
      details: {
        policyKey: current.policy_key,
        previousValue: current.value,
        newValue,
        previousVersion: current.version,
        newVersion,
        changeReason,
      },
    });

    return { success: true, data };
  } catch (err) {
    logError("PolicyEngine", "Update policy value error", { error: err.message });
    return { success: false, error: "Failed to update policy value" };
  }
}

/**
 * Get version history for a policy.
 *
 * @param {string} policyId — Policy ID
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export async function getPolicyVersions(policyId) {
  try {
    if (!policyId) {
      return { success: false, error: "policyId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("policy_versions")
      .select("*")
      .eq("policy_id", policyId)
      .order("version", { ascending: false });

    if (error) {
      logError("PolicyEngine", "Fetch versions error", { error: error.message, policyId });
      return { success: false, error: "Failed to fetch policy versions" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("PolicyEngine", "Fetch versions error", { error: err.message });
    return { success: false, error: "Failed to fetch policy versions" };
  }
}

/**
 * Evaluate a policy against a given context.
 * Returns whether the policy allows or blocks the action.
 *
 * @param {string} policyKey — Policy key
 * @param {Object} context — Evaluation context
 * @param {*} [context.value] — Value to evaluate against threshold
 * @param {string} [context.action] — Action being evaluated
 * @param {Object} [context.metadata] — Additional context
 * @returns {Promise<{success: boolean, allowed?: boolean, value?: *, reason?: string}>}
 */
export async function evaluatePolicy(policyKey, context = {}) {
  try {
    if (!policyKey) {
      return { success: false, error: "policyKey is required" };
    }

    const policyResult = await getPolicyByKey(policyKey);

    if (!policyResult.success) {
      return { success: false, error: `Policy '${policyKey}' not found` };
    }

    const policy = policyResult.data;

    if (!policy.is_active) {
      return {
        success: true,
        allowed: true,
        value: policy.default_value,
        reason: `Policy '${policyKey}' is inactive, using default value`,
      };
    }

    const policyValue = policy.value;

    // Threshold evaluation
    if (policy.policy_type === "threshold") {
      const contextValue = context.value;

      if (contextValue === undefined || contextValue === null) {
        return {
          success: true,
          allowed: false,
          value: policyValue,
          reason: `No value provided for threshold evaluation against '${policyKey}'`,
        };
      }

      // Higher value = higher risk (for fraud/threshold policies)
      const allowed = contextValue < policyValue;
      return {
        success: true,
        allowed,
        value: policyValue,
        reason: allowed
          ? `Value ${contextValue} is below threshold ${policyValue}`
          : `Value ${contextValue} meets or exceeds threshold ${policyValue}`,
      };
    }

    // Boolean evaluation
    if (policy.policy_type === "boolean") {
      return {
        success: true,
        allowed: Boolean(policyValue),
        value: policyValue,
        reason: `Policy '${policyKey}' is ${policyValue ? "enabled" : "disabled"}`,
      };
    }

    // Array evaluation (e.g., required_verifications)
    if (policy.policy_type === "array") {
      const requiredItems = Array.isArray(policyValue) ? policyValue : [];
      const providedItems = Array.isArray(context.value) ? context.value : [];
      const missing = requiredItems.filter((item) => !providedItems.includes(item));
      const allowed = missing.length === 0;

      return {
        success: true,
        allowed,
        value: policyValue,
        reason: allowed
          ? `All required items are present`
          : `Missing required items: ${missing.join(", ")}`,
      };
    }

    // String/number/json — return value for caller to decide
    return {
      success: true,
      allowed: true,
      value: policyValue,
      reason: `Policy '${policyKey}' value returned for custom evaluation`,
    };
  } catch (err) {
    logError("PolicyEngine", "Evaluate policy error", { error: err.message, policyKey });
    return { success: false, error: "Failed to evaluate policy" };
  }
}

/**
 * Get all active policies.
 *
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export async function getActivePolicies() {
  try {
    const { data, error } = await supabaseAdmin
      .from("policies")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true });

    if (error) {
      logError("PolicyEngine", "Fetch active policies error", { error: error.message });
      return { success: false, error: "Failed to fetch active policies" };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    logError("PolicyEngine", "Fetch active policies error", { error: err.message });
    return { success: false, error: "Failed to fetch active policies" };
  }
}

/**
 * Initialize default policies if they do not already exist.
 *
 * @returns {Promise<{success: boolean, data?: Object[], error?: string}>}
 */
export async function initializeDefaultPolicies() {
  try {
    const defaultPolicies = [
      {
        policyKey: "min_trust_score",
        name: "Minimum Trust Score",
        description: "Minimum trust score required for a user to perform sensitive actions",
        category: "verification",
        policyType: "threshold",
        value: 30,
      },
      {
        policyKey: "required_verifications",
        name: "Required Verifications",
        description: "List of verification types required for full account access",
        category: "verification",
        policyType: "array",
        value: ["email", "phone", "id"],
      },
      {
        policyKey: "fraud_block_threshold",
        name: "Fraud Block Threshold",
        description: "Fraud score at or above which the user is automatically blocked",
        category: "fraud",
        policyType: "threshold",
        value: 75,
      },
      {
        policyKey: "fraud_monitor_threshold",
        name: "Fraud Monitor Threshold",
        description: "Fraud score at or above which the user is flagged for monitoring",
        category: "fraud",
        policyType: "threshold",
        value: 50,
      },
      {
        policyKey: "max_payout_amount",
        name: "Maximum Payout Amount",
        description: "Maximum payout amount in cents",
        category: "payout",
        policyType: "threshold",
        value: 100000000,
      },
      {
        policyKey: "min_payout_amount",
        name: "Minimum Payout Amount",
        description: "Minimum payout amount in cents",
        category: "payout",
        policyType: "threshold",
        value: 1000,
      },
      {
        policyKey: "escrow_fee_percentage",
        name: "Escrow Fee Percentage",
        description: "Platform fee percentage applied to escrow transactions",
        category: "escrow",
        policyType: "threshold",
        value: 5.0,
      },
      {
        policyKey: "auto_approve_milestone_threshold",
        name: "Auto-Approve Milestone Threshold",
        description: "Review score at or above which milestones are auto-approved",
        category: "milestone",
        policyType: "threshold",
        value: 80,
      },
    ];

    const created = [];

    for (const policy of defaultPolicies) {
      // Check if policy already exists
      const { data: existing } = await supabaseAdmin
        .from("policies")
        .select("id")
        .eq("policy_key", policy.policyKey)
        .single();

      if (existing) {
        logInfo("PolicyEngine", "Default policy already exists", { policyKey: policy.policyKey });
        continue;
      }

      const result = await createPolicy({
        policyKey: policy.policyKey,
        name: policy.name,
        description: policy.description,
        category: policy.category,
        policyType: policy.policyType,
        value: policy.value,
        defaultValue: policy.value,
        createdBy: "system",
      });

      if (result.success) {
        created.push(result.data);
      }
    }

    logInfo("PolicyEngine", "Default policies initialized", {
      created: created.length,
      skipped: defaultPolicies.length - created.length,
    });

    return { success: true, data: created };
  } catch (err) {
    logError("PolicyEngine", "Initialize default policies error", { error: err.message });
    return { success: false, error: "Failed to initialize default policies" };
  }
}
