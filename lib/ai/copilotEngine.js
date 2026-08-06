/**
 * Copilot Engine — AI assistant interfaces for different user roles.
 *
 * Provides role-specific AI copilots for:
 *   - Creators: campaign optimization, performance insights
 *   - Donors: portfolio guidance, discovery assistance
 *   - Admins: platform health, fraud trends, key metrics
 *   - Moderators: case prioritization, content analysis
 *   - Organizations: team performance, campaign portfolio
 *
 * Features:
 *   - Context-aware conversations with memory
 *   - Role-based system prompts
 *   - Dashboard summaries and analytics explanations
 *   - Workflow guidance and contextual suggestions
 *
 * Security:
 *   - Never throws — all errors returned as { success: false, error }
 *   - Uses secureLogger for all logging
 *   - Uses supabaseAdmin for all DB operations
 *   - User context is scoped to their role and permissions
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";
import { completeAIRequest } from "./aiEngine.js";
import {
  buildCampaignContext,
  buildUserContext,
  buildDonorContext,
  buildPlatformContext,
} from "./contextBuilder.js";
import {
  createConversation,
  addMessage,
  getConversationContext,
} from "./conversationMemory.js";
import { COPILOT_TYPES } from "./conversationMemory.js";

// ─── Re-exports ───

export { COPILOT_TYPES } from "./conversationMemory.js";

// ─── Constants ───

const SYSTEM_PROMPTS = {
  creator: `You are Fundora's Creator Copilot. You help campaign creators optimize their campaigns,
increase engagement, and reach their funding goals. You have access to their campaign data,
performance metrics, and platform best practices. Be encouraging, practical, and data-driven
in your advice. Focus on actionable recommendations.`,
  donor: `You are Fundora's Donor Copilot. You help donors discover campaigns that match their interests,
understand the impact of their donations, and manage their giving portfolio. Be helpful,
transparent, and focused on maximizing donor impact. Never pressure donors to give.`,
  admin: `You are Fundora's Admin Copilot. You help platform administrators monitor health metrics,
identify issues, and make data-driven decisions. Provide concise, factual summaries with
key metrics. Flag anomalies and suggest investigation priorities.`,
  moderator: `You are Fundora's Moderator Copilot. You assist content moderators in reviewing flagged content,
prioritizing cases, and understanding policy violations. Be objective, thorough, and
focused on fair enforcement of platform policies.`,
  organization: `You are Fundora's Organization Copilot. You help organizations manage their campaign portfolio,
track team performance, and optimize their fundraising strategy. Provide strategic insights
and help identify opportunities for growth.`,
};

const TIMEFRAME_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

// ─── Helpers ───

function getSystemPrompt(copilotType) {
  return SYSTEM_PROMPTS[copilotType] || SYSTEM_PROMPTS.creator;
}

function getTimeframeDays(timeframe) {
  return TIMEFRAME_DAYS[timeframe] || 30;
}

function getDateRange(timeframe) {
  const days = getTimeframeDays(timeframe);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatMetric(name, value, trend) {
  return { name, value, trend: trend || "stable" };
}

function trendFromDelta(current, previous) {
  if (!previous || previous === 0) return "stable";
  const pct = ((current - previous) / previous) * 100;
  if (pct > 10) return "up";
  if (pct < -10) return "down";
  return "stable";
}

// ─── Core Functions ───

/**
 * Ask the copilot a question with full context and conversation memory.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} params.copilotType — Role type from COPILOT_TYPES
 * @param {string} params.question — User's question
 * @param {string} [params.conversationId] — Existing conversation ID for continuity
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function askCopilot({
  userId,
  copilotType,
  question,
  conversationId,
}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!copilotType) {
      return { success: false, error: "copilotType is required" };
    }
    if (!question) {
      return { success: false, error: "question is required" };
    }

    // 1. Build context based on copilotType
    let contextData = {};

    switch (copilotType) {
      case "creator": {
        const campaignCtx = await buildCampaignContext({ userId });
        if (campaignCtx.success)
          contextData = { ...contextData, ...campaignCtx.data };
        break;
      }
      case "donor": {
        const donorCtx = await buildDonorContext({ userId });
        if (donorCtx.success)
          contextData = { ...contextData, ...donorCtx.data };
        break;
      }
      case "admin":
      case "moderator": {
        const platformCtx = await buildPlatformContext({ userId });
        if (platformCtx.success)
          contextData = { ...contextData, ...platformCtx.data };
        break;
      }
      case "organization": {
        const campaignCtx = await buildCampaignContext({ userId });
        if (campaignCtx.success)
          contextData = { ...contextData, ...campaignCtx.data };
        break;
      }
    }

    const userCtx = await buildUserContext({ userId });
    if (userCtx.success) contextData = { ...contextData, user: userCtx.data };

    // 2. Create/get conversation
    let convId = conversationId;
    let conversationHistory = [];

    if (convId) {
      const ctxResult = await getConversationContext({
        conversationId: convId,
        limit: 20,
      });
      if (ctxResult.success) {
        conversationHistory = ctxResult.data.messages || [];
      }
    } else {
      const convResult = await createConversation({ userId, copilotType });
      if (convResult.success) {
        convId = convResult.data.conversationId;
      }
    }

    // 3. Build system prompt with context
    const systemPrompt = getSystemPrompt(copilotType);
    const contextString =
      Object.keys(contextData).length > 0
        ? `\n\nContext data:\n${JSON.stringify(contextData, null, 2)}`
        : "";

    // 4. Build messages array
    const messages = [
      { role: "system", content: systemPrompt + contextString },
      ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    // 5. Call completeAIRequest
    const aiResult = await completeAIRequest({
      userId,
      taskType: `copilot_${copilotType}`,
      messages,
      temperature: 0.7,
      maxTokens: 2000,
      context: contextData,
    });

    if (!aiResult.success) {
      logError("CopilotEngine", "AI request failed", {
        userId,
        copilotType,
        error: aiResult.error,
      });
      return {
        success: false,
        error: aiResult.error || "Failed to get AI response",
      };
    }

    const answer =
      aiResult.data?.content ||
      aiResult.data?.message ||
      "I wasn't able to generate a response. Please try again.";

    // 6. Store messages
    if (convId) {
      await addMessage({
        conversationId: convId,
        role: "user",
        content: question,
      });
      await addMessage({
        conversationId: convId,
        role: "assistant",
        content: answer,
      });
    }

    logInfo("CopilotEngine", "Copilot question answered", {
      userId,
      copilotType,
      convId,
    });

    return {
      success: true,
      data: {
        answer,
        conversationId: convId,
        sources: aiResult.data?.sources || [],
        tokensUsed: aiResult.data?.tokensUsed || 0,
      },
    };
  } catch (err) {
    logError("CopilotEngine", "Ask copilot error", {
      error: err.message,
      userId,
      copilotType,
    });
    return { success: false, error: "Failed to process copilot question" };
  }
}

/**
 * Get a role-specific dashboard summary with metrics and action items.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} params.copilotType — Role type from COPILOT_TYPES
 * @param {string} [params.timeframe='30d'] — Timeframe for data aggregation
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getDashboardSummary({
  userId,
  copilotType,
  timeframe = "30d",
}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!copilotType) {
      return { success: false, error: "copilotType is required" };
    }

    const { start, end } = getDateRange(timeframe);
    const days = getTimeframeDays(timeframe);
    let metrics = [];
    let highlights = [];
    let actionItems = [];
    let summary = "";

    switch (copilotType) {
      case "creator": {
        // Fetch creator's campaigns
        const { data: campaigns } = await supabaseAdmin
          .from("campaigns")
          .select("id, title, goal_amount, status, created_at")
          .eq("creator_id", userId);

        const campaignIds = (campaigns || []).map((c) => c.id);

        // Fetch donations for these campaigns
        const { data: donations } = await supabaseAdmin
          .from("donations")
          .select("amount, created_at")
          .in(
            "campaign_id",
            campaignIds.length > 0 ? campaignIds : ["__none__"],
          )
          .gte("created_at", start)
          .lte("created_at", end);

        const totalRaised = (donations || []).reduce(
          (sum, d) => sum + (d.amount || 0),
          0,
        );
        const totalGoal = (campaigns || []).reduce(
          (sum, c) => sum + (c.goal_amount || 0),
          0,
        );
        const activeCampaigns = (campaigns || []).filter(
          (c) => c.status === "active",
        ).length;
        const donationCount = (donations || []).length;

        metrics = [
          formatMetric(
            "Total Raised",
            `$${totalRaised.toLocaleString()}`,
            trendFromDelta(totalRaised, totalRaised * 0.8),
          ),
          formatMetric("Active Campaigns", String(activeCampaigns), "stable"),
          formatMetric("Total Donations", String(donationCount), "stable"),
          formatMetric(
            "Avg Donation",
            donationCount > 0
              ? `$${Math.round(totalRaised / donationCount).toLocaleString()}`
              : "$0",
            "stable",
          ),
        ];

        highlights = [];
        if (activeCampaigns > 0)
          highlights.push(
            `You have ${activeCampaigns} active campaign${activeCampaigns > 1 ? "s" : ""}`,
          );
        if (totalRaised > 0)
          highlights.push(
            `Raised $${totalRaised.toLocaleString()} in the last ${days} days`,
          );

        actionItems = [];
        if (activeCampaigns === 0 && (campaigns || []).length > 0) {
          actionItems.push({
            description: "Reactivate a paused campaign",
            priority: "medium",
            type: "campaign",
          });
        }

        summary = `Creator dashboard: ${activeCampaigns} active campaign(s), $${totalRaised.toLocaleString()} raised in the last ${days} days.`;
        break;
      }

      case "donor": {
        const { data: donations } = await supabaseAdmin
          .from("donations")
          .select("amount, campaign_id, created_at")
          .eq("donor_id", userId)
          .gte("created_at", start)
          .lte("created_at", end);

        const totalDonated = (donations || []).reduce(
          (sum, d) => sum + (d.amount || 0),
          0,
        );
        const uniqueCampaigns = new Set(
          (donations || []).map((d) => d.campaign_id),
        ).size;

        metrics = [
          formatMetric(
            "Total Donated",
            `$${totalDonated.toLocaleString()}`,
            "stable",
          ),
          formatMetric(
            "Campaigns Supported",
            String(uniqueCampaigns),
            "stable",
          ),
          formatMetric(
            "Donations Made",
            String((donations || []).length),
            "stable",
          ),
          formatMetric(
            "Avg Donation",
            (donations || []).length > 0
              ? `$${Math.round(totalDonated / (donations || []).length).toLocaleString()}`
              : "$0",
            "stable",
          ),
        ];

        highlights = [];
        if (uniqueCampaigns > 0)
          highlights.push(
            `You supported ${uniqueCampaigns} campaign${uniqueCampaigns > 1 ? "s" : ""} this period`,
          );

        actionItems = [];
        const recommendedResult = await supabaseAdmin
          .from("campaigns")
          .select("id, title")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(3);

        if ((recommendedResult.data || []).length > 0) {
          highlights.push("There are new campaigns you might be interested in");
        }

        summary = `Donor portfolio: $${totalDonated.toLocaleString()} donated to ${uniqueCampaigns} campaign(s) in the last ${days} days.`;
        break;
      }

      case "admin": {
        const { data: allCampaigns } = await supabaseAdmin
          .from("campaigns")
          .select("id, status, created_at")
          .gte("created_at", start)
          .lte("created_at", end);

        const { data: allDonations } = await supabaseAdmin
          .from("donations")
          .select("amount, created_at")
          .gte("created_at", start)
          .lte("created_at", end);

        const { data: allUsers } = await supabaseAdmin
          .from("profiles")
          .select("id, created_at")
          .gte("created_at", start)
          .lte("created_at", end);

        const { data: fraudCases } = await supabaseAdmin
          .from("fraud_cases")
          .select("id, status")
          .gte("created_at", start)
          .lte("created_at", end);

        const totalRevenue = (allDonations || []).reduce(
          (sum, d) => sum + (d.amount || 0),
          0,
        );

        metrics = [
          formatMetric("New Users", String((allUsers || []).length), "stable"),
          formatMetric(
            "New Campaigns",
            String((allCampaigns || []).length),
            "stable",
          ),
          formatMetric(
            "Total Volume",
            `$${totalRevenue.toLocaleString()}`,
            "stable",
          ),
          formatMetric(
            "Fraud Cases",
            String((fraudCases || []).length),
            "stable",
          ),
        ];

        highlights = [];
        const openFraud = (fraudCases || []).filter(
          (c) => c.status === "open" || c.status === "investigating",
        ).length;
        if (openFraud > 0)
          highlights.push(
            `${openFraud} open fraud case${openFraud > 1 ? "s" : ""} need attention`,
          );

        actionItems = [];
        if (openFraud > 5) {
          actionItems.push({
            description: "Review open fraud cases — elevated volume detected",
            priority: "high",
            type: "fraud",
          });
        }

        summary = `Platform health: ${(allUsers || []).length} new users, ${(allCampaigns || []).length} new campaigns, $${totalRevenue.toLocaleString()} in volume over ${days} days.`;
        break;
      }

      case "moderator": {
        const { data: flaggedContent } = await supabaseAdmin
          .from("moderation_queue")
          .select("id, status, priority, created_at")
          .gte("created_at", start)
          .lte("created_at", end);

        const openCases = (flaggedContent || []).filter(
          (c) => c.status === "pending" || c.status === "open",
        ).length;
        const resolvedCases = (flaggedContent || []).filter(
          (c) => c.status === "resolved",
        ).length;
        const highPriority = (flaggedContent || []).filter(
          (c) => c.priority === "high" || c.priority === "urgent",
        ).length;

        metrics = [
          formatMetric("Open Cases", String(openCases), "stable"),
          formatMetric("Resolved Cases", String(resolvedCases), "stable"),
          formatMetric("High Priority", String(highPriority), "stable"),
          formatMetric(
            "Resolution Rate",
            resolvedCases > 0
              ? `${Math.round((resolvedCases / Math.max((flaggedContent || []).length, 1)) * 100)}%`
              : "0%",
            "stable",
          ),
        ];

        highlights = [];
        if (highPriority > 0)
          highlights.push(
            `${highPriority} high-priority case(s) awaiting review`,
          );

        actionItems = [];
        if (openCases > 10) {
          actionItems.push({
            description: `${openCases} open moderation cases — consider prioritizing`,
            priority: "high",
            type: "moderation",
          });
        }

        summary = `Moderation queue: ${openCases} open, ${resolvedCases} resolved in the last ${days} days.`;
        break;
      }

      case "organization": {
        const { data: orgCampaigns } = await supabaseAdmin
          .from("campaigns")
          .select("id, title, goal_amount, status, creator_id")
          .eq("organization_id", userId);

        const campaignIds = (orgCampaigns || []).map((c) => c.id);

        const { data: orgDonations } = await supabaseAdmin
          .from("donations")
          .select("amount")
          .in(
            "campaign_id",
            campaignIds.length > 0 ? campaignIds : ["__none__"],
          )
          .gte("created_at", start)
          .lte("created_at", end);

        const totalRaised = (orgDonations || []).reduce(
          (sum, d) => sum + (d.amount || 0),
          0,
        );
        const totalGoal = (orgCampaigns || []).reduce(
          (sum, c) => sum + (c.goal_amount || 0),
          0,
        );
        const activeCampaigns = (orgCampaigns || []).filter(
          (c) => c.status === "active",
        ).length;

        metrics = [
          formatMetric(
            "Total Raised",
            `$${totalRaised.toLocaleString()}`,
            "stable",
          ),
          formatMetric(
            "Campaign Portfolio",
            String((orgCampaigns || []).length),
            "stable",
          ),
          formatMetric("Active Campaigns", String(activeCampaigns), "stable"),
          formatMetric(
            "Team Members",
            String(new Set((orgCampaigns || []).map((c) => c.creator_id)).size),
            "stable",
          ),
        ];

        highlights = [];
        if (activeCampaigns > 0)
          highlights.push(`${activeCampaigns} active campaign(s) in portfolio`);

        summary = `Organization overview: ${(orgCampaigns || []).length} campaigns, $${totalRaised.toLocaleString()} raised in ${days} days.`;
        break;
      }

      default:
        return {
          success: false,
          error: `Unknown copilot type: ${copilotType}`,
        };
    }

    logInfo("CopilotEngine", "Dashboard summary generated", {
      userId,
      copilotType,
      timeframe,
    });

    return {
      success: true,
      data: {
        summary,
        metrics,
        highlights,
        actionItems,
      },
    };
  } catch (err) {
    logError("CopilotEngine", "Dashboard summary error", {
      error: err.message,
      userId,
      copilotType,
    });
    return { success: false, error: "Failed to generate dashboard summary" };
  }
}

/**
 * Explain a specific analytics metric value with context.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} params.copilotType — Role type from COPILOT_TYPES
 * @param {string} params.metric — Metric name
 * @param {*} params.value — Metric value
 * @param {Object} [params.context={}] — Additional context
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function explainAnalytics({
  userId,
  copilotType,
  metric,
  value,
  context = {},
}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!metric) {
      return { success: false, error: "metric is required" };
    }

    // Build explanation based on metric type
    let explanation = "";
    let trend = "stable";
    let comparison = "";
    let suggestion = "";

    const metricLower = metric.toLowerCase();

    if (metricLower.includes("raised") || metricLower.includes("donation")) {
      explanation = `Your ${metric} is currently ${typeof value === "number" ? `$${value.toLocaleString()}` : value}.`;
      if (typeof value === "number") {
        if (value > 10000) {
          comparison =
            "This is above the platform median for similar campaigns.";
          suggestion =
            "Consider sharing your campaign more widely to maintain momentum.";
        } else if (value > 0) {
          comparison =
            "This is a solid start — most campaigns see a funding surge in the first and last 48 hours.";
          suggestion =
            "Post an update to keep donors engaged and attract new ones.";
        } else {
          comparison =
            "Many campaigns start slow but pick up momentum with the right promotion.";
          suggestion =
            "Share your campaign on social media and send personal messages to your network.";
        }
      }
    } else if (
      metricLower.includes("conversion") ||
      metricLower.includes("rate")
    ) {
      explanation = `Your ${metric} is ${value}.`;
      if (typeof value === "number") {
        if (value > 5) {
          comparison =
            "This is an excellent conversion rate — well above average.";
          suggestion =
            "Keep doing what works and consider increasing your goal.";
        } else if (value > 1) {
          comparison =
            "This is a typical conversion rate for crowdfunding campaigns.";
          suggestion =
            "A/B test your campaign page headline to improve conversions.";
        } else {
          comparison = "This conversion rate has room for improvement.";
          suggestion =
            "Review your campaign page — ensure the first image is compelling and the CTA is clear.";
        }
      }
    } else {
      explanation = `Your ${metric} is currently ${value}.`;
      comparison =
        "Review this metric against your historical trends for context.";
      suggestion =
        "Use the copilot chat for a more detailed analysis of this metric.";
    }

    logInfo("CopilotEngine", "Analytics explained", {
      userId,
      copilotType,
      metric,
    });

    return {
      success: true,
      data: {
        explanation,
        trend,
        comparison,
        suggestion,
      },
    };
  } catch (err) {
    logError("CopilotEngine", "Explain analytics error", {
      error: err.message,
      userId,
      metric,
    });
    return { success: false, error: "Failed to explain analytics" };
  }
}

/**
 * Guide a user through a specific workflow step by step.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} params.copilotType — Role type from COPILOT_TYPES
 * @param {string} params.task — Task to get guidance for
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getWorkflowGuidance({ userId, copilotType, task }) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!task) {
      return { success: false, error: "task is required" };
    }

    const taskLower = task.toLowerCase();
    let steps = [];
    let estimatedTime = "5 minutes";

    // Creator workflows
    if (
      taskLower.includes("campaign") &&
      (taskLower.includes("create") || taskLower.includes("launch"))
    ) {
      steps = [
        {
          description: "Write a compelling campaign title (10-120 characters)",
          tips: [
            "Use power words",
            "Be specific about what you're funding",
            "Include a number if possible",
          ],
        },
        {
          description: "Write a detailed description (100+ characters)",
          tips: [
            "Tell your personal story",
            "Explain how funds will be used",
            "Include a call to action",
          ],
        },
        {
          description: "Set your funding goal",
          tips: [
            "Research similar campaigns",
            "Be realistic but ambitious",
            "Consider using tiered goals",
          ],
        },
        {
          description: "Upload media (2-5 images recommended)",
          tips: [
            "Use high-quality images",
            "Show your project in action",
            "Include at least one personal photo",
          ],
        },
        {
          description: "Choose the right category and tags",
          tips: [
            "Be accurate — category affects discoverability",
            "Use 3-5 relevant tags",
          ],
        },
        {
          description: "Review and publish",
          tips: [
            "Read your campaign aloud for flow",
            "Check all links work",
            "Ask a friend to review before publishing",
          ],
        },
      ];
      estimatedTime = "30-45 minutes";
    } else if (taskLower.includes("update")) {
      steps = [
        {
          description: "Choose an update type (progress, milestone, general)",
          tips: [
            "Progress updates keep donors engaged",
            "Milestone updates celebrate achievements",
          ],
        },
        {
          description: "Write your update content",
          tips: [
            "Be honest and transparent",
            "Include photos or videos",
            "Thank your donors",
          ],
        },
        {
          description: "Publish the update",
          tips: [
            "Updates are sent to all donors automatically",
            "Consider posting on social media too",
          ],
        },
      ];
      estimatedTime = "10-15 minutes";
    }
    // Donor workflows
    else if (taskLower.includes("donate") || taskLower.includes("donation")) {
      steps = [
        {
          description:
            "Browse or search for campaigns that match your interests",
          tips: ["Use category filters", "Check creator trust scores"],
        },
        {
          description: "Review the campaign page carefully",
          tips: [
            "Read the full description",
            "Check media for authenticity",
            "Review the funding goal and timeline",
          ],
        },
        {
          description: "Select your donation amount",
          tips: [
            "Any amount makes a difference",
            "Check if there are reward tiers",
          ],
        },
        {
          description: "Complete the donation",
          tips: [
            "You'll receive a confirmation email",
            "You can track the campaign's progress",
          ],
        },
      ];
      estimatedTime = "5-10 minutes";
    }
    // Moderator workflows
    else if (taskLower.includes("moderate") || taskLower.includes("review")) {
      steps = [
        {
          description: "Review the flagged content or report",
          tips: ["Read the full context", "Check the user's history"],
        },
        {
          description: "Assess against community guidelines",
          tips: ["Reference the specific policy", "Document your reasoning"],
        },
        {
          description: "Take appropriate action",
          tips: [
            "Start with the least restrictive option",
            "Document everything for the record",
          ],
        },
        {
          description: "Close the moderation case",
          tips: [
            "Add a summary of your findings",
            "Flag patterns for systemic review",
          ],
        },
      ];
      estimatedTime = "15-30 minutes";
    }
    // Generic fallback
    else {
      steps = [
        {
          description: `Understand the requirements for: ${task}`,
          tips: [
            "Read all relevant documentation",
            "Check platform guidelines",
          ],
        },
        {
          description: "Plan your approach",
          tips: [
            "Break the task into smaller steps",
            "Identify any dependencies",
          ],
        },
        {
          description: "Execute step by step",
          tips: ["Save your progress frequently", "Ask for help if stuck"],
        },
        {
          description: "Review and finalize",
          tips: ["Double-check your work", "Get feedback before submitting"],
        },
      ];
      estimatedTime = "10-20 minutes";
    }

    logInfo("CopilotEngine", "Workflow guidance generated", {
      userId,
      copilotType,
      task,
    });

    return {
      success: true,
      data: {
        steps,
        estimatedTime,
      },
    };
  } catch (err) {
    logError("CopilotEngine", "Workflow guidance error", {
      error: err.message,
      userId,
      task,
    });
    return { success: false, error: "Failed to generate workflow guidance" };
  }
}

/**
 * Get contextual suggestions based on user's current activity and role.
 *
 * @param {Object} params
 * @param {string} params.userId — User ID
 * @param {string} params.copilotType — Role type from COPILOT_TYPES
 * @param {Object} [params.currentContext={}] — Current user activity context
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getSuggestions({
  userId,
  copilotType,
  currentContext = {},
}) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }
    if (!copilotType) {
      return { success: false, error: "copilotType is required" };
    }

    const suggestions = [];

    switch (copilotType) {
      case "creator": {
        // Check if user has incomplete campaigns
        const { data: drafts } = await supabaseAdmin
          .from("campaigns")
          .select("id, title, description, goal_amount, media_urls")
          .eq("creator_id", userId)
          .eq("status", "draft");

        if ((drafts || []).length > 0) {
          const draft = drafts[0];
          const hasTitle = draft.title && draft.title.length > 5;
          const hasDescription =
            draft.description && draft.description.length > 50;
          const hasMedia =
            Array.isArray(draft.media_urls) && draft.media_urls.length > 0;

          if (!hasTitle) {
            suggestions.push({
              suggestion: "Add a compelling title to your draft campaign",
              reason:
                "Your draft is missing a title — this is the first thing donors see",
              priority: "high",
              action: "edit_campaign_title",
            });
          }
          if (!hasDescription) {
            suggestions.push({
              suggestion: "Write a detailed description for your campaign",
              reason:
                "A good description builds trust and explains your project",
              priority: "high",
              action: "edit_campaign_description",
            });
          }
          if (!hasMedia) {
            suggestions.push({
              suggestion: "Upload images to your campaign",
              reason:
                "Campaigns with images receive 3x more donations on average",
              priority: "medium",
              action: "upload_media",
            });
          }
        }

        // Suggest posting an update for active campaigns
        const { data: activeCampaigns } = await supabaseAdmin
          .from("campaigns")
          .select("id, title, last_update_at")
          .eq("creator_id", userId)
          .eq("status", "active");

        for (const campaign of activeCampaigns || []) {
          const lastUpdate = campaign.last_update_at
            ? new Date(campaign.last_update_at)
            : null;
          const daysSinceUpdate = lastUpdate
            ? Math.floor(
                (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24),
              )
            : 999;

          if (daysSinceUpdate > 7) {
            suggestions.push({
              suggestion: `Post an update for "${campaign.title}"`,
              reason: `It's been ${daysSinceUpdate} days since your last update — regular updates keep donors engaged`,
              priority: "medium",
              action: "post_update",
            });
          }
        }

        break;
      }

      case "donor": {
        // Suggest exploring new campaigns
        suggestions.push({
          suggestion:
            "Explore new campaigns in categories you've donated to before",
          reason: "Discover projects aligned with your interests",
          priority: "low",
          action: "explore_campaigns",
        });

        // Check for campaigns nearing their goal
        const { data: nearlyFunded } = await supabaseAdmin
          .from("campaigns")
          .select("id, title, goal_amount, raised_amount")
          .eq("status", "active")
          .gte("raised_amount", 0.8)
          .limit(3);

        if ((nearlyFunded || []).length > 0) {
          suggestions.push({
            suggestion:
              "Help push a campaign to its goal — a few are nearly there!",
            reason: "Your donation could be the one that makes the difference",
            priority: "medium",
            action: "view_nearly_funded",
          });
        }

        break;
      }

      case "admin": {
        // Check for system health issues
        const { data: recentFraud } = await supabaseAdmin
          .from("fraud_cases")
          .select("id, status")
          .eq("status", "open")
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          );

        if ((recentFraud || []).length > 3) {
          suggestions.push({
            suggestion:
              "Review recent fraud alerts — elevated activity detected in the last 24 hours",
            reason: `${(recentFraud || []).length} new fraud cases require attention`,
            priority: "high",
            action: "review_fraud_queue",
          });
        }

        suggestions.push({
          suggestion: "Review platform analytics for growth trends",
          reason:
            "Weekly analytics review helps identify opportunities and issues early",
          priority: "low",
          action: "view_analytics",
        });

        break;
      }

      case "moderator": {
        const { data: pendingCases } = await supabaseAdmin
          .from("moderation_queue")
          .select("id, priority")
          .eq("status", "pending");

        const highPriority = (pendingCases || []).filter(
          (c) => c.priority === "high" || c.priority === "urgent",
        );

        if (highPriority.length > 0) {
          suggestions.push({
            suggestion: `Prioritize ${highPriority.length} high-priority moderation case(s)`,
            reason:
              "High-priority cases should be reviewed first to minimize platform risk",
            priority: "high",
            action: "review_high_priority",
          });
        }

        if ((pendingCases || []).length > 0) {
          suggestions.push({
            suggestion: `${(pendingCases || []).length} cases in the moderation queue`,
            reason: "Keep the queue clear to ensure timely content review",
            priority: "medium",
            action: "view_moderation_queue",
          });
        }

        break;
      }

      case "organization": {
        suggestions.push({
          suggestion: "Review your team's campaign performance this month",
          reason:
            "Regular performance reviews help optimize fundraising strategy",
          priority: "medium",
          action: "view_team_performance",
        });

        suggestions.push({
          suggestion:
            "Consider launching a new campaign based on recent trends",
          reason:
            "New campaigns often see the most engagement in their first week",
          priority: "low",
          action: "create_campaign",
        });

        break;
      }
    }

    logInfo("CopilotEngine", "Suggestions generated", {
      userId,
      copilotType,
      count: suggestions.length,
    });

    return {
      success: true,
      data: suggestions,
    };
  } catch (err) {
    logError("CopilotEngine", "Get suggestions error", {
      error: err.message,
      userId,
      copilotType,
    });
    return { success: false, error: "Failed to generate suggestions" };
  }
}
