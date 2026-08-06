// Job Queue — background worker platform
// Queue manager, retry engine, dead-letter processing, priority queues, scheduled jobs

import { supabaseAdmin } from "../supabaseAdmin.js";
import { secureLogger } from "../verification/secureLogger.js";
import { logAuditEvent } from "../verification/auditLog.js";
import { checkRateLimit } from "../cache/index.js";

const _handlers = new Map();
const _activeJobs = new Set();

const PRIORITY_MAP = { low: 1, normal: 5, high: 8, critical: 10 };

// ——————————————————————————————————————
// Queue Management
// ——————————————————————————————————————

export async function enqueue(jobType, payload, options = {}) {
  try {
    const { data, error } = await supabaseAdmin
      .from("job_queue")
      .insert({
        queue_name: options.queueName || "default",
        job_type: jobType,
        payload: payload || {},
        priority: PRIORITY_MAP[options.priority] || options.priority || 5,
        max_retries: options.maxRetries || 3,
        scheduled_at: options.scheduledAt || null,
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

export async function enqueueBulk(jobs) {
  const results = await Promise.all(
    jobs.map((j) => enqueue(j.jobType, j.payload, j.options || {})),
  );
  return {
    success: results.every((r) => r.success),
    data: results.map((r) => r.data || r.error),
  };
}

export async function processQueue(queueName = "default", options = {}) {
  const batchSize = options.batchSize || 10;
  const rateLimitKey = `queue:${queueName}`;

  // Rate limit processing
  const rateCheck = await checkRateLimit(rateLimitKey, {
    maxRequests: options.maxJobsPerMinute || 60,
    windowMs: 60000,
  });
  if (!rateCheck.success)
    return { success: true, data: { processed: 0, rateLimited: true } };

  try {
    const { data: jobs, error } = await supabaseAdmin
      .from("job_queue")
      .select("*")
      .eq("queue_name", queueName)
      .eq("status", "pending")
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (error) return { success: false, error: error.message };
    if (!jobs || jobs.length === 0)
      return { success: true, data: { processed: 0 } };

    const results = [];
    for (const job of jobs) {
      _activeJobs.add(job.id);
      try {
        await executeJob(job);
        results.push({ id: job.id, status: "completed" });
      } catch (err) {
        results.push({ id: job.id, status: "failed", error: err.message });
      } finally {
        _activeJobs.delete(job.id);
      }
    }

    return { success: true, data: { processed: results.length, results } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function executeJob(job) {
  // Mark as running
  await supabaseAdmin
    .from("job_queue")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", job.id);

  const handler = _handlers.get(job.job_type);
  if (!handler) {
    await handleJobFailure(
      job,
      new Error(`No handler registered for job type: ${job.job_type}`),
    );
    return;
  }

  try {
    await handler(job.payload, { jobId: job.id });
    await supabaseAdmin
      .from("job_queue")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", job.id);
  } catch (err) {
    await handleJobFailure(job, err);
  }
}

async function handleJobFailure(job, error) {
  const retryCount = (job.retry_count || 0) + 1;
  const maxRetries = job.max_retries || 3;

  if (retryCount >= maxRetries) {
    // Dead letter
    await supabaseAdmin
      .from("job_queue")
      .update({
        status: "dead_letter",
        retry_count: retryCount,
        last_error: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    await logAuditEvent({
      action: "job.dead_letter",
      targetType: "job_queue",
      targetId: job.id,
      metadata: {
        jobType: job.job_type,
        error: error.message,
        retries: retryCount,
      },
    });
  } else {
    // Retry with backoff
    const backoffMs = Math.min(Math.pow(2, retryCount) * 1000, 30000);
    await supabaseAdmin
      .from("job_queue")
      .update({
        status: "retrying",
        retry_count: retryCount,
        last_error: error.message,
        scheduled_at: new Date(Date.now() + backoffMs).toISOString(),
      })
      .eq("id", job.id);
  }
}

// ——————————————————————————————————————
// Dead Letter Queue
// ——————————————————————————————————————

export async function requeueDeadLetters(queueName, options = {}) {
  try {
    const { data: jobs, error } = await supabaseAdmin
      .from("job_queue")
      .select("*")
      .eq("queue_name", queueName || "default")
      .eq("status", "dead_letter")
      .limit(options.limit || 50);

    if (error) return { success: false, error: error.message };
    if (!jobs || jobs.length === 0)
      return { success: true, data: { requeued: 0 } };

    for (const job of jobs) {
      await supabaseAdmin
        .from("job_queue")
        .update({
          status: "pending",
          retry_count: 0,
          last_error: null,
          scheduled_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return { success: true, data: { requeued: jobs.length } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function purgeDeadLetters(queueName) {
  try {
    const { error } = await supabaseAdmin
      .from("job_queue")
      .delete()
      .eq("queue_name", queueName || "default")
      .eq("status", "dead_letter");

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ——————————————————————————————————————
// Handler Registration
// ——————————————————————————————————————

export function registerHandler(jobType, handler) {
  if (_handlers.has(jobType)) {
    return {
      success: false,
      error: `Handler already registered for ${jobType}`,
    };
  }
  _handlers.set(jobType, handler);
  return { success: true };
}

export function unregisterHandler(jobType) {
  return { success: _handlers.delete(jobType) };
}

export function listHandlers() {
  return Array.from(_handlers.keys());
}

// ——————————————————————————————————————
// Job Queries
// ——————————————————————————————————————

export async function getJob(jobId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("job_queue")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listJobs(options = {}) {
  try {
    let query = supabaseAdmin.from("job_queue").select("*", { count: "exact" });

    if (options.queueName) query = query.eq("queue_name", options.queueName);
    if (options.status) query = query.eq("status", options.status);
    if (options.jobType) query = query.eq("job_type", options.jobType);

    query = query
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

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

export async function cancelJob(jobId) {
  try {
    const { error } = await supabaseAdmin
      .from("job_queue")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", jobId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function getActiveJobCount() {
  return _activeJobs.size;
}

// ——————————————————————————————————————
// Scheduled Jobs
// ——————————————————————————————————————

export async function createSchedule(options) {
  try {
    const { data, error } = await supabaseAdmin
      .from("scheduled_jobs")
      .insert({
        name: options.name,
        description: options.description || "",
        job_type: options.jobType,
        queue_name: options.queueName || "default",
        payload: options.payload || {},
        schedule_cron: options.scheduleCron,
        timezone: options.timezone || "UTC",
        max_retries: options.maxRetries || 3,
        max_runs: options.maxRuns || null,
        next_run_at: options.nextRunAt
          ? new Date(options.nextRunAt).toISOString()
          : new Date().toISOString(),
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

export async function processScheduledJobs() {
  try {
    const { data: schedules, error } = await supabaseAdmin
      .from("scheduled_jobs")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString())
      .limit(50);

    if (error) return { success: false, error: error.message };

    const results = [];
    for (const schedule of schedules || []) {
      try {
        const enqueueResult = await enqueue(
          schedule.job_type,
          schedule.payload,
          {
            queueName: schedule.queue_name,
            maxRetries: schedule.max_retries,
            organizationId: schedule.organization_id,
          },
        );

        const runCount = (schedule.run_count || 0) + 1;
        const nextRun = calculateNextCron(schedule.schedule_cron);

        const updates = {
          last_run_at: new Date().toISOString(),
          run_count: runCount,
          next_run_at: nextRun,
        };

        if (schedule.max_runs && runCount >= schedule.max_runs) {
          updates.is_active = false;
        }

        await supabaseAdmin
          .from("scheduled_jobs")
          .update(updates)
          .eq("id", schedule.id);

        results.push({ id: schedule.id, success: enqueueResult.success });
      } catch (err) {
        results.push({ id: schedule.id, success: false, error: err.message });
      }
    }

    return { success: true, data: { processed: results.length, results } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listSchedules(options = {}) {
  try {
    let query = supabaseAdmin
      .from("scheduled_jobs")
      .select("*", { count: "exact" });
    if (options.isActive !== undefined)
      query = query.eq("is_active", options.isActive);
    if (options.jobType) query = query.eq("job_type", options.jobType);
    query = query.order("next_run_at", { ascending: true });

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

export async function toggleSchedule(scheduleId) {
  try {
    const { data: current } = await supabaseAdmin
      .from("scheduled_jobs")
      .select("is_active")
      .eq("id", scheduleId)
      .single();

    const { error } = await supabaseAdmin
      .from("scheduled_jobs")
      .update({ is_active: !current?.is_active })
      .eq("id", scheduleId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteSchedule(scheduleId) {
  try {
    const { error } = await supabaseAdmin
      .from("scheduled_jobs")
      .delete()
      .eq("id", scheduleId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function calculateNextCron(cronExpression) {
  // Simple cron parser — returns next minute
  const parts = cronExpression.split(" ");
  if (parts.length !== 5) return new Date(Date.now() + 60000).toISOString();

  const now = new Date();
  const next = new Date(now);
  next.setMinutes(next.getMinutes() + 1);
  next.setSeconds(0);
  return next.toISOString();
}
