import fs from "fs";
import path from "path";

/**
 * Creator routing regression tests.
 *
 * Regression: visiting /creator/dashboard, /creator/projects, etc. rendered the
 * public Creator Profile (pages/creator/[id].js). Root cause: the static
 * creator pages were missing from the shipped tree, so Next.js Pages Router
 * fell through every /creator/<name> URL to the dynamic [id] route.
 *
 * These tests pin the correct routing contract:
 *   1. Every expected static /creator route has a real page file on disk.
 *   2. Each page file exports the *correct* default component (a distinct
 *      component per route — not the shared CreatorProfile).
 *   3. There is no catch-all ([...slug].js) inside pages/creator that could
 *      swallow static routes.
 *   4. next.config.mjs must not redirect/rewrite /creator/* URLs.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CREATOR_DIR = path.join(REPO_ROOT, "pages", "creator");

/**
 * Expected static routes → page file → default export function name.
 * NOTE: [id].js (CreatorProfile) is deliberately the ONLY dynamic route; it
 * must never serve a static path.
 */
const STATIC_CREATOR_ROUTES = {
  "/creator/dashboard": { file: "dashboard.js", component: "CreatorDashboard" },
  "/creator/projects": { file: "projects.js", component: "CreatorProjects" },
  "/creator/analytics": { file: "analytics.js", component: "CreatorAnalytics" },
  "/creator/verification": {
    file: "verification.js",
    component: "CreatorVerification",
  },
  "/creator/payouts": { file: "payouts.js", component: "CreatorPayouts" },
  "/creator/payments": { file: "payments.js", component: "CreatorPayments" },
  "/creator/ai-assistant": {
    file: "ai-assistant.js",
    component: "AIAssistant",
  },
  "/creator/earnings": {
    file: "earnings.js",
    component: "CreatorEarningsPage",
  },
};

/** Extract the default function component name from a page module. */
function defaultExportName(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const match = src.match(/export\s+default\s+function\s+([A-Za-z_$][\w$]*)/);
  return match ? match[1] : null;
}

describe("Creator routing system", () => {
  it("every expected static creator route has a dedicated page file", () => {
    for (const [route, { file }] of Object.entries(STATIC_CREATOR_ROUTES)) {
      const full = path.join(CREATOR_DIR, file);
      expect(fs.existsSync(full), `${route} → missing page file ${file}`).toBe(
        true,
      );
    }
  });

  it.each(Object.entries(STATIC_CREATOR_ROUTES))(
    "%s exports the correct dedicated component (%s)",
    (route, { file, component }) => {
      const full = path.join(CREATOR_DIR, file);
      // File exists (guarded by the test above) — read the export name.
      const name = defaultExportName(full);
      expect(name, `${route} default export`).toBe(component);
    },
  );

  it("no creator page exports the shared public-profile component name", () => {
    for (const { file } of Object.values(STATIC_CREATOR_ROUTES)) {
      const name = defaultExportName(path.join(CREATOR_DIR, file));
      expect(name).not.toBe("CreatorProfile");
    }
  });

  it("pages/creator has no catch-all route that could shadow static pages", () => {
    const entries = fs.readdirSync(CREATOR_DIR);
    const catchAlls = entries.filter((f) => /^\[\.\.\./.test(f));
    expect(catchAlls).toEqual([]);
  });

  it("the only dynamic creator route is [id].js (public profile)", () => {
    const entries = fs.readdirSync(CREATOR_DIR);
    const dynamics = entries.filter((f) => /^\[.*\]\.js$/.test(f));
    expect(dynamics).toEqual(["[id].js"]);
  });

  it("next.config.mjs has no redirects/rewrites hijacking /creator routes", () => {
    const nextConfig = path.join(REPO_ROOT, "next.config.mjs");
    if (!fs.existsSync(nextConfig)) return; // config absent → nothing to hijack
    const src = fs.readFileSync(nextConfig, "utf8");
    // A redirect()/rewrite() `source` mapping to /creator/* would shadow the
    // real pages. (Asset rewrites use non-/creator sources and are fine.)
    const creatorSources = src.match(
      /source\s*:\s*["'`]\/creator[^"'`]*["'`]/g,
    );
    expect(creatorSources || []).toEqual([]);
  });
});
