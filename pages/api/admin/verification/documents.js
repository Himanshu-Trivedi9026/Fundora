/**
 * Admin Verification Documents API — Read access to any user's documents.
 *
 * Only platform admins reach this route (withRole([ROLES.ADMIN]) composes
 * withAuth). It lists a user's verification_documents with server-side signed
 * URLs so admins can preview/download identity documents during review.
 *
 * Security:
 *   - withRole([ADMIN]) gates the route; non-admins get 403.
 *   - Signed URLs are generated server-side with the service-role client
 *     against the private verification-docs bucket.
 *   - Raw storage_path is never exposed to the client (sanitizeDocumentResponse
 *     strips it).
 *
 * GET ?userId=<uuid>          → documents for one user
 * GET ?status=pending|uploaded → documents by status (no userId)
 * GET ?documentId=<uuid>      → a single document with its signed URL
 */

import { withRole } from "../../../../lib/withAuth";
import { ROLES } from "../../../../lib/roles";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  getSignedUrl,
  sanitizeDoc,
} from "../../../../lib/verification/storage";

export default withRole(
  async function handler(req, res, user) {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      let query = supabaseAdmin
        .from("verification_documents")
        .select(
          "id, verification_id, user_id, document_type, document_name, storage_bucket, storage_path, mime_type, file_size, status, uploaded_at, created_at, updated_at",
        )
        .order("uploaded_at", { ascending: false });

      if (req.query.documentId) {
        query = query.eq("id", req.query.documentId).limit(1);
      } else if (req.query.userId) {
        query = query.eq("user_id", req.query.userId);
      } else if (req.query.status) {
        query = query.in("status", [
          "pending",
          "uploaded",
          "verified",
          "rejected",
        ]);
        if (req.query.status !== "all") {
          query = query.eq("status", req.query.status);
        }
      }

      const { data: documents, error } = await query;

      if (error) {
        console.error("Admin documents query error:", error);
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

      return res
        .status(200)
        .json({ success: true, documents: docs, count: docs.length });
    } catch (err) {
      console.error("Admin documents error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
  [ROLES.ADMIN],
);
