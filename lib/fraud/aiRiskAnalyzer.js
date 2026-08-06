/**
 * AI Risk Analyzer — Orchestrates AI-powered risk analysis.
 *
 * This module:
 *   - Prepares context for AI analysis
 *   - Calls the active AI provider
 *   - Validates and sanitizes AI responses
 *   - Falls back to rule-based analysis if AI fails
 *
 * Security:
 *   - Never exposes AI prompts or raw provider responses
 *   - All AI analysis results are sanitized
 *   - API keys are never logged or exposed
 *   - Uses secureLogger for all logging
 */

import { getActiveProvider } from "./providerAdapter";
import { calculateRiskScore } from "./riskScorer";
import { logInfo, logError, logWarn } from "../verification/secureLogger";

// ─── Configuration ───

const AI_CONFIG = {
  /** Enable/disable AI analysis (can be disabled for cost savings) */
  enabled: false,
  /** Fallback to rule-based analysis on AI failure */
  fallbackToRules: true,
  /** Maximum retry attempts for AI calls */
  maxRetries: 2,
  /** Timeout for AI calls (ms) */
  timeoutMs: 10_000,
  /** Minimum confidence threshold for AI results */
  minConfidenceThreshold: 30,
};

// ─── Core Analysis ───

/**
 * Analyze risk using AI provider with fallback to rule-based analysis.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Object} params.signals — Aggregated signals
 * @param {Object} params.ruleResults — Rule evaluation results
 * @param {number} params.trustScore — Trust score
 * @param {number} params.verificationLevel — Verification level
 * @param {string} params.trigger — Evaluation trigger
 * @returns {Promise<{riskScore: number, confidence: number, source: string, explanation: string}>}
 */
export async function analyzeRisk({ userId, signals, ruleResults, trustScore, verificationLevel, trigger }) {
  // If AI is disabled, use rule-based analysis
  if (!AI_CONFIG.enabled) {
    return ruleBasedAnalysis({ signals, ruleResults, trustScore, verificationLevel, trigger });
  }

  try {
    const provider = getActiveProvider();

    // Prepare context for AI
    const context = prepareAIContext({
      userId,
      signals,
      ruleResults,
      trustScore,
      verificationLevel,
      trigger,
    });

    // Call AI provider with retries
    let aiResult = null;
    for (let attempt = 0; attempt <= AI_CONFIG.maxRetries; attempt++) {
      try {
        aiResult = await Promise.race([
          provider.analyzeRisk(context),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI timeout")), AI_CONFIG.timeoutMs)
          ),
        ]);
        break;
      } catch (err) {
        logWarn("AIRiskAnalyzer", `AI call attempt ${attempt + 1} failed`, { error: err.message });
        if (attempt === AI_CONFIG.maxRetries) {
          throw err;
        }
      }
    }

    // Validate AI result
    if (aiResult && validateAIResult(aiResult)) {
      logInfo("AIRiskAnalyzer", "AI analysis completed", {
        userId: userId.substring(0, 8) + "...",
        riskScore: aiResult.riskScore,
        confidence: aiResult.confidence,
      });

      return {
        riskScore: aiResult.riskScore,
        confidence: aiResult.confidence,
        source: "ai",
        explanation: sanitizeExplanation(aiResult.explanation),
        factors: aiResult.factors || [],
      };
    }

    // AI result invalid, fall back
    logWarn("AIRiskAnalyzer", "AI result invalid, falling back to rules");
    return ruleBasedAnalysis({ signals, ruleResults, trustScore, verificationLevel, trigger });
  } catch (err) {
    logError("AIRiskAnalyzer", "AI analysis error", { error: err.message });

    if (AI_CONFIG.fallbackToRules) {
      return ruleBasedAnalysis({ signals, ruleResults, trustScore, verificationLevel, trigger });
    }

    return { riskScore: 0, confidence: 0, source: "error", explanation: "AI analysis failed" };
  }
}

