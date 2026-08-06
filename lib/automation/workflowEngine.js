/**
 * Workflow Engine — Configurable workflow automation engine.
 *
 * Manages the full lifecycle of automated workflows:
 *   - CRUD operations (create, read, update, delete)
 *   - Enable/disable workflows
 *   - Trigger-based and schedule-based execution
 *   - Condition evaluation engine
 *   - Action execution pipeline
 *   - Run history and retry support
 *   - Workflow templates
 *   - Scheduled workflow processing
 *
 * Security:
 *   - Never throws — all errors returned as { success: false, error }
 *   - All mutations are audit-logged
 *   - Uses secureLogger for all logging
 *   - Uses supabaseAdmin for all DB operations
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError, logWarn } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";
import { ROLES } from "../roles.js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// ─── Constants ───

export const TRIGGER_TYPES = {
  EVENT: "event",
  SCHEDULE: "schedule",
  MANUAL: "manual",
  WEBHOOK: "webhook",
};

export const ACTION_TYPES = {
  SEND_NOTIFICATION: "send_notification",
  UPDATE_ENTITY: "update_entity",
  CALL_API: "call_api",
  RUN_AI: "run_ai",
  SEND_WEBHOOK: "send_webhook",
  UPDATE_STATUS: "update_status",
  CREATE_TASK: "create_task",
};

export const CONDITION_TYPES = {
  EQUALS: "equals",
  NOT_EQUALS: "not_equals",
  GREATER_THAN: "greater_than",
  LESS_THAN: "less_than",
  CONTAINS: "contains",
  AND: "and",
  OR: "or",
};

const VALID_TRIGGER_TYPES = Object.values(TRIGGER_TYPES);
const VALID_ACTION_TYPES = Object.values(ACTION_TYPES);
const VALID_CONDITION_TYPES = Object.values(CONDITION_TYPES);

// ─── Security: update_entity / update_status allowlists ───
// Workflow actions may only mutate a curated set of non-security tables, and
// only the columns listed below. Any other table or column is rejected so a
// workflow (or a maliciously crafted workflow config) can never escalate
// privileges or rewrite identity/auth data through the service-role client.

// Allowlists are aligned to the LIVE Supabase schema (verified via PostgREST
// OpenAPI + service-role probes). Tables/columns absent from the live schema
// were removed so a workflow can never reference a non-existent object.
export const ALLOWED_ENTITY_TABLES = [
  "projects",
  "public_donations",
  "notifications",
];

const ALLOWED_UPDATE_COLUMNS = {
  // live projects columns (title, description, pledged, deadline confirmed)
  projects: ["title", "description", "pledged", "deadline"],
  // live public_donations columns (status, name confirmed)
  public_donations: ["status", "name"],
  // live notifications columns (is_read confirmed)
  notifications: ["is_read"],
};

// Columns that can never be written by a workflow action, regardless of the
// allowlist above (defense in depth — see requirement 4).
const FORBIDDEN_UPDATE_COLUMNS = new Set([
  // identity / ownership
  "id",
  "owner_id",
  "creator_id",
  "user_id",
  "organization_id",
  "org_id",
  "created_by",
  "created_at",
  "updated_at",
  "updated_by",
  // role & permissions
  "role",
  "permissions",
  "is_admin",
  "is_platform_admin",
  "is_staff",
  // auth & credentials
  "email",
  "phone",
  "mobile",
  "password",
  "password_hash",
  "token",
  "api_key",
  "secret",
  "otp",
  "verification_code",
  "session_id",
  // security & verification
  "is_verified",
  "verified_at",
  "risk_score",
  "fraud_status",
  "banned",
]);

function isColumnAllowed(table, column) {
  const allowed = ALLOWED_UPDATE_COLUMNS[table];
  if (!allowed || !Array.isArray(allowed)) return false;
  if (!allowed.includes(column)) return false;
  if (FORBIDDEN_UPDATE_COLUMNS.has(column)) return false;
  return true;
}

/**
 * Validate a single workflow action's config before it is stored or executed.
 * Unknown tables/columns, forbidden columns, and unsafe URLs are rejected.
 */
export function validateActionConfig(action) {
  if (
    !action ||
    typeof action !== "object" ||
    typeof action.type !== "string"
  ) {
    return { valid: false, error: "Action type is required" };
  }
  if (!VALID_ACTION_TYPES.includes(action.type)) {
    return { valid: false, error: `Invalid action type: ${action.type}` };
  }

  const config = action.config || {};

  switch (action.type) {
    case ACTION_TYPES.UPDATE_ENTITY: {
      const { entityType, entityId, updates } = config;
      if (!entityType)
        return { valid: false, error: "update_entity requires entityType" };
      if (!ALLOWED_ENTITY_TABLES.includes(entityType)) {
        return {
          valid: false,
          error: `Table '${entityType}' is not allowlisted for workflow updates`,
        };
      }
      if (!entityId)
        return { valid: false, error: "update_entity requires entityId" };
      if (
        !updates ||
        typeof updates !== "object" ||
        Array.isArray(updates) ||
        Object.keys(updates).length === 0
      ) {
        return {
          valid: false,
          error: "update_entity requires a non-empty updates object",
        };
      }
      const bad = Object.keys(updates).filter(
        (k) => !isColumnAllowed(entityType, k),
      );
      if (bad.length > 0) {
        return {
          valid: false,
          error: `Columns not allowlisted for ${entityType}: ${bad.join(", ")}`,
        };
      }
      return { valid: true };
    }

    case ACTION_TYPES.UPDATE_STATUS: {
      const { entityType, entityId, statusField, statusValue } = config;
      if (!entityType)
        return { valid: false, error: "update_status requires entityType" };
      if (!ALLOWED_ENTITY_TABLES.includes(entityType)) {
        return {
          valid: false,
          error: `Table '${entityType}' is not allowlisted for workflow updates`,
        };
      }
      if (!entityId)
        return { valid: false, error: "update_status requires entityId" };
      if (!statusField)
        return { valid: false, error: "update_status requires statusField" };
      if (!isColumnAllowed(entityType, statusField)) {
        return {
          valid: false,
          error: `Status field '${statusField}' is not allowlisted for ${entityType}`,
        };
      }
      if (
        statusValue === undefined ||
        statusValue === null ||
        statusValue === ""
      ) {
        return { valid: false, error: "update_status requires statusValue" };
      }
      return { valid: true };
    }

    case ACTION_TYPES.CALL_API:
    case ACTION_TYPES.SEND_WEBHOOK: {
      const { url } = config;
      if (!url || typeof url !== "string") {
        return { valid: false, error: `${action.type} requires a url string` };
      }
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return { valid: false, error: "Invalid URL" };
      }
      if (parsed.protocol !== "https:") {
        return { valid: false, error: "Only HTTPS URLs are allowed" };
      }
      return { valid: true };
    }

    default:
      // send_notification / run_ai / create_task have no table/URL config to gate.
      return { valid: true };
  }
}

