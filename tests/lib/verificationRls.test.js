import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for the Phase-D RLS hardening (migration 023).
 *
 * These are SQL migrations — Vitest cannot execute Postgres, so this suite
 * statically asserts the net effect of applying every migration in order:
 *   1. Migration 023 exists and drops every authenticated-role self-write
 *      policy that the audit identified (the Critical privilege-escalation:
 *      a signed-in user setting verification_status='approved' on their own
 *      creator_verifications row, marking their own documents 'verified',
 *      or tampering with their verification_requests / sessions).
 *   2. For each forbidden policy, its DROP in 023 comes AFTER every CREATE in
 *      the legacy migrations, and no migration after 023 re-creates it.
 *   3. The unused SECURITY DEFINER recalculate_verification_level() helper has
 *      EXECUTE revoked from PUBLIC/authenticated.
 */

const MIGRATIONS_DIR = join(
  __dirname,
  "..",
  "..",
  "supabase",
  "migrations"
);

// Policy names that grant a signed-in user a write (INSERT/UPDATE) on
// verification state. Each name is unique and tied to a single table.
const FORBIDDEN_WRITE_POLICIES = [
  "Users can insert own verification",
  "Users can update own verification",
  "Users can insert own documents",
  "Users can update own documents",
  "Users can insert own requests",
  "Users can update own requests",
  "Users can insert own sessions",
  "Users can update own sessions",
];

function allMigrationSql() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => ({
    file: f,
    sql: readFileSync(join(MIGRATIONS_DIR, f), "utf8"),
  }));
}

describe("Verification RLS hardening (migration 023)", () => {
  const migrations = allMigrationSql();

  it("migration 023 exists and drops every forbidden self-write policy", () => {
    const hardened = migrations.find(
      (m) => m.file === "023_verification_rls_harden.sql"
    );
    expect(hardened, "023_verification_rls_harden.sql must exist").toBeTruthy();

    for (const policy of FORBIDDEN_WRITE_POLICIES) {
      expect(
        hardened.sql.includes(`DROP POLICY IF EXISTS "${policy}"`),
        `${hardened.file} must contain DROP POLICY IF EXISTS "${policy}"`
      ).toBe(true);
    }
  });

  it("every forbidden policy is dropped by 023 and never re-created afterwards", () => {
    const byPolicy = (re) =>
      migrations
        .map((m) => ({ file: m.file, hit: m.sql.match(re) !== null }))
        .filter((m) => m.hit)
        .map((m) => m.file);

    for (const policy of FORBIDDEN_WRITE_POLICIES) {
      const createFiles = byPolicy(new RegExp(`CREATE POLICY "${policy}"`));
      const dropFiles = byPolicy(new RegExp(`DROP POLICY IF EXISTS "${policy}"`));

      // It must have been created in some legacy migration (the vulnerability),
      // and dropped by 023.
      expect(createFiles.length).toBeGreaterThan(0);
      expect(dropFiles).toContain("023_verification_rls_harden.sql");

      // Apply-order invariant: the last migration touching the policy must be
      // the DROP (create index < drop index), i.e. no later re-creation.
      const lastCreateIdx = Math.max(...createFiles.map((f) => migrations.findIndex((m) => m.file === f)));
      const lastDropIdx = Math.max(...dropFiles.map((f) => migrations.findIndex((m) => m.file === f)));
      expect(lastCreateIdx, `${policy}: CREATE must precede DROP`).toBeLessThan(lastDropIdx);
    }
  });

  it("migration 023 revokes EXECUTE on recalculate_verification_level from PUBLIC/authenticated", () => {
    const hardened = migrations.find(
      (m) => m.file === "023_verification_rls_harden.sql"
    );
    expect(hardened).toBeTruthy();
    expect(hardened.sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.recalculate_verification_level(UUID) FROM PUBLIC;"
    );
    expect(hardened.sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.recalculate_verification_level(UUID) FROM authenticated;"
    );
  });
});
