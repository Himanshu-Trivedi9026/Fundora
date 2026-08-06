/**
 * Fraud Detection Module — Public API
 *
 * Re-exports all fraud detection functions for easy importing.
 *
 * Usage:
 *   import { evaluateUser, getFraudProfile } from "@/lib/fraud";
 *   import { aggregateSignals } from "@/lib/fraud";
 *   import { calculateRiskScore, getRiskLevel } from "@/lib/fraud";
 */

// Core pipeline
export {
  evaluateUser,
  getFraudProfile,
  applyManualOverride,
  getFraudDashboard,
} from "./riskEngine";

// Rule engine
export { evaluateRules, invalidateRulesCache } from "./ruleEngine";

// Signal aggregation
export { aggregateSignals } from "./signalAggregator";

// Risk scoring
export {
  calculateRiskScore,
  getRiskLevel,
  getRiskLevelInfo,
  RISK_WEIGHTS,
  RISK_LEVELS,
} from "./riskScorer";

// Decision engine
export {
  determineDecision,
  DECISION_MATRIX,
  TRIGGER_OVERRIDES,
} from "./decisionEngine";

// Risk history
export {
  recordRiskScore,
  getRiskHistory,
  getRiskTrend,
  detectSignificantChanges,
  getAggregateStats,
} from "./riskHistory";

// Fraud events
export {
  recordFraudEvent,
  getFraudEvents,
  getFraudEventSummary,
  getAllFraudEvents,
} from "./fraudEvents";

// AI provider adapter
export {
  BaseAIProvider,
  MockAIProvider,
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  LocalProvider,
  registerProvider,
  getProvider,
  setActiveProvider,
  getActiveProvider,
  listProviders,
  initializeDefaultProviders,
} from "./providerAdapter";

// AI risk analyzer
export {
  analyzeRisk,
  explainDecision,
  detectAnomalies,
  AI_CONFIG,
} from "./aiRiskAnalyzer";

// Device fingerprinting
export {
  recordFingerprint,
  getDeviceFingerprints,
  getDeviceStats,
  flagDevice,
  getHighRiskDevices,
  sanitizeDeviceResponse,
} from "./deviceFingerprint";

// Behavior analytics
export {
  recordBehaviorEvent,
  getBehaviorEvents,
  getBehaviorSummary,
  detectBehaviorAnomalies,
  getLoginPatterns,
} from "./behaviorAnalytics";

// Signal providers
export {
  registerSignalProvider,
  getSignalProvider,
  getAllSignalProviders,
  getProvidersByCategory,
  initializeSignalProviders,
  SignalProvider,
} from "./signals";
