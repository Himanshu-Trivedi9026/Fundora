/**
 * Signal Aggregator — Collects and aggregates risk signals from multiple sources.
 *
 * Sources:
 *   - Verification data (trust scores, verification levels)
 *   - Device fingerprints (known/unknown devices, risk flags)
 *   - Behavior events (login patterns, action frequency)
 *   - Fraud events (previous rule hits, suspicious activity)
 *   - Account data (age, profile completeness)
 *   - External signals (email domain reputation, IP geolocation)
 *
 * Security:
 *   - Never exposes raw signal data to frontend
 *   - All signal values are sanitized before storage
 *   - Uses secureLogger for all logging
 */

import { supabaseAdmin } from "../supabaseAdmin";
import { logError } from "../verification/secureLogger";

// ─── Signal Collection ───

/**
 * Aggregate all available signals for a user.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.trigger — What triggered this evaluation
 * @param {Object} [params.context] — Additional context
 * @returns {Promise<Object>} Aggregated signals
 */
export async function aggregateSignals({ userId, trigger, context = {} }) {
  try {
    const [
      verificationSignals,
      deviceSignals,
      behaviorSignals,
      fraudSignals,
      accountSignals,
    ] = await Promise.all([
      getVerificationSignals(userId),
      getDeviceSignals(userId),
      getBehaviorSignals(userId, trigger),
      getFraudSignals(userId),
      getAccountSignals(userId),
    ]);

    // Merge all signals into a unified object
    const signals = {
      // Verification signals
      trustScore: verificationSignals.trustScore || 0,
      verificationLevel: verificationSignals.verificationLevel || 0,
      emailVerified: verificationSignals.emailVerified || false,
      phoneVerified: verificationSignals.phoneVerified || false,
      identityVerified: verificationSignals.identityVerified || false,
      bankVerified: verificationSignals.bankVerified || false,
      businessVerified: verificationSignals.businessVerified || false,

      // Device signals
      knownDevice: deviceSignals.knownDevice || false,
      deviceCount24h: deviceSignals.deviceCount24h || 0,
      newDevice: deviceSignals.newDevice || false,
      deviceRiskFlags: deviceSignals.riskFlags || [],

      // Behavior signals
      recentLoginCount: behaviorSignals.loginCount || 0,
      recentDonationCount: behaviorSignals.donationCount || 0,
      recentVerificationAttempts: behaviorSignals.verificationAttempts || 0,
      recentProfileEdits: behaviorSignals.profileEdits || 0,
      recentDocumentUploads: behaviorSignals.documentUploads || 0,
      recentBankChanges: behaviorSignals.bankChanges || 0,
      recentActivityCount: behaviorSignals.totalActivity || 0,

      // Fraud signals
      previousRuleHits: fraudSignals.ruleHitCount || 0,
      previousRiskScore: fraudSignals.lastRiskScore || 0,
      previousDecision: fraudSignals.lastDecision || "allow",

      // Account signals
      accountAgeDays: accountSignals.accountAgeDays || 0,
      profileCompleteness: accountSignals.profileCompleteness || 0,
      lastDonationAmount: context.donationAmount || 0,

      // Pattern signals
      countryMismatch: context.countryMismatch || false,
      disposableEmail: context.disposableEmail || false,

      // Context
      trigger,
      evaluatedAt: new Date().toISOString(),
    };

    // Calculate summary
    signals.summary = calculateSignalsSummary(signals);

    return signals;
  } catch (err) {
    logError("SignalAggregator", "Aggregation error", { error: err.message });
    return getEmptySignals(trigger);
  }
}

// ─── Signal Sources ───

/**
 * Get verification-related signals.
 */
async function getVerificationSignals(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from("creator_verifications")
      .select(
        "verification_level, trust_score, email_verified, phone_verified, identity_verified, bank_verified, business_verified",
      )
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return {};
    }

    return {
      trustScore: data.trust_score || 0,
      verificationLevel: data.verification_level || 0,
      emailVerified: data.email_verified || false,
      phoneVerified: data.phone_verified || false,
      identityVerified: data.identity_verified || false,
      bankVerified: data.bank_verified || false,
      businessVerified: data.business_verified || false,
    };
  } catch (err) {
    return {};
  }
}

/**
 * Get device-related signals.
 */
async function getDeviceSignals(userId) {
  try {
    // Get device count in last 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: devices, error } = await supabaseAdmin
      .from("device_fingerprints")
      .select("id, is_known, risk_flags")
      .eq("user_id", userId)
      .gte("last_seen_at", dayAgo);

    if (error || !devices || devices.length === 0) {
      return {
        knownDevice: true,
        deviceCount24h: 0,
        newDevice: false,
        riskFlags: [],
      };
    }

    const allRiskFlags = devices.flatMap((d) => d.risk_flags || []);
    const hasKnownDevice = devices.some((d) => d.is_known);

    return {
      knownDevice: hasKnownDevice,
      deviceCount24h: devices.length,
      newDevice: !hasKnownDevice,
      riskFlags: [...new Set(allRiskFlags)],
    };
  } catch (err) {
    return {};
  }
}

/**
 * Get behavior-related signals.
 */
