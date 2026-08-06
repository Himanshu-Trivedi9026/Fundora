# Fundora — Production Readiness Audit Report

**Date:** 2026-08-01
**Scope:** Authentication, Authorization, Storage, Media, Payments, Notifications, Chat, Campaigns, Analytics, Dashboard, Database, Supabase Policies, RLS, Performance, Security, Accessibility, SEO, Responsive Design, Loading states, Error handling, Code duplication, Dead code, Broken imports, Broken API routes, Console errors, Hydration issues, Memory leaks, Image optimization, Database indexes.

All findings verified against source. Severity: **Critical** > **Major** > **Minor**.

---

## CRITICAL

### C1. Six admin API routes guarded only by `withAuth` — privilege escalation
**Files:** `pages/api/admin/bank-review.js:12`, `business-review.js:12`, `policy-management.js:23`, `review-queue.js:12`, `appeals-dashboard.js:22`, `platform-analytics.js:26`
**Scenario:** Any signed-in donor can approve bank verifications, change platform-wide policies, pull every user's KYC documents (PII), overturn appeal decisions, and read all platform analytics.
**Fix:** Wrap each in `withRole(handler, [ROLES.ADMIN])`.

### C2. Escrow fund release / freeze has no authorization — anyone can drain escrow or freeze accounts
**Files:** `pages/api/escrow/release.js:14`; `lib/escrow/releaseEngine.js:45,190`; `lib/escrow/escrowRules.js`
**Scenario:** Any authenticated user calls `POST /api/escrow/release` with arbitrary `escrowAccountId`/`amount` → funds released (money movement) or `action:"freeze"` → financial DoS.
**Fix:** Require `escrow_accounts.creator_id === user.id` OR `withRole([ROLES.ADMIN])`.

### C3. Milestone review vote weight is client-forged — any donor can force milestone approval
**Files:** `pages/api/milestone/review.js:50`; `lib/milestone/milestoneReview.js:106`
**Scenario:** Attacker posts `{voteWeight: 1e9}` → approval sum passes → escrow release triggered, defeating the donor-approval gate.
**Fix:** Compute vote weight server-side from verified `public_donations.amount`; ignore client `voteWeight`.

### C4. MCP endpoint exposes service-role reads of any user's data (IDOR)
**Files:** `pages/api/mcp/index.js:24`; `lib/mcp/mcpServer.js:103,126,157,181,210`
**Scenario:** Any signed-in user calls `POST /api/mcp` with `{tool:"donation_summary", args:{userId:<victim>}}` to read any user's donation/escrow history and internal fraud flags.
**Fix:** Scope tool queries by `context.user.id`; restrict `fraud_flags`/`platform_metrics`/`org_info` to admin/creator.

### C5. Razorpay `verify` trusts client-supplied amount — donation amount inflation + replay
**Files:** `pages/api/razorpay/verify.js:17-24,68`; `pages/api/razorpay/create-order.js:60-72`
**Scenario:** Payer completes a ₹10 payment then calls verify with `{amount: 1000000}`. HMAC signs only `order_id|payment_id`, so a ₹10M donation is recorded; the same signature can be replayed against any `projectId` (no idempotency, no order↔project binding).
**Fix:** Fetch order server-side and use `order.amount_paid`; persist `order_id → {project_id, amount, user_id}` at creation; UNIQUE on `public_donations.razorpay_payment_id` + pre-insert SELECT.

### C6. Core tables have no RLS — DMs, donations, followers, chat exposed to anon/authenticated clients
**Files:** `supabase/migrations/` (no RLS DDL for `projects`, `public_donations`, `followers`, `dm_conversations`, `dm_messages`, `project_messages`, `media`); `pages/dm/*`, `components/ProjectChat.jsx`, `pages/projects/[id]/fund.js`
**Scenario:** Any client (anon/authenticated) can `select * from dm_messages`, read every donation's `payer_id`+`razorpay_payment_id`, subscribe to realtime channels for full row payloads, and insert forged rows directly through the browser client.
**Fix:** Enable RLS per table with participant/owner policies + `service_role` ALL for server engines; change `fund.js` to select safe columns.

### C7. Live `notifications` table has RLS disabled; fix migration never applied
**Files:** `supabase/migrations/014_notification_rls_fix.sql` (unapplied); live DB verified
**Scenario:** Anon can read/insert any user's notifications; `notification_preferences` absent (PGRST205).
**Fix:** Apply migration 014 (+015).

