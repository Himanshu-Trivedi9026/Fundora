/**
 * Provider Adapter — Pluggable payout provider abstraction.
 *
 * Supports multiple payout providers:
 *   - MockPayoutProvider (default, for development/testing)
 *   - RazorpayPayoutProvider (placeholder)
 *   - CashfreePayoutProvider (placeholder)
 *   - StripePayoutProvider (placeholder)
 *
 * All providers implement the same interface:
 *   - createPayout(params) → payout result
 *   - checkPayoutStatus(reference) → status
 *   - cancelPayout(reference) → cancellation result
 *
 * Security:
 *   - Never exposes API keys to frontend
 *   - All provider calls are logged via secureLogger
 *   - API keys are read from environment variables only
 *   - Provider responses are sanitized before storage
 */

import { logInfo, logError, logWarn } from "../verification/secureLogger";

// ─── Provider Registry ───

const providers = new Map();
let activeProvider = null;

// ─── Base Provider ───

/**
 * Abstract base class for payout providers.
 * All payout providers must extend this class.
 */
export class BasePayoutProvider {
  constructor(name) {
    this.name = name;
    this.apiKey = null;
    this.baseUrl = null;
    this.initialized = false;

    if (new.target === BasePayoutProvider) {
      throw new Error(
        "BasePayoutProvider is abstract and cannot be instantiated directly.",
      );
    }
  }

  /**
   * Initialize the provider with API credentials.
   *
   * @param {Object} config — { apiKey, apiSecret, webhookSecret, ... }
   * @returns {Promise<void>}
   */
  async initialize(config) {
    throw new Error("initialize() must be implemented by subclass");
  }

  /**
   * Create a payout to a recipient.
   *
   * @param {Object} params
   * @param {number} params.amount — Payout amount (in cents)
   * @param {string} params.recipientId — Recipient identifier (bank account, UPI, etc.)
   * @param {string} [params.currency='inr'] — Currency code
   * @param {string} [params.reference] — Internal reference ID
   * @param {Object} [params.metadata] — Additional metadata
   * @returns {Promise<{success: boolean, reference?: string, error?: string}>}
   */
  async createPayout(params) {
    throw new Error("createPayout() must be implemented by subclass");
  }

  /**
   * Check the status of a payout.
   *
   * @param {string} reference — Payout reference ID
   * @returns {Promise<{success: boolean, status?: string, details?: Object, error?: string}>}
   */
  async checkPayoutStatus(reference) {
    throw new Error("checkPayoutStatus() must be implemented by subclass");
  }

  /**
   * Handle incoming webhook from the payout provider.
   *
   * @param {Object} payload — Raw webhook payload
   * @param {string} signature — Webhook signature header
   * @returns {Promise<{success: boolean, reference?: string, status?: string, error?: string}>}
   */
  async handleWebhook(payload, signature) {
    throw new Error("handleWebhook() must be implemented by subclass");
  }

  /**
   * Cancel an in-progress payout.
   *
   * @param {string} reference — Payout reference ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async cancelPayout(reference) {
    throw new Error("cancelPayout() must be implemented by subclass");
  }

  /**
   * Check provider health / connectivity.
   *
   * @returns {Promise<{healthy: boolean, provider: string, details?: Object}>}
   */
  async healthCheck() {
    return { healthy: this.initialized, provider: this.name };
  }
}

// ─── Mock Provider (Default) ───

/**
 * Mock payout provider for development and testing.
 * Simulates a payout with a 2-second delay and always succeeds.
 */
export class MockPayoutProvider extends BasePayoutProvider {
  constructor() {
    super("mock");
  }

  /**
   * Initialize the mock provider (no-op).
   * @returns {Promise<void>}
   */
  async initialize() {
    this.initialized = true;
    logInfo("PayoutProvider", "Mock provider initialized");
  }

