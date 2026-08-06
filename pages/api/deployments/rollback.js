// API — Deployment rollback
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { logAuditEvent } from "../../../lib/verification/auditLog.js";
import { withAuth } from "../../../lib/withAuth.js";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { deploymentId } = req.body;
    if (!deploymentId)
      return res.status(400).json({ error: "deploymentId is required" });

    // Get the deployment to rollback
    const { data: deployment, error: fetchError } = await supabaseAdmin
      .from("deployment_history")
      .select("*")
      .eq("id", deploymentId)
      .single();

    if (fetchError || !deployment) {
      return res.status(404).json({ error: "Deployment not found" });
    }

    // Mark the current deployment as rolled back
    const { error: updateError } = await supabaseAdmin
      .from("deployment_history")
      .update({ status: "rolled_back", rollback: true })
      .eq("id", deploymentId);

    if (updateError)
      return res.status(500).json({ error: updateError.message });

    await logAuditEvent({
      action: "deployment.rolled_back",
      targetType: "deployment_history",
      targetId: deploymentId,
      metadata: {
        version: deployment.version,
        environment: deployment.environment,
        previousStatus: deployment.status,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        deploymentId,
        version: deployment.version,
        environment: deployment.environment,
        status: "rolled_back",
        rolledBackAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default withAuth(handler);
