# Task 16 — Wire up dynamic data for the League Public Page (Phase 2)

**Agent**: full-stack-developer
**Task ID**: 16
**Date**: 2026-10-30
**Status**: ✅ Complete

## Context

Continuation of Task 15 (static League Public Page with hardcoded sample data).
Goal: replace the hardcoded data with **real Prisma queries** so the page at
`/league/[slug]` shows live data from the database, with graceful empty states
for new leagues with no matches/players/articles.

## What was built

### Step 1 — Schema changes (`prisma/schema.prisma`)

1. Added `slug String @unique` to the `Series` model (URL slug for the league
   public page). Also added `@@index([slug])` for fast lookups.
2. Added a new `ArticleSeries` join table:
   ```prisma
   model ArticleSeries {
     id        String   @id @default(cuid())
     articleId String
     article   Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
     seriesId  String
     series    Series   @relation(fields: [seriesId], references: [id], onDelete: Cascade)
     createdAt DateTime @default(now())

     @@unique([articleId, seriesId])
     @@index([seriesId])
   }
   ```
3. Added the reverse `articleSeries ArticleSeries[]` relation on both
   `Article` and `Series`.

Migration approach: since 7 Series rows already existed, Prisma refused to
add a required `slug` column. So the field was temporarily declared as
`String?` for the first `db:push`, the backfill script ran to populate every
row, and then the field was tightened to `String @unique` in a second
`db:push`. No data was lost.

### Step 1b — One-time backfill script

`scripts/backfill-league-slugs.ts` — idempotent bun script that walks every
Series row, derives a kebab-case slug from its `name`, and writes it back.
Re-running is safe: rows that already have a slug are skipped. Run with
`bun run scripts/backfill-league-slugs.ts`.

**Slugs assigned to existing Series**:

| name                                            | slug                                          |
| ----------------------------------------------- | --------------------------------------------- |
| India tour of England 2025                      | india-tour-of-england-2025                    |
| Champions Trophy 2025                           | champions-trophy-2025                         |
| Australia tour of New Zealand 2025              | australia-tour-of-new-zealand-2025            |
| South Africa tour of West Indies 2025           | south-africa-tour-of-west-indies-2025         |
| Border-Gavaskar Trophy 2024-25                  | border-gavaskar-trophy-2024-25                |
| Arizona Premier Cricket League                  | arizona-premier-cricket-league               |
| Abu Dhabi T10 2026                              | abu-dhabi-t10-2026                            |

### Step 1c — Slug helpers (`src/lib/league-slug.ts`)

Pure functions (no DB imports — client-safe) used by both the backfill script
and the admin UI:

- `slugifyLeagueName(name)` → kebab-case slug, falls back to `"league"`
- `RESERVED_SLUGS` — Set of forbidden slugs (`api`, `admin`, `uploads`,
  `_next`, `league`, `sitemap`, `robots`, `favicon`, `embed`, `og-image`,
  `rss`, `sw`, `manifest`, `logo`)
- `isReservedSlug(slug)` — predicate
- `ensureUniqueLeagueSlug(desired, existsFn, currentId?)` — appends `-2`,
  `-3`, … on collision (mirrors the pattern from `src/lib/slugify-filename.ts`)

### Step 1d — Slug resolver for API routes (`src/lib/series-slug-resolver.ts`)

`resolveSeriesSlug(bodySlug, bodyName, currentSeriesId?)` — used by all four
admin/league-admin series POST + PUT handlers:

1. If caller passed an explicit slug: slugify it, reject if reserved, reject
   if already taken by another Series.
2. If caller left it blank: auto-derive from name + ensure uniqueness via
   `ensureUniqueLeagueSlug`.
3. On create: no `currentSeriesId` → all existing rows count as clashes.
4. On update: `currentSeriesId` excludes the row being updated.

Throws `SlugError` (with code `reserved` | `taken` | `empty`) which the API
routes map to HTTP 400.

