import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (must be before imports, use vi.hoisted for hoistable references) ───

const { MockBaseVerificationProvider } = vi.hoisted(() => {
  class MockBaseVerificationProvider {
    constructor({ providerName } = {}) {
      this.providerName = providerName || "mock";
    }
    async initialize() {}
    async submitVerification() {
      return { referenceId: "mock_ref", status: "initiated" };
    }
    async checkStatus() {
      return { status: "mock_status" };
    }
    async handleWebhook() {
      return null;
    }
    mapStatus(s) {
      return s;
    }
    calculateTrustScore() {
      return 50;
    }
    calculateRiskScore() {
      return 25;
    }
    verifyWebhookSignature() {
      return true;
    }
  }
  return { MockBaseVerificationProvider };
});

vi.mock("../../lib/verification/baseProvider", () => ({
  BaseVerificationProvider: MockBaseVerificationProvider,
}));

vi.mock("../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// Mock all Phase 4 provider classes — define inline since they only need to extend the hoisted class
vi.mock("../../lib/verification/providers/pennyDropProvider", () => ({
  PennyDropProvider: class extends MockBaseVerificationProvider {
    constructor() {
      super({ providerName: "penny_drop_internal" });
    }
  },
}));

vi.mock(
  "../../lib/verification/providers/businessVerificationProvider",
  () => ({
    BusinessVerificationProvider: class extends MockBaseVerificationProvider {
      constructor() {
        super({ providerName: "fundora_internal_business" });
      }
    },
  }),
);

vi.mock("../../lib/verification/providers/bankVerificationProvider", () => ({
  BankVerificationProvider: class extends MockBaseVerificationProvider {
    constructor() {
      super({ providerName: "fundora_internal_bank" });
    }
  },
}));

vi.mock("../../lib/verification/providers/gstVerificationProvider", () => ({
  GSTVerificationProvider: class extends MockBaseVerificationProvider {
    constructor() {
      super({ providerName: "fundora_internal_gst" });
    }
  },
}));

vi.mock("../../lib/verification/providers/panVerificationProvider", () => ({
  PANVerificationProvider: class extends MockBaseVerificationProvider {
    constructor() {
      super({ providerName: "fundora_internal_pan" });
    }
  },
}));

vi.mock("../../lib/verification/ocrProviderRegistry", () => ({
  getOCRProvider: vi.fn().mockReturnValue(null),
  listOCRProviders: vi.fn().mockReturnValue([]),
  registerOCRProvider: vi.fn(),
}));

import {
  getProvider,
  listProviders,
  getProviderCapabilities,
  listProviderCapabilities,
  registerProvider,
  FundoraInternalProvider,
  getOCRProviderByName,
  listOCRProviderNames,
} from "../../lib/verification/provider";
import { logWarn } from "../../lib/verification/secureLogger";

describe("Provider Registry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getProvider ───
  describe("getProvider", () => {
    it("returns default provider when called with no arguments", () => {
      const provider = getProvider();
      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(MockBaseVerificationProvider);
    });

    it("returns fundora_internal provider by default", () => {
      const provider = getProvider("fundora_internal");
      expect(provider).toBeDefined();
    });

    it("returns penny_drop_internal provider", () => {
      const provider = getProvider("penny_drop_internal");
      expect(provider).toBeDefined();
    });

    it("returns fundora_internal_business provider", () => {
      const provider = getProvider("fundora_internal_business");
      expect(provider).toBeDefined();
    });

    it("returns fundora_internal_bank provider", () => {
      const provider = getProvider("fundora_internal_bank");
      expect(provider).toBeDefined();
    });

    it("returns fundora_internal_gst provider", () => {
      const provider = getProvider("fundora_internal_gst");
      expect(provider).toBeDefined();
    });

    it("returns fundora_internal_pan provider", () => {
      const provider = getProvider("fundora_internal_pan");
      expect(provider).toBeDefined();
    });

    it("falls back to fundora_internal when provider not found", () => {
      const provider = getProvider("nonexistent_provider");
      expect(provider).toBeDefined();
      expect(logWarn).toHaveBeenCalledWith(
        "VerificationProvider",
        expect.stringContaining("not found"),
      );
    });

    it("fallback provider is an instance of BaseVerificationProvider", () => {
      const provider = getProvider("unknown");
      expect(provider).toBeInstanceOf(MockBaseVerificationProvider);
    });
  });

  // ─── listProviders ───
  describe("listProviders", () => {
    it("returns an array of provider names", () => {
      const providers = listProviders();
      expect(Array.isArray(providers)).toBe(true);
    });

    it("includes fundora_internal", () => {
      const providers = listProviders();
      expect(providers).toContain("fundora_internal");
    });

    it("includes all Phase 4 providers", () => {
      const providers = listProviders();
      expect(providers).toContain("penny_drop_internal");
      expect(providers).toContain("fundora_internal_business");
      expect(providers).toContain("fundora_internal_bank");
      expect(providers).toContain("fundora_internal_gst");
      expect(providers).toContain("fundora_internal_pan");
    });

    it("returns at least 6 providers", () => {
      const providers = listProviders();
      expect(providers.length).toBeGreaterThanOrEqual(6);
    });

    it("all returned providers can be retrieved with getProvider", () => {
      const providers = listProviders();
      providers.forEach((name) => {
        const provider = getProvider(name);
        expect(provider).toBeDefined();
      });
    });
  });

  // ─── getProviderCapabilities ───
  describe("getProviderCapabilities", () => {
    it("returns capabilities for fundora_internal", () => {
      const caps = getProviderCapabilities("fundora_internal");
      expect(caps).toBeDefined();
      expect(caps.name).toBe("Fundora Internal");
      expect(caps.type).toBe("manual_review");
    });

    it("returns capabilities for stripe_identity", () => {
      const caps = getProviderCapabilities("stripe_identity");
      expect(caps).toBeDefined();
      expect(caps.name).toBe("Stripe Identity");
      expect(caps.type).toBe("automated");
      expect(caps.ocr).toBe(true);
    });

    it("returns capabilities for hyperverge", () => {
      const caps = getProviderCapabilities("hyperverge");
      expect(caps).toBeDefined();
      expect(caps.ocr).toBe(true);
      expect(caps.faceMatch).toBe(true);
      expect(caps.liveness).toBe(true);
    });

    it("returns capabilities for signzy", () => {
      const caps = getProviderCapabilities("signzy");
      expect(caps).toBeDefined();
      expect(caps.liveness).toBe(false);
    });

    it("returns capabilities for penny_drop_internal", () => {
      const caps = getProviderCapabilities("penny_drop_internal");
      expect(caps).toBeDefined();
      expect(caps.type).toBe("mock");
      expect(caps.supports).toContain("bank");
    });

    it("returns capabilities for fundora_internal_business", () => {
      const caps = getProviderCapabilities("fundora_internal_business");
      expect(caps).toBeDefined();
      expect(caps.type).toBe("mock");
      expect(caps.supports).toContain("business");
    });

    it("returns capabilities for fundora_internal_bank", () => {
      const caps = getProviderCapabilities("fundora_internal_bank");
      expect(caps).toBeDefined();
      expect(caps.supports).toContain("bank");
    });

    it("returns capabilities for fundora_internal_gst", () => {
      const caps = getProviderCapabilities("fundora_internal_gst");
      expect(caps).toBeDefined();
      expect(caps.supports).toContain("business");
    });

    it("returns capabilities for fundora_internal_pan", () => {
      const caps = getProviderCapabilities("fundora_internal_pan");
      expect(caps).toBeDefined();
      expect(caps.supports).toContain("identity");
    });

    it("returns null for unknown provider", () => {
      const caps = getProviderCapabilities("nonexistent");
      expect(caps).toBeNull();
    });

    it("returns null for empty string", () => {
      const caps = getProviderCapabilities("");
      expect(caps).toBeNull();
    });

    it("returns null for null", () => {
      const caps = getProviderCapabilities(null);
      expect(caps).toBeNull();
    });
  });

  // ─── listProviderCapabilities ───
  describe("listProviderCapabilities", () => {
    it("returns an object", () => {
      const all = listProviderCapabilities();
      expect(typeof all).toBe("object");
      expect(all).not.toBeNull();
    });

    it("includes fundora_internal capabilities", () => {
      const all = listProviderCapabilities();
      expect(all).toHaveProperty("fundora_internal");
    });

    it("includes all Phase 4 provider capabilities", () => {
      const all = listProviderCapabilities();
      expect(all).toHaveProperty("penny_drop_internal");
      expect(all).toHaveProperty("fundora_internal_business");
      expect(all).toHaveProperty("fundora_internal_bank");
      expect(all).toHaveProperty("fundora_internal_gst");
      expect(all).toHaveProperty("fundora_internal_pan");
    });

    it("includes third-party provider capabilities", () => {
      const all = listProviderCapabilities();
      expect(all).toHaveProperty("stripe_identity");
      expect(all).toHaveProperty("hyperverge");
      expect(all).toHaveProperty("signzy");
      expect(all).toHaveProperty("onfido");
      expect(all).toHaveProperty("persona");
    });

    it("each capability entry has required fields", () => {
      const all = listProviderCapabilities();
      Object.values(all).forEach((cap) => {
        expect(cap).toHaveProperty("name");
        expect(cap).toHaveProperty("type");
        expect(cap).toHaveProperty("supports");
        expect(cap).toHaveProperty("ocr");
        expect(cap).toHaveProperty("faceMatch");
        expect(cap).toHaveProperty("liveness");
      });
    });
  });

  // ─── registerProvider ───
  describe("registerProvider", () => {
    it("registers a new provider with BaseVerificationProvider instance", () => {
      const newProvider = new MockBaseVerificationProvider({
        providerName: "test_provider",
      });
      registerProvider("test_provider", newProvider);

      const retrieved = getProvider("test_provider");
      expect(retrieved).toBe(newProvider);
    });

    it("throws error when registering non-BaseVerificationProvider instance", () => {
      expect(() => {
        registerProvider("bad_provider", { notAProvider: true });
      }).toThrow("Provider must extend BaseVerificationProvider");
    });

    it("throws error when registering a plain object", () => {
      expect(() => {
        registerProvider("bad_provider", {});
      }).toThrow("Provider must extend BaseVerificationProvider");
    });

    it("overwrites existing provider with same name", () => {
      const provider1 = new MockBaseVerificationProvider({
        providerName: "overwrite_test",
      });
      const provider2 = new MockBaseVerificationProvider({
        providerName: "overwrite_test_v2",
      });

      registerProvider("overwrite_test", provider1);
      registerProvider("overwrite_test", provider2);

      const retrieved = getProvider("overwrite_test");
      expect(retrieved).toBe(provider2);
    });
  });

  // ─── FundoraInternalProvider ───
  describe("FundoraInternalProvider", () => {
    it("is exported and instantiable", () => {
      const provider = new FundoraInternalProvider();
      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(MockBaseVerificationProvider);
    });

    it("has providerName set to fundora_internal", () => {
      const provider = new FundoraInternalProvider();
      expect(provider.providerName).toBe("fundora_internal");
    });

    it("can submitVerification", async () => {
      const provider = new FundoraInternalProvider();
      const result = await provider.submitVerification({ userId: "user-123" });
      expect(result).toHaveProperty("referenceId");
      expect(result).toHaveProperty("status");
    });

    it("can checkStatus", async () => {
      const provider = new FundoraInternalProvider();
      const result = await provider.checkStatus("ref-123");
      expect(result).toHaveProperty("status");
    });

    it("can handleWebhook", async () => {
      const provider = new FundoraInternalProvider();
      const result = await provider.handleWebhook({});
      expect(result).toBeNull();
    });

    it("mapStatus maps 'approved' correctly", () => {
      const provider = new FundoraInternalProvider();
      expect(provider.mapStatus("approved")).toBe("approved");
    });

    it("mapStatus maps 'submitted' to 'under_review'", () => {
      const provider = new FundoraInternalProvider();
      expect(provider.mapStatus("submitted")).toBe("under_review");
    });

    it("mapStatus returns 'pending' for unknown status", () => {
      const provider = new FundoraInternalProvider();
      expect(provider.mapStatus("unknown")).toBe("pending");
    });

    it("calculateTrustScore returns 50", () => {
      const provider = new FundoraInternalProvider();
      expect(provider.calculateTrustScore()).toBe(50);
    });

    it("calculateRiskScore returns 25", () => {
      const provider = new FundoraInternalProvider();
      expect(provider.calculateRiskScore()).toBe(25);
    });

    it("verifyWebhookSignature returns true", () => {
      const provider = new FundoraInternalProvider();
      expect(provider.verifyWebhookSignature()).toBe(true);
    });
  });

  // ─── OCR Provider Integration ───
  describe("OCR Provider Integration", () => {
    it("getOCRProviderByName returns null for unknown provider", () => {
      const result = getOCRProviderByName("nonexistent_ocr");
      expect(result).toBeNull();
    });

    it("listOCRProviderNames returns an array", () => {
      const result = listOCRProviderNames();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
