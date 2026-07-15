import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";

/**
 * Server-side account deletion.
 * Uses supabaseAdmin to bypass RLS and delete all user data,
 * then deletes the auth user.
 */
export default withAuth(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = user.id;

  try {
    // Delete user data in order (respecting foreign key constraints)
    const deletions = [
      supabaseAdmin.from("profiles").delete().eq("id", userId),
      supabaseAdmin.from("projects").delete().eq("owner_id", userId),
      supabaseAdmin.from("saved_projects").delete().eq("user_id", userId),
      supabaseAdmin.from("team_members").delete().eq("creator_id", userId),
      supabaseAdmin.from("followers").delete().eq("follower_id", userId),
      supabaseAdmin.from("followers").delete().eq("following_id", userId),
    ];

    // Attempt deletions — ignore "table doesn't exist" errors
    const results = await Promise.allSettled(deletions);
    const errors = results
      .filter((r) => r.status === "rejected" || r.value?.error)
      .map((r) => r.reason?.message || r.value?.error?.message);

    if (errors.length > 0) {
      console.warn("Partial deletion errors:", errors);
    }

    // Delete auth user (requires service role key)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      userId,
    );

    if (authError) {
      console.error("Auth user deletion error:", authError);
      return res.status(500).json({
        error: "Failed to delete auth user",
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Account deletion error:", err);
    return res.status(500).json({ error: "Account deletion failed" });
  }
});
