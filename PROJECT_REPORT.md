# Fundora — Project Report

> **AI-Powered Crowdfunding Platform**
> Built with Next.js 16 · React 19 · Supabase · Razorpay · Tailwind CSS 4 · Framer Motion

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication Flow](#5-authentication-flow)
6. [Current Features](#6-current-features)
7. [Creator Flow](#7-creator-flow)
8. [Backer Flow](#8-backer-flow)
9. [Payment Flow (Razorpay)](#9-payment-flow-razorpay)
10. [AI Features](#10-ai-features)
11. [Social Features](#11-social-features)
12. [API Endpoints](#12-api-endpoints)
13. [Security Implementation](#13-security-implementation)
14. [Realtime Features](#14-realtime-features)
15. [File Storage](#15-file-storage)
16. [Testing](#16-testing)
17. [Environment Variables](#17-environment-variables)
18. [Known Limitations & Roadmap](#18-known-limitations--roadmap)

---

## 1. Project Overview

**Fundora** is a full-stack AI-powered crowdfunding platform where creators launch projects and backers fund them with real money via Razorpay. The platform features AI-driven campaign generation, intelligent project scoring, real-time funding updates, direct messaging, and a comprehensive creator analytics dashboard.

### Key Differentiators
- **Per-Creator Razorpay**: Each creator has their own payment gateway — funds go directly to them
- **AI Campaign Generator**: GPT-4o-mini writes campaign descriptions automatically
- **AI Chat Agent**: Llama 3-powered assistant for platform navigation and recommendations
- **Intelligence Scoring**: Algorithmic Growth Catalyst + Performance scores on every project
- **Real-Time Updates**: Funding progress, chat messages, and analytics update live via Supabase Realtime
- **Donor Churn Prediction**: ML-like scoring to predict which donors are at risk of leaving

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16.2.11 (Pages Router, Turbopack) | SSR/CSR routing, API routes, middleware |
| **UI Library** | React 19 | Component rendering |
| **Styling** | Tailwind CSS v4 + custom `@theme` tokens | Design system, glassmorphism effects |
| **Animations** | Framer Motion | Page transitions, scroll reveals, hover effects |
| **Icons** | Material Symbols Outlined (Google Fonts) | 3000+ icon set |
| **Database** | Supabase (PostgreSQL) | Data storage, auth, realtime |
| **Auth** | Supabase Auth (Email/Password) | User authentication |
| **Storage** | Supabase Storage | File uploads (images, videos, documents) |
| **Payments** | Razorpay (per-creator integration) | Payment processing |
| **AI (Chat)** | OpenRouter → Meta Llama 3 8B | AI assistant chat |
| **AI (Content)** | OpenAI GPT-4o-mini | Campaign description generation |
| **PDF Generation** | jsPDF (client) + pdfkit (server) | Receipts and analytics exports |
| **Charts** | Recharts | Analytics visualizations |
| **Testing** | Vitest + Testing Library | Unit and integration tests |

---

## 3. Folder Structure

```
Fundora/
├── components/                          # 72 React components
│   ├── AnalyticsCharts.jsx             # Recharts wrappers (Revenue, Earnings, Funding)
│   ├── AnimatedBackground.jsx          # Drifting gradient orbs + noise texture
│   ├── CampaignAIGenerator.jsx         # AI campaign description generator
│   ├── CategorySelector.jsx            # Multi-select category picker
│   ├── FiltersSidebar.jsx              # Explore page filters
│   ├── FloatingAIChat.jsx              # Global AI assistant chat widget
│   ├── FloatingProjectChat.jsx         # Project-level floating chat (portal)
│   ├── Footer.jsx                      # 6-column site footer
│   ├── MediaUploader.jsx               # Drag-and-drop file upload
│   ├── Navbar.jsx                      # Navigation bar with scroll detection
│   ├── ProgressBar.jsx                 # Generic progress bar
│   ├── ProjectCard.jsx                 # Project card for grids
│   ├── ProjectChat.jsx                 # Project group chat
│   ├── SEO.jsx                         # Meta tags, OG, structured data
│   ├── TeamEditor.jsx                  # Add/remove team members
│   ├── TypingText.jsx                  # Animated typing effect
│   ├── connections/
│   │   └── ConnectionCard.jsx          # Follower/following card
│   ├── create/                         # 4-step project creation wizard
│   │   ├── AIGeneratorStep.jsx         # Step 2: AI campaign
│   │   ├── DraftManager.js             # localStorage draft persistence
│   │   ├── FundingStep.jsx             # Step 4: Goal, deadline, team
│   │   ├── MediaStep.jsx               # Step 3: Thumbnail + media
│   │   ├── ProjectDetailsStep.jsx      # Step 1: Title, tagline, categories
│   │   ├── StepIndicator.jsx           # Progress dots
│   │   └── WizardNavigation.jsx        # Prev/Next/SaveDraft
│   ├── creator/                        # Creator profile components
│   │   ├── AchievementCard.jsx         # Achievement badge
│   │   ├── AchievementsBento.jsx       # Achievement grid
│   │   ├── AnimatedCounter.jsx         # Number counter animation
│   │   ├── DashboardLayout.jsx         # Sidebar + content layout
│   │   ├── ParallaxBanner.jsx          # Parallax scrolling banner
│   │   ├── ProfileActions.jsx          # Edit/Message/Follow buttons
│   │   ├── ProfileHeader.jsx           # Banner + avatar header
│   │   ├── ProjectTabs.jsx             # Tabbed project list
│   │   ├── SectionReveal.jsx           # Scroll-triggered reveal
│   │   ├── SidebarAbout.jsx            # Bio + achievements
│   │   ├── SidebarConnect.jsx          # Social links
│   │   ├── StatCard.jsx                # Individual stat card
│   │   └── StatsGrid.jsx              # Grid of stat cards
│   ├── explore/                        # Explore page components
│   │   ├── ExploreCard.jsx             # Project card for explore
│   │   ├── SidebarFilters.jsx          # Filter sidebar
│   │   └── SkeletonCard.jsx            # Loading skeleton
│   ├── fund/                           # Payment/funding components
│   │   ├── CustomContribution.jsx      # Custom amount input
│   │   ├── FundingProgress.jsx         # Funding visualization
│   │   ├── PaymentSummary.jsx          # Payment summary
│   │   ├── ProjectSummary.jsx          # Project summary for fund page
│   │   ├── RewardTierCard.jsx          # Reward tier selection
│   │   └── TrustIndicators.jsx         # Trust verification badges
│   ├── landing/                        # Landing page sections
│   │   ├── FinalCTA.jsx                # Bottom CTA section
│   │   ├── HeroSection.jsx             # Hero with typing animation
│   │   ├── HowItWorks.jsx              # "Intelligent Ecosystem" bento grid
│   │   ├── StatsBar.jsx                # Real-time platform stats
│   │   └── TrendingProjects.jsx        # Top 3 projects from Supabase
│   ├── project/                        # Project detail page components
│   │   ├── FundingSidebar.jsx          # Sticky funding card
│   │   ├── GalleryGrid.jsx             # Bento image gallery
│   │   ├── HeroBanner.jsx              # Project title section
│   │   ├── IntelligenceInsight.jsx     # AI scoring cards
│   │   ├── ProjectStory.jsx            # Full description section
│   │   ├── RoadmapTimeline.jsx         # Phase timeline
│   │   ├── SimilarProjects.jsx         # Similar project recommendations
│   │   └── TeamMembers.jsx             # Team member cards
│   └── ui/                             # Reusable UI primitives
│       ├── Badge.jsx, Button.jsx, Card.jsx, EmptyState.jsx
│       ├── GlassCard.jsx, Input.jsx, LoadingSpinner.jsx
│       ├── PageContainer.jsx, PageHeader.jsx
│       ├── Select.jsx, Textarea.jsx, Toast.jsx
│       └── index.js                    # Barrel export
│
├── context/
│   └── FollowContext.js                # Global follow/unfollow state provider
│
├── lib/                                # Shared utilities
│   ├── auth.js                         # signUp, signIn, signOut, getCurrentUser
│   ├── categories.js                   # PROJECT_CATEGORIES constant
│   ├── generateReceipt.js              # Client-side PDF receipt (jsPDF)
│   ├── pdfCharts.js                    # Chart-to-PDF rendering
│   ├── projects.js                     # createProject, updateProject, deleteProject
│   ├── rateLimit.js                    # In-memory sliding-window rate limiter
│   ├── saved.js                        # localStorage watchlist (get/save/toggle)
│   ├── storage.js                      # Supabase file upload helpers
│   ├── supabaseAdmin.js                # Server-side client (service role)
│   ├── supabaseClient.js               # Browser client (createBrowserClient)
│   ├── uploadCreatorFile.js            # Creator file upload utility
│   └── withAuth.js                     # API route auth middleware (Bearer token)
│
├── pages/                              # Next.js pages (35 files)
│   ├── _app.js                         # App wrapper (providers, Razorpay script)
│   ├── _document.js                    # Custom document
│   ├── index.js                        # Landing page
│   ├── home.js                         # Alternate home (legacy)
│   ├── login.js                        # Login page
│   ├── signup.js                       # Signup page
│   ├── explore.js                      # Explore/browse projects
│   ├── saved.js                        # Saved projects watchlist
│   ├── followers.js                    # Connections page
│   ├── edit-profile.js                 # Profile settings
│   ├── auth/callback.js                # OAuth callback handler
│   ├── create/index.js                 # 4-step project wizard
│   ├── creator/[id].js                 # Public creator profile
│   ├── creator/analytics.js            # Creator growth dashboard
│   ├── creator/edit.js                 # Legacy profile editor
│   ├── creator/funds-got.js            # Funds received list
│   ├── creator/payments.js             # Razorpay config
│   ├── creator/profile.js              # Legacy creator profile
│   ├── dm/index.js                     # DM inbox
│   ├── dm/[userId].js                  # DM chat
│   ├── edit/[id].js                    # Edit existing project
│   ├── payments/index.js              # Payment/donation page
│   ├── projects/[id].js                # Project detail page
│   ├── projects/[id]/fund.js           # Fund/back a project
│   ├── account/delete.js               # Account deletion page
│   └── api/                            # 10 API routes
│       ├── ai/agent.js                 # AI chat (OpenRouter/Llama 3)
│       ├── ai/generate-campaign.js     # AI campaign (OpenAI GPT-4o-mini)
│       ├── ai/funding-recommendation.js # AI category recommendation
│       ├── creator/razorpay-config.js  # Razorpay credential storage
│       ├── razorpay/create-order.js    # Create Razorpay order
│       ├── razorpay/verify.js          # Verify payment
│       ├── razorpay/webhook.js         # Razorpay webhook
│       ├── receipts/generate.js        # PDF receipt data
│       ├── account/delete.js           # Account deletion API
│       └── export-analytics.js         # Analytics PDF export
│
├── styles/
│   ├── globals.css                     # Global styles + design tokens
│   └── aurora.css                      # Aurora theme effects
│
├── tests/                              # 19 test files
│   ├── setup.js                        # Vitest setup
│   ├── a11y/audit.test.js              # Accessibility audit
│   ├── api/                            # API route tests (10 files)
│   ├── components/                     # Component tests (3 files)
│   ├── integration/                    # Integration tests
│   └── lib/                            # Library tests (3 files)
│
├── supabase/
│   └── creator_payment_configs.sql     # SQL migration
│
├── public/                             # Static assets
│   ├── favicon.ico, logo.png, robots.txt, sitemap.xml
│   └── icons/                          # Social icons (Instagram, YouTube)
│
├── middleware.js                        # Next.js middleware (route protection)
├── next.config.mjs                     # Next.js config (CSP, images, caching)
├── tailwind.config.js                  # Tailwind CSS configuration
├── vitest.config.js                    # Test configuration
├── eslint.config.mjs                   # ESLint configuration
├── package.json                        # Dependencies
└── .env.local                          # Environment variables
```

**File counts:**
| Directory | Files |
|-----------|-------|
| `components/` | 72 |
| `pages/` | 35 (including 10 API routes) |
| `lib/` | 12 |
| `context/` | 1 |
| `tests/` | 19 |
| `styles/` | 2 |
| **Total source files** | **~141** |

---

## 4. Database Schema

### Entity Relationship Diagram

```
auth.users (Supabase managed)
  ├── profiles (1:1)
  ├── creators (1:1)
  ├── creator_payment_configs (1:1, CASCADE delete)
  ├── projects (1:N)
  │     ├── media (1:N)
  │     ├── team_members (1:N)
  │     ├── public_donations (1:N)
  │     └── project_messages (1:N)
  ├── public_donations.payer_id (1:N)
  ├── followers.follower_id (M:N self-referencing)
  ├── dm_conversations.user1/user2 (M:N)
  │     └── dm_messages (1:N)
  │           └── typing_status (1:1)
  ├── blocked_users (M:N)
  └── muted_users (M:N)
```

### Table Details

#### `profiles`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Maps to `auth.users.id` |
| `full_name` | text | Display name |
| `bio` | text | User biography |
| `website` | text | Personal website |
| `avatar_url` | text | Profile picture URL |
| `banner_url` | text | Profile banner URL |
| `twitter` | text | Twitter handle |
| `linkedin` | text | LinkedIn URL |
| `github` | text | GitHub username |
| `instagram` | text | Instagram handle |
| `youtube` | text | YouTube channel |

#### `projects`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `title` | text | Project title |
| `short` | text | Short description (tagline) |
| `description` | text | Full campaign description |
| `goal` | numeric | Funding goal in INR |
| `pledged` | numeric | Total amount pledged (default 0) |
| `deadline` | timestamptz | Campaign end date |
| `thumbnail` | text | Thumbnail image URL |
| `prototypeUrl` | text | Link to prototype/demo |
| `owner_id` | uuid (FK) | Creator's user ID |
| `categories` | text[] | Array of category tags |
| `created_at` | timestamptz | Creation timestamp |

#### `public_donations`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `project_id` | uuid (FK) | Funded project |
| `amount` | numeric | Donation amount in INR |
| `payer_id` | uuid (FK) | Backer's user ID |
| `payer_email` | text | Backer email (nullable) |
| `status` | text | "paid" or "success" |
| `razorpay_payment_id` | text | Razorpay payment ID |
| `razorpay_order_id` | text | Razorpay order ID |
| `created_at` | timestamptz | Donation timestamp |

#### `media`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `project_id` | uuid (FK) | Parent project |
| `url` | text | File URL |
| `type` | text | "image", "video", or "document" |
| `name` | text | Original filename |
| `created_at` | timestamptz | Upload timestamp |

#### `team_members`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `project_id` | uuid (FK) | Parent project |
| `name` | text | Member name |
| `role` | text | Member role |
| `email` | text | Contact email |
| `creator_id` | uuid (FK) | Project owner |

#### `followers`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `follower_id` | uuid (FK) | User who follows |
| `following_id` | uuid (FK) | User being followed |

#### `creator_payment_configs`
| Column | Type | Description |
|--------|------|-------------|
| `creator_user_id` | uuid (PK, FK) | Creator's user ID (CASCADE) |
| `razorpay_key_id` | text | Razorpay API key |
| `razorpay_key_secret` | text | Razorpay API secret |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

#### `dm_conversations`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `user1` | uuid (FK) | First user (sorted) |
| `user2` | uuid (FK) | Second user (sorted) |
| `created_at` | timestamptz | Creation timestamp |

#### `dm_messages`
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `conversation_id` | uuid (FK) | Parent conversation |
| `sender_id` | uuid (FK) | Message author |
| `content` | text | Message text |
| `attachment_url` | text | File attachment URL |
| `attachment_type` | text | "image", "video", or "file" |
| `created_at` | timestamptz | Send timestamp |

#### Other Tables
- **`typing_status`**: `conversation_id`, `user_id`, `is_typing` — typing indicators
- **`project_messages`**: `project_id`, `sender_id`, `sender_name`, `content`, `attachment_url` — project chat
- **`blocked_users`**: `blocker_id`, `blocked_id` — DM blocking
- **`muted_users`**: `user_id`, `muted_user_id` — DM muting
- **`creators`**: Legacy creator profile (name, age, email, mobile, photo, upi_qr)

---

## 5. Authentication Flow

### Method: Email + Password (Supabase Auth)

```
┌─────────┐     ┌──────────┐     ┌────────────┐     ┌──────────┐
│  Signup  │────▶│  Verify  │────▶│   Login    │────▶│  Session │
│  Page    │     │  Email   │     │   Page     │     │  (Cookie)│
└─────────┘     └──────────┘     └────────────┘     └──────────┘
```

### Signup (`pages/signup.js`)
- `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
- Sends verification email; user must verify before login
- Password: min 8 characters with special symbol

### Login (`pages/login.js`)
- `supabase.auth.signInWithPassword({ email, password })`
- On success: redirect to `/` via `window.location.href`

### Session Management
- **Client**: `@supabase/ssr` `createBrowserClient` — sessions stored in **cookies** (not localStorage)
- **Server**: `@supabase/ssr` `createServerClient` — reads cookies for middleware
- **API routes**: Bearer token from `Authorization` header, validated via `supabaseAdmin.auth.getUser(token)`

### Middleware Protection (`middleware.js`)
Protected routes (redirect to `/login?redirect=...` if unauthenticated):
```
/create, /payments, /saved, /followers, /dm,
/edit-profile, /edit, /creator/analytics,
/creator/profile, /creator/edit, /creator/funds-got,
/creator/payments, /account
```

### Ownership Verification
- **Client-side**: `user.id === project.owner_id` check in edit pages
- **Server-side**: `withAuth` HOC validates Bearer token, attaches `req.user`
- **Database**: RLS policies on `creator_payment_configs` (creator-only access)

### Role Model
No formal roles. Implicit roles:
- **Creator**: Anyone who creates a project (`owner_id` = their user ID)
- **Backer**: Anyone who donates (`payer_id` stored in `public_donations`)
- **Admin**: None (no admin panel)

---

## 6. Current Features

### Landing Page
| Feature | Description |
|---------|-------------|
| Hero Section | Typing animation "Where AI Meets Venture", gradient title, 2 CTAs |
| Stats Bar | Real-time platform stats (total raised, projects, backers, team) — fetched from Supabase |
| Trending Projects | Top 3 projects by pledged amount — real Supabase data |
| Intelligent Ecosystem | Bento grid: AI Due Diligence, Secure Escrow, Syndicate Power, Growth Intelligence |
| Final CTA | "Ready to fund the next giant?" with signup button |

### Explore Page
- Grid of all projects with filters (category, sort, search)
- Real-time project updates via Supabase subscription
- Skeleton loading states
- Category filtering with shared constant (`lib/categories.js`)

### Project Detail Page
- Hero banner with title, category badge, description
- Funding sidebar (sticky): pledged amount, progress bar, backers, views, fund button
- Intelligence Insight: Growth Catalyst + Performance AI scores
- Project Story: Full description with prototype link
- Concept Gallery: Bento image grid with fullscreen preview
- Project Roadmap: 3-phase vertical timeline
- Team Members: Avatar cards with email links
- Similar Opportunities: Related project recommendations
- Project Chat: Real-time group chat for project discussions

### Create Project (4-Step Wizard)
1. **Project Details**: Title (min 3 chars), tagline (min 10 chars), multi-category selector
2. **AI Generator**: GPT-4o-mini generates campaign description; accept or regenerate
3. **Media**: Thumbnail upload (required, <10MB) + multiple media files
4. **Funding**: Goal amount, deadline, prototype URL, team member editor

Draft system saves/restores to localStorage.

### Creator Profile
- Public profile with banner, avatar, bio, achievements
- Project list tab
- Stats grid (total raised, project count, followers)
- Social links (Twitter, LinkedIn, GitHub, Instagram, YouTube, Website)
- Follow/Unfollow functionality
- Achievement badges (auto-generated from milestones)

### Creator Analytics Dashboard
- KPI Cards: Total Earnings, Unique Donors, Retention Rate, Active Projects
- AI Insights: Auto-generated analysis via AI agent
- AI Action Buttons: Improve Campaign, Promotion Tips, Optimize Goal
- Growth Engine: Growth Score (0-100), Campaign Success Rate, Donor Expansion
- Charts: Earnings Over Time, Funding by Project
- Donor Churn Risk Analysis: Predicts at-risk donors
- Revenue Prediction: 6-month forward forecast

---

## 7. Creator Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Signup  │───▶│  Create  │───▶│  Publish │───▶│  Manage  │
│          │    │ Project  │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │  Razorpay│    │ Analytics│    │  Profile │
              │  Setup   │    │Dashboard │    │  Edit    │
              └──────────┘    └──────────┘    └──────────┘
```

### Step 1: Create Project (`/create`)
- 4-step wizard with animated transitions
- Step 1: Title, tagline, categories (multi-select)
- Step 2: AI generates campaign description (OpenAI GPT-4o-mini)
- Step 3: Upload thumbnail + media files
- Step 4: Set funding goal, deadline, prototype URL, add team members
- Draft auto-saved to localStorage

### Step 2: Configure Payments (`/creator/payments`)
- Enter Razorpay Key ID and Key Secret
- Stored in `creator_payment_configs` table
- Falls back to global env vars if not configured

### Step 3: Manage Projects (`/edit/[id]`)
- Edit title, descriptions, goal, deadline, categories
- Manage media (view, delete, upload new)
- Manage team members (add, remove)

### Step 4: Track Performance (`/creator/analytics`)
- Real-time donation tracking
- AI-powered insights and recommendations
- Growth score calculation
- Donor churn prediction
- Revenue forecasting

### Creator Pages
| Page | Route | Purpose |
|------|-------|---------|
| Public Profile | `/creator/[id]` | Public view with projects, stats, achievements |
| Analytics | `/creator/analytics` | Growth dashboard with AI insights |
| Payments Config | `/creator/payments` | Razorpay setup |
| Funds Received | `/creator/funds-got` | List of all donations received |
| Edit Profile | `/creator/edit` | Legacy profile editor |
| Profile Form | `/creator/profile` | Legacy creator profile |

---

## 8. Backer Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Explore │───▶│  Select  │───▶│  Fund    │───▶│ Receipt  │
│ Projects │    │ Project  │    │  (Pay)   │    │ Download │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                    │
              ┌─────┴─────┐
              ▼           ▼
        ┌──────────┐ ┌──────────┐
        │  Watchlist│ │  Share   │
        └──────────┘ └──────────┘
```

### Step 1: Discover Projects (`/explore`)
- Browse all projects with filters and search
- Sort by trending, newest, most funded
- Real-time project updates

### Step 2: View Project (`/projects/[id]`)
- Full project detail with AI intelligence scores
- Read project story, view gallery, check roadmap
- See team members
- View similar projects

### Step 3: Fund Project (`/projects/[id]/fund`)
- Select reward tier (₹100 / ₹500 / ₹1000) or custom amount
- Payment via Razorpay Checkout modal
- Real-time funding progress updates

### Step 4: Post-Payment
- Auto-generated PDF receipt (jsPDF)
- Receipt downloadable from payment history
- Donation recorded in `public_donations`

### Backer Features
| Feature | Description |
|---------|-------------|
| Watchlist | Save projects to localStorage watchlist |
| Share | Share project link (native share or clipboard) |
| Payment History | View all donations at `/payments` |
| Receipt Download | PDF receipt for each donation |
| Follow Creators | Follow/unfollow from creator profiles |
| DM Creators | Direct message creators |

---

## 9. Payment Flow (Razorpay)

### Architecture: Per-Creator Integration
Each creator configures their own Razorpay API keys. Payments go directly to the creator's Razorpay account, not a platform account.

### End-to-End Flow

```
1. Creator configures Razorpay keys
   POST /api/creator/razorpay-config
   → Stored in creator_payment_configs table

2. Backer initiates payment
   POST /api/razorpay/create-order
   → Fetches creator's Razorpay keys
   → Creates Razorpay order (amount × 100 paise)
   → Returns { orderId, key }

3. Razorpay Checkout opens (client-side)
   → User completes payment in Razorpay modal

4. Payment verification
   POST /api/razorpay/verify
   → HMAC-SHA256 signature verification (timingSafeEqual)
   → INSERT into public_donations (status: "paid")
   → RPC increment_project_funding
   → Returns { donationId }

5. Receipt generation
   POST /api/receipts/generate
   → Fetches donation + project data
   → Client-side jsPDF generates PDF receipt

6. Webhook (safety net)
   POST /api/razorpay/webhook
   → Raw body signature verification
   → Idempotent insert (checks payment_id uniqueness)
   → RPC increment_project_funding
```

### Security Measures
- HMAC-SHA256 signature verification with `crypto.timingSafeEqual`
- Raw body parsing for webhook (bodyParser disabled)
- Idempotent donation recording (verify + webhook paths)
- Rate limiting: 10 requests/minute per endpoint

---

## 10. AI Features

### 1. AI Campaign Generator (`/api/ai/generate-campaign`)
- **Provider**: OpenAI GPT-4o-mini
- **Input**: Project title, category, funding goal
- **Output**: 150-300 word professional campaign description
- **Rate Limit**: 5 requests/minute
- **Used in**: Step 2 of create wizard

### 2. AI Chat Agent (`/api/ai/agent`)
- **Provider**: OpenRouter → Meta Llama 3 8B Instruct
- **Input**: User message + optional chat history
- **Context**: Fetches top 5 projects, computes freshness/momentum scores
- **Output**: Personalized response based on donor/creator role
- **Rate Limit**: 20 requests/minute
- **Used in**: Floating AI Chat widget + Analytics page

### 3. AI Funding Recommendation (`/api/ai/funding-recommendation`)
- **Provider**: Pure algorithmic (no external API)
- **Input**: Creator ID
- **Scoring**: `0.4 × marketDemand + 0.3 × creatorSuccess + 0.2 × donorScore + 0.1 × engagement`
- **Output**: Recommended category with score
- **Rate Limit**: 10 requests/minute

### 4. Intelligence Insight (Client-Side)
- **Growth Catalyst Score** (0-100): Funding progress, goal size, category, deadline
- **Performance Score** (0-100): Media count, team count, description length, prototype
- **Derived Metrics**: Technical Feasibility, ROI, Market Alpha, Energy Optimization, Latency, Efficiency Tier
- Displayed on every project detail page

### 5. Creator Analytics AI Actions
Three AI-powered action buttons on the analytics dashboard:
- **Improve Campaign**: Analyzes weaknesses, missing elements, priority actions
- **Promotion Tips**: Platform strategy, content strategy, viral growth ideas
- **Optimize Goal**: Recommended goal, reasoning, risk level, strategy

### 6. Donor Churn Prediction
- Recency score (days since last donation × 1.5)
- Frequency score (donation count based)
- Trend score (average donation amount)
- Weighted formula: `0.4 × recency + 0.35 × frequency + 0.25 × trend`
- Status labels: Loyal / At Risk / High Risk

### 7. Revenue Forecast
- 6-month forward prediction based on month-over-month growth rate
- Calculates momentum from last two months and extrapolates

---

## 11. Social Features

### Follow/Unfollow
- **Context**: `FollowContext.js` — global state tracking `followingIds`
- **API**: Supabase `followers` table (insert/delete)
- **UI**: Follow/Unfollow buttons on creator profiles
- **Connections Page**: `/followers` — tabbed view (Followers / Following) with search

### Direct Messages
- **Inbox**: `/dm` — lists conversations with last message + timestamp
- **Chat**: `/dm/[userId]` — full chat interface with:
  - Real-time messages via Supabase Realtime
  - Typing indicators
  - File/image attachments (chat-attachments bucket)
  - Emoji picker (9 emojis)
  - Block/Mute functionality
  - AI/Human toggle in chat header

### Saved Projects / Watchlist
- **Storage**: localStorage (not Supabase)
- **Functions**: `isSaved()`, `toggleSave()`, `getSaved()`
- **UI**: Bookmark icon on project detail page
- **Page**: `/saved` — grid of saved projects

### Team Members
- **Management**: Add/remove during project creation or edit
- **Display**: Avatar cards with name, role, email on project detail page
- **Storage**: `team_members` table

### Project Chat
- Real-time group chat for each project
- File/image attachments (chat_attachments bucket)
- Unread message indicators
- Floating chat widget (portal-based)

---

## 12. API Endpoints

| # | Route | Method | Auth | Rate Limit | Purpose |
|---|-------|--------|------|------------|---------|
| 1 | `/api/ai/agent` | POST | ✅ Bearer | 20/min | AI chat assistant (OpenRouter/Llama 3) |
| 2 | `/api/ai/generate-campaign` | POST | ✅ Bearer | 5/min | AI campaign description (OpenAI) |
| 3 | `/api/ai/funding-recommendation` | POST | ✅ Bearer | 10/min | AI category recommendation |
| 4 | `/api/creator/razorpay-config` | GET/POST | ✅ Bearer | — | Load/save Razorpay credentials |
| 5 | `/api/razorpay/create-order` | POST | ✅ Bearer | 10/min | Create Razorpay payment order |
| 6 | `/api/razorpay/verify` | POST | ✅ Bearer | 10/min | Verify payment + record donation |
| 7 | `/api/razorpay/webhook` | POST | ❌ Sig verify | — | Razorpay webhook handler |
| 8 | `/api/receipts/generate` | POST | ✅ Bearer | — | Generate donation receipt data |
| 9 | `/api/account/delete` | POST | ✅ Bearer | 3/min | Delete user account + all data |
| 10 | `/api/export-analytics` | POST | ✅ Bearer | 5/min | Generate PDF analytics report |

### Authentication Pattern
All authenticated routes use the `withAuth` HOC:
```javascript
export default withAuth(async function handler(req, res) {
  const user = req.user; // Attached by withAuth
  // ... business logic
}, { rateLimit: { windowMs: 60000, max: N } });
```

---

## 13. Security Implementation

### Headers (Production Only)
| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-XSS-Protection` | `1; mode=block` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `poweredByHeader` | `false` |

### Content Security Policy (Production)
```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com ...
font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com
img-src 'self' data: blob: https://*.supabase.co ...
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openrouter.ai ...
frame-src https://checkout.razorpay.com https://api.razorpay.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
```

### Rate Limiting
- **Implementation**: In-memory sliding-window (`lib/rateLimit.js`)
- **Key**: Bearer token prefix (first 16 chars) or IP from `x-forwarded-for`
- **Cleanup**: Every 5 minutes, removes expired entries
- **Response Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`

### Input Validation
- Project title: min 3 chars
- Short description: min 10 chars
- Categories: at least 1
- Goal: must be > 0
- Deadline: must be in the future
- Thumbnail: required + max 10MB
- API routes: Method checking (405 for wrong HTTP method)

### Cryptographic Security
- **Payment signatures**: HMAC-SHA256 with `crypto.timingSafeEqual` (prevents timing attacks)
- **Webhook signatures**: Same HMAC-SHA256 + timingSafeEqual pattern
- **Password storage**: Supabase (bcrypt)

---

## 14. Realtime Features

| Channel | Table | Event | Location |
|---------|-------|-------|----------|
| `project-funding-realtime` | `projects` | UPDATE | Project detail page |
| `project-funding-updates` | `projects` | UPDATE | Fund page |
| `projects-live-updates` | `projects` | UPDATE | Explore page |
| `creator-analytics-live` | `public_donations` | INSERT | Analytics dashboard |
| `project-chat-${id}` | `project_messages` | INSERT | Project chat |
| `dm-inbox` | `dm_messages` | INSERT | DM inbox |
| `dm-${id}` | `dm_messages` | INSERT | DM chat |
| `typing-${id}` | `typing_status` | ALL | DM chat |

---

## 15. File Storage

### Supabase Storage Buckets

| Bucket | Purpose | Upload Flow |
|--------|---------|-------------|
| `project-thumbnails` | Project thumbnails | `lib/storage.js` (10MB limit) |
| `projects` | Project media files | `lib/storage.js` |
| `avatars` | User profile avatars | `pages/edit-profile.js` (4MB limit) |
| `banners` | User profile banners | `pages/edit-profile.js` (8MB limit) |
| `creator-photos` | Creator profile photos | `lib/uploadCreatorFile.js` |
| `creator-qr` | Creator UPI QR codes | `lib/uploadCreatorFile.js` |
| `chat_attachments` | Project chat files | `components/ProjectChat.jsx` |
| `chat-attachments` | DM chat files | `pages/dm/[userId].js` |

---

## 16. Testing

### Test Framework: Vitest + Testing Library

| Test Category | Files | Coverage |
|---------------|-------|----------|
| API Routes | 10 files | ai, create-order, verify, webhook, receipts, razorpay-config, rateLimit, withAuth, funding-recommendation, generate-campaign |
| Components | 3 files | FloatingAIChat, Login, Signup |
| Libraries | 3 files | auth, projects, saved |
| Integration | 1 file | payment-flow |
| Accessibility | 1 file | a11y audit |
| **Total** | **18 test files** | |

---

## 17. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Public anon key (client-side)
SUPABASE_SERVICE_ROLE_KEY=       # Admin key (server-side, bypasses RLS)

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=     # Global Razorpay key (fallback)
RAZORPAY_KEY_ID=                 # Global Razorpay key (server fallback)
RAZORPAY_KEY_SECRET=             # Global Razorpay secret (server fallback)
RAZORPAY_WEBHOOK_SECRET=         # Webhook signature verification

# AI
OPENAI_API_KEY=                  # GPT-4o-mini (campaign generation)
OPENROUTER_API_KEY=              # Llama 3 (AI chat agent)
```

---

## 18. Known Limitations & Roadmap

### Current Limitations
1. **No Admin Panel**: No admin dashboard for platform management
2. **No Email Notifications**: No email alerts for donations, messages, or project updates
3. **No OAuth Login**: Only email/password authentication (no Google, GitHub, etc.)
4. **localStorage Watchlist**: Saved projects are device-specific (not synced across devices)
5. **No Search Backend**: Explore search is client-side filtering (not full-text search)
6. **Rate Limiter is Per-Instance**: In-memory rate limiting doesn't work across serverless instances
7. **Razorpay Secrets in Plaintext**: Creator payment configs stored unencrypted in database
8. **No Multi-Currency**: Only INR supported
9. **No Refund Flow**: Webhook logs refunds but doesn't process them
10. **Chat Bucket Naming Inconsistency**: Project chat uses `chat_attachments`, DM uses `chat-attachments`

### Suggested Roadmap
| Phase | Feature | Priority |
|-------|---------|----------|
| **Phase 1** | Admin dashboard (user/project management) | High |
| **Phase 1** | Email notifications (donation confirmations, new messages) | High |
| **Phase 1** | OAuth login (Google, GitHub) | Medium |
| **Phase 2** | Multi-currency support (USD, EUR, GBP) | Medium |
| **Phase 2** | Full-text search (Algolia or Supabase full-text) | Medium |
| **Phase 2** | Refund management flow | Medium |
| **Phase 3** | Mobile app (React Native or PWA) | Low |
| **Phase 3** | Video call integration (WebRTC) | Low |
| **Phase 3** | Advanced analytics (cohort analysis, A/B testing) | Low |

---

*Report generated on July 25, 2026*
*Project: Fundora — AI-Powered Crowdfunding Platform*
*Total Components: 72 | Total Pages: 35 | Total API Routes: 10 | Total Tests: 18*
