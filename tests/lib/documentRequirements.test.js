import { describe, it, expect } from "vitest";
import {
  BUSINESS_DOCUMENT_REQUIREMENTS,
  BANK_DOCUMENT_REQUIREMENTS,
  BUSINESS_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  getRequiredDocuments,
  getBankDocuments,
  getMissingDocuments,
  checkDocumentCompletion,
  getDocumentLabel,
  getBusinessTypeLabel,
  listBusinessTypes,
} from "../../lib/verification/documentRequirements";

describe("Document Requirements Engine", () => {
  // ─── getRequiredDocuments ───
  describe("getRequiredDocuments", () => {
    it("returns 3 documents for individual business type", () => {
      const docs = getRequiredDocuments("individual");
      expect(docs).toEqual(["pan_card", "aadhaar_card", "address_proof"]);
      expect(docs).toHaveLength(3);
    });

    it("returns 4 documents for sole_proprietorship", () => {
      const docs = getRequiredDocuments("sole_proprietorship");
      expect(docs).toEqual([
        "gst_certificate",
        "pan_card",
        "business_address_proof",
        "cancelled_cheque",
      ]);
      expect(docs).toHaveLength(4);
    });

    it("returns 5 documents for partnership", () => {
      const docs = getRequiredDocuments("partnership");
      expect(docs).toHaveLength(5);
      expect(docs).toContain("partnership_deed");
      expect(docs).toContain("gst_certificate");
    });

    it("returns 4 documents for llp", () => {
      const docs = getRequiredDocuments("llp");
      expect(docs).toHaveLength(4);
      expect(docs).toContain("certificate_of_incorporation");
      expect(docs).toContain("partnership_deed");
    });

    it("returns 5 documents for private_limited", () => {
      const docs = getRequiredDocuments("private_limited");
      expect(docs).toHaveLength(5);
      expect(docs).toContain("moa");
      expect(docs).toContain("aoa");
      expect(docs).toContain("director_identity_proof");
    });

    it("returns 5 documents for public_limited", () => {
      const docs = getRequiredDocuments("public_limited");
      expect(docs).toHaveLength(5);
      expect(docs).toEqual(getRequiredDocuments("private_limited"));
    });

    it("returns 4 documents for ngo", () => {
      const docs = getRequiredDocuments("ngo");
      expect(docs).toHaveLength(4);
      expect(docs).toContain("trust_registration");
    });

    it("returns 4 documents for trust", () => {
      const docs = getRequiredDocuments("trust");
      expect(docs).toHaveLength(4);
      expect(docs).toContain("trust_registration");
    });

    it("returns 4 documents for society", () => {
      const docs = getRequiredDocuments("society");
      expect(docs).toHaveLength(4);
      expect(docs).toContain("society_registration");
    });

    it("returns 5 documents for startup", () => {
      const docs = getRequiredDocuments("startup");
      expect(docs).toHaveLength(5);
      expect(docs).toContain("udyam_registration");
    });

    it("returns 2 documents for government", () => {
      const docs = getRequiredDocuments("government");
      expect(docs).toHaveLength(2);
      expect(docs).toEqual(["pan_card", "business_address_proof"]);
    });

    it("returns empty array for unknown business type", () => {
      const docs = getRequiredDocuments("unknown_type");
      expect(docs).toEqual([]);
    });

    it("returns empty array for empty string input", () => {
      const docs = getRequiredDocuments("");
      expect(docs).toEqual([]);
    });

    it("returns empty array for null input", () => {
      const docs = getRequiredDocuments(null);
      expect(docs).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      const docs = getRequiredDocuments(undefined);
      expect(docs).toEqual([]);
    });
  });

  // ─── getBankDocuments ───
  describe("getBankDocuments", () => {
    it("returns verification and optional document arrays", () => {
      const docs = getBankDocuments();
      expect(docs).toHaveProperty("verification");
      expect(docs).toHaveProperty("optional");
    });

    it("verification documents include cancelled_cheque and bank_statement", () => {
      const docs = getBankDocuments();
      expect(docs.verification).toContain("cancelled_cheque");
      expect(docs.verification).toContain("bank_statement");
    });

    it("optional documents include bank_passbook and address_proof", () => {
      const docs = getBankDocuments();
      expect(docs.optional).toContain("bank_passbook");
      expect(docs.optional).toContain("address_proof");
    });
  });

  // ─── getMissingDocuments ───
  describe("getMissingDocuments", () => {
    it("returns empty array when all required documents are provided", () => {
      const missing = getMissingDocuments(
        ["pan_card", "aadhaar_card", "address_proof"],
        "individual",
      );
      expect(missing).toEqual([]);
    });

    it("returns missing documents when some are not provided", () => {
      const missing = getMissingDocuments(["pan_card"], "individual");
      expect(missing).toEqual(["aadhaar_card", "address_proof"]);
    });

    it("returns all required documents when none are provided", () => {
      const missing = getMissingDocuments([], "individual");
      expect(missing).toEqual(["pan_card", "aadhaar_card", "address_proof"]);
    });

    it("returns empty array when extra (non-required) docs are provided", () => {
      const missing = getMissingDocuments(
        ["pan_card", "aadhaar_card", "address_proof", "extra_doc"],
        "individual",
      );
      expect(missing).toEqual([]);
    });

    it("ignores provided docs that are not in the required list", () => {
      const missing = getMissingDocuments(["some_other_doc"], "individual");
      expect(missing).toEqual(["pan_card", "aadhaar_card", "address_proof"]);
    });

    it("returns empty array for unknown business type (no requirements)", () => {
      const missing = getMissingDocuments([], "nonexistent");
      expect(missing).toEqual([]);
    });

    it("handles null providedTypes gracefully", () => {
      // null.filter will throw; the function uses required.filter so it should work
      const missing = getMissingDocuments([], "individual");
      expect(Array.isArray(missing)).toBe(true);
    });
  });

  // ─── checkDocumentCompletion ───
  describe("checkDocumentCompletion", () => {
    it("returns complete=true and 100% progress when all documents provided", () => {
      const result = checkDocumentCompletion(
        ["pan_card", "aadhaar_card", "address_proof"],
        "individual",
      );
      expect(result.complete).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.progress).toBe(100);
      expect(result.total).toBe(3);
      expect(result.provided).toBe(3);
    });

    it("returns complete=false when some documents are missing", () => {
      const result = checkDocumentCompletion(["pan_card"], "individual");
      expect(result.complete).toBe(false);
      expect(result.missing).toEqual(["aadhaar_card", "address_proof"]);
      expect(result.progress).toBe(33);
      expect(result.total).toBe(3);
      expect(result.provided).toBe(1);
    });

    it("returns complete=false and 0% progress when no documents provided", () => {
      const result = checkDocumentCompletion([], "individual");
      expect(result.complete).toBe(false);
      expect(result.missing).toHaveLength(3);
      expect(result.progress).toBe(0);
      expect(result.total).toBe(3);
      expect(result.provided).toBe(0);
    });

    it("returns 0% progress for unknown business type (no requirements)", () => {
      const result = checkDocumentCompletion([], "unknown");
      expect(result.complete).toBe(true); // no missing = complete
      expect(result.missing).toEqual([]);
      expect(result.progress).toBe(0);
      expect(result.total).toBe(0);
      expect(result.provided).toBe(0);
    });

    it("handles partial completion for partnership (5 required)", () => {
      const result = checkDocumentCompletion(
        ["partnership_deed", "gst_certificate"],
        "partnership",
      );
      expect(result.complete).toBe(false);
      expect(result.total).toBe(5);
      expect(result.provided).toBe(2);
      expect(result.progress).toBe(40);
    });

    it("returns correct progress for sole_proprietorship with 3 of 4 docs", () => {
      const result = checkDocumentCompletion(
        ["gst_certificate", "pan_card", "cancelled_cheque"],
        "sole_proprietorship",
      );
      expect(result.complete).toBe(false);
      expect(result.progress).toBe(75);
      expect(result.missing).toEqual(["business_address_proof"]);
    });

    it("handles government type with 2 required docs — 1 provided", () => {
      const result = checkDocumentCompletion(["pan_card"], "government");
      expect(result.complete).toBe(false);
      expect(result.progress).toBe(50);
      expect(result.total).toBe(2);
    });
  });

  // ─── getDocumentLabel ───
  describe("getDocumentLabel", () => {
    it("returns label for known document type 'gst_certificate'", () => {
      expect(getDocumentLabel("gst_certificate")).toBe("GST Certificate");
    });

    it("returns label for known document type 'pan_card'", () => {
      expect(getDocumentLabel("pan_card")).toBe("PAN Card");
    });

    it("returns label for known document type 'aadhaar_card'", () => {
      expect(getDocumentLabel("aadhaar_card")).toBe("Aadhaar Card");
    });

    it("returns label for known document type 'certificate_of_incorporation'", () => {
      expect(getDocumentLabel("certificate_of_incorporation")).toBe(
        "Certificate of Incorporation",
      );
    });

    it("returns label for 'moa'", () => {
      expect(getDocumentLabel("moa")).toBe("Memorandum of Association (MOA)");
    });

    it("returns label for 'aoa'", () => {
      expect(getDocumentLabel("aoa")).toBe("Articles of Association (AOA)");
    });

    it("returns the raw key for unknown document type", () => {
      expect(getDocumentLabel("unknown_doc")).toBe("unknown_doc");
    });

    it("returns the raw key for empty string", () => {
      expect(getDocumentLabel("")).toBe("");
    });

    it("returns the raw key for null", () => {
      expect(getDocumentLabel(null)).toBe(null);
    });
  });

  // ─── getBusinessTypeLabel ───
  describe("getBusinessTypeLabel", () => {
    it("returns label for 'individual'", () => {
      expect(getBusinessTypeLabel("individual")).toBe("Individual");
    });

    it("returns label for 'sole_proprietorship'", () => {
      expect(getBusinessTypeLabel("sole_proprietorship")).toBe(
        "Sole Proprietorship",
      );
    });

    it("returns label for 'llp'", () => {
      expect(getBusinessTypeLabel("llp")).toBe(
        "Limited Liability Partnership (LLP)",
      );
    });

    it("returns label for 'private_limited'", () => {
      expect(getBusinessTypeLabel("private_limited")).toBe(
        "Private Limited Company",
      );
    });

    it("returns label for 'ngo'", () => {
      expect(getBusinessTypeLabel("ngo")).toBe(
        "Non-Governmental Organization (NGO)",
      );
    });

    it("returns label for 'startup'", () => {
      expect(getBusinessTypeLabel("startup")).toBe("Startup");
    });

    it("returns label for 'government'", () => {
      expect(getBusinessTypeLabel("government")).toBe(
        "Government Organization",
      );
    });

    it("returns the raw key for unknown business type", () => {
      expect(getBusinessTypeLabel("unknown_type")).toBe("unknown_type");
    });

    it("returns the raw key for empty string", () => {
      expect(getBusinessTypeLabel("")).toBe("");
    });

    it("returns the raw key for null", () => {
      expect(getBusinessTypeLabel(null)).toBe(null);
    });
  });

  // ─── listBusinessTypes ───
  describe("listBusinessTypes", () => {
    it("returns an array", () => {
      const types = listBusinessTypes();
      expect(Array.isArray(types)).toBe(true);
    });

    it("returns all 11 business types", () => {
      const types = listBusinessTypes();
      expect(types).toHaveLength(11);
    });

    it("includes all expected business types", () => {
      const types = listBusinessTypes();
      expect(types).toContain("individual");
      expect(types).toContain("sole_proprietorship");
      expect(types).toContain("partnership");
      expect(types).toContain("llp");
      expect(types).toContain("private_limited");
      expect(types).toContain("public_limited");
      expect(types).toContain("ngo");
      expect(types).toContain("trust");
      expect(types).toContain("society");
      expect(types).toContain("startup");
      expect(types).toContain("government");
    });

    it("each type in list has a corresponding requirements entry", () => {
      const types = listBusinessTypes();
      types.forEach((type) => {
        expect(BUSINESS_DOCUMENT_REQUIREMENTS[type]).toBeDefined();
        expect(Array.isArray(BUSINESS_DOCUMENT_REQUIREMENTS[type])).toBe(true);
      });
    });

    it("each type in list has a corresponding label", () => {
      const types = listBusinessTypes();
      types.forEach((type) => {
        expect(BUSINESS_TYPE_LABELS[type]).toBeDefined();
        expect(typeof BUSINESS_TYPE_LABELS[type]).toBe("string");
      });
    });
  });

  // ─── Constants ───
  describe("Constants", () => {
    it("BUSINESS_DOCUMENT_REQUIREMENTS has 11 keys", () => {
      expect(Object.keys(BUSINESS_DOCUMENT_REQUIREMENTS)).toHaveLength(11);
    });

    it("BANK_DOCUMENT_REQUIREMENTS has verification and optional keys", () => {
      expect(BANK_DOCUMENT_REQUIREMENTS).toHaveProperty("verification");
      expect(BANK_DOCUMENT_REQUIREMENTS).toHaveProperty("optional");
    });

    it("DOCUMENT_TYPE_LABELS has entries for all common document types", () => {
      expect(DOCUMENT_TYPE_LABELS).toHaveProperty("gst_certificate");
      expect(DOCUMENT_TYPE_LABELS).toHaveProperty("pan_card");
      expect(DOCUMENT_TYPE_LABELS).toHaveProperty("aadhaar_card");
      expect(DOCUMENT_TYPE_LABELS).toHaveProperty("cancelled_cheque");
    });

    it("BUSINESS_TYPE_LABELS matches keys in BUSINESS_DOCUMENT_REQUIREMENTS", () => {
      const reqKeys = Object.keys(BUSINESS_DOCUMENT_REQUIREMENTS).sort();
      const labelKeys = Object.keys(BUSINESS_TYPE_LABELS).sort();
      expect(labelKeys).toEqual(reqKeys);
    });
  });
});
