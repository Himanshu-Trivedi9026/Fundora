import { useEffect } from "react";

/**
 * DeviceMetadataCollector — Device info collection placeholder.
 *
 * Collects: browser, OS, screen, timezone, language.
 * Stores in session metadata (never displayed to user).
 * Returns metadata object via onMetadata callback.
 */
export default function DeviceMetadataCollector({ onMetadata }) {
  useEffect(() => {
    const metadata = collectMetadata();
    onMetadata?.(metadata);
  }, [onMetadata]);

  return null; // Renderless component
}

/**
 * Collects device metadata from the browser environment.
 * @returns {Object} Device metadata (never includes PII)
 */
export function collectMetadata() {
  const nav = typeof window !== "undefined" ? window.navigator : {};

  return {
    browser: {
      name: getBrowserName(nav),
      userAgent: nav.userAgent || "unknown",
      language: nav.language || "unknown",
      languages: nav.languages?.slice(0, 3) || [],
      cookieEnabled: nav.cookieEnabled ?? false,
      doNotTrack: nav.doNotTrack ?? null,
    },
    os: {
      name: getOSName(nav),
      platform: nav.platform || "unknown",
    },
    screen: {
      width: typeof window !== "undefined" ? window.screen?.width : 0,
      height: typeof window !== "undefined" ? window.screen?.height : 0,
      colorDepth: typeof window !== "undefined" ? window.screen?.colorDepth : 0,
      pixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    },
    timezone: {
      name: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      offset: new Date().getTimezoneOffset(),
    },
    capabilities: {
      webGL: !!getWebGLContext(),
      canvas: !!document.createElement("canvas").getContext,
      touch: typeof window !== "undefined" && "ontouchstart" in window,
    },
    collectedAt: new Date().toISOString(),
  };
}

function getBrowserName(nav) {
  const ua = nav.userAgent || "";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Unknown";
}

function getOSName(nav) {
  const ua = nav.userAgent || "";
  if (ua.includes("Win")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad"))
    return "iOS";
  return "Unknown";
}

function getWebGLContext() {
  try {
    const canvas = document.createElement("canvas");
    return (
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    );
  } catch {
    return null;
  }
}
