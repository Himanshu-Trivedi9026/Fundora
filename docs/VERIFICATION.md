# Fundora — Verification System Documentation

## Overview

Fundora's verification system provides a multi-step KYC (Know Your Customer) workflow for creator identity verification. The system is designed to be **provider-agnostic** — all external KYC/OCR providers are pluggable via abstract interfaces, allowing seamless integration without changing UI or business logic.

## Architecture

### Verification Levels (0-5)

| Level | Label             | Requirements                                  |
| ----- | ----------------- | --------------------------------------------- |
| 0     | Email Only        | Account created with email                    |
| 1     | Phone Verified    | Phone number confirmed via OTP                |
| 2     | Identity Verified | Government ID verified (PAN/Aadhaar/Passport) |
| 3     | Bank Verified     | Bank account confirmed                        |
| 4     | Business Verified | Business registration verified                |
| 5     | Fully Verified    | All checks passed                             |

### Verification States

The system supports rich verification states:

- `pending` — Awaiting submission
- `documents_uploaded` — Documents uploaded, awaiting validation
- `automatic_validation` — OCR/automated checks in progress
- `under_review` — Submitted, being reviewed
- `manual_review` — Assigned to human reviewer
- `approved` — Verified successfully
- `rejected` — Verification denied
- `expired` — Verification expired (renewal required)
- `cancelled` — User cancelled the request

### State Flow

```
draft → submitted → documents_uploaded → automatic_validation
    → { under_review | manual_review } → approved | rejected
```

## Database Schema

### Tables

| Table                    | Purpose                                   |
| ------------------------ | ----------------------------------------- |
| `creator_verifications`  | Master verification record (one per user) |
| `verification_requests`  | Individual verification requests          |
| `verification_sessions`  | Resumable wizard state                    |
| `verification_documents` | Uploaded document references              |
| `verification_history`   | Immutable audit trail                     |
| `verification_otp`       | Phone OTP storage                         |
| `verification_audit_log` | Comprehensive action logging              |

### Key Relationships

```
auth.users
  └── creator_verifications (1:1)
       ├── verification_requests (1:N)
       │    └── verification_sessions (1:N)
       ├── verification_documents (1:N)
       └── verification_history (1:N)

verification_audit_log (references any entity)
```

## Provider Architecture

### Verification Providers

All providers extend `BaseVerificationProvider`:

```javascript
// Register a new provider
import { registerProvider } from "@/lib/verification/provider";
registerProvider("my_provider", new MyProvider());

// Use it
import { getProvider } from "@/lib/verification/provider";
const provider = getProvider("my_provider");
await provider.submitVerification(userData);
```

**Available Providers:**

- `fundora_internal` — Default (manual review, no external APIs)
- `stripe_identity` — Placeholder for Stripe Identity
- `hyperverge` — Placeholder for HyperVerge
- `signzy` — Placeholder for Signzy
- `onfido` — Placeholder for Onfido
- `persona` — Placeholder for Persona

### OCR Providers

OCR providers extend `OCRProvider` and handle document text extraction:

```javascript
import { registerOCRProvider } from "@/lib/verification/ocrProviderRegistry";
registerOCRProvider("my_ocr", MyOCRProvider);
```

**Available OCR Providers:**

- `fundora_internal` — Default (mock extraction)

## Document Lifecycle

### 1. Upload

Documents are uploaded via `DocumentUploader` component:

1. User selects document type (PAN, Aadhaar, etc.)
2. File is validated: extension, MIME type, size, dimensions
3. File is encrypted and stored in Supabase Storage (`verification-docs` bucket)
4. Metadata is stored in `verification_documents` table
5. Sensitive fields (storage_path, provider_reference) are never exposed to frontend

### 2. Validation

- **Automatic:** OCR extraction, field validation, face matching
- **Manual:** Admin review via `manualReview.js`

### 3. Storage Security

