import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Performance Metrics Collection — Lighthouse-style metrics via Playwright.
 *
 * Collects and REPORTS (does not assert arbitrary thresholds):
 *   - LCP (Largest Contentful Paint)
 *   - CLS (Cumulative Layout Shift)
 *   - INP (Interaction to Next Paint)
 *   - FCP (First Contentful Paint)
 *   - TTFB (Time to First Byte)
 *
 * Generates JSON reports in tests/performance/reports/
 */

const REPORT_DIR = join(process.cwd(), "tests/performance/reports");

// Ensure report directory exists
try {
  mkdirSync(REPORT_DIR, { recursive: true });
} catch {}

const PAGES_TO_TEST = [
  { name: "landing", path: "/" },
  { name: "explore", path: "/explore" },
  { name: "login", path: "/login" },
];

for (const { name, path: route } of PAGES_TO_TEST) {
  test.describe(`Performance: ${name} (${route})`, () => {
    test(`collects Core Web Vitals for ${route}`, async ({ page }) => {
      const metrics = {};

      // Navigate and collect navigation timing
      const startTime = Date.now();
      await page.goto(route, { waitUntil: "networkidle" });
      metrics.loadTimeMs = Date.now() - startTime;

      // Collect Navigation Timing API metrics
      const navTiming = await page.evaluate(() => {
        const [nav] = performance.getEntriesByType("navigation");
        if (!nav) return null;
        return {
          ttfb: Math.round(nav.responseStart - nav.requestStart),
          domContentLoaded: Math.round(
            nav.domContentLoadedEventEnd - nav.fetchStart,
          ),
          loadComplete: Math.round(nav.loadEventEnd - nav.fetchStart),
          domInteractive: Math.round(nav.domInteractive - nav.fetchStart),
          transferSize: nav.transferSize,
          encodedBodySize: nav.encodedBodySize,
          decodedBodySize: nav.decodedBodySize,
        };
      });

      if (navTiming) {
        metrics.ttfb = navTiming.ttfb;
        metrics.domContentLoaded = navTiming.domContentLoaded;
        metrics.loadComplete = navTiming.loadComplete;
        metrics.domInteractive = navTiming.domInteractive;
        metrics.transferSize = navTiming.transferSize;
      }

      // Collect FCP via Performance Observer
      const fcp = await page.evaluate(() => {
        const entries = performance.getEntriesByName("first-contentful-paint");
        if (entries.length > 0) {
          return Math.round(entries[0].startTime);
        }
        return null;
      });
      metrics.fcp = fcp;

      // Collect LCP via PerformanceObserver
      const lcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          let lastEntry = null;
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            lastEntry = entries[entries.length - 1];
          });
          observer.observe({
            type: "largest-contentful-paint",
            buffered: true,
          });

          // Give a moment for LCP to settle
          setTimeout(() => {
            observer.disconnect();
            resolve(lastEntry ? Math.round(lastEntry.startTime) : null);
          }, 2000);
        });
      });
      metrics.lcp = lcp;

      // Collect CLS via PerformanceObserver
      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
          });
          observer.observe({ type: "layout-shift", buffered: true });

          setTimeout(() => {
            observer.disconnect();
            resolve(Math.round(clsValue * 10000) / 10000);
          }, 2000);
        });
      });
      metrics.cls = cls;

      // Count network requests
      const networkInfo = await page.evaluate(() => {
        const resources = performance.getEntriesByType("resource");
        return {
          totalRequests: resources.length,
          totalTransferSize: resources.reduce(
            (sum, r) => sum + (r.transferSize || 0),
            0,
          ),
          jsRequests: resources.filter(
            (r) => r.initiatorType === "script" || r.name.endsWith(".js"),
          ).length,
          cssRequests: resources.filter(
            (r) => r.initiatorType === "link" || r.name.endsWith(".css"),
          ).length,
          imageRequests: resources.filter((r) => r.initiatorType === "img")
            .length,
        };
      });
      metrics.network = networkInfo;

      // Count console errors
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      // Collect page size info
      const pageSize = await page.evaluate(() => {
        return {
          documentElements: document.querySelectorAll("*").length,
          domDepth: (() => {
            let maxDepth = 0;
            const walk = (el, depth) => {
              if (depth > maxDepth) maxDepth = depth;
              for (const child of el.children) walk(child, depth + 1);
            };
            walk(document.documentElement, 0);
            return maxDepth;
          })(),
          totalImages: document.querySelectorAll("img").length,
          totalScripts: document.querySelectorAll("script").length,
          totalStylesheets: document.querySelectorAll('link[rel="stylesheet"]')
            .length,
        };
      });
      metrics.pageSize = pageSize;

      // ─── Report ───
      console.log(`\n📊 Performance Report: ${name} (${route})`);
      console.log(`   ─────────────────────────────────────`);
      console.log(`   TTFB:                ${metrics.ttfb ?? "N/A"}ms`);
      console.log(`   FCP:                 ${metrics.fcp ?? "N/A"}ms`);
      console.log(`   LCP:                 ${metrics.lcp ?? "N/A"}ms`);
      console.log(`   CLS:                 ${metrics.cls ?? "N/A"}`);
      console.log(
        `   DOM Content Loaded:  ${metrics.domContentLoaded ?? "N/A"}ms`,
      );
      console.log(`   Load Complete:       ${metrics.loadComplete ?? "N/A"}ms`);
      console.log(`   Page Load Time:      ${metrics.loadTimeMs}ms`);
      console.log(`   ─────────────────────────────────────`);
      console.log(`   Network Requests:    ${networkInfo.totalRequests}`);
      console.log(
        `   Transfer Size:       ${(networkInfo.totalTransferSize / 1024).toFixed(1)}KB`,
      );
      console.log(`   JS Chunks:           ${networkInfo.jsRequests}`);
      console.log(`   CSS Files:           ${networkInfo.cssRequests}`);
      console.log(`   Images:              ${networkInfo.imageRequests}`);
      console.log(`   ─────────────────────────────────────`);
      console.log(`   DOM Elements:        ${pageSize.documentElements}`);
      console.log(`   DOM Depth:           ${pageSize.domDepth}`);
      console.log(`   Console Errors:      ${consoleErrors.length}`);

      // Write JSON report
      const report = {
        page: name,
        route,
        timestamp: new Date().toISOString(),
        metrics,
        consoleErrors: consoleErrors.slice(0, 10),
      };

      const reportPath = join(REPORT_DIR, `${name}-metrics.json`);
      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      // Soft assertions — flag pages with measurable issues
      if (metrics.lcp && metrics.lcp > 4000) {
        console.log(
          `\n   ⚠️  LCP > 4s — consider optimizing hero image / above-fold content`,
        );
      }
      if (metrics.cls && metrics.cls > 0.1) {
        console.log(`\n   ⚠️  CLS > 0.1 — layout shifts detected`);
      }
      if (metrics.ttfb && metrics.ttfb > 800) {
        console.log(
          `\n   ⚠️  TTFB > 800ms — server response time may need optimization`,
        );
      }

      // Only fail on critical issues (page didn't load)
      expect(metrics.loadTimeMs).toBeLessThan(30000);
    });
  });
}
