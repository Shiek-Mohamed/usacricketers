# Task 1 — ESPNcricinfo-style Live Match Detail Page Enhancement

**Agent:** full-stack-developer
**Task ID:** 1
**Status:** Completed
**Date:** 2026-11-13

## Objective

Enhance the cricket match detail page (`src/app/matches/[id]/MatchPageContent.tsx`)
to look like ESPNcricinfo's live scoring page by adding five live features that
render only when a scorer is broadcasting via the WebSocket (port 3003):

1. **"This Over" Ball Tracker** — colored circle ribbon for the current over
2. **Live Score Banner** — prominent navy hero with CRR/RRR/balls remaining
3. **Recent Overs Strip** — last 5 completed overs as compact summaries
4. **Current Partnership Display** — live batting pair + partnership runs
5. **Enhanced Commentary Feed** — over markers, ball-number annotations,
   color-coded left borders

## Files Read First (per task instructions)

- `src/app/matches/[id]/MatchPageContent.tsx` (1189 lines) — original page
- `src/lib/scoring.ts` — `LiveMatchState`, `CommentaryEntry`, `ScorerInnings`
- `src/lib/use-live-score.ts` — `useLiveScore(matchId, token)` hook
- `src/components/cricket/ball-chip.tsx` — existing chip + commentary row
- `src/components/site/live-match-section.tsx` — existing live embed
- `src/components/site/views/live-blog-view.tsx` — existing blog view
- `src/components/cricket/mini-scorecard.tsx`
- `src/lib/types.ts` — `Match`, `Scorecard`, `Team` types

## Files Modified / Created

### NEW: `src/components/cricket/live-match-enhancements.tsx` (850 lines)

All five ESPNcricinfo-style components, self-contained with shared helpers:

- **`ThisOverBall`** — single colored circle. Color scheme per spec:
  dot=dark gray (`bg-gray-700`), 1-3 runs=green (`bg-emerald-600`),
  4=blue (`bg-sky-600`), 6=purple (`bg-purple-600`), W=red (`bg-red-600`),
  wide/nb=amber (`bg-amber-500`), empty=dashed outline circle.

- **`ThisOverTracker`** — extracts the current over's balls from
  `liveState.commentary` (newest-first array). Finds the most recent ball
  entry, derives its over number, collects all balls of that over, reverses
  to chronological order, and pads empty slots up to 6.

- **`LiveScoreBanner`** — prominent navy gradient hero with:
  - Pulsing red "LIVE" badge + match status ("2nd innings", "Innings break", etc.)
  - Both teams' scores `RUNS/WKTS (OVERS)` in large bold numerals
  - Batting team highlighted with amber ring + "Batting" label
  - Run-rate strip: CRR, RRR (when chasing), Balls Left, Wickets, Overs
  - Amber chase banner: "X need N runs from M balls · RRR x.xx"
  - DLS revised target banner when set
  - Responsive: stacks vertically on mobile, side-by-side on desktop

- **`RecentOversStrip`** — last 5 completed overs. Finds `kind: "over"`
  summary entries, collects each over's balls (between its summary and the
  next summary), reverses to oldest-first for left-to-right display.
  Each over card has a colored left border (red=wicket, purple=10+ runs,
  sky=6+, emerald=<6, gray=maiden) and mini ball circles.

- **`CurrentPartnership`** — derives partnership runs/balls from
  `innings.partnershipStartRuns` / `innings.partnershipStartBalls`.
  Shows both batsmen (striker highlighted with amber ring), partnership
  number, runs, balls, and run rate.

- **`EnhancedCommentaryFeed`** — scrollable feed (max-h-[70vh]) with:
  - Over-boundary separators rendered as bold navy "End of Over N" bars
  - Ball-number annotations (`14.3`) before each entry
  - Color-coded 4px left borders per kind (red/purple/sky/amber/emerald)
  - Mini `ThisOverBall` circle + kind label (WICKET/SIX/FOUR/EXTRA/INFO)
  - Subtle tinted backgrounds for wickets/sixes/fours

### MODIFIED: `src/app/matches/[id]/MatchPageContent.tsx`

Changes (existing functionality fully preserved):

