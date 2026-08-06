/**
 * OCR Provider Registry — Manages OCR provider registration and retrieval.
 *
 * Pattern: Map-based registry, register before use.
 * Default: FundoraInternalOCRProvider (console-log stub).
 */

import OCRProvider from "./ocrProvider";
import { logError } from "./secureLogger";

// ─── Registry ───

const ocrProviders = new Map();
let defaultOCRProvider = null;

/**
 * Register an OCR provider.
 *
 * @param {string} name — Provider name (e.g., 'fundora_internal', 'stripe_identity')
 * @param {typeof OCRProvider} ProviderClass — Class extending OCRProvider
 */
export function registerOCRProvider(name, ProviderClass) {
  if (!name || typeof name !== "string") {
    throw new Error("OCR provider name is required");
  }
  if (!ProviderClass || !(ProviderClass.prototype instanceof OCRProvider) || ProviderClass === OCRProvider) {
    throw new Error(`Provider class must extend OCRProvider`);
  }
  ocrProviders.set(name, ProviderClass);
}

/**
 * Get an instantiated OCR provider by name.
 *
 * @param {string} name — Provider name
 * @param {Object} [config] — Config to pass to constructor
 * @returns {OCRProvider|null}
 */
export function getOCRProvider(name, config = {}) {
  const ProviderClass = ocrProviders.get(name);
  if (!ProviderClass) {
    logError("OCRRegistry", `Provider "${name}" not registered`);
    return null;
  }
  try {
    return new ProviderClass({ providerName: name, ...config });
  } catch (err) {
    logError("OCRRegistry", `Failed to instantiate "${name}": ${err.message}`);
    return null;
  }
}

/**
 * Get the default OCR provider.
 *
 * @param {Object} [config]
 * @returns {OCRProvider|null}
 */
export function getDefaultOCRProvider(config = {}) {
  if (defaultOCRProvider) return defaultOCRProvider;

  // Try fundora_internal first, then any registered
  const internal = getOCRProvider("fundora_internal", config);
  if (internal) {
    defaultOCRProvider = internal;
    return internal;
  }

  // Fall back to first registered provider
  for (const [name] of ocrProviders) {
    const provider = getOCRProvider(name, config);
    if (provider) {
      defaultOCRProvider = provider;
      return provider;
    }
  }

  return null;
}

/**
 * List all registered OCR providers.
 * @returns {string[]}
 */
export function listOCRProviders() {
  return Array.from(ocrProviders.keys());
}

/**
 * Clear all registered providers (for testing).
 */
export function clearOCRProviders() {
  ocrProviders.clear();
  defaultOCRProvider = null;
}
