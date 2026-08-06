// MCP Server — Model Context Protocol server for Fundora
// Provides AI agents with structured tool access to platform capabilities

import { supabaseAdmin } from "../supabaseAdmin.js";

// ——————————————————————————————————————
// Tool Definitions
// ——————————————————————————————————————

const TOOLS = {};

export function registerTool(name, definition) {
  TOOLS[name] = definition;
}

export function getTool(name) {
  return TOOLS[name] || null;
}

export function listTools() {
  return Object.entries(TOOLS).map(([name, def]) => ({
    name,
    description: def.description,
    inputSchema: def.inputSchema,
    requiresAuth: def.requiresAuth !== false,
    rbac: def.rbac || null,
  }));
}

export async function executeTool(name, args, context = {}) {
  try {
    const tool = TOOLS[name];
    if (!tool) return { success: false, error: `Unknown tool: ${name}` };

    // RBAC check
    if (tool.rbac && context.user) {
      const hasAccess = await checkRBACAccess(tool.rbac, context.user);
      if (!hasAccess) {
        return { success: false, error: "Access denied: insufficient permissions" };
      }
    }

    return await tool.handler(args, context);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * RBAC gate for MCP tools. Loads the caller's platform role from
 * public.profiles.role (single source of truth) and requires it to be in the
 * tool's allowed role set. Deny-by-default when the profile is missing.
 */
async function checkRBACAccess(rbac, user) {
  if (!rbac?.roles || !user?.id) return false;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role;
  if (!role) return false;

  return rbac.roles.includes(role);
}

// ——————————————————————————————————————
// Campaign Tools
// ——————————————————————————————————————

registerTool("campaign_search", {
  description: "Search campaigns by query, status, category, or date range",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      status: { type: "string", enum: ["active", "draft", "completed", "cancelled"] },
      category: { type: "string" },
      limit: { type: "number", default: 10 },
    },
  },
  handler: async (args) => {
    let query = supabaseAdmin.from("campaigns").select("*", { count: "exact" });
    if (args.query) query = query.or(`title.ilike.%${args.query}%,description.ilike.%${args.query}%`);
    if (args.status) query = query.eq("status", args.status);
    if (args.category) query = query.eq("category", args.category);
    query = query.order("created_at", { ascending: false }).limit(args.limit || 10);
    const { data, count } = await query;
    return { success: true, data: { campaigns: data || [], total: count || 0 } };
  },
});

registerTool("campaign_stats", {
  description: "Get campaign statistics including funding progress, donor count, and timeline",
  rbac: { roles: ["creator", "platform_admin"] },
  inputSchema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "Campaign ID" },
    },
    required: ["campaignId"],
  },
  handler: async (args) => {
    const { data } = await supabaseAdmin
      .from("campaigns")
      .select("*, projects(*)")
      .eq("id", args.campaignId)
      .single();
    return { success: true, data: data || null };
  },
});

// ——————————————————————————————————————
// Donation Tools
// ——————————————————————————————————————

registerTool("donation_summary", {
  description: "Get donation summary for a campaign or user",
  rbac: { roles: ["creator", "platform_admin"] },
  inputSchema: {
    type: "object",
    properties: {
      campaignId: { type: "string" },
      userId: { type: "string" },
      period: { type: "string", enum: ["day", "week", "month", "year"] },
    },
  },
  handler: async (args) => {
    let query = supabaseAdmin.from("escrow_transactions").select("*");
    if (args.campaignId) query = query.eq("campaign_id", args.campaignId);
    if (args.userId) query = query.eq("donor_id", args.userId);
    const { data } = await query.order("created_at", { ascending: false }).limit(100);
    return { success: true, data: { donations: data || [], count: data?.length || 0 } };
  },
});

// ——————————————————————————————————————
// Escrow Tools
// ——————————————————————————————————————

registerTool("escrow_status", {
  description: "Get escrow status and transaction details",
  rbac: { roles: ["creator", "platform_admin"] },
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      transactionId: { type: "string" },
    },
  },
  handler: async (args) => {
    if (args.transactionId) {
      const { data } = await supabaseAdmin
        .from("escrow_transactions")
        .select("*")
        .eq("id", args.transactionId)
        .single();
      return { success: true, data };
    }
    const { data } = await supabaseAdmin
      .from("escrow_transactions")
      .select("*")
      .eq("project_id", args.projectId)
      .order("created_at", { ascending: false });
    return { success: true, data: data || [] };
  },
});

