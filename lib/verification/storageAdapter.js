/**
 * Storage Adapter — Abstract storage interface.
 *
 * Business logic should use this adapter instead of importing
 * storage.js directly. This allows swapping storage backends
 * (Supabase Storage, S3, R2, Azure Blob, GCS) without changing
 * business verification or bank verification modules.
 *
 * Current implementation: Supabase Storage (via storage.js)
 * Future: S3, Cloudflare R2, Azure Blob, Google Cloud Storage
 */

import {
  uploadDocument as supabaseUpload,
  deleteDocument as supabaseDelete,
  getSignedUrl as supabaseSignedUrl,
  getSignedUrlAdmin as supabaseSignedUrlAdmin,
  validateMimeType,
  validateFileSize,
  validateExtension,
  isImageFile,
  formatFileSize,
  STORAGE_BUCKET,
} from "./storage";
import { logInfo, logError } from "./secureLogger";

// ─── Upload ───

/**
 * Upload a verification document.
 * Delegates to current storage backend (Supabase Storage).
 *
 * @param {Object} params
 * @param {string} params.userId — User's auth ID
 * @param {string} params.documentType — Document type
 * @param {File|Blob} params.file — The file to upload
 * @param {string} params.originalFilename — Original filename
 * @returns {Promise<{success: boolean, error?: string, metadata?: Object}>}
 */
export async function uploadVerificationDocument({ userId, documentType, file, originalFilename }) {
  try {
    const result = await supabaseUpload({ userId, documentType, file, originalFilename });

    if (result.success) {
      logInfo("StorageAdapter", "Document uploaded", {
        documentType,
        userId: userId?.substring(0, 8) + "...",
      });
    }

    return result;
  } catch (err) {
    logError("StorageAdapter", "Upload error", { error: err.message });
    return { success: false, error: "Upload failed" };
  }
}

// ─── Delete ───

/**
 * Delete a verification document.
 *
 * @param {string} storagePath — The storage path (from DB)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteVerificationDocument(storagePath) {
  try {
    return await supabaseDelete(storagePath);
  } catch (err) {
    logError("StorageAdapter", "Delete error", { error: err.message });
    return { success: false, error: "Delete failed" };
  }
}

// ─── URLs ───

/**
 * Get a signed URL for a verification document (user access).
 *
 * @param {string} storagePath
 * @param {number} [expirySeconds]
 * @returns {Promise<{success: boolean, url?: string, expiresAt?: string, error?: string}>}
 */
export async function getDocumentSignedUrl(storagePath, expirySeconds) {
  try {
    return await supabaseSignedUrl(storagePath, expirySeconds);
  } catch (err) {
    logError("StorageAdapter", "Signed URL error", { error: err.message });
    return { success: false, error: "Failed to generate URL" };
  }
}

/**
 * Get a signed URL for admin access (service role, bypasses RLS).
 *
 * @param {string} storagePath
 * @param {number} [expirySeconds]
 * @returns {Promise<{success: boolean, url?: string, expiresAt?: string, error?: string}>}
 */
export async function getDocumentUrlAdmin(storagePath, expirySeconds) {
  try {
    return await supabaseSignedUrlAdmin(storagePath, expirySeconds);
  } catch (err) {
    logError("StorageAdapter", "Admin URL error", { error: err.message });
    return { success: false, error: "Failed to generate URL" };
  }
}

// ─── Re-export validation helpers ───

export { validateMimeType, validateFileSize, validateExtension, isImageFile, formatFileSize, STORAGE_BUCKET };
