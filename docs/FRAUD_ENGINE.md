# Fraud Engine

Phase 5 — AI-powered fraud detection and risk management system for Fundora.

## Architecture

The fraud detection system continuously evaluates every creator, campaign, verification request, donation, payout request, and account action. It uses a pipeline architecture:

```
Signals → Rules → Scoring → Decision → Action
```

### Core Modules

| Module | Responsibility |
|--------|---------------|
| `riskEngine.js` | Orchestrates the entire fraud detection pipeline |
| `ruleEngine.js` | Evaluates configurable rules against signals |
| `signalAggregator.js` | Collects and aggregates risk signals from multiple sources |
| `riskScorer.js` | Calculates composite risk score (0-100) |
| `decisionEngine.js` | Maps risk score + trust score to actions |
| `riskHistory.js` | Tracks historical risk scores and changes |
| `fraudEvents.js` | Records fraud-related events |
| `providerAdapter.js` | Pluggable AI provider abstraction |
| `aiRiskAnalyzer.js` | Orchestrates AI-powered risk analysis |
| `deviceFingerprint.js` | Tracks and analyzes device fingerprints |
| `behaviorAnalytics.js` | Tracks and analyzes user behavior patterns |

### Data Flow

1. **Event Triggered** — User action (login, donation, verification, etc.)
2. **Signal Collection** — `signalAggregator.js` collects data from multiple sources
3. **Rule Evaluation** — `ruleEngine.js` evaluates configurable rules
4. **Risk Scoring** — `riskScorer.js` calculates composite risk score
5. **Decision** — `decisionEngine.js` determines action (allow/monitor/review/limit/block)
6. **Action** — System applies restrictions or queues for review

## Risk Scoring

### Risk Levels

| Level | Score Range | Description |
|-------|-------------|-------------|
| LOW | 0-25 | Normal risk — standard monitoring |
| MEDIUM | 26-50 | Moderate risk — monitoring recommended |
| HIGH | 51-75 | Elevated risk — manual review required |
| CRITICAL | 76-100 | Immediate action required |

### Scoring Factors (Configurable)

| Factor | Weight | Description |
|--------|--------|-------------|
| Signals | 40% | Behavioral and device signals |
| Rules | 30% | Triggered fraud rules |
| Trust Inversion | 15% | Low trust = high risk |
| Verification Gap | 15% | Missing verification = higher risk |

### Signal Categories

| Category | Signals |
|----------|---------|
| Identity | Email, phone, ID verification |
| Verification | Bank, business verification |
| Behavior | Login frequency, donation velocity, verification attempts |
| Device | Fingerprint, known/unknown device |
| Velocity | Rate-based signals (events per time window) |
| Reputation | Trust score, previous fraud history |
| Account | Account age, profile completeness |

## Rule Engine

### Rule Categories

| Category | Description | Example |
|----------|-------------|---------|
| Velocity | Count events within time window | 5+ donations in 1 hour |
| Threshold | Value comparisons | 2+ rejected documents in 7 days |
| Pattern | Custom behavioral patterns | IP country mismatch |
| Compound | Multiple conditions | Low trust + large donation |
| Duplicate | Cross-user uniqueness | PAN used by multiple users |

### Default Rules

- `rapid_donations` — 5+ donations within 1 hour
- `failed_verification_spam` — 3+ failed verification attempts in 24 hours
- `multiple_devices` — 3+ unique devices in 24 hours
- `rapid_profile_edits` — 5+ profile edits in 1 hour
- `password_reset_frequency` — 3+ password resets in 24 hours
- `rejected_documents` — 2+ rejected documents in 7 days
- `multiple_payout_accounts` — 3+ bank accounts added in 7 days
- `duplicate_pan` — PAN used by multiple users
- `duplicate_gst` — GST used by multiple users
- `duplicate_bank_account` — Bank account used by multiple users
- `duplicate_phone` — Phone number used by multiple users
- `duplicate_upi` — UPI ID used by multiple users
- `ip_country_mismatch` — IP country differs from verification country
- `suspicious_email_domain` — Email from known disposable domain
- `low_trust_high_donation` — Low trust score with large donation
- `new_account_high_activity` — Account < 7 days old with high activity
- `rapid_bank_changes` — 3+ bank account changes in 30 days
- `document_resubmission_loop` — Same document rejected 3+ times

## Decision Engine

### Decision Actions

