import { describe, it, expect } from "vitest";
import {
  sanitizeDocumentResponse,
  sanitizeVerificationRequest,
  sanitizeSessionResponse,
  maskDocumentName,
  maskStoragePath,
} from "../../lib/verification/metadataEncryption";

describe("sanitizeDocumentResponse", () => {
  it("strips provider_reference from the response", () => {
    const input = {
      id: "doc-123",
      document_type: "passport",
      provider_reference: "pr-abc-456",
      status: "verified",
    };

    const result = sanitizeDocumentResponse(input);

    expect(result.provider_reference).toBeUndefined();
    expect(result.id).toBe("doc-123");
    expect(result.document_type).toBe("passport");
    expect(result.status).toBe("verified");
  });

  it("strips storage_path from the response", () => {
    const input = {
      id: "doc-123",
      storage_path: "verification-docs/user123/passport.enc",
      status: "pending",
    };

    const result = sanitizeDocumentResponse(input);

    expect(result.storage_path).toBeUndefined();
    expect(result.id).toBe("doc-123");
    expect(result.status).toBe("pending");
  });

  it("strips metadata_encrypted from the response", () => {
    const input = {
      id: "doc-123",
      metadata_encrypted: { iv: "base64nonce", data: "base64ciphertext" },
      status: "verified",
    };

    const result = sanitizeDocumentResponse(input);

    expect(result.metadata_encrypted).toBeUndefined();
    expect(result.id).toBe("doc-123");
    expect(result.status).toBe("verified");
  });

  it("strips metadata_hash from the response", () => {
    const input = {
      id: "doc-123",
      metadata_hash: "sha256-abcdef1234567890",
      status: "verified",
    };

    const result = sanitizeDocumentResponse(input);

    expect(result.metadata_hash).toBeUndefined();
    expect(result.id).toBe("doc-123");
    expect(result.status).toBe("verified");
  });

  it("strips ALL sensitive fields simultaneously", () => {
    const input = {
      id: "doc-789",
      document_type: "drivers_license",
      provider_reference: "pr-sensitive-value",
      storage_path: "verification-docs/user456/license.enc",
      metadata_encrypted: { iv: "nonce", data: "cipher" },
      metadata_hash: "sha256-hashvalue",
      status: "verified",
      created_at: "2026-01-15T10:00:00Z",
    };

    const result = sanitizeDocumentResponse(input);

    expect(result.provider_reference).toBeUndefined();
    expect(result.storage_path).toBeUndefined();
    expect(result.metadata_encrypted).toBeUndefined();
    expect(result.metadata_hash).toBeUndefined();

    expect(result.id).toBe("doc-789");
    expect(result.document_type).toBe("drivers_license");
    expect(result.status).toBe("verified");
    expect(result.created_at).toBe("2026-01-15T10:00:00Z");
  });
});

describe("sanitizeVerificationRequest", () => {
  it("strips provider_reference from the top level of the request", () => {
    const input = {
      id: "req-001",
      provider_reference: "pr-internal-id",
      metadata: {
        document_type: "passport",
        device_metadata: { os: "Windows", browser: "Chrome" },
        ip_address: "192.168.1.100",
      },
      status: "submitted",
    };

    const result = sanitizeVerificationRequest(input);

    expect(result.provider_reference).toBeUndefined();
    expect(result.metadata.document_type).toBe("passport");
    expect(result.id).toBe("req-001");
    expect(result.status).toBe("submitted");
  });

  it("strips device_metadata from metadata", () => {
    const input = {
      id: "req-002",
      metadata: {
        document_type: "passport",
        device_metadata: {
          os: "macOS",
          browser: "Safari",
          screen_resolution: "2560x1440",
        },
      },
    };

    const result = sanitizeVerificationRequest(input);

    expect(result.metadata.device_metadata).toBeUndefined();
    expect(result.metadata.document_type).toBe("passport");
    expect(result.id).toBe("req-002");
  });

  it("strips ip_address from metadata", () => {
    const input = {
      id: "req-003",
      metadata: {
        document_type: "id_card",
        ip_address: "10.0.0.1",
      },
    };

    const result = sanitizeVerificationRequest(input);

    expect(result.metadata.ip_address).toBeUndefined();
    expect(result.metadata.document_type).toBe("id_card");
    expect(result.id).toBe("req-003");
  });

  it("strips all sensitive metadata fields simultaneously", () => {
    const input = {
      id: "req-004",
      provider_reference: "pr-secret",
      metadata: {
        document_type: "passport",
        device_metadata: { os: "Linux", browser: "Firefox" },
        ip_address: "172.16.0.50",
        issued_country: "US",
      },
      status: "processing",
    };

    const result = sanitizeVerificationRequest(input);

    expect(result.provider_reference).toBeUndefined();
    expect(result.metadata.device_metadata).toBeUndefined();
    expect(result.metadata.ip_address).toBeUndefined();

    expect(result.metadata.document_type).toBe("passport");
    expect(result.metadata.issued_country).toBe("US");
    expect(result.id).toBe("req-004");
    expect(result.status).toBe("processing");
  });
});

