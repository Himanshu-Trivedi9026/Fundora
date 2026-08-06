/**
 * Risk Signal Providers — Configurable signal providers for fraud detection.
 *
 * Each provider:
 *   - Fetches data from a specific source
 *   - Returns a signal value with confidence
 *   - Can be enabled/disabled via configuration
 *
 * Signal categories:
 *   - identity: Email, phone, ID verification signals
 *   - verification: Document and KYC verification signals
 *   - behavior: Login, donation, campaign creation patterns
 *   - device: Fingerprint, browser, platform signals
 *   - velocity: Rate-based signals (events per time window)
 *   - duplicate: Cross-user uniqueness signals
 *   - reputation: Trust score and community signals
 *   - external: Third-party data signals (email domain, IP geolocation)
 *
 * Security:
 *   - All signals are sanitized before storage
 *   - Never expose raw provider responses
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../../supabaseAdmin";
import { logError } from "../../verification/secureLogger";

// ─── Signal Provider Base ───

/**
 * Base class for signal providers.
 */
class SignalProvider {
  constructor(name, category) {
    this.name = name;
    this.category = category;
    this.enabled = true;
    this.weight = 10; // Default weight (0-100)
  }

  /**
   * Collect signal data for a user.
   * @param {string} userId
   * @param {Object} context
   * @returns {Promise<{value: any, confidence: number, metadata: Object}>}
   */
  async collect(userId, context) {
    throw new Error("collect() must be implemented by subclass");
  }
}

// ─── Identity Signals ───

/**
 * Email verification signal.
 */
class EmailVerificationSignal extends SignalProvider {
  constructor() {
    super("email_verification", "identity");
    this.weight = 5;
  }

  async collect(userId) {
    try {
      const { data } = await supabaseAdmin
        .from("creator_verifications")
        .select("email_verified")
        .eq("user_id", userId)
        .single();

      return {
        value: data?.email_verified || false,
        confidence: data?.email_verified ? 90 : 30,
        metadata: { source: "creator_verifications" },
      };
    } catch {
      return { value: false, confidence: 0, metadata: {} };
    }
  }
}

/**
 * Phone verification signal.
 */
class PhoneVerificationSignal extends SignalProvider {
  constructor() {
    super("phone_verification", "identity");
    this.weight = 10;
  }

  async collect(userId) {
    try {
      const { data } = await supabaseAdmin
        .from("creator_verifications")
        .select("phone_verified")
        .eq("user_id", userId)
        .single();

      return {
        value: data?.phone_verified || false,
        confidence: data?.phone_verified ? 90 : 30,
        metadata: { source: "creator_verifications" },
      };
    } catch {
      return { value: false, confidence: 0, metadata: {} };
    }
  }
}

/**
 * Identity verification signal.
 */
class IdentityVerificationSignal extends SignalProvider {
  constructor() {
    super("identity_verification", "identity");
    this.weight = 25;
  }

  async collect(userId) {
    try {
      const { data } = await supabaseAdmin
        .from("creator_verifications")
        .select("identity_verified, verification_level")
        .eq("user_id", userId)
        .single();

      return {
        value: data?.identity_verified || false,
        confidence: data?.identity_verified ? 95 : 20,
        metadata: { verificationLevel: data?.verification_level || 0 },
      };
    } catch {
      return { value: false, confidence: 0, metadata: {} };
    }
  }
}

// ─── Verification Signals ───

/**
 * Bank verification signal.
 */
class BankVerificationSignal extends SignalProvider {
  constructor() {
    super("bank_verification", "verification");
    this.weight = 20;
  }

  async collect(userId) {
    try {
      const { data } = await supabaseAdmin
        .from("creator_verifications")
        .select("bank_verified")
        .eq("user_id", userId)
        .single();

      return {
        value: data?.bank_verified || false,
        confidence: data?.bank_verified ? 90 : 25,
        metadata: { source: "creator_verifications" },
      };
    } catch {
      return { value: false, confidence: 0, metadata: {} };
    }
  }
}

/**
 * Business verification signal.
 */
class BusinessVerificationSignal extends SignalProvider {
  constructor() {
    super("business_verification", "verification");
    this.weight = 25;
  }

  async collect(userId) {
    try {
      const { data } = await supabaseAdmin
        .from("creator_verifications")
        .select("business_verified")
        .eq("user_id", userId)
        .single();

      return {
        value: data?.business_verified || false,
        confidence: data?.business_verified ? 90 : 20,
        metadata: { source: "creator_verifications" },
      };
    } catch {
      return { value: false, confidence: 0, metadata: {} };
    }
  }
}

// ─── Behavior Signals ───

/**
 * Login frequency signal.
 */
class LoginFrequencySignal extends SignalProvider {
  constructor() {
    super("login_frequency", "behavior");
    this.weight = 8;
  }