| Action | Description | Restrictions |
|--------|-------------|--------------|
| ALLOW | No restrictions | None |
| MONITOR | Silent monitoring | None |
| MANUAL_REVIEW | Queue for admin review | request_payout |
| LIMIT | Restrict certain actions | request_payout, create_campaign |
| BLOCK | Block all actions | All actions blocked |
| ESCALATE | Immediate admin escalation | All actions blocked |

### Decision Matrix

| Risk Level | Trust Low | Trust Medium | Trust High |
|------------|-----------|--------------|------------|
| CRITICAL | BLOCK | BLOCK | MANUAL_REVIEW |
| HIGH | MANUAL_REVIEW | MANUAL_REVIEW | LIMIT |
| MEDIUM | MANUAL_REVIEW | MONITOR | ALLOW |
| LOW | MONITOR | ALLOW | ALLOW |

## Device Fingerprinting

### Fingerprint Data

- Browser, platform, timezone, language, screen resolution
- User agent string
- Canvas hash (SHA-256)
- WebGL hash (SHA-256)
- Fonts hash (SHA-256)

### Security

- All fingerprint hashes are SHA-256 (never store raw)
- Never expose raw fingerprints to frontend
- Known vs unknown device tracking
- Risk flags for suspicious devices

## Behavior Analytics

### Tracked Events

- Login patterns (frequency, time of day, device)
- Verification attempts (frequency, success rate)
- Campaign creation (frequency, patterns)
- Donation behavior (frequency, amounts, recipients)
- Document uploads (frequency, types, rejection rate)
- Bank account changes (frequency, patterns)

### Anomaly Detection

- Unusual login frequency
- Rapid activity spikes
- Verification spam
- Suspicious bank change patterns

## AI Risk Analyzer

### Supported Providers

| Provider | Status | API Key Required |
|----------|--------|------------------|
| Mock | Active (default) | No |
| OpenAI | Placeholder | Yes |
| Gemini | Placeholder | Yes |
| Anthropic | Placeholder | Yes |
| Local (Ollama) | Placeholder | No |

### Features

- Risk analysis with confidence scoring
- Decision explanation generation
- Anomaly detection
- Fallback to rule-based analysis on AI failure

## API Endpoints

### User APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/fraud/profile` | GET | Get fraud profile |
| `/api/fraud/evaluate` | POST | Trigger evaluation |
| `/api/fraud/events` | GET | Get fraud events |
| `/api/fraud/history` | GET | Get risk history |
| `/api/fraud/devices` | GET/POST | Device fingerprints |

### Admin APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/fraud-dashboard` | GET/POST | Fraud dashboard |

## Security

### Data Protection

- Never expose raw risk scores to frontend (only risk level)
- Never expose raw fingerprints or device hashes
- Never expose AI prompts or provider responses
- Never expose internal scoring formulas
- All API responses are sanitized

### Logging

- All fraud operations are audit-logged
- Uses `secureLogger` for structured logging with PII redaction
- No sensitive data in logs

### Access Control

- User APIs: authenticated users only (own data)
- Admin APIs: admin role required (TODO: implement role check)
- Rate limiting on all endpoints

## File Locations

| File | Purpose |
|------|---------|
| `lib/fraud/riskEngine.js` | Pipeline orchestrator |
| `lib/fraud/ruleEngine.js` | Rule evaluation |
| `lib/fraud/signalAggregator.js` | Signal collection |
| `lib/fraud/riskScorer.js` | Risk score calculation |
| `lib/fraud/decisionEngine.js` | Decision determination |
| `lib/fraud/riskHistory.js` | Historical tracking |
| `lib/fraud/fraudEvents.js` | Event recording |
| `lib/fraud/providerAdapter.js` | AI provider abstraction |
| `lib/fraud/aiRiskAnalyzer.js` | AI analysis orchestration |
| `lib/fraud/deviceFingerprint.js` | Device tracking |
| `lib/fraud/behaviorAnalytics.js` | Behavior analysis |
| `lib/fraud/signals/index.js` | Signal providers |
| `lib/fraud/index.js` | Public API |
| `pages/api/fraud/profile.js` | Profile API |
| `pages/api/fraud/evaluate.js` | Evaluation API |
| `pages/api/fraud/events.js` | Events API |
| `pages/api/fraud/history.js` | History API |
| `pages/api/fraud/devices.js` | Devices API |
| `pages/api/admin/fraud-dashboard.js` | Admin dashboard API |
| `components/admin/FraudDashboard.jsx` | Admin UI |
| `components/verification/SecurityDashboard.jsx` | Creator UI |
| `pages/admin/fraud.js` | Admin page |
