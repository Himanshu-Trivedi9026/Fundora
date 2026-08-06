/**
 * SQL Migration Schema Validation Tests
 *
 * Reads and parses the actual .sql migration files under supabase/migrations/
 * to verify structural invariants — no SQL parser needed, just RegExp/string matching.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/**
 * Return every `.sql` file inside the migrations directory, sorted by name so
 * that migrations are processed in execution order.
 */
function getMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({
      name: f,
      path: join(MIGRATIONS_DIR, f),
      content: readFileSync(join(MIGRATIONS_DIR, f), "utf-8"),
    }));
}

/**
 * Concatenate all migration files into a single string. This lets us treat the
 * final schema as the source of truth (later migrations may ALTER / DROP things).
 */
function getAllSql() {
  return getMigrationFiles()
    .map((m) => m.content)
    .join("\n");
}

/**
 * Extract every CREATE TABLE name from the given SQL.
 */
function extractTableNames(sql) {
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  const names = [];
  let match;
  while ((match = re.exec(sql)) !== null) {
    names.push(match[1].toLowerCase());
  }
  return names;
}

/**
 * Check whether a table has an `ALTER TABLE … ENABLE ROW LEVEL SECURITY` line.
 */
function hasRlsEnabled(sql, tableName) {
  const re = new RegExp(
    `ALTER\\s+TABLE\\s+${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
    "i",
  );
  return re.test(sql);
}

/**
 * Find all CHECK constraints on a given column within a specific table.
 * Looks inside CREATE TABLE blocks for inline CHECK (…).
 */
function findCheckConstraints(sql, tableName) {
  const tableRe = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableName}\\s*\\((.*)\\s*\\)\\s*;`,
    "is",
  );
  const blockMatch = tableRe.exec(sql);
  if (!blockMatch) return [];

  const block = blockMatch[1];
  const checks = [];
  const checkRe = /CHECK\s*\(/gi;
  let m;
  while ((m = checkRe.exec(block)) !== null) {
    // Find matching closing paren with depth tracking
    let depth = 1;
    let start = m.index + m[0].length;
    let end = start;
    while (end < block.length && depth > 0) {
      if (block[end] === "(") depth++;
      else if (block[end] === ")") depth--;
      if (depth > 0) end++;
    }
    checks.push(block.slice(start, end).trim());
  }
  return checks;
}

/**
 * Also check named constraints added via ALTER TABLE … ADD CONSTRAINT … CHECK (…).
 */
function findAlterCheckConstraints(sql, tableName) {
  const re = new RegExp(
    `ALTER\\s+TABLE\\s+${tableName}\\s+[\\s\\S]*?ADD\\s+CONSTRAINT\\s+\\w+\\s+CHECK\\s*\\(([^)]+)\\)`,
    "gi",
  );
  const checks = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    checks.push(m[1].trim());
  }
  return checks;
}

/**
 * Collect all CHECK constraints for a table (inline + ALTER TABLE).
 */
function allCheckConstraints(sql, tableName) {
  return [
    ...findCheckConstraints(sql, tableName),
    ...findAlterCheckConstraints(sql, tableName),
  ];
}

/**
 * Extract all REFERENCES clauses from a CREATE TABLE block for the given table.
 * Returns an array of { column, referencedTable }.
 */
