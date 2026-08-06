// CDN & Storage — barrel exports

export {
  storageAdapter,
  default as defaultStorageAdapter,
} from "./storageAdapter.js";

export {
  BaseStorageProvider,
  LocalProvider,
  S3CompatibleProvider,
  GCSProvider,
  SupabaseStorageProvider,
  registerDefaultProviders,
} from "./providerAdapter.js";

export {
  generateSignedUrl,
  generateUploadUrl,
  generateBatchSignedUrls,
  validateSignedUrl,
  revokeSignedUrl,
} from "./signedUrlEngine.js";

export {
  buildTransformUrl,
  getOptimizedSrcSet,
  estimateFileSize,
  validateImageDimensions,
  FORMATS,
  FIT_MODES,
} from "./imageOptimizer.js";
