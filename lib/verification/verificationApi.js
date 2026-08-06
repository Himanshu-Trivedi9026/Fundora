/**
 * verificationApi — Client-side wrapper for the verification API routes.
 *
 * The wizard previously imported lib/verification/sessionManager and
 * phoneVerification directly (both server-side modules that use
 * supabaseAdmin) with a hardcoded "current-user-id" — broken in the browser.
 * This helper instead calls the real API routes with the caller's Bearer
 * token, so ownership is enforced server-side via withAuth.
 *
 * Every call resolves the session token from supabase.auth.getSession().
 */

import { authHeaders } from "../authFetch";

async function parseJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function fail(res, body) {
  const err = new Error(body?.error || `Request failed (${res.status})`);
  err.status = res.status;
  err.body = body;
  return err;
}

// ─── Session ───

export async function fetchSession() {
  const res = await fetch("/api/verification/session", {
    method: "GET",
    headers: await authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) throw fail(res, body);
  return body.session || null;
}

export async function createSessionApi({ deviceMetadata, requestId } = {}) {
  const res = await fetch("/api/verification/session", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ deviceMetadata, requestId }),
  });
  const body = await parseJson(res);
  if (!res.ok) throw fail(res, body);
  return body.session;
}

export async function updateSessionStepApi({ sessionId, step, completedSteps, wizardState }) {
  const res = await fetch("/api/verification/session", {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ sessionId, step, completedSteps, wizardState }),
  });
  const body = await parseJson(res);
  if (!res.ok) throw fail(res, body);
  return body;
}

export async function completeSessionApi({ sessionId }) {
  const res = await fetch("/api/verification/session", {
    method: "DELETE",
    headers: await authHeaders(),
    body: JSON.stringify({ sessionId, action: "complete" }),
  });
  const body = await parseJson(res);
  if (!res.ok) throw fail(res, body);
  return body;
}

// ─── Phone ───

export async function sendOtp({ phone }) {
  const res = await fetch("/api/verification/phone", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "send", phone }),
  });
  const body = await parseJson(res);
  if (!res.ok) throw fail(res, body);
  return body;
}

export async function verifyOtp({ phone, otp }) {
  const res = await fetch("/api/verification/phone", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "verify", phone, otp }),
  });
  const body = await parseJson(res);
  if (!res.ok) throw fail(res, body);
  return body;
}

export async function getOtpStatus({ phone }) {
  const res = await fetch("/api/verification/phone", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "status", phone }),
  });
  const body = await parseJson(res);
  if (!res.ok) throw fail(res, body);
  return body;
}

// ─── Documents ───

/**
 * Upload a file to POST /api/verification/documents with real progress.
 *
 * @param {File} file
 * @param {string} documentType
 * @param {(progress: number) => void} onProgress — 0..100
 * @returns {Promise<{ document: Object }>}
 */
export function uploadDocumentFile({ file, documentType, onProgress }) {
  return new Promise((resolve, reject) => {
    (async () => {
      const headers = await authHeaders(false);
      const form = new FormData();
      form.append("documentType", documentType);
      form.append("file", file, file.name);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/verification/documents");

      // Copy auth headers onto the XHR (XMLHttpRequest accepts a plain header map).
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        let body = {};
        try {
          body = JSON.parse(xhr.responseText || "{}");
        } catch {
          /* non-JSON error body */
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(fail({ status: xhr.status }, body));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error during upload"));
      };

      xhr.send(form);
    })();
  });
}

/**
 * List the caller's own documents (with signed URLs).
 */
export async function fetchDocuments() {
  const res = await fetch("/api/verification/documents", {
    method: "GET",
    headers: await authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) throw fail(res, body);
  return body.documents || [];
}

/**
 * Delete one of the caller's own documents.
 */
export async function deleteDocumentApi({ documentId }) {
  const res = await fetch(`/api/verification/documents?documentId=${encodeURIComponent(documentId)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  const body = await parseJson(res);
  if (!res.ok) throw fail(res, body);
  return body;
}
