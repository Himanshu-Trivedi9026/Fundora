# Production Deployment Checklist

**Fundora — AI-Powered Crowdfunding Platform**
**Verification/KYC System**

---

## Environment Variables

### Required

| Variable | Description | Format |
|----------|-------------|--------|
| `ENCRYPTION_KEY` | AES-256-GCM encryption key for document metadata | 64-char hex string (32 bytes) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | JWT format |
| `JWT_SECRET` | Supabase JWT secret for token verification | String |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | JWT format |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `OTP_SALT` | Salt for OTP hashing | `fundora-otp-salt` |
| `OPENAI_API_KEY` | OpenAI API key for AI campaign generator | None |
| `RAZORPAY_KEY_ID` | Razorpay payment gateway key | None |
| `RAZORPAY_KEY_SECRET` | Razorpay payment gateway secret | None |

### Generating ENCRYPTION_KEY

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
```

**CRITICAL:** Store this in a secure secrets manager (Vercel Environment Variables, AWS Secrets Manager, etc.). Never commit to source control.

---

## Required Secrets

| Secret | Purpose | Where to Store |
|--------|---------|----------------|
| `ENCRYPTION_KEY` | Encrypts document metadata (AES-256-GCM) | Secrets manager |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB operations bypassing RLS | Secrets manager |
| `JWT_SECRET` | Token verification for auth | Secrets manager |
| `OPENAI_API_KEY` | AI campaign text generation | Secrets manager |
| `RAZORPAY_KEY_SECRET` | Payment processing | Secrets manager |

---

## Database Migrations

### Migration Order (CRITICAL — must run in order)

1. **`001_creator_verifications.sql`**
   - Creates `creator_verifications` table
   - Creates `verification_history` table
   - Creates `verification_documents` table
   - Enables RLS on all tables
   - Creates indexes

2. **`002_verification_history_and_documents.sql`**
   - Extends `verification_history` with expiry_status
   - Extends `verification_documents` with document_type CHECK
   - Creates audit log policies
   - Creates storage bucket policies

3. **`003_verification_requests.sql`**
   - Creates `verification_requests` table
   - Creates `verification_sessions` table
   - Creates `verification_otp` table
   - Creates `verification_audit_log` table
   - Extends existing CHECK constraints
   - Enables RLS on all new tables
   - Creates indexes

### Apply Migrations

```bash
# Using Supabase CLI
supabase db push

# Or manually via Supabase Dashboard SQL Editor
# Run each migration file in order
```

### Rollback Procedure

```bash
# If issues arise, drop tables in reverse order:
# 1. Drop verification_audit_log
# 2. Drop verification_otp
# 3. Drop verification_sessions
# 4. Drop verification_requests
# 5. Drop verification_documents
# 6. Drop verification_history
# 7. Drop creator_verifications

# Or restore from backup (recommended)
```

---

## Storage Buckets

### Required: `verification-docs`

1. Go to Supabase Dashboard → Storage → New Bucket
2. Name: `verification-docs`
3. Public: **No** (private bucket)
4. File size limit: 10MB
5. Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`

### Storage Policies

```sql
-- Allow authenticated users to upload their own documents
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own documents
CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role can access all documents
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'verification-docs');
```

---

## RLS Verification

### Verify RLS is Enabled

Run this in Supabase SQL Editor:

```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'verification%'
  OR tablename = 'creator_verifications'
ORDER BY tablename;
```

Expected: All 7 tables show `rowsecurity = true`.

### Verify Policies Exist

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename LIKE 'verification%' OR tablename = 'creator_verifications')
ORDER BY tablename, policyname;
```

Expected: Multiple policies per table covering SELECT, INSERT, UPDATE, DELETE.

---

## Backup Checklist

### Before Deployment

- [ ] **Database backup:** Export full Supabase database
- [ ] **Storage backup:** Download all files from `verification-docs` bucket
- [ ] **Config backup:** Export environment variables (without secrets)
- [ ] **Code backup:** Tag current commit: `git tag pre-phase4-deploy`

### Backup Commands

```bash
# Database backup (using pg_dump)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Or use Supabase Dashboard → Settings → Database → Backups
```

---

## Monitoring Setup

### What to Monitor

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| API response time (verification endpoints) | > 2s | Check DB queries, add indexes |
| Error rate (verification API) | > 5% | Check logs, investigate |
| Failed login attempts | > 10/min per IP | Rate limiting active |
| OTP verification failures | > 3 per user | Account lockout check |
| Storage upload failures | > 0 | Check bucket policies |
| Encryption/decryption errors | > 0 | Check ENCRYPTION_KEY |

### Structured Logging

All verification operations log via `secureLogger.js`:
- Format: JSON with `level`, `module`, `message`, `timestamp`, `data`
- PII auto-redacted: phone numbers, emails, IPs, tokens, OTPs
- Log levels: `debug`, `info`, `warn`, `error`

### Log Rotation

Configure log rotation on your hosting platform:
- Retention: 30 days minimum
- Compression: Enable for older logs
- Storage: Ensure sufficient disk space for structured JSON logs

---

## Deployment Steps

### Pre-Deployment

1. [ ] Run `npx vitest run` — all 971 tests pass
2. [ ] Run `npm run build` — clean build, no errors
3. [ ] Verify all environment variables are set
4. [ ] Apply database migrations (001 → 002 → 003)
5. [ ] Verify RLS is enabled on all 7 tables
6. [ ] Create `verification-docs` storage bucket
7. [ ] Verify storage policies are active

### Deployment

8. [ ] Deploy to staging environment first
9. [ ] Run smoke tests on staging:
   - [ ] Login/signup works
   - [ ] Verification dashboard renders
   - [ ] Document upload works
   - [ ] OTP flow works (if phone verification enabled)
10. [ ] Monitor staging for 24 hours
11. [ ] Deploy to production

### Post-Deployment

12. [ ] Verify production logs are structured JSON
13. [ ] Test verification flow end-to-end
14. [ ] Monitor error rates for 48 hours
15. [ ] Verify no console.log in production (bypass test)
16. [ ] Update monitoring dashboards

---

## Rollback Procedure

### If Issues Occur

1. **Immediate:** Revert to previous deployment
   ```bash
   # Vercel
   vercel rollback

   # Or redeploy previous commit
   git revert HEAD && git push
   ```

2. **Database:** Restore from backup if migrations caused issues
   ```bash
   # Restore database
   psql $DATABASE_URL < backup_YYYYMMDD.sql
   ```

3. **Storage:** No rollback needed (bucket is independent of code)

4. **Monitor:** Watch for 1 hour after rollback

### Rollback Decision Matrix

| Issue | Action |
|-------|--------|
| Tests failing | Fix code, do NOT rollback DB |
| DB migration error | Rollback DB, keep code |
| Encryption errors | Check ENCRYPTION_KEY, do NOT rollback |
| Storage errors | Check bucket policies |
| Auth errors | Check SUPABASE_SERVICE_ROLE_KEY |

---

## Post-Phase 4 Checklist

After Phase 4 (Provider Integration):

- [ ] At least 1 real KYC provider connected
- [ ] VerificationWizard mounted in pages
- [ ] E2E tests passing against live Supabase
- [ ] Performance: First-load JS < 300KB per route
- [ ] Lighthouse CI integrated in deployment pipeline
- [ ] Real user monitoring (RUM) enabled
