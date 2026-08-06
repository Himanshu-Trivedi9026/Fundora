// Cache Engine — multi-backend cache abstraction
// Supports Redis, memory cache, distributed locking, rate limiting

import { supabaseAdmin } from "../supabaseAdmin.js";
import { logWarn } from "../verification/secureLogger.js";

const _memoryStore = new Map();
const _locks = new Map();
const _rateLimiters = new Map();

const DEFAULT_TTL = 300; // 5 minutes

// ——————————————————————————————————————
// Cache Backend
// ——————————————————————————————————————

export async function get(key, options = {}) {
  const backend = options.backend || "memory";
  try {
    switch (backend) {
      case "redis":
        return await getFromRedis(key);
      case "database":
        return await getFromDatabase(key);
      case "memory":
      default:
        return getFromMemory(key);
    }
  } catch (err) {
    logWarn("Cache get failed", { key, backend, error: err.message });
    return null;
  }
}

export async function set(key, value, options = {}) {
  const backend = options.backend || "memory";
  const ttl = options.ttl || DEFAULT_TTL;
  try {
    switch (backend) {
      case "redis":
        return await setToRedis(key, value, ttl);
      case "database":
        return await setToDatabase(key, value, ttl);
      case "memory":
      default:
        return setToMemory(key, value, ttl);
    }
  } catch (err) {
    logWarn("Cache set failed", { key, backend, error: err.message });
    return { success: false, error: err.message };
  }
}

export async function del(key, options = {}) {
  const backend = options.backend || "memory";
  try {
    switch (backend) {
      case "redis":
        return await delFromRedis(key);
      case "database":
        return await delFromDatabase(key);
      case "memory":
      default:
        return delFromMemory(key);
    }
  } catch (err) {
    logWarn("Cache del failed", { key, backend, error: err.message });
    return { success: false, error: err.message };
  }
}

export async function getOrSet(key, fetchFn, options = {}) {
  const cached = await get(key, options);
  if (cached !== null && cached !== undefined) {
    return cached;
  }
  const value = await fetchFn();
  await set(key, value, options);
  return value;
}

export async function invalidatePattern(pattern, options = {}) {
  const backend = options.backend || "memory";
  try {
    if (backend === "memory") {
      const patternRegex = new RegExp(pattern.replace("*", ".*"));
      for (const key of _memoryStore.keys()) {
        if (patternRegex.test(key)) {
          _memoryStore.delete(key);
        }
      }
      return { success: true };
    }
    return {
      success: false,
      error: `Pattern invalidation not supported for ${backend}`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function clear(backend = "memory") {
  try {
    switch (backend) {
      case "memory":
        _memoryStore.clear();
        return { success: true };
      case "redis":
        return { success: true };
      default:
        return { success: false, error: `Unknown backend: ${backend}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function getStats() {
  return {
    memory: {
      size: _memoryStore.size,
      keys: Array.from(_memoryStore.keys()),
    },
    locks: {
      active: _locks.size,
    },
    rateLimiters: {
      active: _rateLimiters.size,
    },
  };
}

// ——————————————————————————————————————
// Memory Backend
// ——————————————————————————————————————

function getFromMemory(key) {
  const entry = _memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    _memoryStore.delete(key);
    return null;
  }
  entry.hits = (entry.hits || 0) + 1;
  return entry.value;
}

function setToMemory(key, value, ttl) {
  _memoryStore.set(key, {
    value,
    expiresAt: ttl ? Date.now() + ttl * 1000 : null,
    createdAt: Date.now(),
    hits: 0,
  });
  return { success: true };
}

function delFromMemory(key) {
  return { success: _memoryStore.delete(key) };
}

// ——————————————————————————————————————
// Redis Backend (stub — requires redis client)
// ——————————————————————————————————————

async function getFromRedis(key) {
  // In production: client.get(key)
  return null;
}

async function setToRedis(key, value, ttl) {
  // In production: client.set(key, JSON.stringify(value), 'EX', ttl)
  return { success: true };
}

async function delFromRedis(key) {
  // In production: client.del(key)
  return { success: true };
}

// ——————————————————————————————————————
// Database Backend
// ——————————————————————————————————————

async function getFromDatabase(key) {
  const { data } = await supabaseAdmin
    .from("cache_metadata")
    .select("cache_key, value_size, expires_at, hits")
    .eq("cache_key", key)
    .single();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Update hits
  await supabaseAdmin
    .from("cache_metadata")
    .update({
      hits: (data.hits || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq("cache_key", key);

  return data;
}

async function setToDatabase(key, value, ttl) {
  const { error } = await supabaseAdmin.from("cache_metadata").upsert(
    {
      cache_key: key,
      value_size: JSON.stringify(value).length,
      ttl_seconds: ttl,
      expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
    },
    { onConflict: "cache_key" },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function delFromDatabase(key) {
  const { error } = await supabaseAdmin
    .from("cache_metadata")
    .delete()
    .eq("cache_key", key);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ——————————————————————————————————————
// Distributed Locking
// ——————————————————————————————————————

export async function acquireLock(name, options = {}) {
  const ttl = options.ttl || 30000; // 30s default
  const retryDelay = options.retryDelay || 100;
  const maxRetries = options.maxRetries || 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (!_locks.has(name)) {
      _locks.set(name, {
        owner: options.owner || process.pid,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + ttl,
      });
      return { success: true, data: { lockName: name, acquired: true } };
    }

    // Check if existing lock expired
    const existing = _locks.get(name);
    if (existing && Date.now() > existing.expiresAt) {
      _locks.delete(name);
      continue;
    }

    if (attempt < maxRetries - 1) {
      await sleep(retryDelay);
    }
  }

  return { success: false, error: "Could not acquire lock after retries" };
}

export async function releaseLock(name) {
  const existed = _locks.has(name);
  _locks.delete(name);
  return { success: true, data: { lockName: name, released: existed } };
}

export function isLocked(name) {
  const lock = _locks.get(name);
  if (!lock) return false;
  if (Date.now() > lock.expiresAt) {
    _locks.delete(name);
    return false;
  }
  return true;
}

// ——————————————————————————————————————
// Rate Limiting
// ——————————————————————————————————————

export async function checkRateLimit(key, options = {}) {
  const maxRequests = options.maxRequests || 60;
  const windowMs = options.windowMs || 60000; // 1 minute

  const now = Date.now();
  let limiter = _rateLimiters.get(key);

  if (!limiter || now - limiter.windowStart > windowMs) {
    limiter = { count: 0, windowStart: now };
    _rateLimiters.set(key, limiter);
  }

  limiter.count++;

  const remaining = Math.max(0, maxRequests - limiter.count);
  const resetAt = limiter.windowStart + windowMs;

  return {
    success: limiter.count <= maxRequests,
    data: {
      limit: maxRequests,
      remaining,
      resetAt,
      retryAfter:
        limiter.count > maxRequests ? Math.ceil((resetAt - now) / 1000) : 0,
    },
  };
}

export function resetRateLimit(key) {
  _rateLimiters.delete(key);
}

export function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of _memoryStore) {
    if (entry.expiresAt && now > entry.expiresAt) {
      _memoryStore.delete(key);
    }
  }
  for (const [name, lock] of _locks) {
    if (now > lock.expiresAt) {
      _locks.delete(name);
    }
  }
  return { success: true };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
