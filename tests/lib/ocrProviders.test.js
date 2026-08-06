import { describe, it, expect, beforeEach } from "vitest";
import OCRProvider from "../../lib/verification/ocrProvider";
import FundoraInternalOCRProvider from "../../lib/verification/providers/fundoraInternalOCR";
import {
  registerOCRProvider,
  getOCRProvider,
  getDefaultOCRProvider,
  listOCRProviders,
  clearOCRProviders,
} from "../../lib/verification/ocrProviderRegistry";

describe("OCR Providers", () => {
  describe("OCRProvider (abstract base class)", () => {
    it("cannot be instantiated directly", () => {
      expect(() => new OCRProvider()).toThrow("OCRProvider is abstract and cannot be instantiated directly");
    });

    it("throws for all abstract methods when called on a subclass that doesn't implement them", async () => {
      // Create a minimal subclass that doesn't override any methods
      class MinimalProvider extends OCRProvider {
        constructor() {
          super({ providerName: "minimal" });
        }
      }

      const provider = new MinimalProvider();
      expect(provider.providerName).toBe("minimal");

      await expect(provider.initialize()).rejects.toThrow("must be implemented");
      await expect(provider.extractText(Buffer.alloc(0))).rejects.toThrow("must be implemented");
      await expect(provider.validateDocumentFields({}, "pan_card")).rejects.toThrow("must be implemented");
      await expect(provider.compareFaces(Buffer.alloc(0), Buffer.alloc(0))).rejects.toThrow("must be implemented");
      await expect(provider.getOCRStatus("req-1")).rejects.toThrow("must be implemented");
      expect(() => provider.mapOCRResult({})).toThrow("must be implemented");
    });

    it("sets providerName from config", async () => {
      class TestProvider extends OCRProvider {
        async initialize() { return { success: true }; }
      }
      const provider = new TestProvider({ providerName: "test_provider" });
      expect(provider.providerName).toBe("test_provider");
    });

    it("defaults providerName to 'unknown' if not provided", async () => {
      class TestProvider extends OCRProvider {
        async initialize() { return { success: true }; }
      }
      const provider = new TestProvider();
      expect(provider.providerName).toBe("unknown");
    });

    it("stores apiKey and baseUrl from config", async () => {
      class TestProvider extends OCRProvider {
        async initialize() { return { success: true }; }
      }
      const provider = new TestProvider({
        providerName: "test",
        apiKey: "sk-123",
        baseUrl: "https://api.test.com",
      });
      expect(provider.apiKey).toBe("sk-123");
      expect(provider.baseUrl).toBe("https://api.test.com");
    });

    it("defaults apiKey and baseUrl to null", async () => {
      class TestProvider extends OCRProvider {
        async initialize() { return { success: true }; }
      }
      const provider = new TestProvider({ providerName: "test" });
      expect(provider.apiKey).toBeNull();
      expect(provider.baseUrl).toBeNull();
    });
  });

  describe("FundoraInternalOCRProvider", () => {
    let provider;

    beforeEach(() => {
      provider = new FundoraInternalOCRProvider();
    });

    it("is an instance of OCRProvider", () => {
      expect(provider).toBeInstanceOf(OCRProvider);
    });

    it("is an instance of FundoraInternalOCRProvider", () => {
      expect(provider).toBeInstanceOf(FundoraInternalOCRProvider);
    });

    it("has providerName 'fundora_internal'", () => {
      expect(provider.providerName).toBe("fundora_internal");
    });

    it("initialize() returns success", async () => {
      const result = await provider.initialize();
      expect(result).toEqual({ success: true });
    });

    it("extractText() returns success with mock data", async () => {
      const result = await provider.extractText(Buffer.alloc(100), {
        documentType: "pan_card",
        mimeType: "image/jpeg",
      });
      expect(result.success).toBe(true);
      expect(result.text).toContain("pan_card");
      expect(result.fields).toBeDefined();
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("extractText() returns mock fields for pan_card", async () => {
      const result = await provider.extractText(Buffer.alloc(100), {
        documentType: "pan_card",
      });
      expect(result.fields).toHaveProperty("name");
      expect(result.fields).toHaveProperty("pan_number");
    });

    it("extractText() returns mock fields for aadhaar_card", async () => {
      const result = await provider.extractText(Buffer.alloc(100), {
        documentType: "aadhaar_card",
      });
      expect(result.fields).toHaveProperty("aadhaar_number");
    });

    it("extractText() returns generic fields for unknown type", async () => {
      const result = await provider.extractText(Buffer.alloc(100), {
        documentType: "unknown_doc",
      });
      expect(result.fields).toHaveProperty("generic");
    });

    it("validateDocumentFields() returns valid", async () => {
      const result = await provider.validateDocumentFields({ name: "Test" }, "pan_card");
      expect(result.valid).toBe(true);
      expect(result.validatedFields).toEqual({ name: "Test" });
      expect(result.errors).toEqual([]);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("validateDocumentFields() handles null extractedData", async () => {
      const result = await provider.validateDocumentFields(null, "pan_card");
      expect(result.valid).toBe(true);
      expect(result.validatedFields).toEqual({});
    });

    it("compareFaces() returns match: true", async () => {
      const result = await provider.compareFaces(Buffer.alloc(10), Buffer.alloc(10));
      expect(result.success).toBe(true);
      expect(result.match).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("getOCRStatus() returns completed status", async () => {
      const result = await provider.getOCRStatus("req-123");
      expect(result.status).toBe("completed");
      expect(result.result).toBeDefined();
    });

    it("mapOCRResult() normalizes result", () => {
      const result = provider.mapOCRResult({
        fields: { name: "Test" },
        confidence: 0.9,
      });
      expect(result.fields).toEqual({ name: "Test" });
      expect(result.confidence).toBe(0.9);
      expect(result.provider).toBe("fundora_internal");
      expect(result.timestamp).toBeDefined();
    });

    it("mapOCRResult() handles null input", () => {
      const result = provider.mapOCRResult(null);
      expect(result.fields).toEqual({});
      expect(result.confidence).toBe(0);
    });
  });

  describe("ocrProviderRegistry", () => {
    beforeEach(() => {
      clearOCRProviders();
    });

    describe("registerOCRProvider", () => {
      it("registers a valid provider class", () => {
        class TestOCR extends OCRProvider {
          async initialize() { return { success: true }; }
        }
        expect(() => registerOCRProvider("test_ocr", TestOCR)).not.toThrow();
      });

      it("throws for missing name", () => {
        class TestOCR extends OCRProvider {
          async initialize() { return { success: true }; }
        }
        expect(() => registerOCRProvider(null, TestOCR)).toThrow("name is required");
        expect(() => registerOCRProvider("", TestOCR)).toThrow("name is required");
        expect(() => registerOCRProvider(123, TestOCR)).toThrow("name is required");
      });

      it("throws for non-OCRProvider class", () => {
        class NotOCR {}
        expect(() => registerOCRProvider("bad", NotOCR)).toThrow("must extend OCRProvider");
      });

      it("throws for OCRProvider base class itself", () => {
        expect(() => registerOCRProvider("base", OCRProvider)).toThrow("must extend OCRProvider");
      });

      it("throws for null class", () => {
        expect(() => registerOCRProvider("test", null)).toThrow();
      });
    });

    describe("getOCRProvider", () => {
      it("returns an instance of the registered provider", () => {
        class TestOCR extends OCRProvider {
          async initialize() { return { success: true }; }
        }
        registerOCRProvider("test_get", TestOCR);
        const provider = getOCRProvider("test_get");
        expect(provider).toBeInstanceOf(TestOCR);
        expect(provider).toBeInstanceOf(OCRProvider);
      });

      it("returns null for unregistered provider", () => {
        const provider = getOCRProvider("nonexistent");
        expect(provider).toBeNull();
      });

      it("passes config to constructor", () => {
        class TestOCR extends OCRProvider {
          async initialize() { return { success: true }; }
        }
        registerOCRProvider("test_config", TestOCR);
        const provider = getOCRProvider("test_config", { apiKey: "sk-abc" });
        expect(provider.apiKey).toBe("sk-abc");
      });

      it("sets providerName on the instance", () => {
        class TestOCR extends OCRProvider {
          async initialize() { return { success: true }; }
        }
        registerOCRProvider("test_name", TestOCR);
        const provider = getOCRProvider("test_name");
        expect(provider.providerName).toBe("test_name");
      });
    });

    describe("getDefaultOCRProvider", () => {
      it("returns fundora_internal if registered", () => {
        registerOCRProvider("fundora_internal", FundoraInternalOCRProvider);
        const provider = getDefaultOCRProvider();
        expect(provider).toBeInstanceOf(FundoraInternalOCRProvider);
      });

      it("returns cached instance on subsequent calls", () => {
        registerOCRProvider("fundora_internal", FundoraInternalOCRProvider);
        const provider1 = getDefaultOCRProvider();
        const provider2 = getDefaultOCRProvider();
        expect(provider1).toBe(provider2); // Same instance (cached)
      });

      it("returns null if no providers registered", () => {
        const provider = getDefaultOCRProvider();
        expect(provider).toBeNull();
      });

      it("falls back to first registered provider if fundora_internal not available", () => {
        class FallbackOCR extends OCRProvider {
          async initialize() { return { success: true }; }
        }
        registerOCRProvider("fallback", FallbackOCR);
        const provider = getDefaultOCRProvider();
        expect(provider).toBeInstanceOf(FallbackOCR);
      });
    });

    describe("listOCRProviders", () => {
      it("returns empty array when no providers registered", () => {
        expect(listOCRProviders()).toEqual([]);
      });

      it("returns registered provider names", () => {
        class TestOCR1 extends OCRProvider {
          async initialize() { return { success: true }; }
        }
        class TestOCR2 extends OCRProvider {
          async initialize() { return { success: true }; }
        }
        registerOCRProvider("provider_a", TestOCR1);
        registerOCRProvider("provider_b", TestOCR2);
        const list = listOCRProviders();
        expect(list).toContain("provider_a");
        expect(list).toContain("provider_b");
        expect(list).toHaveLength(2);
      });
    });

    describe("clearOCRProviders", () => {
      it("clears all registered providers", () => {
        class TestOCR extends OCRProvider {
          async initialize() { return { success: true }; }
        }
        registerOCRProvider("to_clear", TestOCR);
        expect(listOCRProviders()).toContain("to_clear");
        clearOCRProviders();
        expect(listOCRProviders()).toEqual([]);
      });

      it("resets default provider", () => {
        registerOCRProvider("fundora_internal", FundoraInternalOCRProvider);
        getDefaultOCRProvider(); // caches it
        clearOCRProviders();
        // After clearing, should return null (no providers)
        const provider = getDefaultOCRProvider();
        expect(provider).toBeNull();
      });
    });
  });
});
