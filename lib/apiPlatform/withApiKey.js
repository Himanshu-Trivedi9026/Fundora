/**
 * withApiKey — Authentication middleware for API key-based access.
 *
 * Validates the X-API-Key header, checks rate limits, logs the request.
 */

import { hashApiKey, validateApiKey } from "./apiKeyEngine.js";
import { logApiRequest } from "./apiLogEngine.js";
import { rateLimit } from "../rateLimit.js";
import { logError } from "../verification/secureLogger.js";

/**
 * Wrap an API handler to require API key authentication.
 *
 * On success, req.apiKey and req.user are populated.
 * Rate limiting is applied per-key based on the key's config.
 */
export function withApiKey(handler) {
  return async function apiKeyHandler(req, res) {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
      return res.status(401).json({ error: "API key required (X-API-Key header)" });
    }

    const keyHash = hashApiKey(apiKey);
    const validation = await validateApiKey(keyHash);

    if (!validation.success) {
      return res.status(401).json({ error: validation.error || "Invalid API key" });
    }

    const keyData = validation.data;
    req.apiKey = keyData;
    req.user = { id: keyData.user_id };

    // Rate limit per key
    const rl = rateLimit({
      windowMs: keyData.rate_window_ms,
      max: keyData.rate_limit,
    });

    if (!rl(req, res)) return;

    // Intercept response to log the request
    const startTime = Date.now();
    const originalJson = res.json.bind(res);
    let responseLogged = false;

    res.json = function (body) {
      if (!responseLogged) {
        responseLogged = true;
        const responseTimeMs = Date.now() - startTime;

        // Fire-and-forget log — don't block the response
        logApiRequest({
          apiKeyId: keyData.id,
          userId: keyData.user_id,
          organizationId: keyData.organization_id,
          method: req.method,
          path: req.url,
          queryParams: req.query,
          responseStatus: res.statusCode,
          responseTimeMs,
          userAgent: req.headers["user-agent"],
        }).catch((err) => {
          logError("withApiKey", "Failed to log API request", { error: err.message });
        });
      }

      return originalJson(body);
    };

    return handler(req, res);
  };
}
