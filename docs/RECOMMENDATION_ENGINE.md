# Recommendation Engine

## Overview

The recommendation engine (`lib/ai/recommendationEngine.js`) provides personalised campaign and donor recommendations using a multi-signal scoring approach. It combines content-based filtering, collaborative filtering, trending signals, and trust weighting to produce ranked results with human-readable explanations.

All functions follow the "never throw" pattern and return `{ success: boolean, data?, error? }`.

## Signal Architecture

### Signal Weights

| Signal         | Weight | Description                                          |
| -------------- | ------ | ---------------------------------------------------- |
| Content-Based  | 0.35   | Category match + goal-range proximity                |
| Collaborative  | 0.25   | Donors with similar history also funded this         |
| Trending       | 0.20   | Recent donation velocity and acceleration            |
| Trust-Weighted | 0.20   | Platform trust score multiplier applied to composite |

### Composite Score Formula

```
composite = (contentScore × 0.35) + (collabScore × 0.25) + (trendScore × 0.20)
adjusted  = composite × (0.5 + 0.5 × trustScore)
```

The trust weighting ensures higher-trusted creators get a proportional boost without dominating the signal.

## Donor Recommendations

### `getDonorRecommendations({ donorId, limit, excludeIds })`

Generates personalised campaign recommendations for a specific donor.

#### Flow

1. **Fetch donor history** — Last 200 donations with campaign metadata
2. **Derive preferences** — Top 5 categories by frequency, average donation amount, goal range (min–max of funded campaigns × 0.5–1.5)
3. **Fetch candidate campaigns** — Up to 100 active campaigns, excluding already-funded and explicitly excluded IDs
4. **Build collaborative signal** — Find donors who funded the same campaigns (up to 50 similar donors)
5. **Score each candidate** — Compute all four signals, calculate composite, apply trust weighting
6. **Generate reasons** — Human-readable explanations based on score thresholds

#### Signal Details

**Content-Based Score** (0–1):

- Category match: 1.0 if donor's top categories include campaign category, 0.5 default
- Goal proximity: 1.0 if goal falls within donor's preferred range, degrades linearly outside
- Formula: `categoryMatch × 0.6 + goalProximity × 0.4`

**Collaborative Score** (0–1):

- Frequency: How often similar donors funded this campaign (capped at 1.0)
- Amount weight: Each donation weighted by `min(amount / 1000, 1)`
- Formula: `frequencyScore × 0.6 + recencyScore × 0.4`

**Trending Score** (0–1):

- Velocity: Recent donations / timeframe, normalised to 0–1
- Acceleration: Growth rate between current and previous period
- Formula: `velocityNorm × 0.7 + accelerationNorm × 0.3`

#### Output

```javascript
[
  {
    campaignId: "uuid",
    score: 0.782,
    reason:
      "matches your interest in technology; trending right now; highly trusted creator",
    factors: {
      categoryMatch: 1.0,
      trendingScore: 0.65,
      trustScore: 0.85,
      donorAffinity: 0.3,
    },
  },
];
```

## Campaign Donor Suggestions

### `getCampaignDonorSuggestions({ campaignId, limit })`

Reverse lookup: finds donors likely to fund a specific campaign.

#### Flow

1. Fetch target campaign metadata (category, goal)
2. Fetch all donations (up to 500) from other campaigns
3. Aggregate per-donor: donation count, total amount, category matches, goal matches
4. Score donors by: `categoryScore × 0.35 + goalScore × 0.20 + frequencyScore × 0.25 + amountScore × 0.20`

#### Scoring Components

| Component       | Calculation                                               |
| --------------- | --------------------------------------------------------- |
| Category score  | `categoryMatches / totalDonations`                        |
| Goal score      | `goalMatches / totalDonations` (goal ratio > 0.3 = match) |
| Frequency score | `donorCount / (totalUniqueDonors × 0.1)`, capped at 1.0   |
| Amount score    | `totalAmount / (donationCount × 500)`, capped at 1.0      |

## Similar Campaigns

### `getSimilarCampaigns({ campaignId, limit })`

Finds campaigns similar to a given reference campaign using embeddings or feature matching.

#### Dual-Path Strategy

**Path 1 — Embedding-based** (preferred):

