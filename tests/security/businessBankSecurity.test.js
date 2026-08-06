import { describe, it, expect } from "vitest";
import {
  sanitizeBusinessVerification,
  sanitizeBankAccount,
  maskGST,
  maskPAN,
  maskAccountNumber,
  maskIFSC,
} from "../../lib/verification/metadataEncryption";
import {
  maskAccountNumber as bankMaskAccount,
  maskIFSC as bankMaskIFSC,
} from "../../lib/verification/bankVerification";
import {
  maskGST as bizMaskGST,
  maskPAN as bizMaskPAN,
} from "../../lib/verification/businessVerification";

describe("Security — Sensitive Data Exposure", () => {
  describe("GST masking", () => {
    it("masks GST to show first 2 + last 4", () => {
      const result = maskGST("22AAAAA0000A1Z5");
      expect(result).toBe("22***A1Z5");
    });

    it("never exposes full GST in businessVerification mask", () => {
      const gst = "22AAAAA0000A1Z5";
      const masked = bizMaskGST(gst);
      expect(masked).not.toBe(gst);
      expect(masked.length).toBeLessThan(gst.length);
    });

    it("handles null GST gracefully", () => {
      expect(maskGST(null)).toBe("***");
      expect(maskGST("")).toBe("***");
    });
  });

  describe("PAN masking", () => {
    it("masks PAN to show first 4 + last 1", () => {
      const result = maskPAN("ABCDE1234F");
      expect(result).toBe("ABCD***F");
    });

    it("never exposes full PAN in businessVerification mask", () => {
      const pan = "ABCDE1234F";
      const masked = bizMaskPAN(pan);
      expect(masked).not.toBe(pan);
    });

    it("handles null PAN gracefully", () => {
      expect(maskPAN(null)).toBe("***");
      expect(maskPAN("")).toBe("***");
    });
  });

  describe("Account number masking", () => {
    it("masks account number showing only last 4", () => {
      const result = maskAccountNumber("1234567890123456");
      expect(result).toBe("************3456");
    });

    it("never exposes full account number in bankVerification mask", () => {
      const account = "1234567890123456";
      const masked = bankMaskAccount(account);
      expect(masked).not.toBe(account);
      expect(masked.endsWith("3456")).toBe(true);
    });

    it("handles short account numbers", () => {
      expect(maskAccountNumber("1234")).toBe("****");
      expect(maskAccountNumber("12")).toBe("****");
    });

    it("handles null account number", () => {
      expect(maskAccountNumber(null)).toBe("****");
      expect(maskAccountNumber("")).toBe("****");
    });
  });

  describe("IFSC masking", () => {
    it("masks IFSC showing first 4 + mask rest", () => {
      const result = maskIFSC("HDFC0123456");
      expect(result).toBe("HDFC*******");
    });

    it("never exposes full IFSC in bankVerification mask", () => {
      const ifsc = "HDFC0123456";
      const masked = bankMaskIFSC(ifsc);
      expect(masked).not.toBe(ifsc);
      expect(masked.startsWith("HDFC")).toBe(true);
    });

    it("handles short IFSC", () => {
      expect(maskIFSC("HDF")).toBe("****");
    });

    it("handles null IFSC", () => {
      expect(maskIFSC(null)).toBe("****");
    });
  });

  describe("Business verification sanitization", () => {
    it("strips all sensitive fields", () => {
      const biz = {
        id: "123",
        business_name: "Test Corp",
        gst_number: "22AAAAA0000A1Z5",
        pan_number: "ABCDE1234F",
        cin_number: "U12345AB2020PTC123456",
        provider_reference: "ref_abc",
        metadata_encrypted: "encrypted_data",
        metadata_hash: "hash_data",
        status: "verified",
      };

      const safe = sanitizeBusinessVerification(biz);
      expect(safe.gst_number).toBeUndefined();
      expect(safe.pan_number).toBeUndefined();
      expect(safe.cin_number).toBeUndefined();
      expect(safe.provider_reference).toBeUndefined();
      expect(safe.metadata_encrypted).toBeUndefined();
      expect(safe.metadata_hash).toBeUndefined();
    });

    it("adds masked versions", () => {
      const biz = {
        gst_number: "22AAAAA0000A1Z5",
        pan_number: "ABCDE1234F",
        business_name: "Test Corp",
      };

      const safe = sanitizeBusinessVerification(biz);
      expect(safe.gst_number_masked).toBe("22***A1Z5");
      expect(safe.pan_number_masked).toBe("ABCD***F");
    });

    it("preserves non-sensitive fields", () => {
      const biz = {
        id: "123",
        business_name: "Test Corp",
        business_type: "private_limited",
        status: "verified",
      };

      const safe = sanitizeBusinessVerification(biz);
      expect(safe.id).toBe("123");
      expect(safe.business_name).toBe("Test Corp");
      expect(safe.business_type).toBe("private_limited");
    });

    it("handles null input", () => {
      expect(sanitizeBusinessVerification(null)).toBeNull();
    });
  });

  describe("Bank account sanitization", () => {
    it("strips all sensitive fields", () => {
      const account = {
        id: "123",
        account_holder_name: "John Doe",
        account_number_encrypted: "encrypted_data",
        ifsc_code: "HDFC0123456",
        upi_id: "john@hdfc",
        provider_reference: "ref_abc",
        bank_name: "HDFC",
        status: "verified",
      };

      const safe = sanitizeBankAccount(account);
      expect(safe.account_number_encrypted).toBeUndefined();
      expect(safe.ifsc_code).toBeUndefined();
      expect(safe.upi_id).toBeUndefined();
      expect(safe.provider_reference).toBeUndefined();
    });

    it("preserves non-sensitive fields", () => {
      const account = {
        id: "123",
        account_holder_name: "John Doe",
        bank_name: "HDFC",
        status: "verified",
        is_primary: true,
      };

      const safe = sanitizeBankAccount(account);
      expect(safe.account_holder_name).toBe("John Doe");
      expect(safe.bank_name).toBe("HDFC");
      expect(safe.is_primary).toBe(true);
    });

    it("handles null input", () => {
      expect(sanitizeBankAccount(null)).toBeNull();
    });
  });
});
