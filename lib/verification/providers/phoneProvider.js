/**
 * PhoneVerificationProvider — SMS-sending provider stub.
 *
 * Extends BaseVerificationProvider for phone verification.
 * Console-log placeholders for SMS sending.
 * Production: integrate with Twilio, MSG91, or similar.
 */

import BaseVerificationProvider from "../baseProvider";
import { logInfo } from "../secureLogger";

export default class PhoneVerificationProvider extends BaseVerificationProvider {
  constructor(config = {}) {
    super({
      providerName: config.providerName || "phone_internal",
      apiKey: config.apiKey || null,
      baseUrl: config.baseUrl || null,
      webhookSecret: config.webhookSecret || null,
    });
  }

  async initialize() {
    logInfo("[PhoneProvider] Initialized:", this.providerName);
    return { success: true };
  }

  async submitVerification(data) {
    logInfo("[PhoneProvider] submitVerification:", {
      phone: data.phone ? `${data.phone.slice(0, 5)}***` : "unknown",
    });

    return {
      success: true,
      reference: `phone_${Date.now()}`,
      status: "processing",
    };
  }

  async checkStatus(reference) {
    logInfo("[PhoneProvider] checkStatus:", reference);
    return { status: "completed", verified: true };
  }

  async handleWebhook(payload) {
    logInfo("[PhoneProvider] handleWebhook");
    return { processed: true };
  }

  mapStatus(providerStatus) {
    const statusMap = {
      pending: "pending",
      sent: "processing",
      verified: "approved",
      failed: "rejected",
      expired: "expired",
    };
    return statusMap[providerStatus] || "pending";
  }

  async calculateTrustScore(data) {
    return { score: 50, confidence: 80 };
  }

  async calculateRiskScore(data) {
    return { score: 10, confidence: 80 };
  }

  async verifyWebhookSignature(payload, signature) {
    return true; // Stub: always valid
  }

  /**
   * Send an SMS with the OTP.
   * @param {string} phone
   * @param {string} otp
   * @returns {Promise<{success: boolean}>}
   */
  async sendSMS(phone, otp) {
    logInfo("[PhoneProvider] sendSMS:", {
      phone: phone ? `${phone.slice(0, 5)}***` : "unknown",
      otp: "***",
    });
    // Production: await twilioClient.messages.create({ ... })
    return { success: true };
  }
}
