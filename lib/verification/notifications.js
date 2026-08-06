/**
 * Verification Notifications — Placeholder system.
 *
 * Event types:
 *   - submitted: verification submitted for review
 *   - approved: verification approved
 *   - rejected: verification rejected
 *   - expired: verification expired
 *   - expiring_soon: verification expiring within 30 days
 *   - level_changed: verification level changed
 *   - document_uploaded: document uploaded for review
 *   - document_verified: document approved
 *   - document_rejected: document rejected
 *   - Plus 18 Phase 3 events (session, OTP, OCR, selfie, review)
 *
 * Currently: logs via secureLogger and returns success.
 * Future: integrate with Resend (already installed) or similar.
 *
 * Security:
 *   - Never log or expose provider_reference, storage paths, or document metadata
 *   - All console.log replaced with structured secureLogger
 *   - Email addresses partially redacted in logs
 *   - Phone numbers never logged
 */

import { logInfo } from "./secureLogger";

// ─── Notification Event Types ───

export const NOTIFICATION_EVENTS = {
  // Phase 2 events
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
  EXPIRING_SOON: "expiring_soon",
  LEVEL_CHANGED: "level_changed",
  DOCUMENT_UPLOADED: "document_uploaded",
  DOCUMENT_VERIFIED: "document_verified",
  DOCUMENT_REJECTED: "document_rejected",
  // Phase 3 events
  SESSION_STARTED: "session_started",
  SESSION_RESUMED: "session_resumed",
  SESSION_COMPLETED: "session_completed",
  OTP_SENT: "otp_sent",
  OTP_VERIFIED: "otp_verified",
  OTP_FAILED: "otp_failed",
  AUTOMATIC_VALIDATION_STARTED: "automatic_validation_started",
  AUTOMATIC_VALIDATION_PASSED: "automatic_validation_passed",
  AUTOMATIC_VALIDATION_FAILED: "automatic_validation_failed",
  MANUAL_REVIEW_ASSIGNED: "manual_review_assigned",
  MANUAL_REVIEW_COMPLETED: "manual_review_completed",
  DEVICE_METADATA_CAPTURED: "device_metadata_captured",
  REVIEW_PRIORITY_CHANGED: "review_priority_changed",
  OCR_EXTRACTION_STARTED: "ocr_extraction_started",
  OCR_EXTRACTION_COMPLETED: "ocr_extraction_completed",
  SELFIE_CAPTURED: "selfie_captured",
  SELFIE_VALIDATION_PASSED: "selfie_validation_passed",
  SELFIE_VALIDATION_FAILED: "selfie_validation_failed",
};

// ─── Notification Log (in-memory, for debugging) ───

const notificationLog = [];
const MAX_LOG_SIZE = 100;

function logNotification(event, data) {
  const entry = {
    event,
    timestamp: new Date().toISOString(),
    email: data.email ? `${data.email.substring(0, 3)}***` : undefined,
  };
  notificationLog.push(entry);
  if (notificationLog.length > MAX_LOG_SIZE) {
    notificationLog.shift();
  }
  return entry;
}

/**
 * Get recent notification log (for debugging/admin).
 * Sanitized — no sensitive data.
 */
export function getNotificationLog() {
  return [...notificationLog];
}

// ─── Notification Functions ───

/**
 * Send verification submitted notification.
 *
 * @param {Object} params
 * @param {string} params.email — User's email
 * @param {string} params.fullName — User's full name
 * @param {string} params.verificationLevel — Current verification level label
 */
export async function notifyVerificationSubmitted({ email, fullName, verificationLevel }) {
  logNotification(NOTIFICATION_EVENTS.SUBMITTED, { email });

  logInfo("Notifications", "Verification Submitted", {
    level: verificationLevel,
  });

  // TODO: Implement email via Resend
  // await resend.emails.send({
  //   from: 'Fundora <notifications@fundora.app>',
  //   to: email,
  //   subject: 'Verification Submitted — Fundora',
  //   html: verificationSubmittedTemplate(fullName, verificationLevel),
  // });

  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.SUBMITTED };
}

/**
 * Send verification approved notification.
 *
 * @param {Object} params
 * @param {string} params.email — User's email
 * @param {string} params.fullName — User's full name
 * @param {number} params.newLevel — New verification level
 */
export async function notifyVerificationApproved({ email, fullName, newLevel }) {
  logNotification(NOTIFICATION_EVENTS.APPROVED, { email });

  logInfo("Notifications", "Verification Approved", {
    newLevel,
  });

  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.APPROVED };
}

/**
 * Send verification rejected notification.
 *
 * @param {Object} params
 * @param {string} params.email — User's email
 * @param {string} params.fullName — User's full name
 * @param {string} params.reason — Rejection reason
 */
export async function notifyVerificationRejected({ email, fullName, reason }) {
  logNotification(NOTIFICATION_EVENTS.REJECTED, { email });

  logInfo("Notifications", "Verification Rejected", {
    reason: reason ? reason.substring(0, 200) : undefined,
  });

  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.REJECTED };
}

/**
 * Send verification expired notification.
 *
 * @param {Object} params
 * @param {string} params.email — User's email
 * @param {string} params.fullName — User's full name
 */
export async function notifyVerificationExpired({ email, fullName }) {
  logNotification(NOTIFICATION_EVENTS.EXPIRED, { email });

  logInfo("Notifications", "Verification Expired", {});

  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.EXPIRED };
}

/**
 * Send verification expiring soon notification.
 *
 * @param {Object} params
 * @param {string} params.email — User's email
 * @param {string} params.fullName — User's full name
 * @param {number} params.daysUntilExpiry — Days until expiry
 */
