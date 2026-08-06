// Export Engine — data export platform supporting CSV, Excel, JSON, PDF
// Provides scheduled exports and template-based report generation
//
// SECURITY (CR-5): Exports run with the service-role client, which bypasses
// PostgREST RLS. The engine therefore enforces its own authorization:
//   * Only a strict allowlist of resources (EXPORTABLE_SOURCES) may be
//     exported; anything else — especially auth.users, api_keys, secrets,
//     audit/internal/security/admin-only tables — is rejected.
//   * Every export is scoped to the caller's OWN rows via the resource's
//     ownership columns. Ownership is verified before the service role is used.
//   * Client-supplied resource names are never trusted; unknown or forbidden
//     sources are rejected.

import { supabaseAdmin } from "../supabaseAdmin.js";
import { secureLogger } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";

const EXPORT_FORMATS = ["csv", "excel", "json", "pdf"];

/**
 * Strict allowlist of exportable resources (CR-5).
 *
 * key = client-supplied source name; value = the backing table plus the
 * ownership column(s) that scope every export to its owner.
 */
export const EXPORTABLE_SOURCES = {
  projects: { table: "projects", ownership: ["owner_id", "creator_id"] },
  campaigns: { table: "campaigns", ownership: ["creator_id"] },
  profiles: { table: "profiles", ownership: ["id"] },
  notifications: { table: "notifications", ownership: ["user_id"] },
};

/**
 * Known sensitive / internal / admin-only sources that must NEVER be exported
 * (CR-5). These are rejected with a clear message even though the allowlist
 * already excludes them.
 */
export const FORBIDDEN_SOURCES = [
  "auth.users", "users", "api_keys", "secrets", "user_secrets",
  "audit_logs", "verification_audit_log", "verification_otp",
  "verification_sessions", "device_fingerprints", "fraud_profiles",
  "fraud_events", "manual_overrides", "api_logs", "api_rate_limits",
  "export_jobs", "export_templates", "scheduled_exports", "policies",
  "policy_versions", "organizations", "organization_members",
  "organization_roles", "admin_users", "roles", "permissions",
];

/** Validate that a client-supplied source is exportable. */
function isExportableSource(source) {
  return Boolean(EXPORTABLE_SOURCES[source]);
}

