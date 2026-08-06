# Milestone System

## Overview

The Milestone System manages campaign milestones, creator submissions, and donor reviews. It provides a transparent funding checkpoint mechanism with community-driven approval.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Milestone System                   │
├─────────────────────────────────────────────────┤
│  milestoneEngine.js    │ Milestone CRUD & Status │
│  milestoneSubmission.js│ Creator Submissions     │
│  milestoneReview.js    │ Donor Reviews & Voting  │
└─────────────────────────────────────────────────┘
```

## Milestone Lifecycle

```
draft → active → submitted → approved → completed
                    ↓
                  rejected → active (resubmit)
                    ↓
                  cancelled
```

## Key Functions

### `createMilestone({ campaignId, creatorId, title, description, targetAmount, targetDate, releaseAmount, sortOrder, autoApproveThreshold })`

Creates a new milestone for a campaign.

**Parameters:**
- `campaignId` (string, required) — Campaign ID
- `creatorId` (string, required) — Creator ID
- `title` (string, required) — Milestone title
- `description` (string, optional) — Description
- `targetAmount` (number, required) — Target funding amount
- `targetDate` (string, optional) — Target completion date
- `releaseAmount` (number, optional) — Amount to release on approval
- `sortOrder` (number, default: 0) — Display order
- `autoApproveThreshold` (number, default: 80) — Auto-approval percentage

**Returns:** `{ success: boolean, data?: Object, error?: string }`

### `activateMilestone(milestoneId, creatorId)`

Activates a draft milestone (draft → active).

### `getMilestone(milestoneId)`

Fetches a milestone by ID with its reviews.

### `getCampaignMilestones(campaignId)`

Fetches all milestones for a campaign.

### `getCreatorMilestones(creatorId)`

Fetches all milestones across campaigns for a creator.

### `updateMilestone(milestoneId, creatorId, updates)`

Updates a milestone (only draft status allowed).

### `cancelMilestone(milestoneId, creatorId)`

Cancels a milestone (draft or active status).

### `getMilestoneStats(campaignId)`

Returns aggregated stats for a campaign's milestones.

### `checkAutoApproval(milestoneId)`

Checks if a milestone meets the auto-approval threshold.

## Review System

### `createReview({ milestoneId, reviewerId, decision, comment, voteWeight, donationAmount, submissionId })`

Creates a review for a milestone.

**Parameters:**
- `milestoneId` (string, required) — Milestone ID
- `reviewerId` (string, required) — Reviewer (donor) ID
- `decision` (string, required) — 'approve', 'reject', or 'abstain'
- `comment` (string, optional) — Review comment
- `voteWeight` (number, default: 1) — Weight of this vote
- `donationAmount` (number, default: 0) — Donation amount for weight calculation

**Returns:** `{ success: boolean, data?: Object, error?: string }`

### `getMilestoneReviews(milestoneId)`

Fetches all reviews for a milestone.

### `getReviewStats(milestoneId)`

Returns aggregated review stats (approval percentage, total votes).

### `getUserReview(milestoneId, reviewerId)`

Checks if a user has already reviewed a milestone.

### `updateReview(reviewId, reviewerId, updates)`

Updates a review (only own review allowed).

### `deleteReview(reviewId, reviewerId)`

Deletes a review (only own review allowed).

## Approval Calculation

After every review create, update, or delete, the system recalculates:

1. **Approval Percentage** = (approveWeight / (approveWeight + rejectWeight)) × 100
2. **Total Reviews** = count of all reviews
3. **Approval Count** = count of approve decisions
4. **Rejection Count** = count of reject decisions

## Auto-Approval

A milestone qualifies for auto-approval when:
- Status is `submitted`
- Total reviews > 0
- Approval percentage ≥ auto_approve_threshold (default: 80%)

## Usage Example

```javascript
import { createMilestone, activateMilestone, createReview } from "../lib/milestone";

// Create milestone
const milestone = await createMilestone({
  campaignId: "campaign-123",
  creatorId: "user-456",
  title: "Phase 1: Design",
  description: "Complete UI/UX design",
  targetAmount: 50000,
  releaseAmount: 25000,
});

// Activate milestone
await activateMilestone(milestone.data.id, "user-456");

// Donor reviews milestone
const review = await createReview({
  milestoneId: milestone.data.id,
  reviewerId: "donor-789",
  decision: "approve",
  comment: "Great progress on the design!",
  voteWeight: 3,
  donationAmount: 5000,
});
```

## Security

- Creators can only modify their own milestones
- Reviewers can only modify/delete their own reviews
- One review per user per milestone (enforced at app + DB level)
- All transitions are audit-logged
- Uses `secureLogger` for all logging
