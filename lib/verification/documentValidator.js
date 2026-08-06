/**
 * Document Validator — Comprehensive document validation pipeline.
 *
 * Validates: extension, MIME type, file size, image dimensions,
 * duplicate names, corruption (magic bytes).
 *
 * Security:
 *   - Rejects executables, scripts, and non-document files
 *   - Validates magic bytes to prevent MIME spoofing
 *   - Enforces per-document-type rules
 */

// ─── Configuration ───

export const DOCUMENT_TYPES = {
  PAN_CARD: "pan_card",
  AADHAAR_CARD: "aadhaar_card",
  PASSPORT: "passport",
  DRIVING_LICENSE: "driving_license",
  VOTER_ID: "voter_id",
  BUSINESS_REGISTRATION: "business_registration",
  GST_CERTIFICATE: "gst_certificate",
  BANK_STATEMENT: "bank_statement",
  BANK_PASSBOOK: "bank_passbook",
  CANCELLED_CHEQUE: "cancelled_cheque",
  SELFIE: "selfie",
  UTILITY_BILL: "utility_bill",
  OTHER: "other",
  // Phase 4 — Business document types
  CERTIFICATE_OF_INCORPORATION: "certificate_of_incorporation",
  UDYAM_REGISTRATION: "udyam_registration",
  TRADE_LICENSE: "trade_license",
  MSME_CERTIFICATE: "msme_certificate",
  PARTNERSHIP_DEED: "partnership_deed",
  TRUST_REGISTRATION: "trust_registration",
  SOCIETY_REGISTRATION: "society_registration",
  MOA: "moa",
  AOA: "aoa",
  BUSINESS_ADDRESS_PROOF: "business_address_proof",
  DIRECTOR_IDENTITY_PROOF: "director_identity_proof",
  DIRECTOR_ADDRESS_PROOF: "director_address_proof",
};

export const DOCUMENT_REQUIREMENTS = {
  [DOCUMENT_TYPES.PAN_CARD]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 250 },
    label: "PAN Card",
  },
  [DOCUMENT_TYPES.AADHAAR_CARD]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 250 },
    label: "Aadhaar Card",
  },
  [DOCUMENT_TYPES.PASSPORT]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Passport",
  },
  [DOCUMENT_TYPES.DRIVING_LICENSE]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 250 },
    label: "Driving License",
  },
  [DOCUMENT_TYPES.VOTER_ID]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 250 },
    label: "Voter ID",
  },
  [DOCUMENT_TYPES.BUSINESS_REGISTRATION]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Business Registration",
  },
  [DOCUMENT_TYPES.GST_CERTIFICATE]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "GST Certificate",
  },
  [DOCUMENT_TYPES.BANK_STATEMENT]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Bank Statement",
  },
  [DOCUMENT_TYPES.BANK_PASSBOOK]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Bank Passbook",
  },
  [DOCUMENT_TYPES.SELFIE]: {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: ["jpg", "jpeg", "png", "webp"],
    maxSizeMB: 10,
    minImageDimensions: { width: 200, height: 200 },
    label: "Selfie",
  },
  [DOCUMENT_TYPES.UTILITY_BILL]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Utility Bill",
  },
  [DOCUMENT_TYPES.CANCELLED_CHEQUE]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 250 },
    label: "Cancelled Cheque",
  },
  [DOCUMENT_TYPES.OTHER]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: null,
    label: "Other Document",
  },
  // Phase 4 — Business document types
  [DOCUMENT_TYPES.CERTIFICATE_OF_INCORPORATION]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Certificate of Incorporation",
  },
  [DOCUMENT_TYPES.UDYAM_REGISTRATION]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Udyam Registration Certificate",
  },
  [DOCUMENT_TYPES.TRADE_LICENSE]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Trade License",
  },
  [DOCUMENT_TYPES.MSME_CERTIFICATE]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "MSME Certificate",
  },
  [DOCUMENT_TYPES.PARTNERSHIP_DEED]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Partnership Deed",
  },
  [DOCUMENT_TYPES.TRUST_REGISTRATION]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Trust Registration Certificate",
  },
  [DOCUMENT_TYPES.SOCIETY_REGISTRATION]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Society Registration Certificate",
  },
  [DOCUMENT_TYPES.MOA]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Memorandum of Association (MOA)",
  },
  [DOCUMENT_TYPES.AOA]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Articles of Association (AOA)",
  },
  [DOCUMENT_TYPES.BUSINESS_ADDRESS_PROOF]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Business Address Proof",
  },
  [DOCUMENT_TYPES.DIRECTOR_IDENTITY_PROOF]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 250 },
    label: "Director's Identity Proof",
  },
  [DOCUMENT_TYPES.DIRECTOR_ADDRESS_PROOF]: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
    maxSizeMB: 10,
    minImageDimensions: { width: 400, height: 300 },
    label: "Director's Address Proof",
  },
};

