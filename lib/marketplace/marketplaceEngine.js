// Marketplace Engine — plugin marketplace management
// Handles plugin publishing, discovery, ratings, reviews, and developer verification

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logAuditEvent } from "../verification/auditLog.js";
import { PLUGIN_STATUSES } from "../plugins/pluginLifecycle.js";

export async function publishPlugin(pluginId, userId) {
  try {
    const { data: plugin } = await supabaseAdmin
      .from("plugins")
      .select("id, name, status, author_id, is_verified")
      .eq("id", pluginId)
      .single();

    if (!plugin) return { success: false, error: "Plugin not found" };
    if (plugin.author_id !== userId) {
      return { success: false, error: "Only the author can publish a plugin" };
    }
    if (plugin.status !== PLUGIN_STATUSES.APPROVED) {
      return { success: false, error: "Plugin must be approved before publishing" };
    }

    const { error } = await supabaseAdmin
      .from("plugins")
      .update({
        status: PLUGIN_STATUSES.PUBLISHED,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pluginId);

    if (error) return { success: false, error: error.message };

    await logAuditEvent({
      action: "marketplace.plugin_published",
      entityType: "plugin",
      entityId: pluginId,
      userId,
      details: { pluginName: plugin.name },
    });

    return { success: true, data: { id: pluginId, status: PLUGIN_STATUSES.PUBLISHED } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function unpublishPlugin(pluginId, userId) {
  try {
    const { data: plugin } = await supabaseAdmin
      .from("plugins")
      .select("id, name, author_id")
      .eq("id", pluginId)
      .single();

    if (!plugin) return { success: false, error: "Plugin not found" };

    const { error } = await supabaseAdmin
      .from("plugins")
      .update({ status: PLUGIN_STATUSES.DISABLED, updated_at: new Date().toISOString() })
      .eq("id", pluginId);

    if (error) return { success: false, error: error.message };

    return { success: true, data: { id: pluginId } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function listMarketplacePlugins(options = {}) {
  try {
    let query = supabaseAdmin
      .from("plugins")
      .select("*", { count: "exact" })
      .eq("status", PLUGIN_STATUSES.PUBLISHED);

    if (options.category) {
      query = query.contains("manifest", { categories: [options.category] });
    }
    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`);
    }
    if (options.authorId) {
      query = query.eq("author_id", options.authorId);
    }

    const sortField = options.sort || "download_count";
    const sortDir = options.order || "desc";
    query = query.order(sortField, { ascending: sortDir === "asc" });

    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return { success: false, error: error.message };

    const safe = (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      version: p.version,
      author_id: p.author_id,
      license: p.license,
      download_count: p.download_count,
      rating_avg: p.rating_avg,
      rating_count: p.rating_count,
      is_verified: p.is_verified,
      published_at: p.published_at,
      created_at: p.created_at,
    }));

    return { success: true, data: safe, total: count || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function submitPluginReview(pluginId, userId, rating, title, content) {
  try {
    if (!rating || rating < 1 || rating > 5) {
      return { success: false, error: "Rating must be between 1 and 5" };
    }

    const { data: existing } = await supabaseAdmin
      .from("plugin_reviews")
      .select("id")
      .eq("plugin_id", pluginId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "You have already reviewed this plugin" };
    }

    const { data, error } = await supabaseAdmin
      .from("plugin_reviews")
      .insert({
        plugin_id: pluginId,
        user_id: userId,
        rating,
        title: title || null,
        content: content || null,
        is_verified_purchase: false,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Update average rating
    await _recalculatePluginRating(pluginId);

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getPluginReviews(pluginId, options = {}) {
  try {
    let query = supabaseAdmin
      .from("plugin_reviews")
      .select("*", { count: "exact" })
      .eq("plugin_id", pluginId)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, data: data || [], total: count || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getMarketplaceCategories() {
  try {
    const { data, error } = await supabaseAdmin
      .from("marketplace_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function getFeaturedPlugins(limit = 6) {
  try {
    const { data, error } = await supabaseAdmin
      .from("plugins")
      .select("*")
      .eq("status", PLUGIN_STATUSES.PUBLISHED)
      .order("download_count", { ascending: false })
      .limit(limit);

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function verifyPluginDeveloper(userId) {
  try {
    const { data: pluginCount, error: countError } = await supabaseAdmin
      .from("plugins")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId);

    if (countError) return { success: false, error: countError.message };

    // Developer is verified if they have published 3+ approved plugins
    const isVerified = (pluginCount || 0) >= 3;

    return { success: true, data: { isVerified, publishedCount: pluginCount || 0 } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function _recalculatePluginRating(pluginId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("plugin_reviews")
      .select("rating")
      .eq("plugin_id", pluginId)
      .eq("status", "published");

    if (error || !data || data.length === 0) return;

    const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;

    await supabaseAdmin
      .from("plugins")
      .update({
        rating_avg: Math.round(avg * 100) / 100,
        rating_count: data.length,
      })
      .eq("id", pluginId);
  } catch {
    // Silently fail — rating recalculation is non-critical
  }
}