/**
 * Explain a decision using AI provider.
 *
 * @param {Object} params
 * @param {string} params.decision
 * @param {number} params.riskScore
 * @param {Object} params.signals
 * @param {string[]} params.factors
 * @returns {Promise<{explanation: string, keyFactors: string[], source: string}>}
 */
export async function explainDecision({ decision, riskScore, signals, factors }) {
  if (!AI_CONFIG.enabled) {
    return ruleBasedExplanation({ decision, riskScore, signals, factors });
  }

  try {
    const provider = getActiveProvider();
    const context = { decision, riskScore, signals, factors };

    const result = await Promise.race([
      provider.explainDecision(context),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), AI_CONFIG.timeoutMs)
      ),
    ]);

    if (result && result.explanation) {
      return {
        explanation: sanitizeExplanation(result.explanation),
        keyFactors: result.keyFactors || factors,
        source: "ai",
      };
    }

    return ruleBasedExplanation({ decision, riskScore, signals, factors });
  } catch (err) {
    logError("AIRiskAnalyzer", "Explain decision error", { error: err.message });
    return ruleBasedExplanation({ decision, riskScore, signals, factors });
  }
}

/**
 * Detect anomalies using AI provider.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Object} params.behaviorData
 * @returns {Promise<{anomalies: Array, confidence: number, source: string}>}
 */
export async function detectAnomalies({ userId, behaviorData }) {
  if (!AI_CONFIG.enabled) {
    return { anomalies: [], confidence: 0, source: "rule_based" };
  }

  try {
    const provider = getActiveProvider();

    const result = await Promise.race([
      provider.detectAnomalies(behaviorData),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), AI_CONFIG.timeoutMs)
      ),
    ]);

    if (result && Array.isArray(result.anomalies)) {
      return {
        anomalies: result.anomalies.map(sanitizeAnomaly),
        confidence: result.confidence || 0,
        source: "ai",
      };
    }

    return { anomalies: [], confidence: 0, source: "rule_based" };
  } catch (err) {
    logError("AIRiskAnalyzer", "Anomaly detection error", { error: err.message });
    return { anomalies: [], confidence: 0, source: "error" };
  }
}

// ─── Fallback Analysis ───

/**
 * Rule-based analysis (fallback when AI is unavailable).
 */
function ruleBasedAnalysis({ signals, ruleResults, trustScore, verificationLevel, trigger }) {
  const result = calculateRiskScore({
    signals,
    ruleResults,
    trustScore,
    verificationLevel,
    trigger,
  });

  return {
    riskScore: result.score,
    confidence: 70, // Rule-based confidence
    source: "rule_engine",
    explanation: `Rule-based analysis: Risk score ${result.score} (${result.level})`,
    factors: result.breakdown?.signalRisk?.factors || [],
  };
}

/**
 * Rule-based explanation (fallback).
 */
function ruleBasedExplanation({ decision, riskScore, signals, factors }) {
  const explanations = {
    block: `Account blocked due to high risk score (${riskScore}). Key factors: ${factors.join(", ") || "multiple risk indicators"}.`,
    limit: `Account limited due to elevated risk score (${riskScore}). Key factors: ${factors.join(", ") || "risk indicators detected"}.`,
    manual_review: `Account queued for manual review due to risk score (${riskScore}). Key factors: ${factors.join(", ") || "risk assessment"}.`,
    monitor: `Account under monitoring. Risk score: ${riskScore}.`,
    allow: `Account within acceptable risk limits. Risk score: ${riskScore}.`,
    escalate: `Account escalated due to critical risk indicators. Risk score: ${riskScore}.`,
  };

  return {
    explanation: explanations[decision] || `Decision: ${decision}. Risk score: ${riskScore}.`,
    keyFactors: factors,
    source: "rule_engine",
  };
}

// ─── Context Preparation ───

/**
 * Prepare context for AI analysis.
 * Sanitizes and structures data for the AI provider.
 */
