/**
 * Document Requirements Engine — Configuration-driven document validation.
 *
 * Instead of hardcoding required documents per business type,
 * this module provides a configuration that the UI and validation
 * logic can consume dynamically.
 *
 * Adding a new business type or document requirement only requires
 * updating the configuration objects below — no logic changes needed.
 */

// ─── Business Document Requirements ───
// Maps business type → required document types

export const BUSINESS_DOCUMENT_REQUIREMENTS = {
  individual: ["pan_card", "aadhaar_card", "address_proof"],
  sole_proprietorship: [
    "gst_certificate",
    "pan_card",
    "business_address_proof",
    "cancelled_cheque",
  ],
  partnership: [
    "partnership_deed",
    "gst_certificate",
    "pan_card",
    "business_address_proof",
    "director_identity_proof",
  ],
  llp: [
    "certificate_of_incorporation",
    "gst_certificate",
    "pan_card",
    "partnership_deed",
  ],
  private_limited: [
    "certificate_of_incorporation",
    "gst_certificate",
    "moa",
    "aoa",
    "director_identity_proof",
  ],
  public_limited: [
    "certificate_of_incorporation",
    "gst_certificate",
    "moa",
    "aoa",
    "director_identity_proof",
  ],
  ngo: [
    "trust_registration",
    "gst_certificate",
    "pan_card",
    "business_address_proof",
  ],
  trust: [
    "trust_registration",
    "gst_certificate",
    "pan_card",
    "business_address_proof",
  ],
  society: [
    "society_registration",
    "gst_certificate",
    "pan_card",
    "business_address_proof",
  ],
  startup: [
    "certificate_of_incorporation",
    "gst_certificate",
    "udyam_registration",
    "moa",
    "pan_card",
  ],
  government: ["pan_card", "business_address_proof"],
};

// ─── Bank Document Requirements ───

export const BANK_DOCUMENT_REQUIREMENTS = {
  verification: ["cancelled_cheque", "bank_statement"],
  optional: ["bank_passbook", "address_proof"],
};

// ─── Business Type Labels ───

export const BUSINESS_TYPE_LABELS = {
  individual: "Individual",
  sole_proprietorship: "Sole Proprietorship",
  partnership: "Partnership",
  llp: "Limited Liability Partnership (LLP)",
  private_limited: "Private Limited Company",
  public_limited: "Public Limited Company",
  ngo: "Non-Governmental Organization (NGO)",
  trust: "Trust",
  society: "Society",
  startup: "Startup",
  government: "Government Organization",
};

// ─── Document Type Labels ───

export const DOCUMENT_TYPE_LABELS = {
  gst_certificate: "GST Certificate",
  pan_card: "PAN Card",
  aadhaar_card: "Aadhaar Card",
  certificate_of_incorporation: "Certificate of Incorporation",
  udyam_registration: "Udyam Registration Certificate",
  trade_license: "Trade License",
  msme_certificate: "MSME Certificate",
  partnership_deed: "Partnership Deed",
  trust_registration: "Trust Registration Certificate",
  society_registration: "Society Registration Certificate",
  moa: "Memorandum of Association (MOA)",
  aoa: "Articles of Association (AOA)",
  cancelled_cheque: "Cancelled Cheque",
  bank_statement: "Bank Statement",
  bank_passbook: "Bank Passbook",
  address_proof: "Address Proof",
  business_address_proof: "Business Address Proof",
  director_identity_proof: "Director's Identity Proof",
  director_address_proof: "Director's Address Proof",
  utility_bill: "Utility Bill",
};

// ─── Helper Functions ───

/**
 * Get required documents for a business type.
 *
 * @param {string} businessType — One of the BUSINESS_DOCUMENT_REQUIREMENTS keys
 * @returns {string[]} Array of required document type strings
 */
export function getRequiredDocuments(businessType) {
  return BUSINESS_DOCUMENT_REQUIREMENTS[businessType] || [];
}

/**
 * Get bank document requirements.
 *
 * @returns {{ verification: string[], optional: string[] }}
 */
export function getBankDocuments() {
  return BANK_DOCUMENT_REQUIREMENTS;
}

/**
 * Get list of missing documents given what's been provided.
 *
 * @param {string[]} providedTypes — Document types already uploaded
 * @param {string} businessType — Business type to check requirements for
 * @returns {string[]} Missing document types
 */
export function getMissingDocuments(providedTypes, businessType) {
  const required = getRequiredDocuments(businessType);
  return required.filter((t) => !providedTypes.includes(t));
}

/**
 * Check if all required documents have been provided.
 *
 * @param {string[]} providedTypes — Document types already uploaded
 * @param {string} businessType — Business type
 * @returns {{ complete: boolean, missing: string[], progress: number }}
 */
export function checkDocumentCompletion(providedTypes, businessType) {
  const required = getRequiredDocuments(businessType);
  const missing = required.filter((t) => !providedTypes.includes(t));
  const progress =
    required.length > 0
      ? Math.round(((required.length - missing.length) / required.length) * 100)
      : 0;

  return {
    complete: missing.length === 0,
    missing,
    progress,
    total: required.length,
    provided: required.length - missing.length,
  };
}

/**
 * Get label for a document type.
 *
 * @param {string} documentType
 * @returns {string}
 */
export function getDocumentLabel(documentType) {
  return DOCUMENT_TYPE_LABELS[documentType] || documentType;
}

/**
 * Get label for a business type.
 *
 * @param {string} businessType
 * @returns {string}
 */
export function getBusinessTypeLabel(businessType) {
  return BUSINESS_TYPE_LABELS[businessType] || businessType;
}

/**
 * List all supported business types.
 *
 * @returns {string[]}
 */
export function listBusinessTypes() {
  return Object.keys(BUSINESS_DOCUMENT_REQUIREMENTS);
}