export async function notifyVerificationExpiringSoon({ email, fullName, daysUntilExpiry }) {
  logNotification(NOTIFICATION_EVENTS.EXPIRING_SOON, { email });

  logInfo("Notifications", "Verification Expiring Soon", {
    daysUntilExpiry,
  });

  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.EXPIRING_SOON };
}

/**
 * Send verification level changed notification.
 *
 * @param {Object} params
 * @param {string} params.email — User's email
 * @param {string} params.fullName — User's full name
 * @param {number} params.oldLevel — Previous level
 * @param {number} params.newLevel — New level
 */
export async function notifyVerificationLevelChanged({ email, fullName, oldLevel, newLevel }) {
  logNotification(NOTIFICATION_EVENTS.LEVEL_CHANGED, { email });

  logInfo("Notifications", "Verification Level Changed", {
    oldLevel,
    newLevel,
  });

  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.LEVEL_CHANGED };
}

/**
 * Send document uploaded notification (admin review queue).
 *
 * @param {Object} params
 * @param {string} params.email — User's email
 * @param {string} params.fullName — User's full name
 * @param {string} params.documentType — Type of document uploaded
 */
export async function notifyDocumentUploaded({ email, fullName, documentType }) {
  logNotification(NOTIFICATION_EVENTS.DOCUMENT_UPLOADED, { email });

  logInfo("Notifications", "Document Uploaded", {
    documentType,
  });

  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.DOCUMENT_UPLOADED };
}

/**
 * Send document verified notification.
 *
 * @param {Object} params
 * @param {string} params.email — User's email
 * @param {string} params.fullName — User's full name
 * @param {string} params.documentType — Type of document verified
 */
export async function notifyDocumentVerified({ email, fullName, documentType }) {
  logNotification(NOTIFICATION_EVENTS.DOCUMENT_VERIFIED, { email });

  logInfo("Notifications", "Document Verified", {
    documentType,
  });

  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.DOCUMENT_VERIFIED };
}

/**
 * Send document rejected notification.
 *
 * @param {Object} params
 * @param {string} params.email — User's email
 * @param {string} params.fullName — User's full name
 * @param {string} params.documentType — Type of document rejected
 * @param {string} params.reason — Rejection reason
 */
export async function notifyDocumentRejected({ email, fullName, documentType, reason }) {
  logNotification(NOTIFICATION_EVENTS.DOCUMENT_REJECTED, { email });

  logInfo("Notifications", "Document Rejected", {
    documentType,
    reason: reason ? reason.substring(0, 200) : undefined,
  });

  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.DOCUMENT_REJECTED };
}

// ─── Phase 3 Notification Functions ───

/**
 * Send OTP sent notification.
 */
export async function notifyOTPSent({ email, phone }) {
  logNotification(NOTIFICATION_EVENTS.OTP_SENT, { email });
  logInfo("Notifications", "OTP Sent", {});
  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.OTP_SENT };
}

/**
 * Send OTP verified notification.
 */
export async function notifyOTPVerified({ email, phone }) {
  logNotification(NOTIFICATION_EVENTS.OTP_VERIFIED, { email });
  logInfo("Notifications", "OTP Verified", {});
  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.OTP_VERIFIED };
}

/**
 * Send OTP failed notification.
 */
export async function notifyOTPFailed({ email, phone, attemptsRemaining }) {
  logNotification(NOTIFICATION_EVENTS.OTP_FAILED, { email });
  logInfo("Notifications", "OTP Failed", { attemptsRemaining });
  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.OTP_FAILED };
}

/**
 * Send session started notification.
 */
export async function notifySessionStarted({ email, sessionId }) {
  logNotification(NOTIFICATION_EVENTS.SESSION_STARTED, { email });
  logInfo("Notifications", "Session Started", {});
  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.SESSION_STARTED };
}

/**
 * Send manual review assigned notification.
 */
export async function notifyManualReviewAssigned({ email, fullName, priority }) {
  logNotification(NOTIFICATION_EVENTS.MANUAL_REVIEW_ASSIGNED, { email });
  logInfo("Notifications", "Manual Review Assigned", { priority });
  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.MANUAL_REVIEW_ASSIGNED };
}

/**
 * Send manual review completed notification.
 */
export async function notifyManualReviewCompleted({ email, fullName, decision }) {
  logNotification(NOTIFICATION_EVENTS.MANUAL_REVIEW_COMPLETED, { email });
  logInfo("Notifications", "Manual Review Completed", { decision });
  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.MANUAL_REVIEW_COMPLETED };
}

/**
 * Send selfie captured notification.
 */
export async function notifySelfieCaptured({ email }) {
  logNotification(NOTIFICATION_EVENTS.SELFIE_CAPTURED, { email });
  logInfo("Notifications", "Selfie Captured", {});
  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.SELFIE_CAPTURED };
}

/**
 * Send selfie validation passed notification.
 */
export async function notifySelfieValidationPassed({ email }) {
  logNotification(NOTIFICATION_EVENTS.SELFIE_VALIDATION_PASSED, { email });
  logInfo("Notifications", "Selfie Validation Passed", {});
  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.SELFIE_VALIDATION_PASSED };
}

/**
 * Send selfie validation failed notification.
 */
export async function notifySelfieValidationFailed({ email, reason }) {
  logNotification(NOTIFICATION_EVENTS.SELFIE_VALIDATION_FAILED, { email });
  logInfo("Notifications", "Selfie Validation Failed", {
    reason: reason ? reason.substring(0, 200) : undefined,
  });
  return { success: true, channel: "console", event: NOTIFICATION_EVENTS.SELFIE_VALIDATION_FAILED };
}
