# Reputation Engine

## Overview

The Reputation Engine calculates weighted composite reputation scores for creators, donors, and campaigns. It uses multi-dimensional scoring across behavioral and performance metrics, with penalty support and a public leaderboard.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Reputation Engine                   │
├─────────────────────────────────────────────────┤
│  reputationEngine.js │ Score Calculation         │
│  index.js            │ Barrel Exports            │
├─────────────────────────────────────────────────┤
│  Score Dimensions:                               │
│  Creator  → 6 dimensions (quality, reliability)  │
│  Donor    → 4 dimensions (engagement, generosity)│
│  Campaign → 6 dimensions (funding, milestones)   │
└─────────────────────────────────────────────────┘
```

## Scoring Model

All scores are **0–100 composite** with a weighted formula:

```
overallScore = Σ(dimensionScore × weight) / Σ(weight)   // clamped 0–100, rounded
```

## Creator Reputation

| Dimension       | Weight | Label           | Calculation                                             |
| --------------- | ------ | --------------- | ------------------------------------------------------- |
| `quality`       | 0.25   | Content Quality | fundingRate × 50 + milestoneRate × 50 (default: 30)     |
| `reliability`   | 0.20   | Reliability     | completionRate × 60 + activityRate × 40 (default: 25)   |
| `communication` | 0.15   | Communication   | positiveReviewRate × 100 (default: 40/30)               |
| `transparency`  | 0.15   | Transparency    | documentedMilestoneRate × 100 (default: 35/30)          |
| `community`     | 0.10   | Community       | min(60, reviews×5) + min(40, donations×2) (default: 25) |
| `verification`  | 0.15   | Verification    | Level mapping: {0:10, 1:30, 2:50, 3:70, 4:85, 5:95}     |

## Donor Reputation

| Dimension            | Weight | Label              | Calculation                                                      |
| -------------------- | ------ | ------------------ | ---------------------------------------------------------------- |
| `engagement`         | 0.25   | Engagement         | min(60, donations×3) + min(30, reviews×5) + min(10, campaigns×2) |
| `generosity`         | 0.25   | Generosity         | min(70, avgDonation/100) + min(30, donations×3) (default: 20)    |
| `feedback_quality`   | 0.30   | Feedback Quality   | min(50, reviews×5) + validRate × 50 (default: 30)                |
| `campaign_adherence` | 0.20   | Campaign Adherence | completedBacked / totalBacked × 100 (default: 30)                |

## Campaign Reputation

| Dimension             | Weight | Label               | Calculation                                                |
| --------------------- | ------ | ------------------- | ---------------------------------------------------------- |
| `funding_progress`    | 0.20   | Funding Progress    | currentAmount / goalAmount × 100 (default: 30)             |
| `milestone_adherence` | 0.20   | Milestone Adherence | completionRate × 80 + (1 − failureRate) × 20 (default: 30) |
| `transparency`        | 0.20   | Transparency        | base 30 + documentedRate × 35 + min(35, donations×2)       |
| `creator_reputation`  | 0.15   | Creator Reputation  | Creator's cached reputation score (default: 50)            |
| `donor_sentiment`     | 0.15   | Donor Sentiment     | approvedReviewRate × 100 (default: 50/30)                  |
| `update_frequency`    | 0.10   | Update Frequency    | updateCount / expectedUpdates × 100 (target: ~1/week)      |

## Key Functions

### `calculateCreatorReputation(creatorId)`

Calculates reputation by querying campaigns, milestones, reviews, donations, and verification status.

**Parameters:**

- `creatorId` (string, required) — Creator user ID

**Returns:** `{ success: boolean, data?: { overallScore, scores, stats, lastCalculated }, error?: string }`

### `calculateDonorReputation(donorId)`

Calculates reputation by querying donations, reviews, and backed campaigns.

**Parameters:**

- `donorId` (string, required) — Donor user ID

**Returns:** `{ success: boolean, data?: { overallScore, scores, stats, lastCalculated }, error?: string }`

### `calculateCampaignReputation(campaignId)`

Calculates reputation by querying milestones, donations, reviews, creator reputation, and update frequency.

**Parameters:**

- `campaignId` (string, required) — Campaign ID

**Returns:** `{ success: boolean, data?: { overallScore, scores, stats, lastCalculated }, error?: string }`

### `getCreatorReputation(creatorId)`

Fetches cached creator reputation from the `creator_reputation` table.

### `getDonorReputation(donorId)`

Fetches cached donor reputation from the `donor_reputation` table.

### `getCampaignReputation(campaignId)`

Fetches cached campaign reputation from the `campaign_reputation` table.

### `updateReputationPenalty(userId, penaltyCount, reason)`

Applies a reputation penalty. Decreases score by `min(MAX_PENALTY, penaltyCount × PENALTY_PER_INCIDENT)`.

**Parameters:**

- `userId` (string, required) — User ID
- `penaltyCount` (number, required) — Number of incidents
- `reason` (string, required) — Penalty reason

**Returns:** `{ success: boolean, data?: Object, error?: string }`

Penalty configuration: 5 points per incident, max 50 points deducted.

### `getReputationLeaderboard({ type, limit, offset })`

Returns top creators or donors ranked by overall score.

**Parameters:**

- `type` (string, default: "creator") — "creator" or "donor"
- `limit` (number, default: 20) — Max results
- `offset` (number, default: 0) — Pagination offset

## Caching Strategy

The engine uses a **calculate-or-fetch** pattern:

| Layer  | Function                 | Description                                                                                      |
| ------ | ------------------------ | ------------------------------------------------------------------------------------------------ |
| Cached | `get*Reputation()`       | Reads from pre-computed tables (`creator_reputation`, `donor_reputation`, `campaign_reputation`) |
| Live   | `calculate*Reputation()` | Queries raw tables and computes scores on the fly                                                |

The API layer (`/api/creator/reputation`) first tries the cached read. If no record exists, it falls back to live calculation.

## Usage Example

```javascript
import {
  calculateCreatorReputation,
  getReputationLeaderboard,
  updateReputationPenalty,
} from "../lib/reputation";

// Calculate creator reputation
const rep = await calculateCreatorReputation("user-123");

if (rep.success) {
  console.log("Score:", rep.data.overallScore); // e.g., 72
  console.log("Quality:", rep.data.scores.quality); // e.g., 85
  console.log("Reliability:", rep.data.scores.reliability); // e.g., 60
}

// Get leaderboard
const leaders = await getReputationLeaderboard({ type: "creator", limit: 10 });

// Apply a penalty
await updateReputationPenalty("user-123", 3, "Repeated policy violation");
// Deducts min(50, 3 × 5) = 15 points
```

## Security

- Reputation scores are publicly readable (RLS: authenticated SELECT)
- Penalty updates are admin-only (service role)
- All penalty applications are audit-logged
- User IDs are truncated in logs (PII protection)
- Uses `secureLogger` for all logging
- Uses `supabaseAdmin` for all DB operations
- Score calculations are pure computation from DB data (no user input injection)
