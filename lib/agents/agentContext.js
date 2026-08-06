// Agent Context — build rich context for agent execution
// Gathers platform data, user info, and relevant signals

import { supabaseAdmin } from "../supabaseAdmin.js";

export async function buildAgentContext(agentId, options = {}) {
  try {
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("*, organization_id")
      .eq("id", agentId)
      .single();

    if (!agent) return { success: false, error: "Agent not found" };

    const orgId = agent.organization_id;
    const context = {
      agent: { id: agent.id, name: agent.name, type: agent.agent_type },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    };

    // Fetch relevant platform data based on agent type
    switch (agent.agent_type) {
      case "creator":
        context.campaigns = await fetchRecentCampaigns(orgId);
        context.analytics = await fetchPlatformAnalytics(orgId);
        break;
      case "donor":
        context.campaigns = await fetchActiveCampaigns();
        context.trending = await fetchTrendingProjects();
        break;
      case "moderator":
        context.flagged = await fetchFlaggedContent();
        context.recentReports = await fetchRecentReports();
        break;
      case "compliance":
        context.pendingReviews = await fetchPendingComplianceReviews(orgId);
        context.recentVerifications = await fetchRecentVerifications();
        break;
      case "finance":
        context.recentTransactions = await fetchRecentTransactions(orgId);
        context.alerts = await fetchActiveAlerts();
        break;
      case "organization":
        context.orgSettings = await fetchOrgSettings(orgId);
        context.members = await fetchOrgMembers(orgId);
        break;
      case "plugin":
        context.marketplace = await fetchMarketplacePlugins();
        break;
    }

    return { success: true, data: context };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// — Helper data fetchers —

async function fetchRecentCampaigns(orgId) {
  const { data } = await supabaseAdmin
    .from("campaigns")
    .select("id, title, status, funding_goal, raised_amount")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);
  return data || [];
}

async function fetchActiveCampaigns() {
  const { data } = await supabaseAdmin
    .from("campaigns")
    .select("id, title, status, funding_goal, raised_amount")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);
  return data || [];
}

async function fetchTrendingProjects() {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("id, title, funding_goal, raised_amount")
    .order("raised_amount", { ascending: false })
    .limit(10);
  return data || [];
}

async function fetchPlatformAnalytics(orgId) {
  const { data } = await supabaseAdmin
    .from("metrics")
    .select("metric_name, value")
    .gte("recorded_at", new Date(Date.now() - 86400000).toISOString())
    .limit(100);
  return data || [];
}

async function fetchFlaggedContent() {
  const { data } = await supabaseAdmin
    .from("projects")
    .select("id, title, status")
    .eq("status", "flagged")
    .limit(20);
  return data || [];
}

async function fetchRecentReports() {
  return [];
}

async function fetchPendingComplianceReviews(orgId) {
  const { data } = await supabaseAdmin
    .from("verification_queue")
    .select("*")
    .eq("status", "pending")
    .limit(20);
  return data || [];
}

async function fetchRecentVerifications() {
  const { data } = await supabaseAdmin
    .from("verification_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  return data || [];
}

async function fetchRecentTransactions(orgId) {
  const { data } = await supabaseAdmin
    .from("escrow_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  return data || [];
}

async function fetchActiveAlerts() {
  const { data } = await supabaseAdmin
    .from("alerts")
    .select("*")
    .eq("status", "active")
    .limit(20);
  return data || [];
}

async function fetchOrgSettings(orgId) {
  const { data } = await supabaseAdmin
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();
  return data || {};
}

async function fetchOrgMembers(orgId) {
  const { data } = await supabaseAdmin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId);
  return data || [];
}

async function fetchMarketplacePlugins() {
  const { data } = await supabaseAdmin
    .from("plugins")
    .select("id, name, description, category")
    .eq("status", "published")
    .limit(20);
  return data || [];
}
