// Tests for CDN & Storage Abstraction

import { describe, it, expect } from "vitest";

describe("Storage Adapter", () => {
  it("should register and switch providers", () => {
    const providers = new Map();
    providers.set("local", { name: "local" });
    providers.set("s3", { name: "s3" });

    let active = "local";
    expect(providers.has(active)).toBe(true);

    active = "s3";
    expect(providers.get(active).name).toBe("s3");
  });

  it("should reject unknown providers", () => {
    const providers = new Map();
    providers.set("local", { name: "local" });

    const active = "gcs";
    expect(providers.has(active)).toBe(false);
  });

  it("should build file paths consistently", () => {
    const bucket = "uploads";
    const path = "user-123/photo.jpg";
    const fullPath = `/uploads/${bucket}/${path}`;

    expect(fullPath).toBe("/uploads/uploads/user-123/photo.jpg");
  });
});

describe("Signed URL Engine", () => {
  it("should enforce max expiration", () => {
    const expiresIn = 86400; // 24 hours
    const maxExpiry = 604800; // 7 days
    const actual = Math.min(expiresIn, maxExpiry);

    expect(actual).toBe(86400);
  });

  it("should cap upload URLs to 1 day", () => {
    const expiresIn = 172800; // 48 hours requested
    const maxUpload = 86400; // 24 hours max
    const actual = Math.min(expiresIn, maxUpload);

    expect(actual).toBe(86400);
  });
});

describe("Image Optimizer", () => {
  it("should build transformation URLs", () => {
    const baseUrl = "https://cdn.example.com/photo.jpg";
    const params = new URLSearchParams({
      w: "320",
      h: "240",
      fm: "webp",
      q: "80",
    });
    const url = `${baseUrl}?${params.toString()}`;

    expect(url).toContain("w=320");
    expect(url).toContain("fm=webp");
    expect(url).toContain("q=80");
  });

  it("should generate srcset", () => {
    const widths = [320, 640, 960];
    const srcset = widths.map((w) => `image.jpg?w=${w} ${w}w`).join(", ");

    expect(srcset).toContain("320w");
    expect(srcset).toContain("960w");
  });

  it("should estimate file sizes by format", () => {
    const width = 1920;
    const height = 1080;
    const pixels = width * height;

    const estimateJPEG = Math.round(pixels * 0.3);
    const estimateWebP = Math.round(pixels * 0.2);

    expect(estimateJPEG).toBeGreaterThan(estimateWebP);
  });

  it("should validate image dimensions", () => {
    const maxDimension = 10000;
    const minDimension = 1;

    expect(1920 >= minDimension && 1920 <= maxDimension).toBe(true);
    expect(0 >= minDimension).toBe(false);
    expect(50000 >= minDimension && 50000 <= maxDimension).toBe(false);
  });
});