### C8. AI funding-recommendation API full-table scans + reads non-existent columns
**Files:** `pages/api/ai/funding-recommendation.js:26-31`
**Scenario:** Every request streams entire `projects`+`public_donations` into memory; reads `p.category`/`p.likes`/`p.dislikes` (don't exist) → wrong AI output, high load.
**Fix:** Select only needed columns, filter `deleted=false`, `.limit(1000)`, use `categories`.

### C9. Migration 012 references non-existent `users` table — broken FK
**Files:** `supabase/migrations/012_infrastructure.sql:56,106`
**Scenario:** Applying migration 012 fails ("relation users does not exist"); `job_queue`/`scheduled_jobs` can't deploy.
**Fix:** `REFERENCES auth.users(id)`.

### C10. Stored XSS via JSON-LD `structuredData`
**Files:** `components/SEO.jsx:70`; `pages/projects/[id].js:225`
**Scenario:** A project title containing `</script><script>…</script>` breaks out of the JSON-LD script tag → stored XSS on every project page view.
**Fix:** Escape `<` before embedding: `JSON.stringify(x).replace(/</g, '\\u003c')`.

---

## MAJOR

### M1. Escrow account read IDOR — any user can view any campaign's escrow
**Files:** `pages/api/escrow/account.js:33`; `lib/escrow/escrowAccount.js:180`
**Fix:** Verify campaign owner or admin.

### M2. Storage upload / signed-URL routes allow arbitrary object writes/reads (IDOR)
**Files:** `pages/api/storage/upload.js:16`; `pages/api/storage/signed-url.js:17`; `lib/storage/storageAdapter.js:29`; `lib/storage/signedUrlEngine.js:6`
**Scenario:** Authenticated user uploads to `{bucket:"avatars", path:"<victim>/<file>"}` to overwrite others' files, or mints signed URLs for any private object (KYC docs).
**Fix:** Enforce user-owned path prefix, bucket allowlist, ownership checks.

### M3. Tenant settings/quota IDOR — any user can read/write any tenant
**Files:** `pages/api/tenants/settings.js:9`; `pages/api/tenants/quotas.js:9`; `lib/tenants/tenantManager.js:170`
**Fix:** Require `tenantId === req.user.organization_id` unless admin.

### M4. Webhook credits donations from client-controllable `notes.projectId`; refunds ignored
**Files:** `pages/api/razorpay/webhook.js:46-99`
**Scenario:** Client opens checkout with victim's projectId in notes → webhook credits victim project; refunded donations stay `status='success'`, `pledged` never decremented.
**Fix:** Resolve project from persisted order mapping; handle `refund.processed`/`payment.failed`.

### M5. Arbitrary file upload to public buckets — no server-side MIME validation
**Files:** `lib/storage.js:3-56`; `lib/uploadCreatorFile.js`; `components/MediaUploader.jsx`; `components/create/MediaStep.jsx`
**Scenario:** `evil.html`/`evil.svg` uploaded → served from public bucket → stored XSS/phishing under the app's storage host.
**Fix:** Server-side MIME whitelist (magic bytes), block `text/html`/`image/svg+xml`, per-bucket size caps.

### M6. Creator Razorpay `key_secret` stored in plaintext (UI claims encryption)
**Files:** `supabase/creator_payment_configs.sql:4`; `pages/api/creator/razorpay-config.js:35-45`
**Fix:** Encrypt at rest (AES-256-GCM / Vault) or reference from a secrets manager; never return plaintext.

### M7. Realtime publication ships full row payloads (amplifies C6)
**Files:** `supabase/migrations/013_project_chat_receipts.sql:19-25`
**Fix:** Enable RLS on every published table (RLS filters broadcasts).

### M8. Background job/event endpoints open to all authenticated users (DoS)
**Files:** `pages/api/jobs/process.js:39`; `pages/api/events/process.js:33`
**Fix:** Wrap with `withRole([ROLES.ADMIN])`.

### M9. Unauthenticated diagnostics/infrastructure disclosure
**Files:** `pages/api/diagnostics/index.js:8`; `pages/api/infrastructure/queues.js:5`; `pages/api/health/database.js:4`
**Fix:** Require auth/admin; strip memory/node details.

### M10. Connectors/agents/flags IDOR — mutate resources owned by others
**Files:** `pages/api/connectors/index.js:47-76`; `pages/api/agents/index.js:38-46`; `pages/api/flags/index.js:64-77`
**Fix:** Pass `user.id` into engine mutations; enforce `created_by`/org membership; `withRole` for flags.

### M11. Analytics dashboards IDOR
**Files:** `pages/api/analytics/index.js:32-54`
**Fix:** Scope by `created_by = user.id`.

### M12. No ErrorBoundary, no `_error.js`, no `404.js` — blank screen on any render error
**Files:** `pages/_app.js`; `pages/_error.js` (absent); `pages/404.js` (absent)
**Fix:** Class ErrorBoundary wrapping `<Component/>`; branded `_error.js` + `404.js`.

### M13. Entire app client-side rendered — dynamic pages not indexable (SEO)
**Files:** all `pages/` (0 pages use getServerSideProps/getStaticProps)
**Fix:** SSG/ISR for `projects/[id]`, `explore`, `creator/[id]`, landing.

### M14. `pages/projects/[id].js` — infinite loading + misleading error on fetch failure
**Files:** `pages/projects/[id].js:66-117,154-173`
**Fix:** Separate primary fetch; setError + error UI on failure.

### M15. `PageLayout.jsx` hydration mismatch — affects ~50 pages
**Files:** `components/PageLayout.jsx:20-22,55-62`
**Scenario:** `useState(localStorage…)` + `window.innerWidth` read during first client render mismatch server.
**Fix:** Initialize `false`/`0`; read localStorage/innerWidth in useEffect.

### M16. Fixed Sidebar overlays content on mobile — dashboards unusable on phones
**Files:** `components/Sidebar.jsx:391-394`; `components/PageLayout.jsx:55-62`
**Fix:** Hide below `md`, render as drawer (Navbar `menuOpen` exists).

### M17. `ConnectionCard` — fabricated random data + non-deterministic hydration
**Files:** `components/connections/ConnectionCard.jsx:20,29`
**Fix:** Remove simulated count/badge or derive from real data.

### M18. `pages/saved.js` — no loading and no error state
**Files:** `pages/saved.js:8-70`
**Fix:** Add loading/error state.

### M19. Account deletion cleans wrong columns — rows orphaned
**Files:** `pages/api/account/delete.js:37-55`
**Fix:** `public_donations.by: "payer_id"`; `dm_conversations` by `user1`/`user2`; `dm_messages.recipient_id`→`sender_id`.

### M20. App queries tables that don't exist in live schema (silent failures)
**Files:** `pages/explore.js:122`, `pages/creator/[id].js:81` (`creator_verifications`); `lib/ai/predictionEngine.js:931` (`users`,`donations`); `lib/ai/copilotEngine.js:245` (`campaigns`,`donations`); `lib/ai/recommendationEngine.js:793` (`users`); `lib/analytics/analyticsEngine.js:165` (`users`); `lib/escrow/escrowEngine.js:492` (`campaigns`); `lib/moderation/aiModerator.js:409` (`campaigns`); `pages/api/account/delete.js:56` (`organization_members`)
**Fix:** Drive creator status from `profiles.role`; rewrite AI libs against real tables.

### M21. Missing indexes on every hot query path
**Files:** query sites across `lib/explore`, `pages/dm/*`, `pages/investor/*`, `pages/api/razorpay/*`
**Fix:** Add the 12-index batch (see DB findings).

### M22. DM inbox/history loaded unbounded (full nested message history, no limit)
**Files:** `pages/dm/[userId].js:36-61`; `pages/dm/index.js`
**Fix:** Paginate nested + top-level with `.limit()`/`.range()`; select only rendered columns.

### M23. Homepage stats full-table scan of `projects`
**Files:** `components/landing/StatsBar.jsx:82-83`
**Fix:** Postgres aggregate RPC (SECURITY DEFINER).

### M24. Creator profile fetches all projects `select("*")` no limit
**Files:** `pages/creator/[id].js:53`
**Fix:** Select rendered columns + paginate.

### M25. Payment history unbounded
**Files:** `pages/investor/payment-history.js:28-44`; `pages/payments/index.js:82-95`
**Fix:** Add `.limit(25)` pagination.

### M26. Migration 011: uuid-vs-text policy comparisons (500 errors) + tables with RLS enabled but zero policies (fully locked)
**Files:** `supabase/migrations/011_ecosystem.sql:409-444`
**Fix:** Cast consistently; add `service_role` + owner policies for `agent_memory`, `event_bus`, `feature_flags`, etc.

### M27. Notifications schema drift: 007 vs 014 define incompatible `notification_preferences`
**Files:** `supabase/migrations/007_compliance_reputation_governance.sql:346`; `supabase/migrations/014_notification_rls_fix.sql:48`
**Fix:** Supersede 007's block; standardize on 014.

---

## MINOR

- **m1** Backup/restore/deployments are `withAuth` only — should be admin. (`backup/backups.js:44`, `backup/restore.js:36`, `deployments/index.js:93`, `deployments/rollback.js:61`)
- **m2** Open redirect on `/login` — `router.push(router.query.redirect)` unvalidated. (`pages/login.js:138-141`)
- **m3** CSP allows `'unsafe-eval'` and `'unsafe-inline'` in script-src. (`next.config.mjs:86`)
- **m4** Account deletion returns internal details to client. (`account/delete.js:156-160`)
- **m5** AI campaign generation open to all users (cost abuse). (`api/ai/generate-campaign.js:7`)
- **m6** `withAuthAndPermission` accepts org id from client. (`lib/withAuth.js:75`)
- **m7** Many API catch blocks leak `err.message` to clients. (backup, deployments, connectors, agents, tenants, jobs, diagnostics)
- **m8** Analytics export no role/ownership check. (`api/export-analytics.js:13`)
- **m9** Navbar unread-DM count queries global `dm_messages` + phantom `read` column. (`components/Navbar.jsx:122-130`)
- **m10** Unsanitized upload paths + no gallery size cap. (`lib/storage.js:20-21`)
- **m11** Order creation no upper-bound/tier validation. (`create-order.js:18-21`)
- **m12** DM thread creation doesn't validate counterpart / block self-DM / enforce block-mute. (`dm/[userId].js:113-127`)
- **m13** Chat message delete unauthenticated-by-ownership. (`ProjectChat.jsx:475-485`)
- **m14** No skip-to-content link. (`pages/_app.js:20`)
- **m15** `pages/home.js` — dead duplicate landing page, no SEO.
- **m16** Landing data sections lack loading/error states. (`TrendingProjects.jsx`, `StatsBar.jsx`)
- **m17** Plain `<img>` bypass next/image (4 sites). (`creator/profile.js:164,204`, `SelfieVerificationStep.jsx:331`, `MediaStep.jsx:105`)
- **m18** DM typing timer not cleared on unmount. (`dm/[userId].js:710-712`)
- **m19** NotificationCenter no request race guard. (`NotificationCenter.jsx:108-118`)
- **m20** SEO canonical/sitemap hardcode `https://fundora.vercel.app`. (`components/SEO.jsx:31`, `public/sitemap.xml`)
- **m21** ProjectCard nested interactive elements (a11y). (`ProjectCard.jsx:52-165`)
- **m22** ConnectionCard mail button no aria-label/no handler. (`ConnectionCard.jsx:100-107`)
- **m23** Fullscreen image preview uses unoptimized `motion.img`. (`projects/[id].js:380-388`)
- **m24** Misleading/leaky `console.error` messages. (`projects/[id].js:112`, `creator/funds-got.js:38`, `account/delete.js:58`)
- **m25** Focus not moved to `#main-content` on route change. (`pages/_app.js:20`)
- **m26** Escrow `milestone_reviews`/`campaign_milestones` publicly readable. (`migrations/006:281,311`)
- **m27** `api_rate_limits` RLS enabled with no policy. (`migrations/010:532`)
- **m28** Campaign-publish notification fan-out unbounded+synchronous. (`migrations/015:104-121`)
- **m29** Migration 016 inert profile policies would break public browsing if RLS ever enabled. (`migrations/016:126-137`)
- **m30** 4 eslint warnings: `FollowContext.js:50`, `VerificationContext.js:538` (exhaustive-deps); `creator/profile.js:164,204` (no-img-element).
- **m31** Storage adapter provider never registered — storage API routes are dead code. (`lib/storage/storageAdapter.js:118`)

---

## POSITIVE (verified, no change needed)
- `lib/withAuth.js` Bearer-token validation — correct.
- `proxy.js` role gating (admin/creator/investor/create/edit) — correct.
- Login/signup/forgot/reset flows + reset-password recovery session validation — correct.
- Webhook HMAC uses raw body + `timingSafeEqual` — correct.
- Receipt generation checks `payer_id = user.id`.
- Notification engine enforces ownership in code; unread counts use `head: true`.
- Chat/DM message content rendered as React text — no `dangerouslySetInnerHTML` XSS.
- CSP/HSTS/frame/permissions headers configured for production.
- Supabase realtime channels + intervals all cleaned up (no memory leaks) except DM typing timer (m18).
- Images: `priority`/`sizes` used correctly; remotePatterns cover all image hosts.
- No references remain to deleted files (`FiltersSidebar.jsx`, `ThemeContext.js`).

---

## FIXES APPLIED (this session)

| # | Issue | Fix |
|---|-------|-----|
| 1 | **Build blocker**: middleware.js + proxy.js conflict | Merged role logic into `proxy.js`, deleted `middleware.js`. Build green. |
| 2 | **14 eslint errors** `react-hooks/set-state-in-effect` (Major, React 19) | Fixed all 14 across 12 files: adjust-state-during-render for imgError resets (ProjectCard, ExploreCard, Sidebar) and `queueMicrotask` deferral for fetch-in-effect patterns. |
| 3 | **1 eslint error** `preserve-manual-memoization` | Ref-snapshot for `readByMap` + targeted disable with justification. |
| — | eslint result | **0 errors, 4 warnings** (pre-existing Minor). |
