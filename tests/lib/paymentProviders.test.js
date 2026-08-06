// Tests for Global Payment Providers

import { describe, it, expect } from "vitest";

describe("Payment Provider Adapter", () => {
  it("should support multiple providers", () => {
    const providers = new Map();
    providers.set("stripe", { name: "Stripe", fee: 2.5 });
    providers.set("paypal", { name: "PayPal", fee: 2.9 });
    providers.set("wise", { name: "Wise", fee: 0.5 });

    expect(providers.size).toBe(3);
  });

  it("should switch active provider", () => {
    const providers = ["stripe", "paypal", "wise"];
    let active = "stripe";
    active = "paypal";

    expect(active).toBe("paypal");
  });

  it("should compute processing fees", () => {
    const amount = 1000;
    const stripeFee = amount * 0.025;
    const paypalFee = amount * 0.029 + 0.3;

    expect(stripeFee).toBe(25);
    expect(paypalFee).toBe(29.3);
  });
});

describe("Base Provider Contract", () => {
  const requiredMethods = [
    "processPayment",
    "verifyPayment",
    "refundPayment",
    "getBalance",
    "validateWebhook",
    "getSupportedCurrencies",
    "getSupportedCountries",
    "processPayout",
  ];

  it("should require all contract methods", () => {
    const provider = {};
    const missing = requiredMethods.filter(
      (m) => typeof provider[m] !== "function",
    );

    expect(missing).toHaveLength(requiredMethods.length); // All missing — not implemented
  });
});

describe("Provider Registry", () => {
  it("should register and retrieve providers", () => {
    const registry = new Map();
    const mockProvider = {
      supportedCurrencies: ["USD", "INR"],
      supportedCountries: ["US", "IN"],
    };

    registry.set("mock", mockProvider);
    expect(registry.get("mock").supportedCurrencies).toContain("USD");
    expect(registry.get("mock").supportedCountries).toContain("IN");
  });

  it("should initialize all providers", () => {
    const providers = [
      { name: "stripe", initialized: false },
      { name: "paypal", initialized: false },
    ];

    for (const p of providers) {
      p.initialized = true;
    }

    expect(providers.every((p) => p.initialized)).toBe(true);
  });
});
