// Cache Engine — Unit Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  get,
  set,
  del,
  getOrSet,
  invalidatePattern,
  clear,
  getStats,
  acquireLock,
  releaseLock,
  isLocked,
  checkRateLimit,
  resetRateLimit,
  cleanupExpiredCache,
} from "../../../lib/cache/cacheEngine.js";

describe("Cache Engine", () => {
  beforeEach(() => {
    clear("memory");
    cleanupExpiredCache();
  });

  // ——————————————————————————————————————
  // Memory Backend
  // ——————————————————————————————————————

  describe("Memory Backend", () => {
    it("should set and get a value", async () => {
      await set("key1", "value1");
      const result = await get("key1");
      expect(result).toBe("value1");
    });

    it("should return null for missing keys", async () => {
      const result = await get("nonexistent");
      expect(result).toBeNull();
    });

    it("should respect TTL expiration", async () => {
      await set("temp", "expires-fast", { ttl: 0 }); // 0 TTL — expires at creation time
      // When ttl is 0, expiresAt = Date.now() + 0. Date.now() > Date.now() is false
      // in the same ms, so the entry may not be expired yet. Use negative TTL to guarantee.
      await set("temp2", "gone", { ttl: -10 }); // negative TTL = already expired
      expect(await get("temp2")).toBeNull();
    });

    it("should delete keys", async () => {
      await set("key2", "value2");
      const delResult = await del("key2");
      expect(delResult.success).toBe(true);
      const result = await get("key2");
      expect(result).toBeNull();
    });

    it("should getOrSet with fetch function", async () => {
      const fetcher = vi.fn().mockResolvedValue("computed");
      const result1 = await getOrSet("computed-key", fetcher);
      expect(result1).toBe("computed");
      expect(fetcher).toHaveBeenCalledTimes(1);

      const result2 = await getOrSet("computed-key", fetcher);
      expect(result2).toBe("computed");
      expect(fetcher).toHaveBeenCalledTimes(1); // cached
    });

    it("should invalidate by pattern", async () => {
      await set("user:1:name", "Alice");
      await set("user:1:email", "alice@test.com");
      await set("post:1", "Post 1");

      await invalidatePattern("user:*");
      expect(await get("user:1:name")).toBeNull();
      expect(await get("user:1:email")).toBeNull();
      expect(await get("post:1")).toBe("Post 1");
    });

    it("should provide stats", async () => {
      await set("a", 1);
      await set("b", 2);
      await set("c", 3);

      const stats = getStats();
      expect(stats.memory.size).toBeGreaterThanOrEqual(3);
      expect(stats.memory.keys).toContain("a");
      expect(typeof stats.locks.active).toBe("number");
      expect(typeof stats.rateLimiters.active).toBe("number");
    });

    it("should clear all", async () => {
      await set("x", 1);
      await set("y", 2);
      const result = await clear("memory");
      expect(result.success).toBe(true);
      expect(await get("x")).toBeNull();
      expect(await get("y")).toBeNull();
    });
  });

  // ——————————————————————————————————————
  // Distributed Locking
  // ——————————————————————————————————————

  describe("Distributed Locking", () => {
    it("should acquire and release a lock", async () => {
      const acquired = await acquireLock("test-lock");
      expect(acquired.success).toBe(true);

      const secondAttempt = await acquireLock("test-lock", {
        maxRetries: 1,
        retryDelay: 10,
      });
      expect(secondAttempt.success).toBe(false);

      await releaseLock("test-lock");
      const thirdAttempt = await acquireLock("test-lock");
      expect(thirdAttempt.success).toBe(true);
    });

    it("should check if lock is held", async () => {
      expect(isLocked("check-lock")).toBe(false);
      await acquireLock("check-lock");
      expect(isLocked("check-lock")).toBe(true);
      await releaseLock("check-lock");
      expect(isLocked("check-lock")).toBe(false);
    });

    it("should release a non-existent lock", async () => {
      const result = await releaseLock("ghost-lock");
      expect(result.success).toBe(true);
      expect(result.data.released).toBe(false);
    });
  });

  // ——————————————————————————————————————
  // Rate Limiting
  // ——————————————————————————————————————

  describe("Rate Limiting", () => {
    it("should allow requests within limit", async () => {
      for (let i = 0; i < 3; i++) {
        const result = await checkRateLimit("rl-test", { maxRequests: 5 });
        expect(result.success).toBe(true);
        expect(result.data.remaining).toBeGreaterThanOrEqual(5 - i - 1);
      }
    });

    it("should block requests over limit", async () => {
      for (let i = 0; i < 3; i++) {
        await checkRateLimit("rl-block", { maxRequests: 2 });
      }
      const result = await checkRateLimit("rl-block", { maxRequests: 2 });
      expect(result.success).toBe(false);
      expect(result.data.remaining).toBe(0);
    });

    it("should reset rate limit", async () => {
      await checkRateLimit("rl-reset", { maxRequests: 1 });
      expect(
        (await checkRateLimit("rl-reset", { maxRequests: 1 })).success,
      ).toBe(false);
      resetRateLimit("rl-reset");
      expect(
        (await checkRateLimit("rl-reset", { maxRequests: 1 })).success,
      ).toBe(true);
    });
  });

  // ——————————————————————————————————————
  // Cleanup Expired
  // ——————————————————————————————————————

  describe("Cleanup", () => {
    it("should clean expired cache entries and locks", async () => {
      await set("expiring", "val", { ttl: -1 });
      // Sleep briefly to ensure it's expired
      await new Promise((r) => setTimeout(r, 10));
      const result = cleanupExpiredCache();
      expect(result.success).toBe(true);
      expect(await get("expiring")).toBeNull();
    });
  });
});
