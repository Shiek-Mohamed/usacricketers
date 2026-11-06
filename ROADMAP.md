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

## Database Redesign — Normalized Multi-Tenant Schema

The current database is flat — most scoring data lives as JSON blobs inside `Match.scorecard`. A full redesign is needed to support multi-tenancy (#4), subscriptions (#5), and the scoring audit trail. **33 tables needed, 3 exist, 30 missing.**

### A. Organization & account tables (8 tables — ALL MISSING)

These are the multi-tenancy + RBAC foundation. Without them, #4 (branded customer sites) and #5 (subscription gating per org) can't work.

| Table | Purpose | Status | Migration notes |
|---|---|---|---|
| `users` | Unified user accounts + login identities | ❌ | Replace 3 separate models (SiteAdmin, Scorer, LeagueAdmin) with one `users` table + `role` field |
| `organizations` | Leagues, clubs, tournament operators | ❌ | Each org owns their data. Has `name`, `slug`, `branding_json`, `stripe_customer_id`, `subscription_plan` |
| `organization_members` | User membership in organizations | ❌ | Many-to-many: user ↔ org with role |
| `roles` | Role definitions (admin, scorer, league-admin, viewer) | ❌ | Currently hardcoded in TypeScript |
| `permissions` | Individual permissions (score_match, edit_teams, manage_scorers, etc.) | ❌ | Granular access control |
| `role_permissions` | Role-to-permission mapping | ❌ | Many-to-many |
| `invitations` | Invitations to join organizations | ❌ | Email-based invite flow |
| `organization_settings` | Org configuration (branding, domain, features enabled) | ❌ | Per-tenant config: colors, logo, custom domain, feature flags |

**Key principle:** Every organization-owned record (teams, players, matches, etc.) carries an `organization_id`. A player can belong to several organizations without duplicate global identities.

### B. Cricket administration tables (11 tables — 2 EXIST, 9 MISSING)

| Table | Purpose | Status | Migration notes |
|---|---|---|---|
| `seasons` | Competition seasons (2026, 2026-27) | ❌ | Currently `Series.season` is a string |
| `competitions` | Leagues and tournaments | ⚠️ | `Series` model covers this — rename/restructure |
| `divisions` | Multiple competition divisions (Premier, Division 1, etc.) | ❌ | Multiple Series per division currently |
| `competition_formats` | T10, T20, ODI, Test, custom | ❌ | Currently a string field |
| `teams` | Registered teams | ✅ | Add `organization_id` |
| `team_entries` | Teams participating in competitions | ⚠️ | `TournamentTeam` covers this — rename |
| `player_profiles` | Global player records (not tied to one team) | ⚠️ | `Player` exists but tied to one Team — decouple to global profile |
| `player_team_memberships` | Team + season affiliations (player can play for different teams in different seasons) | ❌ | Many-to-many: player ↔ team ↔ season |
| `team_staff` | Coaches, managers, officials | ❌ | |
| `venues` | Cricket grounds (name, city, country) | ❌ | Currently a string field on Match |
| `officials` | Umpires, scorers, match officials | ❌ | Currently string fields on Match |

### C. Match & scoring tables (14 tables — 1 EXISTS, 13 MISSING)

**This is the critical gap.** Currently all scoring data is stored as a JSON blob in `Match.scorecard`. The redesign normalizes everything — especially the `deliveries` table (every ball as a row).

| Table | Purpose | Status | Migration notes |
|---|---|---|---|
| `matches` | Match details + status | ✅ | Add `organization_id`, `competition_id`, `division_id`, `season_id`, `venue_id` |
| `match_teams` | Participating teams (many-to-many) | ❌ | Replace `Match.team1Id`/`team2Id` with junction table |
| `match_officials` | Umpires + scorers assigned to matches | ❌ | Many-to-many: match ↔ official with role |
| `playing_xis` | Confirmed playing elevens | ❌ | Currently in scorecard JSON |
| `innings` | Individual innings (one per batting turn) | ❌ | Currently JSON array in scorecard |
| `batting_performances` | Batter statistics per innings | ❌ | Currently JSON in scorecard.innings[].batting |
| `bowling_performances` | Bowler statistics per innings | ❌ | Currently JSON in scorecard.innings[].bowling |
| **`deliveries`** | **Every ball and scoring event** | ❌ | **THE BIG ONE.** Ball-by-ball record: innings_id, over_number, ball_number, batsman_id, bowler_id, runs, extras, wicket_id, is_legal, scorer_id, timestamp. Currently only exists as commentary entries in JSON. |
| `wickets` | Dismissal information (type, batsman, bowler, fielders) | ❌ | Currently in fallOfWickets JSON + batsman dismissal string |
| `partnerships` | Batting partnerships (pair, runs, balls) | ❌ | |
| `over_summaries` | Over-by-over summaries (runs, wickets, score) | ❌ | Currently generated on-the-fly from commentary |
| `match_events` | Toss, innings changes, rain delays, DRS | ❌ | |
| `commentary` | Match commentary (text + audio clips) | ❌ | Currently JSON array in scorecard |
| `match_adjustments` | Penalties and corrections (audit trail) | ❌ | Ties to Gap 3 (correction/revision reference) |
| `scorecard_snapshots` | Published scorecard snapshots (versioned) | ❌ | |

### Migration strategy

**Phase 1: Organization layer (tables A)** — ~1 week
- Create the 8 organization/account tables
- Migrate existing SiteAdmin/Scorer/LeagueAdmin into unified `users` + `organization_members`
- Add `organization_id` to existing Team, Player, Series, Match tables
- Build RBAC (roles + permissions)

**Phase 2: Cricket admin layer (tables B)** — ~1 week
- Create seasons, divisions, competition_formats, venues, officials tables
- Restructure Series → competitions, TournamentTeam → team_entries
- Decouple Player into global `player_profiles` + `player_team_memberships`

**Phase 3: Match & scoring layer (tables C)** — ~2 weeks
- Create the 13 missing match/scoring tables
- **The `deliveries` table is the centerpiece** — every ball as a normalized row with batsman, bowler, runs, extras, wicket, legal status, scorer ID, timestamp
- Migrate existing scorecard JSON into normalized tables
- Build scorecard_snapshots for versioned publishes
- Wire the live scorer to write to `deliveries` + `innings` + `batting_performances` + `bowling_performances` in real-time (via the score-service WebSocket)

**Total database redesign effort:** ~4 weeks

### Target schema diagram (reference ERD)

A visual ERD for the core 15 entities is saved at `upload/mermaid-diagram.png`. It shows:

```
ORGANIZATIONS (root — multi-tenancy)
├── USERS ←→ ORGANIZATION_MEMBERS (M:N join with roles)
├── DOMAINS (custom domains per org)
├── SEASONS → COMPETITIONS → DIVISIONS → TEAM_ENTRIES
├── TEAMS → PLAYER_TEAM_MEMBERSHIPS ←→ PLAYER_PROFILES
└── COMPETITIONS → MATCHES
                      ├── MATCH_EVENTS (toss, innings changes)
                      └── INNINGS → DELIVERIES → WICKETS
```

**Key design patterns in the diagram:**
1. **Multi-tenancy root** — ORGANIZATIONS owns the entire tree. Every child carries org context.
2. **Decoupled identity** — USERS and PLAYER_PROFILES are separate (a user may not be a player; a player may not have a user account). Linked via "may_link".
3. **Ball-by-ball chain** — MATCHES → INNINGS → DELIVERIES → WICKETS is the 4-level scoring hierarchy.
4. **M:N join tables** — ORGANIZATION_MEMBERS, PLAYER_TEAM_MEMBERSHIPS, TEAM_ENTRIES resolve many-to-many relationships cleanly.
5. **Competition hierarchy** — SEASONS → COMPETITIONS → DIVISIONS → TEAM_ENTRIES enables multi-division, multi-season league structures.

The diagram covers 15 of the 33 planned tables. The remaining 18 (roles, permissions, venues, officials, batting/bowling performances, partnerships, over_summaries, commentary, snapshots, operational tables, etc.) are secondary — they extend the core structure shown in the diagram.



The `deliveries` table is the single most important addition. It transforms the platform from "JSON blob storage" to "queryable ball-by-ball data." With it, you can:
- Compute any stat on demand (strike rates, wagon wheels, heat maps, partnership trajectories)
- Audit every ball (scorer ID + timestamp + correction reference)
- Enable the scoring data completeness gaps (#10 scorer identity, #11 timestamp, #12 audit trail)
- Power advanced analytics (player matchups, over-by-over momentum, bowler-vs-batsman breakdowns)
- Support official cricket data standards (each delivery is a first-class record)

---

## Match Lifecycle State Machine (Governed Scoring Workflow)

A match lifecycle flowchart is saved at `upload/mermaid-diagram(1).png`. It defines the governed scoring workflow with 11 states:

```
Match Created → Match Setup → Toss & Playing XI → Scoring in Progress
                                                        ↓
                                                Innings Complete → More Innings?
                                                   ↓ (Yes)                    ↓ (No)
                                           (loop to Scoring)          Match Result Calculated
                                                                        ↓
                                                                  Scorer Submits
                                                                        ↓
                                                                  Authorized Review
                                                                   ↓            ↓
                                                              Publish       Correction Required
                                                                  ↓            ↓
                                                           Match Published   (back to Scoring)
```

**States to implement:**
1. `created` — match record exists, no setup yet
2. `setup` — teams, venue, officials configured
3. `toss_done` — toss completed, playing XI locked
4. `scoring` — live scoring in progress
5. `innings_complete` — an innings has ended
6. `result_calculated` — all innings done, result computed
7. `submitted` — scorer has submitted the scorecard for review
8. `under_review` — authorized reviewer checking the scorecard
9. `published` — scorecard is official + public (terminal)
10. `correction_required` — reviewer found errors, sent back to scorer
11. `abandoned` — match abandoned (no result)

**Key gates currently missing from platform:**
- **Scorer Submits** — formal submission (currently scoring just ends, no submit)
- **Authorized Review** — league official verifies before publishing (currently auto-published)
- **Correction Required** — reviewer rejects + sends back with notes (currently only Undo)
- **Match Published** — triggers stats aggregation, standings, notifications

**Side effects on `published`:**
- Update team standings (points, NRR)
- Update player career stats
- Send notifications to followers
- Generate scorecard snapshot (versioned)
- Update series/competition status

**Effort:** ~1 week (state machine + API transitions + reviewer UI + notification triggers)

---

## Competition Rule Configurability (13 rules — ALL MISSING)

Currently all competition rules are hardcoded in the scoring engine or derived from the format string (Test/ODI/T20I). None are configurable per competition in the database.

| # | Rule | Status | What's needed |
|---|---|---|---|
| 1 | Overs per innings | ❌ | `maxOvers` exists in LiveMatchState but not persisted to DB. Add `oversPerInnings` to competitions table |
| 2 | Number of innings per team | ❌ | Hardcoded (Test=2, else=1). Add `inningsPerTeam` field |
| 3 | Maximum overs per bowler | ❌ | Hardcoded. Add `maxOversPerBowler` field |
| 4 | Powerplay overs | ❌ | Add `powerplayOvers` JSON field (phases + restrictions) |
| 5 | Number of players | ❌ | Assumed 11. Add `playersPerSide` field |
| 6 | Fielding restrictions | ❌ | Add `fieldingRestrictions` JSON field |
| 7 | Free-hit rules | ❌ | Hardcoded (no-ball = free hit). Add `freeHitRules` field |
| 8 | Follow-on rules | ❌ | Hardcoded (200+ lead in Test). Add `followOnThreshold` field |
| 9 | Declaration permissions | ❌ | Hardcoded (Test only). Add `allowDeclaration` boolean |
| 10 | Super-over rules | ❌ | Hardcoded (tied limited-overs). Add `superOverRules` field |
| 11 | Tie-break rules | ❌ | Add `tieBreakRules` field |
| 12 | Points allocation | ⚠️ | `Standing.points` exists but allocation (win=2, tie=1) is hardcoded. Add `pointsConfig` JSON (win, tie, loss, nr, bonus) |
| 13 | Result and abandonment rules | ❌ | Add `resultRules` field (DLS, abandonment threshold, etc.) |

**Fix:** Create a `competition_rules` table (or add fields to the `competitions` table from Phase 2 of the DB redesign) with all 13 rules as configurable fields. The scoring engine reads these instead of hardcoding.

**Effort:** ~1 week (DB fields + scoring engine refactor to read rules from DB + admin UI to configure them)

---

## Database Best Practices (7 rules — 1 MET, 6 MISSING)

| # | Rule | Status | Fix |
|---|---|---|---|
| 1 | UUID identifiers | ❌ Using `cuid()` | Change all `@default(cuid())` to `@default(uuid())`. Migration script needed to convert existing IDs. ~2 hours |
| 2 | Foreign keys | ✅ Prisma relations maintain FK integrity | Already done |
| 3 | Index org_id, match_id, player_id, dates | ⚠️ Has some indexes but no org_id/player_id | Add `@@index([organizationId])` to all org-owned tables + `@@index([matchId])` to scoring tables + `@@index([playerId])` to player tables. ~1 hour |
| 4 | Transactions for deliveries | ❌ No deliveries table | When the `deliveries` table is built (Phase 3 of DB redesign), wrap ball-recording in `$transaction`. ~30 min (part of Phase 3) |
| 5 | Audit trail of corrections | ❌ Missing | Covered by Gap 3 (ScoringAudit model) + `match_adjustments` table from Phase 3 |
| 6 | Automatic database backups | ❌ Manual only | Add a cron job: `sqlite3 db/app.db ".backup db/backup-$(date +%Y%m%d).db"` daily + upload to fly.io volume or S3. ~1 hour |
| 7 | Organization-level data access | ❌ No org model | Covered by Phase 1 of DB redesign (organization_id on all tables + RBAC) |

**Effort to close all 6 gaps:** ~4 hours (UUID migration + indexes + backup script) — the rest is covered by the DB redesign phases.

---

## Operational Tables (8 tables — ALL MISSING)

| Table | Purpose | Priority | Notes |
|---|---|---|---|
| `audit_logs` | System-wide audit trail (user logins, data changes, admin actions) | High | Separate from match scoring audit — this is platform-level audit |
| `notification_queue` | Email/push notification queue (match alerts, newsletter, invitations) | High | Enables the push notifications + newsletter features |
| `media_assets` | Normalized image/video storage (currently filesystem files in `/db/uploads`) | Medium | Replaces ad-hoc file paths with a tracked media library |
| `api_keys` | API keys for external integrations (third-party apps, data feeds) | Medium | Needed for #4 (customers building on the platform via API) |
| `webhook_events` | Outgoing webhook delivery log (Stripe events, external integrations) | Medium | Needed for #5 (Stripe subscription webhooks) |
| `support_tickets` | In-platform support requests | Low | When customer base grows |
| `system_settings` | Platform-wide configuration (feature flags, limits, defaults) | Medium | Replaces hardcoded config (max connections, rate limits, etc.) |
| `background_jobs` | Job queue for async tasks (scorecard generation, stats computation, imports) | Medium | Enables heavy computations without blocking the request cycle |

**Effort to build all 8:** ~1 week

**Recommended priority order:**
1. `audit_logs` + `system_settings` — foundation for everything else
2. `notification_queue` — unlocks push notifications + newsletter automation
3. `webhook_events` — needed for Stripe integration (#5)
4. `media_assets` — clean up image management
5. `api_keys` + `background_jobs` — needed for multi-tenancy (#4)
6. `support_tickets` — when customer base justifies it

---

## Updated Total Platform Gap Analysis

| Category | Needed | Have | Missing | Effort |
|---|---|---|---|---|
| Core capabilities (#1-5) | 5 | 3 | 2 | ~3-4 weeks (#4 + #5) |
| Scoring data points (12) | 12 | 9 | 3 | ~3-4 hours |
| Database tables (33) | 33 | 3 | 30 | ~4 weeks |
| Competition rules (13) | 13 | 0 | 13 | ~1 week |
| Database best practices (7) | 7 | 1 | 6 | ~4 hours |
| Operational tables (8) | 8 | 0 | 8 | ~1 week |
| **Total** | **78** | **16** | **62** | **~9-10 weeks** |

### Recommended build sequence

1. **Scoring data gaps** (~3-4 hours) — quick win, closes 3 data points
2. **Database best practices** (~4 hours) — UUIDs, indexes, backups
3. **Stripe subscriptions (#5)** (~1 week) — generates revenue immediately
4. **Operational tables** (~1 week) — audit_logs, notification_queue, webhook_events first
5. **Competition rules** (~1 week) — configurable rules engine
6. **Database redesign Phase 1: Organization layer** (~1 week) — multi-tenancy foundation
7. **Database redesign Phase 2: Cricket admin** (~1 week) — seasons, divisions, venues, officials
8. **Database redesign Phase 3: Match & scoring** (~2 weeks) — deliveries table + normalized scoring
9. **Multi-tenancy (#4)** (~2-3 weeks) — branded customer sites (builds on Phase 1-3)

**Total to full professional platform:** ~9-10 weeks

---

## Architecture Restructure — Monorepo (Future Milestone)

The current platform is a **single Next.js app** — admin, scoring, public site, and API are all in one app, switched via Zustand state. This works for a prototype but should eventually be restructured into a proper monorepo for a production SaaS platform.

### Current structure (single app)
```
my-project/
├── src/
│   ├── app/              # All routes + API in one app
│   │   ├── [slug]/       # League public pages
│   │   ├── api/          # Flat API routes (not domain-organized)
│   │   ├── matches/      # SSR match pages
│   │   ├── news/         # SSR article pages
│   │   ├── players/      # SSR player pages
│   │   ├── teams/        # SSR team pages
│   │   └── page.tsx      # SPA homepage (all views via Zustand switch)
│   ├── components/       # All UI (admin + public + cricket + ui)
│   ├── hooks/
│   └── lib/              # Types, scoring engine, API client
├── prisma/               # Single schema.prisma
├── mini-services/
│   └── score-service/    # WebSocket service (separate process)
├── public/               # Static assets
├── db/                   # SQLite DB + uploaded images
├── Dockerfile, Caddyfile.fly, fly.toml  # Infrastructure (flat in root)
```

### Target structure (monorepo)
```
usacricketers-platform/
├── apps/
│   ├── web/                 # Public websites (SSR + SPA)
│   ├── admin/               # Super admin dashboard
│   ├── organization/        # League and club portal
│   └── scoring/             # Scorer interface (mobile-first)
├── server/
│   ├── auth/                # Authentication + RBAC
│   ├── organizations/       # Multi-tenant org management
│   ├── subscriptions/       # Stripe billing + plans
│   ├── players/             # Player profiles + memberships
│   ├── teams/               # Team management
│   ├── competitions/        # Leagues, seasons, divisions
│   ├── matches/             # Match scheduling + status
│   ├── scoring/             # Ball-by-ball scoring engine
│   ├── statistics/          # Stats computation + analytics
│   ├── websites/            # Branded website builder
│   ├── notifications/       # Email + push notification queue
│   └── payments/            # Payment processing
├── database/
│   ├── migrations/          # Prisma migrations
│   ├── seeds/               # Seed data for dev/staging
│   └── schemas/             # Schema files (split by domain)
├── shared/
│   ├── cricket-rules/       # Configurable competition rules engine
│   ├── scoring-types/       # LiveMatchState, CommentaryEntry, etc.
│   └── api-types/           # Shared API request/response types
└── infrastructure/
    ├── docker/              # Dockerfiles per app
    ├── nginx/               # Caddy/nginx config
    └── deployment/          # fly.io, CI/CD, env management
```

### When to restructure

Do NOT restructure yet. Build features first within the current single-app. Restructure only when **one or more** of these triggers is met:

- [ ] Codebase exceeds ~50K lines (getting hard to navigate)
- [ ] Multiple developers/teams need to work independently
- [ ] Need separate deployment cycles (web deploys without touching scoring)
- [ ] Need to run admin/scoring on different infrastructure (e.g., scoring on a higher-memory machine)
- [ ] Customer-facing branded sites (#4) need their own app instances

### Migration approach (when the time comes)

**Don't do a big-bang rewrite.** Split gradually:

1. **Extract `shared/` first** — move types + scoring engine + cricket rules into a shared package. Low risk, immediate benefit (cleaner imports).

2. **Extract `server/` next** — move API routes into domain-organized modules. Still within the same app, but organized by domain (auth, matches, scoring, etc.).

3. **Split `apps/scoring/` first** — the scoring interface is the most independent (mobile-first, different UX, separate WebSocket). Extract it into its own Next.js app.

4. **Split `apps/admin/` next** — the admin dashboard is self-contained. Extract it.

5. **Split `apps/organization/` when #4 is built** — the league/club portal is a new app that doesn't exist yet, so it can be built as a separate app from the start.

6. **`apps/web/` stays as the main app** — the public website remains the primary Next.js app.

**Estimated effort:** ~2-3 weeks (when the time comes)

### Monorepo tooling

When restructuring, use:
- **Turborepo** or **Nx** for monorepo management (build caching, task running)
- **pnpm workspaces** for package management (faster than npm, disk-efficient)
- **Shared Prisma client** — one database, shared across apps via the `database/` package
- **Shared ESLint + TypeScript config** — consistent code quality across apps

---

## Real-Time Scoring Architecture — COMMERCIAL SCALE (Required for Launch)

**This platform will be a commercial product with hundreds of matches scored simultaneously.** The current simplified architecture (single score-service, in-memory cache, SQLite) CANNOT handle this scale. The full enterprise architecture is a **launch requirement**, not a future milestone.

### Scale requirements

| Metric | Current capacity | Commercial requirement |
|---|---|---|
| Concurrent matches scored | ~10 | **100-500+** |
| Concurrent WebSocket connections | ~5,000 (one instance) | **50,000-100,000+** |
| Concurrent database writes | ~1 (SQLite single-writer lock) | **100-500+** (one per match, per ball) |
| Match state cache | In-memory Map (lost on restart) | **Redis** (persistent, shared across instances) |

### Current architecture (will NOT scale)

```
Scorer UI → socket.io → score-service (1 instance, port 3003) → in-memory Map
                                      → SQLite (single-writer, JSON blob)
                                      → socket.io broadcast → viewers
```

### Target architecture (COMMERCIAL — required)

```
Scorer UI → REST API → Kafka (match-events) → Consumer Service (multiple instances)
                                                   ↓
                                           ┌─────────────────┐
                                           │ Redis (shared cache) │
                                           │ PostgreSQL (per-ball) │
                                           │ socket.io + Redis adapter → viewers │
                                           └─────────────────┘
```

### What MUST change before commercial launch

#### 1. Database: SQLite → PostgreSQL (CRITICAL)
SQLite has a single-writer lock — only one write at a time. Hundreds of scorers writing balls simultaneously will cause lock contention + timeouts. PostgreSQL handles concurrent writes natively.

- **Effort:** ~2 days (swap Prisma datasource, migrate data, update connection pooling)
- **Cost:** ~$20-50/mo on fly.io (managed Postgres) or ~$5/mo self-hosted
- **This is the #1 blocker** — nothing else matters if the database can't handle concurrent writes

#### 2. Redis cache (CRITICAL)
The in-memory Map is lost on every restart + can't be shared across instances. Redis provides:
- Persistent cache (survives restarts)
- Shared state across multiple score-service instances
- socket.io Redis adapter (enables multi-instance WebSocket fan-out)
- The score-service ALREADY has Redis adapter support built in (`REDIS_URL` env var) — just needs a Redis instance

- **Effort:** ~1 day (provision Redis on fly.io, set REDIS_URL, test)
- **Cost:** ~$0-15/mo (Upstash Redis free tier → paid as usage grows)

#### 3. Multiple score-service instances (REQUIRED)
Single socket.io instance = ~5,000 connections max. For 50,000+ viewers, need multiple instances with:
- Redis adapter for cross-instance pub/sub (already supported in code)
- Load balancer with sticky sessions (fly.io handles this)
- Each instance handles a subset of connections

- **Effort:** ~1 day (configure fly.io to run multiple score-service instances + Redis adapter)
- **Cost:** ~$15-30/mo per instance (2-3 instances for launch)

#### 4. Kafka or alternative message queue (REQUIRED at scale)
For hundreds of concurrent matches, a message queue buffers scoring events so spikes don't overwhelm the database. Options:
- **Apache Kafka** — the diagram's recommendation. Robust but complex to operate.
- **Redis Streams** — simpler than Kafka, uses the same Redis instance. Good enough for 100-500 matches.
- **Recommendation:** Start with Redis Streams (simpler), upgrade to Kafka only if needed.

- **Effort:** ~3-5 days (implement consumer service + event queue)
- **Cost:** Included in Redis cost (if using Redis Streams)

#### 5. Per-ball database storage (REQUIRED for commercial)
The `deliveries` table from the DB redesign (Phase 3) is essential — can't store hundreds of matches' ball-by-ball data as JSON blobs. Each ball must be a queryable row.

- **Effort:** Part of DB redesign Phase 3 (~2 weeks)
- **Ties to:** PostgreSQL migration (need a real database for this volume of writes)

### Revised commercial launch timeline

The previous roadmap had scalability as a "future milestone." For a commercial product, it must be integrated into the main build sequence:

1. ~~**Database: SQLite → PostgreSQL** — ~2 days (BLOCKER — do this first)~~ ✅ **DONE (Nov 2026)** — Migrated to Neon PostgreSQL (free tier). Schema pushed, all data migrated (65 articles, 8 teams, 45 players, 9 matches, 46 videos). All 8 raw SQL queries replaced with Prisma create/update. Fly.io Managed Postgres ($38/mo) deleted. Production verified — all APIs HTTP 200.
2. **Redis cache + socket.io adapter** — ~1 day (enables multi-instance)
3. **DB redesign Phase 1: Organization layer** — ~1 week (multi-tenancy foundation)
4. **DB redesign Phase 2: Cricket admin** — ~1 week
5. **DB redesign Phase 3: Match & scoring + deliveries table** — ~2 weeks
6. **Consumer service + event queue (Redis Streams)** — ~3-5 days
7. **Multiple score-service instances** — ~1 day
8. **Stripe subscriptions (#5)** — ~1 week
9. **Competition rules engine** — ~1 week
10. **Multi-tenancy / branded sites (#4)** — ~2-3 weeks
11. **Operational tables** (audit, notifications, webhooks) — ~1 week
12. **Match lifecycle state machine** (reviewer approval workflow) — ~1 week

**Total to commercial launch:** ~10-12 weeks

### Infrastructure cost estimate (commercial scale)

| Component | Monthly cost |
|---|---|
| fly.io app (Next.js, 2GB RAM) | ~$14 |
| fly.io score-service (2-3 instances, 512MB each) | ~$15-23 |
| Managed PostgreSQL (fly.io or Neon) | ~$20-50 |
| Redis (Upstash) | ~$0-15 (scales with usage) |
| Persistent volume (uploads) | ~$3 |
| **Total infrastructure** | **~$52-105/mo** |

At scale (500+ concurrent matches):
| Component | Monthly cost |
|---|---|
| fly.io app (larger or multiple) | ~$30-60 |
| fly.io score-service (5-10 instances) | ~$40-75 |
| Managed PostgreSQL (larger) | ~$50-100 |
| Redis (higher tier) | ~$30-50 |
| **Total at scale** | **~$150-285/mo** |

### Good news: the platform is partially prepared

The score-service was already built with commercial scaling in mind:
- ✅ Redis adapter support is already coded (just needs `REDIS_URL`)
- ✅ socket.io room-based routing (each match = one room, scales to thousands)
- ✅ Token-based scorer auth (HMAC-SHA256, stateless, scales horizontally)
- ✅ Throttling (80ms min broadcast gap per match)
- ✅ Connection limits (MAX_TOTAL_CONNECTIONS, MAX_PER_MATCH)
- ✅ Caddy gateway routes WebSocket traffic correctly

The gaps are: SQLite → PostgreSQL, Redis provisioning, multi-instance setup, and the deliveries table. These are infrastructure changes, not application rewrites.

---

## CricClubs Competitor — Feature Gap Analysis & Build Plan

The platform will compete with CricClubs (the leading US cricket league management platform). 10 of 15 core features already exist. The remaining 5 are in the roadmap. Plus 7 CricClubs-specific features need to be added.

### Feature comparison: Current platform vs CricClubs

| # | Feature | We have? | In roadmap? | Additional effort |
|---|---|---|---|---|
| 1 | Live scoring (ball-by-ball) | ✅ | — | — |
| 2 | Scorecards (batting/bowling/FOW) | ✅ | — | — |
| 3 | Player profiles + career stats | ✅ | — | — |
| 4 | Team management | ✅ | — | — |
| 5 | League/division/season management | ✅ | — | — |
| 6 | Auto schedule generation | ✅ | — | — |
| 7 | Public league pages | ✅ | — | — |
| 8 | News/articles/galleries/videos | ✅ | — | — |
| 9 | Live blog + ball chips + over summaries | ✅ | — | — |
| 10 | Mobile scoring (PWA) | ✅ | — | — |
| 11 | Multi-tenancy (branded sites) | ❌ | ✅ Phase 1 | — |
| 12 | Subscriptions/payments | ❌ | ✅ Planned | — |
| 13 | Competition rules engine | ❌ | ✅ Planned | — |
| 14 | Match lifecycle (reviewer approval) | ❌ | ✅ Planned | — |
| 15 | Database redesign (deliveries, orgs) | ❌ | ✅ Planned | — |

### CricClubs-specific features NOT in roadmap yet

| # | Feature | What it does | Effort | Files to create/modify |
|---|---|---|---|---|
| C1 | **DLS calculator** | Duckworth-Lewis-Stern rain adjustment — recalculates targets when rain interrupts | ~2 days | `src/lib/dls.ts` (algorithm), `src/components/cricket/dls-calculator.tsx` (UI), `src/app/api/dls/route.ts` |
| C2 | **Tournament brackets** | Knockout, group stage, hybrid formats + bracket visualization tree | ~3-5 days | `src/lib/tournament-brackets.ts` (generation logic), `src/components/cricket/bracket-view.tsx` (bracket UI), `src/app/api/brackets/route.ts` |
| C3 | **Player rankings/leaderboards** | Computed batting/bowling rankings across all matches in a season/competition | ~2 days | `src/lib/rankings.ts` (aggregation + sorting), `src/components/cricket/leaderboard.tsx` (UI), `src/app/api/rankings/route.ts` |
| C4 | **Player registration + waivers** | Online registration forms with digital liability waivers + e-signature | ~3 days | `src/app/api/registration/route.ts`, `src/components/site/registration-form.tsx`, `src/lib/waiver-pdf.ts` (PDF generation) |
| C5 | **Umpire assignment** | Assign umpires to matches, track availability, conflict detection | ~1 day | `src/app/api/officials/route.ts`, `src/components/admin/umpire-assignment.tsx` (uses `officials` table from DB Phase 2) |
| C6 | **Email/SMS notifications** | Match alerts, schedule changes, registration confirmations | ~2 days | `src/lib/notifications.ts`, `src/app/api/notifications/route.ts` (uses `notification_queue` table from operational tables) |
| C7 | **DLS/Premium features gating** | Some features (DLS, advanced stats) are premium-only (paid subscribers) | ~1 day | `src/lib/feature-gating.ts` (checks subscription plan → enables/disables features) |

**Total additional effort for CricClubs-specific features:** ~14-16 days (~3 weeks)

### DLS Calculator details

The Duckworth-Lewis-Stern (DLS) method recalculates target scores when rain interrupts play. It's the standard method used in all professional limited-overs cricket.

**Implementation:**
- `src/lib/dls.ts` — the DLS algorithm (based on the ICC's published formula)
  - Input: innings 1 score, overs used, overs remaining (after rain), wickets lost
  - Output: revised target for innings 2
  - Uses the G50 constant (average score = 245 in 50 overs) + par score tables
- `src/components/cricket/dls-calculator.tsx` — admin UI
  - Enter match situation (innings 1 total, overs bowled, rain interruption details)
  - Shows revised target + required run rate
- `src/app/api/dls/route.ts` — API endpoint for programmatic access
- Premium feature (Pro plan and above only)

**Note:** The full DLS method is proprietary (ICC licenses it). The implementation uses the publicly available approximation formula which is accurate enough for amateur/club cricket. For professional use, an ICC license would be needed.

### Tournament bracket details

**Supported formats:**
- **Round-robin** (already have — auto schedule generation)
- **Knockout/single elimination** — bracket tree, seeds, byes
- **Group stage → knockout** — groups feed into a knockout bracket
- **Double elimination** — losers bracket + winners bracket
- **Hybrid** — custom combinations

**Implementation:**
- `src/lib/tournament-brackets.ts` — bracket generation logic
  - Seed placement (standard seeding, random, or custom)
  - Bye calculation (for non-power-of-2 team counts)
  - Round progression (advance winners, generate next round)
  - Group stage → knockout mapping
- `src/components/cricket/bracket-view.tsx` — visual bracket tree
  - SVG or CSS-based bracket rendering
  - Click a match → view/edit scorecard
  - Responsive (collapses to vertical on mobile)
- `src/app/api/brackets/route.ts` — generate/update/retrieve brackets

### Player rankings/leaderboard details

**Categories:**
- **Most runs** (season/competition/all-time)
- **Highest averages** (min 10 innings)
- **Best strike rates** (min 100 balls)
- **Most wickets**
- **Best bowling averages**
- **Best economy rates** (min 50 overs)
- **Most sixes/fours**
- **Best all-rounder** (combined batting + bowling index)

**Implementation:**
- `src/lib/rankings.ts` — aggregation engine
  - Reads from `deliveries` table (ball-by-ball data) + `batting_performances` + `bowling_performances`
  - Computes stats per player per season/competition
  - Sorts by category + applies minimum qualification thresholds
- `src/components/cricket/leaderboard.tsx` — UI
  - Tabbed view (Batting / Bowling / All-rounder)
  - Filter by season, competition, division
  - Shows rank, player name, team, key stat, matches played
- `src/app/api/rankings/route.ts` — API endpoint

### Complete commercial launch timeline (CricClubs competitor)

Combining the commercial scalability roadmap + CricClubs-specific features:

| Phase | Step | Effort | Cumulative |
|---|---|---|---|
| **Infrastructure** | SQLite → PostgreSQL | ~2 days | 2 days |
| | Redis cache + socket.io adapter | ~1 day | 3 days |
| **DB Redesign** | Phase 1: Organization layer | ~1 week | ~1.5 weeks |
| | Phase 2: Cricket admin | ~1 week | ~2.5 weeks |
| | Phase 3: Match & scoring + deliveries | ~2 weeks | ~4.5 weeks |
| **Scale** | Consumer service + event queue | ~3-5 days | ~5.5 weeks |
| | Multiple score-service instances | ~1 day | ~6 weeks |
| **CricClubs features** | DLS calculator | ~2 days | ~6.5 weeks |
| | Tournament brackets | ~3-5 days | ~7.5 weeks |
| | Player rankings/leaderboards | ~2 days | ~8 weeks |
| | Player registration + waivers | ~3 days | ~8.5 weeks |
| | Umpire assignment | ~1 day | ~8.5 weeks |
| | Email/SMS notifications | ~2 days | ~9 weeks |
| | Feature gating (premium) | ~1 day | ~9 weeks |
| **Monetization** | Stripe subscriptions | ~1 week | ~10 weeks |
| | Multi-tenancy / branded sites | ~2 weeks | ~12 weeks |
| **Workflow** | Match lifecycle state machine | ~1 week | ~13 weeks |
| **Polish** | Competition rules engine | ~1 week | ~14 weeks |
| | Operational tables | ~1 week | ~15 weeks |
| | PWA enhancements (push, offline) | ~1 week | ~16 weeks |

**Total to CricClubs competitor:** ~14-16 weeks

### Competitive advantages over CricClubs

| Feature | CricClubs | Our platform |
|---|---|---|
| **Live blog** | No commentary feed | ✅ Ball-by-ball commentary + ball chips + over summaries |
| **Live blog (immersive)** | No dedicated live view | ✅ Full-screen live blog with key moments sidebar |
| **News/articles** | Minimal content | ✅ Full CMS with article scraping, SEO, social sharing |
| **Photo galleries + videos** | Basic | ✅ Full gallery system + video embedding |
| **Design** | Dated (2010s UI) | ✅ Modern (Rajdhani sporty font, gradient headers, clean scorecard) |
| **PWA** | Native apps only | ✅ Installable PWA (no app store needed) |
| **SEO** | Poor (client-rendered) | ✅ Server-side rendered + structured data + sitemaps |
| **Voice commentary** | No | ✅ Scorer can record voice clips during scoring |
| **Error boundaries** | Crashes on errors | ✅ Graceful error recovery with retry |
| **Open roadmap** | Closed source | ✅ Full roadmap documented, can iterate fast |

### What CricClubs has that we should monitor

| Feature | Notes | Priority |
|---|---|---|
| Native iOS/Android apps | PWA covers 95% of use cases. Consider native only if customers demand app store presence. | Low (PWA first) |
| Ball-by-ball API for third parties | CricClubs sells data feeds. Could add `api_keys` table + rate-limited API. | Medium (revenue opportunity) |
| Cricket ball tracking integration | Hawk-Eye-style trajectory tracking. Very advanced, needs hardware. | Not planned |
| Fantasy league integration | Users pick players, score points. Engagement feature. | Low (future) |

---

*Last updated: Nov 2026*
*Log maintained in: /home/z/my-project/ROADMAP.md*
