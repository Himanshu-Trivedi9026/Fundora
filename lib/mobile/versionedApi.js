// Versioned API — API version management and routing
// Handles version registration, header parsing, and compatibility

export class VersionedApi {
  constructor() {
    this.versions = new Map();
    this.defaultVersion = null;
    this._latestVersion = null;
  }

  registerVersion(version, config = {}) {
    const { handlers = {}, deprecated = false, sunset = null } = config;

    this.versions.set(version, {
      version,
      handlers,
      deprecated,
      sunset: sunset ? new Date(sunset) : null,
      registeredAt: new Date(),
    });

    // Track latest version
    if (!this._latestVersion || version > this._latestVersion) {
      this._latestVersion = version;
    }

    if (!this.defaultVersion) {
      this.defaultVersion = version;
    }

    return { success: true, version };
  }

  getVersion(version) {
    return this.versions.get(version) || null;
  }

  resolveVersion(requestedVersion) {
    if (!requestedVersion) {
      return this.defaultVersion;
    }

    // Try exact match
    if (this.versions.has(requestedVersion)) {
      return requestedVersion;
    }

    // Try prefix match (e.g., "v1" matches "v1.0.0", "v1.2")
    for (const [v] of this.versions) {
      if (v.startsWith(requestedVersion) || requestedVersion.startsWith(v)) {
        return v;
      }
    }

    return this.defaultVersion;
  }

  parseVersionHeader(header) {
    if (!header) return null;

    // Accept: application/vnd.fundora.v1+json
    const match = header.match(/vnd\.fundora\.v?(\d+(?:\.\d+)*)/i);
    if (match) {
      return `v${match[1]}`;
    }

    // X-API-Version: 1 or X-API-Version: v1
    const headerMatch = header.match(/^v?(\d+(?:\.\d+)*)$/);
    if (headerMatch) {
      return `v${headerMatch[1]}`;
    }

    return null;
  }

  getHandler(version, path) {
    const v = this.resolveVersion(version);
    if (!v) return null;

    const versionConfig = this.versions.get(v);
    if (!versionConfig) return null;

    // Exact handler
    if (versionConfig.handlers[path]) {
      return {
        handler: versionConfig.handlers[path],
        version: v,
        deprecated: versionConfig.deprecated,
        sunset: versionConfig.sunset,
      };
    }

    // Wildcard handler
    if (versionConfig.handlers["*"]) {
      return {
        handler: versionConfig.handlers["*"],
        version: v,
        deprecated: versionConfig.deprecated,
        sunset: versionConfig.sunset,
      };
    }

    return null;
  }

  getLatestVersion() {
    return this._latestVersion;
  }

  listVersions() {
    return Array.from(this.versions.keys());
  }

  getVersionInfo(version) {
    const v = this.getVersion(version);
    if (!v) return null;

    return {
      version: v.version,
      deprecated: v.deprecated,
      sunset: v.sunset?.toISOString() || null,
      endpointCount: Object.keys(v.handlers).length,
    };
  }

  deprecateVersion(version, sunsetDate) {
    const v = this.versions.get(version);
    if (!v) return { success: false, error: `Version ${version} not found` };

    v.deprecated = true;
    if (sunsetDate) {
      v.sunset = new Date(sunsetDate);
    }

    return { success: true };
  }
}

export const apiVersionManager = new VersionedApi();

// Register initial API versions
apiVersionManager.registerVersion("v1", {
  handlers: {},
});

apiVersionManager.registerVersion("v1.1", {
  handlers: {},
});

apiVersionManager.registerVersion("v2", {
  handlers: {},
  deprecated: false,
});
