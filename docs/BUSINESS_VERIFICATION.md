# Business Verification

Phase 4 — Business verification system for the Fundora Trust Center.

## Architecture

Business verification extends the existing KYC/verification system with business-level identity verification. The system supports 11 business types, each with its own document requirements, and uses a configurable trust scoring model.

### Data Model

```
creator_verifications (1:1)
  └── business_verifications (1:1)
        └── business_documents (1:many)
```

**Tables:**

- `business_verifications` — Business name, type, GST/PAN/CIN, address (JSONB), status, provider reference
- `business_documents` — 17 document types with storage paths, validation status

### Business Types

| Type                  | Required Documents                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `individual`          | pan_card, aadhaar_card, address_proof                                                       |
| `sole_proprietorship` | gst_certificate, pan_card, business_address_proof, cancelled_cheque                         |
| `partnership`         | partnership_deed, gst_certificate, pan_card, business_address_proof, partner_identity_proof |
| `llp`                 | certificate_of_incorporation, gst_certificate, pan_card, partnership_deed                   |
| `private_limited`     | certificate_of_incorporation, gst_certificate, moa, aoa, director_identity_proof            |
| `public_limited`      | certificate_of_incorporation, gst_certificate, moa, aoa, director_identity_proof            |
| `ngo`                 | trust_registration, gst_certificate, pan_card, business_address_proof                       |
| `trust`               | trust_registration, gst_certificate, pan_card, business_address_proof                       |
| `society`             | society_registration, gst_certificate, pan_card, business_address_proof                     |
| `startup`             | certificate_of_incorporation, gst_certificate, udyam_registration, moa, pan_card            |
| `government`          | government_registration, pan_card, business_address_proof                                   |

## Libraries

### `lib/verification/businessVerification.js`

Core business verification CRUD operations.

**Functions:**

- `createBusinessVerification(userId, verificationId, businessData)` — Create/update business verification
- `updateBusinessVerification(userId, updates)` — Update business details
- `uploadBusinessDocument(userId, verificationId, documentType, file)` — Upload document
- `getBusinessVerification(userId)` — Get verification with documents (sanitized)
- `getBusinessDocuments(userId)` — List documents with masked names
- `validateGSTNumber(gst)` — 15-char GST format validation
- `validatePANNumber(pan)` — 10-char PAN format validation (5 alpha + 4 digit + 1 alpha)
- `validateCINNumber(cin)` — 21-char CIN format validation

### `lib/verification/documentRequirements.js`

Configuration-driven document requirements engine.

**Functions:**

- `getRequiredDocuments(businessType)` — Returns required documents for business type
- `getBankDocuments()` — Returns bank verification document requirements
- `getMissingDocuments(providedTypes, businessType)` — Calculates missing documents
- `checkDocumentCompletion(providedTypes, businessType)` — Returns completion percentage
- `getDocumentLabel(documentType)` — Human-readable document name
- `getBusinessTypeLabel(businessType)` — Human-readable business type name
- `listBusinessTypes()` — Returns all supported business types

### `lib/verification/gstVerification.js`

GST number verification via provider.

**Functions:**

- `verifyGSTNumber(userId, gstNumber)` — Submit GST for verification
- `checkGSTStatus(referenceId)` — Check verification status

### `lib/verification/panVerification.js`

PAN number verification via provider.

**Functions:**

- `verifyPANNumber(userId, panNumber)` — Submit PAN for verification
- `checkPANStatus(referenceId)` — Check verification status

## API Endpoints

### `pages/api/verification/business.js`

| Method | Action                              | Auth     | Rate Limit |
| ------ | ----------------------------------- | -------- | ---------- |
| `GET`  | Get business verification           | Required | 10/min     |
| `POST` | Create/update business verification | Required | 10/min     |
| `PUT`  | Update business details             | Required | 10/min     |

**POST body:**

```json
{
  "business_name": "Acme Corp",
  "business_type": "private_limited",
  "gst_number": "22AAAAA0000A1Z5",
  "pan_number": "ABCDE1234F",
  "cin_number": "L12345AB2023PLC000001",
  "address": {
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```

