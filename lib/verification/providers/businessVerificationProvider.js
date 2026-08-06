/**
 * Business Verification Provider — Mock implementation.
 *
 * Simulates business verification (GST, PAN, CIN validation).
 * In production, replace with real provider APIs.
 *
 * Status flow: submitted → approved/rejected
 */

import { BaseVerificationProvider } from "../baseProvider";
import { logInfo } from "../secureLogger";

export class BusinessVerificationProvider extends BaseVerificationProvider {
  constructor() {
    super({ providerName: "fundora_internal_business" });
  }

  async initialize() {
    logInfo(
      "BusinessVerificationProvider",
      "Mock business verification provider initialized",
    );
  }

  /**
   * Submit business verification.
   *
   * @param {Object} businessData
   * @param {string} businessData.userId
   * @param {string} businessData.businessName
   * @param {string} businessData.businessType
   * @param {string} [businessData.gstNumber]
   * @param {string} [businessData.panNumber]
   * @returns {Promise<{referenceId: string, status: string}>}
   */
  async submitVerification(businessData) {
    const referenceId = `biz_${businessData.userId}_${Date.now()}`;

    logInfo(
      "BusinessVerificationProvider",
      "Business verification submitted (mock)",
      {
        referenceId,
        businessType: businessData.businessType,
      },
    );

    return {
      referenceId,
      status: "submitted",
    };
  }

  async checkStatus(referenceId) {
    return {
      status: "approved",
      level: 4,
      riskScore: 20,
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
    return 75;
  }

  calculateRiskScore() {
    return 20;
  }

  async cancel(referenceId) {
    logInfo(
      "BusinessVerificationProvider",
      "Business verification cancelled (mock)",
      { referenceId },
    );
    return { success: true };
  }

  async healthCheck() {
    return { healthy: true, provider: "fundora_internal_business" };
  }

  verifyWebhookSignature() {
    return true;
  }
}
