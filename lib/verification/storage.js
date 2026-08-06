/**
 * Verification Storage — Secure document storage helper.
 *
 * Responsibilities:
 *   1. Upload documents to Supabase Storage
 *   2. Delete documents
 *   3. Generate signed URLs (time-limited)
 *   4. Validate MIME types, file sizes, extensions
 *   5. Never expose raw storage paths to frontend
 *
 * Storage buckets:
 *   - verification-docs (private, no public access)
 *
 * Security:
 *   - Signed URLs expire after 1 hour
 *   - Paths are never returned to frontend directly
 *   - uploadDocument returns the raw storage path for DB persistence plus a
 *     masked path for logs/display; the raw path is only ever stored server-side
 *   - All operations run with the service-role client (server-only module)
 *   - console.error replaced with structured secureLogger
 *   - generateStoragePath uses crypto.randomBytes for unpredictable paths
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { sanitizeDocumentResponse, maskDocumentName, maskStoragePath, hashMetadata } from "./metadataEncryption";
import { logInfo, logError } from "./secureLogger";

const crypto = require("crypto");

// ─── Configuration ───
const STORAGE_BUCKET = "verification-docs";

const ALLOWED_MIME_TYPES = {
  pan_card: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  aadhaar_card: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  passport: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  driving_license: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  voter_id: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  business_registration: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  gst_certificate: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  bank_statement: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  bank_passbook: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  selfie: ["image/jpeg", "image/png", "image/webp"],
  utility_bill: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  other: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};

const ALLOWED_EXTENSIONS = {
  image: ["jpg", "jpeg", "png", "webp"],
  document: ["pdf"],
};

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

// ─── Validation Helpers ───

/**
 * Validate MIME type for a given document type.
 * @param {string} mimeType
 * @param {string} documentType
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateMimeType(mimeType, documentType) {
  const allowed = ALLOWED_MIME_TYPES[documentType] || ALLOWED_MIME_TYPES.other;
  if (!allowed.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type "${mimeType}" for ${documentType}. Allowed: ${allowed.join(", ")}`,
    };
  }
  return { valid: true };
}

/**
 * Validate file size.
 * @param {number} sizeBytes
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFileSize(sizeBytes) {
  if (sizeBytes <= 0) {
    return { valid: false, error: "File is empty" };
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Maximum: ${MAX_FILE_SIZE_MB}MB`,
    };
  }
  return { valid: true };
}

/**
 * Validate file extension.
 * @param {string} filename
 * @returns {{ valid: boolean, extension?: string, error?: string }}
 */
export function validateExtension(filename) {
  if (!filename || !filename.includes(".")) {
    return { valid: false, error: "Invalid filename" };
  }
  const ext = filename.split(".").pop().toLowerCase();
  const allAllowed = [...ALLOWED_EXTENSIONS.image, ...ALLOWED_EXTENSIONS.document];
  if (!allAllowed.includes(ext)) {
    return {
      valid: false,
      error: `Invalid extension ".${ext}". Allowed: ${allAllowed.join(", ")}`,
    };
  }
  return { valid: true, extension: ext };
}

/**
 * Map document type to storage subfolder.
 * @param {string} documentType
 * @returns {string}
 */
export function getStorageFolder(documentType) {
  const folderMap = {
    pan_card: "identity",
    aadhaar_card: "identity",
    passport: "identity",
    driving_license: "identity",
    voter_id: "identity",
    business_registration: "business",
    gst_certificate: "business",
    bank_statement: "bank",
    bank_passbook: "bank",
    selfie: "selfie",
    utility_bill: "address",
    other: "other",
  };
  return folderMap[documentType] || "other";
}

/**
 * Generate a storage path for a verification document.
 * Path format: {userId}/{folder}/{timestamp}-{random}.{ext}
 * Uses crypto.randomBytes for unpredictable filenames.
 * Never returned to frontend directly.
 */
export function generateStoragePath(userId, documentType, filename) {
  const folder = getStorageFolder(documentType);
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString("hex");
  const ext = filename.split(".").pop().toLowerCase();
  return `${userId}/${folder}/${timestamp}-${random}.${ext}`;
}

// ─── Core Operations ───

/**
 * Upload a verification document.
 *
 * Returns the real storage path (for DB persistence) plus a masked path
 * (for logs/display). The raw path must never be returned to the frontend.
 *
 * @param {Object} params
 * @param {string} params.userId — User's auth ID
 * @param {string} params.documentType — Document type (e.g., 'pan_card')
 * @param {File|Blob|Buffer} params.file — The file to upload
 * @param {string} params.originalFilename — Original filename
 * @returns {Promise<{success: boolean, error?: string, storagePath?: string, metadata?: Object}>}
 */
