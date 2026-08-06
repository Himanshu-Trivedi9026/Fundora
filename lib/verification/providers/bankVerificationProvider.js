/**
 * Bank Verification Provider — Mock implementation.
 *
 * Simulates bank account verification.
 * In production, replace with real provider APIs.
 *
 * Status flow: submitted → approved/rejected
 */

import { BaseVerificationProvider } from "../baseProvider";
import { logInfo } from "../secureLogger";

export class BankVerificationProvider extends BaseVerificationProvider {
  constructor() {
    super({ providerName: "fundora_internal_bank" });
  }

  async initialize() {
    logInfo("BankVerificationProvider", "Mock bank verification provider initialized");
  }

  /**
   * Submit bank verification.
   *
   * @param {Object} bankData
   * @param {string} bankData.userId
   * @param {string} bankData.accountHolderName
   * @param {string} bankData.ifscCode
   * @returns {Promise<{referenceId: string, status: string}>}
   */
  async submitVerification(bankData) {
    const referenceId = `bank_${bankData.userId}_${Date.now()}`;

    logInfo("BankVerificationProvider", "Bank verification submitted (mock)", {
      referenceId,
    });

    return {
      referenceId,
      status: "submitted",
    };
  }

  async checkStatus(referenceId) {
    return {
      status: "approved",
      level: 3,
      riskScore: 15,
    };
  }

  async handleWebhook(payload) {
    return {
      userId: payload.userId || "",
      status: "approved",
      referenceId: payload.referenceId || "",
    };
  }

  mapStatus(providerStatus) {
    const map = {
      submitted: "under_review",
      approved: "approved",
      rejected: "rejected",
    };
    return map[providerStatus] || "pending";
  }

  calculateTrustScore() {
    return 65;
  }

  calculateRiskScore() {
    return 15;
  }

  async cancel(referenceId) {
    logInfo("BankVerificationProvider", "Bank verification cancelled (mock)", { referenceId });
    return { success: true };
  }

  async healthCheck() {
    return { healthy: true, provider: "fundora_internal_bank" };
  }

  verifyWebhookSignature() {
    return true;
  }
}
