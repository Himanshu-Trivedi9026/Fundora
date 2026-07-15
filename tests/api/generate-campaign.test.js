import { vi } from "vitest";

// Mock OpenAI — must use vi.hoisted for variables referenced in vi.mock factory
const mockCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Test campaign description" } }],
  })
);

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        chat: { completions: { create: mockCreate } },
      };
    }),
  };
});

vi.mock("@/lib/withAuth", () => ({
  withAuth: (handler) => (req, res) => {
    req.user = { id: "test-user-123", email: "test@example.com" };
    return handler(req, res, req.user);
  },
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: () => () => true,
}));

import handler from "@/pages/api/ai/generate-campaign";

function createMockReq(method = "POST", body = {}) {
  return {
    method,
    body,
    headers: { authorization: "Bearer test-token" },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockImplementation((data) => {
      res.body = data;
      return res;
    }),
  };
  return res;
}

describe("POST /api/ai/generate-campaign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 for non-POST methods", async () => {
    const req = createMockReq("GET");
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns 400 when title is missing", async () => {
    const req = createMockReq("POST", { category: "Tech", goal: 10000 });
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing required fields" });
  });

  it("returns 400 when category is missing", async () => {
    const req = createMockReq("POST", { title: "My Project", goal: 10000 });
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when goal is missing", async () => {
    const req = createMockReq("POST", { title: "My Project", category: "Tech" });
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns generated content on success", async () => {
    const req = createMockReq("POST", { title: "My Project", category: "Tech", goal: 10000 });
    const res = createMockRes();
    await handler(req, res);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      })
    );
    expect(res.json).toHaveBeenCalledWith({ content: "Test campaign description" });
  });

  it("returns empty content when AI returns empty", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    });

    const req = createMockReq("POST", { title: "My Project", category: "Tech", goal: 10000 });
    const res = createMockRes();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith({ content: "" });
  });

  it("returns 500 when OpenAI call fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API error"));

    const req = createMockReq("POST", { title: "My Project", category: "Tech", goal: 10000 });
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "AI generation failed" });
  });
});
