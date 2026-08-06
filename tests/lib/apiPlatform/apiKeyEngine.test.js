/**
 * API Key Engine Tests — Unit tests for API key management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/verification/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  createApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
  hashApiKey,
} from "../../../lib/apiPlatform/apiKeyEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("APIKeyEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createApiKey", () => {
    it("should create an API key and return plaintext", async () => {
      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "key-1", name: "Test Key", key_prefix: "abc12345" },
              error: null,
            }),
          }),
        }),
      });

      const result = await createApiKey({ userId: "user-1", name: "Test Key" });
      expect(result.success).toBe(true);
      expect(result.data.key).toBeDefined();
      expect(result.data.key.startsWith("fk_")).toBe(true);
    });

    it("should fail without required fields", async () => {
      const result = await createApiKey({ name: "Test" });
      expect(result.success).toBe(false);
    });
  });

  describe("validateApiKey", () => {
    it("should validate a valid key", async () => {
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "key-1", status: "active", expires_at: null },
                  error: null,
                }),
              }),
            }),
          }),
        })
        // Update last_used_at
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        });

      const hash = hashApiKey("fk_abc12345_test");
      const result = await validateApiKey(hash);
      expect(result.success).toBe(true);
    });

    it("should reject invalid key", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      const result = await validateApiKey("nonexistent_hash");
      expect(result.success).toBe(false);
    });

    it("should reject expired key", async () => {
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "key-1", status: "active", expires_at: "2020-01-01T00:00:00Z" },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await validateApiKey("some_hash");
      expect(result.success).toBe(false);
      expect(result.error).toContain("expired");
    });
  });

  describe("revokeApiKey", () => {
    it("should revoke a key", async () => {
      // revokeApiKey: from→update→eq→eq→select→single (2 eqs: id + user_id)
      supabaseAdmin.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "key-1", name: "Test Key", status: "revoked" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await revokeApiKey("key-1", "user-1");
      expect(result.success).toBe(true);
    });
  });

  describe("hashApiKey", () => {
    it("should produce consistent hashes", () => {
      const key = "fk_abc12345_test_key";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });
  });
});
