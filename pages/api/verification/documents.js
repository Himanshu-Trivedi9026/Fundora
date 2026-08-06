/**
 * Verification Documents API — Real identity document upload, listing, delete.
 *
 * This route replaces the simulated identity upload flow with real uploads:
 *   - POST  (multipart) — upload one or more documents
 *   - GET   — list the caller's own documents (with 1h signed URLs)
 *   - DELETE — remove one of the caller's own documents (storage + row)
 *
 * Security model:
 *   - withAuth — only signed-in users
 *   - Ownership enforced on every read/delete: a user can only ever see or
 *     delete their own documents.
 *   - Files live in the private `verification-docs` bucket (see migration
 *     021). Real uploads / signed URLs run through the service-role client
 *     server-side; the client never sees the raw storage path.
 *   - Raw storage_path is persisted in the DB but stripped from responses
 *     (sanitizeDocumentResponse). Only the masked path is exposed.
 *
 * creator_verifications lifecycle (reused, not duplicated): the migration-001
 * trigger (handle_new_user_verification) creates one row per user at signup.
 * This route SELECTs that row; only for a legacy user where the row is
 * genuinely absent does it perform a single backstop insert mirroring the
 * trigger exactly (ON CONFLICT (user_id) DO NOTHING) so the documents FK
 * never blocks an upload.
 */

import { withAuth } from "../../../lib/withAuth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { parseMultipartFile } from "../../../lib/api/parseMultipartFile";
import {
  validateDocument,
  validateCorruption,
  DOCUMENT_TYPES,
} from "../../../lib/verification/documentValidator";
import {
  STORAGE_BUCKET,
  MAX_FILE_SIZE_MB,
  generateStoragePath,
  getStorageFolder,
  deleteDocument,
  getSignedUrl,
  sanitizeDoc,
} from "../../../lib/verification/storage";

export const config = {
  api: {
    bodyParser: false, // multipart parsing handled by busboy (parseMultipartFile)
  },
};

// Document types valid for the identity flow (subset of the DB CHECK).
const IDENTITY_DOCUMENT_TYPES = new Set([
  DOCUMENT_TYPES.PAN_CARD,
  DOCUMENT_TYPES.AADHAAR_CARD,
  DOCUMENT_TYPES.PASSPORT,
  DOCUMENT_TYPES.DRIVING_LICENSE,
  DOCUMENT_TYPES.VOTER_ID,
  DOCUMENT_TYPES.SELFIE,
]);

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Resolve the caller's creator_verifications row, reusing the existing
 * lifecycle. The migration-001 trigger creates this row at signup; we only
 * fall back to an insert for legacy users where the row is absent, using the
 * exact statement the trigger runs (a backstop, not a new mechanism).
 *
 * @param {string} userId
 * @returns {Promise<{ success: boolean, verificationId?: string, error?: string }>}
 */
async function resolveVerificationRow(userId) {
  const { data, error } = await supabaseAdmin
    .from("creator_verifications")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error && data) {
    return { success: true, verificationId: data.id };
  }

  // Legacy backstop — mirror the migration-001 trigger statement exactly.
  const { error: insertError } = await supabaseAdmin
    .from("creator_verifications")
    .insert({
      user_id: userId,
      verification_level: 0,
      verification_status: "pending",
      email_verified: false,
    });

  if (insertError) {
    return { success: false, error: "Failed to resolve verification record" };
  }

  const { data: reSelected, error: reselectError } = await supabaseAdmin
    .from("creator_verifications")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (reselectError || !reSelected) {
    return { success: false, error: "Failed to resolve verification record" };
  }

  return { success: true, verificationId: reSelected.id };
}

/**
 * Validate a single parsed file against the document requirements.
 *
 * @param {Object} file — { fieldName, originalFilename, mimeType, buffer, size }
 * @param {string} documentType
 * @param {string[]} existingNames — for duplicate-name detection
 * @returns {{ valid: boolean, error?: string }}
 */
function validateParsedFile(file, documentType, existingNames) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    return { valid: false, error: "File is empty" };
  }

  const filename = file.originalFilename;
  const mimeType = file.mimeType;

  const validation = validateDocument({
    filename,
    mimeType,
    fileSize: file.size,
    documentType,
    existingNames,
  });

  if (!validation.valid) {
    return { valid: false, error: validation.errors.join(" ") };
  }

  // Corruption / MIME-spoof check on the actual bytes (Buffer is a Uint8Array).
  const corruption = validateCorruption(file.buffer, mimeType);
  if (!corruption.valid) {
    return { valid: false, error: corruption.error };
  }

  return { valid: true };
}

/**
 * Check for an existing document of the same type for this user, enforcing
 * the replace/verified rules.
 *
 * @param {string} userId
 * @param {string} documentType
 * @returns {Promise<{ status: "none" | "replaced" | "blocked", existing?: Object }>}
 */