### `pages/api/verification/business-documents.js`

| Method | Action                   | Auth     | Rate Limit |
| ------ | ------------------------ | -------- | ---------- |
| `GET`  | List business documents  | Required | 10/min     |
| `POST` | Upload business document | Required | 10/min     |

**POST body (multipart):**

- `file` — Document file
- `documentType` — One of: gst_certificate, pan_card, aadhaar_card, certificate_of_incorporation, moa, aoa, partnership_deed, trust_registration, society_registration, udyam_registration, government_registration, business_address_proof, cancelled_cheque, director_identity_proof, partner_identity_proof

### `pages/api/verification/gst.js`

| Method | Action            | Auth     | Rate Limit |
| ------ | ----------------- | -------- | ---------- |
| `POST` | Verify GST number | Required | 10/min     |

**POST body:**

```json
{
  "action": "verify",
  "gstNumber": "22AAAAA0000A1Z5"
}
```

### `pages/api/verification/pan.js`

| Method | Action            | Auth     | Rate Limit |
| ------ | ----------------- | -------- | ---------- |
| `POST` | Verify PAN number | Required | 10/min     |

**POST body:**

```json
{
  "action": "verify",
  "panNumber": "ABCDE1234F"
}
```

## Admin Endpoints

### `pages/api/admin/business-review.js`

| Method | Action                  | Auth  | Rate Limit |
| ------ | ----------------------- | ----- | ---------- |
| `POST` | Approve/reject/resubmit | Admin | 10/min     |

**POST body:**

```json
{
  "action": "approve | reject | resubmit",
  "verificationId": "uuid",
  "reason": "Optional reason for rejection",
  "notes": "Optional reviewer notes"
}
```

## Security

- **GST, PAN, CIN numbers are never exposed** in API responses — only masked versions returned
- All operations are audit-logged via `auditLog.js`
- Uses `storageAdapter` for storage (not direct Supabase imports)
- Uses `secureLogger` for all logging (PII redaction)
- Encrypted metadata stored via AES-256-GCM
- RLS policies enforce user-level access control

## Trust Score Integration

Business verification contributes to the trust score via configurable weights:

```js
// VERIFICATION_WEIGHTS.business = 25
// BUSINESS_TYPE_MULTIPLIERS:
//   private_limited: 1.2  → bonus = 30
//   individual: 0.8       → bonus = 20
//   default: 1.0          → bonus = 25
```

## UI Components

- `BusinessVerificationCard.jsx` — Business status display with type, GST/PAN status
- `BusinessTypeSelector.jsx` — Grid selector for 11 business types
- `GSTValidator.jsx` — GST input with live format validation
- `CompletionIndicator.jsx` — Verification completion percentage (SVG circular indicator)
- `PendingActions.jsx` — List of pending verification actions
- `RejectedDocuments.jsx` — Rejected documents with resubmit CTA

## File Locations

| File                                                         | Purpose                       |
| ------------------------------------------------------------ | ----------------------------- |
| `lib/verification/businessVerification.js`                   | Core CRUD + validation        |
| `lib/verification/documentRequirements.js`                   | Config-driven document engine |
| `lib/verification/gstVerification.js`                        | GST verification              |
| `lib/verification/panVerification.js`                        | PAN verification              |
| `lib/verification/providers/businessVerificationProvider.js` | Mock provider                 |
| `lib/verification/providers/gstVerificationProvider.js`      | GST mock provider             |
| `lib/verification/providers/panVerificationProvider.js`      | PAN mock provider             |
| `pages/api/verification/business.js`                         | Business verification API     |
| `pages/api/verification/business-documents.js`               | Business document API         |
| `pages/api/verification/gst.js`                              | GST verification API          |
| `pages/api/verification/pan.js`                              | PAN verification API          |
| `pages/api/admin/business-review.js`                         | Admin business review         |
| `components/verification/BusinessVerificationCard.jsx`       | Status card component         |
| `components/verification/BusinessTypeSelector.jsx`           | Type selector component       |
| `components/verification/GSTValidator.jsx`                   | GST validation UI             |
