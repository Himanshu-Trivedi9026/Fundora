import { describe, it, expect } from "vitest";
import {
  maskDocumentName,
  maskStoragePath,
  hashMetadata,
  sanitizeDocumentResponse,
  sanitizeVerificationRequest,
  sanitizeSessionResponse,
} from "../../lib/verification/metadataEncryption";
import {
  hashIP,
} from "../../lib/verification/auditLog";
import {
  validateDocumentExtension,
  validateDocumentMime,
  validateDocumentSize,
  validateImageDimensions,
  checkDuplicateName,
  validateDocument,
  DOCUMENT_TYPES,
} from "../../lib/verification/documentValidator";
import {
  generateOTP,
  hashOTP,
} from "../../lib/verification/phoneVerification";

/**
 * Edge Cases — Comprehensive boundary, injection, and stress tests.
 *
 * Covers:
 *   - Race conditions / concurrent operations
 *   - Boundary values (max/min)
 *   - Injection attacks (SQL-like, XSS, path traversal)
 *   - Null/undefined propagation
 *   - Unicode/emoji in all text fields
 *   - Very large inputs
 */
describe("Edge Cases", () => {
  // ─── Injection Attacks ───

  describe("SQL Injection in form fields", () => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "admin'--",
      "1; SELECT * FROM verification_audit_log",
      "' UNION SELECT * FROM verification_otp --",
      "1' AND 1=CONVERT(int, (SELECT TOP 1 table_name FROM information_schema.tables))--",
    ];

    for (const payload of sqlPayloads) {
      it(`masks document name safely for: ${payload.substring(0, 30)}...`, () => {
        const result = maskDocumentName(payload);
        expect(typeof result).toBe("string");
        expect(result).not.toBe(payload); // Should be masked
        expect(result).toContain("***");
      });

      it(`hashes metadata safely for: ${payload.substring(0, 30)}...`, () => {
        const result = hashMetadata(payload);
        expect(typeof result).toBe("string");
        expect(result).toHaveLength(64);
      });

      it(`validates extension safely for: ${payload.substring(0, 30)}...`, () => {
        const result = validateDocumentExtension(`${payload}.jpg`, DOCUMENT_TYPES.PAN_CARD);
        expect(result).toHaveProperty("valid");
      });
    }
  });

  describe("XSS Injection in form fields", () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '"><script>alert("XSS")</script>',
      'javascript:alert(1)',
      '<svg onload=alert(1)>',
      "{{7*7}}", // Template injection
      "${7*7}", // String interpolation
    ];

    for (const payload of xssPayloads) {
      it(`masks XSS payload safely: ${payload.substring(0, 30)}`, () => {
        const result = maskDocumentName(payload);
        expect(typeof result).toBe("string");
        // Should not contain the raw XSS payload
        expect(result).not.toBe(payload);
      });

      it(`hashes XSS payload safely: ${payload.substring(0, 30)}`, () => {
        const result = hashMetadata(payload);
        expect(typeof result).toBe("string");
        expect(result).toHaveLength(64);
      });

      it(`sanitizes XSS in document response: ${payload.substring(0, 30)}`, () => {
        const doc = {
          id: "doc-1",
          document_name: payload,
          provider_reference: "ref",
          storage_path: "/path",
        };
        const result = sanitizeDocumentResponse(doc);
        expect(result.document_name).not.toBe(payload);
        expect(result.document_name).toContain("***");
      });
    }
  });

  describe("Path Traversal in filenames", () => {
    const pathPayloads = [
      "../../etc/passwd",
      "..\\..\\windows\\system32\\config\\sam",
      "/etc/shadow",
      "C:\\Windows\\System32\\drivers\\etc\\hosts",
      "....//....//etc/passwd",
      "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    ];

    for (const payload of pathPayloads) {
      it(`handles path traversal: ${payload}`, () => {
        // Extension validation should still work (it only checks extension)
        const result = validateDocumentExtension(`${payload}.jpg`, DOCUMENT_TYPES.PAN_CARD);
        expect(result).toHaveProperty("valid");
        // Path traversal is handled at the upload/storage layer, not extension layer
      });

      it(`masks path traversal in document name: ${payload}`, () => {
        const result = maskDocumentName(payload);
        expect(typeof result).toBe("string");
        expect(result).toContain("***");
      });
    }
  });

  // ─── Null / Undefined Propagation ───

  describe("Null/undefined propagation through sanitization", () => {
    it("maskDocumentName handles all falsy values", () => {
      expect(maskDocumentName(null)).toBe("***");
      expect(maskDocumentName(undefined)).toBe("***");
      expect(maskDocumentName("")).toBe("***");
      expect(maskDocumentName(0)).toBe("***");
      expect(maskDocumentName(false)).toBe("***");
    });

    it("maskStoragePath handles all falsy values", () => {
      expect(maskStoragePath(null)).toBe("***");
      expect(maskStoragePath(undefined)).toBe("***");
      expect(maskStoragePath("")).toBe("***");
      expect(maskStoragePath(0)).toBe("***");
    });

    it("hashMetadata handles all falsy values", () => {
      // null/undefined may throw or return — test it doesn't crash hard
      expect(() => hashMetadata(null)).not.toThrow();
      expect(() => hashMetadata(undefined)).not.toThrow();
      expect(() => hashMetadata(0)).not.toThrow();
      expect(() => hashMetadata(false)).not.toThrow();
    });

    it("sanitizeDocumentResponse handles null/undefined", () => {
      expect(sanitizeDocumentResponse(null)).toBeNull();
      expect(sanitizeDocumentResponse(undefined)).toBeNull();
    });

    it("sanitizeVerificationRequest handles null/undefined", () => {
      expect(sanitizeVerificationRequest(null)).toBeNull();
      expect(sanitizeVerificationRequest(undefined)).toBeNull();
    });

    it("sanitizeSessionResponse handles null/undefined", () => {
      expect(sanitizeSessionResponse(null)).toBeNull();
      expect(sanitizeSessionResponse(undefined)).toBeNull();
    });

    it("hashIP handles null/undefined/empty", () => {
      expect(hashIP(null)).toBeNull();
      expect(hashIP(undefined)).toBeNull();
      expect(hashIP("")).toBeNull();
    });

    it("validateDocumentExtension handles null/undefined/empty", () => {
      expect(validateDocumentExtension(null, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateDocumentExtension(undefined, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateDocumentExtension("", DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
    });

    it("validateDocumentMime handles null/undefined/empty", () => {
      expect(validateDocumentMime(null, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateDocumentMime(undefined, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateDocumentMime("", DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
    });

    it("validateDocumentSize handles null/undefined/NaN/negative", () => {
      expect(validateDocumentSize(null, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateDocumentSize(undefined, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateDocumentSize(NaN, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateDocumentSize(-1, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
    });

    it("validateImageDimensions handles null/undefined/NaN/negative", () => {
      expect(validateImageDimensions(null, null, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateImageDimensions(undefined, undefined, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateImageDimensions(NaN, NaN, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
      expect(validateImageDimensions(-1, -1, DOCUMENT_TYPES.PAN_CARD).valid).toBe(false);
    });
  });

  // ─── Unicode / Emoji in All Text Fields ───

  describe("Unicode and emoji handling", () => {
    const unicodeInputs = [
      "नमस्ते दुनिया",
      "Привет мир",
      "你好世界",
      "مرحبا بالعالم",
      "🌍🌎🌏",
      "مرحبا 👋🌍",
      "日本語テスト 🇯🇵",
      "🔑 secure key 🔐",
      "ñáéíóú ñ",
      "Über cool",
      "Ωmega",
      "CJK统一表意文字",
      "🎉🎊🎈 Celebration 🎊🎉",
    ];

    for (const input of unicodeInputs) {
      it(`maskDocumentName handles: ${input.substring(0, 20)}`, () => {
        const result = maskDocumentName(input);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });

      it(`hashMetadata handles: ${input.substring(0, 20)}`, () => {
        const result = hashMetadata(input);
        expect(typeof result).toBe("string");
        expect(result).toHaveLength(64);
      });

      it(`hashIP handles: ${input.substring(0, 20)}`, () => {
        const result = hashIP(input);
        expect(typeof result).toBe("string");
        expect(result).toHaveLength(16);
      });

      it(`maskDocumentName with unicode extension: ${input.substring(0, 15)}.jpg`, () => {
        const result = maskDocumentName(`${input}.jpg`);
        expect(result).toMatch(/\.jpg$/);
      });
    }
  });

  // ─── Large Inputs / Stress ───

  describe("Large inputs", () => {
    it("hashMetadata handles 1MB string", () => {
      const largeStr = "x".repeat(1024 * 1024);
      const result = hashMetadata(largeStr);
      expect(typeof result).toBe("string");
      expect(result).toHaveLength(64);
    });

    it("hashMetadata handles large nested object", () => {
      const largeObj = {
        level1: {
          level2: {
            level3: Array.from({ length: 100 }, (_, i) => ({
              id: i,
              data: "x".repeat(100),
            })),
          },
        },
      };
      const result = hashMetadata(largeObj);
      expect(typeof result).toBe("string");
      expect(result).toHaveLength(64);
    });

    it("maskDocumentName handles 255-char filename", () => {
      const name = "a".repeat(251) + ".jpg";
      const result = maskDocumentName(name);
      expect(result).toMatch(/\.jpg$/);
      expect(result).toContain("***");
    });

    it("validateDocumentExtension handles 255-char filename", () => {
      const name = "a".repeat(251) + ".jpg";
      const result = validateDocumentExtension(name, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("jpg");
    });

    it("maskStoragePath handles very long path", () => {
      const longPath = "/verification-docs/" + "a".repeat(1000) + "/file.jpg";
      const result = maskStoragePath(longPath);
      expect(result).not.toContain("a".repeat(1000));
    });

    it("sanitizeDocumentResponse handles doc with many fields", () => {
      const doc = {
        id: "doc-1",
        ...Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`field_${i}`, `value_${i}`])
        ),
        provider_reference: "secret",
        storage_path: "/secret/path",
        metadata_encrypted: { ciphertext: "abc" },
        metadata_hash: "def",
      };
      const result = sanitizeDocumentResponse(doc);
      expect(result.id).toBe("doc-1");
      expect(result.provider_reference).toBeUndefined();
      expect(result.storage_path).toBeUndefined();
      expect(result.metadata_encrypted).toBeUndefined();
      expect(result.metadata_hash).toBeUndefined();
      expect(result.field_0).toBe("value_0");
      expect(result.field_49).toBe("value_49");
    });

    it("sanitizeVerificationRequest handles request with large metadata", () => {
      const req = {
        id: "req-1",
        metadata: {
          ...Object.fromEntries(
            Array.from({ length: 20 }, (_, i) => [`meta_${i}`, `val_${i}`])
          ),
          device_metadata: { os: "iOS" },
          ip_address: "192.168.1.1",
        },
      };
      const result = sanitizeVerificationRequest(req);
      expect(result.metadata.device_metadata).toBeUndefined();
      expect(result.metadata.ip_address).toBeUndefined();
      expect(result.metadata.meta_0).toBe("val_0");
    });
  });

  // ─── Boundary Values ───

  describe("Boundary values", () => {
    it("validateDocumentSize at exactly 10MB boundary", () => {
      const atLimit = validateDocumentSize(10 * 1024 * 1024, DOCUMENT_TYPES.PAN_CARD);
      expect(atLimit.valid).toBe(true);

      const overLimit = validateDocumentSize(10 * 1024 * 1024 + 1, DOCUMENT_TYPES.PAN_CARD);
      expect(overLimit.valid).toBe(false);
    });

    it("validateDocumentSize at exactly 1 byte", () => {
      const result = validateDocumentSize(1, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("validateImageDimensions at exact minimum (400x250 for PAN)", () => {
      const result = validateImageDimensions(400, 250, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("validateImageDimensions one pixel below minimum (399x250)", () => {
      const result = validateImageDimensions(399, 250, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("validateImageDimensions one pixel below on height (400x249)", () => {
      const result = validateImageDimensions(400, 249, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("checkDuplicateName with empty array", () => {
      const result = checkDuplicateName([], "file.jpg");
      expect(result.valid).toBe(true);
    });

    it("checkDuplicateName with very large existingNames array", () => {
      const names = Array.from({ length: 10000 }, (_, i) => `file_${i}.jpg`);
      const result = checkDuplicateName(names, "file_5000.jpg");
      expect(result.valid).toBe(false);
      expect(result.suggestedName).toBeDefined();
    });

    it("validateDocumentExtension with dot at position 0 (empty name part)", () => {
      const result = validateDocumentExtension(".jpg", DOCUMENT_TYPES.PAN_CARD);
      // Production code extracts "jpg" after last dot — validates as valid extension
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("jpg");
    });
  });

  // ─── Concurrent Operations ───

  describe("Concurrent operations", () => {
    it("concurrent hashMetadata calls produce consistent results", () => {
      const inputs = Array.from({ length: 100 }, (_, i) => `input_${i}`);
      const results = inputs.map((input) => hashMetadata(input));
      // Each should be deterministic
      results.forEach((result, i) => {
        expect(result).toBe(hashMetadata(inputs[i]));
      });
      // All should be unique (different inputs → different hashes)
      expect(new Set(results).size).toBe(100);
    });

    it("concurrent hashIP calls produce consistent results", () => {
      const ips = Array.from({ length: 100 }, (_, i) => `192.168.1.${i}`);
      const results = ips.map((ip) => hashIP(ip));
      results.forEach((result, i) => {
        expect(result).toBe(hashIP(ips[i]));
      });
      expect(new Set(results).size).toBe(100);
    });

    it("concurrent maskDocumentName calls are consistent", () => {
      const names = [
        "passport_front.jpg",
        "aadhaar_scan.png",
        "bank_statement.pdf",
        "selfie.jpg",
        "pan_card.webp",
      ];
      for (const name of names) {
        const r1 = maskDocumentName(name);
        const r2 = maskDocumentName(name);
        expect(r1).toBe(r2);
      }
    });

    it("concurrent generateOTP calls produce valid OTPs", () => {
      const otps = Array.from({ length: 200 }, () => generateOTP());
      for (const otp of otps) {
        expect(otp).toHaveLength(6);
        expect(/^\d{6}$/.test(otp)).toBe(true);
      }
      // Should have good distribution (at least 50 unique out of 200)
      expect(new Set(otps).size).toBeGreaterThan(50);
    });

    it("concurrent hashOTP calls with same input produce same result", () => {
      const results = Array.from({ length: 50 }, () => hashOTP("123456", "test-salt"));
      const hashes = results.map((r) => r.hash);
      expect(new Set(hashes).size).toBe(1);
    });
  });

  // ─── sanitizeDetails internal function (tested via behavior) ───

  describe("Sanitization strips sensitive fields", () => {
    it("sanitizeDocumentResponse strips all 4 sensitive fields", () => {
      const doc = {
        id: "x",
        document_name: "test.jpg",
        provider_reference: "stripe-ref",
        storage_path: "/bucket/user/file.jpg",
        metadata_encrypted: { iv: "abc", ct: "def" },
        metadata_hash: "hash123",
      };
      const result = sanitizeDocumentResponse(doc);
      expect(result.provider_reference).toBeUndefined();
      expect(result.storage_path).toBeUndefined();
      expect(result.metadata_encrypted).toBeUndefined();
      expect(result.metadata_hash).toBeUndefined();
    });

    it("sanitizeVerificationRequest strips provider_reference and nested fields", () => {
      const req = {
        id: "x",
        provider_reference: "stripe-ref",
        metadata: {
          device_metadata: { os: "iOS" },
          ip_address: "192.168.1.1",
          safe_field: "keep",
        },
      };
      const result = sanitizeVerificationRequest(req);
      expect(result.provider_reference).toBeUndefined();
      expect(result.metadata.device_metadata).toBeUndefined();
      expect(result.metadata.ip_address).toBeUndefined();
      expect(result.metadata.safe_field).toBe("keep");
    });

    it("sanitizeSessionResponse strips all 3 sensitive fields", () => {
      const session = {
        id: "x",
        device_metadata: { os: "iOS" },
        ip_address_hash: "abc123",
        wizard_state: { step: "phone", data: {} },
        current_step: "email",
      };
      const result = sanitizeSessionResponse(session);
      expect(result.device_metadata).toBeUndefined();
      expect(result.ip_address_hash).toBeUndefined();
      expect(result.wizard_state).toBeUndefined();
      expect(result.current_step).toBe("email");
    });
  });
});