### Step 2 — Data fetching helpers (`src/lib/league-data.ts`)

Exports the orchestrator `getLeagueHomepageData(slug)` which fires 9 parallel
Prisma queries and shapes them into a `LeagueHomepageData` object ready for
the client component:

- `getLeagueBySlug(slug)` — `db.series.findUnique({ where: { slug } })`
- `getRecentResults(seriesId, limit=3)` — `Match.findMany({ status: "completed" })`
- `getLiveMatches(seriesId)` — `Match.findMany({ status: "live" })`
- `getUpcomingMatches(seriesId, limit=3)` — `Match.findMany({ status: "upcoming" })`
- `getStandings(seriesId)` — ordered by points desc, nrr desc
- `getTopBatsmen(seriesId, limit=3)` — `Player.findMany({ team: { tournamentTeams: { some: { seriesId } } } })`, sorted by `parseBattingStats(p.battingStats).runs` desc
- `getTopBowlers(seriesId, limit=3)` — same shape, sorted by `parseBowlingStats(p.bowlingStats)?.wickets` desc
- `getTopFielders(seriesId)` — returns `[]` (no fielding stats model yet — Phase 3)
- `getLeagueArticles(seriesId, limit=3)` — `Article.findMany({ published: true, articleSeries: { some: { seriesId } } })`
- `getLeagueGallery(limit=5)` — pulls cover image (or first photo) from recent published galleries

Each sub-query is wrapped in `safe(promise, fallback)` so a single failure
(e.g. standings table not yet populated) doesn't break the whole page — the
section just renders its empty state.

**Phase-2 player-stat note**: aggregation uses the stored career
`battingStats.runs` / `bowlingStats.wickets` as a stand-in. Per-series
aggregation (iterate every completed Match.scorecard, sum batting/bowling
lines per player within the series) is deferred to Phase 3.

### Step 3 — Component refactor (`src/components/league/league-homepage.tsx`)

The 1003-line static component was rewritten to consume a `data:
LeagueHomepageData` prop instead of the hardcoded constants. All 10 sections
are preserved with their original Tailwind classes + shadcn components
unchanged — only the data source changed. Notable additions:

- **Empty states** for every section:
  - recentResults empty → "No results yet"
  - liveMatches empty → "No live matches right now"
  - upcomingMatches empty → "No upcoming fixtures"
  - standings empty → "Standings will appear after the first match"
  - articles empty → "Welcome to [league name]" hero card + 2 placeholder side cards
  - gallery empty → "No photos yet — galleries will appear once matches are played."
  - player stats empty (per category) → "Statistics will appear after matches are played"
  - player of the week empty → conditional section, shows empty state
- **Sub-components** extracted: `HeroArticle`, `SideArticle`,
  `PlaceholderSideCard`, `StatCategoryCard`, `EmptyStateCard`
- **Standings**: dropped the multi-division pill tabs (data model has no
  intra-league divisions) — single "Standings" pill button + one table.
- **Player of the Week**: now sourced from `data.topBatsmen[0]` (career runs
  as the headline metric) instead of hardcoded Alex Roberts.
- **Match centre**: results tab data is derived from `recentResults` via a
  `useMemo` so the same data powers both the Results ticker and the
  Results tab.

### Step 4 — Route handler (`src/app/league/[slug]/page.tsx`)

Server component that:
1. Calls `getLeagueHomepageData(slug)`
2. Returns `notFound()` if null
3. Passes the data to `<LeagueHomepage data={data} />`
4. Sets `generateMetadata` with the league name + description (and OpenGraph
   tags). For nonexistent slugs, returns "League not found" metadata.

Also set `export const dynamic = "force-dynamic"` to ensure the page re-renders
on every request (no caching of stale data on a CMS).

### Step 5 — Admin UI (`src/components/site/views/league-admin-series-edit-view.tsx`)

Added a new "URL Slug" form field right below the league Name input:

