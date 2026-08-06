// Secrets Manager — Unit Tests
import { describe, it, expect, vi, beforeEach } from "vitest";

// Shared chain object supporting all query patterns
const selectChain = {
  eq: vi.fn(() => ({
    single: vi.fn(() =>
      Promise.resolve({
        data: { value: "db-secret-value", encrypted: false },
        error: null,
      }),
    ),
  })),
  order: vi.fn(() =>
    Promise.resolve({
      data: [
        {
          key: "test-key",
          name: "Test Key",
          provider: "database",
          last_rotated_at: null,
          expires_at: null,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    }),
  ),
  lte: vi.fn(() => ({
    gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
  })),
};

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => selectChain),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  secureLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../../lib/verification/auditLog.js", () => ({
  logAuditEvent: vi.fn(() => Promise.resolve({ success: true })),
}));

const {
  getSecret,
  setSecret,
  deleteSecret,
  listSecrets,
  rotateSecret,
  checkExpiringSecrets,
  validateCredentials,
  generateSecurityAudit,
} = await import("../../../lib/secrets/secretsManager.js");

describe("Secrets Manager", () => {
  describe("getSecret", () => {
    it("should get env secrets", async () => {
      process.env.TEST_SECRET = "env-value";
      const result = await getSecret("TEST_SECRET");
      expect(result).toBe("env-value");
    });

    it("should return null for missing env secrets", async () => {
      const result = await getSecret("NONEXISTENT_SECRET");
      expect(result).toBeNull();
    });

    it("should get database secrets", async () => {
      const result = await getSecret("test-key", { provider: "database" });
      expect(result).toBe("db-secret-value");
    });
  });

  describe("setSecret", () => {
    it("should set env secrets", async () => {
      const result = await setSecret("MY_SECRET", "my-value");
      expect(result.success).toBe(true);
      expect(process.env.MY_SECRET).toBe("my-value");
    });
  });

  describe("deleteSecret", () => {
    it("should delete database secrets", async () => {
      const result = await deleteSecret("test-key");
      expect(result.success).toBe(true);
    });
  });

  describe("listSecrets", () => {
    it("should list all secrets", async () => {
      const result = await listSecrets();
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.data[0].key).toBe("test-key");
    });
  });

  describe("rotateSecret", () => {
    it("should rotate a secret", async () => {
      const generateFn = vi.fn().mockResolvedValue("new-rotated-value");
      const result = await rotateSecret("rotatable-key", generateFn, {
        provider: "database",
        createdBy: "admin-user",
      });
      expect(result.success).toBe(true);
      expect(generateFn).toHaveBeenCalled();
    });
  });

  describe("checkExpiringSecrets", () => {
    it("should return empty when no secrets expiring", async () => {
      const result = await checkExpiringSecrets(7);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("validateCredentials", () => {
    it("should validate supabase credentials", async () => {
      const result = await validateCredentials("supabase", {
        url: "https://test.supabase.co",
        serviceKey: "test-key",
      });
      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(true);
    });

    it("should reject incomplete supabase credentials", async () => {
      const result = await validateCredentials("supabase", {
        url: "https://test.supabase.co",
      });
      expect(result.success).toBe(false);
    });

    it("should validate openai credentials", async () => {
      const result = await validateCredentials("openai", {
        apiKey: "sk-test12345678",
      });
      expect(result.success).toBe(true);
      expect(result.data.keyPrefix).toBe("sk-test1...");
    });

    it("should handle unknown provider", async () => {
      const result = await validateCredentials("custom", { apiKey: "x" });
      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(true);
    });
  });

  describe("generateSecurityAudit", () => {
    it("should generate an audit report", async () => {
      process.env.SUPABASE_URL = "https://test.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
      process.env.NEXTAUTH_SECRET = "nextauth-secret";
      process.env.ENCRYPTION_KEY = "encryption-key";

      const result = await generateSecurityAudit();
      expect(result.success).toBe(true);
      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.totalChecks).toBeGreaterThanOrEqual(4);
      expect(result.data.checks).toBeDefined();
    });
  });
});
