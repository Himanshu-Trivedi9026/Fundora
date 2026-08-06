// Retention Engine — backup retention policy management
// Enforces retention rules and auto-cleans expired backups

import { supabaseAdmin } from "../supabaseAdmin.js";
import { secureLogger } from "../verification/secureLogger.js";

export const RETENTION_RULES = {
  daily: { keep: 7, description: "Keep last 7 daily backups" },
  weekly: { keep: 4, description: "Keep last 4 weekly backups" },
  monthly: { keep: 12, description: "Keep last 12 monthly backups" },
  yearly: { keep: 3, description: "Keep last 3 yearly backups" },
};

export async function getRetentionPolicy(policyId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("backup_policies")
      .select("*")
      .eq("id", policyId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listRetentionPolicies(organizationId = null) {
  try {
    let query = supabaseAdmin.from("backup_policies").select("*");

    if (organizationId) query = query.eq("organization_id", organizationId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function updateRetentionPolicy(policyId, updates) {
  try {
    const { data, error } = await supabaseAdmin
      .from("backup_policies")
      .update({
        retention_days: updates.retentionDays,
        max_backups: updates.maxBackups,
        min_backups: updates.minBackups,
        rules: updates.rules || {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", policyId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function enforceRetention(policyId) {
  try {
    const policy = await getRetentionPolicy(policyId);
    if (!policy.success) return { success: false, error: "Policy not found" };

    const { data: backups, error } = await supabaseAdmin
      .from("backups")
      .select("id, created_at, status")
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };

    const maxBackups = policy.data.max_backups || 30;
    const retentionDays = policy.data.retention_days || 90;
    const deleted = [];
    const cutoff = new Date(Date.now() - retentionDays * 86400000);

    let kept = 0;
    for (const backup of backups || []) {
      const isExpired = new Date(backup.created_at) < cutoff;
      const exceedsMax = kept >= maxBackups;

      if (isExpired || exceedsMax) {
        await supabaseAdmin
          .from("backups")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", backup.id);

        deleted.push(backup.id);
      } else {
        kept++;
      }
    }

    return { success: true, data: { deleted, kept, policyId } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function runRetentionForAll() {
  try {
    const { data: policies, error } = await supabaseAdmin
      .from("backup_policies")
      .select("id");

    if (error) return { success: false, error: error.message };

    const results = [];
    for (const policy of policies || []) {
      const result = await enforceRetention(policy.id);
      results.push({
        policyId: policy.id,
        result: result.success ? "enforced" : "failed",
      });
    }

    return { success: true, data: results };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function estimateRetentionImpact(policyId) {
  try {
    const policy = await getRetentionPolicy(policyId);
    if (!policy.success) return { success: false, error: "Policy not found" };

    const { data: backups, error } = await supabaseAdmin
      .from("backups")
      .select("id, size_bytes, created_at, status")
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };

    const maxBackups = policy.data.max_backups || 30;
    const retentionDays = policy.data.retention_days || 90;
    const cutoff = new Date(Date.now() - retentionDays * 86400000);

    let willDelete = 0;
    let willKeep = 0;
    let deleteSizeBytes = 0;
    let keepSizeBytes = 0;

    for (const backup of backups || []) {
      const isExpired = new Date(backup.created_at) < cutoff;
      const exceedsMax = willKeep >= maxBackups;

      if (isExpired || exceedsMax) {
        willDelete++;
        deleteSizeBytes += Number(backup.size_bytes || 0);
      } else {
        willKeep++;
        keepSizeBytes += Number(backup.size_bytes || 0);
      }
    }

    return {
      success: true,
      data: {
        willDelete,
        willKeep,
        deleteSizeBytes,
        keepSizeBytes,
        estimatedSavings: deleteSizeBytes,
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
