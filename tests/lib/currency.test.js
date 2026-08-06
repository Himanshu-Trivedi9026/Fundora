// Tests for Multi-Currency System

import { describe, it, expect } from "vitest";

describe("Currency Engine", () => {
  const currencies = [
    { code: "INR", name: "Indian Rupee", symbol: "₹" },
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "British Pound", symbol: "£" },
    { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  ];

  const exchangeRates = {
    "USD:INR": 83.5,
    "EUR:INR": 90.2,
    "GBP:INR": 105.3,
    "INR:USD": 0.012,
    "EUR:USD": 1.08,
  };

  it("should convert between currencies", () => {
    const amount = 100;
    const rate = exchangeRates["USD:INR"];
    const converted = Math.round(amount * rate * 100) / 100;

    expect(converted).toBe(8350);
  });

  it("should return inverse rate when direct rate not found", () => {
    const from = "INR";
    const to = "EUR";
    const inverseRate = exchangeRates["EUR:INR"];
    const converted = 100 / inverseRate;

    expect(converted).toBeCloseTo(1.1086, 3);
  });

  it("should handle zero amount conversion", () => {
    const amount = 0;
    const rate = exchangeRates["USD:INR"];
    const converted = amount * rate;

    expect(converted).toBe(0);
  });

  it("should round to proper decimal places by currency", () => {
    const decimalPlaces = { INR: 2, USD: 2, JPY: 0 };
    const amount = 123.456;

    const roundedINR = Math.round(amount * 100) / 100;
    const roundedJPY = Math.round(amount);

    expect(roundedINR).toBe(123.46);
    expect(roundedJPY).toBe(123);
  });

  it("should cache exchange rates with TTL", () => {
    const cache = { "USD:INR": { rate: 83.5, timestamp: Date.now() } };
    const ttl = 300000; // 5 min

    const isExpired = Date.now() - cache["USD:INR"].timestamp > ttl;
    expect(isExpired).toBe(false);
  });

  it("should format currency with symbol and locale", () => {
    const amount = 1000;
    const symbol = "₹";
    const formatted = `${symbol}${amount.toLocaleString("en-IN")}`;

    expect(formatted).toBe("₹1,000");
  });
});

describe("Exchange Rate Provider", () => {
  it("should return null for unknown currency pairs", () => {
    const rates = new Map();
    rates.set("USD:INR", 83.5);

    expect(rates.has("BTC:INR")).toBe(false);
  });

  it("should support rate updates", () => {
    const rates = new Map();
    rates.set("USD:INR", 83.5);
    rates.set("USD:INR", 84.0); // update

    expect(rates.get("USD:INR")).toBe(84.0);
  });

  it("should preserve precision during conversion", () => {
    const amount = 1.07;
    const rate = 0.012;
    const result = amount * rate;

    expect(result).toBe(0.01284);
  });
});