function prepareAIContext({ userId, signals, ruleResults, trustScore, verificationLevel, trigger }) {
  return {
    // User context (anonymized)
    verificationLevel,
    trustScore,

    // Signal summary
    signals: {
      accountAgeDays: signals.accountAgeDays || 0,
      knownDevice: signals.knownDevice || false,
      deviceCount24h: signals.deviceCount24h || 0,
      recentActivityCount: signals.recentActivityCount || 0,
      recentVerificationAttempts: signals.recentVerificationAttempts || 0,
      recentBankChanges: signals.recentBankChanges || 0,
      previousRuleHits: signals.previousRuleHits || 0,
      countryMismatch: signals.countryMismatch || false,
      disposableEmail: signals.disposableEmail || false,
    },

    // Rule results summary
    rulesTriggered: (ruleResults?.triggered || []).map((r) => ({
      name: r.ruleName,
      category: r.category,
      severity: r.severity,
    })),

    // Current event
    trigger,
    evaluatedAt: new Date().toISOString(),
  };
}

// ─── Validation & Sanitization ───

/**
 * Validate AI result structure.
 * @param {Object} result
 * @returns {boolean}
 */
function validateAIResult(result) {
  if (!result || typeof result !== "object") return false;
  if (typeof result.riskScore !== "number") return false;
  if (result.riskScore < 0 || result.riskScore > 100) return false;
  if (typeof result.confidence !== "number") return false;
  if (result.confidence < 0 || result.confidence > 100) return false;
  return true;
}

/**
 * Sanitize AI explanation (remove any sensitive data).
 * @param {string} explanation
 * @returns {string}
 */
function sanitizeExplanation(explanation) {
  if (!explanation || typeof explanation !== "string") return "";

  // Remove any potential PII or sensitive data
  let sanitized = explanation
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[REDACTED]") // Aadhaar
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[REDACTED]") // PAN
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]") // Email
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[IP]") // IP
    .substring(0, 1000); // Limit length

  return sanitized;
}

/**
 * Sanitize an anomaly response.
 * @param {Object} anomaly
 * @returns {Object}
 */
function sanitizeAnomaly(anomaly) {
  if (!anomaly || typeof anomaly !== "object") return {};

  return {
    type: anomaly.type || "unknown",
    description: (anomaly.description || "").substring(0, 500),
    severity: ["low", "medium", "high", "critical"].includes(anomaly.severity)
      ? anomaly.severity
      : "medium",
  };
}

/**
 * Analyze fraud using AI provider with fallback to rule-based analysis.
 * Wraps analyzeRisk for backward compatibility.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Array} params.signals — Risk signals
 * @param {string} params.timeframe — Analysis timeframe
 * @param {string} params.analyzedBy — User performing the analysis
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function analyzeFraud({ userId, signals, timeframe, analyzedBy }) {
  try {
    if (!userId) {
      return { success: false, error: "userId is required" };
    }

    // Map signals array to the format analyzeRisk expects
    const formattedSignals = {
      accountAgeDays: 0,
      knownDevice: false,
      deviceCount24h: 0,
      recentActivityCount: 0,
      recentVerificationAttempts: 0,
      recentBankChanges: 0,
      previousRuleHits: 0,
      countryMismatch: false,
      disposableEmail: false,
    };

    if (Array.isArray(signals)) {
      for (const signal of signals) {
        if (typeof signal === "object" && signal.type) {
          formattedSignals[signal.type] = signal.value !== undefined ? signal.value : true;
        }
      }
    } else if (typeof signals === "object" && signals !== null) {
      Object.assign(formattedSignals, signals);
    }

    const result = await analyzeRisk({
      userId,
      signals: formattedSignals,
      ruleResults: { triggered: [] },
      trustScore: 50,
      verificationLevel: 0,
      trigger: `fraud_analysis_${timeframe || "30d"}`,
    });

    return {
      success: true,
      data: {
        riskScore: result.riskScore,
        confidence: result.confidence,
        source: result.source,
        explanation: result.explanation,
        factors: result.factors || [],
      },
    };
  } catch (err) {
    logError("AIRiskAnalyzer", "analyzeFraud failed", { userId, error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Export config for testing.
 */
export { AI_CONFIG };
