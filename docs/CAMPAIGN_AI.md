# Campaign AI Analysis

## Overview

The Campaign AI module (`lib/ai/campaignAI.js`) provides AI-powered analysis, scoring, and suggestion capabilities for Fundora campaigns. It combines rule-based heuristics with configurable scoring dimensions to evaluate campaign quality, suggest improvements, and identify risks.

All functions follow the "never throw" pattern and return `{ success: boolean, data?, error? }`.

## Quality Scoring

### `scoreCampaignQuality({ campaignId })`

Scores a campaign across six weighted dimensions, producing an overall score (0–100) and per-dimension breakdowns.

### Scoring Dimensions

| Dimension | Weight | Scoring Criteria |
|-----------|--------|------------------|
| Title | 0.20 | Length (10–120 chars), power words, capitalisation, word count (3–15 words) |
| Description | 0.25 | Length (100–5000 chars), paragraph structure, headings/bullets, sentence quality, personal pronouns, ALL CAPS ratio |
| Media | 0.15 | Score scales with media count: 0 images = 0, 1 = 20, 2 = 40, 3 = 60, 4 = 80, 5+ = 100 |
| Goal | 0.15 | Proximity to category average (ideal: 0.5×–2× average) |
| Category | 0.10 | Keyword match count between category and title+description |
| Creator Trust | 0.15 | Creator's platform trust score (0–100) |

### Title Scoring Details

- **Length (0–40 pts)**: Full score for 10–120 characters, proportional below, capped at 30 for over-length
- **Power words (0–30 pts)**: Up to 3 power words at 10 pts each from a curated list (e.g. "help", "support", "transform", "community")
- **Structure (0–30 pts)**: Capitalisation (+10), no excessive punctuation (+10), reasonable word count (+10)

### Description Scoring Details

- **Length (0–30 pts)**: Full score for 100–5000 characters
- **Structure (0–30 pts)**: Paragraph count, headings, bullet points
- **Language quality (0–40 pts)**: Average sentence length (10–30 words ideal), personal pronouns, ALL CAPS abuse ratio

### Output

```javascript
{
  overallScore: 72,       // 0–100
  breakdown: {
    title: 80,
    description: 65,
    media: 40,
    goal: 90,
    category: 75,
    creator: 60
  },
  suggestions: [
    "Add more images or media to showcase your campaign",
    "Expand your description with more details about your project"
  ]
}
```

## Title Suggestions

### `suggestCampaignTitles({ title, category, goal })`

Generates up to 5 alternative title variations scored by effectiveness.

### Variation Strategies

1. **Emotional trigger prefix** — Adds "Help Us", "Support", "Join Us in", or "Empower" (score: 75)
2. **Concrete number** — Appends funding goal in K format (score: 70)
3. **Category power word** — Prepends category-appropriate adjective (score: 72)
   - technology → "innovative", health → "life-changing", education → "transformative"
   - environment → "sustainable", arts → "creative", community → "community-driven"
   - business → "game-changing", science → "groundbreaking"
4. **Shortened version** — Truncates to 8 words for readability (score: 65)
5. **Question format** — Engages donors with a question (score: 68)

Output includes the original title scored alongside all suggestions, sorted by score descending.

## Description Improvement

### `improveCampaignDescription({ title, description, category, goal })`

Analyses a campaign description and generates improvement suggestions.

### Checks Performed

| Check | Condition | Suggestion |
|-------|-----------|------------|
| Length | < 100 characters | "Your description is too short. Aim for at least 100 characters" |
| Structure | < 2 paragraphs | "Break your description into multiple paragraphs" |
| Personal touch | No first-person pronouns | "Add a personal touch using first-person language" |
| Call to action | No CTA keywords | "Include a clear call to action encouraging donations" |
| Goal mention | No dollar amount in text | "Mention your funding goal in the description" |
| Impact | No benefit/impact keywords | "Describe the impact and benefits of your campaign" |
| Media references | No visual keywords | "Reference your images or videos to engage readers" |

