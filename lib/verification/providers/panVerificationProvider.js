/**
 * PAN Verification Provider — Mock implementation.
 *
 * Simulates PAN card verification via government APIs.
 * In production, replace with real PAN verification API.
 *
 * Status flow: submitted → verified/rejected
 */

import { BaseVerificationProvider } from "../baseProvider";
import { logInfo } from "../secureLogger";

export class PANVerificationProvider extends BaseVerificationProvider {
  constructor() {
    super({ providerName: "fundora_internal_pan" });
  }

  async initialize() {
    logInfo(
      "PANVerificationProvider",
      "Mock PAN verification provider initialized",
    );
  }

  /**
   * Submit PAN verification.
   *
   * @param {Object} panData
   * @param {string} panData.userId
   * @param {string} panData.panNumber
   * @param {string} panData.fullName
   * @returns {Promise<{referenceId: string, status: string}>}
   */
  async submitVerification(panData) {
    const referenceId = `pan_${panData.userId}_${Date.now()}`;

    logInfo("PANVerificationProvider", "PAN verification submitted (mock)", {
      referenceId,
    });

    return {
      referenceId,
      status: "submitted",
    };
  }

  async checkStatus(referenceId) {
    return {
      status: "verified",
      level: 2,
      riskScore: 10,
    };
  }

  async handleWebhook(payload) {
    return {
      userId: payload.userId || "",
      status: "verified",
      referenceId: payload.referenceId || "",
    };
  }

  mapStatus(providerStatus) {
    const map = {
      submitted: "under_review",
      verified: "approved",
      rejected: "rejected",
    };
    return map[providerStatus] || "pending";
  }

  calculateTrustScore() {
    return 70;
  }

  calculateRiskScore() {
    return 10;
  }

  async cancel(referenceId) {
    logInfo("PANVerificationProvider", "PAN verification cancelled (mock)", {
      referenceId,
    });
    return { success: true };
  }

  async healthCheck() {
    return { healthy: true, provider: "fundora_internal_pan" };
  }

  verifyWebhookSignature() {
    return true;
  }
}