- Constructs a search query from title + description + category
- Calls `searchEmbeddings()` for vector similarity search
- Weighted scoring: `embScore × 0.60 + goalSimilarity × 0.15 + categoryMatch × 0.10 + tagOverlap × 0.15`

**Path 2 — Feature-based** (fallback):

- Used when embeddings are unavailable
- Scoring: `categoryMatch × 0.40 + goalSimilarity × 0.30 + tagOverlap × 0.30`

#### Similarity Metrics

| Metric          | Calculation                             |
| --------------- | --------------------------------------- |
| Goal similarity | `min(goalA, goalB) / max(goalA, goalB)` |
| Category match  | 1.0 if categories match, 0 otherwise    |
| Tag overlap     | Jaccard similarity of tag sets          |

#### Output

```javascript
[
  {
    campaignId: "uuid",
    score: 0.845,
    reason:
      "same category (technology); similar goal amount; semantically similar",
    sharedCategories: ["technology"],
    goalSimilarity: 0.82,
  },
];
```

## Trending Campaigns

### `getTrendingCampaigns({ limit, timeframe, category })`

Ranks active campaigns by recent donation velocity.

### Timeframes

| Timeframe | Days | Recency Weight |
| --------- | ---- | -------------- |
| `7d`      | 7    | 1.0            |
| `30d`     | 30   | 0.8            |
| `90d`     | 90   | 0.6            |

### Velocity Calculation

For each campaign:

1. Count donations in the current period and previous period (same duration)
2. `velocityRate = (recentDonations / daysActive) × recencyWeight`
3. `recentGrowth = ((recent - previous) / previous) × 100` (percentage)
4. `score = min(velocityRate × 2 + max(recentGrowth, 0) / 200, 1.0)`

### Output

```javascript
[
  {
    campaignId: "uuid",
    score: 0.89,
    velocity: 1.45,
    reason: "23 donations this period; 85% growth; strong daily velocity",
    donationCount: 23,
    recentGrowth: 85.0,
  },
];
```

## Creator Recommendations

### `getCreatorRecommendations({ creatorId, limit })`

Recommends categories and goal ranges for a creator based on their track record.

### Flow

1. Fetch all campaigns by the creator
2. Analyse performance per category: count, total goal, total raised, success rate
3. Compute optimal goal range (25th–75th percentile of funded goals)
4. Calculate expected success probability: `successRate × 0.8 + trustBoost + 0.1`
5. Suggest unexplored high-potential categories if room remains in results

### Output

```javascript
[
  {
    category: "technology",
    goalRange: { min: 5000, max: 25000 },
    reason:
      "75% success rate in this category; averages 120% funding; proven track record",
    expectedSuccess: 0.72,
  },
];
```

## Cache Invalidation

### `invalidateRecommendationCache({ userId, type })`

Clears cached recommendations from the `recommendation_cache` table.

- Filter by `userId` (clears all types for that user)
- Filter by `type` (clears that type for all users)
- Both can be combined for targeted invalidation

Should be called when:

- A user makes a new donation
- A campaign status changes
- Creator trust scores are updated
- Recommendation algorithm parameters change

## Recommendation Types

| Type Constant                | Value                        | Description                         |
| ---------------------------- | ---------------------------- | ----------------------------------- |
| `CAMPAIGNS_FOR_DONOR`        | `campaign_for_donor`         | Personalised campaigns for a donor  |
| `SIMILAR_CAMPAIGNS`          | `similar_campaigns`          | Campaigns similar to a reference    |
| `TRENDING`                   | `trending`                   | Fast-rising campaigns               |
| `CREATOR_RECOMMENDATIONS`    | `creator_recommendations`    | Category/goal guidance for creators |
| `CAMPAIGN_DONOR_SUGGESTIONS` | `campaign_donor_suggestions` | Donors likely to fund a campaign    |

## Configuration

| Constant             | Value     | Description                            |
| -------------------- | --------- | -------------------------------------- |
| `MAX_HISTORY_SAMPLE` | 200       | Max historical donations per donor     |
| `MAX_SIMILAR_DONORS` | 50        | Max donors for collaborative filtering |
| `SIGNAL_WEIGHTS`     | See above | Configurable per-signal weights        |

All parameters can be adjusted by modifying the constants at the top of `recommendationEngine.js`. The weights are designed to be tuned based on A/B testing results.
