import { withAuth } from "../../../lib/withAuth.js";
import { rateLimit } from "../../../lib/rateLimit.js";
import { listWorkflows, createWorkflow } from "../../../lib/automation/workflowEngine.js";

// GET: List workflows
// POST: Create workflow
// Rate limit: 30/min
export default withAuth(rateLimit({ windowMs: 60000, max: 30 })(async function handler(req, res) {
  try {
    // GET: List workflows
    if (req.method === "GET") {
      const { status, limit = "20", offset = "0" } = req.query;
      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
      const result = await listWorkflows({
        userId: req.user.id,
        status: status || undefined,
        limit: parsedLimit,
        offset: parsedOffset,
        // ownership scoping is applied inside listWorkflows when userId is set
      });
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.status(200).json(result.data);
    }

    // POST: Create workflow
    if (req.method === "POST") {
      const { name, description, trigger, steps, config } = req.body;
      if (!name || !trigger || !steps) {
        return res.status(400).json({ error: "name, trigger, and steps are required" });
      }
      if (!Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: "steps must be a non-empty array" });
      }
      const result = await createWorkflow({
        name,
        description: description || "",
        triggerType: trigger,
        actions: steps,
        conditions: (config && config.conditions) || [],
        createdBy: req.user.id,
      });
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.status(201).json(result.data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
}));