1. **Imports added:**
   - `useLiveScore` from `@/lib/use-live-score`
   - `LiveScoreBanner`, `ThisOverTracker`, `RecentOversStrip`,
     `CurrentPartnership`, `EnhancedCommentaryFeed` from the new file
   - `Radio` icon from lucide-react

2. **`MatchPageContent` function** — added `useLiveScore(match.id, null)`
   call (read-only, no scorer token). Derives `hasLiveState` =
   `Boolean(liveState && currentInnings)`.

3. **Conditional rendering:**
   - When `hasLiveState`: renders `LiveScoreBanner` + grid of
     `ThisOverTracker` + `CurrentPartnership` + full-width
     `RecentOversStrip` (replaces `MatchScorebox`).
   - When no live state: renders original `MatchScorebox` (completed,
     upcoming, or live-but-no-scorer cases) — unchanged behavior.

4. **Commentary tab** — when `hasLiveState`, renders
   `EnhancedCommentaryFeed` (live data); otherwise renders the original
   `CommentaryAccordion` (static scorecard data). The Commentary tab
   icon switches to `Radio` when live.

5. **Tabs list** — added `overflow-x-auto` + `whitespace-nowrap` to
   TabsTrigger classes so the 6 tabs scroll horizontally on narrow
   mobile screens instead of wrapping/breaking layout.

6. **All other tabs** (Squads, Scorecard, WinViz, Graphs, Match Info)
   and the Recent Results grid + "More matches" link are unchanged.

## Design Decisions

- **Navy `#1e2a5e`** used as the primary gradient base (matches the
  existing `MatchScorebox` and `LiveMatchSection` header).
- **Amber `#f59e0b` / `amber-500`** for accents (chase banner, striker
  highlight, partnership numbers).
- **Semantic colors** per the spec: green=runs, blue=four, purple=six,
  red=wicket, amber=extras, dark-gray=dot.
- **Dark theme** for the live banner (gradient `from-[#1e2a5e] to-[#0f1729]`).
- **Mobile-responsive**: banner grid collapses `sm:grid-cols-[1fr_auto_1fr]`
  → `grid-cols-1`; run-rate strip `sm:grid-cols-4` → `grid-cols-2`;
  This Over + Partnership `lg:grid-cols-2` → `grid-cols-1`; Recent Overs
  uses horizontal scroll on mobile, 5-col grid on desktop.
- **No new npm packages** — only existing imports (`cn`, `TeamBadge`,
  `oversString`, lucide icons, shadcn `Card`/`Tabs`).

## Backward Compatibility

- The component name `MatchPageContent` and its export are unchanged.
- For matches WITHOUT live state (completed matches with scorecard JSON,
  upcoming matches, or live matches where no scorer is broadcasting),
  the page renders exactly as before: `MatchScorebox` + static
  `CommentaryAccordion` + all other tabs.
- The existing `LiveMatchSection`, `live-blog-view`, `ball-chip`, `scorecard`,
  `mini-scorecard` components are untouched.

## Verification

- `bun run lint` → **0 errors, 2 warnings** (both pre-existing
  `Unused eslint-disable directive` warnings in `src/app/page.tsx` and
  `live-scorer-view.tsx`, unrelated to this task).
- No new dependencies installed.
- All TypeScript types align with `LiveMatchState` / `ScorerInnings` /
  `CommentaryEntry` / `Match` from `@/lib/scoring` and `@/lib/types`.

## Notes for Downstream Agents

- The new file exports: `LiveScoreBanner`, `ThisOverTracker`,
  `RecentOversStrip`, `CurrentPartnership`, `EnhancedCommentaryFeed`.
  All accept a `liveState: LiveMatchState` prop (and `LiveScoreBanner`
  also takes `match: Match`).
- Each enhancement component returns `null` when its data is unavailable
  (e.g., `ThisOverTracker` returns null before any ball is bowled), so
  they're safe to mount as soon as `liveState` has a current innings.
- The `runsFromBall` helper handles the exact text formats emitted by
  `src/lib/scoring.ts` (`"Wide (+1)"`, `"No ball (+1)"`, `"Bye 1"`,
  `"2 runs — Smith"`, `"FOUR! ..."`, `"SIX! ..."`, etc.).