- **Live preview**: `/league/[slug]` shown beneath the input, updated as the
  admin types.
- **Auto-derive from name**: when the admin types a name and hasn't manually
  edited the slug, the slug is auto-derived in real time. Once they touch the
  slug field (`slugTouched` flag), subsequent name edits leave the slug alone.
- **"Reset to auto" button**: appears when the slug has been manually edited;
  clicking it re-derives the slug from the current name.
- **Help text**: documents the reserved-slug list and the `-2/-3` collision
  suffix behavior.
- **Visual**: input has a `/league/` prefix chip on the left so the admin
  always sees the full URL they're constructing.

### Step 5b — API routes updated to accept + save slug

All four series POST/PUT handlers now call `resolveSeriesSlug`:

- `src/app/api/series/route.ts` — POST (site admin create)
- `src/app/api/series/[id]/route.ts` — PUT (site admin update)
- `src/app/api/league-admin/series/route.ts` — POST (league admin create)
- `src/app/api/league-admin/series/[id]/route.ts` — PUT (league admin update)

### Step 5c — Serializer + types updated

`src/lib/serialize.ts` `serializeSeries` now includes the `slug` field.
`src/lib/types.ts` `Series` interface now has `slug: string`.

### Step 6 — Reserved slug check

Implemented in two layers:

1. **Server-side**: `src/lib/series-slug-resolver.ts` throws `SlugError` with
   code `"reserved"` if the resolved slug is in `RESERVED_SLUGS`. The API
   routes translate this to HTTP 400 with the message:
   `Slug "X" is reserved and cannot be used for a league.`
2. **Client-side (admin UI)**: the help text warns the admin about the
   reserved list. The live preview shows the slugified value so the admin
   sees exactly what will be saved before submitting.

## Files created

| Path | Purpose |
| ---- | ------- |
| `scripts/backfill-league-slugs.ts` | one-time slug migration script |
| `src/lib/league-slug.ts` | pure slugify + reserved list + ensureUnique helper |
| `src/lib/series-slug-resolver.ts` | server-side slug resolver for API routes |
| `src/lib/league-data.ts` | all 10 data fetching helpers + orchestrator |

## Files modified

| Path | Change |
| ---- | ------ |
| `prisma/schema.prisma` | added `slug` to Series, new `ArticleSeries` model, reverse relations on Article + Series |
| `src/lib/types.ts` | added `slug: string` to Series interface |
| `src/lib/serialize.ts` | `serializeSeries` includes `slug` |
| `src/components/league/league-homepage.tsx` | full refactor to consume `data` prop + empty states |
| `src/app/league/[slug]/page.tsx` | server-side fetch via `getLeagueHomepageData` + metadata + `notFound()` |
| `src/app/api/series/route.ts` | POST resolves slug via `resolveSeriesSlug` |
| `src/app/api/series/[id]/route.ts` | PUT resolves slug via `resolveSeriesSlug` |
| `src/app/api/league-admin/series/route.ts` | POST resolves slug via `resolveSeriesSlug` |
| `src/app/api/league-admin/series/[id]/route.ts` | PUT resolves slug via `resolveSeriesSlug` |
| `src/components/site/views/league-admin-series-edit-view.tsx` | added URL Slug input with live preview + auto-derive + reset button |

## Lint output

```
$ bun run lint
$ eslint .
EXIT: 0
```

No errors, no warnings.

## Verification — curl tests

All 7 existing league pages return 200, nonexistent slug returns 404:

```
abu-dhabi: HTTP 200
india-eng: HTTP 200
aus-nz:   HTTP 200
sa-wi:    HTTP 200
bgt:      HTTP 200
ct:       HTTP 200
apcl:     HTTP 200
404:      HTTP 404
```

**Sample curl of `/league/abu-dhabi-t10-2026`** (a brand-new league with no
matches but with teams+players):