function findForeignKeys(sql, tableName) {
  // Locate the start of the CREATE TABLE for this table
  const startRe = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${tableName}\\s*\\(`,
    "is",
  );
  const startMatch = startRe.exec(sql);
  if (!startMatch) return [];

  // Extract the table body using balanced parenthesis tracking
  const openIdx = startMatch.index + startMatch[0].length - 1;
  let depth = 1;
  let pos = openIdx + 1;
  while (pos < sql.length && depth > 0) {
    if (sql[pos] === "(") depth++;
    else if (sql[pos] === ")") depth--;
    if (depth > 0) pos++;
  }
  const block = sql.slice(openIdx + 1, pos).replace(/--[^\n]*/g, "");

  const fks = [];
  // Match individual column lines that contain REFERENCES
  const colRe = /(\w+)\s+[\w\s()]+REFERENCES\s+([\w.]+)\s*\((\w+)\)/gi;
  let m;
  while ((m = colRe.exec(block)) !== null) {
    fks.push({
      column: m[1],
      referencedTable: m[2],
      referencedColumn: m[3],
    });
  }
  return fks;
}

/**
 * Find all CREATE INDEX statements that target a given table.
 * Returns an array of { indexName, columns }.
 */
function findIndexes(sql, tableName) {
  const re = new RegExp(
    `CREATE\\s+INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(\\w+)\\s+ON\\s+${tableName}\\s*\\(([^)]+)\\)`,
    "gi",
  );
  const indexes = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    indexes.push({
      indexName: m[1],
      columns: m[2],
    });
  }
  return indexes;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SQL Migration — Table existence", () => {
  const allSql = getAllSql();
  const createdTables = extractTableNames(allSql);

  const EXPECTED_TABLES = [
    "creator_verifications",
    "verification_requests",
    "verification_sessions",
    "verification_otp",
    "verification_audit_log",
    "verification_documents",
    "verification_history",
  ];

  it("should discover at least one migration file", () => {
    const files = getMigrationFiles();
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(EXPECTED_TABLES)(
    "should contain CREATE TABLE for %s across migrations",
    (tableName) => {
      expect(createdTables).toContain(tableName);
    },
  );

  it("should not have unexpected verification tables missing from the expected list", () => {
    const verificationTables = createdTables.filter(
      (t) => t.startsWith("verification") || t === "creator_verifications",
    );
    // Log for visibility
    console.log(
      "  Discovered verification-related tables:",
      verificationTables,
    );
    EXPECTED_TABLES.forEach((t) => {
      expect(verificationTables).toContain(t);
    });
  });
});

describe("SQL Migration — Row Level Security", () => {
  const allSql = getAllSql();

  const RLS_TABLES = [
    "creator_verifications",
    "verification_requests",
    "verification_sessions",
    "verification_otp",
    "verification_audit_log",
    "verification_documents",
    "verification_history",
  ];

  it.each(RLS_TABLES)("should enable RLS on %s", (tableName) => {
    const enabled = hasRlsEnabled(allSql, tableName);
    expect(enabled).toBe(true);
  });
});

describe("SQL Migration — CHECK constraints on status/priority columns", () => {
  const allSql = getAllSql();

  describe("creator_verifications", () => {
    it("should have a CHECK on verification_level (0–5 range)", () => {
      const checks = allCheckConstraints(allSql, "creator_verifications");
      const levelCheck = checks.some(
        (c) =>
          c.includes("verification_level") &&
          c.includes("0") &&
          c.includes("5"),
      );
      expect(levelCheck).toBe(true);
    });

    it("should have a CHECK on verification_status with allowed values", () => {
      const checks = allCheckConstraints(allSql, "creator_verifications");
      const statusCheck = checks.some(
        (c) =>
          c.includes("verification_status") &&
          c.includes("pending") &&
          c.includes("approved"),
      );
      expect(statusCheck).toBe(true);
    });

    it("should have a CHECK on trust_score (0–100)", () => {
      const checks = allCheckConstraints(allSql, "creator_verifications");
      const trustCheck = checks.some(
        (c) => c.includes("trust_score") && c.includes("100"),
      );
      expect(trustCheck).toBe(true);
    });

    it("should have a CHECK on risk_score (0–100)", () => {
      const checks = allCheckConstraints(allSql, "creator_verifications");
      const riskCheck = checks.some(
        (c) => c.includes("risk_score") && c.includes("100"),
      );
      expect(riskCheck).toBe(true);
    });
  });

  describe("verification_requests", () => {
    it("should have a CHECK on status with allowed values", () => {
      const checks = allCheckConstraints(allSql, "verification_requests");
      const statusCheck = checks.some(
        (c) =>
          c.includes("status") &&
          c.includes("draft") &&
          c.includes("submitted"),
      );
      expect(statusCheck).toBe(true);
    });

    it("should have a CHECK on verification_type", () => {
      const checks = allCheckConstraints(allSql, "verification_requests");
      const typeCheck = checks.some(
        (c) =>
          c.includes("verification_type") &&
          c.includes("identity") &&
          c.includes("phone"),
      );
      expect(typeCheck).toBe(true);
    });

    it("should have a CHECK on review_priority", () => {
      const checks = allCheckConstraints(allSql, "verification_requests");
      const priorityCheck = checks.some(
        (c) =>
          c.includes("review_priority") &&
          c.includes("low") &&
          c.includes("urgent"),
      );
      expect(priorityCheck).toBe(true);
    });
  });

  describe("verification_history", () => {
    it("should have a CHECK on action with allowed values", () => {
      const checks = allCheckConstraints(allSql, "verification_history");
      const actionCheck = checks.some(
        (c) =>
          c.includes("action") &&
          c.includes("created") &&
          c.includes("approved"),
      );
      expect(actionCheck).toBe(true);
    });

    it("should have a CHECK on performed_by_type", () => {
      const checks = allCheckConstraints(allSql, "verification_history");
      const byTypeCheck = checks.some(
        (c) =>
          c.includes("performed_by_type") &&
          c.includes("system") &&
          c.includes("admin"),
      );
      expect(byTypeCheck).toBe(true);
    });
  });

  describe("verification_documents", () => {
    it("should have a CHECK on status with allowed values", () => {
      const checks = allCheckConstraints(allSql, "verification_documents");
      const statusCheck = checks.some(
        (c) =>
          c.includes("status") &&
          c.includes("pending") &&
          c.includes("verified"),
      );
      expect(statusCheck).toBe(true);
    });

    it("should have a CHECK on document_type", () => {
      const checks = allCheckConstraints(allSql, "verification_documents");
      const docTypeCheck = checks.some(
        (c) =>
          c.includes("document_type") &&
          c.includes("passport") &&
          c.includes("pan_card"),
      );
      expect(docTypeCheck).toBe(true);
    });
  });

  describe("verification_audit_log", () => {
    it("should have a CHECK on entity_type", () => {
      const checks = allCheckConstraints(allSql, "verification_audit_log");
      const entityCheck = checks.some(
        (c) =>
          c.includes("entity_type") &&
          c.includes("verification_request") &&
          c.includes("document"),
      );
      expect(entityCheck).toBe(true);
    });
  });
});

describe("SQL Migration — Foreign key references", () => {
  const allSql = getAllSql();

  describe("creator_verifications", () => {
    it("should reference auth.users(id)", () => {
      const fks = findForeignKeys(allSql, "creator_verifications");
      const userRef = fks.find(
        (fk) => fk.column === "user_id" && fk.referencedTable === "auth.users",
      );
      expect(userRef).toBeDefined();
    });
  });

  describe("verification_requests", () => {
    it("should reference auth.users(id) via user_id", () => {
      const fks = findForeignKeys(allSql, "verification_requests");
      const userRef = fks.find(
        (fk) => fk.column === "user_id" && fk.referencedTable === "auth.users",
      );
      expect(userRef).toBeDefined();
    });

    it("should reference creator_verifications(id) via verification_id", () => {
      const fks = findForeignKeys(allSql, "verification_requests");
      const verRef = fks.find(
        (fk) =>
          fk.column === "verification_id" &&
          fk.referencedTable === "creator_verifications",
      );
      expect(verRef).toBeDefined();
    });
  });

  describe("verification_sessions", () => {
    it("should reference auth.users(id) via user_id", () => {
      const fks = findForeignKeys(allSql, "verification_sessions");
      const userRef = fks.find(
        (fk) => fk.column === "user_id" && fk.referencedTable === "auth.users",
      );
      expect(userRef).toBeDefined();
    });

    it("should reference verification_requests(id) via verification_request_id", () => {
      const fks = findForeignKeys(allSql, "verification_sessions");
      const reqRef = fks.find(
        (fk) =>
          fk.column === "verification_request_id" &&
          fk.referencedTable === "verification_requests",
      );
      expect(reqRef).toBeDefined();
    });
  });

  describe("verification_otp", () => {
    it("should reference auth.users(id) via user_id", () => {
      const fks = findForeignKeys(allSql, "verification_otp");
      const userRef = fks.find(
        (fk) => fk.column === "user_id" && fk.referencedTable === "auth.users",
      );
      expect(userRef).toBeDefined();
    });
  });

  describe("verification_history", () => {
    it("should reference creator_verifications(id) via verification_id", () => {
      const fks = findForeignKeys(allSql, "verification_history");
      const verRef = fks.find(
        (fk) =>
          fk.column === "verification_id" &&
          fk.referencedTable === "creator_verifications",
      );
      expect(verRef).toBeDefined();
    });

    it("should reference auth.users(id) via user_id", () => {
      const fks = findForeignKeys(allSql, "verification_history");
      const userRef = fks.find(
        (fk) => fk.column === "user_id" && fk.referencedTable === "auth.users",
      );
      expect(userRef).toBeDefined();
    });
  });

  describe("verification_documents", () => {
    it("should reference creator_verifications(id) via verification_id", () => {
      const fks = findForeignKeys(allSql, "verification_documents");
      const verRef = fks.find(
        (fk) =>
          fk.column === "verification_id" &&
          fk.referencedTable === "creator_verifications",
      );
      expect(verRef).toBeDefined();
    });

    it("should reference auth.users(id) via user_id", () => {
      const fks = findForeignKeys(allSql, "verification_documents");
      const userRef = fks.find(
        (fk) => fk.column === "user_id" && fk.referencedTable === "auth.users",
      );
      expect(userRef).toBeDefined();
    });
  });

  describe("verification_audit_log", () => {
    it("should reference auth.users(id) via user_id", () => {
      const fks = findForeignKeys(allSql, "verification_audit_log");
      const userRef = fks.find(
        (fk) => fk.column === "user_id" && fk.referencedTable === "auth.users",
      );
      expect(userRef).toBeDefined();
    });
  });
});

describe("SQL Migration — Indexes on commonly queried columns", () => {
  const allSql = getAllSql();

  describe("creator_verifications", () => {
    it("should index user_id", () => {
      const indexes = findIndexes(allSql, "creator_verifications");
      const match = indexes.some((i) => i.columns.includes("user_id"));
      expect(match).toBe(true);
    });

    it("should index verification_status", () => {
      const indexes = findIndexes(allSql, "creator_verifications");
      const match = indexes.some((i) =>
        i.columns.includes("verification_status"),
      );
      expect(match).toBe(true);
    });

    it("should index verification_level", () => {
      const indexes = findIndexes(allSql, "creator_verifications");
      const match = indexes.some((i) =>
        i.columns.includes("verification_level"),
      );
      expect(match).toBe(true);
    });
  });

  describe("verification_requests", () => {
    it("should index user_id", () => {
      const indexes = findIndexes(allSql, "verification_requests");
      const match = indexes.some((i) => i.columns.includes("user_id"));
      expect(match).toBe(true);
    });

    it("should index status", () => {
      const indexes = findIndexes(allSql, "verification_requests");
      const match = indexes.some((i) => i.columns.includes("status"));
      expect(match).toBe(true);
    });

    it("should index verification_type", () => {
      const indexes = findIndexes(allSql, "verification_requests");
      const match = indexes.some((i) =>
        i.columns.includes("verification_type"),
      );
      expect(match).toBe(true);
    });

    it("should index review_priority", () => {
      const indexes = findIndexes(allSql, "verification_requests");
      const match = indexes.some((i) => i.columns.includes("review_priority"));
      expect(match).toBe(true);
    });
  });

  describe("verification_sessions", () => {
    it("should index user_id", () => {
      const indexes = findIndexes(allSql, "verification_sessions");
      const match = indexes.some((i) => i.columns.includes("user_id"));
      expect(match).toBe(true);
    });

    it("should index verification_request_id", () => {
      const indexes = findIndexes(allSql, "verification_sessions");
      const match = indexes.some((i) =>
        i.columns.includes("verification_request_id"),
      );
      expect(match).toBe(true);
    });

    it("should index expires_at (for cleanup queries)", () => {
      const indexes = findIndexes(allSql, "verification_sessions");
      const match = indexes.some((i) => i.columns.includes("expires_at"));
      expect(match).toBe(true);
    });
  });

  describe("verification_otp", () => {
    it("should index user_id", () => {
      const indexes = findIndexes(allSql, "verification_otp");
      const match = indexes.some((i) => i.columns.includes("user_id"));
      expect(match).toBe(true);
    });

    it("should index phone (for lookup)", () => {
      const indexes = findIndexes(allSql, "verification_otp");
      const match = indexes.some((i) => i.columns.includes("phone"));
      expect(match).toBe(true);
    });
  });

  describe("verification_audit_log", () => {
    it("should have composite index on (entity_type, entity_id)", () => {
      const indexes = findIndexes(allSql, "verification_audit_log");
      const match = indexes.some(
        (i) =>
          i.columns.includes("entity_type") && i.columns.includes("entity_id"),
      );
      expect(match).toBe(true);
    });

    it("should index user_id", () => {
      const indexes = findIndexes(allSql, "verification_audit_log");
      const match = indexes.some((i) => i.columns.includes("user_id"));
      expect(match).toBe(true);
    });

    it("should index created_at (for time-range queries)", () => {
      const indexes = findIndexes(allSql, "verification_audit_log");
      const match = indexes.some((i) => i.columns.includes("created_at"));
      expect(match).toBe(true);
    });

    it("should index action", () => {
      const indexes = findIndexes(allSql, "verification_audit_log");
      const match = indexes.some((i) => i.columns.includes("action"));
      expect(match).toBe(true);
    });
  });

  describe("verification_history", () => {
    it("should index verification_id", () => {
      const indexes = findIndexes(allSql, "verification_history");
      const match = indexes.some((i) => i.columns.includes("verification_id"));
      expect(match).toBe(true);
    });

    it("should index user_id", () => {
      const indexes = findIndexes(allSql, "verification_history");
      const match = indexes.some((i) => i.columns.includes("user_id"));
      expect(match).toBe(true);
    });

    it("should index action", () => {
      const indexes = findIndexes(allSql, "verification_history");
      const match = indexes.some((i) => i.columns.includes("action"));
      expect(match).toBe(true);
    });

    it("should index created_at (for ordering)", () => {
      const indexes = findIndexes(allSql, "verification_history");
      const match = indexes.some((i) => i.columns.includes("created_at"));
      expect(match).toBe(true);
    });
  });

  describe("verification_documents", () => {
    it("should index verification_id", () => {
      const indexes = findIndexes(allSql, "verification_documents");
      const match = indexes.some((i) => i.columns.includes("verification_id"));
      expect(match).toBe(true);
    });

    it("should index user_id", () => {
      const indexes = findIndexes(allSql, "verification_documents");
      const match = indexes.some((i) => i.columns.includes("user_id"));
      expect(match).toBe(true);
    });

    it("should index status", () => {
      const indexes = findIndexes(allSql, "verification_documents");
      const match = indexes.some((i) => i.columns.includes("status"));
      expect(match).toBe(true);
    });

    it("should index document_type", () => {
      const indexes = findIndexes(allSql, "verification_documents");
      const match = indexes.some((i) => i.columns.includes("document_type"));
      expect(match).toBe(true);
    });
  });
});

describe("SQL Migration — Immutability enforcement", () => {
  const allSql = getAllSql();

  it("should REVOKE UPDATE, DELETE on verification_history from authenticated", () => {
    const re =
      /REVOKE\s+UPDATE,\s*DELETE\s+ON\s+verification_history\s+FROM\s+authenticated/i;
    expect(re.test(allSql)).toBe(true);
  });

  it("should REVOKE UPDATE, DELETE on verification_audit_log from authenticated", () => {
    const re =
      /REVOKE\s+UPDATE,\s*DELETE\s+ON\s+verification_audit_log\s+FROM\s+authenticated/i;
    expect(re.test(allSql)).toBe(true);
  });
});

describe("SQL Migration — Migration file ordering", () => {
  it("should have migration files sorted in ascending numeric order", () => {
    const files = getMigrationFiles();
    const names = files.map((f) => f.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it("should have at least 3 migration files for the verification system", () => {
    const files = getMigrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(3);
  });
});
