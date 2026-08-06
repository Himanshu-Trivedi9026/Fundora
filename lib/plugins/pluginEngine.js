// Plugin Engine — main orchestrator for the plugin system
// Integrates: registry, loader, sandbox, permissions, lifecycle

import { getPluginRegistry, initializePluginRegistry } from "./pluginRegistry.js";
import { createPluginLoader } from "./pluginLoader.js";
import { createSandbox } from "./pluginSandbox.js";
import { validateManifest } from "./pluginManifest.js";
import {
  installPlugin,
  uninstallPlugin,
  updatePluginStatus,
  canTransition,
  PLUGIN_STATUSES,
} from "./pluginLifecycle.js";
import { logAuditEvent } from "../verification/auditLog.js";

class PluginEngine {
  constructor(options = {}) {
    this.registry = getPluginRegistry();
    this.loader = createPluginLoader(options);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return { success: true };
    await initializePluginRegistry();
    this.initialized = true;
    return { success: true };
  }

  async registerFromDb(pluginRecord) {
    const result = await this.loader.loadFromDb(pluginRecord);
    if (!result.success) return result;

    const plugin = result.data;
    return this.registry.registerPlugin(pluginRecord.id, plugin);
  }

  async registerFromManifest(raw) {
    const result = await this.loader.loadFromManifest(raw);
    if (!result.success) return result;

    const plugin = result.data;
    return this.registry.registerPlugin(plugin.id, plugin);
  }

  async install(pluginId, userId, options) {
    return installPlugin(pluginId, userId, options);
  }

  async uninstall(pluginId, userId) {
    return uninstallPlugin(pluginId, userId);
  }

  async executeHook(pluginId, hookName, context) {
    return this.loader.executeHook(pluginId, hookName, context);
  }

  executeInSandbox(pluginId, fn, context) {
    const plugin = this.registry.getPlugin(pluginId);
    if (!plugin) {
      return { success: false, error: "Plugin not found" };
    }
    const sandbox = createSandbox(pluginId, plugin.manifest);
    return sandbox.execute(fn, sandbox.createContext(context));
  }

  listInstalled(filter) {
    return this.registry.listPlugins(filter);
  }

  getPlugin(pluginId) {
    return this.registry.getPlugin(pluginId);
  }

  hasPermission(pluginId, permission) {
    return this.registry.hasPermission(pluginId, permission);
  }

  async changeStatus(pluginId, newStatus, performedBy) {
    return updatePluginStatus(pluginId, newStatus, performedBy);
  }

  isInitialized() {
    return this.initialized;
  }

  getPluginCount() {
    return this.registry.count();
  }
}

// Singleton
let _instance = null;

export function getPluginEngine(options) {
  if (!_instance) {
    _instance = new PluginEngine(options);
  }
  return _instance;
}

export { PluginEngine, PLUGIN_STATUSES };