- Storage bucket is **private** (no public access)
- Signed URLs expire after **1 hour**
- Raw storage paths are **never returned** to frontend
- Document names are **masked** in responses (e.g., `PAN***1234.jpg`)
- Metadata is encrypted with **AES-256-GCM**

## Session Management

### Resumable Wizard Workflows

Users can close their browser and resume verification later:

1. Wizard state is saved to `verification_sessions` table
2. Session expires after **7 days** of inactivity
3. On page load, system checks for active session
4. Wizard resumes from last completed step

### Session Data

```javascript
{
  current_step: "identity",
  completed_steps: ["email", "phone"],
  wizard_state: { /* encrypted sensitive data */ },
  device_metadata: { browser, os, screen, timezone },
  expires_at: "2026-08-01T00:00:00Z"
}
```

## Manual Review Flow

### Priority Levels

| Priority | Description                                         |
| -------- | --------------------------------------------------- |
| `urgent` | Returning user, expired verification, admin-flagged |
| `high`   | Level 3+ requests, business accounts                |
| `normal` | Default                                             |
| `low`    | Informational-only requests                         |

### Review Queue

Admins see requests ordered by:

1. Priority (urgent → high → normal → low)
2. Submitted date (oldest first)

### Actions

```javascript
import {
  assignReviewer,
  approveRequest,
  rejectRequest,
} from "@/lib/verification/manualReview";

// Assign reviewer
await assignReviewer(requestId, reviewerId, "high");

// Approve
await approveRequest(requestId, reviewerId, "All documents verified");

// Reject
await rejectRequest(requestId, reviewerId, "Document expired");
```

## Audit Logging

Every verification action is logged to `verification_audit_log`:

```javascript
import { logAuditEvent } from "@/lib/verification/auditLog";

await logAuditEvent({
  eventType: "verification.submitted",
  entityType: "verification_request",
  entityId: requestId,
  userId: user.id,
  action: "submitted",
  details: { type: "identity" },
  ipAddressHash: hashIP(ip),
  userAgent: req.headers["user-agent"],
});
```

### Logged Events

- Session: started, resumed, completed
- OTP: sent, verified, failed
- Documents: uploaded, validated, rejected
- Review: assigned, completed
- Status changes: all transitions

## Encryption & Sanitization

### Metadata Encryption

Sensitive document metadata is encrypted with AES-256-GCM:

```javascript
import {
  encryptMetadata,
  decryptMetadata,
} from "@/lib/verification/metadataEncryption";

const encrypted = encryptMetadata({ panNumber: "ABCDE1234F" });
const decrypted = decryptMetadata(encrypted);
```

### Response Sanitization

All API responses are sanitized before sending to frontend:

```javascript
import {
  sanitizeDocumentResponse,
  sanitizeVerificationRequest,
  sanitizeSessionResponse,
} from "@/lib/verification/metadataEncryption";

// Strips: provider_reference, storage_path, metadata_encrypted
const safeDoc = sanitizeDocumentResponse(rawDoc);

// Strips: provider_reference, device_metadata from metadata
const safeReq = sanitizeVerificationRequest(rawReq);

// Strips: device_metadata, ip_address_hash, wizard_state
const safeSession = sanitizeSessionResponse(rawSession);
```

## Trust & Risk Engines

### Trust Score (0-100)

Weighted modules:

- Identity (30%): Verification level and recency
- Campaigns (25%): Project quality (stub)
- Community (15%): Engagement (stub)
- Payments (20%): Funding history (stub)
- Reports (5%): Community reports (stub)
- AI (5%): ML signals (stub)

**Integration:**

```javascript
import {
  applyVerificationApproval,
  applyVerificationRejection,
} from "@/lib/trust/trustEngine";

const newScore = applyVerificationApproval(currentScore, "identity"); // +15
const newScore = applyVerificationRejection(currentScore, "identity"); // -10
```

### Risk Score (0-100)

