/**
 * lib/ai/projectScore.js
 *
 * Deterministic AI-derived scores for a campaign, computed purely from real
 * project data (no stored column, no fabricated values). These are the
 * "Growth Catalyst" algorithmic scores the platform already surfaces on the
 * project detail page ("Verified by Fundora AI").
 *
 * Extracted here so the project detail page and the landing "Trending
 * Campaigns" cards share a single source of truth.
 */

/**
 * Algorithmic potential ("Growth Catalyst") score, 0-98.
 * Rises with funding progress, funding goal ambition, a category, and a
 * deadline — all fields already present on a project row.
 *
 * @param {object} project
 * @returns {number} integer score 0..98
 */
export function computeGrowthScore(project) {
  const pledged = project?.pledged || 0;
  const goal = project?.goal || 1;
  const progress = Math.min(pledged / goal, 1);
  let score = 40;
  score += progress * 30;
  score += goal >= 100000 ? 10 : goal >= 50000 ? 5 : 0;
  score += project?.category ? 8 : 0;
  score += project?.deadline ? 7 : 0;
  return Math.min(Math.round(score), 98);
}

/**
 * Operational efficiency score, 0-96. Requires media/team counts that only
 * the project detail page has, so it is not used on the compact landing card.
 *
 * @param {object} project
 * @param {number} mediaCount
 * @param {number} teamCount
 * @returns {number} integer score 0..96
 */
export function computePerformanceScore(project, mediaCount, teamCount) {
  let score = 35;
  score += Math.min(mediaCount * 5, 20);
  score += Math.min(teamCount * 8, 16);
  score +=
    project?.description?.length > 500
      ? 10
      : project?.description?.length > 200
        ? 5
        : 0;
  score += project?.prototypeUrl ? 9 : 0;
  return Math.min(Math.round(score), 96);
}
