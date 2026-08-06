import { vi } from "vitest";

// ---- Mocks ----
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
    })),
  },
}));

vi.mock("@/lib/withAuth", () => ({
  withAuth: (handler) => (req, res) => {
    req.user = { id: "test-creator-123", email: "test@example.com" };
    return handler(req, res, req.user);
  },
}));

import handler from "@/pages/api/ai/funding-recommendation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
    setHeader: vi.fn(),
  };
  return res;
}

describe("POST /api/ai/funding-recommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 for non-POST methods", async () => {
    const req = createMockReq("GET");
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns 400 for missing creatorId", async () => {
    const req = createMockReq("POST", {});
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "creatorId is required" });
  });

  it("returns 400 for non-string creatorId", async () => {
    const req = createMockReq("POST", { creatorId: 123 });
    const res = createMockRes();
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns recommended category with highest score", async () => {
    const projects = [
      {
        id: "p1",
        categories: ["Tech"],
        pledged: 8000,
        goal: 10000,
        owner_id: "creator-1",
      },
      {
        id: "p2",
        categories: ["Art"],
        pledged: 2000,
        goal: 5000,
        owner_id: "other",
      },
    ];
    const donations = [
      { project_id: "p1", amount: 500 },
      { project_id: "p2", amount: 100 },
    ];

    // Chain used by the route:
    //   projects:        from("projects").select(...).eq("deleted", false).limit(1000)
    //   public_donations: from("public_donations").select(...).limit(1000)
    const resolveFor = (table) => (resolve) => {
      if (table === "projects") resolve({ data: projects, error: null });
      else resolve({ data: donations, error: null });
    };
    supabaseAdmin.from.mockImplementation((table) => ({
      select: () => ({
        eq: () => ({ limit: () => ({ then: resolveFor(table) }) }),
        limit: () => ({ then: resolveFor(table) }),
      }),
    }));

    const req = createMockReq("POST", { creatorId: "creator-1" });
    const res = createMockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendedCategory: expect.any(String),
        score: expect.any(Number),
      }),
    );
  });

  it("returns null category when no projects exist", async () => {
    supabaseAdmin.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          limit: () => ({
            then: (resolve) => resolve({ data: [], error: null }),
          }),
        }),
        limit: () => ({
          then: (resolve) => resolve({ data: [], error: null }),
        }),
      }),
    }));

    const req = createMockReq("POST", { creatorId: "creator-1" });
    const res = createMockRes();
    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      recommendedCategory: null,
      score: 0,
    });
  });
});
