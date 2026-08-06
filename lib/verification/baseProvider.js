/**
 * BaseVerificationProvider — Abstract base class for KYC/verification providers.
 *
 * All verification providers (Stripe Identity, HyperVerge, Signzy, etc.)
 * must extend this class and implement the required methods.
 *
 * This ensures:
 *   1. Consistent interface across providers
 *   2. Easy provider swapping without changing UI components
 *   3. Type-safe contract for verification operations
 *
 * Usage:
 *   class MyProvider extends BaseVerificationProvider {
 *     async submitVerification(userData) { ... }
 *     async checkStatus(referenceId) { ... }
 *     async webHookHandler(payload) { ... }
 *   }
 */

export class BaseVerificationProvider {
  constructor(config = {}) {
    if (new.target === BaseVerificationProvider) {
      throw new Error(
        "BaseVerificationProvider is abstract and cannot be instantiated directly.",
      );
    }

    this.providerName = config.providerName || "unknown";
    this.apiKey = config.apiKey || null;
    this.baseUrl = config.baseUrl || null;
    this.webhookSecret = config.webhookSecret || null;
  }

  /**
   * Initialize the provider with API credentials.
   * Called once when the platform starts.
   *
   * @param {Object} credentials — { apiKey, apiSecret, webhookSecret, ... }
   * @returns {Promise<void>}
   */
  async initialize(credentials) {
    throw new Error("initialize() must be implemented by subclass");
  }

  /**
   * Submit identity verification for a user.
   *
   * @param {Object} userData
   * @param {string} userData.userId — Supabase user ID
   * @param {string} userData.fullName — Full legal name
   * @param {string} userData.email — Email address
   * @param {string} [userData.phone] — Phone number
   * @param {Object} [userData.idDocument] — Government ID document
   * @param {Object} [userData.selfie] — Selfie photo
   * @returns {Promise<{referenceId: string, status: string}>}
   */
  async submitVerification(userData) {
    throw new Error("submitVerification() must be implemented by subclass");
  }

  /**
   * Check the status of a verification request.
   *
   * @param {string} referenceId — Provider's reference ID
   * @returns {Promise<{status: string, level: number, riskScore: number}>}
   */
  async checkStatus(referenceId) {
    throw new Error("checkStatus() must be implemented by subclass");
  }

  /**
   * Handle incoming webhook from the provider.
   *
   * @param {Object} payload — Raw webhook payload
   * @param {string} signature — Webhook signature header
   * @returns {Promise<{userId: string, status: string, referenceId: string}>}
   */
  async handleWebhook(payload, signature) {
    throw new Error("handleWebhook() must be implemented by subclass");
  }

  /**
   * Map provider-specific status to Fundora's verification_status.
   *
   * @param {string} providerStatus — Provider's status string
   * @returns {'pending' | 'under_review' | 'approved' | 'rejected' | 'expired'}
   */
  mapStatus(providerStatus) {
    throw new Error("mapStatus() must be implemented by subclass");
  }

  /**
   * Calculate trust score from provider data.
   *
   * @param {Object} providerData — Data from the provider
   * @returns {number} 0-100 trust score
   */
  calculateTrustScore(providerData) {
    throw new Error("calculateTrustScore() must be implemented by subclass");
  }

  /**
   * Calculate risk score from provider data.
   *
   * @param {Object} providerData — Data from the provider
   * @returns {number} 0-100 risk score
   */
  calculateRiskScore(providerData) {
    throw new Error("calculateRiskScore() must be implemented by subclass");
  }

  /**
   * Verify webhook signature (timing-safe).
   *
   * @param {string} payload — Raw body string
   * @param {string} signature — Signature from header
   * @returns {boolean}
   */
  verifyWebhookSignature(payload, signature) {
    throw new Error("verifyWebhookSignature() must be implemented by subclass");
  }

  /**
   * Cancel an in-progress verification.
   *
   * @param {string} referenceId — Provider's reference ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async cancel(referenceId) {
    throw new Error("cancel() must be implemented by provider");
  }

  /**
   * Check provider health / connectivity.
   *
   * @returns {Promise<{healthy: boolean, provider: string, details?: Object}>}
   */
  async healthCheck() {
    return { healthy: true, provider: this.providerName };
  }

  /**
   * Generic submit method — alias for submitVerification.
   * Newer providers should implement this instead.
   *
   * @param {Object} data — Submission data
   * @returns {Promise<{referenceId: string, status: string}>}
   */
  async submit(data) {
    return this.submitVerification(data);
  }
}
