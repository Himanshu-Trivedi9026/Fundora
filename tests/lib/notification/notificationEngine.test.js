/**
 * Notification Engine Tests — Unit tests for notification management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendNotification,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
} from "../../../lib/notification/notificationEngine";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

describe("NotificationEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNotification", () => {
    it("should create a notification", async () => {
      const mockNotif = {
        id: "notif-1",
        user_id: "user-1",
        notification_type: "donation_received",
        title: "New Donation",
        body: "You received a donation of ₹500",
        read: false,
      };

      supabaseAdmin.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockNotif, error: null }),
          }),
        }),
      });

      const result = await createNotification({
        userId: "user-1",
        notificationType: "donation_received",
        title: "New Donation",
        body: "You received a donation of ₹500",
      });

      expect(result.success).toBe(true);
    });

    it("writes only the live notifications columns (type/is_read/actor/entity)", async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "notif-2" }, error: null }),
        }),
      });

      supabaseAdmin.from.mockReturnValue({ insert: mockInsert });

      const result = await createNotification({
        userId: "user-2",
        notificationType: "new_follower",
        actorId: "actor-1",
        entityId: "entity-1",
      });

      expect(result.success).toBe(true);
      // The live `notifications` table uses type/is_read/actor_id/entity_id —
      // never the migration-007 columns (notification_type/title/body/read).
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-2",
        type: "new_follower",
        is_read: false,
        actor_id: "actor-1",
        entity_id: "entity-1",
      });
    });
  });

  describe("getNotifications", () => {
    it("should list notifications", async () => {
      // select("*", { count: "exact" }).eq(...).order(...).range(...)
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ data: [{ id: "notif-1" }], count: 1, error: null }),
          }),
        }),
      });

      const result = await getNotifications({ userId: "user-1", limit: 10, offset: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe("getUnreadCount", () => {
    it("should count unread notifications", async () => {
      // select("id", { count: "exact", head: true }).eq(...).eq(...).eq(...)
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
            }),
          }),
        }),
      });

      const result = await getUnreadCount("user-1");
      expect(result.success).toBe(true);
    });
  });

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      const mockNotif = { id: "notif-1", user_id: "user-1", read: false };

      // 1. Fetch notification: select("id, user_id").eq("id", notificationId).single()
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockNotif, error: null }),
            }),
          }),
        })
        // 2. Update notification: update({...}).eq("id", notificationId).select().single()
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { ...mockNotif, read: true }, error: null }),
              }),
            }),
          }),
        });

      const result = await markAsRead("notif-1", "user-1");
      expect(result.success).toBe(true);
    });
  });

  describe("markAllAsRead", () => {
    it("should mark all notifications as read", async () => {
      // update({ is_read: true }).eq("user_id", userId).eq("is_read", false).select("id")
      supabaseAdmin.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({ data: [{ id: "notif-1" }], error: null }),
            }),
          }),
        }),
      });

      const result = await markAllAsRead("user-1");
      expect(result.success).toBe(true);
    });
  });

  describe("deleteNotification", () => {
    it("hard-deletes the owner's notification", async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // 1. Fetch: select("id, user_id").eq("id", id).single()
      // 2. Delete: delete().eq("id", id)
      supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "notif-1", user_id: "user-1" }, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          delete: mockDelete,
        });

      const result = await deleteNotification("notif-1", "user-1");
      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("refuses to delete another user's notification", async () => {
      // The ownership check returns BEFORE the delete is called, so the
      // fetch is the only from() call made. Use mockReturnValue (not Once)
      // so no queued value leaks into the next test.
      supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "notif-1", user_id: "owner-2" }, error: null }),
          }),
        }),
      });

      const result = await deleteNotification("notif-1", "user-1");
      expect(result.success).toBe(false);
      expect(result.error).toContain("only delete your own");
    });
  });

  describe("sendNotification", () => {
    it("creates a single in-app notification on the live schema", async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "notif-sent" }, error: null }),
        }),
      });

      supabaseAdmin.from.mockReturnValue({ insert: mockInsert });

      const result = await sendNotification({
        userId: "user-1",
        notificationType: "donation_received",
        actorId: "actor-1",
        entityId: "entity-1",
      });

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-1",
        type: "donation_received",
        is_read: false,
        actor_id: "actor-1",
        entity_id: "entity-1",
      });
    });
  });

  describe("constants", () => {
    it("should have notification types", () => {
      expect(NOTIFICATION_TYPES).toBeDefined();
    });

    it("should have notification channels", () => {
      expect(NOTIFICATION_CHANNELS).toBeDefined();
    });
  });
});
