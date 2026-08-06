/**
 * OCRProvider — Abstract base class for OCR/document extraction providers.
 *
 * Subclasses must implement all abstract methods.
 * Used for: text extraction from documents, field validation, face comparison.
 *
 * Provider hierarchy:
 *   OCRProvider (abstract)
 *     └── FundoraInternalOCR (default, console-log stub)
 *     └── StripeIdentityOCR (future)
 *     └── HyperVergeOCR (future)
 *     └── SignzyOCR (future)
 *     └── OnfidoOCR (future)
 *     └── PersonaOCR (future)
 */

export default class OCRProvider {
  /**
   * @param {Object} config
   * @param {string} config.providerName — Provider identifier
   * @param {string} [config.apiKey] — API key (server-side only)
   * @param {string} [config.baseUrl] — API base URL
   */
  constructor(config = {}) {
    if (new.target === OCRProvider) {
      throw new Error("OCRProvider is abstract and cannot be instantiated directly");
    }
    this.providerName = config.providerName || "unknown";
    this.apiKey = config.apiKey || null;
    this.baseUrl = config.baseUrl || null;
  }

  /**
   * Initialize the provider (validate config, test connectivity).
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async initialize() {
    throw new Error("initialize() must be implemented by subclass");
  }

  /**
   * Extract text from a document image/PDF.
   *
   * @param {Buffer|ArrayBuffer|Uint8Array} documentBuffer — Document content
   * @param {Object} options
   * @param {string} options.documentType — Document type (pan_card, aadhaar, etc.)
   * @param {string} options.mimeType — MIME type of the document
   * @returns {Promise<{success: boolean, text?: string, fields?: Object, confidence?: number, error?: string}>}
   */
  async extractText(documentBuffer, options = {}) {
    throw new Error("extractText() must be implemented by subclass");
  }

  /**
   * Validate extracted document fields against expected format.
   *
   * @param {Object} extractedData — Data from extractText()
   * @param {string} documentType — Document type
   * @returns {Promise<{valid: boolean, validatedFields?: Object, errors?: string[], confidence?: number}>}
   */
  async validateDocumentFields(extractedData, documentType) {
    throw new Error("validateDocumentFields() must be implemented by subclass");
  }

  /**
   * Compare faces between a selfie and ID photo.
   *
   * @param {Buffer|ArrayBuffer|Uint8Array} selfieBuffer
   * @param {Buffer|ArrayBuffer|Uint8Array} idPhotoBuffer
   * @returns {Promise<{success: boolean, match?: boolean, confidence?: number, error?: string}>}
   */
  async compareFaces(selfieBuffer, idPhotoBuffer) {
    throw new Error("compareFaces() must be implemented by subclass");
  }

  /**
   * Get the status of an OCR processing request.
   *
   * @param {string} requestId — Provider's request ID
   * @returns {Promise<{status: 'processing'|'completed'|'failed', result?: Object, error?: string}>}
   */
  async getOCRStatus(requestId) {
    throw new Error("getOCRStatus() must be implemented by subclass");
  }

  /**
   * Map a provider-specific OCR result to a normalized format.
   *
   * @param {Object} rawResult — Provider's raw response
   * @returns {Object} Normalized result with fields, confidence, etc.
   */
  mapOCRResult(rawResult) {
    throw new Error("mapOCRResult() must be implemented by subclass");
  }
}