describe("sanitizeSessionResponse", () => {
  it("strips device_metadata from the session", () => {
    const input = {
      session_id: "sess-abc",
      user_id: "user-123",
      device_metadata: { os: "Windows", browser: "Edge" },
      status: "active",
    };

    const result = sanitizeSessionResponse(input);

    expect(result.device_metadata).toBeUndefined();
    expect(result.session_id).toBe("sess-abc");
    expect(result.user_id).toBe("user-123");
    expect(result.status).toBe("active");
  });

  it("strips ip_address_hash from the session", () => {
    const input = {
      session_id: "sess-def",
      ip_address_hash: "sha256-iphash",
      status: "active",
    };

    const result = sanitizeSessionResponse(input);

    expect(result.ip_address_hash).toBeUndefined();
    expect(result.session_id).toBe("sess-def");
    expect(result.status).toBe("active");
  });

  it("strips wizard_state from the session", () => {
    const input = {
      session_id: "sess-ghi",
      wizard_state: { current_step: 3, selections: ["passport", "front"] },
      status: "active",
    };

    const result = sanitizeSessionResponse(input);

    expect(result.wizard_state).toBeUndefined();
    expect(result.session_id).toBe("sess-ghi");
    expect(result.status).toBe("active");
  });

  it("strips all sensitive session fields simultaneously", () => {
    const input = {
      session_id: "sess-all",
      user_id: "user-456",
      device_metadata: { os: "iOS", browser: "Safari" },
      ip_address_hash: "sha256-hash",
      wizard_state: { step: 2 },
      status: "active",
      created_at: "2026-06-01T08:30:00Z",
    };

    const result = sanitizeSessionResponse(input);

    expect(result.device_metadata).toBeUndefined();
    expect(result.ip_address_hash).toBeUndefined();
    expect(result.wizard_state).toBeUndefined();

    expect(result.session_id).toBe("sess-all");
    expect(result.user_id).toBe("user-456");
    expect(result.status).toBe("active");
    expect(result.created_at).toBe("2026-06-01T08:30:00Z");
  });
});

describe("maskDocumentName", () => {
  it("returns masked output for null input", () => {
    const result = maskDocumentName(null);

    expect(result).toBeDefined();
    expect(result).not.toContain("null");
  });

  it("returns masked output for undefined input", () => {
    const result = maskDocumentName(undefined);

    expect(result).toBeDefined();
    expect(result).not.toContain("undefined");
  });

  it("does not reveal full filename for a short name", () => {
    const input = "id.jpg";
    const result = maskDocumentName(input);

    expect(result).toBeDefined();
    expect(result).not.toBe(input);
    expect(result).not.toContain("id");
  });

  it("does not reveal full filename for a long name", () => {
    const input = "my-very-long-passport-document-scan-final-v2.png";
    const result = maskDocumentName(input);

    expect(result).toBeDefined();
    expect(result).not.toBe(input);
    expect(result).not.toContain("passport");
    expect(result).not.toContain("scan");
  });

  it("does not reveal full filename for unicode input", () => {
    const input = "Документ_для_верификации.pdf";
    const result = maskDocumentName(input);

    expect(result).toBeDefined();
    expect(result).not.toBe(input);
    expect(result).not.toContain("Документ");
  });

  it("does not reveal full filename for emoji input", () => {
    const input = "📄_passport_🛂.jpg";
    const result = maskDocumentName(input);

    expect(result).toBeDefined();
    expect(result).not.toBe(input);
    expect(result).not.toContain("passport");
  });
});

describe("maskStoragePath", () => {
  it("returns *** when called with no arguments (path is undefined)", () => {
    const result = maskStoragePath();

    expect(result).toBe("***");
  });

  it("returns verification-docs/***/*** when path is provided but no userId", () => {
    const result = maskStoragePath("verification-docs/user123/passport.enc");

    expect(result).toBe("verification-docs/***/***");
    expect(result).not.toMatch(/[a-f0-9]{8}-[a-f0-9]{4}/);
  });

  it("reveals userId but masks everything else when both path and userId are provided", () => {
    const userId = "user-abc-123-def";
    const result = maskStoragePath("verification-docs/user-abc-123-def/passport.enc", userId);

    expect(result).toBe("verification-docs/user-abc-123-def/***");
    expect(result).toContain(userId);
    expect(result).toContain("verification-docs");
  });

  it("masks file portion even when userId is provided", () => {
    const userId = "user-xyz-789";
    const result = maskStoragePath("verification-docs/user-xyz-789/license.enc", userId);

    expect(result).toBe("verification-docs/user-xyz-789/***");
    expect(result).toContain(userId);
    expect(result).not.toContain(".enc");
    expect(result).not.toContain(".pdf");
    expect(result).not.toContain(".png");
    expect(result).not.toContain(".jpg");
  });

  it("returns *** for empty string path (falsy)", () => {
    const result = maskStoragePath("");

    expect(result).toBe("***");
  });
});
