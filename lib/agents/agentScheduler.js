// Agent Scheduler — schedule and trigger agent runs
// Manages cron-based, interval-based, and event-driven scheduling

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logError } from "../verification/secureLogger.js";

export async function scheduleAgentRun(agentId, scheduleConfig) {
  try {
    const { scheduleType, cronExpression, intervalSeconds, runAt, inputTemplate } = scheduleConfig;

    const nextRunAt = calculateNextRun(scheduleType, { cronExpression, intervalSeconds, runAt });

    const { data, error } = await supabaseAdmin
      .from("agent_schedules")
      .insert({
        agent_id: agentId,
        schedule_type: scheduleType,
        cron_expression: cronExpression || null,
        interval_seconds: intervalSeconds || null,
        run_at: runAt || null,
        input_template: inputTemplate || {},
        next_run_at: nextRunAt,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function processScheduledRuns() {
  try {
    const now = new Date().toISOString();

    const { data: schedules, error } = await supabaseAdmin
      .from("agent_schedules")
      .select("*, agents(*)")
      .eq("is_active", true)
      .lte("next_run_at", now);

    if (error) return { success: false, error: error.message };

    const results = [];
    for (const schedule of schedules || []) {
      try {
        // Execute agent with input template
        const { runAgent } = await import("./agentExecution.js");
        const result = await runAgent(schedule.agent_id, schedule.input_template || {}, {
          runType: "scheduled",
        });

        // Update schedule
        const nextRun = calculateNextRun(schedule.schedule_type, {
          cronExpression: schedule.cron_expression,
          intervalSeconds: schedule.interval_seconds,
        });

        await supabaseAdmin
          .from("agent_schedules")
          .update({
            run_count: schedule.run_count + 1,
            last_run_at: now,
            next_run_at: nextRun,
          })
          .eq("id", schedule.id);

        // Disable if max runs reached
        if (schedule.max_runs && schedule.run_count + 1 >= schedule.max_runs) {
          await supabaseAdmin
            .from("agent_schedules")
            .update({ is_active: false })
            .eq("id", schedule.id);
        }

        results.push({ scheduleId: schedule.id, status: "executed", result: result.data });
      } catch (err) {
        logError("Scheduled agent run failed", { scheduleId: schedule.id, error: err.message });
        results.push({ scheduleId: schedule.id, status: "failed", error: err.message });
      }
    }

    return { success: true, data: { processed: results.length, results } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listSchedules(agentId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_schedules")
      .select("*")
      .eq("agent_id", agentId)
      .order("next_run_at", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function toggleSchedule(scheduleId, isActive) {
  try {
    const { error } = await supabaseAdmin
      .from("agent_schedules")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
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
      .from("agent_schedules")
      .delete()
      .eq("id", scheduleId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function calculateNextRun(scheduleType, config) {
  const now = Date.now();

  switch (scheduleType) {
    case "cron":
      // Simplified: advance 1 hour (in production parse cron expression)
      return new Date(now + 3600000).toISOString();
    case "interval":
      return new Date(now + (config.intervalSeconds || 3600) * 1000).toISOString();
    case "time":
      return config.runAt || new Date(now + 86400000).toISOString();
    case "event":
      return null; // Event-driven, no schedule
    default:
      return new Date(now + 86400000).toISOString();
  }
}
