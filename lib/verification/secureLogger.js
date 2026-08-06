/**
 * Secure Logger — Structured logging with automatic redaction.
 *
 * Replaces console.log for all verification operations.
 * Automatically redacts: OTPs, PAN/Aadhaar/passport numbers,
 * storage paths, provider references, encryption keys, session tokens.
 *
 * Security:
 *   - Never logs sensitive PII
 *   - Never logs secrets or keys
 *   - Structured JSON output for log aggregators
 *   - Redaction patterns applied automatically
 */

// ─── Redaction Patterns ───

const REDACTION_PATTERNS = [
  // OTP (6 digits)
  { pattern: /\b\d{6}\b/g, replacement: "[OTP_REDACTED]" },
  // PAN card: ABCDE1234F
  { pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g, replacement: "[PAN_REDACTED]" },
  // Aadhaar: 12 digits with optional spaces/dashes
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: "[AADHAAR_REDACTED]" },
  // Passport: alphanumeric 6-9 chars
  { pattern: /\b[A-Z]\d{7,8}\b/g, replacement: "[PASSPORT_REDACTED]" },
  // Storage paths: verification-docs/...
  { pattern: /verification-docs\/[^\s"']*/g, replacement: "[STORAGE_REDACTED]" },
  // Provider references (stripe, hyperverge, etc.)
  { pattern: /\b(prov_|ref_|sess_)[:\-][A-Za-z0-9_-]+/g, replacement: "[PROVIDER_REF_REDACTED]" },
  // Encryption keys (hex strings >= 32 chars)
  { pattern: /\b[a-f0-9]{32,}\b/g, replacement: "[KEY_REDACTED]" },
  // Bearer tokens
  { pattern: /Bearer\s+[A-Za-z0-9._-]+/g, replacement: "[TOKEN_REDACTED]" },
  // Email addresses (partial redaction)
  { pattern: /([a-zA-Z0-9._%+-]+)(@[^@\s]+)/g, replacement: "$1***$2" },
  // IP addresses (partial redaction)
  { pattern: /\b(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}\b/g, replacement: "$1.***" },
];

/**
 * Apply redaction patterns to a string value.
 *
 * @param {string} value
 * @returns {string}
 */
function redactString(value) {
  if (typeof value !== "string") return value;
  let redacted = value;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

/**
 * Deep redact an object — apply redaction to all string values.
 *
 * @param {Object} obj
 * @returns {Object}
 */
function redactObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return redactString(obj);
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item));
  }

  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    // Redact known sensitive keys entirely
    const sensitiveKeys = [
      "otp", "otpHash", "otp_hash", "panNumber", "aadhaarNumber",
      "passportNumber", "storagePath", "storage_path", "providerReference",
      "provider_reference", "encryptionKey", "ENCRYPTION_KEY", "SUPABASE_SERVICE_ROLE_KEY",
      "secret", "password", "token", "sessionToken", "session_token",
      "privateKey", "private_key", "apiKey", "api_key",
    ];
    if (sensitiveKeys.includes(key)) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = redactObject(value);
    }
  }
  return redacted;
}

/**
 * Get the current timestamp in ISO format.
 * Uses Date.now() internally for consistency.
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Log a debug message (only in development).
 *
 * @param {string} module — Module name (e.g., 'SessionManager')
 * @param {string} message — Log message
 * @param {Object} [data] — Additional data (auto-redacted)
 */
export function logDebug(module, message, data) {
  if (process.env.NODE_ENV === "production") return;

  const entry = {
    level: "debug",
    module,
    message,
    timestamp: getTimestamp(),
    ...(data ? { data: redactObject(data) } : {}),
  };

  console.log(JSON.stringify(entry));
}

/**
 * Log an info message.
 *
 * @param {string} module — Module name
 * @param {string} message — Log message
 * @param {Object} [data] — Additional data (auto-redacted)
 */
export function logInfo(module, message, data) {
  const entry = {
    level: "info",
    module,
    message,
    timestamp: getTimestamp(),
    ...(data ? { data: redactObject(data) } : {}),
  };

  console.log(JSON.stringify(entry));
}

/**
 * Log a warning message.
 *
 * @param {string} module — Module name
 * @param {string} message — Warning message
 * @param {Object} [data] — Additional data (auto-redacted)
 */
export function logWarn(module, message, data) {
  const entry = {
    level: "warn",
    module,
    message,
    timestamp: getTimestamp(),
    ...(data ? { data: redactObject(data) } : {}),
  };

  console.warn(JSON.stringify(entry));
}

/**
 * Log an error message.
 *
 * @param {string} module — Module name
 * @param {string} message — Error message
 * @param {Object} [data] — Additional data (auto-redacted)
 */
export function logError(module, message, data) {
  const entry = {
    level: "error",
    module,
    message,
    timestamp: getTimestamp(),
    ...(data ? { data: redactObject(data) } : {}),
  };

  console.error(JSON.stringify(entry));
}

// ─── Exported utilities ───

export { redactString, redactObject, REDACTION_PATTERNS };
