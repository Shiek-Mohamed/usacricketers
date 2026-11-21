# Task 18 — Viewer engagement features for public match pages (full-stack-developer)

## Task
Implement 5 viewer-facing engagement features on the public match pages:
1. Fall-of-wickets graph  2. Runs-per-over comparison chart  3. DLS par-score strip
4. 50/100 milestone badges (+ optional milestone commentary)  5. Live WinViz.

## Important context for the next agent
- Parts of this task were ALSO implemented by a concurrently-running agent
  (scoring.ts milestone emission @01:05, live-match-enhancements milestone pill
  + DLS par computation, creation of fall-of-wickets-chart.tsx /
  over-comparison-chart.tsx, and the MatchPageContent wiring of
  `displayScorecard = liveState ? stateToScorecard(liveState) : match.scorecard`
  passed into WinVizView + GraphsView). My work COMPLETED and hardened that
  in-flight work instead of duplicating it. Do not re-do these.
- Baseline tsc errors that PRE-DATE this task (do not "fix" blindly):
  mini-scorecard.tsx(51,11 / 56,11), standings.tsx(58,7 / 59,17).

## What I changed

### src/components/cricket/live-match-enhancements.tsx
- LiveScoreBanner chase numbers are now DLS-aware: `chaseTarget`
  (dlsTarget overrides innings target) and `chaseOvers` (dlsRevisedOvers
  overrides maxOvers) drive runsNeeded / ballsRemaining / RRR / "Overs max" so
  a rain-revised chase shows correct numbers everywhere on the banner.
- Sky-blue DLS strip enhanced: target + revised overs, plus (when chasing)
  "{TEAM} need R off B — par P" line. Also fixed the latent `{0 && …}` render
  (now ternary with `: null`).
- Exported `MilestoneBadge({ runs })` — subtle amber "50" chip, solid gold at
  100+ (shadcn Badge base, dark-mode aware) for reuse in scorecard rows.
- Added `Badge` import (shadcn). Existing milestone pill/trophy feed treatment
  left untouched.

### src/components/cricket/scorecard.tsx
- Imported MilestoneBadge; added it to batsmen rows: desktop `BattingTableRow`
  (after the name, before the dismissal text) and mobile `BattingStackedRow`
  (normal batsman path only — Extras/Total rows are untouched).

### src/components/cricket/fall-of-wickets-chart.tsx (created by concurrent agent, hardened by me)
- Fixed a real bug: series were keyed by `teamId`, so in Tests/follow-on two
  innings of the same team collided on one recharts dataKey (second innings
  overwrote the first). Now each innings gets a unique `inn-{i}` key and the
  legend disambiguates with "TEAM (2nd inns)" via a local ordinal helper.
- Empty state now renders a proper card: "No wickets yet" + explainer line.

### src/components/cricket/over-comparison-chart.tsx (created by concurrent agent, completed by me)
- Super-over innings are excluded from the per-team aggregation (they would
  otherwise be summed into the team's over-1 bar).
- Expensive-over coloring via recharts Cells: >=15 runs → rose (#e11d48),
  0-run overs → gray (#d1d5db), else team color. Values coerced with
  `typeof raw === "number"` because computed-key data rows widen to
  `string | number | null` (this fixed 2 new TS2365 errors).
- Empty state aligned to spec: "No over data yet".

### src/app/matches/[id]/MatchPageContent.tsx (wiring by concurrent agent, DLS extension by me)
- WinVizView now also accepts `liveState`: prefers live status/result for the
  completed-match branch (persisted row can lag), and passes a
  `{ targetOverride, revisedOvers }` DLS override into the model.
- `computeWinProbability` gained an optional `dls` param; the 2-innings branch
  uses `dls.targetOverride` as the target and `dls.revisedOvers` as the max
  overs when computing ballsRemaining. Non-DLS behaviour is byte-identical.
- Import of `type LiveMatchState` added alongside existing `stateToScorecard`.
- Tabs wiring: `<WinVizView match scorecard={displayScorecard} liveState={liveState} />`.

### src/lib/scoring.ts — milestone commentary (done by concurrent agent, reviewed by me, kept as-is)
- `"milestone"` kind + emission on exact 50/100/150 crossings is already in
  applyBall (guarded by strikerRunsBefore capture); consumers handle it via
  fallbacks (BORDER_BY_KIND / LABEL_BY_KIND, ball-chip case, KEY_MOMENT_KINDS).
- Left untouched deliberately (engine is high-risk; the existing
  implementation is correct).

## Verification
- `bunx tsc --noEmit` (scoped grep): only the 4 pre-existing baseline errors
  remain; ZERO new errors in any touched file (2 transient TS2365 errors I
  introduced in over-comparison-chart were fixed in the same session).
- `bun run lint`: 0 errors, 2 pre-existing warnings in unrelated files.
- dev.log: no compile/runtime errors.
- Recharts is already a dependency (2.15.4) and is the established charting
  approach in this file family — no new chart libraries added; no new deps.

## Known limitations (accepted, documented)
- Runs-per-over is derived from the commentary feed, which is capped at 120
  entries (shared with the existing worm charts) — long innings show only the
  most recent overs in the over-comparison chart; the FoW chart is NOT
  affected (fallOfWickets is complete).
- Over-comparison aggregates a team's multiple Test innings into one series
  (documented design of the concurrent agent's splitCommentaryByInnings);
  the FoW chart renders per-innings lines correctly after my fix.
- Commentary-derived per-ball run parsing slightly undercounts
  "No ball (+1) FOUR!" totals (matches the existing worm-chart behaviour).
