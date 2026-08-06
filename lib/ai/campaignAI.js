/**
 * Campaign AI — AI-powered campaign analysis, scoring, and suggestions.
 *
 * Provides rule-based and AI-enhanced analysis for campaigns:
 *   - Quality scoring across multiple dimensions
 *   - Title generation and improvement suggestions
 *   - Description analysis and rewriting
 *   - Funding goal recommendations
 *   - Category prediction
 *   - Risk observations
 *   - SEO optimization suggestions
 *   - Completeness analysis
 *   - Batch quality checks
 *
 * Security:
 *   - Never throws — all errors returned as { success: false, error }
 *   - Uses secureLogger for all logging
 *   - Uses supabaseAdmin for all DB operations
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { completeAIRequest } from "./aiEngine.js";

// ─── Constants ───

const TITLE_MIN_LENGTH = 10;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MIN_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 5000;

const POWER_WORDS = [
  "help",
  "support",
  "fund",
  "build",
  "create",
  "launch",
  "urgent",
  "critical",
  "essential",
  "transform",
  "empower",
  "community",
  "together",
  "make a difference",
  "change lives",
  "innovative",
  "breakthrough",
  "revolutionary",
  "impact",
];

const CATEGORY_KEYWORDS = {
  technology: [
    "tech",
    "software",
    "app",
    "ai",
    "machine learning",
    "blockchain",
    "saas",
    "platform",
    "digital",
  ],
  health: [
    "health",
    "medical",
    "wellness",
    "fitness",
    "mental health",
    "therapy",
    "cure",
    "treatment",
    "clinical",
  ],
  education: [
    "education",
    "learning",
    "school",
    "university",
    "student",
    "teach",
    "course",
    "training",
    "academic",
  ],
  environment: [
    "environment",
    "climate",
    "green",
    "sustainability",
    "eco",
    "renewable",
    "carbon",
    "conservation",
  ],
  arts: [
    "art",
    "music",
    "film",
    "creative",
    "design",
    "culture",
    "gallery",
    "exhibition",
    "performance",
  ],
  community: [
    "community",
    "social",
    "neighborhood",
    "volunteer",
    "charity",
    "nonprofit",
    "cause",
    "movement",
  ],
  business: [
    "business",
    "startup",
    "entrepreneur",
    "company",
    "product",
    "market",
    "revenue",
    "growth",
  ],
  science: [
    "science",
    "research",
    "laboratory",
    "experiment",
    "discovery",
    "innovation",
    "data",
  ],
};

const CATEGORY_AVERAGES = {
  technology: 25000,
  health: 50000,
  education: 15000,
  environment: 30000,
  arts: 10000,
  community: 20000,
  business: 35000,
  science: 40000,
};

// ─── Helpers ───

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculateTitleScore(title) {
  if (!title) return 0;

  let score = 0;

  // Length scoring (0-40 points)
  const len = title.trim().length;
  if (len >= TITLE_MIN_LENGTH && len <= TITLE_MAX_LENGTH) {
    score += 40;
  } else if (len > 0 && len < TITLE_MIN_LENGTH) {
    score += Math.round((len / TITLE_MIN_LENGTH) * 30);
  } else if (len > TITLE_MAX_LENGTH) {
    score += 30;
  }

  // Power word bonus (0-30 points)
  const lowerTitle = title.toLowerCase();
  const powerWordCount = POWER_WORDS.filter((w) =>
    lowerTitle.includes(w),
  ).length;
  score += Math.min(30, powerWordCount * 10);

  // Structure scoring (0-30 points)
  // Has capitalization
  if (title[0] === title[0].toUpperCase()) score += 10;
  // No excessive punctuation
  const excessivePunct = (title.match(/[!?]{2,}/g) || []).length;
  if (excessivePunct === 0) score += 10;
  // Reasonable word count (3-15 words)
  const wordCount = title.trim().split(/\s+/).length;
  if (wordCount >= 3 && wordCount <= 15) score += 10;

  return clamp(score, 0, 100);
}

function calculateDescriptionScore(description) {
  if (!description) return 0;

  let score = 0;

  // Length scoring (0-30 points)
  const len = description.trim().length;
  if (len >= DESCRIPTION_MIN_LENGTH && len <= DESCRIPTION_MAX_LENGTH) {
    score += 30;
  } else if (len > 0 && len < DESCRIPTION_MIN_LENGTH) {
    score += Math.round((len / DESCRIPTION_MIN_LENGTH) * 25);
  } else if (len > DESCRIPTION_MAX_LENGTH) {
    score += 25;
  }

  // Structure scoring (0-30 points)
  const paragraphs = description
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);
  if (paragraphs.length >= 2) score += 10;
  if (paragraphs.length >= 3) score += 5;

  // Has headings or bullet points
  const hasHeadings =
    /#{1,3}\s/.test(description) || /^[A-Z][^\n]{5,}:$/m.test(description);
  const hasBullets = /^[\s]*[-*•]\s/m.test(description);
  if (hasHeadings) score += 10;
  if (hasBullets) score += 5;

  // Language quality hints (0-40 points)
  const sentences = description
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0);
  const avgSentenceLength = len / Math.max(sentences.length, 1);
  if (avgSentenceLength >= 10 && avgSentenceLength <= 30) score += 15;

  // Has emotional/personal language
  const personalPronouns = (description.match(/\b(I|we|our|my|me)\b/gi) || [])
    .length;
  if (personalPronouns >= 2) score += 10;

  // No ALL CAPS abuse
  const words = description.split(/\s+/);
  const capsWords = words.filter(
    (w) => w.length > 3 && w === w.toUpperCase(),
  ).length;
  const capsRatio = capsWords / Math.max(words.length, 1);
  if (capsRatio < 0.1) score += 15;

  return clamp(score, 0, 100);
}

function calculateMediaScore(mediaCount) {
  if (mediaCount <= 0) return 0;
  if (mediaCount === 1) return 20;
  if (mediaCount === 2) return 40;
  if (mediaCount === 3) return 60;
  if (mediaCount === 4) return 80;
  if (mediaCount >= 5) return 100;
  return 0;
}

function calculateGoalScore(goal, category) {
  if (!goal || goal <= 0) return 0;

  const avgGoal = CATEGORY_AVERAGES[category] || 20000;
  const ratio = goal / avgGoal;

  // Ideal range: 0.5x to 2x the category average
  if (ratio >= 0.5 && ratio <= 2.0) return 100;
  if (ratio >= 0.25 && ratio <= 3.0) return 70;
  if (ratio >= 0.1 && ratio <= 5.0) return 40;
  return 20;
}

function calculateCategoryScore(category, title, description) {
  if (!category) return 50;

  const keywords = CATEGORY_KEYWORDS[category] || [];
  const text = `${title} ${description}`.toLowerCase();

  const matchCount = keywords.filter((kw) => text.includes(kw)).length;
  if (matchCount >= 3) return 100;
  if (matchCount === 2) return 75;
  if (matchCount === 1) return 50;
  return 30;
}

// ─── Core Functions ───

/**
 * Score campaign quality across multiple dimensions.
 *
 * @param {Object} params
 * @param {string} params.campaignId — Campaign ID to analyze
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function scoreCampaignQuality({ campaignId }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    // Fetch campaign data
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from("campaigns")
      .select(
        "id, title, description, goal_amount, category, media_urls, creator_id",
      )
      .eq("id", campaignId)
      .single();

    if (fetchError) {
      logError("CampaignAI", "Score campaign fetch error", {
        error: fetchError.message,
        campaignId,
      });
      return { success: false, error: "Failed to fetch campaign" };
    }

    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Fetch creator trust score
    const { data: creatorProfile } = await supabaseAdmin
      .from("creator_profiles")
      .select("trust_score")
      .eq("user_id", campaign.creator_id)
      .single();

    const creatorScore = creatorProfile?.trust_score || 50;

    // Calculate individual scores
    const titleScore = calculateTitleScore(campaign.title);
    const descriptionScore = calculateDescriptionScore(campaign.description);
    const mediaCount = Array.isArray(campaign.media_urls)
      ? campaign.media_urls.length
      : 0;
    const mediaScore = calculateMediaScore(mediaCount);
    const goalScore = calculateGoalScore(
      campaign.goal_amount,
      campaign.category,
    );
    const categoryScore = calculateCategoryScore(
      campaign.category,
      campaign.title,
      campaign.description,
    );

    // Weighted overall score
    const overallScore = Math.round(
      titleScore * 0.2 +
        descriptionScore * 0.25 +
        mediaScore * 0.15 +
        goalScore * 0.15 +
        categoryScore * 0.1 +
        creatorScore * 0.15,
    );

    // Generate suggestions
    const suggestions = [];
    if (titleScore < 60)
      suggestions.push(
        "Improve your title — make it more descriptive and compelling",
      );
    if (descriptionScore < 50)
      suggestions.push(
        "Expand your description with more details about your project",
      );
    if (mediaScore < 50)
      suggestions.push("Add more images or media to showcase your campaign");
    if (goalScore < 60)
      suggestions.push(
        "Consider adjusting your funding goal to better match your category",
      );
    if (categoryScore < 50)
      suggestions.push("Ensure your content aligns with your chosen category");

    logInfo("CampaignAI", "Campaign quality scored", {
      campaignId,
      overallScore,
    });

    return {
      success: true,
      data: {
        overallScore,
        breakdown: {
          title: titleScore,
          description: descriptionScore,
          media: mediaScore,
          goal: goalScore,
          category: categoryScore,
          creator: creatorScore,
        },
        suggestions,
      },
    };
  } catch (err) {
    logError("CampaignAI", "Score campaign quality error", {
      error: err.message,
      campaignId,
    });
    return { success: false, error: "Failed to score campaign quality" };
  }
}

/**
 * Suggest improved campaign titles.
 *
 * @param {Object} params
 * @param {string} params.title — Current title
 * @param {string} params.category — Campaign category
 * @param {number} params.goal — Funding goal
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function suggestCampaignTitles({ title, category, goal }) {
  try {
    if (!title) {
      return { success: false, error: "title is required" };
    }

    const suggestions = [];
    const lowerTitle = title.toLowerCase();
    const wordCount = title.trim().split(/\s+/).length;

    // Variation 1: Add emotional trigger
    const emotionalPrefixes = ["Help Us", "Support", "Join Us in", "Empower"];
    const prefix =
      emotionalPrefixes[Math.floor(Math.random() * emotionalPrefixes.length)];
    if (!lowerTitle.startsWith("help") && !lowerTitle.startsWith("support")) {
      suggestions.push({
        title: `${prefix} ${title.charAt(0).toLowerCase()}${title.slice(1)}`,
        score: 75,
        reason: "Added an emotional trigger prefix to increase engagement",
      });
    }

    // Variation 2: Add number if missing
    if (!/\d/.test(title)) {
      const goalK = goal ? Math.round(goal / 1000) : 10;
      suggestions.push({
        title: `${title} — Raising $${goalK}K to Make It Happen`,
        score: 70,
        reason: "Added a concrete number to increase credibility",
      });
    }

    // Variation 3: Category-specific power word
    const categoryPowerWords = {
      technology: "innovative",
      health: "life-changing",
      education: "transformative",
      environment: "sustainable",
      arts: "creative",
      community: "community-driven",
      business: "game-changing",
      science: "groundbreaking",
    };
    const powerWord = categoryPowerWords[category] || "amazing";
    if (!lowerTitle.includes(powerWord)) {
      suggestions.push({
        title: `The ${powerWord.charAt(0).toUpperCase() + powerWord.slice(1)} ${title}`,
        score: 72,
        reason: `Added the category-appropriate power word "${powerWord}"`,
      });
    }

    // Variation 4: Shorten if too long
    if (wordCount > 10) {
      const shortened = title
        .split(/[,.]|\s+/)
        .slice(0, 8)
        .join(" ")
        .trim();
      suggestions.push({
        title: shortened,
        score: 65,
        reason: "Shortened for better readability and impact",
      });
    }

    // Variation 5: Question format
    if (!title.endsWith("?")) {
      suggestions.push({
        title: `Want to ${category === "technology" ? "build" : "create"} something ${powerWord}? ${title}`,
        score: 68,
        reason: "Question format engages potential donors",
      });
    }

    // Score the original
    const originalScore = calculateTitleScore(title);

    // Sort by score descending
    suggestions.sort((a, b) => b.score - a.score);

    logInfo("CampaignAI", "Title suggestions generated", {
      title,
      suggestionsCount: suggestions.length,
    });

    return {
      success: true,
      data: [
        { title, score: originalScore, reason: "Your current title" },
        ...suggestions,
      ],
    };
  } catch (err) {
    logError("CampaignAI", "Suggest titles error", { error: err.message });
    return { success: false, error: "Failed to suggest campaign titles" };
  }
}

/**
 * Analyze and suggest improvements for campaign description.
 *
 * @param {Object} params
 * @param {string} params.title — Campaign title
 * @param {string} params.description — Current description
 * @param {string} params.category — Campaign category
 * @param {number} params.goal — Funding goal
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function improveCampaignDescription({
  title,
  description,
  category,
  goal,
}) {
  try {
    if (!description) {
      return { success: false, error: "description is required" };
    }

    const suggestions = [];
    const len = description.trim().length;
    const paragraphs = description
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 0);

    // Check length
    if (len < DESCRIPTION_MIN_LENGTH) {
      suggestions.push(
        `Your description is too short (${len} characters). Aim for at least ${DESCRIPTION_MIN_LENGTH} characters`,
      );
    }

    // Check structure
    if (paragraphs.length < 2) {
      suggestions.push(
        "Break your description into multiple paragraphs for better readability",
      );
    }

    // Check for personal touch
    const hasPersonalPronouns = /\b(I|we|our|my|me)\b/i.test(description);
    if (!hasPersonalPronouns) {
      suggestions.push(
        "Add a personal touch — tell your story using first-person language",
      );
    }

    // Check for call to action
    const hasCTA = /\b(donate|support|contribute|help|fund|join)\b/i.test(
      description,
    );
    if (!hasCTA) {
      suggestions.push(
        "Include a clear call to action encouraging people to donate",
      );
    }

    // Check for goal mention
    const hasGoalMention = /\$[\d,]+/.test(description);
    if (!hasGoalMention && goal) {
      suggestions.push(
        `Mention your funding goal ($${goal.toLocaleString()}) in the description`,
      );
    }

    // Check for updates/benefits section
    const hasBenefits =
      /\b(benefit|impact|result|outcome|change|improve|achieve)\b/i.test(
        description,
      );
    if (!hasBenefits) {
      suggestions.push("Describe the impact and benefits of your campaign");
    }

    // Check for media references
    const hasMediaRef = /\b(photo|image|video|watch|see|look)\b/i.test(
      description,
    );
    if (!hasMediaRef) {
      suggestions.push(
        "Reference your images or videos to engage readers visually",
      );
    }

    // Build improved description
    let improved = description.trim();

    // Add structure if missing
    if (paragraphs.length < 2) {
      const sentences = improved.split(/(?<=[.!?])\s+/);
      const midpoint = Math.ceil(sentences.length / 2);
      improved =
        sentences.slice(0, midpoint).join(" ") +
        "\n\n" +
        sentences.slice(midpoint).join(" ");
    }

    // Add CTA if missing
    if (!hasCTA) {
      improved +=
        "\n\nEvery contribution brings us closer to our goal. Your support makes a real difference — donate today!";
    }

    logInfo("CampaignAI", "Description analysis completed", {
      title,
      suggestionsCount: suggestions.length,
    });

    return {
      success: true,
      data: {
        original: description,
        improved,
        suggestions,
      },
    };
  } catch (err) {
    logError("CampaignAI", "Improve description error", { error: err.message });
    return { success: false, error: "Failed to improve campaign description" };
  }
}

/**
 * Recommend a funding goal based on category and similar campaigns.
 *
 * @param {Object} params
 * @param {string} params.category — Campaign category
 * @param {string} params.campaignType — Type of campaign
 * @param {Object[]} [params.similarCampaigns=[]] — Similar campaigns for comparison
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function recommendFundingGoal({
  category,
  campaignType,
  similarCampaigns = [],
}) {
  try {
    const categoryAvg = CATEGORY_AVERAGES[category] || 20000;

    let recommended = categoryAvg;
    let reason = `Based on average goals for the "${category}" category`;

    // Adjust based on similar campaigns
    if (similarCampaigns.length > 0) {
      const avgSimilar =
        similarCampaigns.reduce((sum, c) => sum + (c.goal_amount || 0), 0) /
        similarCampaigns.length;
      const similarSuccess = similarCampaigns.filter(
        (c) => c.status === "funded" || c.raised >= c.goal_amount,
      );

      if (similarSuccess.length > 0) {
        const avgSuccessful =
          similarSuccess.reduce((sum, c) => sum + (c.goal_amount || 0), 0) /
          similarSuccess.length;
        recommended = Math.round((categoryAvg + avgSuccessful) / 2);
        reason = `Based on ${similarSuccess.length} successful similar campaigns in "${category}"`;
      } else {
        recommended = Math.round((categoryAvg + avgSimilar) / 2);
        reason = `Based on ${similarCampaigns.length} similar campaigns in "${category}"`;
      }
    }

    // Adjust based on campaign type
    const typeMultipliers = {
      personal: 0.6,
      nonprofit: 1.2,
      creative: 0.8,
      business: 1.1,
      technology: 1.3,
      emergency: 0.5,
    };
    const multiplier = typeMultipliers[campaignType] || 1.0;
    recommended = Math.round(recommended * multiplier);

    // Round to nearest 500
    recommended = Math.round(recommended / 500) * 500;

    const range = {
      min: Math.round((recommended * 0.5) / 500) * 500,
      max: Math.round((recommended * 2.0) / 500) * 500,
    };

    logInfo("CampaignAI", "Funding goal recommended", {
      category,
      recommended,
    });

    return {
      success: true,
      data: {
        recommended,
        range,
        reason,
      },
    };
  } catch (err) {
    logError("CampaignAI", "Recommend funding goal error", {
      error: err.message,
    });
    return { success: false, error: "Failed to recommend funding goal" };
  }
}

/**
 * Predict campaign category from title and description using keyword matching.
 *
 * @param {Object} params
 * @param {string} params.title — Campaign title
 * @param {string} params.description — Campaign description
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function predictCategory({ title, description }) {
  try {
    if (!title && !description) {
      return {
        success: false,
        error: "At least one of title or description is required",
      };
    }

    const text = `${title || ""} ${description || ""}`.toLowerCase();
    const results = [];

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const matchCount = keywords.filter((kw) => text.includes(kw)).length;
      const confidence = Math.min(1, matchCount / 3);

      if (matchCount > 0) {
        results.push({ category, confidence });
      }
    }

    // Sort by confidence descending
    results.sort((a, b) => b.confidence - a.confidence);

    // If no matches, default to "community"
    if (results.length === 0) {
      results.push({ category: "community", confidence: 0.2 });
    }

    logInfo("CampaignAI", "Category predicted", {
      title,
      topCategory: results[0]?.category,
    });

    return {
      success: true,
      data: results,
    };
  } catch (err) {
    logError("CampaignAI", "Predict category error", { error: err.message });
    return { success: false, error: "Failed to predict category" };
  }
}

/**
 * Observe non-blocking risk signals on a campaign.
 *
 * @param {Object} params
 * @param {string} params.campaignId — Campaign ID to observe
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function observeCampaignRisk({ campaignId }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    // Fetch campaign data
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from("campaigns")
      .select(
        "id, title, description, goal_amount, category, media_urls, creator_id, status, created_at",
      )
      .eq("id", campaignId)
      .single();

    if (fetchError || !campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Fetch creator profile
    const { data: creatorProfile } = await supabaseAdmin
      .from("creator_profiles")
      .select("trust_score, campaigns_created, total_raised, kyc_status")
      .eq("user_id", campaign.creator_id)
      .single();

    const observations = [];

    // Unrealistic goal
    const categoryAvg = CATEGORY_AVERAGES[campaign.category] || 20000;
    if (campaign.goal_amount > categoryAvg * 5) {
      observations.push({
        type: "unrealistic_goal",
        severity: "medium",
        description: `Funding goal ($${campaign.goal_amount.toLocaleString()}) is significantly higher than the category average ($${categoryAvg.toLocaleString()})`,
        suggestion:
          "Consider lowering the goal to a more achievable amount or providing strong justification",
      });
    }

    // Vague description
    if (
      !campaign.description ||
      campaign.description.trim().length < DESCRIPTION_MIN_LENGTH
    ) {
      observations.push({
        type: "vague_description",
        severity: "medium",
        description: "Campaign description is very short or missing",
        suggestion:
          "Add a detailed description including your goals, timeline, and how funds will be used",
      });
    }

    // Low creator trust
    if (creatorProfile && creatorProfile.trust_score < 30) {
      observations.push({
        type: "low_creator_trust",
        severity: "high",
        description: `Creator trust score is low (${creatorProfile.trust_score}/100)`,
        suggestion:
          "Creator should complete more verification steps and build a track record",
      });
    }

    // No media
    const mediaCount = Array.isArray(campaign.media_urls)
      ? campaign.media_urls.length
      : 0;
    if (mediaCount === 0) {
      observations.push({
        type: "no_media",
        severity: "low",
        description: "Campaign has no images or media attached",
        suggestion:
          "Add at least 2-3 images to make the campaign more engaging and trustworthy",
      });
    }

    // New creator with high goal
    if (
      creatorProfile &&
      creatorProfile.campaigns_created <= 1 &&
      campaign.goal_amount > 10000
    ) {
      observations.push({
        type: "new_creator_high_goal",
        severity: "medium",
        description: "New creator with a relatively high funding goal",
        suggestion:
          "Consider starting with a smaller goal to build trust with the community",
      });
    }

    // No KYC
    if (creatorProfile && creatorProfile.kyc_status !== "verified") {
      observations.push({
        type: "unverified_creator",
        severity: "low",
        description: "Creator has not completed identity verification",
        suggestion: "Complete KYC verification to increase donor confidence",
      });
    }

    logInfo("CampaignAI", "Campaign risk observed", {
      campaignId,
      observationCount: observations.length,
    });

    return {
      success: true,
      data: { observations },
    };
  } catch (err) {
    logError("CampaignAI", "Observe campaign risk error", {
      error: err.message,
      campaignId,
    });
    return { success: false, error: "Failed to observe campaign risk" };
  }
}

/**
 * Generate SEO suggestions for a campaign.
 *
 * @param {Object} params
 * @param {string} params.title — Campaign title
 * @param {string} params.description — Campaign description
 * @param {string} params.category — Campaign category
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function generateSEOSuggestions({ title, description, category }) {
  try {
    if (!title && !description) {
      return {
        success: false,
        error: "At least one of title or description is required",
      };
    }

    const text = `${title || ""} ${description || ""}`.toLowerCase();

    // Extract keywords from content
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "it",
      "this",
      "that",
      "are",
      "was",
      "be",
      "has",
      "have",
      "had",
      "will",
      "would",
      "could",
      "should",
      "can",
    ]);

    const words = text
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    // Count word frequency
    const wordFreq = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }

    // Get top keywords
    const keywords = Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    // Add category keyword
    if (category && !keywords.includes(category)) {
      keywords.unshift(category);
    }

    // Generate meta description (max 160 chars)
    let metaDescription = description || title || "";
    if (metaDescription.length > 155) {
      metaDescription = metaDescription.substring(0, 152).trimEnd() + "...";
    }

    // Generate title variations
    const titleSuggestions = [];
    if (title) {
      if (title.length > 60) {
        titleSuggestions.push(title.substring(0, 57).trimEnd() + "...");
      }
      if (!title.includes(category)) {
        titleSuggestions.push(
          `${title} | ${category.charAt(0).toUpperCase() + category.slice(1)} Campaign`,
        );
      }
      titleSuggestions.push(`${title} — Fund This Project on Fundora`);
    }

    logInfo("CampaignAI", "SEO suggestions generated", {
      title,
      keywordsCount: keywords.length,
    });

    return {
      success: true,
      data: {
        keywords: keywords.slice(0, 10),
        metaDescription,
        titleSuggestions,
      },
    };
  } catch (err) {
    logError("CampaignAI", "Generate SEO suggestions error", {
      error: err.message,
    });
    return { success: false, error: "Failed to generate SEO suggestions" };
  }
}

/**
 * Analyze campaign completeness against required and optional fields.
 *
 * @param {Object} params
 * @param {string} params.campaignId — Campaign ID to analyze
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function analyzeCompleteness({ campaignId }) {
  try {
    if (!campaignId) {
      return { success: false, error: "campaignId is required" };
    }

    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (fetchError || !campaign) {
      return { success: false, error: "Campaign not found" };
    }

    const required = [
      {
        field: "title",
        label: "Title",
        check: (c) => c.title && c.title.trim().length >= TITLE_MIN_LENGTH,
      },
      {
        field: "description",
        label: "Description",
        check: (c) =>
          c.description &&
          c.description.trim().length >= DESCRIPTION_MIN_LENGTH,
      },
      {
        field: "goal_amount",
        label: "Funding goal",
        check: (c) => c.goal_amount && c.goal_amount > 0,
      },
      {
        field: "category",
        label: "Category",
        check: (c) => c.category && c.category.length > 0,
      },
    ];

    const optional = [
      {
        field: "media_urls",
        label: "Media/images",
        check: (c) => Array.isArray(c.media_urls) && c.media_urls.length > 0,
      },
      {
        field: "end_date",
        label: "End date",
        check: (c) => c.end_date != null,
      },
      {
        field: "tags",
        label: "Tags",
        check: (c) => Array.isArray(c.tags) && c.tags.length > 0,
      },
      {
        field: "short_description",
        label: "Short description",
        check: (c) => c.short_description && c.short_description.length > 0,
      },
      {
        field: "location",
        label: "Location",
        check: (c) => c.location && c.location.length > 0,
      },
      {
        field: "video_url",
        label: "Video URL",
        check: (c) => c.video_url && c.video_url.length > 0,
      },
    ];

    const missing = [];
    const improvements = [];

    let totalFields = required.length + optional.length;
    let completedFields = 0;

    // Check required fields
    for (const field of required) {
      if (field.check(campaign)) {
        completedFields++;
      } else {
        missing.push(field.label);
      }
    }

    // Check optional fields
    for (const field of optional) {
      if (field.check(campaign)) {
        completedFields++;
      } else {
        improvements.push(
          `Add ${field.label.toLowerCase()} to improve your campaign`,
        );
      }
    }

    const score = Math.round((completedFields / totalFields) * 100);

    logInfo("CampaignAI", "Completeness analyzed", {
      campaignId,
      score,
      missingCount: missing.length,
    });

    return {
      success: true,
      data: {
        score,
        missing,
        improvements,
      },
    };
  } catch (err) {
    logError("CampaignAI", "Analyze completeness error", {
      error: err.message,
      campaignId,
    });
    return { success: false, error: "Failed to analyze campaign completeness" };
  }
}

/**
 * Run quality checks on multiple campaigns in batch.
 *
 * @param {Object} params
 * @param {string[]} params.campaignIds — Array of campaign IDs
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function batchQualityCheck({ campaignIds }) {
  try {
    if (
      !campaignIds ||
      !Array.isArray(campaignIds) ||
      campaignIds.length === 0
    ) {
      return {
        success: false,
        error: "campaignIds array is required and must not be empty",
      };
    }

    const results = [];

    // Process campaigns in batches of 50 to avoid overwhelming the DB
    const batchSize = 50;
    for (let i = 0; i < campaignIds.length; i += batchSize) {
      const batch = campaignIds.slice(i, i + batchSize);

      const { data: campaigns, error: fetchError } = await supabaseAdmin
        .from("campaigns")
        .select("id, title, description, goal_amount, category, media_urls")
        .in("id", batch);

      if (fetchError) {
        logError("CampaignAI", "Batch quality check fetch error", {
          error: fetchError.message,
        });
        return {
          success: false,
          error: "Failed to fetch campaigns for batch check",
        };
      }

      for (const campaign of campaigns || []) {
        const titleScore = calculateTitleScore(campaign.title);
        const descriptionScore = calculateDescriptionScore(
          campaign.description,
        );
        const mediaCount = Array.isArray(campaign.media_urls)
          ? campaign.media_urls.length
          : 0;
        const mediaScore = calculateMediaScore(mediaCount);
        const goalScore = calculateGoalScore(
          campaign.goal_amount,
          campaign.category,
        );

        const overallScore = Math.round(
          titleScore * 0.25 +
            descriptionScore * 0.3 +
            mediaScore * 0.2 +
            goalScore * 0.25,
        );

        const flags = [];
        if (titleScore < 40) flags.push("weak_title");
        if (descriptionScore < 30) flags.push("weak_description");
        if (mediaScore < 30) flags.push("insufficient_media");
        if (goalScore < 40) flags.push("unrealistic_goal");

        results.push({
          campaignId: campaign.id,
          score: overallScore,
          flags,
        });
      }
    }

    logInfo("CampaignAI", "Batch quality check completed", {
      totalChecked: results.length,
    });

    return {
      success: true,
      data: results,
    };
  } catch (err) {
    logError("CampaignAI", "Batch quality check error", { error: err.message });
    return { success: false, error: "Failed to run batch quality check" };
  }
}
