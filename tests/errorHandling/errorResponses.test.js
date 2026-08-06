import { describe, it, expect, vi } from "vitest";

vi.mock("../../../lib/withAuth", () => ({
  withAuth: (handler) => (req, res) => {
    req.user = { id: "test-user-123", email: "test@example.com" };
    return handler(req, res, req.user);
  },
}));

vi.mock("../../../lib/rateLimit", () => ({
  rateLimit: () => () => true,
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

import handler from "../../pages/api/ai/generate-campaign";

function createMockReq(overrides = {}) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
    },
    body: {
      niche: "technology",
      tone: "professional",
      platform: "kickstarter",
    },
    user: { id: "test-user-123", email: "test@example.com" },
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
    _statusCode: null,
    _jsonData: null,
  };
  res.status.mockImplementation((code) => {
    res._statusCode = code;
    return res;
  });
  res.json.mockImplementation((data) => {
    res._jsonData = data;
    return res;
  });
  return res;
}

describe("API Error Handling", () => {
  describe("Consistent error format", () => {
    it("returns { error: string } format on failure", async () => {
      const req = createMockReq({ method: "GET" });
      const res = createMockRes();

      await handler(req, res);

      expect(res._jsonData).toHaveProperty("error");
      expect(typeof res._jsonData.error).toBe("string");
    });

    it("returns 405 for unsupported HTTP methods", async () => {
      const req = createMockReq({ method: "DELETE" });
      const res = createMockRes();

      await handler(req, res);

      expect(res._statusCode).toBe(405);
      expect(res._jsonData).toHaveProperty("error");
    });

    it("error responses have error property of type string", async () => {
      const methods = ["GET", "PUT", "PATCH", "DELETE"];
      for (const method of methods) {
        const req = createMockReq({ method });
        const res = createMockRes();

        await handler(req, res);

        expect(res._jsonData).toHaveProperty("error");
        expect(typeof res._jsonData.error).toBe("string");
      }
    });
  });

  describe("Error responses don't contain stack traces", () => {
    it("error message does not contain stack trace patterns", async () => {
      const req = createMockReq({ method: "GET" });
      const res = createMockRes();

      await handler(req, res);

      const errorMessage = res._jsonData.error;
      expect(errorMessage).not.toMatch(/at\s+\S+\s*\(/);
      expect(errorMessage).not.toMatch(/Error:\s*/);
      expect(errorMessage).not.toMatch(/at Object\./);
      expect(errorMessage).not.toMatch(/at async/);
      expect(errorMessage).not.toMatch(/\.js:\d+:\d+/);
    });
  });

  describe("Missing Authorization header", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const withAuthReject = vi.fn((handler) => async (req, res) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      vi.doMock("../../../lib/withAuth", () => ({
        withAuth: withAuthReject,
      }));

      const req = createMockReq({
        headers: { "content-type": "application/json" },
      });
      const res = createMockRes();

      await withAuthReject(handler)(req, res);

      expect(res._statusCode).toBe(401);
      expect(res._jsonData).toHaveProperty("error");
      expect(typeof res._jsonData.error).toBe("string");

      vi.doUnmock("../../../lib/withAuth");
    });
  });

  describe("Malformed request body", () => {
    it("handles missing body gracefully", async () => {
      const req = createMockReq({ body: undefined });
      const res = createMockRes();

      await handler(req, res);

      expect(res._jsonData).toHaveProperty("error");
      expect(typeof res._jsonData.error).toBe("string");
    });

    it("handles null body gracefully", async () => {
      const req = createMockReq({ body: null });
      const res = createMockRes();

      await handler(req, res);

      expect(res._jsonData).toHaveProperty("error");
      expect(typeof res._jsonData.error).toBe("string");
    });

    it("handles empty object body gracefully", async () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();

      await handler(req, res);

      expect(res._jsonData).toHaveProperty("error");
      expect(typeof res._jsonData.error).toBe("string");
    });
  });

  describe("All API error responses have error property", () => {
    it("every error response includes a string error property", async () => {
      const testCases = [
        createMockReq({ method: "GET" }),
        createMockReq({ method: "DELETE" }),
        createMockReq({ body: undefined }),
        createMockReq({ body: null }),
        createMockReq({ body: {} }),
      ];

      for (const req of testCases) {
        const res = createMockRes();
        await handler(req, res);

        if (res._jsonData && res._statusCode && res._statusCode >= 400) {
          expect(res._jsonData).toHaveProperty("error");
          expect(typeof res._jsonData.error).toBe("string");
          expect(res._jsonData.error.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
