// Plugin Manifest — schema validation and parsing for plugin manifests
// Follows the `{ success, data?, error? }` pattern used throughout Fundora

const MANIFEST_SCHEMA = {
  name: { type: "string", required: true, maxLength: 128 },
  version: { type: "string", required: true, pattern: /^\d+\.\d+\.\d+$/ },
  description: { type: "string", required: false, maxLength: 2000 },
  author: { type: "string", required: true, maxLength: 256 },
  license: { type: "string", required: false, default: "MIT" },
  entryPoint: { type: "string", required: false, default: "index.js" },
  permissions: { type: "array", required: false, default: [] },
  dependencies: { type: "array", required: false, default: [] },
  configSchema: { type: "object", required: false, default: {} },
  hooks: { type: "object", required: false, default: {} },
  ui: { type: "object", required: false, default: {} },
};

const PERMISSION_WHITELIST = [
  "storage:read", "storage:write", "storage:delete",
  "database:read", "database:write",
  "api:call", "api:receive_webhook",
  "notification:send", "notification:read",
  "ui:inject", "ui:modify",
  "user:read", "user:email",
  "payment:read", "payment:write",
  "campaign:read", "campaign:write",
  "admin:read", "admin:write",
];

const VALID_HOOKS = [
  "onActivate", "onDeactivate", "onInstall", "onUninstall",
  "onUpgrade", "onBeforeRequest", "onAfterResponse",
  "onCampaignCreate", "onDonationReceive",
  "onUserRegister", "onPageRender",
];

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return { success: false, error: "Manifest must be a non-null object" };
  }

  const errors = [];

  for (const [field, schema] of Object.entries(MANIFEST_SCHEMA)) {
    const value = manifest[field];

    if (value === undefined || value === null) {
      if (schema.required) {
        errors.push(`Missing required field: ${field}`);
      }
      continue;
    }

    if (schema.type === "array" && !Array.isArray(value)) {
      errors.push(`Field '${field}' must be an array`);
    } else if (schema.type === "object" && (typeof value !== "object" || Array.isArray(value))) {
      errors.push(`Field '${field}' must be an object`);
    } else if (typeof value !== schema.type && schema.type !== "array" && schema.type !== "object") {
      errors.push(`Field '${field}' must be of type ${schema.type}`);
    }

    if (schema.pattern && !schema.pattern.test(String(value))) {
      errors.push(`Field '${field}' does not match required pattern`);
    }

    if (schema.maxLength && String(value).length > schema.maxLength) {
      errors.push(`Field '${field}' exceeds maximum length of ${schema.maxLength}`);
    }
  }

  // Validate permissions
  if (Array.isArray(manifest.permissions)) {
    for (const perm of manifest.permissions) {
      if (!PERMISSION_WHITELIST.includes(perm)) {
        errors.push(`Unknown permission: '${perm}'. Allowed: ${PERMISSION_WHITELIST.join(", ")}`);
      }
    }
  }

  // Validate hooks
  if (manifest.hooks && typeof manifest.hooks === "object") {
    for (const hook of Object.keys(manifest.hooks)) {
      if (!VALID_HOOKS.includes(hook)) {
        errors.push(`Unknown hook: '${hook}'. Valid hooks: ${VALID_HOOKS.join(", ")}`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, error: errors.join("; ") };
  }

  return {
    success: true,
    data: {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description || "",
      author: manifest.author,
      license: manifest.license || "MIT",
      entryPoint: manifest.entryPoint || "index.js",
      permissions: [...new Set(manifest.permissions || [])],
      dependencies: manifest.dependencies || [],
      configSchema: manifest.configSchema || {},
      hooks: manifest.hooks || {},
      ui: manifest.ui || {},
    },
  };
}

export function parseManifest(raw) {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { success: false, error: "Invalid JSON in manifest" };
    }
  }
  return validateManifest(raw);
}

export function createManifest(options = {}) {
  const manifest = {
    name: options.name || "unnamed-plugin",
    version: options.version || "1.0.0",
    description: options.description || "",
    author: options.author || "unknown",
    license: options.license || "MIT",
    entryPoint: options.entryPoint || "index.js",
    permissions: options.permissions || [],
    dependencies: options.dependencies || [],
    configSchema: options.configSchema || {},
    hooks: options.hooks || {},
    ui: options.ui || {},
  };
  return validateManifest(manifest);
}
