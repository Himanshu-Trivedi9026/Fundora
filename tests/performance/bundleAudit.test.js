import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Bundle Audit — Parse Next.js build output for per-route first-load JS sizes.
 *
 * Note: In Next.js with Turbopack, the build manifest lists all chunks needed
 * for each route including shared chunks. Shared chunks are loaded once and
 * cached, so the actual "first-load" size per route = shared chunks + route-only chunks.
 *
 * This test deduplicates shared chunks to calculate real first-load sizes.
 */

const NEXT_BUILD_DIR = join(process.cwd(), ".next");
const BUILD_MANIFEST_PATH = join(NEXT_BUILD_DIR, "build-manifest.json");

function getFileSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(1);
}

describe("Bundle Audit", () => {
  let manifest;
  let buildExists = false;

  beforeAll(() => {
    try {
      const raw = readFileSync(BUILD_MANIFEST_PATH, "utf-8");
      manifest = JSON.parse(raw);
      buildExists = true;
    } catch {
      buildExists = false;
    }
  });

  it("Next.js build output exists", () => {
    expect(buildExists).toBe(true);
  });

  it("build-manifest.json has pages defined", () => {
    expect(manifest?.pages).toBeDefined();
    expect(typeof manifest.pages).toBe("object");
  });

  it("reports per-route first-load JS sizes (deduplicated shared chunks)", () => {
    const pages = manifest.pages;
    const routes = Object.keys(pages).filter(
      (r) => !r.startsWith("/_") && !r.startsWith("/api/")
    );

    // Build a map of chunk sizes
    const chunkSizes = new Map();
    for (const route of routes) {
      for (const file of pages[route]) {
        if (file.endsWith(".js") && !chunkSizes.has(file)) {
          chunkSizes.set(file, getFileSize(join(NEXT_BUILD_DIR, file)));
        }
      }
    }

    // Calculate shared chunks (appearing in 3+ routes)
    const chunkRouteCount = new Map();
    for (const route of routes) {
      for (const file of pages[route]) {
        if (file.endsWith(".js")) {
          chunkRouteCount.set(file, (chunkRouteCount.get(file) || 0) + 1);
        }
      }
    }

    const sharedChunks = new Set();
    const routeOnlyChunks = new Set();
    for (const [file, count] of chunkRouteCount) {
      if (count >= 3) {
        sharedChunks.add(file);
      } else {
        routeOnlyChunks.add(file);
      }
    }

    let sharedTotalSize = 0;
    for (const file of sharedChunks) {
      sharedTotalSize += chunkSizes.get(file) || 0;
    }

    console.log(`\n📊 Bundle Audit Report`);
    console.log(`   ──────────────────────────────────────────`);
    console.log(`   Shared chunks: ${sharedChunks.size} (${formatKB(sharedTotalSize)}KB)`);
    console.log(`   Route-specific chunks: ${routeOnlyChunks.size}`);
    console.log(`   ──────────────────────────────────────────`);

    const routeSizes = [];
    for (const route of routes) {
      const files = pages[route];
      let routeOnlySize = 0;
      for (const file of files) {
        if (file.endsWith(".js") && !sharedChunks.has(file)) {
          routeOnlySize += chunkSizes.get(file) || 0;
        }
      }
      const firstLoadKB = formatKB(sharedTotalSize + routeOnlySize);
      routeSizes.push({ route, firstLoadKB: parseFloat(firstLoadKB), routeOnlyKB: parseFloat(formatKB(routeOnlySize)) });
      console.log(`   📦 ${route.padEnd(30)} ${firstLoadKB}KB (route-only: ${formatKB(routeOnlySize)}KB)`);
    }

    console.log(`   ──────────────────────────────────────────`);
    console.log(`   Total unique JS chunks: ${chunkSizes.size}`);
    console.log(`   Total JS size: ${formatKB(Array.from(chunkSizes.values()).reduce((a, b) => a + b, 0))}KB`);

    // Report only — no arbitrary threshold assertions
    expect(routeSizes.length).toBeGreaterThan(0);
    expect(sharedTotalSize).toBeGreaterThan(0);
  });

  it("identifies largest shared chunks (optimization candidates)", () => {
    const pages = manifest.pages;
    const routes = Object.keys(pages).filter(
      (r) => !r.startsWith("/_") && !r.startsWith("/api/")
    );

    const chunkRouteCount = new Map();
    const chunkSizes = new Map();

    for (const route of routes) {
      for (const file of pages[route]) {
        if (file.endsWith(".js")) {
          chunkRouteCount.set(file, (chunkRouteCount.get(file) || 0) + 1);
          if (!chunkSizes.has(file)) {
            chunkSizes.set(file, getFileSize(join(NEXT_BUILD_DIR, file)));
          }
        }
      }
    }

    // Sort shared chunks by size (largest first)
    const sharedChunks = Array.from(chunkRouteCount.entries())
      .filter(([_, count]) => count >= 3)
      .map(([file, count]) => ({
        file: file.split("/").pop(),
        sizeKB: parseFloat(formatKB(chunkSizes.get(file) || 0)),
        routeCount: count,
      }))
      .sort((a, b) => b.sizeKB - a.sizeKB);

    console.log(`\n📊 Largest Shared Chunks (optimization candidates):`);
    for (const chunk of sharedChunks.slice(0, 10)) {
      console.log(`   ${chunk.file.padEnd(40)} ${chunk.sizeKB}KB (in ${chunk.routeCount} routes)`);
    }

    expect(sharedChunks.length).toBeGreaterThan(0);
  });

  it("reports total unique chunk count and size", () => {
    const pages = manifest.pages;
    const allChunks = new Map();

    for (const route of Object.keys(pages)) {
      for (const file of pages[route]) {
        if (file.endsWith(".js") && !allChunks.has(file)) {
          allChunks.set(file, getFileSize(join(NEXT_BUILD_DIR, file)));
        }
      }
    }

    let totalSize = 0;
    for (const size of allChunks.values()) {
      totalSize += size;
    }

    console.log(`\n📊 Total Unique JS Chunks: ${allChunks.size}`);
    console.log(`📊 Total JS Size: ${formatKB(totalSize)}KB`);

    expect(allChunks.size).toBeGreaterThan(0);
  });
});
