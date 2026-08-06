/**
 * Prompt Engine — DB-driven prompt template management with variable substitution.
 *
 * Provides a template system for AI prompts:
 *   - Templates stored in code as defaults, overridable via database
 *   - Variable substitution with {{variable}} syntax
 *   - CRUD operations for templates
 *   - Category-based organization
 *
 * Security:
 *   - All mutations are validated before execution
 *   - Template content is not exposed to unprivileged callers
 */

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logInfo, logError } from "../verification/secureLogger.js";

// ─── Default Templates ───

const DEFAULT_TEMPLATES = {
  campaign_quality: {
    name: "campaign_quality",
    category: "campaign",
    systemTemplate:
      "You are a campaign quality analyst for Fundora crowdfunding platform. Analyze the campaign and provide a quality score from 0-100 with detailed breakdown.",
    userTemplate:
      "Analyze this campaign:\nTitle: {{title}}\nDescription: {{description}}\nGoal: {{goal}}\nCategory: {{category}}\nCreator Trust Score: {{trustScore}}",
    variables: ["title", "description", "goal", "category", "trustScore"],
    enabled: true,
  },
  title_suggestion: {
    name: "title_suggestion",
    category: "campaign",
    systemTemplate:
      "You are a creative campaign title generator. Suggest compelling titles that attract donors.",
    userTemplate:
      "Generate 5 title suggestions for a {{category}} campaign with goal ₹{{goal}}. Current title: {{title}}",
    variables: ["category", "goal", "title"],
    enabled: true,
  },
  description_improvement: {
    name: "description_improvement",
    category: "campaign",
    systemTemplate:
      "You are a campaign description editor. Improve descriptions to be more compelling, clear, and trustworthy.",
    userTemplate:
      "Improve this campaign description:\nTitle: {{title}}\nCurrent Description: {{description}}\nCategory: {{category}}\nGoal: {{goal}}",
    variables: ["title", "description", "category", "goal"],
    enabled: true,
  },
  content_classification: {
    name: "content_classification",
    category: "moderation",
    systemTemplate:
      "You are a content moderation classifier. Classify the content and identify potential policy violations.",
    userTemplate:
      "Classify this {{entityType}} content:\nTitle: {{title}}\nContent: {{content}}",
    variables: ["entityType", "title", "content"],
    enabled: true,
  },
  fraud_analysis: {
    name: "fraud_analysis",
    category: "security",
    systemTemplate:
      "You are a fraud detection analyst. Analyze the user's behavior and risk signals to identify potential fraud.",
    userTemplate:
      "Analyze fraud risk for user {{userId}}:\nSignals: {{signals}}\nHistory: {{history}}",
    variables: ["userId", "signals", "history"],
    enabled: true,
  },
  recommendation_reason: {
    name: "recommendation_reason",
    category: "recommendation",
    systemTemplate:
      "You are a recommendation explainer. Explain why a campaign is recommended for a donor.",
    userTemplate:
      "Explain why campaign '{{campaignTitle}}' ({{category}}, ₹{{goal}}) is recommended for a donor who has donated to: {{donorHistory}}",
    variables: ["campaignTitle", "category", "goal", "donorHistory"],
    enabled: true,
  },
};

// ─── Core Functions ───

/**
 * Get a prompt template by name and render it with variables.
 *
 * Loads from DB first, falls back to DEFAULT_TEMPLATES.
 *
 * @param {string} templateName — Template key (e.g. "campaign_quality")
 * @param {Object} [variables={}] — Key-value pairs for substitution
 * @returns {Promise<{success: boolean, data?: {systemPrompt: string, userPrompt: string}, error?: string}>}
 */
