/**
 * In-memory sliding-window rate limiter.
 *
 * NOTE: Resets on serverless cold starts (acceptable for Vercel MVP).
 * For production-grade rate limiting, use Redis or Vercel's built-in limits.
 *
 * Usage:
 *   import { rateLimit } from "@/lib/rateLimit";
 *
 *   // In API route:
 *   const rl = rateLimit({ windowMs: 60_000, max: 10 });
 *   if (!rl(req, res)) return; // returns false if rate-limited (sends 429)
 */

const store = new Map();

// Periodic cleanup every 5 minutes to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (now - entry.windowStart > entry.windowMs) {
      store.delete(key);
    }
  }
}

/**
 * Rate-limit middleware factory.
 *
 * @param {Object} opts
 * @param {number} opts.windowMs  - Time window in milliseconds (default: 60 000)
 * @param {number} opts.max       - Max requests per window (default: 60)
 * @param {function} [opts.keyFn] - Custom key extractor: (req) => string
 *                                  Defaults to IP + auth token if present.
 * @returns {function} (req, res) => boolean — true if allowed, false if rate-limited (429 sent)
 */
export function rateLimit({ windowMs = 60_000, max = 60, keyFn } = {}) {
  cleanup();

  return function check(req, res) {
    const key = keyFn ? keyFn(req) : getClientKey(req);

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 0 };
      store.set(key, entry);
    }

    entry.count++;

    // Set rate-limit headers
    const remaining = Math.max(0, max - entry.count);
    const resetAt = Math.ceil((entry.windowStart + windowMs) / 1000);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetAt));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many requests",
        retryAfter,
      });
      return false; // rate-limited
    }

    return true; // allowed
  };
}

/**
 * Derive a rate-limit key from the request.
 * Uses auth token if present, otherwise falls back to IP.
 */
function getClientKey(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) return `user:${token.slice(0, 16)}`;

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  return `ip:${ip}`;
}

/**
 * Helper for IP-only rate limiting (login/signup endpoints
 * where user is not yet authenticated).
 */
export function ipRateLimit(opts = {}) {
  return rateLimit({
    ...opts,
    keyFn: (req) => {
      const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "unknown";
      return `ip:${ip}`;
    },
  });
}