  async collect(userId) {
    try {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("behavior_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "login")
        .gte("created_at", dayAgo);

      const loginCount = count || 0;
      // Normal: 1-5 logins/day, suspicious: >10
      const isNormal = loginCount >= 1 && loginCount <= 5;
      const isSuspicious = loginCount > 10;

      return {
        value: { count: loginCount, isNormal, isSuspicious },
        confidence: isSuspicious ? 80 : 60,
        metadata: { window: "24h" },
      };
    } catch {
      return {
        value: { count: 0, isNormal: false, isSuspicious: false },
        confidence: 0,
        metadata: {},
      };
    }
  }
}

/**
 * Donation velocity signal.
 */
class DonationVelocitySignal extends SignalProvider {
  constructor() {
    super("donation_velocity", "behavior");
    this.weight = 15;
  }

  async collect(userId) {
    try {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("behavior_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "donation")
        .gte("created_at", hourAgo);

      const donationCount = count || 0;
      // Suspicious: 5+ donations in 1 hour
      const isSuspicious = donationCount >= 5;

      return {
        value: { count: donationCount, isSuspicious },
        confidence: isSuspicious ? 85 : 50,
        metadata: { window: "1h" },
      };
    } catch {
      return {
        value: { count: 0, isSuspicious: false },
        confidence: 0,
        metadata: {},
      };
    }
  }
}

/**
 * Verification attempt signal.
 */
class VerificationAttemptSignal extends SignalProvider {
  constructor() {
    super("verification_attempts", "behavior");
    this.weight = 12;
  }

  async collect(userId) {
    try {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("behavior_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("event_type", ["verification_submitted", "verification_failed"])
        .gte("created_at", dayAgo);

      const attemptCount = count || 0;
      // Suspicious: 3+ failed attempts
      const isSuspicious = attemptCount >= 3;

      return {
        value: { count: attemptCount, isSuspicious },
        confidence: isSuspicious ? 80 : 50,
        metadata: { window: "24h" },
      };
    } catch {
      return {
        value: { count: 0, isSuspicious: false },
        confidence: 0,
        metadata: {},
      };
    }
  }
}

// ─── Device Signals ───

/**
 * Device fingerprint signal.
 */
class DeviceFingerprintSignal extends SignalProvider {
  constructor() {
    super("device_fingerprint", "device");
    this.weight = 10;
  }

  async collect(userId) {
    try {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: devices } = await supabaseAdmin
        .from("device_fingerprints")
        .select("id, is_known, risk_flags")
        .eq("user_id", userId)
        .gte("last_seen_at", dayAgo);

      const deviceCount = devices?.length || 0;
      const hasKnownDevice = devices?.some((d) => d.is_known) || false;
      const allRiskFlags = devices?.flatMap((d) => d.risk_flags || []) || [];

      return {
        value: {
          count: deviceCount,
          hasKnownDevice,
          newDevice: !hasKnownDevice && deviceCount > 0,
          riskFlags: [...new Set(allRiskFlags)],
        },
        confidence: hasKnownDevice ? 80 : 40,
        metadata: { window: "24h" },
      };
    } catch {
      return {
        value: {
          count: 0,
          hasKnownDevice: true,
          newDevice: false,
          riskFlags: [],
        },
        confidence: 0,
        metadata: {},
      };
    }
  }
}

// ─── Velocity Signals ───

/**
 * Profile edit velocity signal.
 */
class ProfileEditVelocitySignal extends SignalProvider {
  constructor() {
    super("profile_edit_velocity", "velocity");
    this.weight = 8;
  }

  async collect(userId) {
    try {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("behavior_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "profile_edit")
        .gte("created_at", hourAgo);

      const editCount = count || 0;
      // Suspicious: 5+ edits in 1 hour
      const isSuspicious = editCount >= 5;

      return {
        value: { count: editCount, isSuspicious },
        confidence: isSuspicious ? 75 : 40,
        metadata: { window: "1h" },
      };
    } catch {
      return {
        value: { count: 0, isSuspicious: false },
        confidence: 0,
        metadata: {},
      };
    }
  }
}

/**
 * Bank change velocity signal.
 */
class BankChangeVelocitySignal extends SignalProvider {
  constructor() {
    super("bank_change_velocity", "velocity");
    this.weight = 18;
  }

  async collect(userId) {
    try {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { count } = await supabaseAdmin
        .from("behavior_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .in("event_type", ["bank_account_added", "bank_account_changed"])
        .gte("created_at", thirtyDaysAgo);

      const changeCount = count || 0;
      // Suspicious: 3+ changes in 30 days
      const isSuspicious = changeCount >= 3;

      return {
        value: { count: changeCount, isSuspicious },
        confidence: isSuspicious ? 85 : 40,
        metadata: { window: "30d" },
      };
    } catch {
      return {
        value: { count: 0, isSuspicious: false },
        confidence: 0,
        metadata: {},
      };
    }
  }
}

// ─── Reputation Signals ───

/**
 * Trust score signal.
 */
class TrustScoreSignal extends SignalProvider {
  constructor() {
    super("trust_score", "reputation");
    this.weight = 20;
  }

