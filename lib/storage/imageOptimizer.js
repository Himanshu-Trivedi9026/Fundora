// Image Optimizer — image processing and optimization
// Handles resize, format conversion, compression, and transformation URLs

export const FORMATS = {
  ORIGINAL: "original",
  WEBP: "webp",
  AVIF: "avif",
  JPEG: "jpeg",
  PNG: "png",
};

export const FIT_MODES = {
  COVER: "cover",
  CONTAIN: "contain",
  FILL: "fill",
  INSIDE: "inside",
  OUTSIDE: "outside",
};

export function buildTransformUrl(originalUrl, options = {}) {
  try {
    if (!originalUrl) return { success: false, error: "No URL provided" };

    const {
      width = null,
      height = null,
      format = FORMATS.ORIGINAL,
      quality = 80,
      fit = FIT_MODES.COVER,
      sharpen = 0,
      blur = 0,
    } = options;

    // Build transform params
    const params = new URLSearchParams();

    if (width) params.set("w", String(width));
    if (height) params.set("h", String(height));
    if (format !== FORMATS.ORIGINAL) params.set("fm", format);
    if (quality !== 80) params.set("q", String(quality));
    if (fit !== FIT_MODES.COVER) params.set("fit", fit);
    if (sharpen > 0) params.set("sharp", String(sharpen));
    if (blur > 0) params.set("blur", String(blur));

    const transformedUrl = params.toString()
      ? `${originalUrl}?${params.toString()}`
      : originalUrl;

    return {
      success: true,
      data: {
        url: transformedUrl,
        options,
        transforms: Object.fromEntries(params.entries()),
      },
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function getOptimizedSrcSet(baseUrl, widths = [320, 640, 960, 1280, 1920], options = {}) {
  try {
    const srcSet = widths
      .map((w) => {
        const result = buildTransformUrl(baseUrl, { ...options, width: w });
        return result.success ? `${result.data.url} ${w}w` : null;
      })
      .filter(Boolean)
      .join(", ");

    return { success: true, data: { srcSet, widths } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function estimateFileSize(width, height, format = FORMATS.JPEG, quality = 80) {
  const pixels = width * height;

  // Rough byte estimates per pixel by format
  const bytesPerPixel = {
    [FORMATS.JPEG]: 0.3 * (quality / 80),
    [FORMATS.WEBP]: 0.2 * (quality / 80),
    [FORMATS.AVIF]: 0.15 * (quality / 80),
    [FORMATS.PNG]: 0.8,
    [FORMATS.ORIGINAL]: 0.5,
  };

  const bpp = bytesPerPixel[format] || 0.5;
  const estimatedBytes = Math.round(pixels * bpp);

  return {
    success: true,
    data: {
      bytes: estimatedBytes,
      kilobytes: Math.round(estimatedBytes / 1024),
      megabytes: parseFloat((estimatedBytes / (1024 * 1024)).toFixed(2)),
      width,
      height,
      format,
      quality,
    },
  };
}

export function validateImageDimensions(width, height) {
  const maxDimension = 10000;
  const minDimension = 1;

  if (width < minDimension || height < minDimension) {
    return { valid: false, reason: "Dimensions must be positive" };
  }
  if (width > maxDimension || height > maxDimension) {
    return { valid: false, reason: `Max dimension is ${maxDimension}px` };
  }
  if (width * height > 50000000) {
    return { valid: false, reason: "Image exceeds 50MP limit" };
  }

  return { valid: true };
}