// ─── Security: SSRF guard for call_api / send_webhook ───
// Outbound fetches are restricted to public HTTPS destinations. Localhost,
// loopback, link-local, private ranges, *.local, and cloud-metadata endpoints
// are blocked, plus DNS resolution is checked so a hostname that resolves to a
// private address is also rejected. A timeout and a redirect limit are applied.

function isIpLiteral(host) {
  return isIP(host) > 0;
}

/**
 * Expand a bare IPv6 address (no brackets) to its canonical 32-hex-digit form.
 * Handles "::" compression and embedded IPv4 (e.g. "::ffff:127.0.0.1").
 * Returns null when the input is not a valid expanded IPv6 address.
 */
function expandIpv6(addr) {
  let a = addr;
  if (a.includes(".")) {
    const lastColon = a.lastIndexOf(":");
    const m = a
      .slice(lastColon + 1)
      .match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return null;
    const hex = m.slice(1).map((n) => Number(n).toString(16).padStart(2, "0"));
    a = a.slice(0, lastColon + 1) + `${hex[0]}${hex[1]}:${hex[2]}${hex[3]}`;
  }
  const halves = a.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;
  return groups.map((g) => g.padStart(4, "0")).join("");
}

function isPrivateIpAddress(address) {
  const v4 = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    return false;
  }

  const lower = address.toLowerCase();

  // IPv4-mapped IPv6, dotted-quad form: ::ffff:127.0.0.1 → recurse on the IPv4.
  const mappedV4 = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedV4) return isPrivateIpAddress(mappedV4[1]);

  const canonical = expandIpv6(lower);
  if (!canonical) return false;

  const first16 = parseInt(canonical.slice(0, 4), 16);
  if (canonical === "0".repeat(31) + "1") return true; // ::1 loopback
  if (canonical === "0".repeat(32)) return true; // :: unspecified
  if ((first16 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first16 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  // IPv4-mapped/translated IPv6 in hex form (::ffff:0:0/96), e.g. ::ffff:0a00:1.
  if (canonical.startsWith("00000000000000000000ffff")) {
    const last8 = canonical.slice(24);
    const octets = [];
    for (let i = 0; i < 8; i += 2) {
      octets.push(parseInt(last8.slice(i, i + 2), 16));
    }
    return isPrivateIpAddress(octets.join("."));
  }
  return false;
}

export async function isSafeOutboundUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "https:") {
    return { safe: false, reason: "Only HTTPS URLs are allowed" };
  }

  let host = url.hostname.toLowerCase().replace(/\.$/, "");

  // URL.hostname returns IPv6 literals WITH brackets (e.g. "[::1]"). Strip them
  // so the private-range / loopback checks below see the bare address.
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  if (host === "localhost" || host.endsWith(".localhost")) {
    return { safe: false, reason: "Localhost is blocked" };
  }
  if (
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "::"
  ) {
    return { safe: false, reason: "Loopback addresses are blocked" };
  }
  if (host === "local" || host.endsWith(".local")) {
    return { safe: false, reason: ".local hosts are blocked" };
  }
  if (
    host === "169.254.169.254" ||
    host === "metadata.google.internal" ||
    host.endsWith(".metadata.google.internal") ||
    host.endsWith(".internal")
  ) {
    return { safe: false, reason: "Metadata endpoints are blocked" };
  }

  if (isIpLiteral(host)) {
    if (isPrivateIpAddress(host)) {
      return { safe: false, reason: "Private IP addresses are blocked" };
    }
    return { safe: true };
  }

  // Resolve hostname and reject if any resolved address is private/loopback.
  try {
    const records = await lookup(host, { all: true });
    if (!records || records.length === 0) {
      return { safe: false, reason: "Unable to resolve hostname" };
    }
    for (const { address } of records) {
      if (isPrivateIpAddress(address)) {
        return {
          safe: false,
          reason: "Hostname resolves to a private/loopback IP address",
        };
      }
    }
  } catch {
    return { safe: false, reason: "Unable to resolve hostname" };
  }

  return { safe: true };
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

/**
 * Fetch a URL through the SSRF guard. Validates the URL, applies a timeout,
 * and follows at most MAX_REDIRECTS redirects — re-validating every hop.
 * Returns `{ blocked, reason }` on a blocked/failed request, else `{ response }`.
 */
