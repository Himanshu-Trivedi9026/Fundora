import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Mock history data
const mockHistory = [
  { id: "h1", action: "created", old_status: null, new_status: "pending", old_level: 0, new_level: 0, performed_by_type: "system", reason: null, created_at: "2026-01-01T00:00:00Z" },
  { id: "h2", action: "approved", old_status: "pending", new_status: "approved", old_level: 0, new_level: 1, performed_by_type: "admin", reason: "Email verified", created_at: "2026-01-05T10:00:00Z" },
  { id: "h3", action: "level_changed", old_status: "approved", new_status: "approved", old_level: 1, new_level: 2, performed_by_type: "system", reason: "ID verified", created_at: "2026-01-15T12:00:00Z" },
];

// Mock Supabase client before importing context
vi.mock("../../lib/supabaseClient", () => {
  const mockUser = { id: "test-user-123", email: "test@example.com" };
  let authCallback = null;

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        onAuthStateChange: vi.fn((cb) => {
          authCallback = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
      from: vi.fn((table) => {
        const chain = {
          _table: table,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(),
        };
        if (table === "creator_verifications") {
          chain.maybeSingle.mockResolvedValue({
            data: {
              id: "ver-1",
              user_id: "test-user-123",
              verification_level: 2,
              email_verified: true,
              phone_verified: true,
              identity_verified: true,
              bank_verified: false,
              business_verified: false,
              selfie_verified: false,
              verification_status: "approved",
              trust_score: 75,
              risk_score: 15,
              verification_provider: null,
              verified_at: "2026-01-15T00:00:00Z",
              expires_at: "2027-01-15T00:00:00Z",
              expiry_status: "valid",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-15T00:00:00Z",
            },
            error: null,
          });
        } else if (table === "verification_history") {
          chain.order.mockResolvedValue({ data: mockHistory, error: null });
        }
        return chain;
      }),
      channel: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
      removeChannel: vi.fn(),
    },
  };
});

// Verification is role-gated to creator/admin; give the provider an eligible role.
vi.mock("../../context/RoleContext", () => ({
  useRole: () => ({ isCreator: true, isAdmin: false }),
}));

import { VerificationProvider, useVerification, VERIFICATION_LEVELS, VERIFICATION_STATUSES, EXPIRY_STATUSES } from "../../context/VerificationContext";

function wrapper({ children }) {
  return <VerificationProvider>{children}</VerificationProvider>;
}

describe("VerificationContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides verification data after loading", async () => {
    const { result } = renderHook(() => useVerification(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.verification).toBeTruthy();
    expect(result.current.verification.verification_level).toBe(2);
    expect(result.current.verification.trust_score).toBe(75);
  });

  it("computes isVerified correctly", async () => {
    const { result } = renderHook(() => useVerification(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.isVerified).toBe(true);
    expect(result.current.isFullyVerified).toBe(false); // level 2, not 5
  });

  it("computes levelLabel correctly", async () => {
    const { result } = renderHook(() => useVerification(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.levelLabel).toBe("Identity Verified");
  });

  it("provides history data", async () => {
    const { result } = renderHook(() => useVerification(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.history).toHaveLength(3);
    expect(result.current.history[0].action).toBe("created");
    expect(result.current.history[2].new_level).toBe(2);
  });

  it("provides expiry status", async () => {
    const { result } = renderHook(() => useVerification(), { wrapper });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(result.current.expiryStatus).toBe("valid");
    expect(result.current.isExpiringSoon).toBe(false);
    expect(result.current.daysUntilExpiry).toBeGreaterThan(150);
  });

  it("throws when used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useVerification());
    }).toThrow("useVerification must be used within a VerificationProvider");

    spy.mockRestore();
  });
});

describe("VERIFICATION_LEVELS", () => {
  it("has 6 levels (0-5)", () => {
    expect(VERIFICATION_LEVELS).toHaveLength(6);
  });

  it("each level has required fields", () => {
    VERIFICATION_LEVELS.forEach((level) => {
      expect(level).toHaveProperty("level");
      expect(level).toHaveProperty("label");
      expect(level).toHaveProperty("icon");
      expect(level).toHaveProperty("description");
    });
  });

  it("levels are ordered correctly", () => {
    expect(VERIFICATION_LEVELS[0].level).toBe(0);
    expect(VERIFICATION_LEVELS[5].level).toBe(5);
  });
});

describe("VERIFICATION_STATUSES", () => {
  it("has all required statuses", () => {
    expect(VERIFICATION_STATUSES).toHaveProperty("pending");
    expect(VERIFICATION_STATUSES).toHaveProperty("under_review");
    expect(VERIFICATION_STATUSES).toHaveProperty("approved");
    expect(VERIFICATION_STATUSES).toHaveProperty("rejected");
    expect(VERIFICATION_STATUSES).toHaveProperty("expired");
  });

  it("each status has required fields", () => {
    Object.values(VERIFICATION_STATUSES).forEach((status) => {
      expect(status).toHaveProperty("label");
      expect(status).toHaveProperty("color");
      expect(status).toHaveProperty("icon");
    });
  });
});

describe("EXPIRY_STATUSES", () => {
  it("has all required expiry statuses", () => {
    expect(EXPIRY_STATUSES).toHaveProperty("not_verified");
    expect(EXPIRY_STATUSES).toHaveProperty("valid");
    expect(EXPIRY_STATUSES).toHaveProperty("expiring_soon");
    expect(EXPIRY_STATUSES).toHaveProperty("expired");
  });

  it("each expiry status has required fields", () => {
    Object.values(EXPIRY_STATUSES).forEach((status) => {
      expect(status).toHaveProperty("label");
      expect(status).toHaveProperty("color");
      expect(status).toHaveProperty("icon");
    });
  });
});