When structural issues are detected, the engine automatically restructures the description (e.g. splitting into paragraphs, appending a CTA).

## Funding Goal Recommendation

### `recommendFundingGoal({ category, campaignType, similarCampaigns })`

Recommends a funding goal based on category averages and historical data.

### Category Averages

| Category | Average Goal |
|----------|-------------|
| Technology | $25,000 |
| Health | $50,000 |
| Education | $15,000 |
| Environment | $30,000 |
| Arts | $10,000 |
| Community | $20,000 |
| Business | $35,000 |
| Science | $40,000 |

### Campaign Type Multipliers

| Type | Multiplier | Rationale |
|------|-----------|-----------|
| personal | 0.6× | Personal campaigns typically need less |
| nonprofit | 1.2× | Organisations have larger operational costs |
| creative | 0.8× | Creative projects often need moderate funding |
| business | 1.1× | Business ventures require more capital |
| technology | 1.3× | Tech projects are capital-intensive |
| emergency | 0.5× | Emergency needs are typically urgent and smaller |

If similar campaigns are provided, the recommendation averages the category baseline with successful similar campaign goals. The result is rounded to the nearest $500 and includes a min/max range (0.5×–2×).

## Category Prediction

### `predictCategory({ title, description })`

Predicts the most likely category from title and description text using keyword matching.

### Category Keywords

Each category has 8–9 keywords (e.g. technology: "tech", "software", "app", "ai", "machine learning", "blockchain", "saas", "platform", "digital").

Confidence is calculated as `min(1, matchCount / 3)`. If no keywords match, defaults to "community" with confidence 0.2.

### Output

```javascript
[
  { category: "technology", confidence: 1.0 },
  { category: "business", confidence: 0.33 },
  { category: "education", confidence: 0.33 }
]
```

## Risk Observation

### `observeCampaignRisk({ campaignId })`

Non-blocking risk signal analysis. Does not reject campaigns — only observes and suggests.

### Risk Signals

| Signal | Severity | Trigger Condition |
|--------|----------|-------------------|
| `unrealistic_goal` | medium | Goal > 5× category average |
| `vague_description` | medium | Description < 100 characters |
| `low_creator_trust` | high | Trust score < 30/100 |
| `no_media` | low | Zero images or media attached |
| `new_creator_high_goal` | medium | First campaign + goal > $10,000 |
| `unverified_creator` | low | KYC status ≠ "verified" |

Each observation includes a description and a suggestion for improvement.

## SEO Suggestions

### `generateSEOSuggestions({ title, description, category })`

Generates SEO optimisation recommendations:

- **Keywords**: Top 10 most frequent words (>3 chars, excluding stop words), with category prepended
- **Meta description**: First 155 characters of description with ellipsis if truncated
- **Title variations**: Shortened title, category-suffixed title, Fundora-branded title

## Completeness Analysis

### `analyzeCompleteness({ campaignId })`

Checks campaign against required and optional fields.

### Required Fields

| Field | Minimum Requirement |
|-------|-------------------|
| Title | ≥ 10 characters |
| Description | ≥ 100 characters |
| Funding goal | > 0 |
| Category | Non-empty |

### Optional Fields

| Field | Benefit |
|-------|---------|
| Media/images | At least 1 image |
| End date | Campaign deadline |
| Tags | Searchability |
| Short description | Summary for listings |
| Location | Geographic context |
| Video URL | Engagement boost |

Completeness score = (completed fields / total fields) × 100.

## Batch Quality Check

### `batchQualityCheck({ campaignIds })`

Processes multiple campaigns in batches of 50 for performance. Returns per-campaign scores with flag labels:

- `weak_title` (title score < 40)
- `weak_description` (description score < 30)
- `insufficient_media` (media score < 30)
- `unrealistic_goal` (goal score < 40)
