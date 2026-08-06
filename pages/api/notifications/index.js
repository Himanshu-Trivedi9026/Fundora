/**
 * Notifications API — User notifications center.
 *
 * GET — Get user's notifications with unread count
 * POST — Mark read, mark all read
 * DELETE — Delete a notification
 */

import { withAuth } from "../../../lib/withAuth";
import { rateLimit } from "../../../lib/rateLimit";
import { logError } from "../../../lib/verification/secureLogger";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../../../lib/notification/notificationEngine";

const rl = rateLimit({ windowMs: 60_000, max: 10 });

export default withAuth(async function handler(req, res, user) {
  if (req.method === "GET") {
    if (!rl(req, res)) return;

    try {
      const { notificationType, read, channel, limit, offset } = req.query;

      const notifications = await getNotifications({
        userId: user.id,
        notificationType,
        read: read !== undefined ? read === "true" : undefined,
        channel,
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
      });

      const unread = await getUnreadCount(user.id);

      if (!notifications.success) {
        return res.status(500).json({ error: notifications.error || "Failed to fetch notifications" });
      }

      return res.status(200).json({
        success: true,
        notifications: notifications.data,
        total: notifications.total,
        unreadCount: unread.success ? unread.data : 0,
      });
    } catch (err) {
      logError("NotificationsAPI", "GET error", { error: err.message });
      return res.status(500).json({ error: "Failed to fetch notifications" });
    }
  }

  if (req.method === "POST") {
    if (!rl(req, res)) return;

    try {
      const { action, notificationId } = req.body;

      if (action === "mark_read") {
        if (!notificationId) return res.status(400).json({ error: "notificationId is required" });
        const result = await markAsRead(notificationId, user.id);
        if (!result.success) return res.status(400).json({ error: result.error });
        return res.status(200).json({ success: true, data: result.data });
      }

      if (action === "mark_all_read") {
        const result = await markAllAsRead(user.id);
        if (!result.success) return res.status(400).json({ error: result.error });
        return res.status(200).json({ success: true, message: "All notifications marked as read" });
      }

      return res.status(400).json({ error: "Invalid action" });
    } catch (err) {
      logError("NotificationsAPI", "POST error", { error: err.message });
      return res.status(500).json({ error: "Failed to process request" });
    }
  }

  if (req.method === "DELETE") {
    if (!rl(req, res)) return;

    try {
      const { notificationId } = req.query;
      if (!notificationId) return res.status(400).json({ error: "notificationId is required" });
      const result = await deleteNotification(notificationId, user.id);
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, message: "Notification deleted" });
    } catch (err) {
      logError("NotificationsAPI", "DELETE error", { error: err.message });
      return res.status(500).json({ error: "Failed to delete notification" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
});
