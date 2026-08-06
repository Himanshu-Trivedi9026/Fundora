/**
 * Projects API — campaign creation.
 *
 * POST — Publish a new campaign (the single supported publish path).
 *
 * The route is wrapped in `withVerified`: only creators whose
 * creator_verifications.verification_status is "approved" may publish.
 * owner_id is set server-side from the authenticated user — never trusted
 * from the request body. The DB trigger (migration 020) is the hard backstop
 * against any other direct insert path.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withVerified } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

function toSlug(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default withVerified(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rl(req, res)) return;

  try {
    const {
      title,
      short,
      description,
      goal,
      deadline,
      prototypeUrl,
      categories,
    } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (!short || typeof short !== "string" || !short.trim()) {
      return res.status(400).json({ error: "Short description is required" });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ error: "Description is required" });
    }

    const parsedGoal = Number(goal);
    if (!parsedGoal || parsedGoal <= 0 || !Number.isFinite(parsedGoal)) {
      return res.status(400).json({ error: "Goal must be a positive number" });
    }

    const { data: project, error: insertError } = await supabaseAdmin
      .from("projects")
      .insert([
        {
          title: title.trim(),
          short: short.trim(),
          description,
          goal: parsedGoal,
          deadline: deadline || null,
          prototypeUrl: prototypeUrl || null,
          categories: Array.isArray(categories) ? categories : [],
          slug: toSlug(title),
          // Server-side binding: the publisher is always the authenticated user.
          owner_id: user.id,
          creator_id: user.id,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Publish insert error:", insertError);
      return res.status(500).json({ error: "Failed to publish campaign" });
    }

    return res.status(201).json({ project });
  } catch (err) {
    console.error("Publish error:", err);
    return res.status(500).json({ error: "Failed to publish campaign" });
  }
});