  /**
   * Create a mock payout. Always succeeds after a 2-second delay.
   *
   * @param {Object} params
   * @param {number} params.amount
   * @param {string} params.recipientId
   * @param {string} [params.currency]
   * @param {string} [params.reference]
   * @returns {Promise<{success: boolean, reference: string}>}
   */
  async createPayout(params) {
    const { amount, recipientId, reference } = params;

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockReference =
      reference ||
      `mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    logInfo("PayoutProvider", "Mock payout created", {
      amount,
      recipientId: recipientId
        ? recipientId.substring(0, 8) + "..."
        : "unknown",
      reference: mockReference,
    });

    return {
      success: true,
      reference: mockReference,
    };
  }

  /**
   * Check mock payout status. Always returns 'completed'.
   * @param {string} reference
   * @returns {Promise<{success: boolean, status: string}>}
   */
  async checkPayoutStatus(reference) {
    return {
      success: true,
      status: "completed",
      details: { reference, mock: true },
    };
  }

  /**
   * Handle mock webhook. Always succeeds.
   * @param {Object} payload
   * @param {string} signature
   * @returns {Promise<{success: boolean, reference: string, status: string}>}
   */
  async handleWebhook(payload, signature) {
    return {
      success: true,
      reference: payload?.reference || "mock_ref",
      status: "completed",
    };
  }

  /**
   * Cancel a mock payout. Always succeeds.
   * @param {string} reference
   * @returns {Promise<{success: boolean}>}
   */
  async cancelPayout(reference) {
    logInfo("PayoutProvider", "Mock payout cancelled", { reference });
    return { success: true };
  }

  /**
   * Mock health check. Always healthy.
   * @returns {Promise<{healthy: boolean, provider: string}>}
   */
  async healthCheck() {
    return { healthy: true, provider: "mock" };
  }
}

// ─── Razorpay Provider (Placeholder) ───

/**
 * Razorpay payout provider.
 * Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.
 */
export class RazorpayPayoutProvider extends BasePayoutProvider {
  constructor() {
    super("razorpay");
  }

  async initialize(config = {}) {
    this.apiKey = config.apiKey || process.env.RAZORPAY_KEY_ID;
    this.apiSecret = config.apiSecret || process.env.RAZORPAY_KEY_SECRET;
    this.baseUrl = config.baseUrl || "https://api.razorpay.com/v1";

    if (!this.apiKey || !this.apiSecret) {
      logWarn("PayoutProvider", "Razorpay credentials not configured");
      return;
    }

    this.initialized = true;
    logInfo("PayoutProvider", "Razorpay provider initialized");
  }

  async createPayout(params) {
    if (!this.initialized) {
      return { success: false, error: "Provider not initialized" };
    }

    // TODO: Implement actual Razorpay payout API call
    // const response = await fetch(`${this.baseUrl}/payouts`, { ... });
    return { success: false, error: "Not implemented" };
  }

  async checkPayoutStatus(reference) {
    if (!this.initialized) {
      return { success: false, error: "Provider not initialized" };
    }

    return { success: false, error: "Not implemented" };
  }

  async handleWebhook(payload, signature) {
    return { success: false, error: "Not implemented" };
  }

  async cancelPayout(reference) {
    return { success: false, error: "Not implemented" };
  }

  async healthCheck() {
    return { healthy: this.initialized, provider: "razorpay" };
  }
}

// ─── Cashfree Provider (Placeholder) ───

/**
 * Cashfree payout provider.
 * Requires CASHFREE_APP_ID and CASHFREE_SECRET_KEY environment variables.
 */
export class CashfreePayoutProvider extends BasePayoutProvider {
  constructor() {
    super("cashfree");
  }

  async initialize(config = {}) {
    this.apiKey = config.apiKey || process.env.CASHFREE_APP_ID;
    this.apiSecret = config.apiSecret || process.env.CASHFREE_SECRET_KEY;
    this.baseUrl = config.baseUrl || "https://api.cashfree.com/pg";

    if (!this.apiKey || !this.apiSecret) {
      logWarn("PayoutProvider", "Cashfree credentials not configured");
      return;
    }

    this.initialized = true;
    logInfo("PayoutProvider", "Cashfree provider initialized");
  }

  async createPayout(params) {
    if (!this.initialized) {
      return { success: false, error: "Provider not initialized" };
    }

    // TODO: Implement actual Cashfree payout API call
    return { success: false, error: "Not implemented" };
  }

  async checkPayoutStatus(reference) {
    if (!this.initialized) {
      return { success: false, error: "Provider not initialized" };
    }

    return { success: false, error: "Not implemented" };
  }

  async handleWebhook(payload, signature) {
    return { success: false, error: "Not implemented" };
  }

  async cancelPayout(reference) {
    return { success: false, error: "Not implemented" };
  }

  async healthCheck() {
    return { healthy: this.initialized, provider: "cashfree" };
  }
}

// ─── Stripe Provider (Placeholder) ───

/**
 * Stripe payout provider.
 * Requires STRIPE_SECRET_KEY environment variable.
 */
export class StripePayoutProvider extends BasePayoutProvider {
  constructor() {
    super("stripe");
  }

  async initialize(config = {}) {
    this.apiKey = config.apiKey || process.env.STRIPE_SECRET_KEY;
    this.baseUrl = config.baseUrl || "https://api.stripe.com/v1";

    if (!this.apiKey) {
      logWarn("PayoutProvider", "Stripe secret key not configured");
      return;
    }

    this.initialized = true;
    logInfo("PayoutProvider", "Stripe provider initialized");
  }

  async createPayout(params) {
    if (!this.initialized) {
      return { success: false, error: "Provider not initialized" };
    }

    // TODO: Implement actual Stripe payout API call
    return { success: false, error: "Not implemented" };
  }

  async checkPayoutStatus(reference) {
    if (!this.initialized) {
      return { success: false, error: "Provider not initialized" };
    }

    return { success: false, error: "Not implemented" };
  }

  async handleWebhook(payload, signature) {
    return { success: false, error: "Not implemented" };
  }

  async cancelPayout(reference) {
    return { success: false, error: "Not implemented" };
  }

  async healthCheck() {
    return { healthy: this.initialized, provider: "stripe" };
  }
}

// ─── Provider Registry Functions ───

/**
 * Register a payout provider.
 *
 * @param {string} name — Provider name (e.g., 'mock', 'razorpay')
 * @param {BasePayoutProvider} provider — Provider instance
 * @throws {Error} If provider does not extend BasePayoutProvider
 */
export function registerProvider(name, provider) {
  if (!(provider instanceof BasePayoutProvider)) {
    throw new Error("Provider must extend BasePayoutProvider");
  }
  providers.set(name, provider);
}

/**
 * Get a registered payout provider by name.
 *
 * @param {string} name — Provider name
 * @returns {BasePayoutProvider|null}
 */
export function getProvider(name) {
  return providers.get(name) || null;
}

/**
 * Set the active payout provider.
 *
 * @param {string} name — Provider name
 */
export function setActiveProvider(name) {
  const provider = providers.get(name);
  if (!provider) {
    logWarn("PayoutProvider", `Provider '${name}' not found`);
    return;
  }
  activeProvider = provider;
  logInfo("PayoutProvider", "Active provider set", { provider: name });
}

/**
 * Get the active payout provider.
 * Falls back to mock provider if none is set.
 *
 * @returns {BasePayoutProvider}
 */
export function getActiveProvider() {
  return activeProvider || providers.get("mock") || new MockPayoutProvider();
}

/**
 * List all registered payout providers.
 *
 * @returns {string[]}
 */
export function listProviders() {
  return Array.from(providers.keys());
}

/**
 * Initialize default payout providers.
 * Registers mock, razorpay, cashfree, and stripe providers.
 * Sets mock as the default active provider.
 */
export function initializeDefaultProviders() {
  registerProvider("mock", new MockPayoutProvider());
  registerProvider("razorpay", new RazorpayPayoutProvider());
  registerProvider("cashfree", new CashfreePayoutProvider());
  registerProvider("stripe", new StripePayoutProvider());

  // Default to mock provider
  setActiveProvider("mock");
}

// Initialize on module load
initializeDefaultProviders();