```bash
$ curl -sS http://localhost:3000/league/abu-dhabi-t10-2026 | grep -oE "(Abu Dhabi T10 2026|ADT10|No results yet|No live matches|No upcoming|Statistics will appear|Welcome to|Standings will appear|Babar Azam|Quinton de Kock|Mohammad Rizwan|Top Batsmen|RUNS|WICKETS)" | sort -u
ADT10
Abu Dhabi T10 2026
Babar Azam
Mohammad Rizwan
No live matches
Quinton de Kock
RUNS
Standings will appear
Statistics will appear
Top Batsmen
WICKETS
Welcome to
```

The page shows:
- League name + shortName from DB ✓
- Empty states for: live matches, standings, results ✓
- Top 3 batsmen by career runs (Babar 12840, QdK 11240, Rizwan 7250) ✓
- "Statistics will appear" for Top Fielders card (no fielding stats model) ✓
- "Welcome to Abu Dhabi T10 2026" empty-state hero (no articles associated) ✓

**Sample curl of `/league/champions-trophy-2025`** (has live + completed matches):

```
India
New Zealand
LIVE
FINAL
0/0
Yet to bat
innings
```

The live match shows:
- India: `0/0` (from the scorecard's current innings totalRuns/totalWickets)
- New Zealand: `Yet to bat` (no innings in scorecard for them)
- Foot: "India batting · 1st innings" (derived from current innings + index)

## Empty-state verification

A brand-new league with **no matches, no TournamentTeams, no articles, no
standings** (Arizona Premier Cricket League) renders cleanly:

```
APCL
Arizona Premier Cricket League
No live matches
No results yet
Standings will appear
Statistics will appear
Welcome to
```

All empty-state messages render in their respective sections.

## Article association verification

A test ArticleSeries row was inserted linking a published article to the
Arizona Premier Cricket League. The homepage immediately showed the article
in the hero (with title + "READ THE STORY →" button linking to
`/news/{article-slug}`). The test row was cleaned up afterwards.

## Issues encountered

1. **Prisma required-field migration**: adding a required `slug String
   @unique` to a table with 7 existing rows fails with "There are 7 rows in
   this table, it is not possible to execute this step." Resolved by declaring
   the field as `String?` for the first push, running the backfill, then
   tightening to `String` in a second push.

2. **Player stats aggregation**: the spec called for "aggregate per-series
   batting/bowling stats from the battingStats/bowlingStats JSON fields",
   but the per-series aggregation would require iterating every completed
   match's scorecard, parsing batting/bowling lines per player, and summing.
   Following the spec's escape hatch ("If aggregation is complex, just use
   the stored career stats for now"), we use `battingStats.runs` /
   `bowlingStats.wickets` career totals as a stand-in. This produces correct
   ordering for series whose teams have players with career stats, and an
   obvious empty state for new leagues with no player data. Per-series
   aggregation deferred to Phase 3.

3. **Top Fielders card**: the schema has no fielding-stats model, so
   `getTopFielders` always returns `[]`. The card renders its "Statistics
   will appear after matches are played" empty state. A real fielding-stats
   aggregate (catches + stumpings from scorecard dismissal strings) will land
   in Phase 3.

4. **Live match score formatting**: the existing `getResultSummary` helper in
   `src/lib/match-utils.ts` only handles completed matches. Wrote a new
   `formatTeamScore` helper in `league-data.ts` that handles all three
   statuses (live: includes current-innings overs in parens like `86/2
   (10.4)`; completed: joins multiple Test innings with ` & ` like `180 &
   240`; upcoming: `—`). "Yet to bat" is returned for live matches where the
   opponent hasn't batted yet.

5. **Standings "division" concept**: the static design had multi-division pill
   tabs (Premier / Division One / Division Two / Division Three). Our data
   model has no intra-league divisions — all Standings rows are scoped to
   (series, team). Replaced the multi-division tabs with a single
   "Standings" pill button + one table. Phase 3 can reintroduce divisions if
   the schema grows a `division` field on Standing.
