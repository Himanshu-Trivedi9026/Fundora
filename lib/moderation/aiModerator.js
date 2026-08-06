/**
 * AI Moderator — AI assistant for content moderation.
 *
 * Provides AI-powered content analysis and moderation support:
 *   - Content classification with severity levels
 *   - Spam detection
 *   - Duplicate campaign detection
 *   - Suspicious description analysis
 *   - Media authenticity indicators
 *   - Policy violation matching
 *   - Multi-signal confidence calculation
 *
 * Does NOT modify any existing moderation files — this is an additive layer.
 *
 * Security:
 *   - Never throws — all errors returned as { success: false, error }
 *   - Uses secureLogger for all logging
 *   - Uses supabaseAdmin for all DB operations
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { completeAIRequest } from "../ai/aiEngine.js";
import { getAIConfig } from "../ai/aiEngine.js";

// ─── Constants ───

const SEVERITY_LEVELS = ["none", "low", "medium", "high", "critical"];

const CONTENT_CATEGORIES = {
  SPAM: "spam",
  HARASSMENT: "harassment",
  MISINFORMATION: "misinformation",
  VIOLENCE: "violence",
  HATE_SPEECH: "hate_speech",
  SCAM: "scam",
  INAPPROPRIATE: "inappropriate",
  COPYRIGHT: "copyright",
  SELF_HARM: "self_harm",
  CLEAN: "clean",
};

const POLICY_VIOLATIONS = {
  NO_PERSONAL_INFO:
    "Do not share personal information (addresses, phone numbers, IDs)",
  NO_MISLEADING_CLAIMS:
    "Campaign descriptions must be truthful and not make misleading claims",
  NO_ILLEGAL_ACTIVITY: "Campaigns must not promote or fund illegal activities",
  NO_HATE_SPEECH:
    "Content must not contain hate speech or discriminatory language",
  NO_HARASSMENT:
    "Content must not harass, bully, or intimidate individuals or groups",
  NO_SPAM: "Content must not be spam or deceptive promotional material",
  NO_GRAPHIC_CONTENT:
    "Content must not contain graphic violence, gore, or disturbing imagery",
  MINIMUM_DESCRIPTION: "Campaign description must be at least 100 characters",
  REQUIRED_MEDIA: "Campaign must include at least one image",
  NO_SCAM_INDICATORS:
    "Campaign must not show common scam indicators (guaranteed returns, urgency pressure)",
};

const SPAM_INDICATORS = [
  "click here",
  "buy now",
  "limited time offer",
  "act now",
  "congratulations you won",
  "free money",
  "guaranteed returns",
  "no risk",
  "double your money",
  "wire transfer",
  "western union",
  "bitcoin wallet",
  "crypto airdrop",
  "nigerian prince",
  "send money to",
];

const SCAM_KEYWORDS = [
  "guaranteed profit",
  "risk free",
  "100% return",
  "get rich quick",
  "financial freedom guaranteed",
  "secret investment",
  "exclusive opportunity",
  "act fast",
  "last chance",
  "only today",
  "wire funds",
  "gift cards",
  "social security number",
  "bank account details",
];

const SUSPICIOUS_PATTERNS = [
  /urgency\b.*\b(transfer|send|donate|pay)/i,
  /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/, // Phone numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card numbers
  /\b[A-Z]{2}\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // IBAN-like patterns
  /\bpassword\b.*\b(share|send|provide)\b/i,
];

// ─── Helpers ───

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  const words1 = text1
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const words2 = text2
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (words1.length === 0 || words2.length === 0) return 0;

  const set2 = new Set(words2);
  const intersection = words1.filter((w) => set2.has(w));

  // Jaccard similarity
  const union = new Set([...words1, ...words2]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

function countSpamIndicators(text) {
  const lower = text.toLowerCase();
  return SPAM_INDICATORS.filter((indicator) => lower.includes(indicator))
    .length;
}

function countScamKeywords(text) {
  const lower = text.toLowerCase();
  return SCAM_KEYWORDS.filter((keyword) => lower.includes(keyword)).length;
}

function checkPersonalInfo(text) {
  const patterns = [
    { type: "phone", regex: /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/ },
    {
      type: "email",
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    },
    {
      type: "address",
      regex:
        /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr)\b/i,
    },
    { type: "ssn", regex: /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/ },
    {
      type: "credit_card",
      regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    },
  ];

  const found = [];
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      found.push(pattern.type);
    }
  }
  return found;
}

// ─── Core Functions ───

/**
 * Classify content into categories with severity levels.
 *
 * @param {Object} params
 * @param {string} params.entityType — Entity type (e.g., "campaign", "comment", "message")
 * @param {string} params.entityId — Entity ID
 * @param {string} params.content — Content to classify
 * @param {string} [params.title] — Content title (for campaigns)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function classifyContent({
  entityType,
  entityId,
  content,
  title,
}) {
  try {
    if (!entityType) {
      return { success: false, error: "entityType is required" };
    }
    if (!entityId) {
      return { success: false, error: "entityId is required" };
    }
    if (!content) {
      return { success: false, error: "content is required" };
    }

    const text = `${title || ""} ${content}`.toLowerCase();
    const fullText = `${title || ""} ${content}`;

    let category = CONTENT_CATEGORIES.CLEAN;
    let subcategory = "none";
    let severity = "none";
    let confidence = 0.9;
    const policyViolations = [];

    // Spam detection
    const spamCount = countSpamIndicators(fullText);
    if (spamCount >= 3) {
      category = CONTENT_CATEGORIES.SPAM;
      subcategory = "promotional_spam";
      severity = "high";
      confidence = Math.min(1, 0.5 + spamCount * 0.1);
      policyViolations.push(POLICY_VIOLATIONS.NO_SPAM);
    } else if (spamCount >= 1) {
      category = CONTENT_CATEGORIES.SPAM;
      subcategory = "possible_spam";
      severity = "low";
      confidence = 0.4 + spamCount * 0.1;
    }

    // Scam detection
    const scamCount = countScamKeywords(fullText);
    if (scamCount >= 2) {
      category = CONTENT_CATEGORIES.SCAM;
      subcategory = "financial_scam";
      severity = "critical";
      confidence = Math.min(1, 0.6 + scamCount * 0.1);
      policyViolations.push(POLICY_VIOLATIONS.NO_SCAM_INDICATORS);
    } else if (scamCount === 1) {
      if (category === CONTENT_CATEGORIES.CLEAN) {
        category = CONTENT_CATEGORIES.SCAM;
        subcategory = "possible_scam";
        severity = "medium";
        confidence = 0.5;
      }
      policyViolations.push(POLICY_VIOLATIONS.NO_SCAM_INDICATORS);
    }

    // Personal info detection
    const personalInfoTypes = checkPersonalInfo(fullText);
    if (personalInfoTypes.length > 0) {
      category =
        category === CONTENT_CATEGORIES.CLEAN
          ? CONTENT_CATEGORIES.INAPPROPRIATE
          : category;
      severity = severity === "none" ? "medium" : severity;
      policyViolations.push(POLICY_VIOLATIONS.NO_PERSONAL_INFO);
      confidence = Math.max(confidence, 0.7);
    }

    // Hate speech indicators
    const hatePatterns = /\b(hate|kill|die|destroy)\s+(all|every)\s+\w+/i;
    if (hatePatterns.test(fullText)) {
      category = CONTENT_CATEGORIES.HATE_SPEECH;
      subcategory = "hate_speech";
      severity = "critical";
      confidence = 0.75;
      policyViolations.push(POLICY_VIOLATIONS.NO_HATE_SPEECH);
    }

    // Harassment indicators
    const harassmentPatterns =
      /\b(you're stupid|you're an? idiot|go away|shut up|worthless)\b/i;
    if (harassmentPatterns.test(fullText)) {
      category = CONTENT_CATEGORIES.HARASSMENT;
      subcategory = "directed_harassment";
      severity = "high";
      confidence = 0.7;
      policyViolations.push(POLICY_VIOLATIONS.NO_HARASSMENT);
    }

    // Misinformation indicators (sensational claims)
    const misinfoPatterns =
      /\b(cure for all|miracle|proven to reverse|doctors don't want you to know|secret cure)\b/i;
    if (misinfoPatterns.test(fullText)) {
      category = CONTENT_CATEGORIES.MISINFORMATION;
      subcategory = "health_misinfo";
      severity = "high";
      confidence = 0.65;
      policyViolations.push(POLICY_VIOLATIONS.NO_MISLEADING_CLAIMS);
    }

    // Validate severity
    if (!SEVERITY_LEVELS.includes(severity)) {
      severity = "none";
    }

    logInfo("AIModerator", "Content classified", {
      entityType,
      entityId,
      category,
      severity,
      confidence,
    });

    return {
      success: true,
      data: {
        category,
        subcategory,
        severity,
        confidence: clamp(confidence, 0, 1),
        policyViolations,
      },
    };
  } catch (err) {
    logError("AIModerator", "Classify content error", {
      error: err.message,
      entityType,
      entityId,
    });
    return { success: false, error: "Failed to classify content" };
  }
}

/**
 * Detect spam content based on content patterns.
 *
 * @param {Object} params
 * @param {string} params.content — Content to analyze
 * @param {string} params.authorId — Author's user ID
 * @param {Object} [params.context={}] — Additional context (e.g., recent posts)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function detectSpam({ content, authorId, context = {} }) {
  try {
    if (!content) {
      return { success: false, error: "content is required" };
    }
    if (!authorId) {
      return { success: false, error: "authorId is required" };
    }

    let isSpam = false;
    let confidence = 0;
    const factors = [];
    let recommendation = "No spam detected — content appears legitimate";

    // Check spam indicators
    const spamCount = countSpamIndicators(content);
    if (spamCount >= 3) {
      isSpam = true;
      confidence += 0.4;
      factors.push(`${spamCount} spam keyword indicators detected`);
    } else if (spamCount >= 1) {
      confidence += 0.15;
      factors.push(`${spamCount} spam keyword indicator(s) detected`);
    }

    // Check for excessive URLs
    const urlCount = (content.match(/https?:\/\//g) || []).length;
    if (urlCount > 3) {
      isSpam = true;
      confidence += 0.2;
      factors.push(`${urlCount} URLs detected — excessive link content`);
    } else if (urlCount > 1) {
      confidence += 0.05;
      factors.push(`${urlCount} URLs detected`);
    }

    // Check for all caps
    const words = content.split(/\s+/);
    const capsWords = words.filter(
      (w) => w.length > 3 && w === w.toUpperCase(),
    ).length;
    const capsRatio = capsWords / Math.max(words.length, 1);
    if (capsRatio > 0.5) {
      confidence += 0.15;
      factors.push("Excessive use of ALL CAPS");
    }

    // Check for repeated characters/words
    const repeatedPattern = /(\b\w+\b)(\s+\1\b){2,}/gi;
    const repeatedMatches = content.match(repeatedPattern);
    if (repeatedMatches && repeatedMatches.length > 0) {
      confidence += 0.2;
      factors.push("Repeated words detected — possible bot-generated content");
    }

    // Check for suspicious urgency language
    const urgencyPatterns =
      /\b(urgent|act now|limited time|hurry|don't miss|last chance|expires?|today only)\b/gi;
    const urgencyMatches = content.match(urgencyPatterns);
    if (urgencyMatches && urgencyMatches.length >= 3) {
      confidence += 0.15;
      factors.push("Multiple urgency phrases detected");
    }

    // Check author history context
    if (context.recentPostCount && context.recentPostCount > 20) {
      confidence += 0.1;
      factors.push(
        `Author has ${context.recentPostCount} recent posts — possible spam account`,
      );
    }

    if (context.similarPostCount && context.similarPostCount > 3) {
      isSpam = true;
      confidence += 0.25;
      factors.push(
        `${context.similarPostCount} similar posts detected — possible spam repetition`,
      );
    }

    confidence = clamp(confidence, 0, 1);
    isSpam = isSpam || confidence >= 0.6;

    if (isSpam) {
      recommendation =
        "Content appears to be spam — recommend removal or review";
    } else if (confidence >= 0.3) {
      recommendation = "Possible spam — recommend manual review";
    }

    logInfo("AIModerator", "Spam detection completed", {
      authorId,
      isSpam,
      confidence,
    });

    return {
      success: true,
      data: {
        isSpam,
        confidence,
        factors,
        recommendation,
      },
    };
  } catch (err) {
    logError("AIModerator", "Detect spam error", {
      error: err.message,
      authorId,
    });
    return { success: false, error: "Failed to detect spam" };
  }
}

/**
 * Detect duplicate or very similar campaigns.
 *
 * @param {Object} params
 * @param {string} params.title — Campaign title to check
 * @param {string} params.description — Campaign description
 * @param {string} params.category — Campaign category
 * @param {string} params.creatorId — Creator's user ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function detectDuplicateCampaign({
  title,
  description,
  category,
  creatorId,
}) {
  try {
    if (!title) {
      return { success: false, error: "title is required" };
    }
    if (!description) {
      return { success: false, error: "description is required" };
    }
    if (!creatorId) {
      return { success: false, error: "creatorId is required" };
    }

    // Fetch recent campaigns (same category, different creator) to compare against
    const { data: existingCampaigns, error: fetchError } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, description, creator_id")
      .eq("category", category || "")
      .neq("creator_id", creatorId)
      .in("status", ["active", "funded", "completed"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      logError("AIModerator", "Duplicate check fetch error", {
        error: fetchError.message,
      });
      return {
        success: false,
        error: "Failed to fetch campaigns for duplicate check",
      };
    }

    const similarCampaigns = [];
    const THRESHOLD = 0.25; // Similarity threshold

    for (const existing of existingCampaigns || []) {
      // Title similarity
      const titleSimilarity = calculateTextSimilarity(title, existing.title);
      // Description similarity
      const descSimilarity = calculateTextSimilarity(
        description,
        existing.description,
      );
      // Combined similarity (weighted)
      const combinedSimilarity = titleSimilarity * 0.6 + descSimilarity * 0.4;

      if (combinedSimilarity >= THRESHOLD) {
        similarCampaigns.push({
          id: existing.id,
          title: existing.title,
          similarity: clamp(combinedSimilarity, 0, 1),
        });
      }
    }

    // Also check creator's own campaigns for duplicates
    const { data: ownCampaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id, title, description")
      .eq("creator_id", creatorId)
      .in("status", ["active", "draft", "funded"])
      .neq("status", "removed");

    for (const own of ownCampaigns || []) {
      const titleSim = calculateTextSimilarity(title, own.title);
      const descSim = calculateTextSimilarity(description, own.description);
      const combinedSim = titleSim * 0.6 + descSim * 0.4;

      if (combinedSim >= THRESHOLD) {
        similarCampaigns.push({
          id: own.id,
          title: own.title,
          similarity: clamp(combinedSim, 0, 1),
        });
      }
    }

    // Sort by similarity descending
    similarCampaigns.sort((a, b) => b.similarity - a.similarity);

    const maxSimilarity =
      similarCampaigns.length > 0 ? similarCampaigns[0].similarity : 0;
    const isDuplicate = maxSimilarity >= 0.6;
    const confidence = clamp(maxSimilarity, 0, 1);

    logInfo("AIModerator", "Duplicate check completed", {
      creatorId,
      similarCount: similarCampaigns.length,
      isDuplicate,
    });

    return {
      success: true,
      data: {
        isDuplicate,
        similarCampaigns: similarCampaigns.slice(0, 5), // Return top 5
        confidence,
      },
    };
  } catch (err) {
    logError("AIModerator", "Detect duplicate campaign error", {
      error: err.message,
      creatorId,
    });
    return { success: false, error: "Failed to detect duplicate campaigns" };
  }
}

/**
 * Detect suspicious patterns in campaign descriptions.
 *
 * @param {Object} params
 * @param {string} params.description — Campaign description
 * @param {string} params.category — Campaign category
 * @param {number} params.goal — Funding goal
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function detectSuspiciousDescription({
  description,
  category,
  goal,
}) {
  try {
    if (!description) {
      return { success: false, error: "description is required" };
    }

    const flags = [];
    let suspicious = false;
    let confidence = 0;

    // Check for scam keywords
    const scamCount = countScamKeywords(description);
    if (scamCount > 0) {
      flags.push({
        type: "scam_keyword",
        description: `${scamCount} scam-related keyword(s) detected in description`,
        severity: scamCount >= 2 ? "high" : "medium",
      });
      confidence += scamCount * 0.15;
    }

    // Check for suspicious patterns (phone numbers, financial requests, etc.)
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(description)) {
        flags.push({
          type: "suspicious_pattern",
          description:
            "Description contains a pattern commonly associated with fraudulent content",
          severity: "medium",
        });
        confidence += 0.1;
      }
    }

    // Check personal info exposure
    const personalInfo = checkPersonalInfo(description);
    if (personalInfo.length > 0) {
      flags.push({
        type: "personal_info",
        description: `Description contains personal information: ${personalInfo.join(", ")}`,
        severity: "high",
      });
      confidence += 0.2;
    }

    // Check for vague description
    if (description.trim().length < 100) {
      flags.push({
        type: "vague_description",
        description:
          "Campaign description is very short — lacks detail about how funds will be used",
        severity: "low",
      });
      confidence += 0.1;
    }

    // Check for unrealistic claims
    const unrealisticPatterns =
      /\b(100%|guaranteed|no risk|guaranteed return|guaranteed profit)\b/i;
    if (unrealisticPatterns.test(description)) {
      flags.push({
        type: "unrealistic_claims",
        description: "Description contains unrealistic or misleading claims",
        severity: "high",
      });
      confidence += 0.2;
    }

    // Check goal vs description alignment
    if (goal && goal > 50000 && description.trim().length < 200) {
      flags.push({
        type: "goal_description_mismatch",
        description: `High funding goal ($${goal.toLocaleString()}) but description lacks sufficient detail`,
        severity: "medium",
      });
      confidence += 0.1;
    }

    // Check for external redirect attempts
    const redirectPatterns = /\b(bit\.ly|tinyurl|goo\.gl|t\.co|short)\b/i;
    if (redirectPatterns.test(description)) {
      flags.push({
        type: "shortened_url",
        description:
          "Description contains shortened URLs — may be hiding destination",
        severity: "medium",
      });
      confidence += 0.15;
    }

    confidence = clamp(confidence, 0, 1);
    suspicious = flags.length > 0 && confidence >= 0.3;

    logInfo("AIModerator", "Suspicious description check completed", {
      suspicious,
      flagCount: flags.length,
    });

    return {
      success: true,
      data: {
        suspicious,
        flags,
        confidence,
      },
    };
  } catch (err) {
    logError("AIModerator", "Detect suspicious description error", {
      error: err.message,
    });
    return { success: false, error: "Failed to detect suspicious description" };
  }
}

/**
 * Analyze media for authenticity indicators.
 *
 * @param {Object} params
 * @param {string[]} params.mediaUrls — Array of media URLs to analyze
 * @param {Object} [params.campaignContext={}] — Campaign context for relevance checking
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function analyzeMediaAuthenticity({
  mediaUrls,
  campaignContext = {},
}) {
  try {
    if (!mediaUrls || !Array.isArray(mediaUrls) || mediaUrls.length === 0) {
      return {
        success: false,
        error: "mediaUrls array is required and must not be empty",
      };
    }

    const indicators = [];
    let totalScore = 0;

    for (const url of mediaUrls) {
      // Check for stock photo indicators
      const stockIndicators =
        /\b(shutterstock|istockphoto|getty|adobe stock|depositphoto|dreamstime)\b/i;
      if (stockIndicators.test(url)) {
        indicators.push({
          type: "stock_photo",
          confidence: 0.8,
          description: "Media appears to be from a stock photo service",
        });
        totalScore += 0.2;
      }

      // Check for known meme/copypasta URLs
      const memeIndicators =
        /\b(meme|funny|viral|memeconomy|imgflip|knowyourmeme)\b/i;
      if (memeIndicators.test(url)) {
        indicators.push({
          type: "meme_content",
          confidence: 0.7,
          description: "Media appears to be meme content — may not be original",
        });
        totalScore += 0.3;
      }

      // Check file extension for suspicious patterns
      const hasImageExt = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
      const hasVideoExt = /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
      const hasOtherExt = /\.(exe|zip|scr|bat|cmd|ps1|js)(\?|$)/i.test(url);

      if (hasOtherExt) {
        indicators.push({
          type: "suspicious_file",
          confidence: 0.9,
          description:
            "Media URL points to a potentially executable file — security risk",
        });
        totalScore += 0.8;
      }

      if (!hasImageExt && !hasVideoExt && !hasOtherExt) {
        indicators.push({
          type: "unknown_format",
          confidence: 0.3,
          description: "Media URL format could not be determined",
        });
        totalScore += 0.1;
      }

      // Check for HTTP (not HTTPS)
      if (url.startsWith("http://")) {
        indicators.push({
          type: "insecure_url",
          confidence: 0.4,
          description: "Media served over insecure HTTP — may be tampered with",
        });
        totalScore += 0.1;
      }

      // Check for duplicate URLs
      const duplicateCount = mediaUrls.filter((u) => u === url).length;
      if (duplicateCount > 1) {
        indicators.push({
          type: "duplicate_media",
          confidence: 0.6,
          description: "Same media URL appears multiple times",
        });
      }
    }

    // Check media count
    if (mediaUrls.length === 1) {
      indicators.push({
        type: "single_media",
        confidence: 0.3,
        description:
          "Only one media item — consider adding more for credibility",
      });
    }

    const overallAuthenticity = clamp(
      1 - totalScore / Math.max(mediaUrls.length, 1),
      0,
      1,
    );

    logInfo("AIModerator", "Media authenticity analyzed", {
      mediaCount: mediaUrls.length,
      indicatorCount: indicators.length,
      overallAuthenticity,
    });

    return {
      success: true,
      data: {
        indicators,
        overallAuthenticity,
      },
    };
  } catch (err) {
    logError("AIModerator", "Analyze media authenticity error", {
      error: err.message,
    });
    return { success: false, error: "Failed to analyze media authenticity" };
  }
}

/**
 * Match content against known policy violations.
 *
 * @param {Object} params
 * @param {string} params.content — Content to check
 * @param {string} params.entityType — Entity type
 * @param {Object} [params.policyContext={}] — Policy context (e.g., specific policies to check)
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function suggestPolicyViolation({
  content,
  entityType,
  policyContext = {},
}) {
  try {
    if (!content) {
      return { success: false, error: "content is required" };
    }
    if (!entityType) {
      return { success: false, error: "entityType is required" };
    }

    const violations = [];
    const text = content.toLowerCase();

    // Personal info check
    const personalInfo = checkPersonalInfo(content);
    if (personalInfo.length > 0) {
      violations.push({
        policy: "NO_PERSONAL_INFO",
        description: `Content contains personal information: ${personalInfo.join(", ")}`,
        severity: "high",
        confidence: 0.85,
      });
    }

    // Misleading claims check
    const misleadingPatterns =
      /\b(guaranteed|100%|no risk|miracle|secret cure|doctors don't want)\b/i;
    if (misleadingPatterns.test(content)) {
      violations.push({
        policy: "NO_MISLEADING_CLAIMS",
        description: "Content contains potentially misleading claims",
        severity: "medium",
        confidence: 0.65,
      });
    }

    // Illegal activity indicators
    const illegalPatterns =
      /\b(drug traffic|money laundering|gambling ring|ponzi|pyramid scheme)\b/i;
    if (illegalPatterns.test(content)) {
      violations.push({
        policy: "NO_ILLEGAL_ACTIVITY",
        description: "Content may reference illegal activities",
        severity: "critical",
        confidence: 0.7,
      });
    }

    // Hate speech
    const hatePatterns =
      /\b(hate|kill|destroy|eliminate)\s+(all|every)\s+(men|women|jews|muslims|christians|blacks|whites|asians|gays|lesbians|trans)\b/i;
    if (hatePatterns.test(content)) {
      violations.push({
        policy: "NO_HATE_SPEECH",
        description: "Content contains hate speech targeting a protected group",
        severity: "critical",
        confidence: 0.9,
      });
    }

    // Harassment
    const harassmentPatterns =
      /\b(you('re|\s+are)\s+(stupid|idiot|worthless|ugly|fat|pathetic|loser))\b/i;
    if (harassmentPatterns.test(content)) {
      violations.push({
        policy: "NO_HARASSMENT",
        description: "Content contains targeted harassment or personal attacks",
        severity: "high",
        confidence: 0.75,
      });
    }

    // Spam
    const spamCount = countSpamIndicators(content);
    if (spamCount >= 2) {
      violations.push({
        policy: "NO_SPAM",
        description: `Content contains ${spamCount} spam indicators`,
        severity: "high",
        confidence: Math.min(1, 0.5 + spamCount * 0.1),
      });
    }

    // Scam indicators
    const scamCount = countScamKeywords(content);
    if (scamCount >= 1) {
      violations.push({
        policy: "NO_SCAM_INDICATORS",
        description: `Content contains ${scamCount} scam-related keyword(s)`,
        severity: scamCount >= 2 ? "critical" : "high",
        confidence: Math.min(1, 0.5 + scamCount * 0.15),
      });
    }

    // Description length (for campaign entities)
    if (entityType === "campaign" && content.trim().length < 100) {
      violations.push({
        policy: "MINIMUM_DESCRIPTION",
        description:
          "Campaign description is below the minimum length requirement (100 characters)",
        severity: "low",
        confidence: 0.95,
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    violations.sort(
      (a, b) =>
        (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4),
    );

    // Generate recommendation
    let recommendation = "No policy violations detected";
    if (violations.length > 0) {
      const criticalCount = violations.filter(
        (v) => v.severity === "critical",
      ).length;
      const highCount = violations.filter((v) => v.severity === "high").length;

      if (criticalCount > 0) {
        recommendation =
          "Critical violations detected — immediate action required (content removal recommended)";
      } else if (highCount > 0) {
        recommendation =
          "Serious violations detected — content review required before approval";
      } else {
        recommendation =
          "Minor policy issues detected — consider requesting content modifications";
      }
    }

    logInfo("AIModerator", "Policy violation check completed", {
      entityType,
      violationCount: violations.length,
    });

    return {
      success: true,
      data: {
        violations,
        recommendation,
      },
    };
  } catch (err) {
    logError("AIModerator", "Suggest policy violation error", {
      error: err.message,
      entityType,
    });
    return { success: false, error: "Failed to check policy violations" };
  }
}

/**
 * Calculate overall moderation confidence from multiple signal sources.
 *
 * @param {Object} params
 * @param {Object} [params.signals={}] — Signal-based confidence scores
 * @param {Object} [params.aiResults={}] — AI analysis results
 * @param {Object} [params.ruleResults={}] — Rule-based results
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function calculateModerationConfidence({
  signals = {},
  aiResults = {},
  ruleResults = {},
}) {
  try {
    // Calculate signal confidence
    let signalScore = 0;
    let signalCount = 0;

    if (signals.spamScore !== undefined) {
      signalScore += signals.spamScore;
      signalCount++;
    }
    if (signals.toxicityScore !== undefined) {
      signalScore += signals.toxicityScore;
      signalCount++;
    }
    if (signals.fraudScore !== undefined) {
      signalScore += signals.fraudScore;
      signalCount++;
    }
    if (signals.duplicateScore !== undefined) {
      signalScore += signals.duplicateScore;
      signalCount++;
    }
    if (signals.coherenceScore !== undefined) {
      // Coherence is inversely related to moderation need
      signalScore += 1 - signals.coherenceScore;
      signalCount++;
    }

    const signalConfidence =
      signalCount > 0 ? clamp(signalScore / signalCount, 0, 1) : 0;

    // Calculate AI confidence
    let aiConfidence = 0;
    if (aiResults.classification?.confidence !== undefined) {
      aiConfidence = aiResults.classification.confidence;
    } else if (aiResults.spamDetection?.confidence !== undefined) {
      aiConfidence = aiResults.spamDetection.confidence;
    } else if (aiResults.policyViolation?.confidence !== undefined) {
      aiConfidence = aiResults.policyViolation.confidence;
    }

    // Calculate rule-based confidence
    let ruleConfidence = 0;
    let ruleCount = 0;

    if (ruleResults.length !== undefined && Array.isArray(ruleResults)) {
      for (const rule of ruleResults) {
        if (rule.matched) {
          ruleConfidence += rule.confidence || 0.5;
          ruleCount++;
        }
      }
      ruleConfidence =
        ruleCount > 0 ? clamp(ruleConfidence / ruleCount, 0, 1) : 0;
    } else if (typeof ruleResults === "object") {
      const matchedRules = Object.values(ruleResults).filter((r) => r.matched);
      if (matchedRules.length > 0) {
        ruleConfidence = clamp(
          matchedRules.reduce((sum, r) => sum + (r.confidence || 0.5), 0) /
            matchedRules.length,
          0,
          1,
        );
      }
    }

    // Overall confidence is weighted average
    const weights = { signals: 0.3, ai: 0.5, rules: 0.2 };
    const hasAi = aiConfidence > 0;
    const hasRules = ruleConfidence > 0;
    const hasSignals = signalCount > 0;

    let totalWeight = 0;
    let weightedSum = 0;

    if (hasSignals) {
      weightedSum += signalConfidence * weights.signals;
      totalWeight += weights.signals;
    }
    if (hasAi) {
      weightedSum += aiConfidence * weights.ai;
      totalWeight += weights.ai;
    }
    if (hasRules) {
      weightedSum += ruleConfidence * weights.rules;
      totalWeight += weights.rules;
    }

    const overallConfidence =
      totalWeight > 0 ? clamp(weightedSum / totalWeight, 0, 1) : 0;

    logInfo("AIModerator", "Moderation confidence calculated", {
      overallConfidence,
    });

    return {
      success: true,
      data: {
        overallConfidence: clamp(overallConfidence, 0, 1),
        breakdown: {
          signals: clamp(signalConfidence, 0, 1),
          ai: clamp(aiConfidence, 0, 1),
          rules: clamp(ruleConfidence, 0, 1),
        },
      },
    };
  } catch (err) {
    logError("AIModerator", "Calculate moderation confidence error", {
      error: err.message,
    });
    return {
      success: false,
      error: "Failed to calculate moderation confidence",
    };
  }
}
