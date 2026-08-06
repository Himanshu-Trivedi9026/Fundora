// Plugin Sandbox — runtime isolation for plugin execution
// Provides a safe execution context with permission enforcement

import { checkPluginPermission } from "./pluginPermissions.js";

class PluginSandbox {
  constructor(pluginId, manifest, options = {}) {
    this.pluginId = pluginId;
    this.manifest = manifest;
    this.permissions = manifest.permissions || [];
    this.timeout = options.timeout || 30000;
    this.maxMemoryMB = options.maxMemoryMB || 64;
    this.allowedAPIs = this._buildAllowedAPIs();
  }

  _buildAllowedAPIs() {
    const apis = {};

    if (this._hasPermission("storage:read")) {
      apis.storageRead = true;
    }
    if (this._hasPermission("storage:write")) {
      apis.storageWrite = true;
    }
    if (this._hasPermission("database:read")) {
      apis.databaseRead = true;
    }
    if (this._hasPermission("api:call")) {
      apis.apiCall = true;
    }
    if (this._hasPermission("notification:send")) {
      apis.notificationSend = true;
    }
    if (this._hasPermission("ui:inject")) {
      apis.uiInject = true;
    }

    return apis;
  }

  _hasPermission(permission) {
    return checkPluginPermission(this.permissions, permission).allowed;
  }

  checkAccess(permission) {
    const result = checkPluginPermission(this.permissions, permission);
    if (!result.allowed) {
      return {
        allowed: false,
        error: `Plugin '${this.pluginId}' denied: ${result.reason}`,
      };
    }
    return { allowed: true };
  }

  createContext(req = {}) {
    return {
      pluginId: this.pluginId,
      manifest: { ...this.manifest },
      permissions: [...this.permissions],
      allowedAPIs: { ...this.allowedAPIs },
      request: req,
      sandbox: {
        timeout: this.timeout,
        maxMemoryMB: this.maxMemoryMB,
      },
    };
  }

  async execute(fn, context) {
    const accessCheck = this.checkAccess("api:call");
    if (!accessCheck.allowed) {
      return { success: false, error: accessCheck.error };
    }

    try {
      const result = await Promise.race([
        fn(context),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Plugin execution timeout")),
            this.timeout,
          ),
        ),
      ]);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  validateHookExecution(hookName) {
    const hooks = this.manifest.hooks || {};
    if (!hooks[hookName]) {
      return {
        allowed: false,
        reason: `Hook '${hookName}' not implemented by plugin`,
      };
    }
    return { allowed: true };
  }

  getRestrictedGlobals() {
    return [
      "process",
      "require",
      "module",
      "__dirname",
      "__filename",
      "global",
      "globalThis",
      "Buffer",
      "setImmediate",
    ];
  }
}

export function createSandbox(pluginId, manifest, options) {
  return new PluginSandbox(pluginId, manifest, options);
}

export { PluginSandbox };
