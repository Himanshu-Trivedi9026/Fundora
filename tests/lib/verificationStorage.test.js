import { describe, it, expect, vi, beforeEach } from "vitest";

// Local storage mock — the global setup mock covers the supabaseAdmin fluent
// chain but not storage; provide it so uploadDocument/deleteDocument can be
// exercised and asserted against.
const mockUpload = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());
const mockCreateSignedUrl = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        remove: mockRemove,
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
  },
}));

import {
  validateMimeType,
  validateFileSize,
  validateExtension,
  isImageFile,
  formatFileSize,
  uploadDocument,
  deleteDocument,
  getSignedUrl,
  STORAGE_BUCKET,
  MAX_FILE_SIZE_MB,
  SIGNED_URL_EXPIRY_SECONDS,
} from "../../lib/verification/storage";

describe("Verification Storage — Validation Helpers", () => {
  describe("validateMimeType", () => {
    it("accepts valid JPEG for pan_card", () => {
      const result = validateMimeType("image/jpeg", "pan_card");
      expect(result.valid).toBe(true);
    });

    it("accepts valid PDF for pan_card", () => {
      const result = validateMimeType("application/pdf", "pan_card");
      expect(result.valid).toBe(true);
    });

    it("rejects invalid MIME for pan_card", () => {
      const result = validateMimeType("video/mp4", "pan_card");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file type");
    });

    it("accepts image types for selfie", () => {
      expect(validateMimeType("image/jpeg", "selfie").valid).toBe(true);
      expect(validateMimeType("image/png", "selfie").valid).toBe(true);
      expect(validateMimeType("image/webp", "selfie").valid).toBe(true);
    });

    it("rejects PDF for selfie", () => {
      const result = validateMimeType("application/pdf", "selfie");
      expect(result.valid).toBe(false);
    });

    it("falls back to 'other' for unknown document type", () => {
      const result = validateMimeType("image/jpeg", "unknown_type");
      expect(result.valid).toBe(true);
    });
  });

  describe("validateFileSize", () => {
    it("accepts valid file size", () => {
      const result = validateFileSize(1024 * 1024); // 1MB
      expect(result.valid).toBe(true);
    });

    it("rejects empty file", () => {
      const result = validateFileSize(0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("rejects file exceeding max size", () => {
      const result = validateFileSize(15 * 1024 * 1024); // 15MB
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });

    it("accepts file at exact max size", () => {
      const result = validateFileSize(MAX_FILE_SIZE_MB * 1024 * 1024);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateExtension", () => {
    it("accepts .jpg extension", () => {
      const result = validateExtension("photo.jpg");
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("jpg");
    });

    it("accepts .jpeg extension", () => {
      const result = validateExtension("photo.jpeg");
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("jpeg");
    });

    it("accepts .pdf extension", () => {
      const result = validateExtension("document.pdf");
      expect(result.valid).toBe(true);
      expect(result.extension).toBe("pdf");
    });

    it("accepts .webp extension", () => {
      const result = validateExtension("image.webp");
      expect(result.valid).toBe(true);
    });

    it("rejects .exe extension", () => {
      const result = validateExtension("malware.exe");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid extension");
    });

    it("rejects filename without extension", () => {
      const result = validateExtension("noextension");
      expect(result.valid).toBe(false);
    });

    it("rejects empty filename", () => {
      const result = validateExtension("");
      expect(result.valid).toBe(false);
    });
  });
});

describe("Verification Storage — Utility Functions", () => {
  describe("isImageFile", () => {
    it("returns true for image MIME types", () => {
      expect(isImageFile("image/jpeg")).toBe(true);
      expect(isImageFile("image/png")).toBe(true);
      expect(isImageFile("image/webp")).toBe(true);
    });

    it("returns false for non-image MIME types", () => {
      expect(isImageFile("application/pdf")).toBe(false);
      expect(isImageFile("video/mp4")).toBe(false);
    });

    it("returns falsy for null/undefined", () => {
      expect(isImageFile(null)).toBeFalsy();
      expect(isImageFile(undefined)).toBeFalsy();
    });
  });

  describe("formatFileSize", () => {
    it("formats bytes", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("formats kilobytes", () => {
      expect(formatFileSize(1536)).toBe("1.5 KB");
    });

    it("formats megabytes", () => {
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
    });
  });
});

describe("Verification Storage — Constants", () => {
  it("STORAGE_BUCKET is 'verification-docs'", () => {
    expect(STORAGE_BUCKET).toBe("verification-docs");
  });

  it("MAX_FILE_SIZE_MB is 10", () => {
    expect(MAX_FILE_SIZE_MB).toBe(10);
  });

  it("SIGNED_URL_EXPIRY_SECONDS is 3600 (1 hour)", () => {
    expect(SIGNED_URL_EXPIRY_SECONDS).toBe(3600);
  });
});

describe("Verification Storage — uploadDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ data: { path: "whatever" }, error: null });
  });

  function makeFile({ type = "image/jpeg", size = 1024 } = {}) {
    return { type, size };
  }

  it("returns the real storagePath plus a masked metadata path", async () => {
    const result = await uploadDocument({
      userId: "user-1",
      documentType: "pan_card",
      file: makeFile(),
      originalFilename: "pan.jpg",
    });

    expect(result.success).toBe(true);
    // Real path is returned for DB persistence…
    expect(result.storagePath).toMatch(/^user-1\/identity\/.+\.jpg$/);
    // …and the metadata exposes only a masked path, never the raw one.
    expect(result.metadata.storagePath).toBe(result.storagePath);
    expect(result.metadata.maskedPath).toBe("verification-docs/user-1/***");
    expect(result.metadata.bucket).toBe("verification-docs");
    expect(result.metadata.mimeType).toBe("image/jpeg");
    expect(result.metadata.fileSize).toBe(1024);
  });

  it("uploads to the verification-docs bucket via the service-role client", async () => {
    const result = await uploadDocument({
      userId: "user-1",
      documentType: "selfie",
      file: { type: "image/png", size: 2048 },
      originalFilename: "selfie.png",
    });

    expect(result.success).toBe(true);
    // Storage call: storage.from(bucket).upload(path, file, { contentType, upsert:false })
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload.mock.calls[0][1]).toEqual({
      type: "image/png",
      size: 2048,
    });
    expect(mockUpload.mock.calls[0][2]).toEqual({
      contentType: "image/png",
      upsert: false,
    });
  });

  it("returns success:false with a message when the upload errors", async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { message: "bucket not found" },
    });

    const result = await uploadDocument({
      userId: "user-1",
      documentType: "pan_card",
      file: makeFile(),
      originalFilename: "pan.jpg",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Upload failed");
  });

  it("rejects an empty file before touching storage", async () => {
    const result = await uploadDocument({
      userId: "user-1",
      documentType: "pan_card",
      file: makeFile({ size: 0 }),
      originalFilename: "pan.jpg",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("empty");
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejects an invalid MIME type before touching storage", async () => {
    const result = await uploadDocument({
      userId: "user-1",
      documentType: "selfie",
      file: { type: "application/pdf", size: 1024 },
      originalFilename: "selfie.pdf",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid file type");
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe("Verification Storage — deleteDocument & getSignedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRemove.mockResolvedValue({ data: [], error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed/url" },
      error: null,
    });
  });

  it("removes the object from the verification-docs bucket", async () => {
    const result = await deleteDocument("user-1/identity/123-abc.jpg");

    expect(result.success).toBe(true);
    expect(mockRemove).toHaveBeenCalledWith(["user-1/identity/123-abc.jpg"]);
  });

  it("returns success:false when no path is provided", async () => {
    const result = await deleteDocument(undefined);

    expect(result.success).toBe(false);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("generates a time-limited signed URL", async () => {
    const result = await getSignedUrl("user-1/identity/123-abc.jpg");

    expect(result.success).toBe(true);
    expect(result.url).toBe("https://example.com/signed/url");
    expect(result.expiresAt).toBeDefined();
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      "user-1/identity/123-abc.jpg",
      3600,
    );
  });
});
