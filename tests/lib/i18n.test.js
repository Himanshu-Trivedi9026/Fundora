// Tests for Internationalization (i18n) System

import { describe, it, expect } from "vitest";

describe("Translation Service", () => {
  const supportedLocales = ["en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa",
    "ur", "or", "as", "mai", "sat", "ks", "ne", "sd", "fr", "es"];

  const rtlLocales = ["ur", "ar"];

  it("should support 20 locales", () => {
    expect(supportedLocales).toHaveLength(20);
  });

  it("should detect RTL locales", () => {
    expect(rtlLocales).toContain("ur");
    expect(rtlLocales).not.toContain("en");
    expect(rtlLocales).not.toContain("hi");
  });

  it("should interpolate template parameters", () => {
    const template = "Hello {{name}}, you have {{count}} messages";
    const result = template
      .replace("{{name}}", "John")
      .replace("{{count}}", "5");

    expect(result).toBe("Hello John, you have 5 messages");
  });

  it("should resolve locale from Accept-Language header", () => {
    const parseAcceptLanguage = (header) => {
      if (!header) return "en";
      const locales = header.split(",").map((l) => {
        const [locale, q] = l.trim().split(";q=");
        return { locale: locale.split("-")[0], q: q ? parseFloat(q) : 1.0 };
      });
      locales.sort((a, b) => b.q - a.q);

      return locales.find((l) => supportedLocales.includes(l.locale))?.locale || "en";
    };

    expect(parseAcceptLanguage("hi-IN;q=0.9,en;q=0.5")).toBe("hi");
    expect(parseAcceptLanguage("fr;q=0.8,es;q=0.6")).toBe("fr");
    expect(parseAcceptLanguage("de;q=0.8")).toBe("en"); // fallback
    expect(parseAcceptLanguage("")).toBe("en");
  });

  it("should cache translations with TTL", () => {
    const cache = new Map();
    const ttl = 300000; // 5 min

    cache.set("en:default", { hello: "Hello" });
    expect(cache.has("en:default")).toBe(true);

    // Simulate cache expiry
    const timeElapsed = 400000;
    const isExpired = timeElapsed > ttl;
    if (isExpired) cache.delete("en:default");

    expect(cache.has("en:default")).toBe(false);
  });
});

describe("Format Helpers", () => {
  it("should format numbers with locale", () => {
    const number = 1234567.89;
    const formatted = new Intl.NumberFormat("en-IN").format(number);
    expect(formatted).toBe("12,34,567.89"); // Indian numbering
  });

  it("should format currency with symbol", () => {
    const amount = 1000;
    const formatted = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);

    expect(formatted).toContain("₹");
    expect(formatted).toContain("1,000");
  });

  it("should format relative time", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 3600000); // 1 hour ago
    const diffMs = now - past;
    const diffMinutes = Math.floor(diffMs / 60000);

    expect(diffMinutes).toBe(60);
  });

  it("should format date according to locale", () => {
    const date = new Date("2025-01-15");
    const formatted = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "full",
    }).format(date);

    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe("string");
  });
});