Weighted factors:

- Chargebacks (20%), Network (15%), Spam (15%), Accounts (15%), Reports (15%), Device (10%), Fraud (10%)

**Integration:**

```javascript
import {
  applyDocumentRejection,
  applyRepeatedFailures,
  applyDocumentReplacement,
} from "@/lib/risk/riskEngine";

let risk = applyDocumentRejection(currentRisk); // +15
risk = applyRepeatedFailures(risk, 3); // +15 (5 per failure, max 30)
risk = applyDocumentReplacement(risk, 2); // +6 (3 per replacement, max 15)
```

## Device Metadata

Device information is collected as placeholders for future fingerprinting:

```javascript
{
  browser: "Chrome 120",
  os: "Windows 11",
  screen: "1920x1080",
  timezone: "Asia/Kolkata",
  language: "en-IN"
}
```

**Security:** Device metadata is stored in session/request metadata but **never displayed in UI** or returned in public APIs.

## Security Model

### Row Level Security (RLS)

All verification tables have RLS enabled:

- Users can only read/write their own data
- Service role has full access (for API routes, admin operations)
- Audit log is append-only (REVOKE UPDATE/DELETE)

### Data Protection

| Data                | Storage                  | Exposure                        |
| ------------------- | ------------------------ | ------------------------------- |
| Raw storage paths   | DB only                  | Never to frontend               |
| Provider references | DB only                  | Never to frontend               |
| OTP hashes          | DB only                  | Never returned                  |
| Device metadata     | DB only                  | Never in public APIs            |
| Document names      | DB + masked in responses | Masked (e.g., `PAN***1234.jpg`) |
| IP addresses        | Hashed only              | Never raw                       |

### Signed URLs

- Generated on-demand for document access
- Expire after **1 hour**
- Generated server-side with service role (bypasses RLS)

## Future Integrations

### Ready to Plug In

The architecture is designed for seamless provider integration:

1. **Stripe Identity** — Document verification + face matching
2. **HyperVerge** — OCR + liveness detection
3. **Signzy** — Multi-document verification
4. **Onfido** — Global identity verification
5. **Persona** — Flexible KYC workflows
6. **Twilio/MSG91** — SMS OTP delivery
7. **Resend** — Email notifications

### To Add a New Provider

1. Create provider class extending `BaseVerificationProvider`
2. Register in `provider.js`
3. Add capabilities to `PROVIDER_CAPABILITIES`
4. No UI changes needed

## File Structure

```
lib/verification/
├── baseProvider.js          # Abstract base class
├── provider.js              # Provider registry + capabilities
├── storage.js               # Document storage + validation
├── metadataEncryption.js    # Encryption + sanitization
├── documentValidator.js     # Validation pipeline
├── phoneVerification.js     # OTP architecture
├── ocrProvider.js           # Abstract OCR class
├── ocrProviderRegistry.js   # OCR provider registry
├── auditLog.js              # Audit logging
├── sessionManager.js        # Session management
├── manualReview.js          # Admin review workflow
├── notifications.js         # Notification system
└── providers/
    ├── phoneProvider.js
    ├── fundoraInternalOCR.js
    ├── stripeIdentityProvider.js
    ├── hypervergeProvider.js
    ├── signzyProvider.js
    ├── onfidoProvider.js
    └── personaProvider.js

components/verification/
├── VerificationWizard.jsx
├── WizardStepIndicator.jsx
├── EmailVerificationStep.jsx
├── PhoneVerificationStep.jsx
├── IdentityVerificationStep.jsx
├── SelfieVerificationStep.jsx
├── DocumentUploader.jsx
├── DocumentPreview.jsx
├── UploadProgress.jsx
├── DocumentStatusCard.jsx
├── ReviewStatusCard.jsx
├── IdentityCard.jsx
├── SelfieCard.jsx
├── DeviceMetadataCollector.jsx
└── index.js
```