async function fetchSafe(url, options = {}) {
  const safe = await isSafeOutboundUrl(url);
  if (!safe.safe) return { blocked: true, reason: safe.reason };

  let currentUrl = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    let response;
    try {
      response = await fetch(currentUrl, {
        ...options,
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      return { blocked: true, reason: `Request failed: ${err.message}` };
    }

    if (response && [301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return { response };
      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        return { blocked: true, reason: "Invalid redirect location" };
      }
      const nextSafe = await isSafeOutboundUrl(currentUrl);
      if (!nextSafe.safe) return { blocked: true, reason: nextSafe.reason };
      continue;
    }

    return { response };
  }
  return { blocked: true, reason: "Too many redirects" };
}

// ─── Security: workflow ownership verification ───
// A user may only operate on a workflow they created, unless they are a
// platform_admin. Enforced at the API boundary (see pages/api/automation/*).
export async function verifyWorkflowOwnership({ workflowId, userId }) {
  try {
    if (!workflowId || !userId) {
      return { success: false, error: "workflowId and userId are required" };
    }

    const { data, error } = await supabaseAdmin
      .from("workflows")
      .select("created_by")
      .eq("id", workflowId)
      .single();

    if (error || !data) {
      return { success: false, error: "Workflow not found" };
    }

    if (data.created_by === userId) {
      return { success: true, allowed: true, workflow: data };
    }

    // Platform admins may access any workflow.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.role === ROLES.ADMIN) {
      return { success: true, allowed: true, workflow: data };
    }

    return { success: true, allowed: false, reason: "Not the workflow owner" };
  } catch (err) {
    logError("WorkflowEngine", "Ownership verification error", {
      error: err.message,
      workflowId,
    });
    return { success: false, error: "Failed to verify workflow ownership" };
  }
}

// ─── Helpers ───

function validateWorkflowInput({ name, triggerType }) {
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return {
      valid: false,
      error: "name is required and must be a non-empty string",
    };
  }
  if (name.length > 255) {
    return { valid: false, error: "name must be 255 characters or fewer" };
  }
  if (!triggerType || !VALID_TRIGGER_TYPES.includes(triggerType)) {
    return {
      valid: false,
      error: `triggerType must be one of: ${VALID_TRIGGER_TYPES.join(", ")}`,
    };
  }
  return { valid: true };
}

function evaluateCondition(condition, context) {
  if (!condition || !condition.type) return false;

  switch (condition.type) {
    case CONDITION_TYPES.EQUALS:
      return context[condition.field] === condition.value;

    case CONDITION_TYPES.NOT_EQUALS:
      return context[condition.field] !== condition.value;

    case CONDITION_TYPES.GREATER_THAN:
      return (context[condition.field] || 0) > (condition.value || 0);

    case CONDITION_TYPES.LESS_THAN:
      return (context[condition.field] || 0) < (condition.value || 0);

    case CONDITION_TYPES.CONTAINS: {
      const fieldValue = String(context[condition.field] || "");
      return fieldValue.includes(condition.value || "");
    }

    case CONDITION_TYPES.AND: {
      if (!Array.isArray(condition.conditions)) return false;
      return condition.conditions.every((c) => evaluateCondition(c, context));
    }

    case CONDITION_TYPES.OR: {
      if (!Array.isArray(condition.conditions)) return false;
      return condition.conditions.some((c) => evaluateCondition(c, context));
    }

    default:
      return false;
  }
}

async function executeAction(action, context) {
  // Validate the action config before executing it. This also rejects
  // workflows created before config validation existed (legacy stored configs).
  const configResult = validateActionConfig(action);
  if (!configResult.valid) {
    return { status: "error", output: { error: configResult.error } };
  }

  const { type, config = {} } = action;

  switch (type) {
    case ACTION_TYPES.SEND_NOTIFICATION: {
      // Create notification record.
      // NOTE: the live `notifications` table has only these columns
      // (id, user_id, type, is_read, actor_id, entity_id, created_at).
      // title/message/metadata do not exist — writing them 400s the insert.
      const row = {
        user_id: config.userId || context.userId,
        type: config.notificationType || "system",
        is_read: false,
      };
      if (config.actorId) row.actor_id = config.actorId;
      if (config.entityId) row.entity_id = config.entityId;

      const { data, error } = await supabaseAdmin
        .from("notifications")
        .insert(row)
        .select()
        .single();

      if (error) {
        return { status: "error", output: { error: error.message } };
      }
      return { status: "success", output: { notificationId: data.id } };
    }

    case ACTION_TYPES.UPDATE_ENTITY: {
      const { entityType, entityId, updates } = config;
      if (!entityType || !entityId || !updates) {
        return {
          status: "error",
          output: { error: "entityType, entityId, and updates are required" },
        };
      }

      const { data, error } = await supabaseAdmin
        .from(entityType)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", entityId)
        .select()
        .single();

      if (error) {
        return { status: "error", output: { error: error.message } };
      }
      return { status: "success", output: { updated: true, entityId } };
    }

    case ACTION_TYPES.CALL_API: {
      const { url, method = "POST", body, headers = {} } = config;
      if (!url) {
        return {
          status: "error",
          output: { error: "URL is required for API call" },
        };
      }

      const { blocked, reason, response } = await fetchSafe(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: method !== "GET" ? JSON.stringify(body || {}) : undefined,
      });

      if (blocked) {
        return { status: "error", output: { error: reason } };
      }

      try {
        const responseData = await response.json().catch(() => ({}));
        return {
          status: response.ok ? "success" : "error",
          output: { statusCode: response.status, data: responseData },
        };
      } catch (fetchErr) {
        return { status: "error", output: { error: fetchErr.message } };
      }
    }

    case ACTION_TYPES.RUN_AI: {
      // Placeholder for AI execution — delegate to AI engine in production
      logInfo("WorkflowEngine", "AI action triggered", { config });
      return {
        status: "success",
        output: {
          message: "AI action recorded — processing in background",
          taskType: config.taskType,
        },
      };
    }

    case ACTION_TYPES.SEND_WEBHOOK: {
      const { url, payload, secret } = config;
      if (!url) {
        return {
          status: "error",
          output: { error: "Webhook URL is required" },
        };
      }

      const headers = { "Content-Type": "application/json" };
      if (secret) {
        // Basic HMAC-like signature — production should use proper crypto
        headers["X-Webhook-Secret"] = secret;
      }

      const { blocked, reason, response } = await fetchSafe(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload || {}),
      });

      if (blocked) {
        return { status: "error", output: { error: reason } };
      }

      return {
        status: response.ok ? "success" : "error",
        output: { statusCode: response.status },
      };
    }

    case ACTION_TYPES.UPDATE_STATUS: {
      const { entityType, entityId, statusField, statusValue } = config;
      if (!entityType || !entityId || !statusField || !statusValue) {
        return {
          status: "error",
          output: {
            error:
              "entityType, entityId, statusField, and statusValue are required",
          },
        };
      }

      const { error } = await supabaseAdmin
        .from(entityType)
        .update({
          [statusField]: statusValue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entityId);

      if (error) {
        return { status: "error", output: { error: error.message } };
      }
      return {
        status: "success",
        output: { updated: true, entityId, [statusField]: statusValue },
      };
    }

    case ACTION_TYPES.CREATE_TASK: {
      const { title, description, assigneeId, priority, dueDate } = config;
      if (!title) {
        return { status: "error", output: { error: "Task title is required" } };
      }

      const { data, error } = await supabaseAdmin
        .from("tasks")
        .insert({
          title,
          description: description || null,
          assignee_id: assigneeId || null,
          priority: priority || "medium",
          due_date: dueDate || null,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        return { status: "error", output: { error: error.message } };
      }
      return { status: "success", output: { taskId: data.id } };
    }

    default:
      return {
        status: "error",
        output: { error: `Unknown action type: ${type}` },
      };
  }
}

