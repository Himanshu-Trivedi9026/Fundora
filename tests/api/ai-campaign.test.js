/**
 * AI Campaign API Route Tests — Unit tests for POST /api/ai/campaign/score and suggest.
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

vi.mock("@/lib/ai/aiEngine.js", () => ({
  scoreCampaign: vi.fn().mockResolvedValue({
    success: true,
    data: { score: 85, breakdown: { title: 90, description: 80 } },
  }),
}));

vi.mock("@/lib/ai/promptEngine.js", () => ({
  suggestCampaignTitle: vi.fn().mockResolvedValue({
    success: true,
    data: { suggestions: ["Better Title 1", "Better Title 2"] },
  }),
}));

import scoreHandler from "@/pages/api/ai/campaign/score.js";
import suggestHandler from "@/pages/api/ai/campaign/suggest.js";
import { scoreCampaign } from "@/lib/ai/aiEngine.js";
import { suggestCampaignTitle } from "@/lib/ai/promptEngine.js";

function createMockReq(
  method = "POST",
  body = {},
  user = { id: "test-user-id" },
) {
  return { method, body, user, query: {} };
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

describe("POST /api/ai/campaign/score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should score a campaign on success", async () => {
    const req = createMockReq("POST", { campaignId: "camp-1" });
    const res = createMockRes();

    await scoreHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ score: 85 }),
    );
    expect(scoreCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: "camp-1" }),
    );
  });

  it("should return 400 when campaignId is missing", async () => {
    const req = createMockReq("POST", {});
    const res = createMockRes();

    await scoreHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("campaignId") }),
    );
  });

  it("should return 405 for GET requests", async () => {
    const req = createMockReq("GET");
    const res = createMockRes();

    await scoreHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("should return 400 when engine fails", async () => {
    scoreCampaign.mockResolvedValueOnce({
      success: false,
      error: "Campaign not found",
    });

    const req = createMockReq("POST", { campaignId: "camp-missing" });
    const res = createMockRes();

    await scoreHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Campaign not found" });
  });
});

describe("POST /api/ai/campaign/suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should suggest titles on success", async () => {
    const req = createMockReq("POST", {
      title: "My Project",
      category: "tech",
      goal: 10000,
    });
    const res = createMockRes();

    await suggestHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: expect.arrayContaining([expect.any(String)]),
      }),
    );
    expect(suggestCampaignTitle).toHaveBeenCalledWith(
      expect.objectContaining({ title: "My Project" }),
    );
  });

  it("should return 400 when title is missing", async () => {
    const req = createMockReq("POST", { category: "tech" });
    const res = createMockRes();

    await suggestHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("title") }),
    );
  });

  it("should return 405 for GET requests", async () => {
    const req = createMockReq("GET");
    const res = createMockRes();

    await suggestHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("should return 500 on unexpected error", async () => {
    suggestCampaignTitle.mockRejectedValueOnce(new Error("Engine crash"));

    const req = createMockReq("POST", { title: "My Project" });
    const res = createMockRes();

    await suggestHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
