/**
 * Verification Metadata Encryption & Sanitization
 *
 * Responsibilities:
 *   1. Encrypt sensitive document metadata (AES-256-GCM)
 *   2. Mask document names and storage paths
 *   3. Sanitize responses before sending to frontend
 *   4. Hash metadata for integrity verification
 *
 * Security:
 *   - Never expose raw storage paths to frontend
 *   - Never expose provider_reference in public responses
 *   - Never expose device_metadata or IP addresses
 *   - Use Node.js crypto module for encryption
 *   - Requires ENCRYPTION_KEY env var (64-char hex string)
 *   - Encrypted payloads include version for future key rotation
 */

const crypto = require("crypto");

const { logError } = require("./secureLogger");

// ─── Encryption ───

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits
const ENCRYPTION_VERSION = 1;

/**
 * Get the encryption key from environment.
 * Requires ENCRYPTION_KEY — a 64-char hex string (32 bytes).
 * No fallback — fails immediately if missing.
 */
function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey || envKey.length !== 64) {
    throw new Error(
      "[metadataEncryption] ENCRYPTION_KEY must be a 64-character hex string. " +
      "Generate one with: node -e \"process.stdout.write(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(envKey, "hex");
}

/**
 * Encrypt data using AES-256-GCM.
 *
 * @param {Object|string} data — Data to encrypt
 * @returns {{ ciphertext: string, iv: string, tag: string, version: number }}
 */
export function encryptMetadata(data) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const plaintext = typeof data === "string" ? data : JSON.stringify(data);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAuthTagLength(TAG_LENGTH);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf-8"),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      version: ENCRYPTION_VERSION,
    };
  } catch (err) {
    // Re-throw ENCRYPTION_KEY errors (startup/ config errors)
    if (err.message.includes("ENCRYPTION_KEY")) throw err;
    logError("[metadataEncryption] Encrypt error:", err.message);
    return null;
  }
}

/**
 * Decrypt data using AES-256-GCM.
 *
 * @param {{ ciphertext: string, iv: string, tag: string, version?: number }} encrypted
 * @returns {Object|string|null}
 */