// ——————————————————————————————————————
// Fraud Tools
// ——————————————————————————————————————

registerTool("fraud_flags", {
  description: "Get fraud flags and risk assessments for a campaign or user",
  rbac: { roles: ["platform_admin"] },
  inputSchema: {
    type: "object",
    properties: {
      targetId: { type: "string" },
      targetType: { type: "string", enum: ["campaign", "user", "transaction"] },
    },
    required: ["targetId"],
  },
  handler: async (args) => {
    const { data } = await supabaseAdmin
      .from("fraud_flags")
      .select("*")
      .eq("target_id", args.targetId)
      .order("created_at", { ascending: false });
    return { success: true, data: data || [] };
  },
});

// ——————————————————————————————————————
// Analytics Tools
// ——————————————————————————————————————

registerTool("platform_metrics", {
  description: "Get platform-wide metrics and analytics",
  rbac: { roles: ["platform_admin"] },
  inputSchema: {
    type: "object",
    properties: {
      metric: { type: "string", description: "Metric name" },
      period: { type: "string", enum: ["24h", "7d", "30d", "all"] },
    },
  },
  handler: async (args) => {
    const since = args.period === "24h" ? new Date(Date.now() - 86400000).toISOString()
      : args.period === "7d" ? new Date(Date.now() - 7 * 86400000).toISOString()
      : args.period === "30d" ? new Date(Date.now() - 30 * 86400000).toISOString()
      : null;

    let query = supabaseAdmin.from("metrics").select("metric_name, value, recorded_at");
    if (args.metric) query = query.eq("metric_name", args.metric);
    if (since) query = query.gte("recorded_at", since);
    query = query.order("recorded_at", { ascending: false }).limit(100);

    const { data } = await query;
    return { success: true, data: data || [] };
  },
});

// ——————————————————————————————————————
// Organization Tools
// ——————————————————————————————————————

registerTool("org_info", {
  description: "Get organization details and settings",
  rbac: { roles: ["creator", "platform_admin"] },
  inputSchema: {
    type: "object",
    properties: {
      organizationId: { type: "string" },
    },
    required: ["organizationId"],
  },
  handler: async (args) => {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", args.organizationId)
      .single();
    return { success: true, data: data || null };
  },
});

// ——————————————————————————————————————
// Knowledge Tools
// ——————————————————————————————————————

registerTool("knowledge_search", {
  description: "Search knowledge base articles",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      category: { type: "string" },
      limit: { type: "number", default: 5 },
    },
    required: ["query"],
  },
  handler: async (args) => {
    const { data } = await supabaseAdmin
      .from("knowledge_articles")
      .select("*")
      .or(`title.ilike.%${args.query}%,content.ilike.%${args.query}%`)
      .limit(args.limit || 5);
    return { success: true, data: data || [] };
  },
});

// ——————————————————————————————————————
// Plugin Tools
// ——————————————————————————————————————

registerTool("plugin_list", {
  description: "List available plugins from the marketplace",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string" },
      status: { type: "string", default: "published" },
      limit: { type: "number", default: 10 },
    },
  },
  handler: async (args) => {
    let query = supabaseAdmin.from("plugins").select("*");
    if (args.category) query = query.eq("category", args.category);
    if (args.status) query = query.eq("status", args.status);
    query = query.order("download_count", { ascending: false }).limit(args.limit || 10);
    const { data } = await query;
    return { success: true, data: data || [] };
  },
});

// ——————————————————————————————————————
// Context Builder
// ——————————————————————————————————————

export function buildContext(user, organizationId) {
  return {
    user: user ? { id: user.id, role: user.role, organizationId: user.organization_id } : null,
    organizationId,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  };
}

// ——————————————————————————————————————
// Meta
// ——————————————————————————————————————

export function getServerInfo() {
  return {
    name: "fundora-mcp-server",
    version: "1.0.0",
    protocol: "model-context-protocol",
    tools: Object.keys(TOOLS).length,
    toolsList: listTools(),
  };
}
