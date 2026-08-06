import { withAuth } from "../../../../lib/withAuth.js";
import { rateLimit } from "../../../../lib/rateLimit.js";
import {
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  verifyWorkflowOwnership,
} from "../../../../lib/automation/workflowEngine.js";

// GET: Get workflow details
// PUT: Update workflow
// DELETE: Delete workflow
// Rate limit: 30/min
export default withAuth(rateLimit({ windowMs: 60000, max: 30 })(async function handler(req, res) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Workflow id is required" });

    // All mutating/read operations require the requesting user to own the
    // workflow (or be a platform_admin).
    const ownership = await verifyWorkflowOwnership({ workflowId: id, userId: req.user.id });
    if (!ownership.success) return res.status(404).json({ error: ownership.error });
    if (!ownership.allowed) {
      return res.status(403).json({ error: "Forbidden: you do not own this workflow" });
    }

    // GET: Get workflow details
    if (req.method === "GET") {
      const result = await getWorkflow(id);
      if (!result.success) return res.status(404).json({ error: result.error });
      return res.status(200).json(result.data);
    }

    // PUT: Update workflow
    if (req.method === "PUT") {
      const updates = req.body;
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No update data provided" });
      }
      const result = await updateWorkflow(id, updates, req.user.id);
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.status(200).json(result.data);
    }

    // DELETE: Delete workflow
    if (req.method === "DELETE") {
      const result = await deleteWorkflow(id, req.user.id);
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.status(200).json({ message: "Workflow deleted successfully" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}));
