import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { STORAGE_BUCKET } from "../../../lib/verification/storage";

const rl = rateLimit({ windowMs: 60_000, max: 3 });

/**
 * Server-side account deletion.
 *
 * Root cause of the old "Failed to delete auth user" error: 22 tables in
 * supabase/migrations (003, 010, 011) reference auth.users with NO ON DELETE
 * clause (default NO ACTION), so auth.admin.deleteUser() is rejected by the
 * database whenever any of those tables still holds a row for the user.
 * Tables with ON DELETE CASCADE / SET NULL clean up automatically; the
 * NO ACTION tables must be emptied explicitly first.
 *
 * This handler deletes the user's rows across every relevant table —
 * children before parents, then the direct auth.users children — logging
 * any per-table failure (e.g. a table or column that doesn't exist in this
 * deployment) instead of silently swallowing it, and only then deletes the
 * auth user. If the auth deletion still fails, the real constraint from the
 * database error is surfaced so the remaining blocker is visible.
 */
export default withAuth(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rl(req, res)) return;

  const userId = user.id;

  // ─── Cleanup spec: { table, by } delete rows where `by` = userId ───
  // Ordered: children before parents, direct auth.users children last.
  const cleanupSpec = [
    /* ---- Message/chat/notification rows (children of user & of projects) ---- */
    { table: "dm_messages", by: "sender_id" },
    { table: "project_messages", by: "sender_id" },
    { table: "typing_status", by: "user_id" },
    { table: "notifications", by: "user_id" },
    { table: "notification_preferences", by: "user_id" },
    { table: "media", by: "user_id" },
    { table: "public_donations", by: "payer_id" },
    { table: "saved_projects", by: "user_id" },
    { table: "team_members", by: "creator_id" },
    { table: "team_members", by: "user_id" },
    { table: "followers", by: "follower_id" },
    { table: "followers", by: "following_id" },
    { table: "blocked_users", by: "blocker_id" },
    { table: "blocked_users", by: "blocked_id" },
    { table: "muted_users", by: "user_id" },
    { table: "organization_members", by: "user_id" },
    { table: "dm_conversations", by: "user1" },
    { table: "dm_conversations", by: "user2" },
    { table: "plugin_downloads", by: "user_id" },
    { table: "plugin_reviews", by: "user_id" },
    { table: "api_logs", by: "user_id" },
    { table: "webhook_deliveries", by: "user_id" },
    { table: "ai_messages", by: "user_id" },
    { table: "ai_usage", by: "user_id" },
    { table: "ai_conversations", by: "user_id" },
    { table: "verification_documents", by: "user_id" },
    { table: "verification_otp", by: "user_id" },
    { table: "verification_sessions", by: "user_id" },
    { table: "verification_history", by: "user_id" },
    { table: "verification_audit_log", by: "user_id" },
    { table: "milestone_reviews", by: "reviewer_id" },
    { table: "event_subscriptions", by: "created_by" },
    { table: "export_jobs", by: "created_by" },
    { table: "scheduled_exports", by: "created_by" },
    { table: "traces", by: "user_id" },
    { table: "search_analytics", by: "user_id" },
    { table: "storage_objects", by: "user_id" },
    { table: "restore_operations", by: "performed_by" },
    { table: "backups", by: "created_by" },
    { table: "webhooks", by: "user_id" },

    /* ---- User-owned parent rows (delete after their children) ---- */
    { table: "projects", by: "creator_id" },
    { table: "projects", by: "owner_id" },
    { table: "campaigns", by: "owner_id" },
    { table: "organizations", by: "owner_id" },
    { table: "plugins", by: "author_id" },
    { table: "agents", by: "owner_id" },
    { table: "agent_runs", by: "approved_by" },
    { table: "agent_permissions", by: "granted_by" },
    { table: "feature_flags", by: "created_by" },
    { table: "feature_flag_events", by: "changed_by" },
    { table: "export_templates", by: "created_by" },
    { table: "report_templates", by: "created_by" },
    { table: "connector_configs", by: "created_by" },
    { table: "language_packs", by: "translator_id" },
    { table: "alerts", by: "assigned_to" },
    { table: "api_keys", by: "user_id" },
    { table: "escrow_accounts", by: "creator_id" },
    { table: "escrow_transactions", by: "creator_id" },
    { table: "payout_requests", by: "creator_id" },
    { table: "payout_transactions", by: "creator_id" },
    { table: "creator_payment_configs", by: "user_id" },
    { table: "developer_apps", by: "user_id" },

    /* ---- Direct auth.users children (incl. the 22 NO ACTION blockers) ---- */
    { table: "profiles", by: "id" },
    { table: "creator_verifications", by: "user_id" },
    { table: "business_verifications", by: "user_id" },
    { table: "bank_accounts", by: "user_id" },
    { table: "bank_verifications", by: "user_id" },
    { table: "fraud_profiles", by: "user_id" },
    { table: "fraud_events", by: "user_id" },
    { table: "fraud_rule_hits", by: "user_id" },
    { table: "fraud_cases", by: "user_id" },
    { table: "fraud_alerts", by: "user_id" },
    { table: "creator_reputation", by: "creator_id" },
    { table: "donor_reputation", by: "donor_id" },
    { table: "appeals", by: "appellant_id" },
  ];

  /**
   * Collect every storage path the user owns in the private verification-docs
   * bucket BEFORE the rows are deleted. DB deletions (incl. cascades) never
   * remove the underlying storage objects, so they must be removed explicitly
   * or the files are orphaned after the account is gone.
   */
  const collectStoragePaths = async () => {
    const paths = [];
    const collect = (rows, keys) => {
      for (const row of rows || []) {
        for (const key of keys) {
          if (row[key]) paths.push(row[key]);
        }
      }
    };

    const { data: vDocs } = await supabaseAdmin
      .from("verification_documents")
      .select("storage_path")
      .eq("user_id", userId);
    collect(vDocs, ["storage_path"]);

    const { data: bDocs } = await supabaseAdmin
      .from("business_documents")
      .select("storage_path")
      .eq("user_id", userId);
    collect(bDocs, ["storage_path"]);

    const { data: bankAccounts } = await supabaseAdmin
      .from("bank_accounts")
      .select("cancelled_cheque_path, passbook_path")
      .eq("user_id", userId);
    collect(bankAccounts, ["cancelled_cheque_path", "passbook_path"]);

    return [...new Set(paths)];
  };

  /**
   * Attempt a single table cleanup. Never throws — a table or column that
   * doesn't exist in this deployment is logged and skipped, so one stale
   * spec entry can never block the whole deletion.
   */
  const cleanup = async ({ table, by }) => {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq(by, userId);

    if (error) {
      console.warn(`[account-delete] ${table}.${by}: ${error.message}`);
      return { table, by, error: error.message };
    }
    return null;
  };

  try {
    const storagePaths = await collectStoragePaths();

    const failures = [];
    for (const spec of cleanupSpec) {
      const failure = await cleanup(spec);
      if (failure) failures.push(failure);
    }

    if (failures.length > 0) {
      console.warn(`[account-delete] ${failures.length} table(s) skipped:`, failures);
    }

    // Remove the user's files from the private verification-docs bucket.
    // Best-effort: an orphaned object must never block account deletion.
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove(storagePaths);
      if (storageError) {
        console.warn(
          `[account-delete] storage cleanup (${storagePaths.length} object(s)): ${storageError.message}`,
        );
      }
    }

    // Delete the auth user itself (requires service role key)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      userId,
    );

    if (authError) {
      console.error("[account-delete] auth.user deletion failed:", authError);
      // Surface the real database error so the remaining FK blocker is visible
      return res.status(500).json({
        error: "Failed to delete auth user",
        detail: authError.message,
        skippedTables: failures,
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Account deletion error:", err);
    return res.status(500).json({ error: "Account deletion failed" });
  }
});