export function decryptMetadata(encrypted) {
  try {
    if (!encrypted || !encrypted.ciphertext || !encrypted.iv || !encrypted.tag) {
      return null;
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(encrypted.iv, "base64");
    const tag = Buffer.from(encrypted.tag, "base64");
    const ciphertext = Buffer.from(encrypted.ciphertext, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const plaintext = decrypted.toString("utf-8");

    // Try to parse as JSON
    try {
      return JSON.parse(plaintext);
    } catch {
      return plaintext;
    }
  } catch (err) {
    // Re-throw ENCRYPTION_KEY errors
    if (err.message.includes("ENCRYPTION_KEY")) throw err;
    logError("[metadataEncryption] Decrypt error:", err.message);
    return null;
  }
}

// ─── Masking ───

/**
 * Mask a document filename.
 * Keeps first 3 and last 4 characters, masks the middle with ***.
 *
 * @param {string} filename
 * @returns {string}
 */
export function maskDocumentName(filename) {
  if (!filename || typeof filename !== "string") return "***";

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) {
    // No extension
    if (filename.length <= 7) return "***";
    return filename.slice(0, 3) + "***" + filename.slice(-4);
  }

  const name = filename.slice(0, dotIndex);
  const ext = filename.slice(dotIndex);

  if (name.length <= 3) return "***" + ext;
  return name.slice(0, 3) + "***" + name.slice(-4) + ext;
}

/**
 * Mask a storage path — never expose the real path.
 * Returns a safe representation.
 *
 * @param {string} path — Raw storage path
 * @param {string} [userId] — User ID for partial display
 * @returns {string}
 */
export function maskStoragePath(path, userId) {
  if (!path) return "***";
  if (userId) {
    return `verification-docs/${userId}/***`;
  }
  return "verification-docs/***/***";
}

/**
 * Hash metadata for integrity verification.
 * Uses SHA-256.
 *
 * @param {Object|string} data
 * @returns {string} Hex-encoded hash
 */
export function hashMetadata(data) {
  try {
    const plaintext = typeof data === "string" ? data : JSON.stringify(data);
    return crypto.createHash("sha256").update(plaintext, "utf-8").digest("hex");
  } catch (err) {
    logError("[metadataEncryption] Hash error:", err.message);
    return "";
  }
}

// ─── Sanitization ───

/**
 * Sanitize a verification document response for frontend.
 * Strips: provider_reference, storage_path, metadata_encrypted.
 * Masks: document_name.
 *
 * @param {Object} doc — Raw document from DB
 * @returns {Object} Sanitized document
 */
export function sanitizeDocumentResponse(doc) {
  if (!doc) return null;

  const safe = { ...doc };

  // Strip sensitive fields
  delete safe.provider_reference;
  delete safe.storage_path;
  delete safe.metadata_encrypted;
  delete safe.metadata_hash;

  // Mask the document name
  safe.document_name = maskDocumentName(doc.document_name);

  return safe;
}

/**
 * Sanitize a verification request response for frontend.
 * Strips: provider_reference, ip_address, device_metadata from metadata.
 *
 * @param {Object} req — Raw request from DB
 * @returns {Object} Sanitized request
 */
export function sanitizeVerificationRequest(req) {
  if (!req) return null;

  const safe = { ...req };

  // Strip provider_reference
  delete safe.provider_reference;

  // Sanitize metadata — remove device_metadata and ip_address if present
  let sanitizedMetadata = safe.metadata;
  if (sanitizedMetadata && typeof sanitizedMetadata === "object") {
    const { device_metadata, ip_address, ...safeMeta } = sanitizedMetadata;
    sanitizedMetadata = safeMeta;
  }

  safe.metadata = sanitizedMetadata;

  return safe;
}

/**
 * Sanitize a session response for frontend.
 * Strips: device_metadata, ip_address_hash, wizard_state.
 *
 * @param {Object} session — Raw session from DB
 * @returns {Object} Sanitized session
 */
export function sanitizeSessionResponse(session) {
  if (!session) return null;

  const safe = { ...session };

  // Strip sensitive properties
  delete safe.device_metadata;
  delete safe.ip_address_hash;
  delete safe.wizard_state;

  return safe;
}

// ─── Business/Bank Sanitization ───

/**
 * Mask a GST number (show first 2 + last 4 chars).
 * @param {string} gst
 * @returns {string}
 */
export function maskGST(gst) {
  if (!gst || typeof gst !== "string") return "***";
  if (gst.length <= 6) return "***";
  return gst.slice(0, 2) + "***" + gst.slice(-4);
}

/**
 * Mask a PAN number (show first 4 + last 1 char).
 * @param {string} pan
 * @returns {string}
 */
export function maskPAN(pan) {
  if (!pan || typeof pan !== "string") return "***";
  if (pan.length <= 5) return "***";
  return pan.slice(0, 4) + "***" + pan.slice(-1);
}

/**
 * Mask an account number (show only last 4 digits).
 * @param {string} accountNumber
 * @returns {string}
 */
export function maskAccountNumber(accountNumber) {
  if (!accountNumber || typeof accountNumber !== "string") return "****";
  if (accountNumber.length <= 4) return "****";
  return "*".repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

/**
 * Mask an IFSC code (show first 4 chars + mask rest).
 * @param {string} ifsc
 * @returns {string}
 */
export function maskIFSC(ifsc) {
  if (!ifsc || typeof ifsc !== "string") return "****";
  if (ifsc.length <= 4) return "****";
  return ifsc.slice(0, 4) + "*".repeat(ifsc.length - 4);
}

/**
 * Sanitize a business verification response for frontend.
 * Strips: GST number, PAN number, CIN number, provider_reference,
 *         metadata_encrypted, metadata_hash.
 * Returns masked versions of sensitive fields.
 *
 * @param {Object} biz — Raw business verification from DB
 * @returns {Object} Sanitized business verification
 */
export function sanitizeBusinessVerification(biz) {
  if (!biz) return null;

  const safe = { ...biz };

  // Strip raw sensitive fields
  delete safe.gst_number;
  delete safe.pan_number;
  delete safe.cin_number;
  delete safe.provider_reference;
  delete safe.metadata_encrypted;
  delete safe.metadata_hash;

  // Return masked versions
  safe.gst_number_masked = maskGST(biz.gst_number);
  safe.pan_number_masked = maskPAN(biz.pan_number);

  return safe;
}

/**
 * Sanitize a bank account response for frontend.
 * Strips: account_number_encrypted, IFSC code, UPI ID, provider_reference.
 * Returns masked versions of sensitive fields.
 *
 * @param {Object} account — Raw bank account from DB
 * @returns {Object} Sanitized bank account
 */
export function sanitizeBankAccount(account) {
  if (!account) return null;

  const safe = { ...account };

  // Strip raw sensitive fields
  delete safe.account_number_encrypted;
  delete safe.ifsc_code;
  delete safe.upi_id;
  delete safe.provider_reference;

  // Return masked versions (use original object before deletion)
  safe.account_number_masked = maskAccountNumber(account.account_number_masked);
  safe.ifsc_masked = maskIFSC(account.ifsc_code);

  return safe;
}
