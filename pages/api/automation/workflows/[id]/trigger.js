import { withAuth } from "../../../../../lib/withAuth.js";
import { rateLimit } from "../../../../../lib/rateLimit.js";
import {
  triggerWorkflow,
  verifyWorkflowOwnership,
} from "../../../../../lib/automation/workflowEngine.js";

// POST: Trigger workflow execution
// Body: { input? }
// Rate limit: 30/min
export default withAuth(
  rateLimit({ windowMs: 60000, max: 30 })(async function handler(req, res) {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
    try {
      const { id } = req.query;
      if (!id)
        return res.status(400).json({ error: "Workflow id is required" });

      // Only the workflow owner (or a platform_admin) may trigger it.
      const ownership = await verifyWorkflowOwnership({
        workflowId: id,
        userId: req.user.id,
      });
      if (!ownership.success)
        return res.status(404).json({ error: ownership.error });
      if (!ownership.allowed) {
        return res
          .status(403)
          .json({ error: "Forbidden: you do not own this workflow" });
      }

      const { input } = req.body;
      const result = await triggerWorkflow({
        workflowId: id,
        triggerEvent: "manual",
        input: input || {},
        triggeredBy: req.user.id,
      });
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.status(200).json(result.data);
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }),
);
