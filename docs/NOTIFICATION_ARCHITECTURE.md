# Notification Architecture

## Overview

The Notification System provides in-app notification management with multi-channel delivery (in-app, email, SMS, push), user-controlled preferences, and a platform intelligence analytics engine for monitoring platform health.

## Architecture

```
┌─────────────────────────────────────────────────┐
│            Notification System                   │
├─────────────────────────────────────────────────┤
│  notificationEngine.js   │ CRUD & Delivery       │
│  index.js                │ Barrel Exports        │
├─────────────────────────────────────────────────┤
│  Channels: in_app | email | sms | push           │
│  Preferences: per-user, per-type, digest         │
└─────────────────────────────────────────────────┘
```

## Notification Lifecycle

```
created → read → archived (soft-deleted)
```

Notifications are soft-deleted (not hard-deleted) for auditability.

## Notification Types

| Constant | Value | Domain |
|----------|-------|--------|
| `CAMPAIGN_CREATED` | `"campaign_created"` | Campaign lifecycle |
| `CAMPAIGN_FUNDED` | `"campaign_funded"` | Campaign lifecycle |
| `CAMPAIGN_COMPLETED` | `"campaign_completed"` | Campaign lifecycle |
| `CAMPAIGN_FAILED` | `"campaign_failed"` | Campaign lifecycle |
| `DONATION_RECEIVED` | `"donation_received"` | Donations |
| `DONATION_FAILED` | `"donation_failed"` | Donations |
| `MILESTONE_SUBMITTED` | `"milestone_submitted"` | Milestones |
| `MILESTONE_APPROVED` | `"milestone_approved"` | Milestones |
| `MILESTONE_REJECTED` | `"milestone_rejected"` | Milestones |
| `ESCROW_FUNDED` | `"escrow_funded"` | Escrow |
| `ESCROW_RELEASED` | `"escrow_released"` | Escrow |
| `ESCROW_REFUNDED` | `"escrow_refunded"` | Escrow |
| `PAYOUT_REQUESTED` | `"payout_requested"` | Payouts |
| `PAYOUT_COMPLETED` | `"payout_completed"` | Payouts |
| `PAYOUT_FAILED` | `"payout_failed"` | Payouts |
| `VERIFICATION_COMPLETED` | `"verification_completed"` | Verification |
| `VERIFICATION_FAILED` | `"verification_failed"` | Verification |
| `APPEAL_SUBMITTED` | `"appeal_submitted"` | Appeals |
| `APPEAL_DECIDED` | `"appeal_decided"` | Appeals |
| `FRAUD_ALERT` | `"fraud_alert"` | Security |
| `COMPLIANCE_ALERT` | `"compliance_alert"` | Security |
| `SYSTEM_ANNOUNCEMENT` | `"system_announcement"` | System |
| `TRUST_SCORE_UPDATED` | `"trust_score_updated"` | Trust |
| `ACCOUNT_SUSPENDED` | `"account_suspended"` | Account |
| `ACCOUNT_REACTIVATED` | `"account_reactivated"` | Account |

## Channels

| Channel | Description |
|---------|-------------|
| `in_app` | In-app notification (always enabled) |
| `email` | Email delivery |
| `sms` | SMS delivery |
| `push` | Push notification |

## Digest Frequencies

| Frequency | Description |
|-----------|-------------|
| `realtime` | Send immediately (default) |
| `hourly` | Batched hourly |
| `daily` | Batched daily |
| `weekly` | Batched weekly |
| `never` | Do not send digest notifications |

## Key Functions

### `createNotification({ userId, notificationType, title, body, data, channel, metadata })`

Creates a single notification.

**Parameters:**
- `userId` (string, required) — Target user ID
- `notificationType` (string, required) — Type from NOTIFICATION_TYPES
- `title` (string, required) — Notification title
- `body` (string, required) — Notification body text
- `data` (object, default: {}) — Additional data payload
- `channel` (string, default: "in_app") — Delivery channel
- `metadata` (object, default: {}) — Extra metadata

**Returns:** `{ success: boolean, data?: Object, error?: string }`

### `getNotifications({ userId, notificationType, read, channel, limit, offset })`

Queries notifications with filters. Excludes soft-deleted notifications.

### `getUnreadCount(userId)`

Returns the count of unread, non-deleted notifications.

### `markAsRead(notificationId, userId)`

Marks a single notification as read. Ownership check: `userId` must match notification owner.

### `markAllAsRead(userId)`

Marks all of a user's unread notifications as read. Returns count of updated notifications.

### `deleteNotification(notificationId, userId)`

Soft-deletes a notification (sets `deleted: true`). Ownership check enforced.

### `sendNotification({ userId, notificationType, title, body, data, channels })`

Sends a notification across configured channels. Always creates an in-app notification. Email/SMS/Push are sent based on user's notification preferences.

**Channel Resolution Logic:**
1. Load user preferences
2. Check global channel enable/disable (`email_enabled`, `sms_enabled`, `push_enabled`)
3. Check type-specific preferences (`notification_types[type].email`, etc.)
4. Always include `in_app` even if not requested

## Delivery Preferences

### Default Preferences

