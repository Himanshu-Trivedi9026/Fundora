import { describe, it, expect } from "vitest";
import {
  maskGST,
  maskPAN,
  maskAccountNumber,
  maskIFSC,
  sanitizeBusinessVerification,
  sanitizeBankAccount,
  maskDocumentName,
  maskStoragePath,
  hashMetadata,
  sanitizeDocumentResponse,
  sanitizeVerificationRequest,
  sanitizeSessionResponse,
} from "../../lib/verification/metadataEncryption";

describe("Metadata Encryption — Business & Bank Masking", () => {
  // ─── maskGST ───
  describe("maskGST", () => {
    it("masks a valid 15-char GST — shows first 2 + last 4", () => {
      const result = maskGST("22AAAAA0000A1Z5");
      expect(result).toBe("22***A1Z5");
    });

    it("masks a different GST correctly", () => {
      const result = maskGST("01BBBBB1111B2Z9");
      expect(result).toBe("01***B2Z9");
    });

    it("preserves original casing", () => {
      const result = maskGST("22aaaaa0000a1z5");
      expect(result).toBe("22***a1z5");
    });

    it("returns '***' for null input", () => {
      expect(maskGST(null)).toBe("***");
    });

    it("returns '***' for undefined input", () => {
      expect(maskGST(undefined)).toBe("***");
    });

    it("returns '***' for empty string", () => {
      expect(maskGST("")).toBe("***");
    });

    it("returns '***' for non-string input (number)", () => {
      expect(maskGST(220000000000123)).toBe("***");
    });

    it("returns '***' for non-string input (boolean)", () => {
      expect(maskGST(true)).toBe("***");
    });

    it("returns '***' for short GST (6 chars or fewer)", () => {
      expect(maskGST("22AAAZ")).toBe("***");
      expect(maskGST("AB")).toBe("***");
      expect(maskGST("123456")).toBe("***");
    });

    it("masks GST of exactly 7 chars (just above threshold)", () => {
      const result = maskGST("22AAAAA");
      // 7 chars: first 2 (22) + *** + last 4 (AAAA)
      expect(result).toBe("22***AAAA");
    });
  });

  // ─── maskPAN ───
  describe("maskPAN", () => {
    it("masks a valid 10-char PAN — shows first 4 + last 1", () => {
      const result = maskPAN("ABCDE1234F");
      expect(result).toBe("ABCD***F");
    });

    it("masks a different PAN correctly", () => {
      const result = maskPAN("GHIJK5678L");
      expect(result).toBe("GHIJ***L");
    });

    it("preserves original casing", () => {
      const result = maskPAN("abcde1234f");
      expect(result).toBe("abcd***f");
    });

    it("returns '***' for null input", () => {
      expect(maskPAN(null)).toBe("***");
    });

    it("returns '***' for undefined input", () => {
      expect(maskPAN(undefined)).toBe("***");
    });

    it("returns '***' for empty string", () => {
      expect(maskPAN("")).toBe("***");
    });

    it("returns '***' for non-string input (number)", () => {
      expect(maskPAN(1234567890)).toBe("***");
    });

    it("returns '***' for short PAN (5 chars or fewer)", () => {
      expect(maskPAN("ABCDE")).toBe("***");
      expect(maskPAN("X")).toBe("***");
    });

    it("masks PAN of exactly 6 chars (just above threshold)", () => {
      const result = maskPAN("ABCDEF");
      expect(result).toBe("ABCD***F");
    });

    it("masks PAN where last char is a digit (still masks correctly)", () => {
      const result = maskPAN("ABCDE12341");
      expect(result).toBe("ABCD***1");
    });
  });

  // ─── maskAccountNumber ───
  describe("maskAccountNumber", () => {
    it("masks a normal account number — shows only last 4 digits", () => {
      const result = maskAccountNumber("1234567890123456");
      expect(result).toBe("************3456");
    });

    it("masks a 10-digit account number", () => {
      const result = maskAccountNumber("1234567890");
      expect(result).toBe("******7890");
    });

    it("masks a 12-digit account number", () => {
      const result = maskAccountNumber("987654321098");
      expect(result).toBe("********1098");
    });

    it("preserves exact last 4 digits", () => {
      const result = maskAccountNumber("0000111122223333");
      expect(result).toBe("************3333");
      expect(result.endsWith("3333")).toBe(true);
    });

    it("returns '****' for null input", () => {
      expect(maskAccountNumber(null)).toBe("****");
    });

    it("returns '****' for undefined input", () => {
      expect(maskAccountNumber(undefined)).toBe("****");
    });

    it("returns '****' for empty string", () => {
      expect(maskAccountNumber("")).toBe("****");
    });

    it("returns '****' for non-string input (number)", () => {
      expect(maskAccountNumber(1234567890)).toBe("****");
    });

    it("returns '****' for short account number (4 chars or fewer)", () => {
      expect(maskAccountNumber("1234")).toBe("****");
      expect(maskAccountNumber("12")).toBe("****");
      expect(maskAccountNumber("1")).toBe("****");
    });

    it("masks account number of exactly 5 chars (just above threshold)", () => {
      const result = maskAccountNumber("12345");
      expect(result).toBe("*2345");
    });

    it("masks a very long account number (20+ digits)", () => {
      const long = "1".repeat(20) + "5678";
      const result = maskAccountNumber(long);
      expect(result.endsWith("5678")).toBe(true);
      expect(result.length).toBe(24);
      expect(result.startsWith("**************")).toBe(true);
    });
  });

  // ─── maskIFSC ───
  describe("maskIFSC", () => {
    it("masks a valid 11-char IFSC — shows first 4 chars + masks rest", () => {
      const result = maskIFSC("HDFC0123456");
      expect(result).toBe("HDFC*******");
    });

    it("masks a different IFSC correctly", () => {
      const result = maskIFSC("ICIC0001234");
      expect(result).toBe("ICIC*******");
    });

    it("preserves original casing", () => {
      const result = maskIFSC("hdfc0123456");
      expect(result).toBe("hdfc*******");
    });

    it("returns '****' for null input", () => {
      expect(maskIFSC(null)).toBe("****");
    });

    it("returns '****' for undefined input", () => {
      expect(maskIFSC(undefined)).toBe("****");
    });

    it("returns '****' for empty string", () => {
      expect(maskIFSC("")).toBe("****");
    });

    it("returns '****' for non-string input (boolean)", () => {
      expect(maskIFSC(true)).toBe("****");
    });

    it("returns '****' for short IFSC (4 chars or fewer)", () => {
      expect(maskIFSC("HDFC")).toBe("****");
      expect(maskIFSC("H")).toBe("****");
    });

    it("masks IFSC of exactly 5 chars (just above threshold)", () => {
      const result = maskIFSC("HDFC0");
      expect(result).toBe("HDFC*");
    });

    it("masks a 7-char partial IFSC", () => {
      const result = maskIFSC("HDFC012");
      expect(result).toBe("HDFC***");
    });
  });
});

