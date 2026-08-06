// API — Deployment management
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logAuditEvent } from "../../../lib/verification/auditLog.js";
import { withAuth } from "../../../lib/withAuth.js";

async function handler(req, res) {
  const { method } = req;

  switch (method) {
    case "GET":
      return handleGet(req, res);
    case "POST":
      return handlePost(req, res);
    default:
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }
}

async function handleGet(req, res) {
  try {
    const { id, environment, status, limit, offset } = req.query;

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("deployment_history")
        .select("*")
        .eq("id", id)
        .single();

      if (error) return res.status(404).json({ error: "Deployment not found" });
      return res.status(200).json(data);
    }

    let query = supabaseAdmin
      .from("deployment_history")
      .select("*", { count: "exact" });

    if (environment) query = query.eq("environment", environment);
    if (status) query = query.eq("status", status);
    query = query.order("created_at", { ascending: false });

    const pageLimit = Math.min(parseInt(limit || "50"), 200);
    const pageOffset = parseInt(offset || "0");
    query = query.range(pageOffset, pageOffset + pageLimit - 1);

    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ deployments: data || [], total: count || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function handlePost(req, res) {
  try {
    const {
      version,
      branch,
      commitHash,
      environment,
      status,
      healthCheckPassed,
      rollback,
    } = req.body;

    if (!version || !environment) {
      return res
        .status(400)
        .json({ error: "version and environment are required" });
    }

    const { data, error } = await supabaseAdmin
      .from("deployment_history")
      .insert({
        version,
        branch: branch || "main",
        commit_hash: commitHash || null,
        environment,
        status: status || "deploying",
        health_check_passed: healthCheckPassed ?? false,
        rollback: rollback ?? false,
        deployed_by: req.user?.id || req.user?.userId,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await logAuditEvent({
      action: "deployment.created",
      targetType: "deployment_history",
      targetId: data.id,
      metadata: { version, environment, status: "deploying" },
    });

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
