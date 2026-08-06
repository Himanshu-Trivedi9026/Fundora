import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

/**
 * Recommended category for a creator starting a new campaign.
 *
 * Scored from real platform data only. Column set is intentionally narrow
 * (no `select("*")`), and reads are bounded:
 *   - `projects.categories` is a text[] of labels; there is NO `category`
 *     column and no `likes`/`dislikes` columns — reading them returned 400/undefined.
 *   - Only `deleted = false` projects are considered, capped at 1000 rows.
 */
export default withAuth(async function handler(req, res, user) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!rl(req, res)) return;

  try {
    const { creatorId } = req.body;

    if (!creatorId || typeof creatorId !== "string") {
      return res.status(400).json({ error: "creatorId is required" });
    }

    /* ---------------- ALL PROJECTS (bounded, narrow columns) ---------------- */

    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("id, owner_id, categories, goal, pledged")
      .eq("deleted", false)
      .limit(1000);

    const { data: donations } = await supabaseAdmin
      .from("public_donations")
      .select("project_id, amount")
      .limit(1000);

    const projectList = projects || [];
    const donationList = donations || [];

    /* ---------------- CATEGORY METRICS ---------------- */

    const categoryStats = {};

    projectList.forEach((p) => {
      const cat =
        Array.isArray(p.categories) && p.categories.length > 0
          ? p.categories[0]
          : "Other";

      if (!categoryStats[cat]) {
        categoryStats[cat] = {
          totalProjects: 0,
          totalFunding: 0,
          totalGoal: 0,
        };
      }

      categoryStats[cat].totalProjects++;
      categoryStats[cat].totalFunding += p.pledged || 0;
      categoryStats[cat].totalGoal += p.goal || 1;
    });

    /* ---------------- CREATOR HISTORY ---------------- */

    const creatorProjects = projectList.filter((p) => p.owner_id === creatorId);

    const creatorCategorySuccess = {};

    creatorProjects.forEach((p) => {
      const cat =
        Array.isArray(p.categories) && p.categories.length > 0
          ? p.categories[0]
          : "Other";

      if (!creatorCategorySuccess[cat]) {
        creatorCategorySuccess[cat] = {
          funding: 0,
          count: 0,
        };
      }

      creatorCategorySuccess[cat].funding += p.pledged || 0;
      creatorCategorySuccess[cat].count++;
    });

    /* ---------------- DONOR INTEREST ---------------- */

    const donorInterest = {};

    donationList.forEach((d) => {
      const proj = projectList.find((p) => p.id === d.project_id);
      if (!proj) return;

      const cat =
        Array.isArray(proj.categories) && proj.categories.length > 0
          ? proj.categories[0]
          : "Other";

      donorInterest[cat] = (donorInterest[cat] || 0) + d.amount;
    });

    /* ---------------- AI SCORING ---------------- */

    let bestCategory = null;
    let bestScore = 0;

    Object.keys(categoryStats).forEach((cat) => {
      const stat = categoryStats[cat];

      const marketDemand = stat.totalFunding / stat.totalGoal;

      const creatorSuccess = creatorCategorySuccess[cat]?.funding || 0;

      const donorScore = donorInterest[cat] || 0;

      // Engagement proxy: categories with more live projects are more active.
      // (There is no likes/dislikes column; those reads were always undefined.)
      const engagement = stat.totalProjects;

      const score =
        0.4 * marketDemand +
        0.3 * creatorSuccess +
        0.2 * donorScore +
        0.1 * engagement;

      if (score > bestScore) {
        bestScore = score;
        bestCategory = cat;
      }
    });

    res.json({
      recommendedCategory: bestCategory,
      score: Math.round(bestScore),
    });
  } catch (err) {
    console.error("Funding recommendation error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});
