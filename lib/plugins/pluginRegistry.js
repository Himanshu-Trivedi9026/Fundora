// Plugin Registry — singleton registry for plugin management
// Follows the provider registry pattern from lib/ai/providerRegistry.js

import { validateManifest } from "./pluginManifest.js";
import {
  checkPluginPermission,
  PLUGIN_PERMISSIONS,
} from "./pluginPermissions.js";

class PluginRegistry {
  constructor() {
    this._plugins = new Map();
    this._initialized = false;
  }

  async initialize() {
    this._initialized = true;
    return { success: true };
  }

  registerPlugin(pluginId, pluginInstance) {
    if (!pluginId || !pluginInstance) {
      return {
        success: false,
        error: "pluginId and pluginInstance are required",
      };
    }

    if (this._plugins.has(pluginId)) {
      return {
        success: false,
        error: `Plugin '${pluginId}' is already registered`,
      };
    }

    const manifestValidation = validateManifest(pluginInstance.manifest || {});
    if (!manifestValidation.success) {
      return {
        success: false,
        error: `Invalid manifest: ${manifestValidation.error}`,
      };
    }

    this._plugins.set(pluginId, {
      id: pluginId,
      instance: pluginInstance,
      manifest: manifestValidation.data,
      status: "registered",
      registeredAt: new Date().toISOString(),
    });

    return {
      success: true,
      data: { id: pluginId, manifest: manifestValidation.data },
    };
  }

  unregisterPlugin(pluginId) {
    if (!this._plugins.has(pluginId)) {
      return { success: false, error: `Plugin '${pluginId}' not found` };
    }
    this._plugins.delete(pluginId);
    return { success: true };
  }

  getPlugin(pluginId) {
    return this._plugins.get(pluginId) || null;
  }

  listPlugins(filter = {}) {
    let results = Array.from(this._plugins.values());

    if (filter.status) {
      results = results.filter((p) => p.status === filter.status);
    }
    if (filter.enabled !== undefined) {
      results = results.filter((p) => p.instance.enabled === filter.enabled);
    }

    return results;
  }

  hasPermission(pluginId, permission) {
    const plugin = this._plugins.get(pluginId);
    if (!plugin) return { allowed: false, reason: "Plugin not found" };
    return checkPluginPermission(plugin.manifest.permissions, permission);
  }

  count() {
    return this._plugins.size;
  }

  isInitialized() {
    return this._initialized;
  }
}

// Singleton instance
const globalRegistry = new PluginRegistry();

export function getPluginRegistry() {
  return globalRegistry;
}

export function registerPlugin(pluginId, pluginInstance) {
  return globalRegistry.registerPlugin(pluginId, pluginInstance);
}

export function unregisterPlugin(pluginId) {
  return globalRegistry.unregisterPlugin(pluginId);
}

export function getPlugin(pluginId) {
  return globalRegistry.getPlugin(pluginId);
}

export function listPlugins(filter) {
  return globalRegistry.listPlugins(filter);
}

export function initializePluginRegistry() {
  return globalRegistry.initialize();
}

export { PluginRegistry, PLUGIN_PERMISSIONS };
