vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("@/lib/withAuth", () => ({
  withAuth: vi.fn((handler) => {
    return async function (req, res) {
      const user = { id: "test-user-id", email: "test@example.com" };
      return handler(req, res, user);
    };
  }),
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => vi.fn(() => true)),
}));

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import handler from "@/pages/api/ai/agent";

function createReq(method = "POST", body = {}) {
  return { method, body };
}

function createRes() {
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

describe("POST /api/ai/agent", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // The actual source uses response.text() then JSON.parse, so mock accordingly
    global.fetch = vi.fn().mockResolvedValue({
      text: () =>
        Promise.resolve(
          JSON.stringify({
            choices: [{ message: { content: "Test reply" } }],
          }),
        ),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 405 for non-POST methods", async () => {
    const req = createReq("GET");
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns 400 for empty message", async () => {
    const req = createReq("POST", { message: "" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Message is required" });
  });

  it("returns 400 for whitespace-only message", async () => {
    const req = createReq("POST", { message: "   " });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Message is required" });
  });

  it("returns 400 for non-string message", async () => {
    const req = createReq("POST", { message: 123 });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Message is required" });
  });

  it("returns 400 for missing message", async () => {
    const req = createReq("POST", {});
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Message is required" });
  });

  it("returns 200 with reply on success", async () => {
    const req = createReq("POST", { message: "What projects are available?" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ reply: "Test reply" });
  });

  it("fetches from OpenRouter with correct parameters", async () => {
    const req = createReq("POST", {
      message: "Tell me about projects",
      history: [
        { role: "user", content: "Hello" },
        { role: "ai", content: "Hi there!" },
      ],
    });
    const res = createRes();

    await handler(req, res);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: expect.stringContaining("Tell me about projects"),
      }),
    );
  });

  it("includes project context from supabase", async () => {
    supabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            title: "Test Project",
            goal: 10000,
            pledged: 5000,
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      }),
    });

    const req = createReq("POST", { message: "What projects are available?" });
    const res = createRes();

    await handler(req, res);

    const callArgs = global.fetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    // The system message should contain project info
    const systemContent = body.messages[0].content;
    expect(systemContent).toContain("Test Project");
    expect(systemContent).toContain("10000");
  });

  it("returns 500 when fetch fails", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = createReq("POST", { message: "Hello" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "AI failed" });
    consoleSpy.mockRestore();
  });

  it("returns fallback message when response has no choices", async () => {
    global.fetch.mockResolvedValue({
      text: () => Promise.resolve(JSON.stringify({ choices: [] })),
    });

    const req = createReq("POST", { message: "Hello" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      reply: expect.stringContaining("AI"),
    });
  });
});
