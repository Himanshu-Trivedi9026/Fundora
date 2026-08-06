/**
 * AI Chat API Route Tests — Unit tests for POST /api/ai/chat.
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

vi.mock("@/lib/ai/copilotEngine.js", () => ({
  askCopilot: vi.fn().mockResolvedValue({
    success: true,
    data: { answer: "Hello! How can I help?", conversationId: "c-1" },
  }),
}));

import handler from "@/pages/api/ai/chat.js";
import { askCopilot } from "@/lib/ai/copilotEngine.js";

function createMockReq(method = "POST", body = {}, user = { id: "test-user-id" }) {
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

describe("POST /api/ai/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return AI response on success", async () => {
    const req = createMockReq("POST", {
      question: "What is Fundora?",
      copilotType: "creator",
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ answer: expect.any(String) })
    );
    expect(askCopilot).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "What is Fundora?",
        copilotType: "creator",
      })
    );
  });

  it("should return 405 for GET requests", async () => {
    const req = createMockReq("GET");
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("should return 400 when question is missing", async () => {
    const req = createMockReq("POST", { copilotType: "creator" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("question") })
    );
  });

  it("should return 400 when copilotType is missing", async () => {
    const req = createMockReq("POST", { question: "Hello" });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("copilotType") })
    );
  });

  it("should return 400 when AI engine fails", async () => {
    askCopilot.mockResolvedValueOnce({ success: false, error: "AI service unavailable" });

    const req = createMockReq("POST", {
      question: "Help me",
      copilotType: "donor",
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "AI service unavailable" });
  });

  it("should return 500 on unexpected error", async () => {
    askCopilot.mockRejectedValueOnce(new Error("Unexpected crash"));

    const req = createMockReq("POST", {
      question: "Hello",
      copilotType: "creator",
    });
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("should pass conversationId when provided", async () => {
    const req = createMockReq("POST", {
      question: "Follow up question",
      copilotType: "creator",
      conversationId: "c-existing",
    });
    const res = createMockRes();

    await handler(req, res);

    expect(askCopilot).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "c-existing" })
    );
  });
});