describe("Metadata Encryption — Business Sanitization", () => {
  // ─── sanitizeBusinessVerification ───
  describe("sanitizeBusinessVerification", () => {
    it("returns null for null input", () => {
      expect(sanitizeBusinessVerification(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(sanitizeBusinessVerification(undefined)).toBeNull();
    });

    it("strips raw gst_number field", () => {
      const biz = {
        id: "biz-1",
        gst_number: "22AAAAA0000A1Z5",
        pan_number: "ABCDE1234F",
        cin_number: "L12345AB2023PLC000001",
      };
      const result = sanitizeBusinessVerification(biz);
      expect(result.gst_number).toBeUndefined();
    });

    it("strips raw pan_number field", () => {
      const biz = {
        id: "biz-1",
        gst_number: "22AAAAA0000A1Z5",
        pan_number: "ABCDE1234F",
      };
      const result = sanitizeBusinessVerification(biz);
      expect(result.pan_number).toBeUndefined();
    });

    it("strips raw cin_number field", () => {
      const biz = {
        id: "biz-1",
        cin_number: "L12345AB2023PLC000001",
      };
      const result = sanitizeBusinessVerification(biz);
      expect(result.cin_number).toBeUndefined();
    });

    it("strips provider_reference field", () => {
      const biz = {
        id: "biz-1",
        provider_reference: "ref_123",
      };
      const result = sanitizeBusinessVerification(biz);
      expect(result.provider_reference).toBeUndefined();
    });

    it("strips metadata_encrypted field", () => {
      const biz = {
        id: "biz-1",
        metadata_encrypted: { ciphertext: "abc" },
      };
      const result = sanitizeBusinessVerification(biz);
      expect(result.metadata_encrypted).toBeUndefined();
    });

    it("strips metadata_hash field", () => {
      const biz = {
        id: "biz-1",
        metadata_hash: "hash123",
      };
      const result = sanitizeBusinessVerification(biz);
      expect(result.metadata_hash).toBeUndefined();
    });

    it("adds gst_number_masked from original gst_number", () => {
      const biz = {
        id: "biz-1",
        gst_number: "22AAAAA0000A1Z5",
      };
      const result = sanitizeBusinessVerification(biz);
      expect(result.gst_number_masked).toBe("22***A1Z5");
    });

    it("adds pan_number_masked from original pan_number", () => {
      const biz = {
        id: "biz-1",
        pan_number: "ABCDE1234F",
      };
      const result = sanitizeBusinessVerification(biz);
      expect(result.pan_number_masked).toBe("ABCD***F");
    });

    it("preserves safe fields", () => {
      const biz = {
        id: "biz-1",
        business_name: "Acme Corp",
        business_type: "private_limited",
        status: "pending",
        created_at: "2026-01-01T00:00:00Z",
        gst_number: "22AAAAA0000A1Z5",
      };
      const result = sanitizeBusinessVerification(biz);
      expect(result.id).toBe("biz-1");
      expect(result.business_name).toBe("Acme Corp");
      expect(result.business_type).toBe("private_limited");
      expect(result.status).toBe("pending");
      expect(result.created_at).toBe("2026-01-01T00:00:00Z");
    });

    it("does not mutate the original object", () => {
      const biz = {
        id: "biz-1",
        gst_number: "22AAAAA0000A1Z5",
        pan_number: "ABCDE1234F",
      };
      const original = { ...biz };
      sanitizeBusinessVerification(biz);
      expect(biz.gst_number).toBe(original.gst_number);
      expect(biz.pan_number).toBe(original.pan_number);
    });

    it("handles biz with no sensitive fields", () => {
      const biz = { id: "biz-1", business_name: "Test" };
      const result = sanitizeBusinessVerification(biz);
      expect(result.id).toBe("biz-1");
      expect(result.business_name).toBe("Test");
      expect(result.gst_number_masked).toBe("***");
      expect(result.pan_number_masked).toBe("***");
    });
  });
});

describe("Metadata Encryption — Bank Account Sanitization", () => {
  // ─── sanitizeBankAccount ───
  describe("sanitizeBankAccount", () => {
    it("returns null for null input", () => {
      expect(sanitizeBankAccount(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(sanitizeBankAccount(undefined)).toBeNull();
    });

    it("strips account_number_encrypted field", () => {
      const account = {
        id: "acc-1",
        account_number_encrypted: Buffer.from("encrypted"),
      };
      const result = sanitizeBankAccount(account);
      expect(result.account_number_encrypted).toBeUndefined();
    });

    it("strips ifsc_code field", () => {
      const account = {
        id: "acc-1",
        ifsc_code: "HDFC0123456",
      };
      const result = sanitizeBankAccount(account);
      expect(result.ifsc_code).toBeUndefined();
    });

    it("strips upi_id field", () => {
      const account = {
        id: "acc-1",
        upi_id: "user@upi",
      };
      const result = sanitizeBankAccount(account);
      expect(result.upi_id).toBeUndefined();
    });

    it("strips provider_reference field", () => {
      const account = {
        id: "acc-1",
        provider_reference: "ref_456",
      };
      const result = sanitizeBankAccount(account);
      expect(result.provider_reference).toBeUndefined();
    });

    it("adds account_number_masked", () => {
      const account = {
        id: "acc-1",
        account_number_masked: "1234567890",
      };
      const result = sanitizeBankAccount(account);
      expect(result.account_number_masked).toBe("******7890");
    });

    it("adds ifsc_masked from original ifsc_code", () => {
      const account = {
        id: "acc-1",
        ifsc_code: "HDFC0123456",
      };
      const result = sanitizeBankAccount(account);
      expect(result.ifsc_masked).toBe("HDFC*******");
    });

    it("preserves safe fields", () => {
      const account = {
        id: "acc-1",
        user_id: "user-123",
        account_holder_name: "John Doe",
        bank_name: "HDFC Bank",
        branch_name: "Main Branch",
        status: "verified",
        is_primary: true,
        ifsc_code: "HDFC0123456",
      };
      const result = sanitizeBankAccount(account);
      expect(result.id).toBe("acc-1");
      expect(result.user_id).toBe("user-123");
      expect(result.account_holder_name).toBe("John Doe");
      expect(result.bank_name).toBe("HDFC Bank");
      expect(result.status).toBe("verified");
      expect(result.is_primary).toBe(true);
    });

    it("does not mutate the original object", () => {
      const account = {
        id: "acc-1",
        ifsc_code: "HDFC0123456",
        upi_id: "user@upi",
      };
      const original = { ...account };
      sanitizeBankAccount(account);
      expect(account.ifsc_code).toBe(original.ifsc_code);
      expect(account.upi_id).toBe(original.upi_id);
    });

    it("handles account with no sensitive fields", () => {
      const account = { id: "acc-1", bank_name: "Test Bank" };
      const result = sanitizeBankAccount(account);
      expect(result.id).toBe("acc-1");
      expect(result.bank_name).toBe("Test Bank");
    });
  });
});

describe("Metadata Encryption — Document Sanitization", () => {
  // ─── maskDocumentName ───
  describe("maskDocumentName", () => {
    it("returns '***' for null input", () => {
      expect(maskDocumentName(null)).toBe("***");
    });

    it("returns '***' for undefined input", () => {
      expect(maskDocumentName(undefined)).toBe("***");
    });

    it("returns '***' for empty string", () => {
      expect(maskDocumentName("")).toBe("***");
    });

    it("returns '***' for non-string input", () => {
      expect(maskDocumentName(123)).toBe("***");
    });

    it("masks filename with extension (name > 3 chars)", () => {
      const result = maskDocumentName("passport_front.jpg");
      expect(result).toBe("pas***ront.jpg");
    });

    it("masks short name with extension (name <= 3 chars)", () => {
      expect(maskDocumentName("abc.pdf")).toBe("***.pdf");
    });

    it("masks long filename without extension", () => {
      const result = maskDocumentName("longfilename");
      expect(result).toBe("lon***name");
    });

    it("masks filename with multiple dots", () => {
      const result = maskDocumentName("my.file.name.png");
      expect(result).toBe("my.***name.png");
    });

    it("preserves extension", () => {
      const result = maskDocumentName("document.pdf");
      expect(result).toMatch(/\.pdf$/);
    });

    it("handles unicode filenames", () => {
      const result = maskDocumentName("दस्तावेज़_पैन.jpg");
      expect(result).toContain("***");
      expect(result).toMatch(/\.jpg$/);
    });
  });

  // ─── maskStoragePath ───
  describe("maskStoragePath", () => {
    it("returns '***' for null path", () => {
      expect(maskStoragePath(null)).toBe("***");
    });

    it("returns masked path with userId", () => {
      const result = maskStoragePath("/path/file.jpg", "user123");
      expect(result).toBe("verification-docs/user123/***");
    });

    it("returns masked path without userId", () => {
      const result = maskStoragePath("/path/file.jpg");
      expect(result).toBe("verification-docs/***/***");
    });

    it("never exposes the original path", () => {
      const result = maskStoragePath(
        "verification-docs/abc123/docs/pan.jpg",
        "abc123",
      );
      expect(result).not.toContain("pan.jpg");
    });
  });

  // ─── hashMetadata ───
  describe("hashMetadata", () => {
    it("returns a 64-char hex string for string input", () => {
      const result = hashMetadata("test data");
      expect(typeof result).toBe("string");
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[a-f0-9]+$/);
    });

    it("returns consistent hash for same input", () => {
      const h1 = hashMetadata("hello");
      const h2 = hashMetadata("hello");
      expect(h1).toBe(h2);
    });

    it("returns different hashes for different inputs", () => {
      const h1 = hashMetadata("hello");
      const h2 = hashMetadata("world");
      expect(h1).not.toBe(h2);
    });

    it("handles object input by JSON-stringifying", () => {
      const h1 = hashMetadata({ key: "value" });
      const h2 = hashMetadata('{"key":"value"}');
      expect(h1).toBe(h2);
    });

    it("handles empty string", () => {
      const result = hashMetadata("");
      expect(result).toHaveLength(64);
    });
  });

  // ─── sanitizeDocumentResponse ───
  describe("sanitizeDocumentResponse", () => {
    it("returns null for null input", () => {
      expect(sanitizeDocumentResponse(null)).toBeNull();
    });

    it("strips provider_reference", () => {
      const doc = {
        id: "d1",
        document_name: "test.jpg",
        provider_reference: "ref",
      };
      const result = sanitizeDocumentResponse(doc);
      expect(result.provider_reference).toBeUndefined();
    });

    it("strips storage_path", () => {
      const doc = {
        id: "d1",
        document_name: "test.jpg",
        storage_path: "/path",
      };
      const result = sanitizeDocumentResponse(doc);
      expect(result.storage_path).toBeUndefined();
    });

    it("strips metadata_encrypted and metadata_hash", () => {
      const doc = {
        id: "d1",
        document_name: "test.jpg",
        metadata_encrypted: {},
        metadata_hash: "abc",
      };
      const result = sanitizeDocumentResponse(doc);
      expect(result.metadata_encrypted).toBeUndefined();
      expect(result.metadata_hash).toBeUndefined();
    });

    it("masks document_name", () => {
      const doc = { id: "d1", document_name: "passport_front.jpg" };
      const result = sanitizeDocumentResponse(doc);
      expect(result.document_name).toBe("pas***ront.jpg");
    });

    it("preserves safe fields", () => {
      const doc = { id: "d1", document_type: "pan_card", status: "pending" };
      const result = sanitizeDocumentResponse(doc);
      expect(result.id).toBe("d1");
      expect(result.document_type).toBe("pan_card");
    });
  });

  // ─── sanitizeVerificationRequest ───
  describe("sanitizeVerificationRequest", () => {
    it("returns null for null input", () => {
      expect(sanitizeVerificationRequest(null)).toBeNull();
    });

    it("strips provider_reference", () => {
      const req = { id: "r1", provider_reference: "stripe-123" };
      const result = sanitizeVerificationRequest(req);
      expect(result.provider_reference).toBeUndefined();
    });

    it("strips device_metadata and ip_address from metadata", () => {
      const req = {
        id: "r1",
        metadata: {
          device_metadata: { type: "mobile" },
          ip_address: "192.168.1.1",
          user_agent: "Mozilla",
        },
      };
      const result = sanitizeVerificationRequest(req);
      expect(result.metadata.device_metadata).toBeUndefined();
      expect(result.metadata.ip_address).toBeUndefined();
      expect(result.metadata.user_agent).toBe("Mozilla");
    });

    it("preserves safe top-level fields", () => {
      const req = {
        id: "r1",
        status: "pending",
        verification_type: "identity",
      };
      const result = sanitizeVerificationRequest(req);
      expect(result.id).toBe("r1");
      expect(result.status).toBe("pending");
    });
  });

  // ─── sanitizeSessionResponse ───
  describe("sanitizeSessionResponse", () => {
    it("returns null for null input", () => {
      expect(sanitizeSessionResponse(null)).toBeNull();
    });

    it("strips device_metadata", () => {
      const session = { id: "s1", device_metadata: { os: "iOS" } };
      const result = sanitizeSessionResponse(session);
      expect(result.device_metadata).toBeUndefined();
    });

    it("strips ip_address_hash", () => {
      const session = { id: "s1", ip_address_hash: "abc123" };
      const result = sanitizeSessionResponse(session);
      expect(result.ip_address_hash).toBeUndefined();
    });

    it("strips wizard_state", () => {
      const session = { id: "s1", wizard_state: { step: "phone" } };
      const result = sanitizeSessionResponse(session);
      expect(result.wizard_state).toBeUndefined();
    });

    it("preserves safe session fields", () => {
      const session = {
        id: "s1",
        user_id: "u1",
        current_step: "email",
        completed: false,
        started_at: "2026-01-01T00:00:00Z",
      };
      const result = sanitizeSessionResponse(session);
      expect(result.id).toBe("s1");
      expect(result.user_id).toBe("u1");
      expect(result.completed).toBe(false);
    });
  });
});
