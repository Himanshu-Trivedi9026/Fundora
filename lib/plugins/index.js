// Plugin Platform — barrel exports
// Phase 10: Global Platform, Marketplace & Production Scale

export { PluginEngine, getPluginEngine, PLUGIN_STATUSES } from "./pluginEngine.js";
export { PluginRegistry, getPluginRegistry, registerPlugin, unregisterPlugin, getPlugin, listPlugins, initializePluginRegistry } from "./pluginRegistry.js";
export { PluginLoader, createPluginLoader } from "./pluginLoader.js";
export { validateManifest, parseManifest, createManifest } from "./pluginManifest.js";
export { PluginSandbox, createSandbox } from "./pluginSandbox.js";
export { checkPluginPermission, checkAllPermissions, getPermissionRiskLevel, getHighestRiskLevel, requiresApproval } from "./pluginPermissions.js";
export { installPlugin, uninstallPlugin, updatePluginStatus, enablePlugin, disablePlugin, canTransition } from "./pluginLifecycle.js";
export { PLUGIN_PERMISSIONS } from "./pluginPermissions.js";
