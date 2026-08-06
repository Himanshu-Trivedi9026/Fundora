// API — Queue infrastructure management
import { listJobs, listHandlers, getActiveJobCount } from "../../../lib/jobs/index.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { status, queueName, limit, offset } = req.query;

    const [pendingResult, runningResult, deadLetterResult, completedResult] = await Promise.all([
      listJobs({ status: "pending", queueName, limit: 0 }),
      listJobs({ status: "running", queueName, limit: 0 }),
      listJobs({ status: "dead_letter", queueName, limit: 0 }),
      listJobs({ status: "completed", queueName, limit: parseInt(limit || "10") }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          pending: pendingResult.total || 0,
          running: runningResult.total || 0,
          deadLetter: deadLetterResult.total || 0,
          completed: completedResult.total || 0,
          activeHandlers: listHandlers().length,
          activeJobs: getActiveJobCount(),
        },
        handlers: listHandlers(),
        recentCompleted: completedResult.data || [],
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