export async function uploadDocument({ userId, documentType, file, originalFilename }) {
  try {
    // Validate inputs
    if (!userId || !documentType || !file) {
      return { success: false, error: "Missing required parameters" };
    }

    // Validate MIME type
    const mimeValidation = validateMimeType(file.type, documentType);
    if (!mimeValidation.valid) {
      return { success: false, error: mimeValidation.error };
    }

    // Validate file size
    const sizeValidation = validateFileSize(file.size);
    if (!sizeValidation.valid) {
      return { success: false, error: sizeValidation.error };
    }

    // Validate extension
    const extValidation = validateExtension(originalFilename);
    if (!extValidation.valid) {
      return { success: false, error: extValidation.error };
    }

    // Generate storage path
    const storagePath = generateStoragePath(userId, documentType, originalFilename);

    // Upload to Supabase Storage (service-role client — server-side module)
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      logError("Storage", "Upload error", { error: error.message });
      return { success: false, error: `Upload failed: ${error.message}` };
    }

    // Return real path (DB persistence) + masked path (logs/display only)
    return {
      success: true,
      storagePath,
      metadata: {
        bucket: STORAGE_BUCKET,
        storagePath,
        maskedPath: maskStoragePath(storagePath, userId),
        mimeType: file.type,
        fileSize: file.size,
      },
    };
  } catch (err) {
    logError("Storage", "Upload error", { error: err.message });
    return { success: false, error: "Upload failed unexpectedly" };
  }
}

/**
 * Delete a verification document.
 *
 * @param {string} storagePath — The storage path (from DB, not from frontend)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteDocument(storagePath) {
  try {
    if (!storagePath) {
      return { success: false, error: "No storage path provided" };
    }

    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      logError("Storage", "Delete error", { error: error.message });
      return { success: false, error: `Delete failed: ${error.message}` };
    }

    return { success: true };
  } catch (err) {
    logError("Storage", "Delete error", { error: err.message });
    return { success: false, error: "Delete failed unexpectedly" };
  }
}

/**
 * Generate a signed URL for a verification document.
 * URL expires after SIGNED_URL_EXPIRY_SECONDS.
 * Server-side: uses the service-role client; ownership is enforced by the
 * calling route before a path is ever passed here.
 *
 * @param {string} storagePath — The storage path (from DB)
 * @param {number} [expirySeconds] — Custom expiry (default: 3600)
 * @returns {Promise<{success: boolean, url?: string, expiresAt?: string, error?: string}>}
 */
export async function getSignedUrl(storagePath, expirySeconds = SIGNED_URL_EXPIRY_SECONDS) {
  try {
    if (!storagePath) {
      return { success: false, error: "No storage path provided" };
    }

    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expirySeconds);

    if (error) {
      logError("Storage", "Signed URL error", { error: error.message });
      return { success: false, error: `Failed to generate URL: ${error.message}` };
    }

    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

    return {
      success: true,
      url: data.signedUrl,
      expiresAt,
    };
  } catch (err) {
    logError("Storage", "Signed URL error", { error: err.message });
    return { success: false, error: "Failed to generate URL" };
  }
}

/**
 * Server-side: Generate a signed URL using service role (bypasses RLS).
 * Use for admin review or provider callbacks.
 *
 * @param {string} storagePath
 * @param {number} [expirySeconds]
 * @returns {Promise<{success: boolean, url?: string, expiresAt?: string, error?: string}>}
 */
export async function getSignedUrlAdmin(storagePath, expirySeconds = SIGNED_URL_EXPIRY_SECONDS) {
  try {
    if (!storagePath) {
      return { success: false, error: "No storage path provided" };
    }

    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expirySeconds);

    if (error) {
      logError("Storage", "Admin signed URL error", { error: error.message });
      return { success: false, error: `Failed to generate URL: ${error.message}` };
    }

    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

    return {
      success: true,
      url: data.signedUrl,
      expiresAt,
    };
  } catch (err) {
    logError("Storage", "Admin signed URL error", { error: err.message });
    return { success: false, error: "Failed to generate URL" };
  }
}

/**
 * Check if a file is an image (for preview purposes).
 * @param {string} mimeType
 * @returns {boolean}
 */
export function isImageFile(mimeType) {
  return mimeType?.startsWith("image/");
}

/**
 * Get human-readable file size.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export { STORAGE_BUCKET, MAX_FILE_SIZE_MB, SIGNED_URL_EXPIRY_SECONDS };

// ─── Security: Sanitization Helpers ───

/**
 * Sanitize a document response for frontend.
 * Uses metadataEncryption to strip sensitive fields.
 * @param {Object} doc
 * @returns {Object}
 */
export function sanitizeDoc(doc) {
  return sanitizeDocumentResponse(doc);
}

/**
 * Hash file metadata for integrity.
 * @param {Object} metadata
 * @returns {string}
 */
export function hashFileMetadata(metadata) {
  return hashMetadata(metadata);
}
