# Prediction Engine

## Overview

The prediction engine (`lib/ai/predictionEngine.js`) provides feature-based predictive analytics for campaigns, donors, and creators. It extracts normalised feature vectors from data, applies deterministic rule-based scoring, and returns predictions with confidence scores and explanatory factors.

All functions follow the "never throw" pattern and return `{ success: boolean, data?, error? }`.

## Feature Extraction

### Campaign Features

Extracted from campaign data and creator profile:

| Feature | Weight | Source | Normalisation |
|---------|--------|--------|---------------|
| Early funding ratio | 0.20 | `current_amount / goal_amount` | min(ratio, 1.0) |
| Creator reputation | 0.18 | `creator.reputation_score` or `trust_score` | 0–1 range |
| Trust score | 0.15 | `creator.trust_score` | 0–1 range |
| Category success rate | 0.12 | Category baseline lookup | 0.30–0.42 |
| Update frequency | 0.10 | `update_count / days_active` | min(freq, 1.0) |
| Social proof | 0.10 | `donor_count / 100` | min(ratio, 1.0) |
| Goal amount | 0.10 | `goal_amount / 100000` | Penalty for large goals |

### Category Baselines

| Category | Success Rate |
|----------|-------------|
| education | 0.42 |
| community | 0.40 |
| technology | 0.38 |
| social | 0.37 |
| environment | 0.36 |
| health | 0.35 |
| business | 0.33 |
| creative | 0.32 |
| arts | 0.30 |
| default | 0.35 |

### Donor Features

| Feature | Source |
|---------|--------|
| Trust score | `donor.trust_score` |
| Total donations | Historical count |
| Average amount | Mean donation |
| Refund rate | `refund_count / total_donations` |
| Account age | Days since registration |
| KYC verified | Boolean |

## Rule-Based Scoring

The core prediction model is a weighted sum of normalised features:

```
probability = Σ(featureValue × featureWeight) / Σ(weights) + recencyBonus
```

### Recency Bonus

Campaigns ≤ 3 days old with zero early funding receive a -0.1 penalty.

### Confidence Calculation

Confidence is based on data richness:

```
dataSignals = [hasDays, hasDonors, hasUpdates, hasNonDefaultTrust]
confidence = min(0.3 + dataSignals × 0.175, 0.95)
```

More available data signals yield higher confidence. Confidence never exceeds 0.95.

## Prediction Types

### 1. Campaign Success Probability

**Function**: `predictCampaignSuccess({ campaignId })`

Returns the probability (0–1) that a campaign will reach its funding goal.

| Output Field | Description |
|-------------|-------------|
| `probability` | 0–1 success probability |
| `confidence` | 0–1 model confidence |
| `factors` | Array of `{name, impact, description}` |
| `timeframe` | Prediction window: "30d" (≤14 days active), "60d" (≤45 days), "90d" |

### 2. Funding Timeline

**Function**: `predictFundingTimeline({ campaignId })`

Projects when a campaign will reach its funding goal based on current daily rate.

| Output Field | Description |
|-------------|-------------|
| `estimatedCompletionDate` | ISO date string (null if rate = 0) |
| `dailyRateNeeded` | Amount needed per day to fund within 30 days |
| `currentRate` | Average daily funding amount |
| `confidence` | Based on donation sample size and variance |

**Confidence formula**:
```
confidence = 0.2 + min(sampleSize/100, 1) × 0.5 - min(normalizedVariance, 1) × 0.3
```

### 3. Donation Velocity

**Function**: `predictDonationVelocity({ campaignId, windowDays })`

Projects forward-looking donation velocity using two-half trend analysis.

| Output Field | Description |
|-------------|-------------|
| `currentVelocity` | Donations per day in the recent half |
| `predictedVelocity` | Linear extrapolation of trend |
| `trend` | "increasing", "stable", or "decreasing" |
| `confidence` | Based on sample size and velocity change |

**Trend detection**: If second-half rate > first-half × 1.15, trend is "increasing". If < 0.85×, "decreasing". Otherwise "stable".

### 4. Failure Risk

**Function**: `predictFailureRisk({ campaignId })`