  async collect(userId) {
    try {
      const { data } = await supabaseAdmin
        .from("creator_verifications")
        .select("trust_score, verification_level")
        .eq("user_id", userId)
        .single();

      const trustScore = data?.trust_score || 0;
      const verificationLevel = data?.verification_level || 0;

      return {
        value: { trustScore, verificationLevel },
        confidence: verificationLevel >= 3 ? 85 : 50,
        metadata: { source: "trust_engine" },
      };
    } catch {
      return {
        value: { trustScore: 0, verificationLevel: 0 },
        confidence: 0,
        metadata: {},
      };
    }
  }
}

/**
 * Previous fraud history signal.
 */
class FraudHistorySignal extends SignalProvider {
  constructor() {
    super("fraud_history", "reputation");
    this.weight = 25;
  }

  async collect(userId) {
    try {
      const { count: ruleHitCount } = await supabaseAdmin
        .from("fraud_rule_hits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      const { data: lastScore } = await supabaseAdmin
        .from("risk_scores")
        .select("risk_score, decision")
        .eq("user_id", userId)
        .order("calculated_at", { ascending: false })
        .limit(1);

      return {
        value: {
          ruleHitCount: ruleHitCount || 0,
          lastRiskScore: lastScore?.[0]?.risk_score || 0,
          lastDecision: lastScore?.[0]?.decision || "allow",
        },
        confidence: ruleHitCount > 0 ? 80 : 40,
        metadata: { source: "fraud_tables" },
      };
    } catch {
      return {
        value: { ruleHitCount: 0, lastRiskScore: 0, lastDecision: "allow" },
        confidence: 0,
        metadata: {},
      };
    }
  }
}

// ─── Account Signals ───

/**
 * Account age signal.
 */
class AccountAgeSignal extends SignalProvider {
  constructor() {
    super("account_age", "identity");
    this.weight = 10;
  }

  async collect(userId) {
    try {
      const { data: authUser } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      const createdAt = authUser?.user?.created_at;
      const accountAgeDays = createdAt
        ? Math.floor(
            (Date.now() - new Date(createdAt).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

      // New accounts (< 7 days) are higher risk
      const isNew = accountAgeDays < 7;
      const isEstablished = accountAgeDays > 30;

      return {
        value: { accountAgeDays, isNew, isEstablished },
        confidence: 90,
        metadata: { createdAt },
      };
    } catch {
      return {
        value: { accountAgeDays: 0, isNew: true, isEstablished: false },
        confidence: 0,
        metadata: {},
      };
    }
  }
}

// ─── Provider Registry ───

const signalProviders = new Map();

/**
 * Register a signal provider.
 * @param {SignalProvider} provider
 */
export function registerSignalProvider(provider) {
  if (!(provider instanceof SignalProvider)) {
    throw new Error("Provider must extend SignalProvider");
  }
  signalProviders.set(provider.name, provider);
}

/**
 * Get a signal provider by name.
 * @param {string} name
 * @returns {SignalProvider|undefined}
 */
export function getSignalProvider(name) {
  return signalProviders.get(name);
}

/**
 * Get all registered signal providers.
 * @returns {SignalProvider[]}
 */
export function getAllSignalProviders() {
  return Array.from(signalProviders.values());
}

/**
 * Get providers by category.
 * @param {string} category
 * @returns {SignalProvider[]}
 */
export function getProvidersByCategory(category) {
  return Array.from(signalProviders.values()).filter(
    (p) => p.category === category,
  );
}

/**
 * Initialize default signal providers.
 */
export function initializeSignalProviders() {
  // Identity
  registerSignalProvider(new EmailVerificationSignal());
  registerSignalProvider(new PhoneVerificationSignal());
  registerSignalProvider(new IdentityVerificationSignal());

  // Verification
  registerSignalProvider(new BankVerificationSignal());
  registerSignalProvider(new BusinessVerificationSignal());

  // Behavior
  registerSignalProvider(new LoginFrequencySignal());
  registerSignalProvider(new DonationVelocitySignal());
  registerSignalProvider(new VerificationAttemptSignal());

  // Device
  registerSignalProvider(new DeviceFingerprintSignal());

  // Velocity
  registerSignalProvider(new ProfileEditVelocitySignal());
  registerSignalProvider(new BankChangeVelocitySignal());

  // Reputation
  registerSignalProvider(new TrustScoreSignal());
  registerSignalProvider(new FraudHistorySignal());

  // Account
  registerSignalProvider(new AccountAgeSignal());
}

// Initialize on module load
initializeSignalProviders();

// Export for external use
export { SignalProvider };
