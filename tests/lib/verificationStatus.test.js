/**
 * lib/verification/status — server-side verification reads used by the API
 * gates. getCreatorVerification returns the full verification object
 * (fail-closed: error/missing → null); isCreatorVerified is true ONLY when
 * verification_status is exactly "approved".
 */
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  },
}));

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getCreatorVerification,
  isCreatorVerified,
} from "@/lib/verification/status";

beforeEach(() => {
  vi.clearAllMocks();
});

function mockVerificationRow(row) {
  supabaseAdmin.maybeSingle.mockResolvedValue(row);
}

describe("getCreatorVerification", () => {
  it("returns the full verification object for an approved row", async () => {
    mockVerificationRow({
      data: {
        verification_status: "approved",
        verification_level: 2,
        identity_verified: true,
        bank_verified: true,
        business_verified: false,
      },
      error: null,
    });

    const result = await getCreatorVerification("user-1");

    expect(result).toEqual({
      verification_status: "approved",
      verification_level: 2,
      identity_verified: true,
      bank_verified: true,
      business_verified: false,
    });
  });

  it("scopes the query to creator_verifications by user_id", async () => {
    mockVerificationRow({
      data: { verification_status: "approved" },
      error: null,
    });

    await getCreatorVerification("user-42");

    expect(supabaseAdmin.from).toHaveBeenCalledWith("creator_verifications");
    expect(supabaseAdmin.from("creator_verifications").eq).toHaveBeenCalledWith(
      "user_id",
      "user-42",
    );
  });

  it("returns null when the row is missing", async () => {
    mockVerificationRow({ data: null, error: null });
    expect(await getCreatorVerification("user-1")).toBeNull();
  });

  it("returns null when the lookup errors (fail-closed)", async () => {
    mockVerificationRow({ data: null, error: { message: "db down" } });
    expect(await getCreatorVerification("user-1")).toBeNull();
  });

  it("returns null for a falsy userId", async () => {
    expect(await getCreatorVerification(null)).toBeNull();
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});

describe("isCreatorVerified", () => {
  it("returns true only for an approved status", async () => {
    mockVerificationRow({
      data: { verification_status: "approved" },
      error: null,
    });
    expect(await isCreatorVerified("user-1")).toBe(true);
  });

  it("returns false for pending", async () => {
    mockVerificationRow({
      data: { verification_status: "pending" },
      error: null,
    });
    expect(await isCreatorVerified("user-1")).toBe(false);
  });

  it("returns false for rejected / expired / documents_uploaded", async () => {
    for (const status of [
      "rejected",
      "expired",
      "documents_uploaded",
      "under_review",
      "cancelled",
    ]) {
      mockVerificationRow({
        data: { verification_status: status },
        error: null,
      });
      expect(await isCreatorVerified("user-1")).toBe(false);
    }
  });

  it("returns false when the row is missing", async () => {
    mockVerificationRow({ data: null, error: null });
    expect(await isCreatorVerified("user-1")).toBe(false);
  });

  it("returns false when the lookup errors (fail-closed)", async () => {
    mockVerificationRow({ data: null, error: { message: "boom" } });
    expect(await isCreatorVerified("user-1")).toBe(false);
  });
});
