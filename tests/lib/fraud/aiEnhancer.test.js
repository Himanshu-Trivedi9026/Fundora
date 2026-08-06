/**
 * Fraud AI Enhancer Tests — Unit tests for AI-enhanced fraud detection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/ai/aiEngine.js", () => ({
  completeAIRequest: vi.fn().mockResolvedValue({
    success: true,
    data: { content: "analysis" },
  }),
  getAIConfig: vi.fn().mockResolvedValue({
    success: true,
    data: { enabled: true },
  }),
}));

import {
  detectBehaviorAnomalies,
  detectDonationAnomalies,
  analyzeNetworkRelationships,
  detectFraudPatterns,
  explainRiskAssessment,
  generateFraudSummary,
  getFraudRecommendations,
} from "../../../lib/fraud/aiEnhancer.js";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

// ─── Helper: build chainable mock for .gte() → .lte() → result ──────

function mockDateChain(terminalKey, terminalValue) {
  return {
    gte: vi.fn().mockReturnValue({
      lte: vi.fn().mockResolvedValue({ data: terminalValue, error: null }),
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("FraudAIEnhancer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── detectBehaviorAnomalies ──────────────────────────────────────

  describe("detectBehaviorAnomalies", () => {
    it("returns anomalies with risk score for anomalous behavior", async () => {
      const result = await detectBehaviorAnomalies({
        userId: "user-1",
        behaviorData: {
          actionsPerMinute: 30,
          currentHour: 3,
          sessionDurationMinutes: 120,
          deviceChanged: true,
        },
        historicalPatterns: {
          avgActionsPerMinute: 5,
          stddevActionsPerMinute: 3,
          typicalHours: [8, 9, 10, 14, 15, 16],
          avgSessionDuration: 15,
          knownDevices: ["device-1"],
          knownIps: ["ip-1", "ip-2", "ip-3", "ip-4", "ip-5"],
        },
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.anomalies)).toBe(true);
      expect(result.data.anomalies.length).toBeGreaterThan(0);
      expect(result.data.overallRisk).toBeGreaterThan(0);

      // Should detect velocity spike (z-score = (30-5)/3 ≈ 8.33 > 2.5)
      const types = result.data.anomalies.map((a) => a.type);
      expect(types).toContain("velocity_spike");
    });

    it("returns low risk for normal behavior", async () => {
      const result = await detectBehaviorAnomalies({
        userId: "user-1",
        behaviorData: {
          actionsPerMinute: 5,
          currentHour: 10,
          sessionDurationMinutes: 10,
          deviceChanged: false,
        },
        historicalPatterns: {
          avgActionsPerMinute: 5,
          stddevActionsPerMinute: 3,
          typicalHours: [8, 9, 10, 14, 15, 16],
          avgSessionDuration: 15,
          knownDevices: ["device-1"],
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.overallRisk).toBe(0);
      expect(result.data.anomalies.length).toBe(0);
    });

    it("returns error when required params are missing", async () => {
      const noUser = await detectBehaviorAnomalies({ behaviorData: {} });
      expect(noUser.success).toBe(false);
      expect(noUser.error).toBe("userId is required");

      const noData = await detectBehaviorAnomalies({ userId: "u1" });
      expect(noData.success).toBe(false);
      expect(noData.error).toBe("behaviorData is required");
    });
  });

  // ─── detectDonationAnomalies ──────────────────────────────────────

  describe("detectDonationAnomalies", () => {
    it("detects velocity, amount, and recipient anomalies", async () => {
      const now = Date.now();
      const recentDonations = [
        { amount: 15000, campaign_id: "c1", created_at: new Date(now - 60000).toISOString() },
        { amount: 15000, campaign_id: "c1", created_at: new Date(now - 120000).toISOString() },
        { amount: 15000, campaign_id: "c1", created_at: new Date(now - 180000).toISOString() },
        { amount: 15000, campaign_id: "c1", created_at: new Date(now - 240000).toISOString() },
        { amount: 15000, campaign_id: "c1", created_at: new Date(now - 300000).toISOString() },
        { amount: 15000, campaign_id: "c1", created_at: new Date(now - 360000).toISOString() },
        { amount: 15000, campaign_id: "c1", created_at: new Date(now - 420000).toISOString() },
      ];

      const result = await detectDonationAnomalies({
        userId: "user-1",
        recentDonations,
        donorHistory: {
          avgDonationsPerHour: 0.5,
          avgDonationAmount: 50,
          stddevDonationAmount: 20,
          totalDonations: 3,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.anomalies.length).toBeGreaterThan(0);
      expect(result.data.velocityAnomaly || result.data.amountAnomaly).toBe(true);
    });

    it("returns clean result for normal donation patterns", async () => {
      const now = Date.now();
      const recentDonations = [
        { amount: 50, campaign_id: "c1", created_at: new Date(now - 7200000).toISOString() },
      ];

      const result = await detectDonationAnomalies({
        userId: "user-1",
        recentDonations,
        donorHistory: {
          avgDonationsPerHour: 0.5,
          avgDonationAmount: 50,
          stddevDonationAmount: 15,
          totalDonations: 50,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data.anomalies.length).toBe(0);
      expect(result.data.velocityAnomaly).toBe(false);
      expect(result.data.amountAnomaly).toBe(false);
    });

    it("returns error when required params are missing", async () => {
      const noUser = await detectDonationAnomalies({
        recentDonations: [],
        donorHistory: {},
      });
      expect(noUser.success).toBe(false);
      expect(noUser.error).toBe("userId is required");

      const noDonations = await detectDonationAnomalies({
        userId: "u1",
        donorHistory: {},
      });
      expect(noDonations.success).toBe(false);

      const noHistory = await detectDonationAnomalies({
        userId: "u1",
        recentDonations: [],
      });
      expect(noHistory.success).toBe(false);
    });
  });

  // ─── analyzeNetworkRelationships ──────────────────────────────────

  describe("analyzeNetworkRelationships", () => {
    it("detects collusion via mutual donations", async () => {
      const connections = [
        { targetUserId: "user-a", type: "mutual_donation", weight: 3 },
        { targetUserId: "user-b", type: "mutual_donation", weight: 2 },
        { targetUserId: "user-a", type: "shared_device", weight: 1 },
      ];

      const result = await analyzeNetworkRelationships({
        userId: "user-1",
        connections,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.relationships)).toBe(true);
      expect(result.data.riskLevel).toBe("high");

      const collusion = result.data.relationships.find((r) => r.type === "collusion");
      expect(collusion).toBeDefined();
      expect(collusion.relatedUsers).toContain("user-1");
      expect(collusion.confidence).toBeGreaterThan(0);
    });

    it("detects sybil patterns via shared identifiers", async () => {
      const connections = [
        { targetUserId: "suspect-1", type: "shared_device", weight: 1 },
        { targetUserId: "suspect-1", type: "shared_ip", weight: 1 },
        { targetUserId: "suspect-1", type: "mutual_donation", weight: 1 },
      ];

      const result = await analyzeNetworkRelationships({
        userId: "user-1",
        connections,
      });

      expect(result.success).toBe(true);
      const sybil = result.data.relationships.find((r) => r.type === "sybil");
      expect(sybil).toBeDefined();
    });

    it("returns low risk for clean connections", async () => {
      const connections = [
        { targetUserId: "user-a", type: "donation", weight: 1 },
      ];

      const result = await analyzeNetworkRelationships({
        userId: "user-1",
        connections,
      });

      expect(result.success).toBe(true);
      expect(result.data.riskLevel).toBe("low");
      expect(result.data.relationships.length).toBe(0);
    });

    it("returns error when required params are missing", async () => {
      const noUser = await analyzeNetworkRelationships({ connections: [] });
      expect(noUser.success).toBe(false);

      const noConns = await analyzeNetworkRelationships({ userId: "u1" });
      expect(noConns.success).toBe(false);
    });
  });

  // ─── detectFraudPatterns ──────────────────────────────────────────

  describe("detectFraudPatterns", () => {
    it("detects multiple fraud patterns with confidence scores", async () => {
      const result = await detectFraudPatterns({
        userId: "user-1",
        signals: {
          velocityScore: 85,
          velocityDetails: "20 actions in 1 minute",
          accountAge: 12 * 60 * 60 * 1000, // 12 hours
          donationCount: 25,
          uniqueDevices: 7,
          uniqueIps: 12,
          previousFlags: 3,
        },
        timeframe: "7d",
      });

      expect(result.success).toBe(true);
      expect(result.data.patterns.length).toBeGreaterThan(0);

      // Should detect velocity fraud (score > 70)
      const velocityPattern = result.data.patterns.find(
        (p) => p.type === "velocity_fraud"
      );
      expect(velocityPattern).toBeDefined();
      expect(velocityPattern.confidence).toBeGreaterThan(0);

      // Should generate recommendation based on confidence
      expect(typeof result.data.recommendation).toBe("string");
      expect(result.data.recommendation.length).toBeGreaterThan(0);
    });

    it("returns no-action recommendation for clean signals", async () => {
      const result = await detectFraudPatterns({
        userId: "user-1",
        signals: {
          velocityScore: 10,
          accountAge: 365 * 24 * 60 * 60 * 1000,
          donationCount: 5,
          uniqueDevices: 1,
          uniqueIps: 1,
          previousFlags: 0,
        },
        timeframe: "30d",
      });

      expect(result.success).toBe(true);
      expect(result.data.patterns.length).toBe(0);
      expect(result.data.recommendation).toContain("No action");
    });

    it("returns error when required params are missing", async () => {
      const noUser = await detectFraudPatterns({ signals: {} });
      expect(noUser.success).toBe(false);

      const noSignals = await detectFraudPatterns({ userId: "u1" });
      expect(noSignals.success).toBe(false);
    });
  });

  // ─── explainRiskAssessment ────────────────────────────────────────

  describe("explainRiskAssessment", () => {
    it("generates human-readable explanation for a blocked account", async () => {
      const result = await explainRiskAssessment({
        userId: "user-1",
        riskScore: 85,
        signals: {
          velocityScore: 80,
          identityInconsistencies: [{ description: "Name mismatch" }],
          deviceAnomalies: 2,
          ipAnomalies: 1,
          previousFlags: 3,
          networkRisk: "high",
        },
        decision: "block",
      });

      expect(result.success).toBe(true);
      expect(typeof result.data.explanation).toBe("string");
      expect(result.data.explanation).toContain("high");
      expect(result.data.explanation).toContain("blocked");

      expect(Array.isArray(result.data.keyFactors)).toBe(true);
      expect(result.data.keyFactors.length).toBeGreaterThan(0);

      expect(Array.isArray(result.data.suggestedActions)).toBe(true);
      expect(result.data.suggestedActions.length).toBeGreaterThan(0);
    });

    it("returns error when required params are missing", async () => {
      const noUser = await explainRiskAssessment({ riskScore: 50, signals: {} });
      expect(noUser.success).toBe(false);

      const noScore = await explainRiskAssessment({
        userId: "u1",
        signals: {},
      });
      expect(noScore.success).toBe(false);
    });

    it("provides low-risk explanation for allowed decisions", async () => {
      const result = await explainRiskAssessment({
        userId: "user-clean",
        riskScore: 15,
        signals: {},
        decision: "allow",
      });

      expect(result.success).toBe(true);
      expect(result.data.explanation).toContain("low");
      expect(result.data.explanation).toContain("allowed");
      expect(result.data.suggestedActions).toContain("No immediate action required");
    });
  });

  // ─── generateFraudSummary ─────────────────────────────────────────

  describe("generateFraudSummary", () => {
    it("generates admin dashboard summary with trends", async () => {
      const mockCases = [
        { id: "f1", status: "open", fraud_type: "identity_fraud", severity: "high", created_at: new Date().toISOString() },
        { id: "f2", status: "resolved", fraud_type: "velocity_fraud", severity: "medium", created_at: new Date().toISOString() },
        { id: "f3", status: "open", fraud_type: "identity_fraud", severity: "critical", created_at: new Date().toISOString() },
      ];
      const mockPrevious = [{ id: "p1" }];

      const dateChain1 = mockDateChain("lte", mockCases);
      const dateChain2 = { lt: vi.fn().mockResolvedValue({ data: mockPrevious, error: null }) };

      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue(dateChain1),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue(dateChain2),
          }),
        });

      const result = await generateFraudSummary({ timeframe: "7d" });

      expect(result.success).toBe(true);
      expect(typeof result.data.summary).toBe("string");
      expect(result.data.summary).toContain("3 fraud case");
      expect(Array.isArray(result.data.topPatterns)).toBe(true);
      expect(Array.isArray(result.data.trends)).toBe(true);
      expect(Array.isArray(result.data.recommendations)).toBe(true);
    });

    it("returns empty summary when no cases exist", async () => {
      const dateChain = mockDateChain("lte", []);

      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue(dateChain),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lt: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        });

      const result = await generateFraudSummary({ timeframe: "30d" });

      expect(result.success).toBe(true);
      expect(result.data.summary).toContain("0 fraud case");
    });
  });

  // ─── getFraudRecommendations ──────────────────────────────────────

  describe("getFraudRecommendations", () => {
    it("returns high-priority recommendations for high risk", async () => {
      const result = await getFraudRecommendations({
        userId: "user-1",
        riskLevel: "high",
        anomalies: ["a1", "a2", "a3", "a4"],
      });

      expect(result.success).toBe(true);
      expect(result.data.recommendations.length).toBeGreaterThanOrEqual(3);

      // Should include account restriction
      const restriction = result.data.recommendations.find((r) =>
        r.action.toLowerCase().includes("restrict")
      );
      expect(restriction).toBeDefined();
      expect(restriction.priority).toBe("high");

      // With 4 anomalies (> 3), should include suspension recommendation
      const suspension = result.data.recommendations.find((r) =>
        r.action.toLowerCase().includes("suspend")
      );
      expect(suspension).toBeDefined();
    });

    it("returns medium-priority recommendations for medium risk", async () => {
      const result = await getFraudRecommendations({
        userId: "user-1",
        riskLevel: "medium",
        anomalies: [],
      });

      expect(result.success).toBe(true);
      expect(result.data.recommendations.length).toBeGreaterThanOrEqual(3);
      expect(result.data.recommendations.every((r) => r.priority === "medium")).toBe(true);
    });

    it("returns low-priority recommendations for low risk", async () => {
      const result = await getFraudRecommendations({
        userId: "user-1",
        riskLevel: "low",
        anomalies: [],
      });

      expect(result.success).toBe(true);
      expect(result.data.recommendations.length).toBeGreaterThanOrEqual(2);
      expect(result.data.recommendations.every((r) => r.priority === "low")).toBe(true);
    });

    it("returns error when required params are missing", async () => {
      const noUser = await getFraudRecommendations({ riskLevel: "high" });
      expect(noUser.success).toBe(false);

      const noLevel = await getFraudRecommendations({ userId: "u1" });
      expect(noLevel.success).toBe(false);
    });
  });
});
