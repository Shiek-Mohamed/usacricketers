# USACricketers — Roadmap Log

## Status: 3 of 5 capabilities ready, 2 remaining

---

## ✅ Completed Capabilities

### 1. Scorers manage live matches from phone/tablet/computer
- **Status:** DONE
- Web-based live scorer, responsive, PWA-installable
- WebSocket real-time scoring via score-service (port 3003)
- Works on any device with a browser
- localStorage backup + auto-restore for session recovery

### 2. Leagues operate entire competitions (divisions + seasons)
- **Status:** DONE
- Series (leagues/tournaments) + Teams + Players + Matches
- League admin tier (Tier 3) with full management
- Auto schedule generation
- Multiple divisions = multiple Series
- JSON league import

### 3. Clubs/organizers manage their own teams + players
- **Status:** DONE
- League admin signup + login
- Team/player management, scorer assignment
- League public pages at `/<league-slug>`
- Import league data via JSON

---

## ❌ Remaining Capabilities (to build later)

### 4. Customers create branded cricket websites (Multi-tenancy)
- **Status:** NOT STARTED
- **Effort:** ~2-3 weeks
- **What's needed:**
  - `Tenant` model in the database (each org/league owns their data)
  - Data isolation — each tenant only sees their own teams/matches/players
  - Custom branding per tenant (logo, colors, fonts)
  - Subdomain routing (`myleague.usacricketers.com` or custom domain)
  - Per-tenant theme system (navy/amber → tenant's brand colors)
  - Tenant onboarding flow (signup → configure branding → launch site)
- **Foundation already exists:**
  - League admin tier (Tier 3) has org-like structure (managedSeriesIds)
  - Catch-all `[slug]` route already serves league-specific pages
  - Team model already has primaryColor/accentColor fields
- **Key files to modify:**
  - `prisma/schema.prisma` — add Tenant model + tenantId on all tables
  - `src/app/[slug]/page.tsx` — resolve tenant by subdomain instead of slug
  - `src/app/layout.tsx` — per-tenant theming
  - New: `src/app/(tenant)/` route group for tenant-scoped pages
- **Architecture decision needed:**
  - Option A: Shared database with `tenantId` column on every table (simpler, cheaper)
  - Option B: Separate database per tenant (more isolated, more complex)
  - Recommendation: Option A (shared DB + tenantId) — fits the existing SQLite setup

### 5. Recurring revenue (subscriptions + payments)
- **Status:** NOT STARTED
- **Effort:** ~1 week
- **What's needed:**
  - Stripe integration (checkout, webhooks, billing portal)
  - Subscription tiers:
    - **Free** — 1 league, 10 teams, basic scoring, usacricketers subdomain
    - **Pro** ($29/mo) — unlimited leagues/teams, custom branding, custom domain, ad-free, priority support
    - **Enterprise** ($99/mo) — multi-division, API access, white-label, dedicated support
  - Feature gating (free vs paid features)
  - Stripe webhook handlers for subscription status (active/past_due/canceled)
  - Billing portal for self-service upgrade/downgrade
  - Trial period (14 days free)
- **Key files to create:**
  - `src/app/api/stripe/checkout/route.ts` — create checkout session
  - `src/app/api/stripe/webhook/route.ts` — handle Stripe webhooks
  - `src/app/api/stripe/portal/route.ts` — billing portal redirect
  - `prisma/schema.prisma` — add Subscription model (tenantId, stripeCustomerId, plan, status)
  - `src/lib/stripe.ts` — Stripe client wrapper
- **Dependencies:**
  - Stripe account (stripe.com)
  - `stripe` npm package
  - Environment variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`

---

## Recommended Build Order

1. **#5 (Subscriptions) FIRST** — ~1 week, generates revenue immediately
2. **#4 (Multi-tenancy) SECOND** — ~2-3 weeks, bigger lift but unlocks the SaaS model

Rationale: Monetize before you multi-tenant. The subscription system can work on the current single-tenant setup (charge leagues for premium features), then multi-tenancy expands the customer base.

---

## Environment Variable Checklist (for when we build)

### For #5 (Stripe):
```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

### For #4 (Multi-tenancy):
```
# No new env vars needed — tenant resolution is via subdomain/domain in the request
# Optional: CUSTOM_DOMAINS=true to enable custom domain support
```

---

## Scoring Data Completeness — Gaps to Fix

The scoring system preserves 9 of 12 required data points. 3 gaps need to be addressed:

### Gap 1: Scorer identity per ball (currently partial)
- **Current:** Scorer is authenticated via signed JWT token, but their ID is NOT recorded per-ball in the live state or commentary entries.
- **Fix:** Add `scorerId` field to `CommentaryEntry` — set from the token when each ball is pushed.
- **Effort:** ~30 min
- **File:** `src/lib/scoring.ts` — add `scorerId?: string` to `CommentaryEntry`, populate in `pushCommentary`

### Gap 2: Timestamp per ball (currently missing)
- **Current:** No timestamp field on commentary entries or live state. Can't tell when each ball was scored.
- **Fix:** Add `timestamp` field (ISO string) to `CommentaryEntry` — set to `Date.now()` when each ball is pushed.
- **Effort:** ~30 min
- **File:** `src/lib/scoring.ts` — add `timestamp?: string` to `CommentaryEntry`, populate in `pushCommentary`

### Gap 3: Correction/revision audit trail (currently missing)
- **Current:** Undo exists (local history stack in the scorer view) but undone states are discarded. No permanent audit trail of corrections.
- **Fix:** Create a `ScoringAudit` Prisma model that logs every state change (ball scored, undo, correction) with: matchId, scorerId, timestamp, action type, before-state snapshot, after-state snapshot.
- **Effort:** ~2-3 hours
- **Files:**
  - `prisma/schema.prisma` — add `ScoringAudit` model
  - `src/app/api/scoring-audit/route.ts` — new API to write audit entries
  - `src/components/admin/views/live-scorer-view.tsx` — call audit API on every `pushState` + `handleUndo`
  - Admin UI to view audit trail per match (optional, can add later)

### Summary table
| # | Data point | Status | Gap fix effort |
|---|---|---|---|
| 10 | Scorer identity | ⚠️ Partial | ~30 min (add `scorerId` to CommentaryEntry) |
| 11 | Timestamp | ❌ Missing | ~30 min (add `timestamp` to CommentaryEntry) |
| 12 | Correction/revision reference | ❌ Missing | ~2-3 hours (ScoringAudit model + API + logging) |

**Total effort to close all 3 gaps:** ~3-4 hours

---

*Last updated: Nov 2026*
*Log maintained in: /home/z/my-project/ROADMAP.md*
