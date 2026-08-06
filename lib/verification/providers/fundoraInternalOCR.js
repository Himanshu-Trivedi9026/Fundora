/**
 * FundoraInternalOCRProvider — Default OCR provider (console-log stub).
 *
 * Returns mock extraction results. Used for development and as fallback.
 * Production: replace with actual OCR service integration.
 */

import OCRProvider from "../ocrProvider";
import { logInfo } from "../secureLogger";

export default class FundoraInternalOCRProvider extends OCRProvider {
  constructor(config = {}) {
    super({ providerName: "fundora_internal", ...config });
  }

  async initialize() {
    logInfo("[FundoraInternalOCR] Initialized (mock mode)");
    return { success: true };
  }

  async extractText(documentBuffer, options = {}) {
    logInfo("[FundoraInternalOCR] extractText:", {
      documentType: options.documentType,
      mimeType: options.mimeType,
    });

    // Mock extraction — returns placeholder fields based on document type
    const mockFields = getMockFields(options.documentType);

    return {
      success: true,
      text: `Mock OCR text for ${options.documentType || "unknown document"}`,
      fields: mockFields,
      confidence: 0.95,
    };
  }

  async validateDocumentFields(extractedData, documentType) {
    logInfo("[FundoraInternalOCR] validateDocumentFields:", {
      documentType,
      fieldsCount: extractedData ? Object.keys(extractedData).length : 0,
    });

    // Mock validation — always passes
    return {
      valid: true,
      validatedFields: extractedData || {},
      errors: [],
      confidence: 0.95,
    };
  }

  async compareFaces(selfieBuffer, idPhotoBuffer) {
    logInfo("[FundoraInternalOCR] compareFaces: mock comparison");

    // Mock face comparison — always matches
    return {
      success: true,
      match: true,
      confidence: 0.98,
    };
  }

  async getOCRStatus(requestId) {
    logInfo("[FundoraInternalOCR] getOCRStatus:", requestId);

    // Mock status — always completed
    return {
      status: "completed",
      result: { mock: true },
    };
  }

  mapOCRResult(rawResult) {
    return {
      fields: rawResult?.fields || {},
      confidence: rawResult?.confidence || 0,
      provider: this.providerName,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Mock Data ───

function getMockFields(documentType) {
  const mockData = {
    pan_card: {
      name: "XXXXX1234X",
      pan_number: "ABCDE1234F",
      date_of_birth: "01/01/1990",
      father_name: "XXXXX XXXXX",
    },
    aadhaar_card: {
      name: "XXXXX XXXXX",
      aadhaar_number: "XXXX XXXX 1234",
      date_of_birth: "01/01/1990",
      gender: "Male",
    },
    passport: {
      name: "XXXXX XXXXX",
      passport_number: "A1234567",
      date_of_birth: "01/01/1990",
      expiry_date: "01/01/2030",
      nationality: "Indian",
    },
    driving_license: {
      name: "XXXXX XXXXX",
      dl_number: "XX-12-XXXX-1234567",
      date_of_birth: "01/01/1990",
      validity: "01/01/2030",
    },
    voter_id: {
      name: "XXXXX XXXXX",
      voter_id_number: "ABC1234567",
      age: "35",
      gender: "Male",
    },
    business_registration: {
      company_name: "XXXXX XXXXX",
      registration_number: "U12345XX2020PTC123456",
      date_of_incorporation: "01/01/2020",
    },
    gst_certificate: {
      gstin: "22AAAAA0000A1Z5",
      trade_name: "XXXXX XXXXX",
      registration_date: "01/01/2020",
    },
    bank_statement: {
      account_holder: "XXXXX XXXXX",
      account_number: "XXXXXXXX1234",
      bank_name: "XXXXX Bank",
      statement_period: "01/01/2026 - 31/01/2026",
    },
    bank_passbook: {
      account_holder: "XXXXX XXXXX",
      account_number: "XXXXXXXX1234",
      bank_name: "XXXXX Bank",
    },
    selfie: {
      face_detected: true,
      liveness_score: 0.98,
    },
    utility_bill: {
      name: "XXXXX XXXXX",
      address: "XXXXX XXXXX",
      bill_date: "01/01/2026",
    },
  };

  return mockData[documentType] || { generic: "mock_data" };
}
