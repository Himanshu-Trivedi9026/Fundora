# 📋 Fundora — Manual QA Verification Guide

**Document:** `docs/MANUAL_TEST_PLAN.md`
**Author:** Senior QA Lead
**Date:** 2026-07-30
**Version:** 1.0
**Scope:** Full-platform manual verification across all 12 phases
**User-Facing Routes:** 42 pages | **Components:** ~152 | **API Routes:** 130+

---

## Table of Contents

1. [Test Environment Configuration](#1-test-environment-configuration)
2. [Phase 1-3: Foundation & Core Features](#2-phase-1-3-foundation--core-features)
3. [Phase 4: Business & Bank Verification (Trust Center)](#3-phase-4-business--bank-verification-trust-center)
4. [Phase 5: Fraud Detection & Risk Management](#4-phase-5-fraud-detection--risk-management)
5. [Phase 6: Escrow, Milestones & Payouts](#5-phase-6-escrow-milestones--payouts)
6. [Phase 7: Compliance, Reputation & Governance](#6-phase-7-compliance-reputation--governance)
7. [Phase 8: Enterprise Organizations & API Platform](#7-phase-8-enterprise-organizations--api-platform)
8. [Phase 9: AI Platform](#8-phase-9-ai-platform)
9. [Phase 10: Global Platform & Production Scale](#9-phase-10-global-platform--production-scale)
10. [Phase 11: Ecosystem Platform](#10-phase-11-ecosystem-platform)
11. [Phase 12: Infrastructure & Observability](#11-phase-12-infrastructure--observability)
12. [Master QA Checklist](#12-master-qa-checklist)

---

## 1. Test Environment Configuration

### Browsers / Devices

| Browser       | Version | Status     |
| ------------- | ------- | ---------- |
| Chrome        | Latest  | ☐ Verified |
| Firefox       | Latest  | ☐ Verified |
| Safari        | Latest  | ☐ Verified |
| Edge          | Latest  | ☐ Verified |
| Mobile Chrome | Android | ☐ Verified |
| Mobile Safari | iOS     | ☐ Verified |

### Screen Sizes

| Size      | Breakpoint         | Status     |
| --------- | ------------------ | ---------- |
| 1920×1080 | Desktop            | ☐ Verified |
| 1440×900  | Laptop             | ☐ Verified |
| 1024×768  | Tablet (Landscape) | ☐ Verified |
| 768×1024  | Tablet (Portrait)  | ☐ Verified |
| 375×812   | Mobile             | ☐ Verified |
| 320×568   | Small Mobile       | ☐ Verified |

### User Profiles for Testing

| Role                 | Email                     | Purpose                          |
| -------------------- | ------------------------- | -------------------------------- |
| Super Admin          | `admin@fundora.test`      | All admin panels, review queues  |
| Creator (Verified)   | `creator@fundora.test`    | Campaigns, verification, payouts |
| Creator (Unverified) | `newcreator@fundora.test` | Onboarding, verification flow    |
| Donor                | `donor@fundora.test`      | Browsing, donations, reviews     |
| Enterprise Admin     | `orgadmin@fundora.test`   | Org management, RBAC             |
| Org Member           | `orgmember@fundora.test`  | Organization restricted access   |
| Developer            | `dev@fundora.test`        | API keys, app registration       |
| Unregistered User    | —                         | Login, signup, landing, explore  |

### Pre-Check: Environment Health

| Check            | Steps                | Expected                  | Result        |
| ---------------- | -------------------- | ------------------------- | ------------- |
| Dev Server       | `npm run dev`        | No error output           | ☐ Pass ☐ Fail |
| Build            | `npm run build`      | 0 errors                  | ☐ Pass ☐ Fail |
| Supabase         | Check local instance | All 12 migrations applied | ☐ Pass ☐ Fail |
| Razorpay         | Test key configured  | Payment modal opens       | ☐ Pass ☐ Fail |
| AI Provider      | API key test         | AI endpoints return 200   | ☐ Pass ☐ Fail |
| Redis (optional) | `redis-cli ping`     | `PONG`                    | ☐ Pass ☐ Fail |
| Test Data        | Seed scripts run     | Sample data in all tables | ☐ Pass ☐ Fail |

---

## 2. Phase 1-3: Foundation & Core Features

### Objective

Verify all core crowdfunding functionality: user authentication, campaign lifecycle, payment processing, creator dashboard, project browsing, DM messaging, and basic KYC.

### Prerequisites

- Supabase running with migrations 001-003 applied
- Seed data: at least 5 test campaigns, 3 test users, donation records
- Razorpay test account with keys in `.env`
- Test images for upload (JPG <2MB, PNG <2MB)
- Second browser session for real-time testing (DM, notifications)

---

### 2.1 Landing Page (`/`)

| TC-ID     | Feature                        | Steps                            | Expected Result                                      | Pass/Fail     |
| --------- | ------------------------------ | -------------------------------- | ---------------------------------------------------- | ------------- |
| TC-P1-001 | Hero Section                   | 1. Navigate to `/`               | Hero renders with title, subtitle, CTAs              | ☐ Pass ☐ Fail |
| TC-P1-002 | "Explore Campaigns" CTA        | 1. Click button                  | Redirects to `/explore`                              | ☐ Pass ☐ Fail |
| TC-P1-003 | "Start a Campaign" CTA (Auth)  | 1. Login first, then click       | Redirects to `/create`                               | ☐ Pass ☐ Fail |
| TC-P1-004 | "Start a Campaign" CTA (Guest) | 1. Click while logged out        | Redirects to `/login`                                | ☐ Pass ☐ Fail |
| TC-P1-005 | Stats Bar                      | 1. Scroll to stats section       | Animated counters: total funded, creators, campaigns | ☐ Pass ☐ Fail |
| TC-P1-006 | Stats Animation                | 1. Observe on intersection       | Numbers animate 0 → final value                      | ☐ Pass ☐ Fail |
| TC-P1-007 | Trending Projects              | 1. Scroll to section             | Cards with image, title, progress, amount            | ☐ Pass ☐ Fail |
| TC-P1-008 | Trending Project Click         | 1. Click a project card          | Navigates to `/projects/[id]`                        | ☐ Pass ☐ Fail |
| TC-P1-009 | How It Works                   | 1. Scroll to section             | 3-4 step cards explain platform                      | ☐ Pass ☐ Fail |
| TC-P1-010 | Final CTA Section              | 1. Scroll to bottom CTA          | "Get Started" banner with CTA                        | ☐ Pass ☐ Fail |
| TC-P1-011 | Navbar (Guest)                 | 1. View as logged-out            | Logo, Explore, Login, Signup                         | ☐ Pass ☐ Fail |
| TC-P1-012 | Navbar (Logged In)             | 1. Login, then view navbar       | Avatar, bell icon, DM icon, Create button            | ☐ Pass ☐ Fail |
| TC-P1-013 | Footer                         | 1. Scroll to bottom              | Links, social icons, copyright                       | ☐ Pass ☐ Fail |
| TC-P1-014 | Loading State                  | 1. Throttle network to Slow 3G   | Skeleton/spinner during data fetch                   | ☐ Pass ☐ Fail |
| TC-P1-015 | Error State                    | 1. Disconnect network            | Error message + retry CTA                            | ☐ Pass ☐ Fail |
| TC-P1-016 | Responsive (Mobile 375px)      | 1. Resize viewport               | Sections stack, no overflow                          | ☐ Pass ☐ Fail |
| TC-P1-017 | Lighthouse A11y                | 1. Run Lighthouse audit          | Accessibility score ≥ 90                             | ☐ Pass ☐ Fail |
| TC-P1-018 | Page Metadata                  | 1. Check `<title>` and meta tags | SEO meta tags present and correct                    | ☐ Pass ☐ Fail |
| TC-P1-019 | Skip to Content                | 1. Tab on page load (a11y)       | "Skip to content" link visible                       | ☐ Pass ☐ Fail |

---

### 2.2 Authentication: Login (`/login`)

| TC-ID     | Feature                | Steps                                     | Expected Result                                                 | Pass/Fail     |
| --------- | ---------------------- | ----------------------------------------- | --------------------------------------------------------------- | ------------- |
| TC-P1-020 | Page Load              | 1. Navigate to `/login`                   | Email/password fields, Login button, OAuth buttons, Signup link | ☐ Pass ☐ Fail |
| TC-P1-021 | Successful Login       | 1. Enter valid credentials → Click Login  | Redirected to `/home` or previous guarded page                  | ☐ Pass ☐ Fail |
| TC-P1-022 | Invalid Password       | 1. Enter wrong password                   | Error: "Invalid login credentials"                              | ☐ Pass ☐ Fail |
| TC-P1-023 | Non-existent Email     | 1. Enter unregistered email               | Error: "Invalid login credentials"                              | ☐ Pass ☐ Fail |
| TC-P1-024 | Empty Submission       | 1. Click Login without input              | Validation: both fields required                                | ☐ Pass ☐ Fail |
| TC-P1-025 | Invalid Email Format   | 1. Type "notanemail"                      | Validation: "Invalid email format"                              | ☐ Pass ☐ Fail |
| TC-P1-026 | Loading State          | 1. Submit valid form                      | Button shows spinner, disabled state                            | ☐ Pass ☐ Fail |
| TC-P1-027 | OAuth Login (Google)   | 1. Click "Sign in with Google"            | Redirect to Google, then back to app                            | ☐ Pass ☐ Fail |
| TC-P1-028 | OAuth Login (GitHub)   | 1. Click "Sign in with GitHub"            | Redirect to GitHub, then back to app                            | ☐ Pass ☐ Fail |
| TC-P1-029 | Forgot Password        | 1. Click "Forgot Password"                | Password reset flow triggers                                    | ☐ Pass ☐ Fail |
| TC-P1-030 | Post-Login Redirect    | 1. Try `/create` while logged out → Login | Redirected back to `/create`                                    | ☐ Pass ☐ Fail |
| TC-P1-031 | Session Persistence    | 1. Login → Close tab → Reopen             | Still logged in                                                 | ☐ Pass ☐ Fail |
| TC-P1-032 | Network Error          | 1. Disconnect network → Submit            | Error message displayed                                         | ☐ Pass ☐ Fail |
| TC-P1-033 | Keyboard Nav           | 1. Tab through form                       | All fields focusable, visible outlines                          | ☐ Pass ☐ Fail |
| TC-P1-034 | Password Field Masking | 1. Type in password                       | Characters masked (•••)                                         | ☐ Pass ☐ Fail |
| TC-P1-035 | Tab Order              | 1. Press Tab repeatedly                   | Email → Password → Login → OAuth links                          | ☐ Pass ☐ Fail |

### 2.3 Authentication: Signup (`/signup`)

| TC-ID     | Feature                 | Steps                               | Expected Result                                | Pass/Fail     |
| --------- | ----------------------- | ----------------------------------- | ---------------------------------------------- | ------------- |
| TC-P1-036 | Page Load               | 1. Navigate to `/signup`            | Name, Email, Password, Confirm Password fields | ☐ Pass ☐ Fail |
| TC-P1-037 | Successful Registration | 1. Fill valid details → Submit      | Account created, verification sent, redirect   | ☐ Pass ☐ Fail |
| TC-P1-038 | Password Mismatch       | 1. Different passwords in fields    | Error: "Passwords do not match"                | ☐ Pass ☐ Fail |
| TC-P1-039 | Weak Password           | 1. Password "123"                   | Error: "Minimum 6 characters"                  | ☐ Pass ☐ Fail |
| TC-P1-040 | Duplicate Email         | 1. Register with existing email     | Error: "User already registered"               | ☐ Pass ☐ Fail |
| TC-P1-041 | Empty Fields            | 1. Submit blank form                | All required fields show validation            | ☐ Pass ☐ Fail |
| TC-P1-042 | Loading State           | 1. Submit form                      | Button spinner, disabled                       | ☐ Pass ☐ Fail |
| TC-P1-043 | OAuth Signup            | 1. Click Google/GitHub              | Account created via OAuth                      | ☐ Pass ☐ Fail |
| TC-P1-044 | Email Verification      | 1. Register new email               | Verification email sent to inbox               | ☐ Pass ☐ Fail |
| TC-P1-045 | Name Field Valid        | 1. Enter name with special chars    | Accepts valid characters                       | ☐ Pass ☐ Fail |
| TC-P1-046 | Long Name               | 1. Enter 100+ char name             | Truncated or validation error                  | ☐ Pass ☐ Fail |
| TC-P1-047 | Link to Login           | 1. Click "Already have an account?" | Navigates to `/login`                          | ☐ Pass ☐ Fail |

---

### 2.4 Home Page (`/home`)

| TC-ID     | Feature            | Steps                                  | Expected Result                                                  | Pass/Fail     |
| --------- | ------------------ | -------------------------------------- | ---------------------------------------------------------------- | ------------- |
| TC-P1-050 | Page Load          | 1. Navigate to `/home` (authenticated) | Project feed with recommended/most-relevant campaigns            | ☐ Pass ☐ Fail |
| TC-P1-051 | Project Feed       | 1. Scroll down                         | Projects load with pagination/infinite scroll                    | ☐ Pass ☐ Fail |
| TC-P1-052 | Card Content       | 1. Inspect any card                    | Title, description snippet, progress bar, days left, goal amount | ☐ Pass ☐ Fail |
| TC-P1-053 | Card Interaction   | 1. Click any card                      | Navigates to `/projects/[id]`                                    | ☐ Pass ☐ Fail |
| TC-P1-054 | Save/Bookmark Card | 1. Click bookmark icon                 | Toggles saved state (filled/outline)                             | ☐ Pass ☐ Fail |
| TC-P1-055 | Empty State        | 1. New account, no data                | "No campaigns yet" + Explore CTA                                 | ☐ Pass ☐ Fail |
| TC-P1-056 | Loading State      | 1. Slow network                        | Skeleton cards (3-4)                                             | ☐ Pass ☐ Fail |
| TC-P1-057 | Error State        | 1. Network disconnected                | Error message + Retry                                            | ☐ Pass ☐ Fail |
| TC-P1-058 | Infinite Scroll    | 1. Scroll to bottom                    | Next page loads automatically                                    | ☐ Pass ☐ Fail |

---

### 2.5 Explore Page (`/explore`)

| TC-ID     | Feature                | Steps                             | Expected Result                                           | Pass/Fail     |
| --------- | ---------------------- | --------------------------------- | --------------------------------------------------------- | ------------- |
| TC-P1-060 | Page Load              | 1. Navigate to `/explore`         | Grid of project cards + sidebar filters                   | ☐ Pass ☐ Fail |
| TC-P1-061 | Search Bar             | 1. Type in search box             | Results filter in real-time (debounced)                   | ☐ Pass ☐ Fail |
| TC-P1-062 | Category Filter        | 1. Select category in sidebar     | Results filtered by category                              | ☐ Pass ☐ Fail |
| TC-P1-063 | Combined Filters       | 1. Select category + sort         | Both filters apply simultaneously                         | ☐ Pass ☐ Fail |
| TC-P1-064 | Sort: Newest           | 1. Select "Newest"                | Most recent campaigns first                               | ☐ Pass ☐ Fail |
| TC-P1-065 | Sort: Most Funded      | 1. Select "Most Funded"           | Highest funded campaigns first                            | ☐ Pass ☐ Fail |
| TC-P1-066 | Sort: Ending Soon      | 1. Select "Ending Soon"           | Campaigns with nearest deadlines first                    | ☐ Pass ☐ Fail |
| TC-P1-067 | No Results             | 1. Search "zzz_nonexistent"       | Empty state: "No projects found"                          | ☐ Pass ☐ Fail |
| TC-P1-068 | Pagination             | 1. Click "Next" / page 2          | Next page of results loads                                | ☐ Pass ☐ Fail |
| TC-P1-069 | Loading State          | 1. Slow network                   | Skeleton grid (6-8 skeleton cards)                        | ☐ Pass ☐ Fail |
| TC-P1-070 | Responsive: Mobile     | 1. Resize to 375px                | Grid 1 column, filters collapse to hamburger/bottom sheet | ☐ Pass ☐ Fail |
| TC-P1-071 | Filter Toggle (Mobile) | 1. Click filter hamburger         | Sidebar slides in/out                                     | ☐ Pass ☐ Fail |
| TC-P1-072 | Clear Filters          | 1. Select filters → Click "Clear" | All filters reset, full list shows                        | ☐ Pass ☐ Fail |
| TC-P1-073 | Search + Filter Combo  | 1. Type query + select category   | Combined narrowing works                                  | ☐ Pass ☐ Fail |
| TC-P1-074 | URL Params             | 1. Filter and check URL           | URL params update (for shareability)                      | ☐ Pass ☐ Fail |
| TC-P1-075 | Keyboard Nav           | 1. Tab through cards              | Each card focusable, Enter opens project                  | ☐ Pass ☐ Fail |

---

### 2.6 Project Details (`/projects/[id]`)

| TC-ID     | Feature            | Steps                              | Expected Result                                         | Pass/Fail     |
| --------- | ------------------ | ---------------------------------- | ------------------------------------------------------- | ------------- |
| TC-P1-080 | Page Load          | 1. Navigate to `/projects/[id]`    | Hero banner, title, description, funding sidebar        | ☐ Pass ☐ Fail |
| TC-P1-081 | Hero Banner        | 1. View hero                       | Project image/video with overlay, title overlay         | ☐ Pass ☐ Fail |
| TC-P1-082 | Gallery            | 1. Scroll to gallery section       | Media thumbnails grid, clickable to fullscreen/lightbox | ☐ Pass ☐ Fail |
| TC-P1-083 | Project Story      | 1. Read story                      | Rich text content renders correctly (images, embeds)    | ☐ Pass ☐ Fail |
| TC-P1-084 | Funding Sidebar    | 1. Right-side sidebar              | Amount raised, goal, %, days left, "Fund This Project"  | ☐ Pass ☐ Fail |
| TC-P1-085 | Roadmap            | 1. Scroll to roadmap               | Milestone timeline with dates, status badges            | ☐ Pass ☐ Fail |
| TC-P1-086 | Similar Projects   | 1. Scroll to bottom                | 3-4 related project cards                               | ☐ Pass ☐ Fail |
| TC-P1-087 | Save/Bookmark      | 1. Click bookmark icon             | Toggle saved state                                      | ☐ Pass ☐ Fail |
| TC-P1-088 | Share              | 1. Click share button              | Share dialog: copy link + social options                | ☐ Pass ☐ Fail |
| TC-P1-089 | Team Members       | 1. View team section               | Creator/team member cards with avatars, roles           | ☐ Pass ☐ Fail |
| TC-P1-090 | Loading State      | 1. Slow network                    | Skeleton: hero, text, sidebar                           | ☐ Pass ☐ Fail |
| TC-P1-091 | 404 Project        | 1. Navigate to `/projects/fake-id` | "Project not found" page                                | ☐ Pass ☐ Fail |
| TC-P1-092 | Responsive: Mobile | 1. 375px viewport                  | Sidebar collapses below content; full-width             | ☐ Pass ☐ Fail |
| TC-P1-093 | Closed Campaign    | 1. View ended campaign             | "Campaign ended" badge, no Fund button                  | ☐ Pass ☐ Fail |
| TC-P1-094 | Backer Count       | 1. Check sidebar                   | Total backer count displayed                            | ☐ Pass ☐ Fail |
| TC-P1-095 | Real-time Update   | 1. Second user donates → refresh   | Amount updates (or real-time via subscription)          | ☐ Pass ☐ Fail |

---

### 2.7 Fund Page (`/projects/[id]/fund`)

| TC-ID     | Feature                 | Steps                                     | Expected Result                                    | Pass/Fail     |
| --------- | ----------------------- | ----------------------------------------- | -------------------------------------------------- | ------------- |
| TC-P1-100 | Page Load               | 1. Click "Fund This Project" (logged in)  | Amount options, payment summary, pledge form       | ☐ Pass ☐ Fail |
| TC-P1-101 | Preset Amounts          | 1. View amount options                    | Buttons: e.g., ₹100, ₹500, ₹1000, ₹5000            | ☐ Pass ☐ Fail |
| TC-P1-102 | Custom Amount           | 1. Enter custom amount in input           | Presets deselect, custom value used                | ☐ Pass ☐ Fail |
| TC-P1-103 | Zero Amount             | 1. Enter 0 or negative                    | Validation: "Amount must be > 0"                   | ☐ Pass ☐ Fail |
| TC-P1-104 | Razorpay Opens          | 1. Select amount → Click Donate           | Razorpay Checkout modal opens                      | ☐ Pass ☐ Fail |
| TC-P1-105 | Payment Success         | 1. Complete payment in Razorpay           | Success toast, redirect to project, updated amount | ☐ Pass ☐ Fail |
| TC-P1-106 | Payment Failure         | 1. Cancel/fail in Razorpay                | Error message, retry option                        | ☐ Pass ☐ Fail |
| TC-P1-107 | Loading State           | 1. Click Donate                           | Button shows spinner, form disabled                | ☐ Pass ☐ Fail |
| TC-P1-108 | Redirect (Guest)        | 1. Try to fund while logged out           | Redirect to `/login`, return after auth            | ☐ Pass ☐ Fail |
| TC-P1-109 | Receipt                 | 1. Complete payment                       | Receipt download available                         | ☐ Pass ☐ Fail |
| TC-P1-110 | Mobile                  | 1. 375px viewport                         | Full-width, accessible CTA                         | ☐ Pass ☐ Fail |
| TC-P1-111 | Reward Tiers            | 1. View reward tier cards (if configured) | Tier name, amount, description, perks              | ☐ Pass ☐ Fail |
| TC-P1-112 | Trust Indicators        | 1. Check trust section                    | Verification badges, escrow info                   | ☐ Pass ☐ Fail |
| TC-P1-113 | Double-click Prevention | 1. Rapid double-click Donate              | Only one payment triggered                         | ☐ Pass ☐ Fail |

---

### 2.8 Create Project (`/create`) — 4-Step Wizard

| TC-ID     | Feature                      | Steps                                    | Expected Result                                       | Pass/Fail     |
| --------- | ---------------------------- | ---------------------------------------- | ----------------------------------------------------- | ------------- |
| TC-P1-120 | Page Load                    | 1. Navigate to `/create`                 | 4-step wizard: Details → AI → Media → Funding         | ☐ Pass ☐ Fail |
| TC-P1-121 | Step Indicator               | 1. View top of wizard                    | Current step highlighted, completed steps checkmarked | ☐ Pass ☐ Fail |
| TC-P1-122 | Step 1: Title Field          | 1. Enter project title                   | Character counter updates                             | ☐ Pass ☐ Fail |
| TC-P1-123 | Step 1: Category             | 1. Select category from dropdown         | Selection shown                                       | ☐ Pass ☐ Fail |
| TC-P1-124 | Step 1: Story                | 1. Type project story (rich text)        | Rich text editor functional                           | ☐ Pass ☐ Fail |
| TC-P1-125 | Step 1: Tags                 | 1. Add tags/keywords                     | Tags appear as chips, removable                       | ☐ Pass ☐ Fail |
| TC-P1-126 | Step 1: Validation           | 1. Click Next with empty required fields | Validation errors on title, category, story           | ☐ Pass ☐ Fail |
| TC-P1-127 | Step 2: AI Generator         | 1. Enter keywords → Click "Generate"     | AI generates campaign description                     | ☐ Pass ☐ Fail |
| TC-P1-128 | Step 2: AI Loading           | 1. Click Generate                        | Loading spinner during generation                     | ☐ Pass ☐ Fail |
| TC-P1-129 | Step 2: AI Error             | 1. AI API unavailable                    | Error message, manual fallback available              | ☐ Pass ☐ Fail |
| TC-P1-130 | Step 2: Manual Edit          | 1. Edit generated text                   | Textarea editable, changes saved                      | ☐ Pass ☐ Fail |
| TC-P1-131 | Step 2: Regenerate           | 1. Click "Generate Again"                | New alternative description                           | ☐ Pass ☐ Fail |
| TC-P1-132 | Step 3: Media Upload (Image) | 1. Upload JPG/PNG                        | Progress bar, thumbnail shown                         | ☐ Pass ☐ Fail |
| TC-P1-133 | Step 3: Media Upload (Video) | 1. Upload MP4                            | Video thumbnail, processing indicator                 | ☐ Pass ☐ Fail |
| TC-P1-134 | Step 3: Unsupported File     | 1. Upload .exe or .zip                   | Error: "Unsupported file type"                        | ☐ Pass ☐ Fail |
| TC-P1-135 | Step 3: File Too Large       | 1. Upload >5MB                           | Error: "File exceeds size limit"                      | ☐ Pass ☐ Fail |
| TC-P1-136 | Step 3: Remove Media         | 1. Click remove on uploaded file         | File removed from list                                | ☐ Pass ☐ Fail |
| TC-P1-137 | Step 4: Funding Goal         | 1. Enter goal amount                     | Numeric input accepts valid numbers                   | ☐ Pass ☐ Fail |
| TC-P1-138 | Step 4: Deadline             | 1. Select end date from picker           | Date picker constraints (future dates only)           | ☐ Pass ☐ Fail |
| TC-P1-139 | Step 4: Past Deadline        | 1. Try to select yesterday               | Date picker disallows past dates                      | ☐ Pass ☐ Fail |
| TC-P1-140 | Publish Button               | 1. Complete all steps → Click Publish    | Button enabled, confirmation shown                    | ☐ Pass ☐ Fail |
| TC-P1-141 | Publish Loading              | 1. Click Publish                         | Button spinner, inputs disabled                       | ☐ Pass ☐ Fail |
| TC-P1-142 | Successful Publish           | 1. Wait for completion                   | Redirected to `/projects/[id]`                        | ☐ Pass ☐ Fail |
| TC-P1-143 | Step Navigation (Back)       | 1. Go to step 3 → Click Back             | Step 2 shows, values preserved                        | ☐ Pass ☐ Fail |
| TC-P1-144 | Draft Save                   | 1. Navigate away mid-wizard              | Draft auto-saved                                      | ☐ Pass ☐ Fail |
| TC-P1-145 | Mobile Responsive            | 1. 375px viewport                        | Wizard full-width, step indicator compact             | ☐ Pass ☐ Fail |
| TC-P1-146 | Keyboard Nav                 | 1. Tab through Step 1                    | All inputs reachable, submit on Enter                 | ☐ Pass ☐ Fail |

---

### 2.9 Edit Project (`/edit/[id]`)

| TC-ID     | Feature          | Steps                            | Expected Result                            | Pass/Fail     |
| --------- | ---------------- | -------------------------------- | ------------------------------------------ | ------------- |
| TC-P1-150 | Page Load        | 1. Navigate to `/edit/[id]`      | Form pre-filled with existing project data | ☐ Pass ☐ Fail |
| TC-P1-151 | Update Title     | 1. Change title → Save           | "Saved" confirmation shown                 | ☐ Pass ☐ Fail |
| TC-P1-152 | Update Story     | 1. Edit story → Save             | Updated on project page                    | ☐ Pass ☐ Fail |
| TC-P1-153 | Add/Remove Media | 1. Upload new image → Save       | Media gallery updates                      | ☐ Pass ☐ Fail |
| TC-P1-154 | Unauthorized     | 1. Try editing another's project | 403 error or redirect                      | ☐ Pass ☐ Fail |
| TC-P1-155 | Loading          | 1. Navigate to edit              | Skeleton form during load                  | ☐ Pass ☐ Fail |
| TC-P1-156 | 404 Edit         | 1. Navigate to non-existent ID   | "Project not found"                        | ☐ Pass ☐ Fail |

---

### 2.10 Creator Profile (`/creator/[id]`)

| TC-ID     | Feature            | Steps                            | Expected Result                                           | Pass/Fail     |
| --------- | ------------------ | -------------------------------- | --------------------------------------------------------- | ------------- |
| TC-P1-160 | Page Load          | 1. Navigate to `/creator/[id]`   | Profile header: avatar, name, bio, stats                  | ☐ Pass ☐ Fail |
| TC-P1-161 | Profile Header     | 1. View header                   | Avatar, display name, bio, follower count, campaign count | ☐ Pass ☐ Fail |
| TC-P1-162 | Campaign Tabs      | 1. View tabs                     | "Campaigns" / "About" / "Achievements" tabs               | ☐ Pass ☐ Fail |
| TC-P1-163 | Campaign List      | 1. Click "Campaigns" tab         | Creator's campaigns listed with status, progress          | ☐ Pass ☐ Fail |
| TC-P1-164 | Follow Button      | 1. Click "Follow" (logged in)    | Toggles "Following", count +1                             | ☐ Pass ☐ Fail |
| TC-P1-165 | Follow (Guest)     | 1. Click Follow while logged out | Redirect to login                                         | ☐ Pass ☐ Fail |
| TC-P1-166 | Achievement Badges | 1. View achievements tab         | Earned badges/achievements displayed                      | ☐ Pass ☐ Fail |
| TC-P1-167 | Parallax Banner    | 1. Scroll on profile             | Parallax banner effect works                              | ☐ Pass ☐ Fail |
| TC-P1-168 | Animated Counter   | 1. View stats section            | Stats animate on scroll into view                         | ☐ Pass ☐ Fail |
| TC-P1-169 | Loading            | 1. Slow network                  | Profile skeleton + card skeletons                         | ☐ Pass ☐ Fail |
| TC-P1-170 | Mobile             | 1. 375px viewport                | Profile stacks, campaigns 1 column                        | ☐ Pass ☐ Fail |

---

### 2.11 Creator Dashboard (`/creator/analytics`, `/creator/edit`, `/creator/funds-got`, `/creator/payments`, `/creator/profile`)

| TC-ID     | Feature                 | Steps                                             | Expected Result                                  | Pass/Fail     |
| --------- | ----------------------- | ------------------------------------------------- | ------------------------------------------------ | ------------- |
| TC-P1-180 | Analytics Load          | 1. Navigate to `/creator/analytics`               | Charts: earnings over time, campaign performance | ☐ Pass ☐ Fail |
| TC-P1-181 | Date Range              | 1. Change range (7d / 30d / 90d / 1y)             | Chart data updates                               | ☐ Pass ☐ Fail |
| TC-P1-182 | Campaign Table          | 1. Scroll down                                    | Table: name, raised, donors, conversion          | ☐ Pass ☐ Fail |
| TC-P1-183 | Export PDF              | 1. Click "Export PDF"                             | PDF report generated + downloaded                | ☐ Pass ☐ Fail |
| TC-P1-184 | AI Insights Tab         | 1. Click "AI Insights"                            | AI-generated performance tips                    | ☐ Pass ☐ Fail |
| TC-P1-185 | Funds Received          | 1. Navigate to `/creator/funds-got`               | Table: donations with amount, date, donor        | ☐ Pass ☐ Fail |
| TC-P1-186 | Payment History         | 1. Navigate to `/creator/payments`                | Payouts: amount, status, date, transaction ID    | ☐ Pass ☐ Fail |
| TC-P1-187 | Empty State (Analytics) | 1. New creator                                    | "No data yet" placeholder                        | ☐ Pass ☐ Fail |
| TC-P1-188 | Profile Edit            | 1. Navigate to `/creator/edit` or `/edit-profile` | Form pre-filled, avatar upload, bio edit         | ☐ Pass ☐ Fail |
| TC-P1-189 | Profile Save            | 1. Edit bio → Save                                | Success toast, profile updated                   | ☐ Pass ☐ Fail |
| TC-P1-190 | Profile Cancel          | 1. Edit → Cancel                                  | Changes discarded                                | ☐ Pass ☐ Fail |
| TC-P1-191 | Loading (Analytics)     | 1. Slow network                                   | Chart skeletons                                  | ☐ Pass ☐ Fail |
| TC-P1-192 | Error (Analytics)       | 1. API fails                                      | Error + retry option                             | ☐ Pass ☐ Fail |

---

### 2.12 Saved Projects (`/saved`)

| TC-ID     | Feature             | Steps                                   | Expected Result                    | Pass/Fail     |
| --------- | ------------------- | --------------------------------------- | ---------------------------------- | ------------- |
| TC-P1-200 | Page Load           | 1. Navigate to `/saved` (authenticated) | Grid of bookmarked projects        | ☐ Pass ☐ Fail |
| TC-P1-201 | Remove Saved        | 1. Click bookmark icon                  | Project removed from saved list    | ☐ Pass ☐ Fail |
| TC-P1-202 | Navigate to Project | 1. Click a card                         | Goes to `/projects/[id]`           | ☐ Pass ☐ Fail |
| TC-P1-203 | Empty State         | 1. No saved projects                    | "No saved campaigns" + Explore CTA | ☐ Pass ☐ Fail |
| TC-P1-204 | Auth Guard          | 1. Guest navigates to `/saved`          | Redirect to `/login`               | ☐ Pass ☐ Fail |

---

### 2.13 Followers (`/followers`)

| TC-ID     | Feature       | Steps                       | Expected Result                            | Pass/Fail     |
| --------- | ------------- | --------------------------- | ------------------------------------------ | ------------- |
| TC-P1-210 | Page Load     | 1. Navigate to `/followers` | Tabs: Followers / Following                | ☐ Pass ☐ Fail |
| TC-P1-211 | Followers Tab | 1. Ensure tab active        | User avatars, names, "Follow Back" buttons | ☐ Pass ☐ Fail |
| TC-P1-212 | Following Tab | 1. Switch to Following      | Users this account follows                 | ☐ Pass ☐ Fail |
| TC-P1-213 | Follow Back   | 1. Click "Follow Back"      | Button toggles "Following"                 | ☐ Pass ☐ Fail |
| TC-P1-214 | Empty State   | 1. No followers             | "No followers yet" message                 | ☐ Pass ☐ Fail |
| TC-P1-215 | Click User    | 1. Click follower name      | Navigate to `/creator/[id]`                | ☐ Pass ☐ Fail |

---

### 2.14 DM / Messaging (`/dm`, `/dm/[userId]`)

| TC-ID     | Feature            | Steps                                | Expected Result                                                  | Pass/Fail     |
| --------- | ------------------ | ------------------------------------ | ---------------------------------------------------------------- | ------------- |
| TC-P1-220 | DM Index           | 1. Navigate to `/dm`                 | Conversation list with last message preview, avatars, timestamps | ☐ Pass ☐ Fail |
| TC-P1-221 | New Message        | 1. Click "New Message"               | User search modal opens                                          | ☐ Pass ☐ Fail |
| TC-P1-222 | Send Message       | 1. Type → Enter                      | Message sent, appears in chat, timestamped                       | ☐ Pass ☐ Fail |
| TC-P1-223 | Real-time Receive  | 1. Second user sends message         | Message appears without refresh                                  | ☐ Pass ☐ Fail |
| TC-P1-224 | File Attachment    | 1. Click attachment → Upload         | Progress indicator, thumbnail/link in chat                       | ☐ Pass ☐ Fail |
| TC-P1-225 | File Validation    | 1. Upload unsupported type           | Rejected with error                                              | ☐ Pass ☐ Fail |
| TC-P1-226 | Typing Indicator   | 1. Second user types                 | "User is typing..." indicator visible                            | ☐ Pass ☐ Fail |
| TC-P1-227 | Message History    | 1. Scroll up in conversation         | Older messages load (pagination)                                 | ☐ Pass ☐ Fail |
| TC-P1-228 | Empty Conversation | 1. New conversation                  | "No messages yet" placeholder                                    | ☐ Pass ☐ Fail |
| TC-P1-229 | Mobile Layout      | 1. 375px viewport                    | Full-width chat, back button to list                             | ☐ Pass ☐ Fail |
| TC-P1-230 | Unread Badge       | 1. Receive message while in DM index | Unread indicator on conversation                                 | ☐ Pass ☐ Fail |

---

### 2.15 Payments & Receipts (`/payments`)

| TC-ID     | Feature          | Steps                       | Expected Result                                    | Pass/Fail     |
| --------- | ---------------- | --------------------------- | -------------------------------------------------- | ------------- |
| TC-P1-240 | Payment History  | 1. Navigate to `/payments`  | List of donations made with campaign, amount, date | ☐ Pass ☐ Fail |
| TC-P1-241 | Receipt Download | 1. Click "Download Receipt" | PDF receipt downloads                              | ☐ Pass ☐ Fail |
| TC-P1-242 | Empty State      | 1. No donations made        | "No payments yet"                                  | ☐ Pass ☐ Fail |

---

### 2.16 Account Deletion (`/account/delete`)

| TC-ID     | Feature           | Steps                            | Expected Result                               | Pass/Fail     |
| --------- | ----------------- | -------------------------------- | --------------------------------------------- | ------------- |
| TC-P1-250 | Page Load         | 1. Navigate to `/account/delete` | Warning, confirmation checkbox, delete button | ☐ Pass ☐ Fail |
| TC-P1-251 | No Confirmation   | 1. Click Delete without checkbox | Button disabled, validation shown             | ☐ Pass ☐ Fail |
| TC-P1-252 | Successful Delete | 1. Confirm + Delete              | Account deleted, logged out → landing page    | ☐ Pass ☐ Fail |
| TC-P1-253 | Cancel            | 1. Click Cancel                  | Account preserved                             | ☐ Pass ☐ Fail |

---

### 2.17 Auth Callback (`/auth/callback`)

| TC-ID     | Feature        | Steps                             | Expected Result                          | Pass/Fail     |
| --------- | -------------- | --------------------------------- | ---------------------------------------- | ------------- |
| TC-P1-260 | OAuth Callback | 1. Complete OAuth login           | Handles token exchange, redirects to app | ☐ Pass ☐ Fail |
| TC-P1-261 | Loading        | 1. Processing callback            | Loading spinner during exchange          | ☐ Pass ☐ Fail |
| TC-P1-262 | Error          | 1. Invalid/expired callback token | Error message → redirect to login        | ☐ Pass ☐ Fail |

---

### 2.18 Floating AI Chat (`FloatingAIChat` component)

| TC-ID     | Feature          | Steps                            | Expected Result                   | Pass/Fail     |
| --------- | ---------------- | -------------------------------- | --------------------------------- | ------------- |
| TC-P1-270 | Chat Widget      | 1. Navigate any page (logged in) | Floating chat icon/bubble visible | ☐ Pass ☐ Fail |
| TC-P1-271 | Open Chat        | 1. Click bubble                  | Chat panel slides open            | ☐ Pass ☐ Fail |
| TC-P1-272 | Send Message     | 1. Type question → Send          | AI responds                       | ☐ Pass ☐ Fail |
| TC-P1-273 | Close Chat       | 1. Click close/X                 | Chat panel closes                 | ☐ Pass ☐ Fail |
| TC-P1-274 | New Conversation | 1. Click "New Chat"              | Conversation reset                | ☐ Pass ☐ Fail |

---

### 2.19 Positive / Negative / Edge Cases — Phase 1-3

#### Positive Test Cases

| TC-ID     | Test                                                         | Expected              |
| --------- | ------------------------------------------------------------ | --------------------- |
| PC-P1-001 | Register → Login → Create Campaign → Fund → View Analytics   | Full happy path       |
| PC-P1-002 | OAuth Register → Access protected routes                     | OAuth works           |
| PC-P1-003 | 4-step create wizard complete → Publish → Visible in Explore | Campaign lifecycle    |
| PC-P1-004 | Multiple donors fund same campaign → Progress bar updates    | Funding aggregation   |
| PC-P1-005 | Follow creator → See updates (if any)                        | Follow mechanism      |
| PC-P1-006 | Search by exact campaign title                               | Search accuracy       |
| PC-P1-007 | Download analytics PDF with real data                        | PDF generation        |
| PC-P1-008 | Send DM → Receive reply → See typing indicator               | Full DM flow          |
| PC-P1-009 | Save campaign → View in `/saved`                             | Save/unsave lifecycle |

#### Negative Test Cases

| TC-ID     | Test                                         | Expected                   |
| --------- | -------------------------------------------- | -------------------------- |
| NC-P1-001 | Register with existing email                 | "Already registered"       |
| NC-P1-002 | Login with deleted account                   | "Account not found"        |
| NC-P1-003 | Campaign with 5000-char title                | Truncated or validation    |
| NC-P1-004 | Access `/creator/analytics` while logged out | Redirect to login          |
| NC-P1-005 | Pay with expired card in Razorpay            | Payment fails, error shown |
| NC-P1-006 | Upload .exe as campaign cover                | File type rejection        |
| NC-P1-007 | Set funding goal to ₹0                       | Validation error           |
| NC-P1-008 | DM yourself                                  | Blocked or no-op           |
| NC-P1-009 | Edit another user's project                  | 403 error                  |
| NC-P1-010 | Delete account with active campaigns         | Warning / blocked          |

#### Edge Cases

| TC-ID     | Test                                         | Expected               |
| --------- | -------------------------------------------- | ---------------------- |
| EC-P1-001 | Set campaign deadline in the past            | Date picker restricts  |
| EC-P1-002 | Single-character password                    | Min length validation  |
| EC-P1-003 | 5000-char bio                                | Truncation or counter  |
| EC-P1-004 | Double-click on Fund button                  | Only one payment       |
| EC-P1-005 | Browser back/forward during wizard           | Step state preserved   |
| EC-P1-006 | Same project open in 2 tabs → Fund from both | Both process correctly |
| EC-P1-007 | Network disconnect during payment            | Graceful error + retry |
| EC-P1-008 | 1000+ projects in Explore                    | Pagination handles     |
| EC-P1-009 | Special chars in email (e.g., +tag)          | Handles encoded        |
| EC-P1-010 | Campaign with no media assets                | Placeholder shown      |

---

## 3. Phase 4: Business & Bank Verification (Trust Center)

### Objective

Verify Trust Center: business verification (11 types), document upload/review, bank account lifecycle (6 stages), penny drop verification, trust scoring, and admin review queue.

### Prerequisites

- Logged in as Creator (basic KYC: email, phone, ID verified)
- Logged in as Admin (for review queue)
- Migration 004 applied
- Mock providers active (or real provider configured)
- Sample documents: valid PDF, JPG, PNG; invalid .exe, >10MB file

---

### 3.1 Trust Center Dashboard (`/creator/verification`)

| TC-ID     | Feature         | Steps                            | Expected Result                                                  | Pass/Fail     |
| --------- | --------------- | -------------------------------- | ---------------------------------------------------------------- | ------------- |
| TC-P4-001 | Page Load       | 1. Navigate to verification page | Dashboard: verification status cards, progress ring, trust score | ☐ Pass ☐ Fail |
| TC-P4-002 | Completion %    | 1. View indicator                | Progress ring/bar with percentage                                | ☐ Pass ☐ Fail |
| TC-P4-003 | Pending Actions | 1. View dashboard                | "Pending Actions" section lists incomplete steps                 | ☐ Pass ☐ Fail |
| TC-P4-004 | Rejected Docs   | 1. If prior rejections exist     | "Rejected" section with rejection reason                         | ☐ Pass ☐ Fail |
| TC-P4-005 | Trust Score     | 1. View score                    | Numeric score (0-100) with category breakdown                    | ☐ Pass ☐ Fail |
| TC-P4-006 | Score Breakdown | 1. Click score                   | Dimension breakdown: identity, business, bank, etc.              | ☐ Pass ☐ Fail |
| TC-P4-007 | Identity Card   | 1. View identity section         | Email/phone/ID status (verified/pending/unverified)              | ☐ Pass ☐ Fail |
| TC-P4-008 | Business Card   | 1. View business section         | Business verification status                                     | ☐ Pass ☐ Fail |
| TC-P4-009 | Bank Card       | 1. View bank section             | Bank account verification status                                 | ☐ Pass ☐ Fail |
| TC-P4-010 | Loading         | 1. Slow network                  | Skeleton cards                                                   | ☐ Pass ☐ Fail |
| TC-P4-011 | Error           | 1. API unavailable               | Graceful error message                                           | ☐ Pass ☐ Fail |
| TC-P4-012 | Mobile          | 1. 375px viewport                | Cards stack vertically                                           | ☐ Pass ☐ Fail |

---

### 3.2 Business Verification

| TC-ID     | Feature                | Steps                           | Expected Result                                 | Pass/Fail     |
| --------- | ---------------------- | ------------------------------- | ----------------------------------------------- | ------------- |
| TC-P4-020 | Business Type Selector | 1. Click "Add Business"         | 11 business types displayed (dropdown or cards) | ☐ Pass ☐ Fail |
| TC-P4-021 | Type Selection         | 1. Select "Sole Proprietorship" | Required doc list updates for that type         | ☐ Pass ☐ Fail |
| TC-P4-022 | Type Selection         | 1. Select "Private Limited"     | Different doc list (MoA, AoA, etc.)             | ☐ Pass ☐ Fail |
| TC-P4-023 | Document Upload        | 1. Upload required docs         | Progress indicator, thumbnail preview           | ☐ Pass ☐ Fail |
| TC-P4-024 | Validation: Type       | 1. Upload .exe file             | "Only PDF, JPG, PNG accepted"                   | ☐ Pass ☐ Fail |
| TC-P4-025 | Validation: Size       | 1. Upload >10MB                 | "File exceeds maximum size"                     | ☐ Pass ☐ Fail |
| TC-P4-026 | Submit Request         | 1. All docs uploaded → Submit   | Status "Pending Review"                         | ☐ Pass ☐ Fail |
| TC-P4-027 | GST Input              | 1. Enter GST number             | Verified via provider, result shown             | ☐ Pass ☐ Fail |
| TC-P4-028 | Invalid GST            | 1. Enter fake GST               | Error: "Invalid GST number"                     | ☐ Pass ☐ Fail |
| TC-P4-029 | PAN Input              | 1. Enter PAN number             | Verified via provider                           | ☐ Pass ☐ Fail |
| TC-P4-030 | Invalid PAN            | 1. Enter fake PAN               | Error: "Invalid PAN"                            | ☐ Pass ☐ Fail |
| TC-P4-031 | Submit Loading         | 1. Click Submit                 | Button spinner, form disabled                   | ☐ Pass ☐ Fail |

---

### 3.3 Bank Account Verification

| TC-ID     | Feature            | Steps                                | Expected Result                                 | Pass/Fail     |
| --------- | ------------------ | ------------------------------------ | ----------------------------------------------- | ------------- |
| TC-P4-040 | Add Form           | 1. Click "Add Bank Account"          | Account number, confirm, IFSC, bank name fields | ☐ Pass ☐ Fail |
| TC-P4-041 | Number Mismatch    | 1. Different account + confirm       | "Account numbers do not match"                  | ☐ Pass ☐ Fail |
| TC-P4-042 | Invalid IFSC       | 1. Enter "ABC123"                    | "Invalid IFSC format"                           | ☐ Pass ☐ Fail |
| TC-P4-043 | Success            | 1. Valid details → Submit            | Account added with "Pending" status             | ☐ Pass ☐ Fail |
| TC-P4-044 | Penny Drop Trigger | 1. Click "Verify" on pending account | Status → "Verifying"                            | ☐ Pass ☐ Fail |
| TC-P4-045 | Penny Drop Result  | 1. Wait for completion               | "Verified" or "Failed" with reason              | ☐ Pass ☐ Fail |
| TC-P4-046 | Masked Display     | 1. View account details              | Account number displayed as XXXX1234            | ☐ Pass ☐ Fail |
| TC-P4-047 | Delete Account     | 1. Click "Remove" on bank account    | Confirmation → deleted                          | ☐ Pass ☐ Fail |
| TC-P4-048 | Multiple Accounts  | 1. Add 2 bank accounts               | Both listed                                     | ☐ Pass ☐ Fail |
| TC-P4-049 | Default Account    | 1. Set primary/default               | Default badge on selected                       | ☐ Pass ☐ Fail |

---

### 3.4 Admin Review Queue (`/admin/verification-review`)

| TC-ID     | Feature              | Steps                                  | Expected Result                                            | Pass/Fail     |
| --------- | -------------------- | -------------------------------------- | ---------------------------------------------------------- | ------------- |
| TC-P4-060 | Queue Load           | 1. Login as Admin → Navigate to review | Pending verification requests listed                       | ☐ Pass ☐ Fail |
| TC-P4-061 | Request Detail       | 1. Click a request                     | Applicant info, documents, history                         | ☐ Pass ☐ Fail |
| TC-P4-062 | Document Preview     | 1. Click document                      | Lightbox/zoom preview                                      | ☐ Pass ☐ Fail |
| TC-P4-063 | Approve              | 1. Click "Approve"                     | Status updated, creator notified, trust score recalculated | ☐ Pass ☐ Fail |
| TC-P4-064 | Reject               | 1. Click "Reject" → Enter reason       | Rejection sent to creator                                  | ☐ Pass ☐ Fail |
| TC-P4-065 | Request Resubmission | 1. Click "Request Resubmission"        | Creator notified to re-upload                              | ☐ Pass ☐ Fail |
| TC-P4-066 | Audit History        | 1. View timeline                       | Full log: status changes, reviewer, timestamps             | ☐ Pass ☐ Fail |
| TC-P4-067 | Review Notes         | 1. Add internal note                   | Note saved, visible to other admins                        | ☐ Pass ☐ Fail |
| TC-P4-068 | Filter Queue         | 1. Filter by status/date/type          | Filtered results                                           | ☐ Pass ☐ Fail |
| TC-P4-069 | Empty Queue          | 1. All processed                       | "No pending reviews"                                       | ☐ Pass ☐ Fail |
| TC-P4-070 | Loading              | 1. Slow network                        | Skeleton list                                              | ☐ Pass ☐ Fail |

---

### 3.5 Positive / Negative / Edge Cases — Phase 4

#### Positive Test Cases

| TC-ID     | Test                                                 | Expected               |
| --------- | ---------------------------------------------------- | ---------------------- |
| PC-P4-001 | Add Business → Upload Docs → Submit → Admin Approves | Full approval flow     |
| PC-P4-002 | Add Bank → Penny Drop → Verified → Default           | Bank verification flow |
| PC-P4-003 | Multiple verification types → Trust score increases  | Composite scoring      |
| PC-P4-004 | Rejected → Resubmit → Approved                       | Resubmission flow      |
| PC-P4-005 | All verifications complete → Trust score = 100       | Max score achievable   |

#### Negative Test Cases

| TC-ID     | Test                               | Expected                         |
| --------- | ---------------------------------- | -------------------------------- |
| NC-P4-001 | Upload corrupt/damaged file        | Upload fails                     |
| NC-P4-002 | Submit empty business verification | Required field errors            |
| NC-P4-003 | Duplicate bank account number      | "Already exists"                 |
| NC-P4-004 | Reject without reason              | "Reason required"                |
| NC-P4-005 | Non-admin accesses review queue    | 403                              |
| NC-P4-006 | Penny drop on unverified business  | Blocked: "Verify business first" |

#### Edge Cases

| TC-ID     | Test                                              | Expected                           |
| --------- | ------------------------------------------------- | ---------------------------------- |
| EC-P4-001 | 10-page PDF document                              | Multi-page handled                 |
| EC-P4-002 | All 11 business types show different requirements | Correct per type                   |
| EC-P4-003 | Admin approves while creator viewing              | Real-time status                   |
| EC-P4-004 | Delete bank account with pending payout           | Warning / blocked                  |
| EC-P4-005 | Penny drop fails 3×                               | Account locked, admin intervention |
| EC-P4-006 | Special chars in business name                    | Proper encoding                    |

---

## 4. Phase 5: Fraud Detection & Risk Management

### Objective

Verify fraud pipeline: risk evaluation, signal collection, device fingerprinting, AI-enhanced analysis, admin fraud dashboard, and decision engine.

### Prerequisites

- Logged in as Admin
- Migration 005 applied
- Fraud rules pre-seeded in database
- Test tools: VPN/proxy for geo-testing, rapid request tool for velocity testing

---

### 4.1 Fraud Dashboard (`/admin/fraud`)

| TC-ID     | Feature          | Steps                     | Expected Result                                   | Pass/Fail     |
| --------- | ---------------- | ------------------------- | ------------------------------------------------- | ------------- |
| TC-P5-001 | Dashboard Load   | 1. Admin → `/admin/fraud` | Case list, risk scores, recent events             | ☐ Pass ☐ Fail |
| TC-P5-002 | Case List        | 1. View cases             | User, risk score, status, date columns            | ☐ Pass ☐ Fail |
| TC-P5-003 | Case Detail      | 1. Click a case           | Signals, rules triggered, AI analysis, timeline   | ☐ Pass ☐ Fail |
| TC-P5-004 | Risk Score Gauge | 1. View case              | Score gauge 0-100, color-coded (green/yellow/red) | ☐ Pass ☐ Fail |
| TC-P5-005 | Flag Case        | 1. Click "Flag"           | Status updated, action logged                     | ☐ Pass ☐ Fail |
| TC-P5-006 | Dismiss Case     | 1. Click "Dismiss"        | Case closed, no action taken                      | ☐ Pass ☐ Fail |
| TC-P5-007 | Filter           | 1. Filter by risk/status  | Filtered results                                  | ☐ Pass ☐ Fail |
| TC-P5-008 | AI Analysis      | 1. View AI-enhanced case  | AI assessment text visible                        | ☐ Pass ☐ Fail |
| TC-P5-009 | Event Timeline   | 1. View user events       | Timeline with timestamps                          | ☐ Pass ☐ Fail |
| TC-P5-010 | Empty            | 1. No fraud cases         | "No suspicious activity"                          | ☐ Pass ☐ Fail |
| TC-P5-011 | Loading          | 1. Slow network           | Skeleton dashboard                                | ☐ Pass ☐ Fail |

### 4.2 Fraud API (Backend Verification)

| TC-ID     | Feature              | Steps                         | Expected Result                          | Pass/Fail     |
| --------- | -------------------- | ----------------------------- | ---------------------------------------- | ------------- |
| TC-P5-020 | Evaluate Transaction | POST to `/api/fraud/evaluate` | Risk score + signals + decision returned | ☐ Pass ☐ Fail |
| TC-P5-021 | Device Fingerprint   | GET `/api/fraud/devices`      | Device list with fingerprints            | ☐ Pass ☐ Fail |
| TC-P5-022 | API Auth             | Invalid API key → Evaluate    | 401                                      | ☐ Pass ☐ Fail |
| TC-P5-023 | Invalid Data         | POST bad data to Evaluate     | `{success: false, error: ...}`           | ☐ Pass ☐ Fail |
| TC-P5-024 | Rate Limit           | Exceed `/evaluate` rate limit | 429                                      | ☐ Pass ☐ Fail |

### 4.3 Positive / Negative / Edge Cases — Phase 5

#### Positive

| TC-ID     | Test                             | Expected            |
| --------- | -------------------------------- | ------------------- |
| PC-P5-001 | Normal behavior → Low risk (<30) | Allow action        |
| PC-P5-002 | Rule matches → Case created      | Automatic flagging  |
| PC-P5-003 | AI analysis appends to case      | Assessment present  |
| PC-P5-004 | Admin dismisses false positive   | User unaffected     |
| PC-P5-005 | Repeat login from known device   | Fingerprint matches |

#### Negative

| TC-ID     | Test                                  | Expected                        |
| --------- | ------------------------------------- | ------------------------------- |
| NC-P5-001 | 10 rapid failed logins                | Score > 70, account temp locked |
| NC-P5-002 | Donation from VPN/banned country      | Rule blocks                     |
| NC-P5-003 | Same IP → 5 donations in 1 min        | Velocity alert                  |
| NC-P5-004 | New account + suspicious email domain | Elevated score                  |
| NC-P5-005 | Disposable email used                 | Flagged for review              |

#### Edge Cases

| TC-ID     | Test                             | Expected                  |
| --------- | -------------------------------- | ------------------------- |
| EC-P5-001 | 500 concurrent fraud evaluations | Rate limiting             |
| EC-P5-002 | AI provider timeout              | Fallback to rule-only     |
| EC-P5-003 | New user with no history         | Default score applied     |
| EC-P5-004 | Signal data missing/corrupt      | Partial scoring, graceful |
| EC-P5-005 | Case reopened after dismissal    | Returns to open           |

---

## 5. Phase 6: Escrow, Milestones & Payouts

### Objective

Verify escrow account management, milestone-based fund release, payout processing, immutable ledger, and admin financial oversight.

### Prerequisites

- Logged in as Creator with verified bank account
- Logged in as Admin for escrow dashboard
- Migration 006 applied
- Campaign with milestones set up
- Test donor contributions in escrow
- Razorpay payout account configured

---

### 5.1 Admin Escrow Dashboard (`/admin/escrow`)

| TC-ID     | Feature        | Steps                        | Expected Result                                               | Pass/Fail     |
| --------- | -------------- | ---------------------------- | ------------------------------------------------------------- | ------------- |
| TC-P6-001 | Dashboard Load | 1. Admin → `/admin/escrow`   | Overview: total in escrow, pending, recent txns               | ☐ Pass ☐ Fail |
| TC-P6-002 | Account List   | 1. View escrow accounts      | Table: campaign, balance, status, created date                | ☐ Pass ☐ Fail |
| TC-P6-003 | Account Detail | 1. Click account             | Balance, transaction history, milestones                      | ☐ Pass ☐ Fail |
| TC-P6-004 | Ledger View    | 1. View ledger               | Append-only entries: type, amount, timestamp, idempotency key | ☐ Pass ☐ Fail |
| TC-P6-005 | Release Action | 1. Approve milestone release | Funds transferred from escrow to creator                      | ☐ Pass ☐ Fail |
| TC-P6-006 | Refund         | 1. Initiate refund to donor  | Escrow reduces, donor credited                                | ☐ Pass ☐ Fail |
| TC-P6-007 | Loading        | 1. Slow network              | Skeleton dashboard                                            | ☐ Pass ☐ Fail |
| TC-P6-008 | Empty          | 1. No escrow activity        | "No escrow accounts"                                          | ☐ Pass ☐ Fail |

### 5.2 Milestones

| TC-ID     | Feature            | Steps                                        | Expected Result                             | Pass/Fail     |
| --------- | ------------------ | -------------------------------------------- | ------------------------------------------- | ------------- |
| TC-P6-020 | Create Milestone   | 1. Add milestone to campaign                 | Title, deliverables, amount, deadline saved | ☐ Pass ☐ Fail |
| TC-P6-021 | Milestone List     | 1. View campaign milestones                  | Timeline view, status badges, amounts       | ☐ Pass ☐ Fail |
| TC-P6-022 | Submit             | 1. Creator marks complete + uploads evidence | Status → "Under Review"                     | ☐ Pass ☐ Fail |
| TC-P6-023 | Donor Review       | 1. Donor views milestone                     | Evidence visible, Approve/Reject buttons    | ☐ Pass ☐ Fail |
| TC-P6-024 | Donor Approve      | 1. Donor approves                            | Status updated, release triggered           | ☐ Pass ☐ Fail |
| TC-P6-025 | Donor Reject       | 1. Donor rejects + reason                    | Returns to "In Progress", creator notified  | ☐ Pass ☐ Fail |
| TC-P6-026 | Multi-Donor Voting | 1. 3 donors vote                             | Progress: "2/3 approved"                    | ☐ Pass ☐ Fail |
| TC-P6-027 | Auto Release       | 1. All donors approve                        | Funds auto-released                         | ☐ Pass ☐ Fail |
| TC-P6-028 | Escrow Card UI     | 1. View escrow component                     | Balance, status, recent activity            | ☐ Pass ☐ Fail |

### 5.3 Payouts (`/creator/earnings`, `/creator/payments`)

| TC-ID     | Feature              | Steps                              | Expected Result                                  | Pass/Fail     |
| --------- | -------------------- | ---------------------------------- | ------------------------------------------------ | ------------- |
| TC-P6-040 | Request Form         | 1. Click "Withdraw"                | Amount, bank account selector, submit            | ☐ Pass ☐ Fail |
| TC-P6-041 | Insufficient Balance | 1. Request > available             | "Insufficient balance" error                     | ☐ Pass ☐ Fail |
| TC-P6-042 | Zero Amount          | 1. Request ₹0                      | Validation error                                 | ☐ Pass ☐ Fail |
| TC-P6-043 | Success              | 1. Valid request → Submit          | Payout created, status "Pending"                 | ☐ Pass ☐ Fail |
| TC-P6-044 | History              | 1. View payments page              | List: amount, status, date, transaction ID       | ☐ Pass ☐ Fail |
| TC-P6-045 | Detail               | 1. Click payout entry              | Bank account, amount, status timeline            | ☐ Pass ☐ Fail |
| TC-P6-046 | Admin Review         | 1. Admin reviews payout            | Fraud check results, approve/reject              | ☐ Pass ☐ Fail |
| TC-P6-047 | Admin Approve        | 1. Admin approves                  | Processed via Razorpay → "Completed"             | ☐ Pass ☐ Fail |
| TC-P6-048 | Unverified Bank      | 1. Unverified bank selected        | "Verify bank first" error                        | ☐ Pass ☐ Fail |
| TC-P6-049 | Loading              | 1. Submit payout                   | Button spinner                                   | ☐ Pass ☐ Fail |
| TC-P6-050 | Earnings Dashboard   | 1. Navigate to `/creator/earnings` | Charts, totals, pending/available/paid breakdown | ☐ Pass ☐ Fail |

### 5.4 Positive / Negative / Edge Cases — Phase 6

#### Positive

| TC-ID     | Test                                     | Expected              |
| --------- | ---------------------------------------- | --------------------- |
| PC-P6-001 | Deposit → Milestone → Release → Withdraw | Full escrow lifecycle |
| PC-P6-002 | 5 milestones, all approved               | Sequential releases   |
| PC-P6-003 | Donor refund → Approved → Returned       | Refund flow           |
| PC-P6-004 | Withdraw entire available balance        | Zero balance after    |
| PC-P6-005 | Admin views complete ledger              | Immutable record      |

#### Negative

| TC-ID     | Test                              | Expected             |
| --------- | --------------------------------- | -------------------- |
| NC-P6-001 | Payout without verified bank      | Blocked              |
| NC-P6-002 | Donor releases before milestone   | Action disabled      |
| NC-P6-003 | Submit milestone without evidence | "Evidence required"  |
| NC-P6-004 | Payout > available escrow         | Insufficient balance |
| NC-P6-005 | Delete allocated milestone        | Blocked / warning    |
| NC-P6-006 | Non-admin accesses escrow admin   | 403                  |

#### Edge Cases

| TC-ID     | Test                                   | Expected                   |
| --------- | -------------------------------------- | -------------------------- |
| EC-P6-001 | Payout to deleted bank account         | "Bank not found"           |
| EC-P6-002 | Razorpay API timeout                   | Retry, status "Processing" |
| EC-P6-003 | Refund during active milestone review  | Held until resolved        |
| EC-P6-004 | All donors refund → Campaign closed    | Full refunds, escrow=0     |
| EC-P6-005 | Duplicate payout request (idempotency) | Only one processed         |
| EC-P6-006 | Ledger sum ≠ escrow balance            | Discrepancy alert          |

---

## 6. Phase 7: Compliance, Reputation & Governance

### Objective

Verify compliance case management, weighted reputation scoring, appeals process, moderation system, multi-channel notifications, and policy management.

### Prerequisites

- Logged in as Admin (compliance, moderation, appeals)
- Logged in as Creator (reputation, notifications)
- Migration 007 applied
- Sample data: policy violations, campaigns, reputation events

---

### 6.1 Compliance Dashboard (`/admin/compliance`)

| TC-ID     | Feature         | Steps                              | Expected Result                               | Pass/Fail     |
| --------- | --------------- | ---------------------------------- | --------------------------------------------- | ------------- |
| TC-P7-001 | Dashboard Load  | 1. Admin → `/admin/compliance`     | Case list: status, priority, reviewer, date   | ☐ Pass ☐ Fail |
| TC-P7-002 | Create Case     | 1. Click "New Case" → Fill details | Case created with COMP-YYYY-NNNNN             | ☐ Pass ☐ Fail |
| TC-P7-003 | Case Detail     | 1. Click a case                    | Evidence, user info, timeline, decision panel | ☐ Pass ☐ Fail |
| TC-P7-004 | Assign Reviewer | 1. Assign admin reviewer           | Case assigned, reviewer notified              | ☐ Pass ☐ Fail |
| TC-P7-005 | Resolve         | 1. Resolve with resolution type    | Case closed, user notified                    | ☐ Pass ☐ Fail |
| TC-P7-006 | Apply Penalty   | 1. Suspend/restrict user           | User access modified per penalty              | ☐ Pass ☐ Fail |
| TC-P7-007 | Filter          | 1. Filter by status/priority       | Filtered list                                 | ☐ Pass ☐ Fail |
| TC-P7-008 | Loading         | 1. Slow network                    | Skeleton list                                 | ☐ Pass ☐ Fail |
| TC-P7-009 | Empty Queue     | 1. No cases                        | "No compliance cases"                         | ☐ Pass ☐ Fail |

### 6.2 Reputation (`/creator/reputation`)

| TC-ID     | Feature         | Steps                                | Expected Result                                 | Pass/Fail     |
| --------- | --------------- | ------------------------------------ | ----------------------------------------------- | ------------- |
| TC-P7-020 | View Reputation | 1. Navigate to `/creator/reputation` | Reputation score (0-1000) + breakdown           | ☐ Pass ☐ Fail |
| TC-P7-021 | Breakdown       | 1. View dimensions                   | Identity, Campaigns, Community, Payments scores | ☐ Pass ☐ Fail |
| TC-P7-022 | Score Up        | 1. Complete positive action          | Score increases                                 | ☐ Pass ☐ Fail |
| TC-P7-023 | Score Down      | 1. Compliance violation upheld       | Score decreases                                 | ☐ Pass ☐ Fail |
| TC-P7-024 | Leaderboard     | 1. View leaderboard                  | Top creators by reputation                      | ☐ Pass ☐ Fail |
| TC-P7-025 | Empty           | 1. New user                          | Starting score or "No data"                     | ☐ Pass ☐ Fail |

### 6.3 Appeals (`/admin/appeals`)

| TC-ID     | Feature       | Steps                                    | Expected Result                              | Pass/Fail     |
| --------- | ------------- | ---------------------------------------- | -------------------------------------------- | ------------- |
| TC-P7-030 | Submit Appeal | 1. Click "Appeal" on compliance decision | Appeal form + evidence upload                | ☐ Pass ☐ Fail |
| TC-P7-031 | No Evidence   | 1. Submit without evidence               | "Evidence required"                          | ☐ Pass ☐ Fail |
| TC-P7-032 | Success       | 1. Complete appeal → Submit              | Created with APL-YYYY-NNNNN                  | ☐ Pass ☐ Fail |
| TC-P7-033 | Admin Review  | 1. Admin views appeal                    | Original case + appeal evidence compared     | ☐ Pass ☐ Fail |
| TC-P7-034 | Decision      | 1. Admin upholds/overturns               | User notified, action reversed if overturned | ☐ Pass ☐ Fail |

### 6.4 Moderation Dashboard (`/admin/moderation`)

| TC-ID     | Feature        | Steps                          | Expected Result                           | Pass/Fail     |
| --------- | -------------- | ------------------------------ | ----------------------------------------- | ------------- |
| TC-P7-040 | Dashboard Load | 1. Admin → `/admin/moderation` | Reported content queue                    | ☐ Pass ☐ Fail |
| TC-P7-041 | Review Content | 1. Click reported item         | Content preview, reporter reason, context | ☐ Pass ☐ Fail |
| TC-P7-042 | Take Action    | 1. Remove or dismiss content   | Action applied, reporter notified         | ☐ Pass ☐ Fail |
| TC-P7-043 | Filter/Empty   | Same patterns as compliance    | Standard behavior                         | ☐ Pass ☐ Fail |

### 6.5 Policy Management (`/admin/policies`)

| TC-ID     | Feature       | Steps                        | Expected Result                             | Pass/Fail     |
| --------- | ------------- | ---------------------------- | ------------------------------------------- | ------------- |
| TC-P7-050 | Policy List   | 1. Admin → `/admin/policies` | Policies with version, status, last updated | ☐ Pass ☐ Fail |
| TC-P7-051 | Create Policy | 1. Add new policy            | Policy added, enforcement active            | ☐ Pass ☐ Fail |
| TC-P7-052 | Update        | 1. Edit existing policy      | Version incremented, change logged          | ☐ Pass ☐ Fail |
| TC-P7-053 | Disable       | 1. Toggle off                | Policy inactive                             | ☐ Pass ☐ Fail |

### 6.6 Notifications (`/notifications`)

| TC-ID     | Feature             | Steps                                 | Expected Result                             | Pass/Fail     |
| --------- | ------------------- | ------------------------------------- | ------------------------------------------- | ------------- |
| TC-P7-060 | Notification Center | 1. Navigate to `/notifications`       | List: type, message, timestamp, read/unread | ☐ Pass ☐ Fail |
| TC-P7-061 | New Notification    | 1. Trigger event (follower, donation) | Appears in list                             | ☐ Pass ☐ Fail |
| TC-P7-062 | Mark Read           | 1. Click notification                 | Marked read, badge count -1                 | ☐ Pass ☐ Fail |
| TC-P7-063 | Mark All Read       | 1. Click "Mark All Read"              | All marked read, badge = 0                  | ☐ Pass ☐ Fail |
| TC-P7-064 | Preferences         | 1. Configure notification prefs       | Channel toggles (in-app, email, push) work  | ☐ Pass ☐ Fail |
| TC-P7-065 | Empty               | 1. No notifications                   | "No notifications"                          | ☐ Pass ☐ Fail |
| TC-P7-066 | Badge               | 1. Unread notifications exist         | Badge on navbar bell icon                   | ☐ Pass ☐ Fail |

### 6.7 Positive / Negative / Edge Cases — Phase 7

#### Positive

| TC-ID     | Test                                        | Expected             |
| --------- | ------------------------------------------- | -------------------- |
| PC-P7-001 | Case → Review → Penalty → Appeal → Overturn | Full governance flow |
| PC-P7-002 | Positive actions → Reputation increases     | Score gain           |
| PC-P7-003 | Create → Update → Disable policy            | Policy lifecycle     |
| PC-P7-004 | All notification channels deliver           | Multi-channel        |

#### Negative

| TC-ID     | Test                                    | Expected              |
| --------- | --------------------------------------- | --------------------- |
| NC-P7-001 | Appeal on already-appealed case         | "Already submitted"   |
| NC-P7-002 | Non-admin accesses compliance           | 403                   |
| NC-P7-003 | Assign same case twice                  | Single assignee       |
| NC-P7-004 | Delete policy in use                    | "Policy in use" error |
| NC-P7-005 | Suspended user still gets notifications | Critical only         |

#### Edge Cases

| TC-ID     | Test                                        | Expected             |
| --------- | ------------------------------------------- | -------------------- |
| EC-P7-001 | Reputation recalc after compliance reversal | Pre-penalty restored |
| EC-P7-002 | 1000+ compliance cases                      | Pagination           |
| EC-P7-003 | Appeal past deadline (if applicable)        | "Window closed"      |
| EC-P7-004 | Self-notification (user acts on own)        | No self-notification |
| EC-P7-005 | Multiple concurrent policy updates          | Independent versions |

---

## 7. Phase 8: Enterprise Organizations & API Platform

### Objective

Verify organization management (members, teams, departments), RBAC enforcement, API key lifecycle, developer app registration, and webhook delivery.

### Prerequisites

- Logged in as Enterprise Admin
- Logged in as Developer (for API platform)
- Second test user (for invitations, RBAC testing)
- Migration 008 applied

---

### 7.1 Organization (`/organization/[id]`)

| TC-ID     | Feature           | Steps                                 | Expected Result                           | Pass/Fail     |
| --------- | ----------------- | ------------------------------------- | ----------------------------------------- | ------------- |
| TC-P8-001 | Create Org        | 1. Navigate to org section → "Create" | Org created, user is owner                | ☐ Pass ☐ Fail |
| TC-P8-002 | Dashboard         | 1. View org page                      | Overview: members, teams, depts, settings | ☐ Pass ☐ Fail |
| TC-P8-003 | Invite Member     | 1. Enter email, select role → Send    | Invitation sent, status "Pending"         | ☐ Pass ☐ Fail |
| TC-P8-004 | Accept Invite     | 1. Invited user clicks accept         | Member added with role                    | ☐ Pass ☐ Fail |
| TC-P8-005 | Remove Member     | 1. Admin removes member               | Access revoked                            | ☐ Pass ☐ Fail |
| TC-P8-006 | Create Department | 1. Add "Engineering" department       | Created under org                         | ☐ Pass ☐ Fail |
| TC-P8-007 | Create Team       | 1. Add team under dept                | Team created, members assignable          | ☐ Pass ☐ Fail |
| TC-P8-008 | Settings          | 1. Update org name/branding           | Saved                                     | ☐ Pass ☐ Fail |
| TC-P8-009 | Analytics         | 1. View org analytics                 | Usage, member activity, campaigns         | ☐ Pass ☐ Fail |
| TC-P8-010 | Leave Org         | 1. Member → "Leave Organization"      | Confirmation → removed                    | ☐ Pass ☐ Fail |
| TC-P8-011 | Loading           | 1. Slow network                       | Skeleton                                  | ☐ Pass ☐ Fail |
| TC-P8-012 | Empty             | 1. No orgs                            | "No organizations" + Create CTA           | ☐ Pass ☐ Fail |

### 7.2 RBAC

| TC-ID     | Feature         | Steps                               | Expected Result                            | Pass/Fail     |
| --------- | --------------- | ----------------------------------- | ------------------------------------------ | ------------- |
| TC-P8-020 | Default Roles   | 1. View role list                   | Admin, Moderator, Finance, Support, Viewer | ☐ Pass ☐ Fail |
| TC-P8-021 | Custom Role     | 1. Create with specific permissions | Custom role selectable                     | ☐ Pass ☐ Fail |
| TC-P8-022 | Edit Role       | 1. Edit custom role permissions     | Permissions updated                        | ☐ Pass ☐ Fail |
| TC-P8-023 | Enforce: Viewer | 1. Viewer tries to edit settings    | Blocked                                    | ☐ Pass ☐ Fail |
| TC-P8-024 | Change Role     | 1. Change member role               | Permissions update immediately             | ☐ Pass ☐ Fail |

### 7.3 API Keys (`/developer`)

| TC-ID     | Feature           | Steps                            | Expected Result                       | Pass/Fail     |
| --------- | ----------------- | -------------------------------- | ------------------------------------- | ------------- |
| TC-P8-030 | Generate Key      | 1. Click "Generate"              | Key created (shown once), with prefix | ☐ Pass ☐ Fail |
| TC-P8-031 | Scopes            | 1. Select permissions            | Scoped key created                    | ☐ Pass ☐ Fail |
| TC-P8-032 | Copy              | 1. Click copy button             | Copied to clipboard                   | ☐ Pass ☐ Fail |
| TC-P8-033 | Revoke            | 1. Revoke key                    | Invalidated immediately               | ☐ Pass ☐ Fail |
| TC-P8-034 | Valid Auth        | 1. API request with valid key    | 200 response                          | ☐ Pass ☐ Fail |
| TC-P8-035 | Invalid Auth      | 1. Invalid/revoked key           | 401                                   | ☐ Pass ☐ Fail |
| TC-P8-036 | Scope Restriction | 1. Read-only key → Write request | 403                                   | ☐ Pass ☐ Fail |
| TC-P8-037 | Usage Logs        | 1. View API logs                 | Request history                       | ☐ Pass ☐ Fail |
| TC-P8-038 | Rate Limit        | 1. Hit rate limit                | 429                                   | ☐ Pass ☐ Fail |

### 7.4 Developer Apps

| TC-ID     | Feature   | Steps                        | Expected Result              | Pass/Fail     |
| --------- | --------- | ---------------------------- | ---------------------------- | ------------- |
| TC-P8-040 | Register  | 1. Fill app form → Submit    | Client ID + secret generated | ☐ Pass ☐ Fail |
| TC-P8-041 | Dashboard | 1. View apps                 | List: name, status, usage    | ☐ Pass ☐ Fail |
| TC-P8-042 | Settings  | 1. Update redirect URL, name | Saved                        | ☐ Pass ☐ Fail |
| TC-P8-043 | Delete    | 1. Delete app                | Removed                      | ☐ Pass ☐ Fail |

### 7.5 Webhooks

| TC-ID     | Feature  | Steps                       | Expected Result                       | Pass/Fail     |
| --------- | -------- | --------------------------- | ------------------------------------- | ------------- |
| TC-P8-050 | Register | 1. Add URL + event types    | Webhook registered, test ping sent    | ☐ Pass ☐ Fail |
| TC-P8-051 | Delivery | 1. Trigger subscribed event | Payload delivered to URL              | ☐ Pass ☐ Fail |
| TC-P8-052 | Logs     | 1. View delivery logs       | Status, response, timestamps, retries | ☐ Pass ☐ Fail |
| TC-P8-053 | Retry    | 1. Click "Retry" on failed  | Re-delivered                          | ☐ Pass ☐ Fail |
| TC-P8-054 | Disable  | 1. Toggle off               | No further deliveries                 | ☐ Pass ☐ Fail |
| TC-P8-055 | Test     | 1. Send test event          | Test payload delivered                | ☐ Pass ☐ Fail |

### 7.6 Positive / Negative / Edge Cases — Phase 8

#### Positive

| TC-ID     | Test                                   | Expected                  |
| --------- | -------------------------------------- | ------------------------- |
| PC-P8-001 | Invite → Accept → Access org resources | Full membership lifecycle |
| PC-P8-002 | Custom role → limited permissions      | RBAC enforced             |
| PC-P8-003 | Generate key → Use → Log shows         | API key lifecycle         |
| PC-P8-004 | Register webhook → Trigger → Received  | Webhook pipeline          |

#### Negative

| TC-ID     | Test                      | Expected                   |
| --------- | ------------------------- | -------------------------- |
| NC-P8-001 | Invite non-existent email | "User not found"           |
| NC-P8-002 | Viewer deletes project    | 403                        |
| NC-P8-003 | Use revoked API key       | 401                        |
| NC-P8-004 | Webhook with invalid URL  | Validation error           |
| NC-P8-005 | Duplicate org name        | Error                      |
| NC-P8-006 | Remove last org admin     | "Cannot remove last admin" |
| NC-P8-007 | API key empty scopes      | "At least one scope"       |

#### Edge Cases

| TC-ID     | Test                            | Expected                 |
| --------- | ------------------------------- | ------------------------ |
| EC-P8-001 | 100+ members in org             | Pagination               |
| EC-P8-002 | Expired invitation              | "Invitation expired"     |
| EC-P8-003 | Same user invited twice         | "Already invited"        |
| EC-P8-004 | Webhook fails 10×               | Auto-disabled            |
| EC-P8-005 | API key name with special chars | Sanitized                |
| EC-P8-006 | Org deleted with active members | Notified, access revoked |
| EC-P8-007 | RBAC permission name collision  | Namespaced prevents      |

---

## 8. Phase 9: AI Platform

### Objective

Verify AI campaign generation, chat/copilot, recommendations, predictions, knowledge base, automation workflows, and cost tracking.

### Prerequisites

- AI provider API key configured (or mock provider fallback)
- Migration 009 applied
- Sample prompts seeded
- Test campaigns for AI analysis

---

### 8.1 Campaign AI (in Create Wizard)

| TC-ID     | Feature                | Steps                                       | Expected Result                    | Pass/Fail     |
| --------- | ---------------------- | ------------------------------------------- | ---------------------------------- | ------------- |
| TC-P9-001 | Generate Description   | 1. In create Step 2 → Keywords → "Generate" | AI-generated text appears          | ☐ Pass ☐ Fail |
| TC-P9-002 | Regenerate             | 1. Click "Generate Again"                   | Alternative description            | ☐ Pass ☐ Fail |
| TC-P9-003 | Edit Output            | 1. Modify generated text                    | Editable, changes preserved        | ☐ Pass ☐ Fail |
| TC-P9-004 | Empty Input            | 1. Click Generate with no keywords          | "Enter keywords first"             | ☐ Pass ☐ Fail |
| TC-P9-005 | Fallback               | 1. Primary AI provider fails                | Fallback to secondary/mock         | ☐ Pass ☐ Fail |
| TC-P9-006 | Score                  | 1. View campaign score                      | Score 0-100 + improvement tips     | ☐ Pass ☐ Fail |
| TC-P9-007 | Funding Recommendation | 1. View recommendation                      | Suggested goal, timeline, strategy | ☐ Pass ☐ Fail |
| TC-P9-008 | Title Suggestion       | 1. Click "Suggest Title"                    | AI title suggestions               | ☐ Pass ☐ Fail |

### 8.2 AI Chat / Copilot

| TC-ID     | Feature   | Steps                                      | Expected Result                  | Pass/Fail     |
| --------- | --------- | ------------------------------------------ | -------------------------------- | ------------- |
| TC-P9-020 | Chat Load | 1. Open AI chat                            | Interface with greeting message  | ☐ Pass ☐ Fail |
| TC-P9-021 | Send      | 1. Type question → Send                    | AI responds relevantly           | ☐ Pass ☐ Fail |
| TC-P9-022 | Memory    | 1. Ask follow-up referencing prior context | AI remembers within conversation | ☐ Pass ☐ Fail |
| TC-P9-023 | Loading   | 1. Send message                            | Typing indicator                 | ☐ Pass ☐ Fail |
| TC-P9-024 | Error     | 1. Provider error                          | "Unable to respond" + retry      | ☐ Pass ☐ Fail |
| TC-P9-025 | Clear     | 1. Click "New Chat"                        | Memory cleared, fresh start      | ☐ Pass ☐ Fail |

### 8.3 Recommendations

| TC-ID     | Feature    | Steps                               | Expected Result                    | Pass/Fail     |
| --------- | ---------- | ----------------------------------- | ---------------------------------- | ------------- |
| TC-P9-030 | View       | 1. Navigate to recommendations      | Personalized campaigns displayed   | ☐ Pass ☐ Fail |
| TC-P9-031 | Adaptation | 1. Interact with certain categories | Recommendations adapt              | ☐ Pass ☐ Fail |
| TC-P9-032 | Empty      | 1. Insufficient data                | "Explore more for recommendations" | ☐ Pass ☐ Fail |
| TC-P9-033 | Dismiss    | 1. Click "Not interested"           | Removed, new may appear            | ☐ Pass ☐ Fail |

### 8.4 Predictions

| TC-ID     | Feature | Steps                            | Expected Result                              | Pass/Fail     |
| --------- | ------- | -------------------------------- | -------------------------------------------- | ------------- |
| TC-P9-040 | View    | 1. Navigate to campaign analysis | Success prediction %, timeline, risk         | ☐ Pass ☐ Fail |
| TC-P9-041 | Factors | 1. View prediction detail        | Influencing factors: category, goal, history | ☐ Pass ☐ Fail |
| TC-P9-042 | Empty   | 1. New campaign / no data        | "Not enough data yet"                        | ☐ Pass ☐ Fail |

### 8.5 Knowledge Base

| TC-ID     | Feature     | Steps                       | Expected Result                   | Pass/Fail     |
| --------- | ----------- | --------------------------- | --------------------------------- | ------------- |
| TC-P9-050 | Search      | 1. Enter query in KB search | Relevant articles with snippets   | ☐ Pass ☐ Fail |
| TC-P9-051 | Add Article | 1. Create new KB article    | Article indexed, searchable       | ☐ Pass ☐ Fail |
| TC-P9-052 | Delete      | 1. Delete KB article        | Removed from search               | ☐ Pass ☐ Fail |
| TC-P9-053 | Semantic    | 1. Natural language query   | Semantic results (beyond keyword) | ☐ Pass ☐ Fail |

### 8.6 Automation Workflows

| TC-ID     | Feature | Steps                                  | Expected Result                   | Pass/Fail     |
| --------- | ------- | -------------------------------------- | --------------------------------- | ------------- |
| TC-P9-060 | Create  | 1. Define trigger + condition + action | Workflow created, configurable    | ☐ Pass ☐ Fail |
| TC-P9-061 | Trigger | 1. Fire trigger event                  | Workflow executes                 | ☐ Pass ☐ Fail |
| TC-P9-062 | Logs    | 1. View run history                    | Status, timestamp, output per run | ☐ Pass ☐ Fail |
| TC-P9-063 | Disable | 1. Toggle off                          | No longer triggers                | ☐ Pass ☐ Fail |
| TC-P9-064 | Invalid | 1. Missing condition                   | "Complete all fields"             | ☐ Pass ☐ Fail |

### 8.7 AI Cost / Usage

| TC-ID     | Feature      | Steps                             | Expected Result                   | Pass/Fail     |
| --------- | ------------ | --------------------------------- | --------------------------------- | ------------- |
| TC-P9-070 | Usage View   | 1. Check usage endpoint/dashboard | Token count, cost, per-user       | ☐ Pass ☐ Fail |
| TC-P9-071 | Budget Limit | 1. Exceed daily budget            | Falls back or blocked with notice | ☐ Pass ☐ Fail |
| TC-P9-072 | History      | 1. View historical usage          | Token/cost chart over time        | ☐ Pass ☐ Fail |

### 8.8 Positive / Negative / Edge Cases — Phase 9

#### Positive

| TC-ID     | Test                                                | Expected           |
| --------- | --------------------------------------------------- | ------------------ |
| PC-P9-001 | 10+ messages in AI chat                             | Context maintained |
| PC-P9-002 | Generate → Edit → Regen → Use in campaign           | AI + create flow   |
| PC-P9-003 | All AI providers available → Request routes to best | Model routing      |
| PC-P9-004 | Automation trigger → condition → action             | Full workflow      |

#### Negative

| TC-ID     | Test                       | Expected                |
| --------- | -------------------------- | ----------------------- |
| NC-P9-001 | AI key missing/expired     | Fallback or clear error |
| NC-P9-002 | Send abusive content to AI | Moderation filters      |
| NC-P9-003 | Generate with empty prompt | "Prompt required"       |
| NC-P9-004 | Circular workflow trigger  | Prevention              |
| NC-P9-005 | Exceed AI budget           | Graceful degradation    |

#### Edge Cases

| TC-ID     | Test                              | Expected                              |
| --------- | --------------------------------- | ------------------------------------- |
| EC-P9-001 | AI response exceeds max tokens    | Truncated + continuation              |
| EC-P9-002 | 100+ message conversation         | Context windowing                     |
| EC-P9-003 | All providers simultaneously down | "AI unavailable" graceful             |
| EC-P9-004 | 10,000+ KB articles               | Search performant                     |
| EC-P9-005 | Workflow runs 1000×/hour          | Rate limiting                         |
| EC-P9-006 | AI hallucinated content           | Output reviewed, not blindly accepted |

---

## 9. Phase 10: Global Platform & Production Scale

### Objective

Verify i18n, multi-currency, plugin platform, marketplace, observability, backup/recovery, search, storage/CDN, and mobile API.

### Prerequisites

- Migration 010 applied
- Sample plugin manifest for testing
- Test files for storage upload
- Search index populated
- Multiple browser tabs for observability checks

---

### 9.1 Internationalization

| TC-ID      | Feature             | Steps                                     | Expected Result             | Pass/Fail     |
| ---------- | ------------------- | ----------------------------------------- | --------------------------- | ------------- |
| TC-P10-001 | Language Switcher   | 1. Find language selector in UI           | Options available           | ☐ Pass ☐ Fail |
| TC-P10-002 | Switch Language     | 1. Select Hindi/French/Spanish            | UI text updates immediately | ☐ Pass ☐ Fail |
| TC-P10-003 | RTL (Arabic)        | 1. Switch to Arabic                       | Layout flips RTL correctly  | ☐ Pass ☐ Fail |
| TC-P10-004 | Persist             | 1. Switch → Refresh                       | Preference persists         | ☐ Pass ☐ Fail |
| TC-P10-005 | Missing Translation | 1. Use partial translation                | Falls back to English       | ☐ Pass ☐ Fail |
| TC-P10-006 | API                 | 1. GET `/api/i18n/translations?locale=hi` | Translations returned       | ☐ Pass ☐ Fail |

### 9.2 Multi-Currency

| TC-ID      | Feature        | Steps                         | Expected Result               | Pass/Fail     |
| ---------- | -------------- | ----------------------------- | ----------------------------- | ------------- |
| TC-P10-020 | Selector       | 1. Find currency selector     | USD, EUR, INR, GBP, etc.      | ☐ Pass ☐ Fail |
| TC-P10-021 | Display        | 1. Switch to EUR              | Prices show €                 | ☐ Pass ☐ Fail |
| TC-P10-022 | Conversion     | 1. Donate in foreign currency | Converted using exchange rate | ☐ Pass ☐ Fail |
| TC-P10-023 | Rate Freshness | 1. Check rate timestamp       | Shows "Updated X min ago"     | ☐ Pass ☐ Fail |
| TC-P10-024 | API            | 1. GET `/api/currency/rates`  | Exchange rates returned       | ☐ Pass ☐ Fail |

### 9.3 Plugin Platform (`/admin/plugins`)

| TC-ID      | Feature        | Steps                                    | Expected Result               | Pass/Fail     |
| ---------- | -------------- | ---------------------------------------- | ----------------------------- | ------------- |
| TC-P10-030 | Manager        | 1. Navigate to plugin manager            | Installed plugins with status | ☐ Pass ☐ Fail |
| TC-P10-031 | Install        | 1. Click "Install" on marketplace plugin | Downloaded, added to list     | ☐ Pass ☐ Fail |
| TC-P10-032 | Enable/Disable | 1. Toggle plugin                         | State changes immediately     | ☐ Pass ☐ Fail |
| TC-P10-033 | Configure      | 1. Click "Configure"                     | Plugin settings UI            | ☐ Pass ☐ Fail |
| TC-P10-034 | Uninstall      | 1. Confirm uninstall                     | Removed                       | ☐ Pass ☐ Fail |

### 9.4 Marketplace (`/admin/marketplace`)

| TC-ID      | Feature       | Steps                       | Expected Result                              | Pass/Fail     |
| ---------- | ------------- | --------------------------- | -------------------------------------------- | ------------- |
| TC-P10-040 | Browse        | 1. Navigate to marketplace  | Available plugins with ratings, descriptions | ☐ Pass ☐ Fail |
| TC-P10-041 | Detail        | 1. Click plugin card        | Version, author, reviews, screenshots        | ☐ Pass ☐ Fail |
| TC-P10-042 | Submit Plugin | 1. Developer submits plugin | Status "Pending Review"                      | ☐ Pass ☐ Fail |
| TC-P10-043 | Review Plugin | 1. Admin reviews            | Approve/reject with feedback                 | ☐ Pass ☐ Fail |
| TC-P10-044 | Dev Register  | 1. Register as developer    | Dev account created                          | ☐ Pass ☐ Fail |

### 9.5 Observability (`/admin/observability`)

| TC-ID      | Feature         | Steps                               | Expected Result                | Pass/Fail     |
| ---------- | --------------- | ----------------------------------- | ------------------------------ | ------------- |
| TC-P10-050 | Metrics         | 1. GET `/api/observability/metrics` | Counter, gauge, timing metrics | ☐ Pass ☐ Fail |
| TC-P10-051 | Health          | 1. GET `/api/observability/health`  | All components status          | ☐ Pass ☐ Fail |
| TC-P10-052 | Alerts          | 1. View alerts                      | Active/historical alerts       | ☐ Pass ☐ Fail |
| TC-P10-053 | Configure Alert | 1. Create alert rule                | Fires on threshold breach      | ☐ Pass ☐ Fail |
| TC-P10-054 | Traces          | 1. Make API calls → View traces     | Spans visible                  | ☐ Pass ☐ Fail |

### 9.6 Backup (`/admin/infrastructure`)

| TC-ID      | Feature       | Steps                                 | Expected Result                 | Pass/Fail     |
| ---------- | ------------- | ------------------------------------- | ------------------------------- | ------------- |
| TC-P10-060 | Create Backup | 1. POST `/api/backup/backups`         | Initiated, status "In Progress" | ☐ Pass ☐ Fail |
| TC-P10-061 | List          | 1. GET `/api/backup/backups`          | List with size, status, date    | ☐ Pass ☐ Fail |
| TC-P10-062 | Verify        | 1. View verification result           | Integrity check passed          | ☐ Pass ☐ Fail |
| TC-P10-063 | Restore       | 1. POST `/api/backup/restore` with ID | Restore initiated               | ☐ Pass ☐ Fail |
| TC-P10-064 | Retention     | 1. Configure policy                   | Old backups auto-deleted        | ☐ Pass ☐ Fail |

### 9.7 Search

| TC-ID      | Feature      | Steps                                 | Expected Result                  | Pass/Fail     |
| ---------- | ------------ | ------------------------------------- | -------------------------------- | ------------- |
| TC-P10-070 | Full-Text    | 1. GET `/api/search?q=tech`           | Projects, creators, campaigns    | ☐ Pass ☐ Fail |
| TC-P10-071 | Facets       | 1. Search with category/amount filter | Filtered results                 | ☐ Pass ☐ Fail |
| TC-P10-072 | Autocomplete | 1. Type in search box                 | Suggestions debounced            | ☐ Pass ☐ Fail |
| TC-P10-073 | No Results   | 1. Search nonsense                    | "No results found"               | ☐ Pass ☐ Fail |
| TC-P10-074 | Analytics    | 1. View search dashboard              | Popular searches, no-result rate | ☐ Pass ☐ Fail |

### 9.8 Storage

| TC-ID      | Feature     | Steps                                     | Expected Result           | Pass/Fail     |
| ---------- | ----------- | ----------------------------------------- | ------------------------- | ------------- |
| TC-P10-080 | Upload      | 1. POST `/api/storage/upload`             | File stored, URL returned | ☐ Pass ☐ Fail |
| TC-P10-081 | Signed URL  | 1. GET `/api/storage/signed-url` for file | Temporary URL             | ☐ Pass ☐ Fail |
| TC-P10-082 | Expired URL | 1. Use signed URL after TTL               | 403/401                   | ☐ Pass ☐ Fail |
| TC-P10-083 | Optimize    | 1. Upload large image                     | Compressed/resized        | ☐ Pass ☐ Fail |
| TC-P10-084 | Unsupported | 1. Upload .exe                            | Security rejection        | ☐ Pass ☐ Fail |

### 9.9 Mobile API (Backend)

| TC-ID      | Feature         | Steps                          | Expected Result         | Pass/Fail     |
| ---------- | --------------- | ------------------------------ | ----------------------- | ------------- |
| TC-P10-090 | Pagination      | 1. Call with cursor            | Next-cursor in response | ☐ Pass ☐ Fail |
| TC-P10-091 | Field Selection | 1. Call with `?fields=id,name` | Only requested fields   | ☐ Pass ☐ Fail |
| TC-P10-092 | Versioning      | 1. Call with version header    | Version-aware routing   | ☐ Pass ☐ Fail |
| TC-P10-093 | Offline Sync    | 1. POST `/api/mobile/sync`     | Conflict resolution     | ☐ Pass ☐ Fail |
| TC-P10-094 | Response Size   | 1. Mobile-optimized endpoint   | Minified response       | ☐ Pass ☐ Fail |

### 9.10 Positive / Negative / Edge Cases — Phase 10

#### Positive

| TC-ID      | Test                                       | Expected               |
| ---------- | ------------------------------------------ | ---------------------- |
| PC-P10-001 | i18n + currency switch together            | Translated + converted |
| PC-P10-002 | Install → Enable → Configure → Use plugin  | Full lifecycle         |
| PC-P10-003 | Backup → Verify → Restore                  | Full DR cycle          |
| PC-P10-004 | Search → Filter → Autocomplete → Analytics | Full search lifecycle  |
| PC-P10-005 | Upload → Signed URL → Access → Expired     | Full storage lifecycle |

#### Negative

| TC-ID      | Test                               | Expected           |
| ---------- | ---------------------------------- | ------------------ |
| NC-P10-001 | Install malicious plugin           | Sandbox blocks     |
| NC-P10-002 | Restore corrupted backup           | Verification fails |
| NC-P10-003 | Upload exceeds storage quota       | "Quota exceeded"   |
| NC-P10-004 | Access signed URL for deleted file | 404                |
| NC-P10-005 | Plugin without manifest            | "Invalid package"  |

#### Edge Cases

| TC-ID      | Test                             | Expected                    |
| ---------- | -------------------------------- | --------------------------- |
| EC-P10-001 | 20+ languages loaded             | Performant                  |
| EC-P10-002 | Currency conversion at midnight  | Graceful rate refresh       |
| EC-P10-003 | Plugin with 1000+ config options | Scrollable, searchable      |
| EC-P10-004 | Backup during peak traffic       | No performance impact       |
| EC-P10-005 | Unicode/emoji in search          | Properly encoded            |
| EC-P10-006 | Mobile with no network           | Proper offline state        |
| EC-P10-007 | Plugin crash sandbox             | Isolated, others unaffected |

---

## 10. Phase 11: Ecosystem Platform

### Objective

Verify agent platform, event bus, enterprise connectors, MCP server, data export, tenant management, feature flags, and platform analytics.

### Prerequisites

- Migration 011 applied
- Agent configurations seeded
- Test connector credentials (e.g., test Slack webhook)
- Feature flag definitions in database
- Sample data for export testing

---

### 10.1 Agent Center (`/admin/agents`)

| TC-ID      | Feature        | Steps                         | Expected Result                                                       | Pass/Fail     |
| ---------- | -------------- | ----------------------------- | --------------------------------------------------------------------- | ------------- |
| TC-P11-001 | Page Load      | 1. Navigate to agent center   | Agent types listed with status, last run                              | ☐ Pass ☐ Fail |
| TC-P11-002 | Agent Types    | 1. View available             | Creator, Donor, Moderator, Support, Admin, Compliance, Fraud, Finance | ☐ Pass ☐ Fail |
| TC-P11-003 | Enable/Disable | 1. Toggle agent               | Status updates, schedule active/inactive                              | ☐ Pass ☐ Fail |
| TC-P11-004 | Configure      | 1. Click "Configure"          | Schedule, permissions, actions form                                   | ☐ Pass ☐ Fail |
| TC-P11-005 | Run Now        | 1. Click "Run Now"            | Agent executes, result shown                                          | ☐ Pass ☐ Fail |
| TC-P11-006 | Schedule       | 1. Set daily run              | Agent runs on schedule                                                | ☐ Pass ☐ Fail |
| TC-P11-007 | Run Log        | 1. View history               | Per-run: timestamp, status, output, errors                            | ☐ Pass ☐ Fail |
| TC-P11-008 | Permissions    | 1. View agent permissions     | List of allowed actions                                               | ☐ Pass ☐ Fail |
| TC-P11-009 | Workflow       | 1. Assign multi-step workflow | Steps execute in order                                                | ☐ Pass ☐ Fail |
| TC-P11-010 | Memory         | 1. View agent memory          | Stored context from previous runs                                     | ☐ Pass ☐ Fail |
| TC-P11-011 | Loading        | 1. Slow network               | Skeleton                                                              | ☐ Pass ☐ Fail |
| TC-P11-012 | Empty          | 1. No agents                  | "No agents configured" + Create CTA                                   | ☐ Pass ☐ Fail |

### 10.2 Event Bus

| TC-ID      | Feature      | Steps                         | Expected Result                        | Pass/Fail     |
| ---------- | ------------ | ----------------------------- | -------------------------------------- | ------------- |
| TC-P11-020 | Event List   | 1. View event bus dashboard   | Recent events: type, source, timestamp | ☐ Pass ☐ Fail |
| TC-P11-021 | Subscribe    | 1. Create subscription        | Active for event type                  | ☐ Pass ☐ Fail |
| TC-P11-022 | Processing   | 1. Trigger event              | Subscribers notified                   | ☐ Pass ☐ Fail |
| TC-P11-023 | Failed Event | 1. Fail processing            | Moves to DLQ after max retries         | ☐ Pass ☐ Fail |
| TC-P11-024 | Priority     | 1. High + low priority events | High processes first                   | ☐ Pass ☐ Fail |
| TC-P11-025 | History      | 1. View history               | Paginated + searchable                 | ☐ Pass ☐ Fail |

### 10.3 Connectors (`/admin/connectors`)

| TC-ID      | Feature    | Steps                       | Expected Result                              | Pass/Fail     |
| ---------- | ---------- | --------------------------- | -------------------------------------------- | ------------- |
| TC-P11-030 | List       | 1. Navigate to connectors   | Slack, Discord, Email, SMS, CRM, ERP options | ☐ Pass ☐ Fail |
| TC-P11-031 | Connect    | 1. Click "Connect" on Slack | OAuth flow → connected                       | ☐ Pass ☐ Fail |
| TC-P11-032 | Status     | 1. View connected connector | "Connected", last sync timestamp             | ☐ Pass ☐ Fail |
| TC-P11-033 | Disconnect | 1. Click "Disconnect"       | Removed, data stops                          | ☐ Pass ☐ Fail |
| TC-P11-034 | Test       | 1. Click "Test Connection"  | Test message sent                            | ☐ Pass ☐ Fail |
| TC-P11-035 | Configure  | 1. Configure settings       | Saved, behavior changes                      | ☐ Pass ☐ Fail |

### 10.4 MCP Server

| TC-ID      | Feature        | Steps                        | Expected Result                     | Pass/Fail     |
| ---------- | -------------- | ---------------------------- | ----------------------------------- | ------------- |
| TC-P11-040 | Tool List      | 1. GET `/api/mcp`            | Tool definitions with params, types | ☐ Pass ☐ Fail |
| TC-P11-041 | Execute        | 1. Call MCP tool             | Structured response returned        | ☐ Pass ☐ Fail |
| TC-P11-042 | Unknown Tool   | 1. Execute non-existent tool | "Tool not found"                    | ☐ Pass ☐ Fail |
| TC-P11-043 | Invalid Params | 1. Bad parameter types       | Validation error                    | ☐ Pass ☐ Fail |

### 10.5 Data Export

| TC-ID      | Feature   | Steps                                   | Expected Result                     | Pass/Fail     |
| ---------- | --------- | --------------------------------------- | ----------------------------------- | ------------- |
| TC-P11-050 | UI        | 1. Navigate to export section           | Template list, format selection     | ☐ Pass ☐ Fail |
| TC-P11-051 | CSV       | 1. Select data → Export CSV             | .csv downloaded                     | ☐ Pass ☐ Fail |
| TC-P11-052 | Excel     | 1. Select data → Export Excel           | .xlsx downloaded                    | ☐ Pass ☐ Fail |
| TC-P11-053 | JSON      | 1. Select data → Export JSON            | .json downloaded                    | ☐ Pass ☐ Fail |
| TC-P11-054 | PDF       | 1. Select data → Export PDF             | .pdf downloaded                     | ☐ Pass ☐ Fail |
| TC-P11-055 | Scheduled | 1. Configure schedule                   | Auto-runs                           | ☐ Pass ☐ Fail |
| TC-P11-056 | Template  | 1. Create template with field selection | Saved, reusable                     | ☐ Pass ☐ Fail |
| TC-P11-057 | Empty     | 1. Export with no data                  | Headers-only file                   | ☐ Pass ☐ Fail |
| TC-P11-058 | Large     | 1. Export 50,000+ records               | Background processing, notification | ☐ Pass ☐ Fail |

### 10.6 Tenant Management (`/admin/tenants`)

| TC-ID      | Feature   | Steps                          | Expected Result                     | Pass/Fail     |
| ---------- | --------- | ------------------------------ | ----------------------------------- | ------------- |
| TC-P11-070 | Dashboard | 1. Navigate to tenant mgmt     | Tenant list: status, usage, plan    | ☐ Pass ☐ Fail |
| TC-P11-071 | Create    | 1. "New Tenant" → Fill details | Provisioned                         | ☐ Pass ☐ Fail |
| TC-P11-072 | Branding  | 1. Configure logo, colors      | Applied to tenant's UI              | ☐ Pass ☐ Fail |
| TC-P11-073 | Quotas    | 1. Set/update quotas           | Enforced (users, projects, storage) | ☐ Pass ☐ Fail |
| TC-P11-074 | Suspend   | 1. Suspend tenant              | Users cannot access                 | ☐ Pass ☐ Fail |
| TC-P11-075 | Analytics | 1. View per-tenant stats       | Usage specific to tenant            | ☐ Pass ☐ Fail |

### 10.7 Feature Flags (`/admin/feature-flags`)

| TC-ID      | Feature      | Steps                      | Expected Result               | Pass/Fail     |
| ---------- | ------------ | -------------------------- | ----------------------------- | ------------- |
| TC-P11-080 | Dashboard    | 1. Navigate to flags       | Flags list: status, rollout % | ☐ Pass ☐ Fail |
| TC-P11-081 | Create       | 1. New flag                | Disabled by default           | ☐ Pass ☐ Fail |
| TC-P11-082 | Enable       | 1. Toggle on               | Feature enabled per rules     | ☐ Pass ☐ Fail |
| TC-P11-083 | % Rollout    | 1. Set to 50%              | ~50% of users see feature     | ☐ Pass ☐ Fail |
| TC-P11-084 | Org-specific | 1. Enable for specific org | Only that org sees it         | ☐ Pass ☐ Fail |
| TC-P11-085 | A/B Test     | 1. Configure variant       | Users randomly assigned       | ☐ Pass ☐ Fail |
| TC-P11-086 | Disable      | 1. Toggle off              | Hidden for all                | ☐ Pass ☐ Fail |

### 10.8 Platform Analytics (`/admin/analytics`)

| TC-ID      | Feature       | Steps                             | Expected Result               | Pass/Fail     |
| ---------- | ------------- | --------------------------------- | ----------------------------- | ------------- |
| TC-P11-090 | Dashboard     | 1. Navigate to platform analytics | Cross-platform charts, trends | ☐ Pass ☐ Fail |
| TC-P11-091 | Date Range    | 1. Change range                   | Charts update                 | ☐ Pass ☐ Fail |
| TC-P11-092 | Export Report | 1. Click "Export"                 | Analytics report generated    | ☐ Pass ☐ Fail |

### 10.9 Positive / Negative / Edge Cases — Phase 11

#### Positive

| TC-ID      | Test                                     | Expected             |
| ---------- | ---------------------------------------- | -------------------- |
| PC-P11-001 | Configure → Schedule → Run → Log agent   | Full agent lifecycle |
| PC-P11-002 | Publish → Subscribe → Process event      | Event bus pipeline   |
| PC-P11-003 | Connect → Test → Use connector           | Integration works    |
| PC-P11-004 | Export 4 formats from same data          | All correct          |
| PC-P11-005 | Create → Brand → Quotas → Suspend tenant | Full lifecycle       |

#### Negative

| TC-ID      | Test                                  | Expected        |
| ---------- | ------------------------------------- | --------------- |
| NC-P11-001 | Agent without permission tries action | Blocked, logged |
| NC-P11-002 | Subscribe to non-existent event       | Error           |
| NC-P11-003 | Invalid connector credentials         | Auth failure    |
| NC-P11-004 | Export without format                 | Validation      |
| NC-P11-005 | Tenant with duplicate subdomain       | "Already taken" |
| NC-P11-006 | Delete flag in active A/B test        | Warning/blocked |

#### Edge Cases

| TC-ID      | Test                              | Expected                   |
| ---------- | --------------------------------- | -------------------------- |
| EC-P11-001 | Agent error mid-execution         | Logged, remaining skipped  |
| EC-P11-002 | DLQ at capacity                   | Oldest purged, alert fired |
| EC-P11-003 | Connector rate-limited externally | Queues + retries           |
| EC-P11-004 | 500MB export                      | Background streaming       |
| EC-P11-005 | Tenant exceeds all quotas         | Multiple warnings          |
| EC-P11-006 | Conflicting A/B flags             | Precedence rules           |
| EC-P11-007 | 1% rollout sees 0 users           | Statistically expected     |
| EC-P11-008 | MCP tool timeout                  | Handled gracefully         |

---

## 11. Phase 12: Infrastructure & Observability

### Objective

Verify caching system, background job processing, connection pooling, secrets management, disaster recovery, webhooks platform, deployment infrastructure.

### Prerequisites

- Migration 012 applied
- Redis running (or memory backend)
- Sample jobs for queue testing
- Docker/K8s environment for deployment

---

### 11.1 Cache System (`/admin/infrastructure` → Cache tab)

| TC-ID      | Feature          | Steps                        | Expected Result                    | Pass/Fail     |
| ---------- | ---------------- | ---------------------------- | ---------------------------------- | ------------- |
| TC-P12-001 | Dashboard        | 1. View cache tab            | Stats: hits, misses, size, backend | ☐ Pass ☐ Fail |
| TC-P12-002 | Cache Hit        | 1. Fetch same resource twice | Second call faster, DB not queried | ☐ Pass ☐ Fail |
| TC-P12-003 | Cache Miss       | 1. Fetch new resource        | First call normal speed            | ☐ Pass ☐ Fail |
| TC-P12-004 | Invalidate       | 1. Invalidate a key          | Removed, next fetch is miss        | ☐ Pass ☐ Fail |
| TC-P12-005 | Clear All        | 1. Clear entire cache        | All keys gone                      | ☐ Pass ☐ Fail |
| TC-P12-006 | Distributed Lock | 1. Two concurrent operations | One acquires, other waits          | ☐ Pass ☐ Fail |
| TC-P12-007 | TTL              | 1. Wait for key to expire    | Auto-evicted                       | ☐ Pass ☐ Fail |

### 11.2 Job Queue (`/admin/infrastructure` → Jobs tab)

| TC-ID      | Feature    | Steps                        | Expected Result                               | Pass/Fail     |
| ---------- | ---------- | ---------------------------- | --------------------------------------------- | ------------- |
| TC-P12-020 | Dashboard  | 1. View jobs tab             | Stats: pending, processing, failed, completed | ☐ Pass ☐ Fail |
| TC-P12-021 | Enqueue    | 1. Create new job            | Appears "Pending"                             | ☐ Pass ☐ Fail |
| TC-P12-022 | Process    | 1. Worker picks up job       | "Processing" → "Completed"                    | ☐ Pass ☐ Fail |
| TC-P12-023 | Failed Job | 1. Create failing job        | Retries (backoff), then DLQ                   | ☐ Pass ☐ Fail |
| TC-P12-024 | Retry      | 1. Retry DLQ'd job           | Re-enqueued                                   | ☐ Pass ☐ Fail |
| TC-P12-025 | Priority   | 1. High + low priority jobs  | High first                                    | ☐ Pass ☐ Fail |
| TC-P12-026 | Scheduled  | 1. Create cron-triggered job | Runs at scheduled time                        | ☐ Pass ☐ Fail |
| TC-P12-027 | Cancel     | 1. Cancel pending job        | Removed from queue                            | ☐ Pass ☐ Fail |

### 11.3 Connection Pool (`/admin/infrastructure` → Database tab)

| TC-ID      | Feature          | Steps                      | Expected Result                       | Pass/Fail     |
| ---------- | ---------------- | -------------------------- | ------------------------------------- | ------------- |
| TC-P12-040 | Dashboard        | 1. View pool dashboard     | Active, idle, waiting, max            | ☐ Pass ☐ Fail |
| TC-P12-041 | Slow Query       | 1. Run a slow query        | Logged, threshold alert               | ☐ Pass ☐ Fail |
| TC-P12-042 | DB Health        | 1. Check health            | Reachable, response time, connections | ☐ Pass ☐ Fail |
| TC-P12-043 | Endpoint Metrics | 1. View per-endpoint       | Calls, duration, error rate           | ☐ Pass ☐ Fail |
| TC-P12-044 | Exhaustion       | 1. Exhaust all connections | "Pool exhausted" error                | ☐ Pass ☐ Fail |

### 11.4 Secrets Manager

| TC-ID      | Feature | Steps                   | Expected Result              | Pass/Fail     |
| ---------- | ------- | ----------------------- | ---------------------------- | ------------- |
| TC-P12-050 | List    | 1. View secrets         | Names listed (values masked) | ☐ Pass ☐ Fail |
| TC-P12-051 | Add     | 1. Add key-value secret | Stored encrypted             | ☐ Pass ☐ Fail |
| TC-P12-052 | Rotate  | 1. Click "Rotate"       | New value, old archived      | ☐ Pass ☐ Fail |
| TC-P12-053 | Delete  | 1. Delete secret        | Removed                      | ☐ Pass ☐ Fail |
| TC-P12-054 | Expiry  | 1. Set expiry           | Warning near expiry          | ☐ Pass ☐ Fail |

### 11.5 Disaster Recovery

| TC-ID      | Feature          | Steps                   | Expected Result                 | Pass/Fail     |
| ---------- | ---------------- | ----------------------- | ------------------------------- | ------------- |
| TC-P12-060 | Dashboard        | 1. View DR dashboard    | Plans list with RPO/RTO, status | ☐ Pass ☐ Fail |
| TC-P12-061 | Plan             | 1. Define DR plan       | Steps + priorities saved        | ☐ Pass ☐ Fail |
| TC-P12-062 | Failover Test    | 1. Initiate test        | Components failover per plan    | ☐ Pass ☐ Fail |
| TC-P12-063 | Verify Backup    | 1. Verify latest backup | Integrity check passes          | ☐ Pass ☐ Fail |
| TC-P12-064 | Validate Restore | 1. Validate restore     | Simulation succeeds             | ☐ Pass ☐ Fail |

### 11.6 Webhooks

| TC-ID      | Feature   | Steps                       | Expected Result            | Pass/Fail     |
| ---------- | --------- | --------------------------- | -------------------------- | ------------- |
| TC-P12-070 | Register  | 1. Add webhook URL + events | Registered, test ping sent | ☐ Pass ☐ Fail |
| TC-P12-071 | Delivery  | 1. Trigger event            | Payload delivered          | ☐ Pass ☐ Fail |
| TC-P12-072 | Logs      | 1. View deliveries          | Status, response, retries  | ☐ Pass ☐ Fail |
| TC-P12-073 | Signature | 1. Verify webhook payload   | HMAC-SHA256 header present | ☐ Pass ☐ Fail |
| TC-P12-074 | Retry     | 1. Failed delivery → Retry  | Re-delivered               | ☐ Pass ☐ Fail |
| TC-P12-075 | Disable   | 1. Toggle off               | No deliveries              | ☐ Pass ☐ Fail |

### 11.7 Deployment Verification

| TC-ID      | Feature        | Steps                                | Expected Result           | Pass/Fail     |
| ---------- | -------------- | ------------------------------------ | ------------------------- | ------------- |
| TC-P12-080 | Docker Build   | `docker build -t fundora .`          | 0 errors                  | ☐ Pass ☐ Fail |
| TC-P12-081 | Docker Compose | `docker-compose up`                  | App + DB + Redis start    | ☐ Pass ☐ Fail |
| TC-P12-082 | Health         | `curl localhost:3000/api/health`     | 200 OK                    | ☐ Pass ☐ Fail |
| TC-P12-083 | K8s Deploy     | `kubectl apply -f deploy/k8s/`       | Pods ready                | ☐ Pass ☐ Fail |
| TC-P12-084 | Helm           | `helm install fundora ./deploy/helm` | Release healthy           | ☐ Pass ☐ Fail |
| TC-P12-085 | HPA Scaling    | Load test                            | Pods auto-scale           | ☐ Pass ☐ Fail |
| TC-P12-086 | Rollback       | Deploy bad → `kubectl rollout undo`  | Previous version restored | ☐ Pass ☐ Fail |

### 11.8 Positive / Negative / Edge Cases — Phase 12

#### Positive

| TC-ID      | Test                                     | Expected                |
| ---------- | ---------------------------------------- | ----------------------- |
| PC-P12-001 | Enqueue → Process → Complete             | Full job lifecycle      |
| PC-P12-002 | Frequently-accessed data → Cache benefit | Performance improvement |
| PC-P12-003 | Docker Compose stack healthy             | All services up         |
| PC-P12-004 | Rotate secret → App still works          | No-downtime rotation    |

#### Negative

| TC-ID      | Test                     | Expected                      |
| ---------- | ------------------------ | ----------------------------- |
| NC-P12-001 | Worker crashes mid-job   | Status "Failed", retry queued |
| NC-P12-002 | Invalid job payload      | Rejected                      |
| NC-P12-003 | Delete secret in use     | Warning/blocked               |
| NC-P12-004 | Deploy missing ConfigMap | Pod error                     |

#### Edge Cases

| TC-ID      | Test                         | Expected             |
| ---------- | ---------------------------- | -------------------- |
| EC-P12-001 | 10,000 jobs enqueued         | Backlog, no crash    |
| EC-P12-002 | Cache key collision          | Namespaced           |
| EC-P12-003 | Redis down → Memory fallback | Auto-fallback        |
| EC-P12-004 | K8s pod OOM                  | Restarts per policy  |
| EC-P12-005 | DB connection leak           | Pool logs alert      |
| EC-P12-006 | Concurrent secret read/write | Mutex prevents race  |
| EC-P12-007 | Infinite-loop job            | Killed after timeout |

---

## 12. Master QA Checklist

### Instructions

Check each item: ☐ Pass = Verified working | ☐ Fail = Bug found | ☐ N/A = Not applicable

---

### Phase 1-3: Foundation (46 checks)

| #    | Item                                                               | Result              |
| ---- | ------------------------------------------------------------------ | ------------------- |
| 1.1  | Landing page loads — Hero, Stats, Trending, How It Works, Footer   | ☐ Pass ☐ Fail ☐ N/A |
| 1.2  | Hero CTAs: "Explore" → `/explore`, "Start" → `/create` or `/login` | ☐ Pass ☐ Fail ☐ N/A |
| 1.3  | Stats counters animate on scroll                                   | ☐ Pass ☐ Fail ☐ N/A |
| 1.4  | Trending project cards render and are clickable                    | ☐ Pass ☐ Fail ☐ N/A |
| 1.5  | Navbar reflects auth state (logged in vs guest)                    | ☐ Pass ☐ Fail ☐ N/A |
| 1.6  | Login: valid credentials succeed                                   | ☐ Pass ☐ Fail ☐ N/A |
| 1.7  | Login: invalid credentials show error                              | ☐ Pass ☐ Fail ☐ N/A |
| 1.8  | Login: empty form validation                                       | ☐ Pass ☐ Fail ☐ N/A |
| 1.9  | Login: OAuth (Google, GitHub) works                                | ☐ Pass ☐ Fail ☐ N/A |
| 1.10 | Login: "Forgot password" flow triggers                             | ☐ Pass ☐ Fail ☐ N/A |
| 1.11 | Login: post-login redirect to guarded page                         | ☐ Pass ☐ Fail ☐ N/A |
| 1.12 | Login: session persists across tab close/reopen                    | ☐ Pass ☐ Fail ☐ N/A |
| 1.13 | Signup: valid registration succeeds                                | ☐ Pass ☐ Fail ☐ N/A |
| 1.14 | Signup: password mismatch validated                                | ☐ Pass ☐ Fail ☐ N/A |
| 1.15 | Signup: duplicate email error                                      | ☐ Pass ☐ Fail ☐ N/A |
| 1.16 | Signup: empty field validation                                     | ☐ Pass ☐ Fail ☐ N/A |
| 1.17 | Signup: email verification sent                                    | ☐ Pass ☐ Fail ☐ N/A |
| 1.18 | Home: project feed loads with pagination                           | ☐ Pass ☐ Fail ☐ N/A |
| 1.19 | Home: card shows title, progress, goal, days left                  | ☐ Pass ☐ Fail ☐ N/A |
| 1.20 | Home: save/bookmark toggles                                        | ☐ Pass ☐ Fail ☐ N/A |
| 1.21 | Explore: page loads with card grid + sidebar filters               | ☐ Pass ☐ Fail ☐ N/A |
| 1.22 | Explore: search filters in real-time                               | ☐ Pass ☐ Fail ☐ N/A |
| 1.23 | Explore: category filter works                                     | ☐ Pass ☐ Fail ☐ N/A |
| 1.24 | Explore: sort (Newest, Most Funded, Ending Soon) works             | ☐ Pass ☐ Fail ☐ N/A |
| 1.25 | Explore: empty search state                                        | ☐ Pass ☐ Fail ☐ N/A |
| 1.26 | Explore: pagination works                                          | ☐ Pass ☐ Fail ☐ N/A |
| 1.27 | Explore: mobile responsive (filter collapse)                       | ☐ Pass ☐ Fail ☐ N/A |
| 1.28 | Project Details: hero, gallery, story, sidebar load                | ☐ Pass ☐ Fail ☐ N/A |
| 1.29 | Project Details: funding sidebar shows correct data                | ☐ Pass ☐ Fail ☐ N/A |
| 1.30 | Project Details: roadmap timeline visible                          | ☐ Pass ☐ Fail ☐ N/A |
| 1.31 | Project Details: similar projects shown                            | ☐ Pass ☐ Fail ☐ N/A |
| 1.32 | Project Details: 404 for non-existent ID                           | ☐ Pass ☐ Fail ☐ N/A |
| 1.33 | Fund: preset + custom amount options                               | ☐ Pass ☐ Fail ☐ N/A |
| 1.34 | Fund: Razorpay Checkout opens on submit                            | ☐ Pass ☐ Fail ☐ N/A |
| 1.35 | Fund: success redirects with updated amount                        | ☐ Pass ☐ Fail ☐ N/A |
| 1.36 | Fund: failure shows error with retry                               | ☐ Pass ☐ Fail ☐ N/A |
| 1.37 | Fund: guest redirected to login                                    | ☐ Pass ☐ Fail ☐ N/A |
| 1.38 | Create Wizard: 4 steps render with step indicator                  | ☐ Pass ☐ Fail ☐ N/A |
| 1.39 | Create Wizard: Step 1 validation on required fields                | ☐ Pass ☐ Fail ☐ N/A |
| 1.40 | Create Wizard: Step 2 AI generation works (with fallback)          | ☐ Pass ☐ Fail ☐ N/A |
| 1.41 | Create Wizard: Step 3 media upload (validation, progress)          | ☐ Pass ☐ Fail ☐ N/A |
| 1.42 | Create Wizard: Step 4 funding goal + deadline validation           | ☐ Pass ☐ Fail ☐ N/A |
| 1.43 | Create Wizard: publish creates project, redirects                  | ☐ Pass ☐ Fail ☐ N/A |
| 1.44 | Create Wizard: step navigation preserves values                    | ☐ Pass ☐ Fail ☐ N/A |
| 1.45 | Creator pages load (analytics, funds-got, payments, profile)       | ☐ Pass ☐ Fail ☐ N/A |
| 1.46 | DM: conversation list, send/receive, typing indicator              | ☐ Pass ☐ Fail ☐ N/A |
| 1.47 | Saved page displays/removes bookmarked projects                    | ☐ Pass ☐ Fail ☐ N/A |
| 1.48 | Followers page with follow/unfollow                                | ☐ Pass ☐ Fail ☐ N/A |
| 1.49 | Account deletion flow with confirmation                            | ☐ Pass ☐ Fail ☐ N/A |
| 1.50 | All pages show loading, error, empty states                        | ☐ Pass ☐ Fail ☐ N/A |
| 1.51 | All pages responsive (320px-1920px)                                | ☐ Pass ☐ Fail ☐ N/A |

### Phase 4: Trust Center (28 checks)

| #    | Item                                             | Result              |
| ---- | ------------------------------------------------ | ------------------- |
| 4.1  | Trust Center dashboard loads with progress ring  | ☐ Pass ☐ Fail ☐ N/A |
| 4.2  | Pending actions section displayed                | ☐ Pass ☐ Fail ☐ N/A |
| 4.3  | Trust score (0-100) with breakdown               | ☐ Pass ☐ Fail ☐ N/A |
| 4.4  | Business type selector shows 11 types            | ☐ Pass ☐ Fail ☐ N/A |
| 4.5  | Document requirements update per business type   | ☐ Pass ☐ Fail ☐ N/A |
| 4.6  | Document upload accepts PDF/JPG/PNG              | ☐ Pass ☐ Fail ☐ N/A |
| 4.7  | File type validation rejects unsupported         | ☐ Pass ☐ Fail ☐ N/A |
| 4.8  | File size limit enforced (10MB)                  | ☐ Pass ☐ Fail ☐ N/A |
| 4.9  | Business verification submits → "Pending Review" | ☐ Pass ☐ Fail ☐ N/A |
| 4.10 | GST verification (valid/invalid)                 | ☐ Pass ☐ Fail ☐ N/A |
| 4.11 | PAN verification (valid/invalid)                 | ☐ Pass ☐ Fail ☐ N/A |
| 4.12 | Add bank account form renders                    | ☐ Pass ☐ Fail ☐ N/A |
| 4.13 | Account number confirmation mismatch validation  | ☐ Pass ☐ Fail ☐ N/A |
| 4.14 | IFSC format validation                           | ☐ Pass ☐ Fail ☐ N/A |
| 4.15 | Penny drop verification triggers → completes     | ☐ Pass ☐ Fail ☐ N/A |
| 4.16 | Account number masked in UI                      | ☐ Pass ☐ Fail ☐ N/A |
| 4.17 | Multiple accounts + set default                  | ☐ Pass ☐ Fail ☐ N/A |
| 4.18 | Admin review queue loads with pending requests   | ☐ Pass ☐ Fail ☐ N/A |
| 4.19 | Document preview works (lightbox)                | ☐ Pass ☐ Fail ☐ N/A |
| 4.20 | Admin approve updates status, notifies creator   | ☐ Pass ☐ Fail ☐ N/A |
| 4.21 | Admin reject with reason works                   | ☐ Pass ☐ Fail ☐ N/A |
| 4.22 | Request resubmission flow works                  | ☐ Pass ☐ Fail ☐ N/A |
| 4.23 | Audit history visible on request                 | ☐ Pass ☐ Fail ☐ N/A |
| 4.24 | Review notes can be added                        | ☐ Pass ☐ Fail ☐ N/A |
| 4.25 | Filter review queue by status/date               | ☐ Pass ☐ Fail ☐ N/A |
| 4.26 | Non-admin gets 403 on review queue               | ☐ Pass ☐ Fail ☐ N/A |
| 4.27 | Loading states present (skeletons)               | ☐ Pass ☐ Fail ☐ N/A |
| 4.28 | Responsive on mobile                             | ☐ Pass ☐ Fail ☐ N/A |

### Phase 5: Fraud Detection (11 checks)

| #    | Item                                          | Result              |
| ---- | --------------------------------------------- | ------------------- |
| 5.1  | Fraud dashboard loads with case list          | ☐ Pass ☐ Fail ☐ N/A |
| 5.2  | Case detail shows signals, rules, AI analysis | ☐ Pass ☐ Fail ☐ N/A |
| 5.3  | Risk score gauge (color-coded) visible        | ☐ Pass ☐ Fail ☐ N/A |
| 5.4  | Admin can flag/dismiss cases                  | ☐ Pass ☐ Fail ☐ N/A |
| 5.5  | Filter cases by risk level/status             | ☐ Pass ☐ Fail ☐ N/A |
| 5.6  | Event timeline for user displayed             | ☐ Pass ☐ Fail ☐ N/A |
| 5.7  | Fraud API endpoints return correct data       | ☐ Pass ☐ Fail ☐ N/A |
| 5.8  | Rate limiting on `/evaluate` endpoint         | ☐ Pass ☐ Fail ☐ N/A |
| 5.9  | API auth enforced (invalid key → 401)         | ☐ Pass ☐ Fail ☐ N/A |
| 5.10 | Empty state when no cases                     | ☐ Pass ☐ Fail ☐ N/A |
| 5.11 | Loading state on dashboard                    | ☐ Pass ☐ Fail ☐ N/A |

### Phase 6: Escrow & Payouts (18 checks)

| #    | Item                                                | Result              |
| ---- | --------------------------------------------------- | ------------------- |
| 6.1  | Admin escrow dashboard loads (total, pending, txns) | ☐ Pass ☐ Fail ☐ N/A |
| 6.2  | Escrow account detail shows balance + history       | ☐ Pass ☐ Fail ☐ N/A |
| 6.3  | Immutable ledger displays append-only entries       | ☐ Pass ☐ Fail ☐ N/A |
| 6.4  | Release funds from escrow works                     | ☐ Pass ☐ Fail ☐ N/A |
| 6.5  | Refund process works                                | ☐ Pass ☐ Fail ☐ N/A |
| 6.6  | Create milestone with title, deliverables, amount   | ☐ Pass ☐ Fail ☐ N/A |
| 6.7  | Submit milestone with evidence → "Under Review"     | ☐ Pass ☐ Fail ☐ N/A |
| 6.8  | Donor approves milestone → release triggered        | ☐ Pass ☐ Fail ☐ N/A |
| 6.9  | Donor rejects milestone → back to "In Progress"     | ☐ Pass ☐ Fail ☐ N/A |
| 6.10 | Multi-donor voting progress visible                 | ☐ Pass ☐ Fail ☐ N/A |
| 6.11 | Payout request (amount validation, bank selection)  | ☐ Pass ☐ Fail ☐ N/A |
| 6.12 | Payout > available balance → "Insufficient"         | ☐ Pass ☐ Fail ☐ N/A |
| 6.13 | Payout history lists with status                    | ☐ Pass ☐ Fail ☐ N/A |
| 6.14 | Admin payout review (approve/reject)                | ☐ Pass ☐ Fail ☐ N/A |
| 6.15 | Payout processes via Razorpay → "Completed"         | ☐ Pass ☐ Fail ☐ N/A |
| 6.16 | Unverified bank blocked for payout                  | ☐ Pass ☐ Fail ☐ N/A |
| 6.17 | Earnings dashboard displays totals + charts         | ☐ Pass ☐ Fail ☐ N/A |
| 6.18 | Loading/empty states on all pages                   | ☐ Pass ☐ Fail ☐ N/A |

### Phase 7: Compliance & Governance (23 checks)

| #    | Item                                                | Result              |
| ---- | --------------------------------------------------- | ------------------- |
| 7.1  | Compliance dashboard loads (case list)              | ☐ Pass ☐ Fail ☐ N/A |
| 7.2  | Create compliance case → COMP-YYYY-NNNNN            | ☐ Pass ☐ Fail ☐ N/A |
| 7.3  | Case detail with evidence, timeline, decision panel | ☐ Pass ☐ Fail ☐ N/A |
| 7.4  | Assign reviewer works                               | ☐ Pass ☐ Fail ☐ N/A |
| 7.5  | Resolve case with resolution type                   | ☐ Pass ☐ Fail ☐ N/A |
| 7.6  | Apply penalty (suspend/restrict) → access modified  | ☐ Pass ☐ Fail ☐ N/A |
| 7.7  | Filter cases by status/priority                     | ☐ Pass ☐ Fail ☐ N/A |
| 7.8  | Reputation score with dimension breakdown           | ☐ Pass ☐ Fail ☐ N/A |
| 7.9  | Reputation changes on positive/negative actions     | ☐ Pass ☐ Fail ☐ N/A |
| 7.10 | Leaderboard displays correctly                      | ☐ Pass ☐ Fail ☐ N/A |
| 7.11 | Submit appeal with evidence → APL-YYYY-NNNNN        | ☐ Pass ☐ Fail ☐ N/A |
| 7.12 | Appeal without evidence → validation                | ☐ Pass ☐ Fail ☐ N/A |
| 7.13 | Admin reviews appeal (uphold/overturn)              | ☐ Pass ☐ Fail ☐ N/A |
| 7.14 | Policy list with versioning                         | ☐ Pass ☐ Fail ☐ N/A |
| 7.15 | Create/update/disable policy                        | ☐ Pass ☐ Fail ☐ N/A |
| 7.16 | Moderation dashboard (reported content)             | ☐ Pass ☐ Fail ☐ N/A |
| 7.17 | Notifications center lists all notifications        | ☐ Pass ☐ Fail ☐ N/A |
| 7.18 | Mark read / mark all read works                     | ☐ Pass ☐ Fail ☐ N/A |
| 7.19 | Notification badge on navbar icon                   | ☐ Pass ☐ Fail ☐ N/A |
| 7.20 | Notification preferences (channels)                 | ☐ Pass ☐ Fail ☐ N/A |
| 7.21 | Non-admin → 403 on admin pages                      | ☐ Pass ☐ Fail ☐ N/A |
| 7.22 | Loading/empty states present                        | ☐ Pass ☐ Fail ☐ N/A |
| 7.23 | Responsive on mobile                                | ☐ Pass ☐ Fail ☐ N/A |

### Phase 8: Enterprise & API (32 checks)

| #    | Item                                            | Result              |
| ---- | ----------------------------------------------- | ------------------- |
| 8.1  | Create organization works                       | ☐ Pass ☐ Fail ☐ N/A |
| 8.2  | Org dashboard shows overview                    | ☐ Pass ☐ Fail ☐ N/A |
| 8.3  | Invite member (email + role) works              | ☐ Pass ☐ Fail ☐ N/A |
| 8.4  | Accept invitation adds member                   | ☐ Pass ☐ Fail ☐ N/A |
| 8.5  | Remove member → access revoked                  | ☐ Pass ☐ Fail ☐ N/A |
| 8.6  | Create department and team                      | ☐ Pass ☐ Fail ☐ N/A |
| 8.7  | Org settings update works                       | ☐ Pass ☐ Fail ☐ N/A |
| 8.8  | Org analytics loads                             | ☐ Pass ☐ Fail ☐ N/A |
| 8.9  | Leave organization works                        | ☐ Pass ☐ Fail ☐ N/A |
| 8.10 | Default roles (Admin, Moderator, Finance, etc.) | ☐ Pass ☐ Fail ☐ N/A |
| 8.11 | Create custom role with permissions             | ☐ Pass ☐ Fail ☐ N/A |
| 8.12 | RBAC enforced (viewer cannot edit)              | ☐ Pass ☐ Fail ☐ N/A |
| 8.13 | Change member role → perms update immediately   | ☐ Pass ☐ Fail ☐ N/A |
| 8.14 | Generate API key (shown once with prefix)       | ☐ Pass ☐ Fail ☐ N/A |
| 8.15 | Scope selection on API key                      | ☐ Pass ☐ Fail ☐ N/A |
| 8.16 | Copy key to clipboard                           | ☐ Pass ☐ Fail ☐ N/A |
| 8.17 | Revoke key → 401 on use                         | ☐ Pass ☐ Fail ☐ N/A |
| 8.18 | Valid key → 200                                 | ☐ Pass ☐ Fail ☐ N/A |
| 8.19 | Scope enforcement (read-only → write blocked)   | ☐ Pass ☐ Fail ☐ N/A |
| 8.20 | API usage logs visible                          | ☐ Pass ☐ Fail ☐ N/A |
| 8.21 | Rate limit → 429                                | ☐ Pass ☐ Fail ☐ N/A |
| 8.22 | Register developer app (client ID + secret)     | ☐ Pass ☐ Fail ☐ N/A |
| 8.23 | App settings update works                       | ☐ Pass ☐ Fail ☐ N/A |
| 8.24 | Delete app works                                | ☐ Pass ☐ Fail ☐ N/A |
| 8.25 | Register webhook with URL + events              | ☐ Pass ☐ Fail ☐ N/A |
| 8.26 | Webhook delivery on trigger                     | ☐ Pass ☐ Fail ☐ N/A |
| 8.27 | Webhook delivery logs (status, retries)         | ☐ Pass ☐ Fail ☐ N/A |
| 8.28 | Retry failed webhook                            | ☐ Pass ☐ Fail ☐ N/A |
| 8.29 | Disable webhook → no deliveries                 | ☐ Pass ☐ Fail ☐ N/A |
| 8.30 | Test webhook endpoint                           | ☐ Pass ☐ Fail ☐ N/A |
| 8.31 | Loading/empty states                            | ☐ Pass ☐ Fail ☐ N/A |
| 8.32 | Responsive on mobile                            | ☐ Pass ☐ Fail ☐ N/A |

### Phase 9: AI Platform (25 checks)

| #    | Item                                                      | Result              |
| ---- | --------------------------------------------------------- | ------------------- |
| 9.1  | Campaign AI: generate description from keywords           | ☐ Pass ☐ Fail ☐ N/A |
| 9.2  | Regenerate produces different output                      | ☐ Pass ☐ Fail ☐ N/A |
| 9.3  | Empty keywords validation                                 | ☐ Pass ☐ Fail ☐ N/A |
| 9.4  | Generated text is editable                                | ☐ Pass ☐ Fail ☐ N/A |
| 9.5  | Campaign score (0-100) with tips                          | ☐ Pass ☐ Fail ☐ N/A |
| 9.6  | Funding recommendation displayed                          | ☐ Pass ☐ Fail ☐ N/A |
| 9.7  | AI provider fallback on failure                           | ☐ Pass ☐ Fail ☐ N/A |
| 9.8  | AI chat loads with greeting                               | ☐ Pass ☐ Fail ☐ N/A |
| 9.9  | Send/receive messages with context memory                 | ☐ Pass ☐ Fail ☐ N/A |
| 9.10 | Chat loading indicator (typing dots)                      | ☐ Pass ☐ Fail ☐ N/A |
| 9.11 | Clear conversation resets memory                          | ☐ Pass ☐ Fail ☐ N/A |
| 9.12 | AI error state with retry                                 | ☐ Pass ☐ Fail ☐ N/A |
| 9.13 | Recommendations display on dashboard                      | ☐ Pass ☐ Fail ☐ N/A |
| 9.14 | Dismiss recommendation                                    | ☐ Pass ☐ Fail ☐ N/A |
| 9.15 | Empty recommendations state                               | ☐ Pass ☐ Fail ☐ N/A |
| 9.16 | Prediction score with factor breakdown                    | ☐ Pass ☐ Fail ☐ N/A |
| 9.17 | Knowledge base search (semantic + keyword)                | ☐ Pass ☐ Fail ☐ N/A |
| 9.18 | Add/delete knowledge article                              | ☐ Pass ☐ Fail ☐ N/A |
| 9.19 | Create automation workflow (trigger + condition + action) | ☐ Pass ☐ Fail ☐ N/A |
| 9.20 | Workflow fires on trigger                                 | ☐ Pass ☐ Fail ☐ N/A |
| 9.21 | Workflow run logs visible                                 | ☐ Pass ☐ Fail ☐ N/A |
| 9.22 | Disable workflow → no trigger                             | ☐ Pass ☐ Fail ☐ N/A |
| 9.23 | AI usage/token tracking                                   | ☐ Pass ☐ Fail ☐ N/A |
| 9.24 | Daily budget enforcement                                  | ☐ Pass ☐ Fail ☐ N/A |
| 9.25 | Loading/error states on AI components                     | ☐ Pass ☐ Fail ☐ N/A |

### Phase 10: Global Platform (37 checks)

| #     | Item                                             | Result              |
| ----- | ------------------------------------------------ | ------------------- |
| 10.1  | Language selector visible                        | ☐ Pass ☐ Fail ☐ N/A |
| 10.2  | Switch language → UI updates                     | ☐ Pass ☐ Fail ☐ N/A |
| 10.3  | RTL layout works (if Arabic selected)            | ☐ Pass ☐ Fail ☐ N/A |
| 10.4  | Language preference persists on refresh          | ☐ Pass ☐ Fail ☐ N/A |
| 10.5  | Missing translations fall back to English        | ☐ Pass ☐ Fail ☐ N/A |
| 10.6  | Currency selector with multiple options          | ☐ Pass ☐ Fail ☐ N/A |
| 10.7  | Prices display in selected currency              | ☐ Pass ☐ Fail ☐ N/A |
| 10.8  | Currency conversion on donation                  | ☐ Pass ☐ Fail ☐ N/A |
| 10.9  | Plugin manager loads with installed list         | ☐ Pass ☐ Fail ☐ N/A |
| 10.10 | Install plugin from marketplace                  | ☐ Pass ☐ Fail ☐ N/A |
| 10.11 | Enable/disable plugin                            | ☐ Pass ☐ Fail ☐ N/A |
| 10.12 | Plugin configuration UI                          | ☐ Pass ☐ Fail ☐ N/A |
| 10.13 | Uninstall plugin                                 | ☐ Pass ☐ Fail ☐ N/A |
| 10.14 | Marketplace browse with ratings                  | ☐ Pass ☐ Fail ☐ N/A |
| 10.15 | Plugin detail page                               | ☐ Pass ☐ Fail ☐ N/A |
| 10.16 | Submit plugin for review (developer)             | ☐ Pass ☐ Fail ☐ N/A |
| 10.17 | Admin reviews plugin (approve/reject)            | ☐ Pass ☐ Fail ☐ N/A |
| 10.18 | Observability: metrics endpoint                  | ☐ Pass ☐ Fail ☐ N/A |
| 10.19 | Health check: all components reported            | ☐ Pass ☐ Fail ☐ N/A |
| 10.20 | Alerts: list/configure                           | ☐ Pass ☐ Fail ☐ N/A |
| 10.21 | Create backup                                    | ☐ Pass ☐ Fail ☐ N/A |
| 10.22 | List backups with size/status                    | ☐ Pass ☐ Fail ☐ N/A |
| 10.23 | Backup verification                              | ☐ Pass ☐ Fail ☐ N/A |
| 10.24 | Restore from backup                              | ☐ Pass ☐ Fail ☐ N/A |
| 10.25 | Backup retention policy                          | ☐ Pass ☐ Fail ☐ N/A |
| 10.26 | Full-text search (projects, creators, campaigns) | ☐ Pass ☐ Fail ☐ N/A |
| 10.27 | Faceted search filters                           | ☐ Pass ☐ Fail ☐ N/A |
| 10.28 | Search autocomplete                              | ☐ Pass ☐ Fail ☐ N/A |
| 10.29 | Search analytics                                 | ☐ Pass ☐ Fail ☐ N/A |
| 10.30 | File upload to storage                           | ☐ Pass ☐ Fail ☐ N/A |
| 10.31 | Signed URL generation                            | ☐ Pass ☐ Fail ☐ N/A |
| 10.32 | Expired signed URL → 403                         | ☐ Pass ☐ Fail ☐ N/A |
| 10.33 | Image optimization on upload                     | ☐ Pass ☐ Fail ☐ N/A |
| 10.34 | Mobile API: cursor pagination                    | ☐ Pass ☐ Fail ☐ N/A |
| 10.35 | Mobile API: field selection                      | ☐ Pass ☐ Fail ☐ N/A |
| 10.36 | Mobile API: versioning                           | ☐ Pass ☐ Fail ☐ N/A |
| 10.37 | Unsupported file rejection (security)            | ☐ Pass ☐ Fail ☐ N/A |

### Phase 11: Ecosystem Platform (37 checks)

| #     | Item                                                 | Result              |
| ----- | ---------------------------------------------------- | ------------------- |
| 11.1  | Agent Center loads with agent types listed           | ☐ Pass ☐ Fail ☐ N/A |
| 11.2  | Enable/disable agent toggles status                  | ☐ Pass ☐ Fail ☐ N/A |
| 11.3  | Agent configuration (schedule, permissions, actions) | ☐ Pass ☐ Fail ☐ N/A |
| 11.4  | "Run Now" executes agent, shows result               | ☐ Pass ☐ Fail ☐ N/A |
| 11.5  | Scheduled agent runs on schedule                     | ☐ Pass ☐ Fail ☐ N/A |
| 11.6  | Agent run log with timestamp, status, output         | ☐ Pass ☐ Fail ☐ N/A |
| 11.7  | Agent permissions show allowed actions               | ☐ Pass ☐ Fail ☐ N/A |
| 11.8  | Agent memory from previous runs                      | ☐ Pass ☐ Fail ☐ N/A |
| 11.9  | Workflow assignment executes steps in order          | ☐ Pass ☐ Fail ☐ N/A |
| 11.10 | Event bus dashboard shows recent events              | ☐ Pass ☐ Fail ☐ N/A |
| 11.11 | Create event subscription → active                   | ☐ Pass ☐ Fail ☐ N/A |
| 11.12 | Trigger event → subscribers notified                 | ☐ Pass ☐ Fail ☐ N/A |
| 11.13 | Failed event → dead-letter queue after retries       | ☐ Pass ☐ Fail ☐ N/A |
| 11.14 | High-priority events process before low              | ☐ Pass ☐ Fail ☐ N/A |
| 11.15 | Connector list shows Slack, Discord, Email, etc.     | ☐ Pass ☐ Fail ☐ N/A |
| 11.16 | Connect connector via OAuth → "Connected"            | ☐ Pass ☐ Fail ☐ N/A |
| 11.17 | Connected connector shows status + last sync         | ☐ Pass ☐ Fail ☐ N/A |
| 11.18 | Disconnect connector → removed                       | ☐ Pass ☐ Fail ☐ N/A |
| 11.19 | Test connection sends test message                   | ☐ Pass ☐ Fail ☐ N/A |
| 11.20 | MCP server returns tool definitions                  | ☐ Pass ☐ Fail ☐ N/A |
| 11.21 | MCP tool execution returns structured response       | ☐ Pass ☐ Fail ☐ N/A |
| 11.22 | Invalid MCP tool → "Tool not found"                  | ☐ Pass ☐ Fail ☐ N/A |
| 11.23 | Data export: CSV format downloads                    | ☐ Pass ☐ Fail ☐ N/A |
| 11.24 | Data export: Excel format downloads                  | ☐ Pass ☐ Fail ☐ N/A |
| 11.25 | Data export: JSON format downloads                   | ☐ Pass ☐ Fail ☐ N/A |
| 11.26 | Data export: PDF format downloads                    | ☐ Pass ☐ Fail ☐ N/A |
| 11.27 | Scheduled export runs automatically                  | ☐ Pass ☐ Fail ☐ N/A |
| 11.28 | Export template with field selection                 | ☐ Pass ☐ Fail ☐ N/A |
| 11.29 | Large export background-processed with notification  | ☐ Pass ☐ Fail ☐ N/A |
| 11.30 | Tenant management dashboard (list, status, usage)    | ☐ Pass ☐ Fail ☐ N/A |
| 11.31 | Create tenant → provisioned                          | ☐ Pass ☐ Fail ☐ N/A |
| 11.32 | Tenant branding (logo, colors)                       | ☐ Pass ☐ Fail ☐ N/A |
| 11.33 | Tenant quotas enforced                               | ☐ Pass ☐ Fail ☐ N/A |
| 11.34 | Suspend tenant → users blocked                       | ☐ Pass ☐ Fail ☐ N/A |
| 11.35 | Feature flags dashboard (list, status, rollout%)     | ☐ Pass ☐ Fail ☐ N/A |
| 11.36 | % Rollout and org-specific targeting                 | ☐ Pass ☐ Fail ☐ N/A |
| 11.37 | Platform analytics with date range + export          | ☐ Pass ☐ Fail ☐ N/A |

### Phase 12: Infrastructure & Observability (28 checks)

| #     | Item                                                         | Result              |
| ----- | ------------------------------------------------------------ | ------------------- |
| 12.1  | Cache dashboard shows hits/misses/size                       | ☐ Pass ☐ Fail ☐ N/A |
| 12.2  | Cache hit reduces query time                                 | ☐ Pass ☐ Fail ☐ N/A |
| 12.3  | Invalidate cache key → next fetch misses                     | ☐ Pass ☐ Fail ☐ N/A |
| 12.4  | Clear all cache → all keys removed                           | ☐ Pass ☐ Fail ☐ N/A |
| 12.5  | Distributed lock works (one acquires, other waits)           | ☐ Pass ☐ Fail ☐ N/A |
| 12.6  | TTL auto-eviction works                                      | ☐ Pass ☐ Fail ☐ N/A |
| 12.7  | Job queue dashboard (pending, processing, failed, completed) | ☐ Pass ☐ Fail ☐ N/A |
| 12.8  | Enqueue job → "Pending"                                      | ☐ Pass ☐ Fail ☐ N/A |
| 12.9  | Process job → "Processing" → "Completed"                     | ☐ Pass ☐ Fail ☐ N/A |
| 12.10 | Failed job retries with backoff → DLQ                        | ☐ Pass ☐ Fail ☐ N/A |
| 12.11 | Retry DLQ'd job → re-enqueued                                | ☐ Pass ☐ Fail ☐ N/A |
| 12.12 | High-priority before low-priority                            | ☐ Pass ☐ Fail ☐ N/A |
| 12.13 | Scheduled (cron) job runs on time                            | ☐ Pass ☐ Fail ☐ N/A |
| 12.14 | Cancel pending job → removed                                 | ☐ Pass ☐ Fail ☐ N/A |
| 12.15 | Connection pool dashboard (active, idle, waiting, max)       | ☐ Pass ☐ Fail ☐ N/A |
| 12.16 | Slow query logged → threshold alert                          | ☐ Pass ☐ Fail ☐ N/A |
| 12.17 | Database health check (reachable, response time)             | ☐ Pass ☐ Fail ☐ N/A |
| 12.18 | Endpoint metrics (calls, duration, error rate)               | ☐ Pass ☐ Fail ☐ N/A |
| 12.19 | Secrets manager lists names (values masked)                  | ☐ Pass ☐ Fail ☐ N/A |
| 12.20 | Add/rotate/delete secret works                               | ☐ Pass ☐ Fail ☐ N/A |
| 12.21 | Secret expiry warning triggered                              | ☐ Pass ☐ Fail ☐ N/A |
| 12.22 | DR dashboard shows plans with RPO/RTO                        | ☐ Pass ☐ Fail ☐ N/A |
| 12.23 | Failover test initiates per plan                             | ☐ Pass ☐ Fail ☐ N/A |
| 12.24 | Docker Compose stack (app + DB + Redis) starts healthy       | ☐ Pass ☐ Fail ☐ N/A |
| 12.25 | Health endpoint returns 200                                  | ☐ Pass ☐ Fail ☐ N/A |
| 12.26 | K8s pods deploy and become ready                             | ☐ Pass ☐ Fail ☐ N/A |
| 12.27 | HPA auto-scaling works under load                            | ☐ Pass ☐ Fail ☐ N/A |
| 12.28 | Rollback restores previous version                           | ☐ Pass ☐ Fail ☐ N/A |

---

## 13. Summary Metrics

| Category  | Total TC | Positive | Negative | Edge   | Checklist Items |
| --------- | -------- | -------- | -------- | ------ | --------------- |
| Phase 1-3 | ~270     | 9        | 10       | 10     | 51              |
| Phase 4   | ~70      | 5        | 6        | 6      | 28              |
| Phase 5   | ~24      | 5        | 5        | 5      | 11              |
| Phase 6   | ~50      | 5        | 6        | 6      | 18              |
| Phase 7   | ~66      | 4        | 5        | 5      | 23              |
| Phase 8   | ~55      | 4        | 7        | 7      | 32              |
| Phase 9   | ~72      | 5        | 5        | 6      | 25              |
| Phase 10  | ~94      | 5        | 5        | 7      | 37              |
| Phase 11  | ~92      | 5        | 6        | 8      | 37              |
| Phase 12  | ~86      | 5        | 4        | 7      | 28              |
| **Total** | **~879** | **52**   | **59**   | **67** | **290**         |

---

## 14. Known Issues from RUNTIME_FIX_REPORT.md

| Issue                                                         | Category       | Status                                                             |
| ------------------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| 2 Node.js OOM crashes in full parallel test suite (~26 tests) | Infrastructure | 🔧 Workaround available (`NODE_OPTIONS=--max-old-space-size=4096`) |
| 3 lib files with dead `secureLogger` import                   | Cleanup        | 📝 Review reachability                                             |
| 1.1 MB first-load JS bundles                                  | Performance    | 📝 Optimization opportunity                                        |
| PGRST205 graceful suppression in VerificationContext          | Compatibility  | ✅ Handled                                                         |
| All 130+ routes passing build                                 | Build          | ✅ Resolved                                                        |
| 24 API routes error-handling wrapped                          | Stability      | ✅ Resolved                                                        |
| All broken imports fixed (AI routes, middleware → lib/)       | Imports        | ✅ Resolved                                                        |

---

_End of Manual QA Verification Guide_
