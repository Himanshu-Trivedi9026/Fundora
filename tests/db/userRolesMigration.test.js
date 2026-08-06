/**
 * SQL Migration 016 — platform role system invariants.
 *
 * Reads supabase/migrations/016_user_roles.sql and verifies the structural
 * guarantees the app relies on (single source of truth = profiles.role,
 * trigger-based role protection, admin-only elevation helper).
 */
import { readFileSync } from "fs";
import { join } from "path";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase", "migrations", "016_user_roles.sql"),
  "utf-8",
);

describe("016_user_roles.sql", () => {
  it("adds a NOT NULL role column to profiles with a donor default", () => {
    expect(MIGRATION).toMatch(
      /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+role\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'donor'/i,
    );
  });

  it("constrains role to the three platform values", () => {
    expect(MIGRATION).toMatch(
      /CHECK\s*\(\s*role\s+IN\s*\(\s*'donor'\s*,\s*'creator'\s*,\s*'platform_admin'\s*\)\s*\)/i,
    );
  });

  it("backfills existing project owners to creator", () => {
    expect(MIGRATION).toMatch(/UPDATE\s+public\.profiles/i);
    expect(MIGRATION).toMatch(
      /EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.projects/i,
    );
    expect(MIGRATION).toMatch(/pr\.owner_id\s*=\s*p\.id/i);
  });

  it("auto-promotes a user to creator when they create their first project", () => {
    expect(MIGRATION).toMatch(
      /FUNCTION\s+public\.promote_user_to_creator\(\)/i,
    );
    expect(MIGRATION).toMatch(/AFTER\s+INSERT\s+ON\s+public\.projects/i);
    expect(MIGRATION).toMatch(
      /UPDATE\s+public\.profiles\s+SET\s+role\s*=\s*'creator'/i,
    );
  });

  it("blocks direct role changes by end users via a trigger", () => {
    expect(MIGRATION).toMatch(/FUNCTION\s+public\.protect_user_role\(\)/i);
    expect(MIGRATION).toMatch(
      /BEFORE\s+UPDATE\s+OF\s+role\s+ON\s+public\.profiles/i,
    );
    expect(MIGRATION).toMatch(/app\.allow_role_change/i);
    expect(MIGRATION).toMatch(/42501/i);
  });

  it("provides an admin-only SECURITY DEFINER elevation helper", () => {
    expect(MIGRATION).toMatch(/FUNCTION\s+public\.set_user_role\(/i);
    expect(MIGRATION).toMatch(/SECURITY\s+DEFINER/i);
    expect(MIGRATION).toMatch(/'platform_admin'/i);
  });

  it("does not expose the elevation helper to anonymous callers", () => {
    expect(MIGRATION).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.set_user_role/i,
    );
    expect(MIGRATION).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.set_user_role\(UUID,\s*TEXT\)\s+TO\s+authenticated/i,
    );
  });

  it("does NOT flip RLS to strict mode on profiles (must stay publicly readable)", () => {
    // Migration 016 intentionally leaves profiles RLS as-is (see section 6).
    expect(MIGRATION).not.toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });
});
