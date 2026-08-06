import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProvider,
  registerProvider,
  listProviders,
  FundoraInternalProvider,
} from "../../lib/verification/provider";
import { BaseVerificationProvider } from "../../lib/verification/baseProvider";

describe("BaseVerificationProvider", () => {
  it("cannot be instantiated directly", () => {
    expect(() => new BaseVerificationProvider()).toThrow(
      "BaseVerificationProvider is abstract",
    );
  });

  it("requires subclass to implement methods", async () => {
    class TestProvider extends BaseVerificationProvider {
      constructor() {
        super({ providerName: "test" });
      }
    }

    const provider = new TestProvider();
    // Async methods return rejected promises
    await expect(provider.submitVerification({})).rejects.toThrow(
      "must be implemented",
    );
    await expect(provider.checkStatus("")).rejects.toThrow(
      "must be implemented",
    );
    await expect(provider.handleWebhook({}, "")).rejects.toThrow(
      "must be implemented",
    );
    // Sync methods throw directly
    expect(() => provider.mapStatus("")).toThrow("must be implemented");
    expect(() => provider.calculateTrustScore({})).toThrow(
      "must be implemented",
    );
    expect(() => provider.calculateRiskScore({})).toThrow(
      "must be implemented",
    );
    expect(() => provider.verifyWebhookSignature("", "")).toThrow(
      "must be implemented",
    );
  });

  it("stores config properties", () => {
    class TestProvider extends BaseVerificationProvider {
      constructor() {
        super({
          providerName: "test",
          apiKey: "key123",
          baseUrl: "https://api.test.com",
        });
      }
    }

    const provider = new TestProvider();
    expect(provider.providerName).toBe("test");
    expect(provider.apiKey).toBe("key123");
    expect(provider.baseUrl).toBe("https://api.test.com");
  });
});

describe("FundoraInternalProvider", () => {
  let provider;

  beforeEach(() => {
    provider = new FundoraInternalProvider();
  });

  it("has correct provider name", () => {
    expect(provider.providerName).toBe("fundora_internal");
  });

  it("initializes without error", async () => {
    await expect(provider.initialize()).resolves.toBeUndefined();
  });

  it("submits verification successfully", async () => {
    const result = await provider.submitVerification({ userId: "user-123" });
    expect(result).toHaveProperty("referenceId");
    expect(result).toHaveProperty("status", "under_review");
  });

  it("returns under_review for checkStatus", async () => {
    const result = await provider.checkStatus("ref-123");
    expect(result.status).toBe("under_review");
  });

  it("returns null for handleWebhook", async () => {
    const result = await provider.handleWebhook({}, "");
    expect(result).toBeNull();
  });

  it("maps statuses correctly", () => {
    expect(provider.mapStatus("submitted")).toBe("under_review");
    expect(provider.mapStatus("approved")).toBe("approved");
    expect(provider.mapStatus("rejected")).toBe("rejected");
    expect(provider.mapStatus("expired")).toBe("expired");
    expect(provider.mapStatus("unknown")).toBe("pending");
  });

  it("calculates default trust score", () => {
    expect(provider.calculateTrustScore({})).toBe(50);
  });

  it("calculates default risk score", () => {
    expect(provider.calculateRiskScore({})).toBe(25);
  });

  it("always verifies webhook signature", () => {
    expect(provider.verifyWebhookSignature("", "")).toBe(true);
  });
});

describe("Provider Registry", () => {
  it("has fundora_internal registered by default", () => {
    const providers = listProviders();
    expect(providers).toContain("fundora_internal");
  });

  it("returns fundora_internal for unknown provider", () => {
    const provider = getProvider("nonexistent");
    expect(provider).toBeInstanceOf(FundoraInternalProvider);
  });

  it("returns fundora_internal by default", () => {
    const provider = getProvider();
    expect(provider).toBeInstanceOf(FundoraInternalProvider);
  });

  it("registers custom provider", () => {
    class CustomProvider extends BaseVerificationProvider {
      constructor() {
        super({ providerName: "custom" });
      }
    }

    registerProvider("custom", new CustomProvider());
    const provider = getProvider("custom");
    expect(provider.providerName).toBe("custom");
  });

  it("rejects non-BaseVerificationProvider instances", () => {
    expect(() => registerProvider("bad", { notAProvider: true })).toThrow(
      "must extend BaseVerificationProvider",
    );
  });
});
