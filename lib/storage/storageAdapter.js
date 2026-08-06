// Storage Adapter — unified interface for cloud storage providers
// Provides consistent API for file upload, download, delete, and listing

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logDebug } from "../verification/secureLogger.js";

class StorageAdapter {
  constructor() {
    this.providers = new Map();
    this.activeProvider = null;
  }

  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }

  setActiveProvider(name) {
    if (!this.providers.has(name)) {
      return { success: false, error: `Provider ${name} not registered` };
    }
    this.activeProvider = name;
    return { success: true };
  }

  getActiveProvider() {
    return this.activeProvider;
  }

  async upload(bucket, path, file, options = {}) {
    try {
      const provider = this._getProvider();
      if (!provider) return { success: false, error: "No storage provider configured" };

      const result = await provider.upload(bucket, path, file, options);

      // Record storage object
      await this._recordObject(bucket, path, result.data?.url, options);

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async download(bucket, path) {
    try {
      const provider = this._getProvider();
      if (!provider) return { success: false, error: "No storage provider configured" };
      return await provider.download(bucket, path);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async delete(bucket, path) {
    try {
      const provider = this._getProvider();
      if (!provider) return { success: false, error: "No storage provider configured" };

      const result = await provider.delete(bucket, path);

      // Soft-delete from storage_objects
      if (result.success) {
        await supabaseAdmin
          .from("storage_objects")
          .update({ deleted_at: new Date().toISOString() })
          .eq("bucket", bucket)
          .eq("path", path)
          .catch(() => {});
      }

      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async list(bucket, prefix = "", options = {}) {
    try {
      const provider = this._getProvider();
      if (!provider) return { success: false, error: "No storage provider configured" };
      return await provider.list(bucket, prefix, options);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getSignedUrl(bucket, path, options = {}) {
    try {
      const provider = this._getProvider();
      if (!provider) return { success: false, error: "No storage provider configured" };
      return await provider.getSignedUrl(bucket, path, options);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getMetadata(bucket, path) {
    try {
      const provider = this._getProvider();
      if (!provider) return { success: false, error: "No storage provider configured" };
      return await provider.getMetadata(bucket, path);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async listBuckets() {
    try {
      const provider = this._getProvider();
      if (!provider) return { success: false, error: "No storage provider configured" };
      return await provider.listBuckets();
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  _getProvider() {
    if (!this.activeProvider) return null;
    return this.providers.get(this.activeProvider) || null;
  }

  async _recordObject(bucket, path, url, options) {
    try {
      await supabaseAdmin.from("storage_objects").insert({
        bucket,
        path,
        url: url || null,
        content_type: options.contentType || null,
        size_bytes: options.sizeBytes || 0,
        metadata: options.metadata || {},
        provider: this.activeProvider,
        uploaded_at: new Date().toISOString(),
      });
    } catch (err) {
      logDebug("Failed to record storage object", { error: err.message });
    }
  }
}

export const storageAdapter = new StorageAdapter();
export default storageAdapter;