```javascript
{
  email_enabled: true,
  sms_enabled: false,
  push_enabled: true,
  in_app_enabled: true,
  digest_frequency: "realtime",
  notification_types: {
    campaign_created:    { email: true,  sms: false, push: true,  in_app: true },
    campaign_funded:     { email: true,  sms: false, push: true,  in_app: true },
    donation_received:   { email: true,  sms: false, push: true,  in_app: true },
    milestone_submitted: { email: true,  sms: false, push: true,  in_app: true },
    milestone_approved:  { email: true,  sms: true,  push: true,  in_app: true },
    milestone_rejected:  { email: true,  sms: true,  push: true,  in_app: true },
    escrow_released:     { email: true,  sms: false, push: true,  in_app: true },
    payout_completed:    { email: true,  sms: false, push: true,  in_app: true },
    fraud_alert:         { email: true,  sms: true,  push: true,  in_app: true },
    system_announcement: { email: true,  sms: false, push: true,  in_app: true },
  }
}
```

**Key design decisions:**
- SMS is off by default globally but enabled for critical events (milestone approved/rejected, fraud alerts)
- IN_APP is always force-enabled — even if a user disables it, `sendNotification` appends it back
- Preferences are stored in `notification_preferences` table, scoped per `user_id`
- Default preferences auto-created on first access

### `getNotificationPreferences(userId)`

Returns user's notification preferences. Creates defaults if none exist.

### `updateNotificationPreferences(userId, preferences)`

Updates user's notification preferences via upsert. Logged as audit event `notification.preferences_updated`.

## Database Schema

### Notifications Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Target user (FK → auth.users) |
| `notification_type` | TEXT | Notification type |
| `title` | TEXT | Title |
| `body` | TEXT | Body text |
| `data` | JSONB | Additional payload |
| `read` | BOOLEAN | Read status |
| `read_at` | TIMESTAMPTZ | When marked as read |
| `channel` | TEXT | Delivery channel |
| `sent_via` | TEXT[] | Channels sent via |
| `delivered` | BOOLEAN | Delivery status |
| `delivered_at` | TIMESTAMPTZ | When delivered |
| `metadata` | JSONB | Extra metadata |

### Notification Preferences Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner (unique) |
| `email_enabled` | BOOLEAN | Global email toggle |
| `sms_enabled` | BOOLEAN | Global SMS toggle |
| `push_enabled` | BOOLEAN | Global push toggle |
| `in_app_enabled` | BOOLEAN | Global in-app toggle |
| `email_addresses` | TEXT[] | Email addresses |
| `phone_numbers` | TEXT[] | Phone numbers |
| `quiet_hours_start` | TIME | Quiet hours begin |
| `quiet_hours_end` | TIME | Quiet hours end |
| `timezone` | TEXT | User timezone |
| `digest_frequency` | TEXT | Digest frequency |
| `category_preferences` | JSONB | Per-category settings |

## Platform Intelligence

The platform intelligence engine (`lib/platformIntelligence/`) provides analytics for monitoring platform health:

| Function | Description |
|----------|-------------|
| `calculatePlatformHealth()` | Composite health score (0–100) |
| `calculateTrustDistribution()` | Trust score histogram |
| `getFraudTrends()` | Fraud alerts over time |
| `getEscrowStats()` | Escrow utilization metrics |
| `getMilestoneCompletionStats()` | Milestone completion rates |
| `getPayoutSuccessStats()` | Payout processing metrics |
| `getUserGrowthStats()` | User growth over time |
| `getCampaignPerformanceStats()` | Campaign funnel metrics |
| `getVerificationStats()` | KYC/verification metrics |
| `getEngagementMetrics()` | Engagement KPIs |
| `getModerationStats()` | Moderation queue metrics |
| `storeMetric()` / `getStoredMetrics()` | Metric persistence |

## Usage Example

```javascript
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  sendNotification,
} from "../lib/notification";

// Create a direct notification
await createNotification({
  userId: "user-123",
  notificationType: "donation_received",
  title: "New Donation!",
  body: "You received a $50.00 donation for your campaign.",
  data: { campaignId: "campaign-456", amount: 5000 },
});

// Send across all configured channels
await sendNotification({
  userId: "user-123",
  notificationType: "fraud_alert",
  title: "Security Alert",
  body: "Suspicious activity detected on your account.",
  channels: ["in_app", "email", "push"],
});

// Check unread count
const count = await getUnreadCount("user-123");
console.log("Unread:", count.data); // e.g., 5

// Fetch notifications
const notifs = await getNotifications({
  userId: "user-123",
  read: false,
  limit: 10,
});

// Mark as read
await markAsRead(notifs.data[0].id, "user-123");
```

## Security

- Notifications are user-scoped — users can only view, mark-read, and delete their own notifications
- Ownership enforced at application level (`existing.user_id !== userId` check)
- Unauthorized access attempts are logged as warnings
- Preferences are user-controlled — users can enable/disable channels and per-type delivery
- IN_APP channel is force-enabled to ensure users always see in-app notifications
- All preference updates are audit-logged
- RLS policies: owner SELECT/UPDATE for notifications and preferences; service role for all operations
- Uses `secureLogger` for all logging
- Uses `supabaseAdmin` for all DB operations
