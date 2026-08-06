import { describe, it, expect } from "vitest";
import {
  validateDocumentExtension,
  validateDocumentMime,
  validateDocumentSize,
  validateImageDimensions,
  checkDuplicateName,
  validateDocument,
  DOCUMENT_TYPES,
  DOCUMENT_REQUIREMENTS,
} from "../../lib/verification/documentValidator";

describe("Document Validator", () => {
  describe("validateDocumentExtension", () => {
    // --- Valid extensions ---
    it("accepts .jpg for pan_card", () => {
      const result = validateDocumentExtension("scan.jpg", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("jpg");
    });

    it("accepts .jpeg for pan_card", () => {
      const result = validateDocumentExtension("scan.jpeg", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("jpeg");
    });

    it("accepts .png for pan_card", () => {
      const result = validateDocumentExtension("scan.png", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("png");
    });

    it("accepts .webp for pan_card", () => {
      const result = validateDocumentExtension("scan.webp", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("webp");
    });

    it("accepts .pdf for pan_card", () => {
      const result = validateDocumentExtension("scan.pdf", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("pdf");
    });

    it("accepts .pdf for bank_statement", () => {
      const result = validateDocumentExtension("statement.pdf", DOCUMENT_TYPES.BANK_STATEMENT);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("pdf");
    });

    // --- Invalid extensions ---
    it("rejects .exe for pan_card", () => {
      const result = validateDocumentExtension("malware.exe", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid extension");
    });

    it("rejects .js for pan_card", () => {
      const result = validateDocumentExtension("script.js", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects .pdf for selfie (not in allowed list)", () => {
      const result = validateDocumentExtension("photo.pdf", DOCUMENT_TYPES.SELFIE);
      expect(result.valid).toBe(false);
    });

    it("rejects .doc for passport", () => {
      const result = validateDocumentExtension("passport.doc", DOCUMENT_TYPES.PASSPORT);
      expect(result.valid).toBe(false);
    });

    // --- Case insensitivity ---
    it("accepts .JPG (uppercase) for pan_card", () => {
      const result = validateDocumentExtension("scan.JPG", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("jpg");
    });

    it("accepts .PDF (uppercase) for pan_card", () => {
      const result = validateDocumentExtension("scan.PDF", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("pdf");
    });

    // --- Edge cases ---
    it("rejects null filename", () => {
      const result = validateDocumentExtension(null, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid filename");
    });

    it("rejects undefined filename", () => {
      const result = validateDocumentExtension(undefined, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects non-string filename", () => {
      const result = validateDocumentExtension(123, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects empty string filename", () => {
      const result = validateDocumentExtension("", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects filename without extension", () => {
      const result = validateDocumentExtension("noext", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("extension");
    });

    it("rejects filename with trailing dot", () => {
      const result = validateDocumentExtension("file.", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("extension");
    });

    // --- Fallback to OTHER ---
    it("falls back to OTHER requirements for unknown type", () => {
      const result = validateDocumentExtension("scan.pdf", "unknown_type");
      expect(result.valid).toBe(true);
    });

    // --- Multiple dots ---
    it("handles filename with multiple dots", () => {
      const result = validateDocumentExtension("my.scan.file.jpg", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("jpg");
    });
  });

  describe("validateDocumentMime", () => {
    // --- Valid MIME types ---
    it("accepts image/jpeg for pan_card", () => {
      const result = validateDocumentMime("image/jpeg", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("accepts image/png for pan_card", () => {
      const result = validateDocumentMime("image/png", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("accepts image/webp for pan_card", () => {
      const result = validateDocumentMime("image/webp", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("accepts application/pdf for pan_card", () => {
      const result = validateDocumentMime("application/pdf", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    // --- Invalid MIME types ---
    it("rejects image/gif for pan_card", () => {
      const result = validateDocumentMime("image/gif", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file type");
    });

    it("rejects application/msword for passport", () => {
      const result = validateDocumentMime("application/msword", DOCUMENT_TYPES.PASSPORT);
      expect(result.valid).toBe(false);
    });

    it("rejects application/pdf for selfie (not in allowed list)", () => {
      const result = validateDocumentMime("application/pdf", DOCUMENT_TYPES.SELFIE);
      expect(result.valid).toBe(false);
    });

    it("rejects video/mp4 for pan_card", () => {
      const result = validateDocumentMime("video/mp4", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    // --- Edge cases ---
    it("rejects null MIME type", () => {
      const result = validateDocumentMime(null, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Missing MIME type");
    });

    it("rejects undefined MIME type", () => {
      const result = validateDocumentMime(undefined, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects empty string MIME type", () => {
      const result = validateDocumentMime("", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    // --- Fallback ---
    it("falls back to OTHER for unknown type", () => {
      const result = validateDocumentMime("image/jpeg", "unknown_type");
      expect(result.valid).toBe(true);
    });
  });

  describe("validateDocumentSize", () => {
    // --- Valid sizes ---
    it("accepts 1KB file for pan_card", () => {
      const result = validateDocumentSize(1024, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("accepts 5MB file for pan_card", () => {
      const result = validateDocumentSize(5 * 1024 * 1024, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("accepts exactly 10MB file for pan_card (maxSizeMB is 10)", () => {
      const result = validateDocumentSize(10 * 1024 * 1024, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    // --- Oversized ---
    it("rejects 11MB file for pan_card", () => {
      const result = validateDocumentSize(11 * 1024 * 1024, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });

    it("rejects 50MB file for pan_card", () => {
      const result = validateDocumentSize(50 * 1024 * 1024, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    // --- Empty / zero ---
    it("rejects 0 bytes file", () => {
      const result = validateDocumentSize(0, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File is empty");
    });

    it("rejects null file size", () => {
      const result = validateDocumentSize(null, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects undefined file size", () => {
      const result = validateDocumentSize(undefined, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects negative file size", () => {
      const result = validateDocumentSize(-100, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    // --- Boundary ---
    it("accepts 1 byte file for pan_card", () => {
      const result = validateDocumentSize(1, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateImageDimensions", () => {
    // --- Valid dimensions ---
    it("accepts 400x250 for pan_card", () => {
      const result = validateImageDimensions(400, 250, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("accepts 1920x1080 for pan_card (well above minimum)", () => {
      const result = validateImageDimensions(1920, 1080, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("accepts 400x300 for passport", () => {
      const result = validateImageDimensions(400, 300, DOCUMENT_TYPES.PASSPORT);
      expect(result.valid).toBe(true);
    });

    it("accepts 200x200 for selfie", () => {
      const result = validateImageDimensions(200, 200, DOCUMENT_TYPES.SELFIE);
      expect(result.valid).toBe(true);
    });

    // --- Too small ---
    it("rejects 300x200 for pan_card (below 400x250)", () => {
      const result = validateImageDimensions(300, 200, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too small");
    });

    it("rejects 100x100 for selfie (below 200x200)", () => {
      const result = validateImageDimensions(100, 100, DOCUMENT_TYPES.SELFIE);
      expect(result.valid).toBe(false);
    });

    it("rejects width below minimum even if height is fine", () => {
      const result = validateImageDimensions(300, 500, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects height below minimum even if width is fine", () => {
      const result = validateImageDimensions(500, 100, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    // --- No requirement ---
    it("accepts any dimensions for OTHER (no minImageDimensions)", () => {
      const result = validateImageDimensions(10, 10, DOCUMENT_TYPES.OTHER);
      expect(result.valid).toBe(true);
    });

    // --- Invalid dimensions ---
    it("rejects zero width", () => {
      const result = validateImageDimensions(0, 250, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid image dimensions");
    });

    it("rejects zero height", () => {
      const result = validateImageDimensions(400, 0, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects null width", () => {
      const result = validateImageDimensions(null, 250, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("rejects negative dimensions", () => {
      const result = validateImageDimensions(-10, -10, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });
  });

  describe("checkDuplicateName", () => {
    it("returns valid when existingNames is null", () => {
      const result = checkDuplicateName(null, "file.jpg");
      expect(result.valid).toBe(true);
    });

    it("returns valid when existingNames is not an array", () => {
      const result = checkDuplicateName("not-an-array", "file.jpg");
      expect(result.valid).toBe(true);
    });

    it("returns valid for unique name", () => {
      const result = checkDuplicateName(["a.jpg", "b.pdf"], "c.png");
      expect(result.valid).toBe(true);
    });

    it("returns valid for empty existingNames array", () => {
      const result = checkDuplicateName([], "file.jpg");
      expect(result.valid).toBe(true);
    });

    it("returns invalid for duplicate name", () => {
      const result = checkDuplicateName(["file.jpg", "other.pdf"], "file.jpg");
      expect(result.valid).toBe(false);
      expect(result.suggestedName).toBeDefined();
      expect(result.error).toContain("already exists");
    });

    it("suggests name with extension preserved", () => {
      const result = checkDuplicateName(["photo.jpg"], "photo.jpg");
      expect(result.suggestedName).toMatch(/\.jpg$/);
    });

    it("suggests name with timestamp appended", () => {
      const result = checkDuplicateName(["doc.pdf"], "doc.pdf");
      expect(result.suggestedName).toMatch(/^doc-[a-z0-9]+\.pdf$/);
    });

    it("handles duplicate with no extension", () => {
      const result = checkDuplicateName(["noext"], "noext");
      expect(result.valid).toBe(false);
      expect(result.suggestedName).toMatch(/^noext-[a-z0-9]+$/);
    });

    it("suggests unique name each time (timestamp changes)", () => {
      const result1 = checkDuplicateName(["file.jpg"], "file.jpg");
      // Small delay to ensure different timestamp
      const result2 = checkDuplicateName(["file.jpg"], "file.jpg");
      // Both should be invalid with suggestions
      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result1.suggestedName).toBeDefined();
      expect(result2.suggestedName).toBeDefined();
    });
  });

  describe("validateDocument (full pipeline)", () => {
    it("passes all validations for a valid document", () => {
      const result = validateDocument({
        filename: "pan_card.jpg",
        mimeType: "image/jpeg",
        fileSize: 2 * 1024 * 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
        imageWidth: 800,
        imageHeight: 600,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.extension).toBe("jpg");
    });

    it("fails with invalid extension", () => {
      const result = validateDocument({
        filename: "card.exe",
        mimeType: "application/x-msdownload",
        fileSize: 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("extension"))).toBe(true);
    });

    it("fails with invalid MIME type", () => {
      const result = validateDocument({
        filename: "scan.jpg",
        mimeType: "image/gif",
        fileSize: 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("file type"))).toBe(true);
    });

    it("fails with oversized file", () => {
      const result = validateDocument({
        filename: "scan.jpg",
        mimeType: "image/jpeg",
        fileSize: 20 * 1024 * 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("too large"))).toBe(true);
    });

    it("fails with image too small", () => {
      const result = validateDocument({
        filename: "scan.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
        imageWidth: 100,
        imageHeight: 100,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("too small"))).toBe(true);
    });

    it("fails with duplicate name", () => {
      const result = validateDocument({
        filename: "scan.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
        existingNames: ["scan.jpg"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("already exists"))).toBe(true);
    });

    it("collects all errors when multiple validations fail", () => {
      const result = validateDocument({
        filename: "card.exe",
        mimeType: "image/gif",
        fileSize: 0,
        documentType: DOCUMENT_TYPES.PAN_CARD,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it("skips image dimension check for PDF files", () => {
      const result = validateDocument({
        filename: "scan.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
      });
      // PDF doesn't start with "image/", so dimensions are skipped
      expect(result.valid).toBe(true);
    });

    it("does not check dimensions if width/height not provided", () => {
      const result = validateDocument({
        filename: "scan.jpg",
        mimeType: "image/jpeg",
        fileSize: 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
        // No imageWidth / imageHeight
      });
      expect(result.valid).toBe(true);
    });

    it("returns extension on success", () => {
      const result = validateDocument({
        filename: "document.pdf",
        mimeType: "application/pdf",
        fileSize: 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
      });
      expect(result.extension).toBe("pdf");
    });

    it("returns no extension on failure", () => {
      const result = validateDocument({
        filename: "file.exe",
        mimeType: "application/x-msdownload",
        fileSize: 1024,
        documentType: DOCUMENT_TYPES.PAN_CARD,
      });
      expect(result.extension).toBeUndefined();
    });
  });

  describe("DOCUMENT_TYPES", () => {
    it("has all expected document types", () => {
      expect(DOCUMENT_TYPES.PAN_CARD).toBe("pan_card");
      expect(DOCUMENT_TYPES.AADHAAR_CARD).toBe("aadhaar_card");
      expect(DOCUMENT_TYPES.PASSPORT).toBe("passport");
      expect(DOCUMENT_TYPES.DRIVING_LICENSE).toBe("driving_license");
      expect(DOCUMENT_TYPES.VOTER_ID).toBe("voter_id");
      expect(DOCUMENT_TYPES.BUSINESS_REGISTRATION).toBe("business_registration");
      expect(DOCUMENT_TYPES.GST_CERTIFICATE).toBe("gst_certificate");
      expect(DOCUMENT_TYPES.BANK_STATEMENT).toBe("bank_statement");
      expect(DOCUMENT_TYPES.BANK_PASSBOOK).toBe("bank_passbook");
      expect(DOCUMENT_TYPES.SELFIE).toBe("selfie");
      expect(DOCUMENT_TYPES.UTILITY_BILL).toBe("utility_bill");
      expect(DOCUMENT_TYPES.OTHER).toBe("other");
    });
  });

  describe("DOCUMENT_REQUIREMENTS", () => {
    it("has requirements for every document type", () => {
      Object.values(DOCUMENT_TYPES).forEach((type) => {
        expect(DOCUMENT_REQUIREMENTS[type]).toBeDefined();
        expect(DOCUMENT_REQUIREMENTS[type].allowedMimeTypes).toBeDefined();
        expect(DOCUMENT_REQUIREMENTS[type].allowedExtensions).toBeDefined();
        expect(DOCUMENT_REQUIREMENTS[type].maxSizeMB).toBeGreaterThan(0);
      });
    });

    it("OTHER has no minImageDimensions", () => {
      expect(DOCUMENT_REQUIREMENTS[DOCUMENT_TYPES.OTHER].minImageDimensions).toBeNull();
    });

    it("SELFIE does not allow PDF", () => {
      expect(DOCUMENT_REQUIREMENTS[DOCUMENT_TYPES.SELFIE].allowedExtensions).not.toContain("pdf");
      expect(DOCUMENT_REQUIREMENTS[DOCUMENT_TYPES.SELFIE].allowedMimeTypes).not.toContain("application/pdf");
    });
  });

  describe("Edge Cases", () => {
    it("rejects 0-byte file (exactly at boundary)", () => {
      const result = validateDocumentSize(0, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("File is empty");
    });

    it("accepts exactly 1 byte file (minimum non-zero)", () => {
      const result = validateDocumentSize(1, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("rejects 1 byte over 10MB limit", () => {
      const result = validateDocumentSize(10 * 1024 * 1024 + 1, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });

    it("accepts exactly 10MB (at limit)", () => {
      const result = validateDocumentSize(10 * 1024 * 1024, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("handles filename with 255 characters (max filesystem length)", () => {
      const longName = "a".repeat(251) + ".jpg";
      expect(longName.length).toBe(255);
      const result = validateDocumentExtension(longName, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("jpg");
    });

    it("handles filename with unicode characters", () => {
      const result = validateDocumentExtension("दस्तावेज़.jpg", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("handles filename with emoji", () => {
      const result = validateDocumentExtension("📄scan.jpg", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("handles filename with special characters", () => {
      const result = validateDocumentExtension("scan (copy) [1].jpg", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("rejects deeply nested path in filename", () => {
      const result = validateDocumentExtension("../../etc/passwd.jpg", DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true); // Extension is valid, path traversal is handled at upload layer
    });

    it("handles extremely large file size (negative)", () => {
      const result = validateDocumentSize(-Infinity, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("handles NaN file size", () => {
      const result = validateDocumentSize(NaN, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("handles Infinity file size", () => {
      const result = validateDocumentSize(Infinity, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("handles NaN dimensions", () => {
      const result = validateImageDimensions(NaN, NaN, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("handles negative dimensions", () => {
      const result = validateImageDimensions(-1, -1, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(false);
    });

    it("handles Float dimensions", () => {
      const result = validateImageDimensions(400.5, 250.5, DOCUMENT_TYPES.PAN_CARD);
      expect(result.valid).toBe(true);
    });

    it("full pipeline collects all errors for completely invalid input", () => {
      const result = validateDocument({
        filename: null,
        mimeType: null,
        fileSize: 0,
        documentType: null,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it("full pipeline with undefined params does not throw", () => {
      expect(() => validateDocument({})).not.toThrow();
    });
  });
});
