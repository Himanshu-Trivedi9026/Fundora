/**
 * VerificationProvider — Registry and factory for KYC providers.
 *
 * This module manages the pluggable verification provider architecture.
 * When a new KYC provider is added, register it here.
 *
 * Currently supported providers:
 *   - 'fundora_internal' (default — manual review)
 *   - 'stripe_identity' (placeholder)
 *   - 'hyperverge' (placeholder)
 *   - 'signzy' (placeholder)
 *   - 'onfido' (placeholder)
 *   - 'persona' (placeholder)
 *
 * Usage:
 *   import { getProvider, registerProvider } from "@/lib/verification/provider";
 *   const provider = getProvider('fundora_internal');
 *   const result = await provider.submitVerification(userData);
 */

import { BaseVerificationProvider } from "./baseProvider";
import { logWarn } from "./secureLogger";

/**
 * Fundora Internal Provider — Default provider using manual review.
 * No external API calls; just records the verification request.
 */
class FundoraInternalProvider extends BaseVerificationProvider {
  constructor() {
    super({ providerName: "fundora_internal" });
  }

  async initialize() {
    // No external API needed
  }

  async submitVerification(userData) {
    // Record is already created by the signup trigger.
    // For manual review, we just update status to 'under_review'.
    return {
      referenceId: `internal_${userData.userId}_${Date.now()}`,
      status: "under_review",
    };
  }

  async checkStatus(referenceId) {
    // Internal provider — status managed manually
    return { status: "under_review", level: 0, riskScore: 0 };
  }

  async handleWebhook() {
    // No webhooks for internal provider
    return null;
  }

  mapStatus(providerStatus) {
    const map = {
      submitted: "under_review",
      approved: "approved",
      rejected: "rejected",
      expired: "expired",
    };
    return map[providerStatus] || "pending";
  }

  calculateTrustScore() {
    // Default trust score for manual review
    return 50;
  }

  calculateRiskScore() {
    // Default risk score
    return 25;
  }

  verifyWebhookSignature() {
    return true;
  }
}

// Provider registry
const providers = new Map();

// Register default provider
providers.set("fundora_internal", new FundoraInternalProvider());

// ─── Phase 4 Providers ───

import { PennyDropProvider } from "./providers/pennyDropProvider";
import { BusinessVerificationProvider } from "./providers/businessVerificationProvider";
import { BankVerificationProvider } from "./providers/bankVerificationProvider";
import { GSTVerificationProvider } from "./providers/gstVerificationProvider";
import { PANVerificationProvider } from "./providers/panVerificationProvider";

providers.set("penny_drop_internal", new PennyDropProvider());
providers.set("fundora_internal_business", new BusinessVerificationProvider());
providers.set("fundora_internal_bank", new BankVerificationProvider());
providers.set("fundora_internal_gst", new GSTVerificationProvider());
providers.set("fundora_internal_pan", new PANVerificationProvider());

/**
 * Register a new verification provider.
 *
 * @param {string} name — Provider identifier
 * @param {BaseVerificationProvider} providerInstance — Provider instance
 */
export function registerProvider(name, providerInstance) {
  if (!(providerInstance instanceof BaseVerificationProvider)) {
    throw new Error("Provider must extend BaseVerificationProvider");
  }
  providers.set(name, providerInstance);
}

/**
 * Get a registered provider by name.
 *
 * @param {string} name — Provider identifier (default: 'fundora_internal')
 * @returns {BaseVerificationProvider}
 */
export function getProvider(name = "fundora_internal") {
  const provider = providers.get(name);
  if (!provider) {
    logWarn(
      "VerificationProvider",
      `Provider '${name}' not found, falling back to 'fundora_internal'`,
    );
    return providers.get("fundora_internal");
  }
  return provider;
}

/**
 * List all registered providers.
 *
 * @returns {string[]}
 */
export function listProviders() {
  return Array.from(providers.keys());
}

/**
 * Initialize a provider with credentials.
 *
 * @param {string} name — Provider identifier
 * @param {Object} credentials — API credentials
 */
export async function initializeProvider(name, credentials) {
  const provider = getProvider(name);
  await provider.initialize(credentials);
  return provider;
}

// ─── OCR Provider Integration ───

import {
  getOCRProvider,
  listOCRProviders,
  registerOCRProvider,
} from "./ocrProviderRegistry";

/**
 * Get an OCR provider by name.
 * @param {string} name — OCR provider name
 * @param {Object} [config] — Config for the provider
 * @returns {OCRProvider|null}
 */
export function getOCRProviderByName(name, config = {}) {
  return getOCRProvider(name, config);
}

/**
 * List all registered OCR providers.
 * @returns {string[]}
 */
export function listOCRProviderNames() {
  return listOCRProviders();
}

/**
 * Register an OCR provider.
 * @param {string} name
 * @param {typeof OCRProvider} ProviderClass
 */
export function registerOCR(name, ProviderClass) {
  registerOCRProvider(name, ProviderClass);
}

// ─── Provider Capabilities ───

const PROVIDER_CAPABILITIES = {
  fundora_internal: {
    name: "Fundora Internal",
    type: "manual_review",
    supports: ["identity", "phone", "bank", "business", "selfie", "address"],
    ocr: false,
    faceMatch: false,
    liveness: false,
  },
  stripe_identity: {
    name: "Stripe Identity",
    type: "automated",
    supports: ["identity", "selfie"],
    ocr: true,
    faceMatch: true,
    liveness: true,
  },
  hyperverge: {
    name: "HyperVerge",
    type: "automated",
    supports: ["identity", "selfie", "phone"],
    ocr: true,
    faceMatch: true,
    liveness: true,
  },
  signzy: {
    name: "Signzy",
    type: "automated",
    supports: ["identity", "selfie", "business"],
    ocr: true,
    faceMatch: true,
    liveness: false,
  },
  onfido: {
    name: "Onfido",
    type: "automated",
    supports: ["identity", "selfie"],
    ocr: true,
    faceMatch: true,
    liveness: true,
  },
  persona: {
    name: "Persona",
    type: "automated",
    supports: ["identity", "selfie", "phone"],
    ocr: true,
    faceMatch: true,
    liveness: true,
  },
  // Phase 4 providers
  penny_drop_internal: {
    name: "Penny Drop (Internal)",
    type: "mock",
    supports: ["bank"],
    ocr: false,
    faceMatch: false,
    liveness: false,
  },
  fundora_internal_business: {
    name: "Business Verification (Internal)",
    type: "mock",
    supports: ["business"],
    ocr: false,
    faceMatch: false,
    liveness: false,
  },
  fundora_internal_bank: {
    name: "Bank Verification (Internal)",
    type: "mock",
    supports: ["bank"],
    ocr: false,
    faceMatch: false,
    liveness: false,
  },
  fundora_internal_gst: {
    name: "GST Verification (Internal)",
    type: "mock",
    supports: ["business"],
    ocr: false,
    faceMatch: false,
    liveness: false,
  },
  fundora_internal_pan: {
    name: "PAN Verification (Internal)",
    type: "mock",
    supports: ["identity"],
    ocr: false,
    faceMatch: false,
    liveness: false,
  },
};

/**
 * Get capabilities for a provider.
 * @param {string} name — Provider name
 * @returns {Object|null}
 */
export function getProviderCapabilities(name) {
  return PROVIDER_CAPABILITIES[name] || null;
}

/**
 * List all providers with their capabilities.
 * @returns {Object}
 */
export function listProviderCapabilities() {
  return PROVIDER_CAPABILITIES;
}

export { FundoraInternalProvider };
