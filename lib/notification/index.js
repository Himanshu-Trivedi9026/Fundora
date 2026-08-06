/**
 * Notification Module — Barrel exports.
 *
 * Re-exports all notification functions for easy importing.
 *
 * Usage:
 *   import { createNotification, getNotifications } from "@/lib/notification";
 */

export {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  sendNotification,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  DIGEST_FREQUENCIES,
} from "./notificationEngine";
