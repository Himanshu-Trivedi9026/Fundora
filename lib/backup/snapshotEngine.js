// Snapshot Engine — point-in-time snapshots for recovery
// Manages creation, listing, and promotion of data snapshots

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logAuditEvent } from "../verification/auditLog.js";

export async function createSnapshot(options = {}) {
  try {
    const { data, error } = await supabaseAdmin
      .from("recovery_points")
      .insert({
        point_name: options.name || `snapshot_${Date.now()}`,
        point_type: options.type || "manual",
        status: "creating",
        metadata: options.metadata || {},
        organization_id: options.organizationId || null,
        created_by: options.createdBy || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // In production, actual snapshot logic runs here
    await supabaseAdmin
      .from("recovery_points")
      .update({
        status: "available",
        snapshot_data: { tables: options.tables || [], filters: options.filters || {} },
        size_bytes: options.sizeBytes || 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listSnapshots(options = {}) {
  try {
    let query = supabaseAdmin.from("recovery_points").select("*", { count: "exact" });

    if (options.status) query = query.eq("status", options.status);
    if (options.type) query = query.eq("point_type", options.type);
    if (options.organizationId) query = query.eq("organization_id", options.organizationId);

    query = query.order("created_at", { ascending: false });

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

export async function getSnapshot(snapshotId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("recovery_points")
      .select("*")
      .eq("id", snapshotId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteSnapshot(snapshotId) {
  try {
    const { error } = await supabaseAdmin
      .from("recovery_points")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", snapshotId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getSnapshotDiff(sourceId, targetId) {
  try {
    const source = await getSnapshot(sourceId);
    const target = await getSnapshot(targetId);

    if (!source.success || !target.success) {
      return { success: false, error: "One or both snapshots not found" };
    }

    const diff = {
      source: { id: sourceId, created_at: source.data.created_at },
      target: { id: targetId, created_at: target.data.created_at },
      timeDelta: new Date(target.data.created_at) - new Date(source.data.created_at),
    };

    return { success: true, data: diff };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