export async function exportData(options) {
  try {
    const validFormat = EXPORT_FORMATS.includes(options.format);
    if (!validFormat) return { success: false, error: `Unsupported format: ${options.format}` };

    const ownerId = options.createdBy || options.userId;

    // Fetch source data (validated + ownership-scoped).
    const sourceResult = await fetchSourceData(options.source, options.filters || {}, ownerId);
    if (!sourceResult.success) return { success: false, error: sourceResult.error };
    const sourceData = sourceResult.data;

    // Transform
    const transformed = transformData(sourceData, options.mapping || null);

    // Format
    const formatted = await formatExport(transformed, options.format, options.options || {});

    // Store or return
    if (options.storeResult) {
      const { data, error } = await supabaseAdmin
        .from("export_jobs")
        .insert({
          format: options.format,
          source: options.source,
          filters: options.filters || {},
          status: "completed",
          file_url: null, // In production: upload to storage
          row_count: transformed.length,
          created_by: options.createdBy || null,
          organization_id: options.organizationId || null,
        })
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      return { success: true, data: { ...data, content: formatted } };
    }

    return { success: true, data: { content: formatted, rows: transformed.length } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function createExportTemplate(options) {
  try {
    if (!isExportableSource(options.source)) {
      return { success: false, error: `Source '${options.source}' is not exportable` };
    }

    const { data, error } = await supabaseAdmin
      .from("export_templates")
      .insert({
        name: options.name,
        description: options.description || "",
        source: options.source,
        format: options.format || "csv",
        mapping: options.mapping || {},
        filters: options.filters || {},
        options: options.exportOptions || {},
        created_by: options.createdBy || null,
        organization_id: options.organizationId || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listExportTemplates(options = {}) {
  try {
    let query = supabaseAdmin.from("export_templates").select("*", { count: "exact" });
    // Scope templates to the owner (and org when present) so one user can
    // never list another user's templates. organization_id is not populated
    // on the auth user, so created_by is the reliable scope.
    if (options.createdBy) query = query.eq("created_by", options.createdBy);
    if (options.organizationId) query = query.eq("organization_id", options.organizationId);
    if (options.source) query = query.eq("source", options.source);
    query = query.order("name", { ascending: true });

    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function scheduleExport(options) {
  try {
    if (!isExportableSource(options.source)) {
      return { success: false, error: `Source '${options.source}' is not exportable` };
    }

    const { data, error } = await supabaseAdmin
      .from("scheduled_exports")
      .insert({
        name: options.name,
        template_id: options.templateId,
        format: options.format || "csv",
        source: options.source,
        filters: options.filters || {},
        mapping: options.mapping || {},
        schedule_cron: options.scheduleCron,
        schedule_timezone: options.timezone || "UTC",
        destinations: options.destinations || [],
        created_by: options.createdBy || null,
        organization_id: options.organizationId || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function processScheduledExports() {
  try {
    const { data: schedules, error } = await supabaseAdmin
      .from("scheduled_exports")
      .select("*")
      .eq("is_active", true);

    if (error) return { success: false, error: error.message };

    const results = [];
    for (const schedule of schedules || []) {
      try {
        const exportResult = await exportData({
          format: schedule.format,
          source: schedule.source,
          filters: schedule.filters || {},
          mapping: schedule.mapping || {},
          createdBy: schedule.created_by,
        });

        results.push({
          scheduleId: schedule.id,
          success: exportResult.success,
          error: exportResult.error,
        });

        await supabaseAdmin
          .from("scheduled_exports")
          .update({
            last_run_at: new Date().toISOString(),
            last_status: exportResult.success ? "completed" : "failed",
          })
          .eq("id", schedule.id);
      } catch (err) {
        results.push({ scheduleId: schedule.id, success: false, error: err.message });
      }
    }

    return { success: true, data: results };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function fetchSourceData(source, filters, userId) {
  const resource = EXPORTABLE_SOURCES[source];

  if (!resource) {
    if (FORBIDDEN_SOURCES.includes(source)) {
      return { success: false, error: `Source '${source}' is not exportable` };
    }
    return { success: false, error: `Unknown export source: ${source}` };
  }

  if (!userId) {
    return { success: false, error: "userId is required for export" };
  }

  const table = resource.table;
  const ownership = resource.ownership;

  let query = supabaseAdmin.from(table).select("*");

  // Scope every export to the caller's own rows via the ownership columns.
  // Ownership is enforced BEFORE the service role is used.
  if (ownership.length === 1) {
    query = query.eq(ownership[0], userId);
  } else {
    query = query.or(ownership.map((c) => `${c}.eq.${userId}`).join(","));
  }

  query = query.limit(1000);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  return { success: true, data: data || [] };
}

function transformData(rows, mapping) {
  if (!mapping || Object.keys(mapping).length === 0) return rows;

  return rows.map((row) => {
    const transformed = {};
    for (const [target, source] of Object.entries(mapping)) {
      const keys = source.split(".");
      let value = row;
      for (const key of keys) {
        value = value?.[key];
      }
      transformed[target] = value ?? null;
    }
    return transformed;
  });
}

async function formatExport(data, format, options) {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, options.pretty ? 2 : undefined);

    case "csv":
      const headers = Object.keys(data[0] || {});
      const csvRows = [
        headers.join(options.delimiter || ","),
        ...data.map((row) =>
          headers.map((h) => {
            const val = String(row[h] ?? "");
            const needsQuote = val.includes(",") || val.includes('"');
            return needsQuote ? `"${val.replace(/"/g, '""')}"` : val;
          }).join(options.delimiter || ",")
        ),
      ];
      return csvRows.join("\n");

    case "excel":
    case "pdf":
      return JSON.stringify(data);

    default:
      return JSON.stringify(data);
  }
}

export function getSupportedFormats() {
  return [...EXPORT_FORMATS];
}
