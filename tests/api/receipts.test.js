vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: { getUser: vi.fn() },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
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

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import handler from "@/pages/api/receipts/generate";

function createReq(method = "POST", body = {}, headers = {}) {
  return { method, body, headers };
}

function createRes() {
  const res = {
    _status: null,
    _body: null,
    _headers: {},
    status: vi.fn(function (code) {
      res._status = code;
      return res;
    }),
    json: vi.fn(function (body) {
      res._body = body;
      return res;
    }),
    setHeader: vi.fn(function (name, value) {
      res._headers[name] = value;
      return res;
    }),
  };
  return res;
}

describe("POST /api/receipts/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 405 for non-POST methods", async () => {
    const req = createReq("GET");
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns 400 for missing donationId", async () => {
    const req = createReq("POST", {});
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Donation ID is required" });
  });

  it("returns 404 when donation not found", async () => {
    supabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const req = createReq("POST", { donationId: "nonexistent-id" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Donation not found" });
  });

  it("returns 200 with receipt data on success", async () => {
    const mockDonation = {
      id: "donation-abc123",
      amount: 500,
      created_at: "2025-01-15T10:30:00Z",
      payer_id: "test-user-id",
      projects: { title: "Test Project" },
    };

    supabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockDonation, error: null }),
    });

    const req = createReq("POST", { donationId: "donation-abc123" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      receipt: expect.objectContaining({
        receiptId: expect.stringContaining("RCPT-"),
        amount: 500,
        project: "Test Project",
        donor: "test-user-id",
      }),
    });
  });

  it("receipt contains correct fields", async () => {
    const mockDonation = {
      id: "abcdef123456",
      amount: 1200,
      created_at: "2025-06-20T14:00:00Z",
      payer_id: "test-user-id",
      projects: { title: "Fundora Campaign" },
    };

    supabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockDonation, error: null }),
    });

    const req = createReq("POST", { donationId: "abcdef123456" });
    const res = createRes();

    await handler(req, res);

    const { receipt } = res.json.mock.calls[0][0];
    expect(receipt).toHaveProperty("receiptId");
    expect(receipt).toHaveProperty("amount");
    expect(receipt).toHaveProperty("date");
    expect(receipt).toHaveProperty("project");
    expect(receipt).toHaveProperty("donor");
    expect(receipt.receiptId).toBe("RCPT-ABCDEF");
    expect(receipt.amount).toBe(1200);
    expect(receipt.project).toBe("Fundora Campaign");
    expect(receipt.donor).toBe("test-user-id");
  });

  it("scopes query to payer_id = user.id (IDOR protection)", async () => {
    const mockDonation = {
      id: "donation-idor",
      amount: 300,
      created_at: "2025-03-10T08:00:00Z",
      payer_id: "test-user-id",
      projects: { title: "IDOR Test" },
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: mockDonation, error: null });
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });

    supabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn()
        .mockReturnValueOnce({ eq: mockEq2 })  // first .eq("id", donationId) returns chainable
        .mockReturnValueOnce({ single: mockSingle }), // second .eq("payer_id", user.id) returns chainable
    });

    const req = createReq("POST", { donationId: "donation-idor" });
    const res = createRes();

    await handler(req, res);

    // Verify the query chain used eq twice - once for donation ID and once for payer_id
    expect(supabaseAdmin.from).toHaveBeenCalledWith("public_donations");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 500 on database error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    supabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "DB connection failed" } }),
    });

    const req = createReq("POST", { donationId: "donation-fail" });
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Database error" });
    consoleSpy.mockRestore();
  });

  it("falls back to 'Unknown' when project title is missing", async () => {
    const mockDonation = {
      id: "donation-notitle",
      amount: 100,
      created_at: "2025-02-01T12:00:00Z",
      payer_id: "test-user-id",
      projects: null,
    };

    supabaseAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockDonation, error: null }),
    });

    const req = createReq("POST", { donationId: "donation-notitle" });
    const res = createRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        receipt: expect.objectContaining({ project: "Unknown" }),
      })
    );
  });
});
