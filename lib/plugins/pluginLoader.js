// Plugin Loader — loads plugins from filesystem or database
// Supports internal, external, and marketplace plugins

import { validateManifest } from "./pluginManifest.js";
import { getPluginRegistry } from "./pluginRegistry.js";
import { createSandbox } from "./pluginSandbox.js";

class PluginLoader {
  constructor(options = {}) {
    this.basePath = options.basePath || "./plugins";
    this.allowExternal = options.allowExternal || false;
  }

  async loadFromDb(pluginRecord) {
    if (!pluginRecord || !pluginRecord.id) {
      return { success: false, error: "Invalid plugin record" };
    }

    const manifestResult = validateManifest(pluginRecord.manifest || {});
    if (!manifestResult.success) {
      return { success: false, error: `Invalid manifest for '${pluginRecord.name}': ${manifestResult.error}` };
    }

    const pluginInstance = {
      id: pluginRecord.id,
      name: pluginRecord.name,
      slug: pluginRecord.slug,
      manifest: manifestResult.data,
      enabled: pluginRecord.is_enabled !== false,
      status: pluginRecord.status,
      version: pluginRecord.version,
      config: pluginRecord.config_schema || {},
      metadata: {
        authorId: pluginRecord.author_id,
        organizationId: pluginRecord.organization_id,
        pluginType: pluginRecord.plugin_type,
        isSigned: pluginRecord.is_signed || false,
        isVerified: pluginRecord.is_verified || false,
        checksum: pluginRecord.checksum,
      },
      hooks: {},
    };

    return { success: true, data: pluginInstance };
  }

  async loadFromManifest(raw) {
    const manifestResult = validateManifest(raw);
    if (!manifestResult.success) {
      return { success: false, error: manifestResult.error };
    }

    const pluginId = `plugin_${manifestResult.data.name}_${manifestResult.data.version}`.replace(/[^a-zA-Z0-9_]/g, "_");

    const pluginInstance = {
      id: pluginId,
      name: manifestResult.data.name,
      slug: manifestResult.data.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      manifest: manifestResult.data,
      enabled: true,
      status: "loaded",
      version: manifestResult.data.version,
      config: manifestResult.data.configSchema || {},
      metadata: {
        author: manifestResult.data.author,
        license: manifestResult.data.license,
        pluginType: "internal",
        isSigned: false,
        isVerified: false,
      },
      hooks: {},
    };

    return { success: true, data: pluginInstance };
  }

  async registerHook(pluginId, hookName, handler) {
    const registry = getPluginRegistry();
    const plugin = registry.getPlugin(pluginId);

    if (!plugin) {
      return { success: false, error: `Plugin '${pluginId}' not registered` };
    }

    if (!plugin.instance.hooks) {
      plugin.instance.hooks = {};
    }

    plugin.instance.hooks[hookName] = handler;
    return { success: true };
  }

  async executeHook(pluginId, hookName, context = {}) {
    const registry = getPluginRegistry();
    const plugin = registry.getPlugin(pluginId);

    if (!plugin) {
      return { success: false, error: `Plugin '${pluginId}' not found` };
    }

    const handler = plugin.instance.hooks?.[hookName];
    if (!handler) {
      return { success: false, error: `Hook '${hookName}' not registered for '${pluginId}'` };
    }

    const sandbox = createSandbox(pluginId, plugin.manifest);
    return sandbox.execute(handler, { ...context, pluginId });
  }

  async unloadPlugin(pluginId) {
    const registry = getPluginRegistry();
    const plugin = registry.getPlugin(pluginId);

    if (!plugin) {
      return { success: false, error: `Plugin '${pluginId}' not found` };
    }

    plugin.instance.hooks = {};
    plugin.status = "unloaded";

    return { success: true };
  }
}

export function createPluginLoader(options) {
    return new PluginLoader(options);
}

export { PluginLoader };