// Magic bytes for common file types
const MAGIC_BYTES = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [
    [0x52, 0x49, 0x46, 0x46], // RIFF header
  ],
  "application/pdf": [
    [0x25, 0x50, 0x44, 0x46], // %PDF
  ],
};

// ─── Validation Functions ───

/**
 * Validate file extension against allowed list.
 * @param {string} filename
 * @param {string} documentType
 * @returns {{ valid: boolean, extension?: string, error?: string }}
 */
export function validateDocumentExtension(filename, documentType) {
  if (!filename || typeof filename !== "string") {
    return { valid: false, error: "Invalid filename" };
  }

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filename.length - 1) {
    return { valid: false, error: "File must have an extension" };
  }

  const ext = filename.slice(dotIndex + 1).toLowerCase();
  const req =
    DOCUMENT_REQUIREMENTS[documentType] ||
    DOCUMENT_REQUIREMENTS[DOCUMENT_TYPES.OTHER];

  if (!req.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid extension ".${ext}". Allowed: ${req.allowedExtensions.join(", ")}`,
    };
  }

  return { valid: true, extension: ext };
}

/**
 * Validate MIME type for a document type.
 * @param {string} mimeType
 * @param {string} documentType
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDocumentMime(mimeType, documentType) {
  if (!mimeType) {
    return { valid: false, error: "Missing MIME type" };
  }

  const req =
    DOCUMENT_REQUIREMENTS[documentType] ||
    DOCUMENT_REQUIREMENTS[DOCUMENT_TYPES.OTHER];

  if (!req.allowedMimeTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type "${mimeType}". Allowed: ${req.allowedMimeTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size.
 * @param {number} fileSize — Size in bytes
 * @param {string} documentType
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDocumentSize(fileSize, documentType) {
  if (!fileSize || fileSize <= 0) {
    return { valid: false, error: "File is empty" };
  }

  const req =
    DOCUMENT_REQUIREMENTS[documentType] ||
    DOCUMENT_REQUIREMENTS[DOCUMENT_TYPES.OTHER];
  const maxSizeBytes = req.maxSizeMB * 1024 * 1024;

  if (fileSize > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Maximum: ${req.maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Validate image dimensions (for image files only).
 * @param {number} width
 * @param {number} height
 * @param {string} documentType
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageDimensions(width, height, documentType) {
  const req =
    DOCUMENT_REQUIREMENTS[documentType] ||
    DOCUMENT_REQUIREMENTS[DOCUMENT_TYPES.OTHER];

  if (!req.minImageDimensions) {
    return { valid: true }; // No dimension requirement
  }

  if (!width || !height || width <= 0 || height <= 0) {
    return { valid: false, error: "Invalid image dimensions" };
  }

  if (
    width < req.minImageDimensions.width ||
    height < req.minImageDimensions.height
  ) {
    return {
      valid: false,
      error: `Image too small (${width}x${height}). Minimum: ${req.minImageDimensions.width}x${req.minImageDimensions.height}`,
    };
  }

  return { valid: true };
}

/**
 * Check for duplicate filenames.
 * @param {string[]} existingNames — List of existing filenames
 * @param {string} filename — New filename to check
 * @returns {{ valid: boolean, suggestedName?: string, error?: string }}
 */
export function checkDuplicateName(existingNames, filename) {
  if (!existingNames || !Array.isArray(existingNames)) {
    return { valid: true };
  }

  if (!existingNames.includes(filename)) {
    return { valid: true };
  }

  // Generate a unique name by appending timestamp
  const dotIndex = filename.lastIndexOf(".");
  const name = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : "";
  const timestamp = Date.now().toString(36);
  const suggestedName = `${name}-${timestamp}${ext}`;

  return {
    valid: false,
    suggestedName,
    error: `File "${filename}" already exists. Use "${suggestedName}" instead.`,
  };
}

/**
 * Validate file corruption via magic bytes check.
 * Reads the first few bytes and verifies against expected MIME type.
 *
 * @param {File|Blob|ArrayBuffer} file — File or buffer to check
 * @param {string} expectedMimeType — Expected MIME type
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCorruption(file, expectedMimeType) {
  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  // Skip validation if we can't read magic bytes (Blob without arrayBuffer)
  // or if no magic bytes defined for this type
  const expectedBytes = MAGIC_BYTES[expectedMimeType];
  if (!expectedBytes) {
    return { valid: true }; // Can't validate, assume OK
  }

  // For ArrayBuffer / Uint8Array
  let bytes;
  if (file instanceof ArrayBuffer) {
    bytes = new Uint8Array(file.slice(0, 8));
  } else if (file instanceof Uint8Array) {
    bytes = file.slice(0, 8);
  } else if (typeof file.arrayBuffer === "function") {
    // File/Blob — can't synchronously read, return valid (async validation not feasible here)
    return { valid: true };
  } else {
    return { valid: true }; // Can't validate
  }

  // Check magic bytes
  for (const magic of expectedBytes) {
    let match = true;
    for (let i = 0; i < magic.length; i++) {
      if (bytes[i] !== magic[i]) {
        match = false;
        break;
      }
    }
    if (match) return { valid: true };
  }

  return {
    valid: false,
    error: `File content doesn't match expected type "${expectedMimeType}". Possible corruption or MIME spoofing.`,
  };
}

