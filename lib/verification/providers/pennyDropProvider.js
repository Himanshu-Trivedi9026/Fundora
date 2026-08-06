/**
 * Penny Drop Provider — Mock implementation for bank account verification.
 *
 * Simulates penny drop verification (sending ₹1 to verify account ownership).
 * In production, replace with RazorpayX, Cashfree, Decentro, or similar.
 *
 * Status flow: initiated → success/failed
 */

import { BaseVerificationProvider } from "../baseProvider";
import { logInfo } from "../secureLogger";

export class PennyDropProvider extends BaseVerificationProvider {
  constructor() {
    super({ providerName: "penny_drop_internal" });
  }

  async initialize() {
    logInfo("PennyDropProvider", "Mock penny drop provider initialized");
  }

  /**
   * Submit penny drop verification for a bank account.
   *
   * @param {Object} accountData
   * @param {string} accountData.userId
   * @param {string} accountData.accountNumber — Will be encrypted before storage
   * @param {string} accountData.ifscCode
   * @param {string} accountData.accountHolderName
   * @returns {Promise<{referenceId: string, status: string}>}
   */
  async submitVerification(accountData) {
    const referenceId = `penny_${accountData.userId}_${Date.now()}`;

    logInfo("PennyDropProvider", "Penny drop initiated (mock)", {
      referenceId,
      userId: accountData.userId?.substring(0, 8) + "...",
    });

    // Mock: always succeeds after submission
    return {
      referenceId,
      status: "initiated",
    };
  }

  /**
   * Check penny drop status.
   *
   * @param {string} referenceId
   * @returns {Promise<{status: string, level: number, riskScore: number}>}
   */
  async checkStatus(referenceId) {
    // Mock: always returns success
    return {
      status: "success",
      level: 3,
      riskScore: 15,
    };
  }

  /**
   * Handle penny drop webhook.
   *
   * @param {Object} payload
   * @returns {Promise<{userId: string, status: string, referenceId: string}>}
   */
  async handleWebhook(payload) {
    return {
      userId: payload.userId || "",
      status: "success",
      referenceId: payload.referenceId || "",
    };
  }

  mapStatus(providerStatus) {
    const map = {
      initiated: "pending",
      success: "verified",
      failed: "rejected",
    };
    return map[providerStatus] || "pending";
  }

  calculateTrustScore() {
    return 70;
  }

  calculateRiskScore() {
    return 15;
  }

  async cancel(referenceId) {
    logInfo("PennyDropProvider", "Penny drop cancelled (mock)", { referenceId });
    return { success: true };
  }

  async healthCheck() {
    return { healthy: true, provider: "penny_drop_internal" };
  }

  verifyWebhookSignature() {
    return true;
  }
}