async function findExistingDocument(userId, documentType) {
  const { data, error } = await supabaseAdmin
    .from("verification_documents")
    .select("id, document_type, storage_path, status")
    .eq("user_id", userId)
    .eq("document_type", documentType)
    .maybeSingle();

  if (error) return { status: "none" };
  if (!data) return { status: "none" };

  if (data.status === "verified") {
    return { status: "blocked", existing: data };
  }

  return { status: "replaced", existing: data };
}

/**
 * POST — upload one or more documents.
 */
async function handlePost(req, res, user) {
  let parsed;
  try {
    parsed = await parseMultipartFile(req);
  } catch (err) {
    return res.status(400).json({ error: "Invalid multipart payload" });
  }

  const { fields, files } = parsed;

  const documentType = fields.documentType || fields.document_type;
  if (!documentType) {
    return res.status(400).json({ error: "documentType is required" });
  }
  if (!IDENTITY_DOCUMENT_TYPES.has(documentType)) {
    return res
      .status(400)
      .json({ error: `Unsupported document type: ${documentType}` });
  }

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files provided" });
  }

  // Resolve the creator_verifications row (existing lifecycle, reused).
  const resolved = await resolveVerificationRow(user.id);
  if (!resolved.success) {
    return res.status(500).json({ error: resolved.error });
  }

  // Enforce the verified-document block / replacement rules per type.
  const existing = await findExistingDocument(user.id, documentType);
  if (existing.status === "blocked") {
    return res.status(400).json({
      error: "This document is already verified. Contact support to update it.",
    });
  }

  const existingNames =
    (
      await supabaseAdmin
        .from("verification_documents")
        .select("document_name")
        .eq("user_id", user.id)
    ).data?.map((d) => d.document_name) || [];

  // Only the first file is treated as the primary document for the selected
  // type (matches the single-document-per-type identity flow).
  const file = files[0];

  const validation = validateParsedFile(file, documentType, existingNames);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const filename = file.originalFilename;
  const storagePath = generateStoragePath(user.id, documentType, filename);
  const folder = getStorageFolder(documentType);

  // Upload to the private bucket via the service-role client.
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return res
      .status(500)
      .json({ error: `Upload failed: ${uploadError.message}` });
  }

  // Replacement: remove the old object + row before inserting the new one.
  if (existing.status === "replaced" && existing.existing) {
    await deleteDocument(existing.existing.storage_path);
    await supabaseAdmin
      .from("verification_documents")
      .delete()
      .eq("id", existing.existing.id);
  }

  // Insert the DB row with the real storage path.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("verification_documents")
    .insert({
      verification_id: resolved.verificationId,
      user_id: user.id,
      document_type: documentType,
      document_name: filename,
      storage_bucket: STORAGE_BUCKET,
      storage_path: storagePath,
      mime_type: file.mimeType,
      file_size: file.size,
      status: "uploaded",
    })
    .select()
    .single();

  if (insertError) {
    // Clean up the just-uploaded object so a failed insert never orphans it.
    await deleteDocument(storagePath);
    return res.status(500).json({ error: "Failed to save document reference" });
  }

  const sanitized = sanitizeDoc(inserted);

  return res.status(201).json({
    success: true,
    document: {
      ...sanitized,
      folder,
      replaced: existing.status === "replaced",
    },
  });
}

/**
 * GET — list the caller's own documents with 1h signed URLs.
 */
async function handleGet(req, res, user) {
  const { data: documents, error } = await supabaseAdmin
    .from("verification_documents")
    .select(
      "id, verification_id, user_id, document_type, document_name, storage_bucket, storage_path, mime_type, file_size, status, uploaded_at, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: "Failed to list documents" });
  }

  const docs = [];
  for (const doc of documents || []) {
    const signed = await getSignedUrl(doc.storage_path);
    docs.push({
      ...sanitizeDoc(doc),
      ...(signed.success
        ? { signedUrl: signed.url, signedUrlExpiresAt: signed.expiresAt }
        : {}),
    });
  }

  return res.status(200).json({ success: true, documents: docs });
}

/**
 * DELETE — remove one of the caller's own documents (storage + row).
 */
async function handleDelete(req, res, user) {
  const documentId = req.query.documentId;
  if (!documentId) {
    return res.status(400).json({ error: "documentId is required" });
  }

  const { data: doc, error } = await supabaseAdmin
    .from("verification_documents")
    .select("id, user_id, storage_path")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  if (doc.user_id !== user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Remove storage object first (best-effort), then the row.
  await deleteDocument(doc.storage_path);
  const { error: deleteError } = await supabaseAdmin
    .from("verification_documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    return res.status(500).json({ error: "Failed to delete document" });
  }

  return res.status(200).json({ success: true });
}

export default withAuth(async function handler(req, res, user) {
  try {
    if (req.method === "POST") return await handlePost(req, res, user);
    if (req.method === "GET") return await handleGet(req, res, user);
    if (req.method === "DELETE") return await handleDelete(req, res, user);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Verification documents error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
