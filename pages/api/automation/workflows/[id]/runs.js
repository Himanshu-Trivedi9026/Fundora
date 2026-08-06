import { withAuth } from "../../../../../lib/withAuth.js";
import { rateLimit } from "../../../../../lib/rateLimit.js";
import {
  getWorkflowRuns,
  verifyWorkflowOwnership,
} from "../../../../../lib/automation/workflowEngine.js";

// GET: Get workflow run history
// Query: { limit?, offset?, status? }
// Rate limit: 30/min
export default withAuth(rateLimit({ windowMs: 60000, max: 30 })(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Workflow id is required" });

    // Only the workflow owner (or a platform_admin) may view its run history.
    const ownership = await verifyWorkflowOwnership({ workflowId: id, userId: req.user.id });
    if (!ownership.success) return res.status(404).json({ error: ownership.error });
    if (!ownership.allowed) {
      return res.status(403).json({ error: "Forbidden: you do not own this workflow" });
    }

    const { limit = "20", offset = "0", status } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    if (status) {
      const validStatuses = ["running", "completed", "failed", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
      }
    }

    const result = await getWorkflowRuns({
      workflowId: id,
      status: status || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });
    if (!result.success) return res.status(400).json({ error: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}));