Identifies risk factors and assigns a risk level with mitigation suggestions.

| Output Field | Description |
|-------------|-------------|
| `riskLevel` | "low" (< 0.25), "medium" (< 0.50), "high" (< 0.75), "critical" (≥ 0.75) |
| `probability` | 0–1 failure probability |
| `keyRiskFactors` | Array of risk factor descriptions |
| `mitigationSuggestions` | Actionable recommendations |

#### Risk Factors and Weights

| Factor | Score Impact | Threshold |
|--------|-------------|-----------|
| Low early funding | +0.25 | < 10% funded after 14+ days |
| No recent donations | +0.20 | Zero donations in last 30 days (after 7+ days active) |
| Declining velocity | +0.15 | Velocity trend is "decreasing" (after 14+ days) |
| Low creator trust | +0.15 | Trust score < 0.3 |
| No updates | +0.10 | Zero updates after 7+ days |
| High goal, low traction | +0.10 | Goal > $50k with < 5% funded |
| Low social proof | +0.05 | < 3 donors after 14+ days |

### 5. Refund Probability

**Function**: `predictRefundProbability({ donationId })`

Predicts the likelihood a specific donation will be refunded.

| Output Field | Description |
|-------------|-------------|
| `probability` | 0–1 refund probability |
| `factors` | Array of contributing factor descriptions |

#### Refund Risk Factors

| Factor | Score Impact | Condition |
|--------|-------------|-----------|
| High refund history | +0.35 | Donor refund rate > 30% |
| Moderate refund history | +0.15 | Donor refund rate 10–30% |
| Low donor trust | +0.20 | Trust score < 0.3 |
| Inactive campaign | +0.20 | Campaign status ≠ "active" |
| Low campaign funding | +0.10 | Funding < 10% of goal |
| Recent donation | +0.15 | Within 24 hours |
| Somewhat recent | +0.05 | Within 72 hours |
| Large amount | +0.05 | Amount > $1,000 |

### 6. Milestone Completion

**Function**: `predictMilestoneCompletion({ milestoneId })`

Predicts whether a campaign milestone will be completed on time.

| Output Field | Description |
|-------------|-------------|
| `probability` | 0–1 completion probability |
| `estimatedCompletionDate` | ISO date (projected if no target date) |
| `blockers` | Array of identified blockers |

**Scoring factors**: Creator reputation, campaign activity, historical milestone completion rate, target date proximity.

### 7. Creator Growth

**Function**: `predictCreatorGrowth({ creatorId, windowDays })`

Projects a creator's growth trajectory over a given window.

| Output Field | Description |
|-------------|-------------|
| `followerGrowthRate` | Followers per day |
| `donationGrowthRate` | Percentage change in donation rate |
| `trend` | "accelerating" (> +20%), "steady", "declining" (< -20%) |
| `projectedFollowers` | Projected follower count |
| `projectedDonations` | Projected donation count |

**Projection method**: Two-half trend analysis with trend-adjusted extrapolation (×1.2 for accelerating, ×0.8 for declining).

## Batch Predictions

### `batchPredict({ entityType, entityIds, predictionType })`

Runs predictions for multiple entities of the same type in a single call.

| Parameter | Values |
|-----------|--------|
| `entityType` | "campaign", "donation", "milestone", "creator" |
| `entityIds` | Array of entity IDs |
| `predictionType` | One of 7 prediction types |

Each entity is processed independently. Individual failures do not block the batch — failed entities return `{ error: "..." }` in their result.

### Output

```javascript
[
  { entityId: "uuid-1", prediction: { probability: 0.72, confidence: 0.65, ... } },
  { entityId: "uuid-2", prediction: { error: "Campaign not found" } }
]
```

## Design Principles

- **Deterministic**: Rule-based scoring ensures reproducible predictions
- **Transparent**: Every prediction includes factor-level explanations
- **Confidence-aware**: Predictions are paired with confidence scores so callers can decide how much weight to give them
- **Non-blocking**: Risk observations and predictions never reject or block campaigns — they provide advisory information
- **Extensible**: Feature weights and category baselines can be tuned without changing the scoring algorithm
