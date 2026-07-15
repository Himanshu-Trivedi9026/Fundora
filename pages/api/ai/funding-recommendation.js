import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { withAuth } from "../../../lib/withAuth";

export default withAuth(async function handler(req, res, user) {

  try {

    const { creatorId } = req.body;

    /* ---------------- ALL PROJECTS ---------------- */

    const { data: projects } = await supabaseAdmin
      .from("projects")
      .select("*");

    const { data: donations } = await supabaseAdmin
      .from("public_donations")
      .select("*");

    /* ---------------- CATEGORY METRICS ---------------- */

    const categoryStats = {};

    projects.forEach(p => {

      const cat = p.category || "Other";

      if (!categoryStats[cat]) {
        categoryStats[cat] = {
          totalProjects: 0,
          totalFunding: 0,
          totalGoal: 0,
          likes: 0,
          dislikes: 0
        };
      }

      categoryStats[cat].totalProjects++;
      categoryStats[cat].totalFunding += p.pledged || 0;
      categoryStats[cat].totalGoal += p.goal || 1;
      categoryStats[cat].likes += p.likes || 0;
      categoryStats[cat].dislikes += p.dislikes || 0;

    });

    /* ---------------- CREATOR HISTORY ---------------- */

    const creatorProjects = projects.filter(
      p => p.owner_id === creatorId
    );

    const creatorCategorySuccess = {};

    creatorProjects.forEach(p => {

      const cat = p.category || "Other";

      if (!creatorCategorySuccess[cat]) {
        creatorCategorySuccess[cat] = {
          funding: 0,
          count: 0
        };
      }

      creatorCategorySuccess[cat].funding += p.pledged || 0;
      creatorCategorySuccess[cat].count++;

    });

    /* ---------------- DONOR INTEREST ---------------- */

    const donorInterest = {};

    donations.forEach(d => {

      const proj = projects.find(p => p.id === d.project_id);
      if (!proj) return;

      const cat = proj.category || "Other";

      donorInterest[cat] = (donorInterest[cat] || 0) + d.amount;

    });

    /* ---------------- AI SCORING ---------------- */

    let bestCategory = null;
    let bestScore = 0;

    Object.keys(categoryStats).forEach(cat => {

      const stat = categoryStats[cat];

      const marketDemand = stat.totalFunding / stat.totalGoal;

      const creatorSuccess =
        creatorCategorySuccess[cat]?.funding || 0;

      const donorScore =
        donorInterest[cat] || 0;

      const engagement =
        stat.likes - stat.dislikes;

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
      score: Math.round(bestScore)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI failed" });
  }
});
