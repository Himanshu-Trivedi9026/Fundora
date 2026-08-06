/**
 * GST Verification Provider — Mock implementation.
 *
 * Simulates GST number verification via government APIs.
 * In production, replace with real GST verification API.
 *
 * Status flow: submitted → verified/rejected
 */

import { BaseVerificationProvider } from "../baseProvider";
import { logInfo } from "../secureLogger";

export class GSTVerificationProvider extends BaseVerificationProvider {
  constructor() {
    super({ providerName: "fundora_internal_gst" });
  }

  async initialize() {
    logInfo("GSTVerificationProvider", "Mock GST verification provider initialized");
  }

  /**
   * Submit GST verification.
   *
   * @param {Object} gstData
   * @param {string} gstData.userId
   * @param {string} gstData.gstNumber
   * @param {string} gstData.businessName
   * @returns {Promise<{referenceId: string, status: string}>}
   */
  async submitVerification(gstData) {
    const referenceId = `gst_${gstData.userId}_${Date.now()}`;

    logInfo("GSTVerificationProvider", "GST verification submitted (mock)", {
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
      level: 4,
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
    return 80;
  }

  calculateRiskScore() {
    return 10;
  }

  async cancel(referenceId) {
    logInfo("GSTVerificationProvider", "GST verification cancelled (mock)", { referenceId });
    return { success: true };
  }

  async healthCheck() {
    return { healthy: true, provider: "fundora_internal_gst" };
  }

  verifyWebhookSignature() {
    return true;
  }
}