async function getBehaviorSignals(userId, trigger) {
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: events, error } = await supabaseAdmin
      .from("behavior_events")
      .select("event_type, event_category")
      .eq("user_id", userId)
      .gte("created_at", dayAgo);

    if (error || !events) {
      return {};
    }

    const counts = {
      loginCount: 0,
      donationCount: 0,
      verificationAttempts: 0,
      profileEdits: 0,
      documentUploads: 0,
      bankChanges: 0,
      totalActivity: events.length,
    };

    events.forEach((event) => {
      switch (event.event_type) {
        case "login":
          counts.loginCount++;
          break;
        case "donation":
          counts.donationCount++;
          break;
        case "verification_submitted":
        case "verification_failed":
          counts.verificationAttempts++;
          break;
        case "profile_edit":
          counts.profileEdits++;
          break;
        case "document_uploaded":
        case "document_rejected":
          counts.documentUploads++;
          break;
        case "bank_account_added":
        case "bank_account_changed":
          counts.bankChanges++;
          break;
      }
    });

    return counts;
  } catch (err) {
    return {};
  }
}

/**
 * Get fraud-related signals (previous events and scores).
 */
async function getFraudSignals(userId) {
  try {
    // Get previous risk score
    const { data: scores } = await supabaseAdmin
      .from("risk_scores")
      .select("risk_score, decision")
      .eq("user_id", userId)
      .order("calculated_at", { ascending: false })
      .limit(1);

    // Get rule hit count
    const { count: ruleHitCount } = await supabaseAdmin
      .from("fraud_rule_hits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    return {
      lastRiskScore: scores?.[0]?.risk_score || 0,
      lastDecision: scores?.[0]?.decision || "allow",
      ruleHitCount: ruleHitCount || 0,
    };
  } catch (err) {
    return {};
  }
}

/**
 * Get account-related signals.
 */
async function getAccountSignals(userId) {
  try {
    // Get account creation date
    const { data: authUser } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    const accountAgeDays = authUser?.user?.created_at
      ? Math.floor(
          (Date.now() - new Date(authUser.user.created_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    // Get profile completeness
    const { data: profile } = await supabaseAdmin
      .from("creator_verifications")
      .select("email_verified, phone_verified, identity_verified")
      .eq("user_id", userId)
      .single();

    let completeness = 0;
    if (profile) {
      if (profile.email_verified) completeness += 20;
      if (profile.phone_verified) completeness += 20;
      if (profile.identity_verified) completeness += 30;
      // Other factors
      completeness += 30; // Base score
    }

    return {
      accountAgeDays,
      profileCompleteness: Math.min(100, completeness),
    };
  } catch (err) {
    return {};
  }
}

// ─── Summary Calculation ───

/**
 * Calculate a summary of signals for quick reference.
 * @param {Object} signals
 * @returns {Object}
 */
function calculateSignalsSummary(signals) {
  const positives = [];
  const negatives = [];

  // Positive signals
  if (signals.verificationLevel >= 3) positives.push("high_verification_level");
  if (signals.bankVerified) positives.push("bank_verified");
  if (signals.businessVerified) positives.push("business_verified");
  if (signals.knownDevice) positives.push("known_device");
  if (signals.accountAgeDays > 30) positives.push("established_account");
  if (signals.profileCompleteness > 70) positives.push("complete_profile");

  // Negative signals
  if (signals.verificationLevel < 1) negatives.push("unverified_email");
  if (signals.newDevice) negatives.push("new_device");
  if (signals.deviceCount24h > 3) negatives.push("multiple_devices");
  if (signals.recentVerificationAttempts > 3)
    negatives.push("verification_spam");
  if (signals.recentBankChanges > 2) negatives.push("frequent_bank_changes");
  if (signals.previousRuleHits > 0) negatives.push("previous_rule_hits");
  if (signals.accountAgeDays < 7) negatives.push("new_account");
  if (signals.countryMismatch) negatives.push("country_mismatch");
  if (signals.disposableEmail) negatives.push("disposable_email");

  return {
    positiveSignals: positives,
    negativeSignals: negatives,
    signalCount: positives.length + negatives.length,
    riskIndicator: negatives.length > positives.length ? "elevated" : "normal",
  };
}

/**
 * Get empty signals structure.
 * @param {string} trigger
 * @returns {Object}
 */
function getEmptySignals(trigger) {
  return {
    trustScore: 0,
    verificationLevel: 0,
    emailVerified: false,
    phoneVerified: false,
    identityVerified: false,
    bankVerified: false,
    businessVerified: false,
    knownDevice: true,
    deviceCount24h: 0,
    newDevice: false,
    deviceRiskFlags: [],
    recentLoginCount: 0,
    recentDonationCount: 0,
    recentVerificationAttempts: 0,
    recentProfileEdits: 0,
    recentDocumentUploads: 0,
    recentBankChanges: 0,
    recentActivityCount: 0,
    previousRuleHits: 0,
    previousRiskScore: 0,
    previousDecision: "allow",
    accountAgeDays: 0,
    profileCompleteness: 0,
    lastDonationAmount: 0,
    countryMismatch: false,
    disposableEmail: false,
    trigger,
    evaluatedAt: new Date().toISOString(),
    summary: {
      positiveSignals: [],
      negativeSignals: [],
      signalCount: 0,
      riskIndicator: "normal",
    },
  };
}