// ─── CRUD Functions ───

/**
 * Create a new workflow.
 *
 * @param {Object} params
 * @param {string} params.name — Workflow name
 * @param {string} [params.description] — Workflow description
 * @param {string} params.triggerType — Trigger type from TRIGGER_TYPES
 * @param {Object[]} [params.conditions=[]] — Condition definitions
 * @param {Object[]} [params.actions=[]] — Action definitions
 * @param {Object} [params.retryConfig={}] — Retry configuration
 * @param {Object} [params.scheduleConfig={}] — Schedule configuration
 * @param {string} params.createdBy — User ID of creator
 * @param {string} [params.organizationId] — Organization ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createWorkflow({
  name,
  description,
  triggerType,
  conditions = [],
  actions = [],
  retryConfig = {},
  scheduleConfig = {},
  createdBy,
  organizationId,
}) {
  try {
    const validation = validateWorkflowInput({ name, triggerType });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    if (!createdBy) {
      return { success: false, error: "createdBy is required" };
    }

    // Validate actions (type AND full config — never trust client-supplied
    // table names, columns, or URLs).
    for (const action of actions) {
      if (!action.type || !VALID_ACTION_TYPES.includes(action.type)) {
        return {
          success: false,
          error: `Invalid action type: ${action.type}. Must be one of: ${VALID_ACTION_TYPES.join(", ")}`,
        };
      }
      const configResult = validateActionConfig(action);
      if (!configResult.valid) {
        return {
          success: false,
          error: `Invalid action config for ${action.type}: ${configResult.error}`,
        };
      }
    }

    // Validate conditions
    const validateConditions = (conds) => {
      for (const cond of conds) {
        if (!cond.type || !VALID_CONDITION_TYPES.includes(cond.type)) {
          return `Invalid condition type: ${cond.type}`;
        }
        if (
          cond.type === CONDITION_TYPES.AND ||
          cond.type === CONDITION_TYPES.OR
        ) {
          const err = validateConditions(cond.conditions || []);
          if (err) return err;
        }
      }
      return null;
    };

    const condError = validateConditions(conditions);
    if (condError) {
      return { success: false, error: condError };
    }

    const { data, error } = await supabaseAdmin
      .from("workflows")
      .insert({
        name: name.trim(),
        description: description || null,
        trigger_type: triggerType,
        conditions,
        actions,
        retry_config: retryConfig,
        schedule_config: scheduleConfig,
        enabled: true,
        created_by: createdBy,
        organization_id: organizationId || null,
      })
      .select()
      .single();

    if (error) {
      logError("WorkflowEngine", "Create workflow error", {
        error: error.message,
        name,
      });
      return { success: false, error: "Failed to create workflow" };
    }

    logInfo("WorkflowEngine", "Workflow created", {
      workflowId: data.id,
      name,
      triggerType,
    });

    await logAuditEvent({
      eventType: "workflow.created",
      entityType: "workflows",
      entityId: data.id,
      userId: createdBy,
      action: "create_workflow",
      details: { name, triggerType, actionCount: actions.length },
    });

    return { success: true, data };
  } catch (err) {
    logError("WorkflowEngine", "Create workflow error", {
      error: err.message,
      name,
    });
    return { success: false, error: "Failed to create workflow" };
  }
}

/**
 * Update an existing workflow.
 *
 * @param {string} workflowId — Workflow ID
 * @param {Object} updates — Fields to update
 * @param {string} performedBy — User ID performing the update
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function updateWorkflow(workflowId, updates, performedBy) {
  try {
    if (!workflowId) {
      return { success: false, error: "workflowId is required" };
    }
    if (!updates || Object.keys(updates).length === 0) {
      return {
        success: false,
        error: "updates object is required and must not be empty",
      };
    }
    if (!performedBy) {
      return { success: false, error: "performedBy is required" };
    }

    // Sanitize allowed update fields
    const allowedFields = [
      "name",
      "description",
      "trigger_type",
      "conditions",
      "actions",
      "retry_config",
      "schedule_config",
      "enabled",
    ];
    const sanitizedUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = value;
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return { success: false, error: "No valid fields to update" };
    }

    sanitizedUpdates.updated_at = new Date().toISOString();
    sanitizedUpdates.updated_by = performedBy;

    const { data, error } = await supabaseAdmin
      .from("workflows")
      .update(sanitizedUpdates)
      .eq("id", workflowId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Workflow not found" };
      }
      logError("WorkflowEngine", "Update workflow error", {
        error: error.message,
        workflowId,
      });
      return { success: false, error: "Failed to update workflow" };
    }

    logInfo("WorkflowEngine", "Workflow updated", {
      workflowId,
      fields: Object.keys(sanitizedUpdates),
    });

    await logAuditEvent({
      eventType: "workflow.updated",
      entityType: "workflows",
      entityId: workflowId,
      userId: performedBy,
      action: "update_workflow",
      details: { updatedFields: Object.keys(sanitizedUpdates) },
    });

    return { success: true, data };
  } catch (err) {
    logError("WorkflowEngine", "Update workflow error", {
      error: err.message,
      workflowId,
    });
    return { success: false, error: "Failed to update workflow" };
  }
}

/**
 * Delete a workflow.
 *
 * @param {string} workflowId — Workflow ID
 * @param {string} performedBy — User ID performing the deletion
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function deleteWorkflow(workflowId, performedBy) {
  try {
    if (!workflowId) {
      return { success: false, error: "workflowId is required" };
    }
    if (!performedBy) {
      return { success: false, error: "performedBy is required" };
    }

    // Check workflow exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("workflows")
      .select("id, name")
      .eq("id", workflowId)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: "Workflow not found" };
    }

    const { error } = await supabaseAdmin
      .from("workflows")
      .delete()
      .eq("id", workflowId);

    if (error) {
      logError("WorkflowEngine", "Delete workflow error", {
        error: error.message,
        workflowId,
      });
      return { success: false, error: "Failed to delete workflow" };
    }

    logInfo("WorkflowEngine", "Workflow deleted", {
      workflowId,
      name: existing.name,
    });

    await logAuditEvent({
      eventType: "workflow.deleted",
      entityType: "workflows",
      entityId: workflowId,
      userId: performedBy,
      action: "delete_workflow",
      details: { name: existing.name },
    });

    return { success: true, data: { deleted: true, workflowId } };
  } catch (err) {
    logError("WorkflowEngine", "Delete workflow error", {
      error: err.message,
      workflowId,
    });
    return { success: false, error: "Failed to delete workflow" };
  }
}

/**
 * Enable a workflow.
 *
 * @param {string} workflowId — Workflow ID
 * @param {string} performedBy — User ID performing the action
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function enableWorkflow(workflowId, performedBy) {
  try {
    if (!workflowId) {
      return { success: false, error: "workflowId is required" };
    }
    if (!performedBy) {
      return { success: false, error: "performedBy is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("workflows")
      .update({
        enabled: true,
        updated_at: new Date().toISOString(),
        updated_by: performedBy,
      })
      .eq("id", workflowId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Workflow not found" };
      }
      logError("WorkflowEngine", "Enable workflow error", {
        error: error.message,
        workflowId,
      });
      return { success: false, error: "Failed to enable workflow" };
    }

    logInfo("WorkflowEngine", "Workflow enabled", { workflowId });

    await logAuditEvent({
      eventType: "workflow.enabled",
      entityType: "workflows",
      entityId: workflowId,
      userId: performedBy,
      action: "enable_workflow",
      details: {},
    });

    return { success: true, data };
  } catch (err) {
    logError("WorkflowEngine", "Enable workflow error", {
      error: err.message,
      workflowId,
    });
    return { success: false, error: "Failed to enable workflow" };
  }
}

/**
 * Disable a workflow.
 *
 * @param {string} workflowId — Workflow ID
 * @param {string} performedBy — User ID performing the action
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function disableWorkflow(workflowId, performedBy) {
  try {
    if (!workflowId) {
      return { success: false, error: "workflowId is required" };
    }
    if (!performedBy) {
      return { success: false, error: "performedBy is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("workflows")
      .update({
        enabled: false,
        updated_at: new Date().toISOString(),
        updated_by: performedBy,
      })
      .eq("id", workflowId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Workflow not found" };
      }
      logError("WorkflowEngine", "Disable workflow error", {
        error: error.message,
        workflowId,
      });
      return { success: false, error: "Failed to disable workflow" };
    }

    logInfo("WorkflowEngine", "Workflow disabled", { workflowId });

    await logAuditEvent({
      eventType: "workflow.disabled",
      entityType: "workflows",
      entityId: workflowId,
      userId: performedBy,
      action: "disable_workflow",
      details: {},
    });

    return { success: true, data };
  } catch (err) {
    logError("WorkflowEngine", "Disable workflow error", {
      error: err.message,
      workflowId,
    });
    return { success: false, error: "Failed to disable workflow" };
  }
}

/**
 * List workflows with optional filters.
 *
 * @param {Object} params
 * @param {string} [params.organizationId] — Filter by organization
 * @param {boolean} [params.enabled] — Filter by enabled status
 * @param {string} [params.triggerType] — Filter by trigger type
 * @param {number} [params.limit=20] — Max results
 * @param {number} [params.offset=0] — Pagination offset
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function listWorkflows({
  organizationId,
  enabled,
  triggerType,
  limit = 20,
  offset = 0,
  userId,
}) {
  try {
    let query = supabaseAdmin
      .from("workflows")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Ownership scoping: non-admin users only see the workflows they created.
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (profile?.role !== ROLES.ADMIN) {
        query = query.eq("created_by", userId);
      }
    }

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }
    if (enabled !== undefined) {
      query = query.eq("enabled", enabled);
    }
    if (triggerType) {
      query = query.eq("trigger_type", triggerType);
    }

    const { data, error, count } = await query;

    if (error) {
      logError("WorkflowEngine", "List workflows error", {
        error: error.message,
      });
      return { success: false, error: "Failed to list workflows" };
    }

    return {
      success: true,
      data: {
        workflows: data || [],
        total: count || 0,
        limit,
        offset,
      },
    };
  } catch (err) {
    logError("WorkflowEngine", "List workflows error", { error: err.message });
    return { success: false, error: "Failed to list workflows" };
  }
}

/**
 * Get a workflow by ID.
 *
 * @param {string} workflowId — Workflow ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getWorkflow(workflowId) {
  try {
    if (!workflowId) {
      return { success: false, error: "workflowId is required" };
    }

    const { data, error } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "Workflow not found" };
      }
      logError("WorkflowEngine", "Get workflow error", {
        error: error.message,
        workflowId,
      });
      return { success: false, error: "Failed to get workflow" };
    }

    return { success: true, data };
  } catch (err) {
    logError("WorkflowEngine", "Get workflow error", {
      error: err.message,
      workflowId,
    });
    return { success: false, error: "Failed to get workflow" };
  }
}

// ─── Execution Functions ───

/**
 * Trigger a workflow execution.
 *
 * @param {Object} params
 * @param {string} params.workflowId — Workflow ID to trigger
 * @param {string} params.triggerEvent — Event that triggered the workflow
 * @param {Object} [params.input={}] — Input data for the workflow
 * @param {string} [params.triggeredBy] — User or system that triggered it
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function triggerWorkflow({
  workflowId,
  triggerEvent,
  input = {},
  triggeredBy,
}) {
  try {
    if (!workflowId) {
      return { success: false, error: "workflowId is required" };
    }
    if (!triggerEvent) {
      return { success: false, error: "triggerEvent is required" };
    }

    // 1. Load workflow from DB
    const workflowResult = await getWorkflow(workflowId);
    if (!workflowResult.success) {
      return { success: false, error: workflowResult.error };
    }

    const workflow = workflowResult.data;

    if (!workflow.enabled) {
      return { success: false, error: "Workflow is disabled" };
    }

    // 2. Create workflow_run record
    const { data: run, error: runError } = await supabaseAdmin
      .from("workflow_runs")
      .insert({
        workflow_id: workflowId,
        trigger_event: triggerEvent,
        status: "running",
        input,
        triggered_by: triggeredBy || "system",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      logError("WorkflowEngine", "Create workflow run error", {
        error: runError.message,
        workflowId,
      });
      return { success: false, error: "Failed to create workflow run" };
    }

    let status = "completed";
    let output = {};

    // 3. Evaluate conditions
    const context = { ...input, triggerEvent, workflowId, runId: run.id };

    if (workflow.conditions && workflow.conditions.length > 0) {
      const condResult = await evaluateConditions({
        conditions: workflow.conditions,
        context,
      });
      if (!condResult.success) {
        status = "failed";
        output = { error: condResult.error };
      } else if (!condResult.data.matched) {
        status = "skipped";
        output = {
          message: "Conditions not met",
          details: condResult.data.details,
        };
      }
    }

    // 4. Execute actions if conditions matched
    if (status === "running" || status === "completed") {
      if (workflow.actions && workflow.actions.length > 0) {
        const actionResult = await executeActions({
          actions: workflow.actions,
          context,
        });
        if (!actionResult.success) {
          status = "failed";
          output = { error: actionResult.error };
        } else {
          output = { results: actionResult.data.results };
          // Check if any action failed
          const failedSteps = actionResult.data.results.filter(
            (r) => r.status === "error",
          );
          if (failedSteps.length > 0) {
            status = "partial_failure";
            output.failedSteps = failedSteps;
          }
        }
      }
    }

    // 5. Update run status
    await supabaseAdmin
      .from("workflow_runs")
      .update({
        status,
        output,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    // 6. Audit log
    logInfo("WorkflowEngine", "Workflow triggered", {
      workflowId,
      runId: run.id,
      status,
      triggerEvent,
      triggeredBy,
    });

    await logAuditEvent({
      eventType: "workflow.triggered",
      entityType: "workflow_runs",
      entityId: run.id,
      userId: triggeredBy,
      action: "trigger_workflow",
      details: { workflowId, triggerEvent, status },
    });

    return {
      success: true,
      data: {
        runId: run.id,
        status,
        output,
      },
    };
  } catch (err) {
    logError("WorkflowEngine", "Trigger workflow error", {
      error: err.message,
      workflowId,
    });
    return { success: false, error: "Failed to trigger workflow" };
  }
}

/**
 * Execute a list of actions sequentially.
 *
 * @param {Object} params
 * @param {Object[]} params.actions — Action definitions
 * @param {Object} params.context — Execution context
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function executeActions({ actions, context }) {
  try {
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return {
        success: false,
        error: "actions array is required and must not be empty",
      };
    }
    if (!context) {
      return { success: false, error: "context is required" };
    }

    const results = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const stepName = action.name || `step_${i + 1}`;

      // Create workflow_log entry
      const { data: logEntry } = await supabaseAdmin
        .from("workflow_logs")
        .insert({
          workflow_id: context.workflowId,
          run_id: context.runId,
          step_name: stepName,
          action_type: action.type,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Execute action
      const actionResult = await executeAction(action, context);

      // Update log with result
      if (logEntry) {
        await supabaseAdmin
          .from("workflow_logs")
          .update({
            status: actionResult.status,
            output: actionResult.output,
            completed_at: new Date().toISOString(),
          })
          .eq("id", logEntry.id);
      }

      results.push({
        stepName,
        status: actionResult.status,
        output: actionResult.output,
      });

      // Stop on error (fail fast)
      if (actionResult.status === "error") {
        logWarn("WorkflowEngine", "Action failed, stopping execution", {
          stepName,
          error: actionResult.output?.error,
        });
        break;
      }
    }

    logInfo("WorkflowEngine", "Actions executed", {
      totalSteps: actions.length,
      completedSteps: results.length,
      failedSteps: results.filter((r) => r.status === "error").length,
    });

    return {
      success: true,
      data: { results },
    };
  } catch (err) {
    logError("WorkflowEngine", "Execute actions error", { error: err.message });
    return { success: false, error: "Failed to execute actions" };
  }
}

/**
 * Evaluate a set of conditions against a context.
 *
 * @param {Object} params
 * @param {Object[]} params.conditions — Condition definitions
 * @param {Object} params.context — Context to evaluate against
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function evaluateConditions({ conditions, context }) {
  try {
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return { success: true, data: { matched: true, details: [] } };
    }
    if (!context) {
      return { success: false, error: "context is required" };
    }

    const details = [];
    let allMatched = true;

    for (const condition of conditions) {
      const result = evaluateCondition(condition, context);
      details.push({
        condition: {
          type: condition.type,
          field: condition.field,
          value: condition.value,
        },
        result,
      });

      if (!result) {
        allMatched = false;
      }
    }

    logInfo("WorkflowEngine", "Conditions evaluated", {
      totalConditions: conditions.length,
      matched: allMatched,
    });

    return {
      success: true,
      data: {
        matched: allMatched,
        details,
      },
    };
  } catch (err) {
    logError("WorkflowEngine", "Evaluate conditions error", {
      error: err.message,
    });
    return { success: false, error: "Failed to evaluate conditions" };
  }
}

// ─── History Functions ───

/**
 * Get workflow run history.
 *
 * @param {Object} params
 * @param {string} params.workflowId — Workflow ID
 * @param {number} [params.limit=20] — Max results
 * @param {number} [params.offset=0] — Pagination offset
 * @param {string} [params.status] — Filter by status
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getWorkflowRuns({
  workflowId,
  limit = 20,
  offset = 0,
  status,
}) {
  try {
    if (!workflowId) {
      return { success: false, error: "workflowId is required" };
    }

    let query = supabaseAdmin
      .from("workflow_runs")
      .select("*", { count: "exact" })
      .eq("workflow_id", workflowId)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      logError("WorkflowEngine", "Get workflow runs error", {
        error: error.message,
        workflowId,
      });
      return { success: false, error: "Failed to get workflow runs" };
    }

    return {
      success: true,
      data: {
        runs: data || [],
        total: count || 0,
        limit,
        offset,
      },
    };
  } catch (err) {
    logError("WorkflowEngine", "Get workflow runs error", {
      error: err.message,
      workflowId,
    });
    return { success: false, error: "Failed to get workflow runs" };
  }
}

/**
 * Get a specific workflow run by ID.
 *
 * @param {string} runId — Run ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getWorkflowRun(runId) {
  try {
    if (!runId) {
      return { success: false, error: "runId is required" };
    }

    const { data: run, error: runError } = await supabaseAdmin
      .from("workflow_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runError) {
      if (runError.code === "PGRST116") {
        return { success: false, error: "Workflow run not found" };
      }
      logError("WorkflowEngine", "Get workflow run error", {
        error: runError.message,
        runId,
      });
      return { success: false, error: "Failed to get workflow run" };
    }

    // Fetch associated logs
    const { data: logs } = await supabaseAdmin
      .from("workflow_logs")
      .select("*")
      .eq("run_id", runId)
      .order("started_at", { ascending: true });

    return {
      success: true,
      data: {
        ...run,
        logs: logs || [],
      },
    };
  } catch (err) {
    logError("WorkflowEngine", "Get workflow run error", {
      error: err.message,
      runId,
    });
    return { success: false, error: "Failed to get workflow run" };
  }
}

/**
 * Retry a failed workflow run.
 *
 * @param {string} runId — Run ID to retry
 * @param {string} performedBy — User ID performing the retry
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function retryWorkflowRun(runId, performedBy) {
  try {
    if (!runId) {
      return { success: false, error: "runId is required" };
    }
    if (!performedBy) {
      return { success: false, error: "performedBy is required" };
    }

    // Fetch the original run
    const { data: originalRun, error: fetchError } = await supabaseAdmin
      .from("workflow_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (fetchError || !originalRun) {
      return { success: false, error: "Workflow run not found" };
    }

    if (
      originalRun.status !== "failed" &&
      originalRun.status !== "partial_failure"
    ) {
      return {
        success: false,
        error: `Cannot retry a run with status: ${originalRun.status}. Only failed or partial_failure runs can be retried.`,
      };
    }

    // Trigger the same workflow with the same input
    const retryResult = await triggerWorkflow({
      workflowId: originalRun.workflow_id,
      triggerEvent: `retry_${originalRun.trigger_event}`,
      input: originalRun.input || {},
      triggeredBy: performedBy,
    });

    if (!retryResult.success) {
      return retryResult;
    }

    logInfo("WorkflowEngine", "Workflow run retried", {
      originalRunId: runId,
      newRunId: retryResult.data.runId,
    });

    await logAuditEvent({
      eventType: "workflow.run.retried",
      entityType: "workflow_runs",
      entityId: runId,
      userId: performedBy,
      action: "retry_workflow_run",
      details: { newRunId: retryResult.data.runId },
    });

    return retryResult;
  } catch (err) {
    logError("WorkflowEngine", "Retry workflow run error", {
      error: err.message,
      runId,
    });
    return { success: false, error: "Failed to retry workflow run" };
  }
}

// ─── Template Functions ───

/**
 * Create a workflow template.
 *
 * @param {Object} params
 * @param {string} params.name — Template name
 * @param {string} params.description — Template description
 * @param {string} params.triggerType — Trigger type
 * @param {Object[]} params.conditions — Condition definitions
 * @param {Object[]} params.actions — Action definitions
 * @param {string} [params.category] — Template category
 * @param {string} params.createdBy — User ID of creator
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function createWorkflowTemplate({
  name,
  description,
  triggerType,
  conditions,
  actions,
  category,
  createdBy,
}) {
  try {
    const validation = validateWorkflowInput({ name, triggerType });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    if (!createdBy) {
      return { success: false, error: "createdBy is required" };
    }

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return { success: false, error: "actions array is required" };
    }

    // Validate action configs before persisting a template.
    for (const action of actions) {
      const configResult = validateActionConfig(action);
      if (!configResult.valid) {
        return {
          success: false,
          error: `Invalid action config for ${action.type}: ${configResult.error}`,
        };
      }
    }

    const { data, error } = await supabaseAdmin
      .from("workflow_templates")
      .insert({
        name: name.trim(),
        description: description || null,
        trigger_type: triggerType,
        conditions: conditions || [],
        actions,
        category: category || "general",
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      logError("WorkflowEngine", "Create template error", {
        error: error.message,
        name,
      });
      return { success: false, error: "Failed to create workflow template" };
    }

    logInfo("WorkflowEngine", "Workflow template created", {
      templateId: data.id,
      name,
    });

    await logAuditEvent({
      eventType: "workflow.template.created",
      entityType: "workflow_templates",
      entityId: data.id,
      userId: createdBy,
      action: "create_workflow_template",
      details: { name, triggerType, category },
    });

    return { success: true, data };
  } catch (err) {
    logError("WorkflowEngine", "Create template error", {
      error: err.message,
      name,
    });
    return { success: false, error: "Failed to create workflow template" };
  }
}

/**
 * Instantiate a new workflow from a template with optional customizations.
 *
 * @param {Object} params
 * @param {string} params.templateId — Template ID
 * @param {Object} [params.customizations={}] — Override fields (name, description, actions, conditions)
 * @param {string} params.createdBy — User ID of creator
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function instantiateFromTemplate({
  templateId,
  customizations = {},
  createdBy,
}) {
  try {
    if (!templateId) {
      return { success: false, error: "templateId is required" };
    }
    if (!createdBy) {
      return { success: false, error: "createdBy is required" };
    }

    // Fetch template
    const { data: template, error: fetchError } = await supabaseAdmin
      .from("workflow_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (fetchError || !template) {
      return { success: false, error: "Workflow template not found" };
    }

    // Create workflow from template with customizations
    const workflowData = {
      name: customizations.name || `${template.name} (copy)`,
      description: customizations.description || template.description,
      triggerType: customizations.triggerType || template.trigger_type,
      conditions: customizations.conditions || template.conditions,
      actions: customizations.actions || template.actions,
      retryConfig: customizations.retryConfig || {},
      scheduleConfig: customizations.scheduleConfig || {},
      createdBy,
      organizationId: customizations.organizationId || null,
    };

    const createResult = await createWorkflow(workflowData);
    if (!createResult.success) {
      return createResult;
    }

    logInfo("WorkflowEngine", "Workflow instantiated from template", {
      templateId,
      workflowId: createResult.data.id,
    });

    await logAuditEvent({
      eventType: "workflow.instantiated_from_template",
      entityType: "workflows",
      entityId: createResult.data.id,
      userId: createdBy,
      action: "instantiate_from_template",
      details: { templateId, customizations: Object.keys(customizations) },
    });

    return createResult;
  } catch (err) {
    logError("WorkflowEngine", "Instantiate from template error", {
      error: err.message,
      templateId,
    });
    return {
      success: false,
      error: "Failed to instantiate workflow from template",
    };
  }
}

// ─── Scheduling Functions ───

/**
 * Process scheduled workflows that are due for execution.
 *
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function processScheduledWorkflows() {
  try {
    const now = new Date().toISOString();

    // Find enabled workflows with schedule config that are due
    const { data: scheduledWorkflows, error: fetchError } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("enabled", true)
      .eq("trigger_type", TRIGGER_TYPES.SCHEDULE);

    if (fetchError) {
      logError("WorkflowEngine", "Fetch scheduled workflows error", {
        error: fetchError.message,
      });
      return { success: false, error: "Failed to fetch scheduled workflows" };
    }

    let processed = 0;
    let triggered = 0;

    for (const workflow of scheduledWorkflows || []) {
      const scheduleConfig = workflow.schedule_config || {};
      const intervalMs = scheduleConfig.intervalMs || 3600000; // Default 1 hour
      const lastRunAt = scheduleConfig.lastRunAt;

      // Check if workflow is due
      let isDue = false;
      if (!lastRunAt) {
        isDue = true;
      } else {
        const elapsed = new Date(now).getTime() - new Date(lastRunAt).getTime();
        isDue = elapsed >= intervalMs;
      }

      if (isDue) {
        processed++;

        const triggerResult = await triggerWorkflow({
          workflowId: workflow.id,
          triggerEvent: "schedule",
          input: { scheduledAt: now },
          triggeredBy: "scheduler",
        });

        if (triggerResult.success) {
          triggered++;

          // Update lastRunAt in schedule_config
          await supabaseAdmin
            .from("workflows")
            .update({
              schedule_config: {
                ...scheduleConfig,
                lastRunAt: now,
              },
            })
            .eq("id", workflow.id);
        } else {
          logWarn("WorkflowEngine", "Scheduled workflow trigger failed", {
            workflowId: workflow.id,
            error: triggerResult.error,
          });
        }
      }
    }

    logInfo("WorkflowEngine", "Scheduled workflows processed", {
      processed,
      triggered,
    });

    return {
      success: true,
      data: {
        processed,
        triggered,
      },
    };
  } catch (err) {
    logError("WorkflowEngine", "Process scheduled workflows error", {
      error: err.message,
    });
    return { success: false, error: "Failed to process scheduled workflows" };
  }
}