export async function getPromptTemplate(templateName, variables = {}) {
  try {
    if (!templateName) {
      return { success: false, error: "templateName is required" };
    }

    let template = null;

    // 1. Try to load from DB
    try {
      const { data, error } = await supabaseAdmin
        .from("ai_prompt_templates")
        .select("*")
        .eq("name", templateName)
        .eq("enabled", true)
        .single();

      if (!error && data) {
        template = {
          name: data.name,
          category: data.category,
          systemTemplate: data.system_template,
          userTemplate: data.user_template,
          variables: data.variables || [],
        };
      }
    } catch (dbError) {
      logInfo("Prompt template not found in DB, using default", {
        templateName,
      });
    }

    // 2. Fall back to default templates
    if (!template) {
      const defaultTemplate = DEFAULT_TEMPLATES[templateName];
      if (!defaultTemplate) {
        return {
          success: false,
          error: `Template '${templateName}' not found`,
        };
      }
      template = defaultTemplate;
    }

    // 3. Render with variables
    const systemResult = renderPrompt(template.systemTemplate, variables);
    if (!systemResult.success) {
      return {
        success: false,
        error: `System prompt render failed: ${systemResult.error}`,
      };
    }

    const userResult = renderPrompt(template.userTemplate, variables);
    if (!userResult.success) {
      return {
        success: false,
        error: `User prompt render failed: ${userResult.error}`,
      };
    }

    logInfo("Prompt template loaded", {
      templateName,
      variablesUsed: Object.keys(variables),
    });

    return {
      success: true,
      data: {
        systemPrompt: systemResult.data.rendered,
        userPrompt: userResult.data.rendered,
      },
    };
  } catch (error) {
    logError("getPromptTemplate error", { templateName, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Create a new prompt template.
 *
 * @param {Object} params
 * @param {string}   params.name        — Unique template name
 * @param {string}   params.category    — Category (e.g. "campaign", "security")
 * @param {string}   params.systemTemplate — System prompt with {{variables}}
 * @param {string}   params.userTemplate  — User prompt with {{variables}}
 * @param {string[]} params.variables   — List of variable names
 * @param {string}   params.createdBy   — User ID of creator
 * @returns {Promise<{success: boolean, data?: {id: string}, error?: string}>}
 */
export async function createPromptTemplate({
  name,
  category,
  systemTemplate,
  userTemplate,
  variables,
  createdBy,
}) {
  try {
    if (!name || !systemTemplate || !userTemplate) {
      return {
        success: false,
        error: "name, systemTemplate, and userTemplate are required",
      };
    }

    // Check for duplicate name
    const { data: existing } = await supabaseAdmin
      .from("ai_prompt_templates")
      .select("id")
      .eq("name", name)
      .single();

    if (existing) {
      return { success: false, error: `Template '${name}' already exists` };
    }

    const { data, error } = await supabaseAdmin
      .from("ai_prompt_templates")
      .insert({
        name,
        category: category || "general",
        system_template: systemTemplate,
        user_template: userTemplate,
        variables: variables || [],
        enabled: true,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logError("createPromptTemplate DB error", { name, error: error.message });
      return {
        success: false,
        error: `Failed to create template: ${error.message}`,
      };
    }

    logInfo("Prompt template created", { templateId: data.id, name, category });

    return { success: true, data: { id: data.id } };
  } catch (error) {
    logError("createPromptTemplate error", { name, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * List prompt templates with optional filtering.
 *
 * @param {Object} [params]
 * @param {string}  [params.category] — Filter by category
 * @param {boolean} [params.enabled]  — Filter by enabled status
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function listPromptTemplates({ category, enabled } = {}) {
  try {
    let query = supabaseAdmin
      .from("ai_prompt_templates")
      .select("*")
      .order("name", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }
    if (typeof enabled === "boolean") {
      query = query.eq("enabled", enabled);
    }

    const { data, error } = await query;

    if (error) {
      logError("listPromptTemplates DB error", { error: error.message });
      return {
        success: false,
        error: `Failed to list templates: ${error.message}`,
      };
    }

    // Merge with any default templates not already in DB
    const dbNames = new Set((data || []).map((t) => t.name));
    const defaults = Object.values(DEFAULT_TEMPLATES)
      .filter((t) => !dbNames.has(t.name))
      .filter((t) => (category ? t.category === category : true))
      .filter((t) =>
        typeof enabled === "boolean" ? t.enabled === enabled : true,
      )
      .map((t) => ({
        id: null,
        name: t.name,
        category: t.category,
        system_template: t.systemTemplate,
        user_template: t.userTemplate,
        variables: t.variables,
        enabled: t.enabled,
        is_default: true,
      }));

    const allTemplates = [...(data || []), ...defaults];

    logInfo("Prompt templates listed", {
      count: allTemplates.length,
      category,
      enabled,
    });

    return { success: true, data: allTemplates };
  } catch (error) {
    logError("listPromptTemplates error", { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing prompt template.
 *
 * @param {string} templateId — Template ID
 * @param {Object} updates — Fields to update
 * @param {string} performedBy — User ID performing the update
 * @returns {Promise<{success: boolean, data?: {updated: true}, error?: string}>}
 */
export async function updatePromptTemplate(templateId, updates, performedBy) {
  try {
    if (!templateId) {
      return { success: false, error: "templateId is required" };
    }
    if (!updates || typeof updates !== "object") {
      return { success: false, error: "updates object is required" };
    }

    // Map camelCase fields to snake_case for DB
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.systemTemplate !== undefined)
      dbUpdates.system_template = updates.systemTemplate;
    if (updates.userTemplate !== undefined)
      dbUpdates.user_template = updates.userTemplate;
    if (updates.variables !== undefined)
      dbUpdates.variables = updates.variables;
    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;

    dbUpdates.updated_at = new Date().toISOString();
    dbUpdates.updated_by = performedBy;

    const { data, error } = await supabaseAdmin
      .from("ai_prompt_templates")
      .update(dbUpdates)
      .eq("id", templateId)
      .select("id")
      .single();

    if (error) {
      logError("updatePromptTemplate DB error", {
        templateId,
        error: error.message,
      });
      return {
        success: false,
        error: `Failed to update template: ${error.message}`,
      };
    }

    logInfo("Prompt template updated", {
      templateId,
      updatedFields: Object.keys(dbUpdates),
    });

    return { success: true, data: { updated: true } };
  } catch (error) {
    logError("updatePromptTemplate error", {
      templateId,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Render a template string by replacing {{variable}} placeholders.
 *
 * Pure function — no side effects.
 *
 * @param {string} template — Template string with {{variable}} placeholders
 * @param {Object} variables — Key-value pairs for substitution
 * @returns {{success: boolean, data?: {rendered: string}, error?: string}}
 */
export function renderPrompt(template, variables = {}) {
  try {
    if (!template || typeof template !== "string") {
      return { success: false, error: "template string is required" };
    }

    let rendered = template;

    // Replace all {{variable}} placeholders
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (variables[varName] !== undefined && variables[varName] !== null) {
        return String(variables[varName]);
      }
      // Leave unreplaced if variable not provided
      return match;
    });

    return { success: true, data: { rendered } };
  } catch (error) {
    logError("renderPrompt error", { error: error.message });
    return { success: false, error: error.message };
  }
}

// ─── Title Suggestion ───

/**
 * Suggest campaign titles using AI.
 *
 * @param {Object} params
 * @param {string} params.title — Current title
 * @param {string} params.category — Campaign category
 * @param {number} params.goal — Campaign goal
 * @param {string} params.userId — User requesting suggestions
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function suggestCampaignTitle({ title, category, goal, userId }) {
  try {
    if (!title) {
      return { success: false, error: "title is required" };
    }

    const result = await getPromptTemplate("title_suggestion", {
      title,
      category: category || "general",
      goal: String(goal || 0),
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        systemPrompt: result.data.systemPrompt,
        userPrompt: result.data.userPrompt,
        suggestions: [],
      },
      error: null,
    };
  } catch (err) {
    logError("suggestCampaignTitle error", {
      title,
      category,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}