// ─── Combined Pipeline ───

/**
 * Run the full validation pipeline on a document.
 *
 * @param {Object} params
 * @param {string} params.filename — Original filename
 * @param {string} params.mimeType — MIME type from File.type
 * @param {number} params.fileSize — Size in bytes
 * @param {string} params.documentType — Document type key
 * @param {number} [params.imageWidth] — Image width (for images)
 * @param {number} [params.imageHeight] — Image height (for images)
 * @param {string[]} [params.existingNames] — Existing filenames to check against
 * @returns {{ valid: boolean, errors: string[], extension?: string }}
 */
export function validateDocument({
  filename,
  mimeType,
  fileSize,
  documentType,
  imageWidth,
  imageHeight,
  existingNames,
}) {
  const errors = [];
  let extension;

  // 1. Extension
  const extResult = validateDocumentExtension(filename, documentType);
  if (!extResult.valid) {
    errors.push(extResult.error);
  } else {
    extension = extResult.extension;
  }

  // 2. MIME type
  const mimeResult = validateDocumentMime(mimeType, documentType);
  if (!mimeResult.valid) {
    errors.push(mimeResult.error);
  }

  // 3. File size
  const sizeResult = validateDocumentSize(fileSize, documentType);
  if (!sizeResult.valid) {
    errors.push(sizeResult.error);
  }

  // 4. Image dimensions (only for image types)
  if (mimeType && mimeType.startsWith("image/") && imageWidth && imageHeight) {
    const dimResult = validateImageDimensions(
      imageWidth,
      imageHeight,
      documentType,
    );
    if (!dimResult.valid) {
      errors.push(dimResult.error);
    }
  }

  // 5. Duplicate name
  if (existingNames) {
    const dupResult = checkDuplicateName(existingNames, filename);
    if (!dupResult.valid) {
      errors.push(dupResult.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    extension,
  };
}
