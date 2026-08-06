/**
 * AI Recommendations API Route Tests — Unit tests for GET /api/ai/recommendations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/withAuth.js", () => ({
  withAuth: vi.fn((handler) => {
    return async function (req, res) {
      req.user = req.user || { id: "test-user-id", email: "test@example.com" };
      return handler(req, res);
    };
  }),
}));

vi.mock("@/lib/rateLimit.js", () => ({
  rateLimit: vi.fn(() => vi.fn((handler) => handler)),
}));

vi.mock("@/lib/ai/recommendationEngine.js", () => ({
  getRecommendations: vi.fn().mockResolvedValue({
    success: true,
    data: { campaigns: [{ id: "camp-1", title: "Recommended" }], total: 1 },
  }),
}));

import handler from "@/pages/api/ai/recommendations.js";
import { getRecommendations } from "@/lib/ai/recommendationEngine.js";

function createMockReq(method = "GET", query = {}, user = { id: "test-user-id" }) {
  return { method, body: {}, user, query };
}

function createMockRes() {
  const res = {
    _status: null,
    _body: null,
    status: vi.fn(function (code) {
      res._status = code;
      return res;
    }),
    json: vi.fn(function (body) {
      res._body = body;
      return res;
    }),
  };
  return res;
}

describe("GET /api/ai/recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return recommendations on success", async () => {
    const req = createMockReq("GET", { type: "trending" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ campaigns: expect.any(Array) })
    );
    expect(getRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ type: "trending" })
    );
  });

  it("should return 400 when type is missing", async () => {
    const req = createMockReq("GET", {});
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("type") })
    );
  });

  it("should return 400 for invalid type", async () => {
    const req = createMockReq("GET", { type: "invalid_type" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("type") })
    );
  });

  it("should return 405 for POST requests", async () => {
    const req = createMockReq("POST", { type: "trending" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("should return 400 when engine fails", async () => {
    getRecommendations.mockResolvedValueOnce({ success: false, error: "Service unavailable" });

    const req = createMockReq("GET", { type: "campaigns_for_donor" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Service unavailable" });
  });

  it("should return 500 on unexpected error", async () => {
    getRecommendations.mockRejectedValueOnce(new Error("Crash"));

    const req = createMockReq("GET", { type: "trending" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
