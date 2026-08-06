// Payment Provider Adapter — extends the existing payout system with global payment providers
// Follows the provider adapter pattern from lib/escrow/providerAdapter.js

import { supabaseAdmin } from "../supabaseAdmin.js";
import { secureLogger } from "../verification/secureLogger.js";

class BasePaymentProvider {
  async initialize(config) {
    throw new Error("Not implemented");
  }
  async createPayout(params) {
    throw new Error("Not implemented");
  }
  async checkStatus(transactionId) {
    throw new Error("Not implemented");
  }
  async cancelPayout(transactionId) {
    throw new Error("Not implemented");
  }
  async getBalance() {
    throw new Error("Not implemented");
  }
  async validateAccount(accountDetails) {
    throw new Error("Not implemented");
  }
  async healthCheck() {
    throw new Error("Not implemented");
  }
  get name() {
    return this.constructor.name;
  }
  get supportedCurrencies() {
    return [];
  }
  get supportedCountries() {
    return [];
  }
}

class MockPaymentProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super();
    this.config = config;
    this._delay = config.delay || 1000;
    this._failRate = config.failRate || 0;
  }

  async initialize() {
    return { success: true };
  }

  async createPayout(params) {
    await this._simulateDelay();
    if (Math.random() < this._failRate) {
      return { success: false, error: "Simulated payout failure" };
    }
    return {
      success: true,
      data: {
        transactionId: `mock_txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: "completed",
        fee: Math.round((params.amount || 0) * 0.02),
        netAmount: Math.round((params.amount || 0) * 0.98),
      },
    };
  }

  async checkStatus(transactionId) {
    return { success: true, data: { transactionId, status: "completed" } };
  }

  async cancelPayout() {
    return { success: true, data: { status: "cancelled" } };
  }

  async getBalance() {
    return { success: true, data: { available: 10000000, currency: "USD" } };
  }

  async validateAccount() {
    return { success: true, data: { valid: true } };
  }

  async healthCheck() {
    return { success: true, data: { healthy: true, latencyMs: 50 } };
  }

  get name() {
    return "Mock";
  }
  get supportedCurrencies() {
    return ["INR", "USD", "EUR", "GBP", "CAD", "AUD", "SGD", "AED", "CHF"];
  }
  get supportedCountries() {
    return ["IN", "US", "GB", "DE", "FR", "CA", "AU", "SG", "AE", "CH"];
  }

  async _simulateDelay() {
    return new Promise((r) => setTimeout(r, this._delay));
  }
}

class StripePaymentProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super();
    this.config = config;
  }

  async initialize() {
    // Mock: In production would initialize Stripe SDK
    return { success: true, data: { initialized: true, mode: "mock" } };
  }

  async createPayout(params) {
    return {
      success: true,
      data: {
        transactionId: `str_${Date.now()}`,
        status: "completed",
        fee: Math.round((params.amount || 0) * 0.025),
        netAmount: Math.round((params.amount || 0) * 0.975),
      },
    };
  }

  async checkStatus(transactionId) {
    return {
      success: true,
      data: { transactionId, status: "completed", provider: "stripe" },
    };
  }

  async cancelPayout() {
    return { success: true, data: { status: "cancelled" } };
  }

  async getBalance() {
    return {
      success: true,
      data: { available: 5000000, currency: "USD", pending: 200000 },
    };
  }

  async validateAccount(accountDetails) {
    return { success: true, data: { valid: true, accountType: "individual" } };
  }

  async healthCheck() {
    return { success: true, data: { healthy: true, latencyMs: 120 } };
  }

  get name() {
    return "Stripe";
  }
  get supportedCurrencies() {
    return ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SGD"];
  }
  get supportedCountries() {
    return ["US", "GB", "DE", "FR", "CA", "AU", "SG", "CH", "IE", "NL"];
  }
}

class PayPalPaymentProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super();
    this.config = config;
  }

  async initialize() {
    return { success: true, data: { initialized: true, mode: "mock" } };
  }

  async createPayout(params) {
    return {
      success: true,
      data: {
        transactionId: `pp_${Date.now()}`,
        status: "completed",
        fee: Math.round((params.amount || 0) * 0.029) + 30,
        netAmount: Math.round((params.amount || 0) * 0.971) - 30,
      },
    };
  }

  async checkStatus(transactionId) {
    return {
      success: true,
      data: { transactionId, status: "completed", provider: "paypal" },
    };
  }

  async cancelPayout() {
    return { success: true, data: { status: "cancelled" } };
  }

  async getBalance() {
    return { success: true, data: { available: 3000000, currency: "USD" } };
  }

  async validateAccount(accountDetails) {
    return {
      success: true,
      data: { valid: true, email: accountDetails.email },
    };
  }

  async healthCheck() {
    return { success: true, data: { healthy: true, latencyMs: 200 } };
  }

  get name() {
    return "PayPal";
  }
  get supportedCurrencies() {
    return ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
  }
  get supportedCountries() {
    return ["US", "GB", "DE", "FR", "IT", "ES", "CA", "AU"];
  }
}

class WisePaymentProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super();
    this.config = config;
  }

  async initialize() {
    return { success: true, data: { initialized: true, mode: "mock" } };
  }

  async createPayout(params) {
    const fee = Math.max(50, Math.round((params.amount || 0) * 0.005));
    return {
      success: true,
      data: {
        transactionId: `wise_${Date.now()}`,
        status: "completed",
        fee,
        netAmount: Math.round(params.amount || 0) - fee,
        exchangeRate: 1.0,
      },
    };
  }

  async checkStatus(transactionId) {
    return {
      success: true,
      data: { transactionId, status: "completed", provider: "wise" },
    };
  }

  async cancelPayout() {
    return { success: true, data: { status: "cancelled" } };
  }

  async getBalance() {
    return {
      success: true,
      data: {
        available: 2000000,
        currency: "USD",
        balances: { USD: 1000000, EUR: 800000, GBP: 200000 },
      },
    };
  }

  async validateAccount(accountDetails) {
    return {
      success: true,
      data: { valid: true, currency: accountDetails.currency },
    };
  }

  async healthCheck() {
    return { success: true, data: { healthy: true, latencyMs: 150 } };
  }

  get name() {
    return "Wise";
  }
  get supportedCurrencies() {
    return [
      "USD",
      "EUR",
      "GBP",
      "INR",
      "CAD",
      "AUD",
      "CHF",
      "SGD",
      "AED",
      "JPY",
    ];
  }
  get supportedCountries() {
    return ["IN", "US", "GB", "DE", "FR", "CA", "AU", "SG", "AE", "CH", "JP"];
  }
}

class AdyenPaymentProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super();
    this.config = config;
  }

  async initialize() {
    return { success: true, data: { initialized: true, mode: "mock" } };
  }

  async createPayout(params) {
    return {
      success: true,
      data: {
        transactionId: `ady_${Date.now()}`,
        pspReference: `psp_${Date.now()}`,
        status: "completed",
        fee: Math.round((params.amount || 0) * 0.018),
        netAmount: Math.round((params.amount || 0) * 0.982),
      },
    };
  }

  async checkStatus(transactionId) {
    return {
      success: true,
      data: { transactionId, status: "completed", provider: "adyen" },
    };
  }

  async cancelPayout() {
    return { success: true, data: { status: "cancelled" } };
  }
  async getBalance() {
    return { success: true, data: { available: 8000000, currency: "EUR" } };
  }
  async validateAccount() {
    return { success: true, data: { valid: true } };
  }
  async healthCheck() {
    return { success: true, data: { healthy: true, latencyMs: 100 } };
  }
  get name() {
    return "Adyen";
  }
  get supportedCurrencies() {
    return ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "SGD", "AED", "JPY"];
  }
  get supportedCountries() {
    return [
      "US",
      "GB",
      "DE",
      "FR",
      "NL",
      "ES",
      "IT",
      "CA",
      "AU",
      "AE",
      "JP",
      "SG",
    ];
  }
}

class RazorpayPayoutProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super();
    this.config = config;
  }

  async initialize() {
    return { success: true, data: { initialized: true, mode: "mock" } };
  }

  async createPayout(params) {
    return {
      success: true,
      data: {
        transactionId: `rzp_${Date.now()}`,
        status: "completed",
        fee: Math.round((params.amount || 0) * 0.02),
        netAmount: Math.round((params.amount || 0) * 0.98),
        utr: `UTR${Date.now()}`,
      },
    };
  }

  async checkStatus(transactionId) {
    return {
      success: true,
      data: { transactionId, status: "completed", provider: "razorpay" },
    };
  }

  async cancelPayout() {
    return { success: true, data: { status: "cancelled" } };
  }
  async getBalance() {
    return { success: true, data: { available: 10000000, currency: "INR" } };
  }
  async validateAccount(accountDetails) {
    return { success: true, data: { valid: true, bankName: "Mock Bank" } };
  }
  async healthCheck() {
    return { success: true, data: { healthy: true, latencyMs: 80 } };
  }
  get name() {
    return "Razorpay";
  }
  get supportedCurrencies() {
    return ["INR"];
  }
  get supportedCountries() {
    return ["IN"];
  }
}

class CashfreePaymentProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super();
    this.config = config;
  }

  async initialize() {
    return { success: true, data: { initialized: true, mode: "mock" } };
  }

  async createPayout(params) {
    return {
      success: true,
      data: {
        transactionId: `cf_${Date.now()}`,
        status: "completed",
        fee: Math.round((params.amount || 0) * 0.015),
        netAmount: Math.round((params.amount || 0) * 0.985),
        beneficiaryAccount: params.accountNumber?.slice(-4) || "0000",
      },
    };
  }

  async checkStatus(transactionId) {
    return {
      success: true,
      data: { transactionId, status: "completed", provider: "cashfree" },
    };
  }

  async cancelPayout() {
    return { success: true, data: { status: "cancelled" } };
  }
  async getBalance() {
    return { success: true, data: { available: 5000000, currency: "INR" } };
  }
  async validateAccount() {
    return { success: true, data: { valid: true } };
  }
  async healthCheck() {
    return { success: true, data: { healthy: true, latencyMs: 60 } };
  }
  get name() {
    return "Cashfree";
  }
  get supportedCurrencies() {
    return ["INR"];
  }
  get supportedCountries() {
    return ["IN"];
  }
}

// — Registry —

const _providers = new Map();
let _activeProvider = null;

export function registerPaymentProvider(name, provider) {
  if (!name || !provider) {
    return { success: false, error: "name and provider are required" };
  }
  _providers.set(name, provider);
  if (!_activeProvider) _activeProvider = name;
  return {
    success: true,
    data: { name, supportedCurrencies: provider.supportedCurrencies },
  };
}

export function setActivePaymentProvider(name) {
  if (!_providers.has(name)) {
    return { success: false, error: `Provider '${name}' not registered` };
  }
  _activeProvider = name;
  return { success: true };
}

export function getActivePaymentProvider() {
  if (!_activeProvider) return null;
  return _providers.get(_activeProvider) || null;
}

export function getPaymentProvider(name) {
  return _providers.get(name) || null;
}

export function listPaymentProviders() {
  return Array.from(_providers.entries()).map(([name, provider]) => ({
    name,
    supportedCurrencies: provider.supportedCurrencies,
    supportedCountries: provider.supportedCountries,
    isActive: name === _activeProvider,
  }));
}

export function initializePaymentProviders() {
  const providers = [
    ["mock", new MockPaymentProvider()],
    ["stripe", new StripePaymentProvider()],
    ["paypal", new PayPalPaymentProvider()],
    ["wise", new WisePaymentProvider()],
    ["adyen", new AdyenPaymentProvider()],
    ["razorpay", new RazorpayPayoutProvider()],
    ["cashfree", new CashfreePaymentProvider()],
  ];

  for (const [name, provider] of providers) {
    registerPaymentProvider(name, provider);
  }

  _activeProvider = "mock";
  return {
    success: true,
    data: { count: providers.length, active: _activeProvider },
  };
}

export {
  BasePaymentProvider,
  MockPaymentProvider,
  StripePaymentProvider,
  PayPalPaymentProvider,
  WisePaymentProvider,
  AdyenPaymentProvider,
  RazorpayPayoutProvider,
  CashfreePaymentProvider,
};
