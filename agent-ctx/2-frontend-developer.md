# Task 2 — Frontend Developer — Live-Scoring Fixes (#7, #8, #15)

**Scope:** Frontend-only edits to the live-scoring system. Did NOT touch any
backend/API/lib files owned by Task 1 (scoring.ts, scorer-auth.ts,
series-slug-resolver.ts, src/app/api/**, mini-services/**).

## Files changed

1. `src/lib/use-live-score.ts` — Fix #7 (viewer DB fallback).
2. `src/components/admin/views/live-scorer-view.tsx` — Fix #8 (flush-on-close)
   + Fix #15 (power-play badge in scorer console).
3. `src/components/site/live-match-section.tsx` — Fix #15 (power-play badge on
   the public live section).

## Fix #7 — Viewer DB fallback when score-service cache is empty

**Problem:** When a viewer subscribes, the score-service emits `{ state: null }`
if its in-memory cache is empty (e.g. right after a deploy/restart). The viewer
then showed "waiting for scorer" indefinitely even though `Match.liveStateJson`
held the state in the DB.

**Fix (use-live-score.ts):** The `socket.on("state", ...)` handler is now
`async`. Behaviour:
- Non-null incoming state: set it directly (takes over from any DB snapshot
  once the scorer reconnects + broadcasts). Sets `gotLiveStateRef = true`.
- Null state on the INITIAL snapshot only (`dbFallbackAttemptedRef` guards
  against re-fetching on every null emit): fetch the match via
  `api.matches.get(matchId)`, parse `match.liveStateJson` via `JSON.parse`,
  and use it as the initial state. If the fetch fails or `liveStateJson` is
  empty, keep showing "waiting for scorer" (setLiveState(null)).
- Subsequent null emits (scorer cleared the cache) are honored as null.

**Race-safety:** A `gotLiveStateRef` flag ensures that if the scorer reconnects
and broadcasts a live state WHILE the DB fetch is in-flight, the live snapshot
wins and the (older) DB snapshot is discarded. A `cancelled` flag (scoped to
the effect) prevents state updates after matchId changes / unmount so the
previous match's snapshot doesn't flash into a new subscription.

The socket subscription is fully intact — the fallback is additive. Existing
`pushState`/`clearState`/buffer-flush-on-reconnect logic unchanged.

## Fix #8 — Flush pending persist on tab close / visibility hidden

**Problem:** The persist call was debounced 800ms via `setTimeout`. If the
scorer's browser crashed / closed / lost WiFi within that 800ms window, the DB
never received the latest state.

**Fix (live-scorer-view.tsx):** Added a flush-on-close mechanism:
- Two new refs (`latestLiveStateRef`, `latestMatchRef`) kept in sync via small
  effects, holding the latest liveState + match so the flush handler (registered
  ONCE before the early returns, to comply with rules-of-hooks) can read them.
- A `useEffect([])` registers `visibilitychange`, `pagehide`, and `beforeunload`
  listeners. The handler: if `saveTimer.current` is set (a debounced persist is
  pending), clears the timer and fires an immediate PUT `/api/matches/${id}`
  with `keepalive: true` (so the request survives page teardown — sendBeacon
  can't send a JSON PUT with headers). Fire-and-forget, no toast on error (the
  tab is closing). Cleanup removes all three listeners on unmount.

The existing 800ms debounce for normal operation is untouched — the flush only
triggers on hide/close. The effect is inherently guarded for read-only contexts
(no persist scheduled => `saveTimer.current` is null => flush is a no-op).

The flush is placed BEFORE the early returns (hooks-rules safe); the persist
function itself is unchanged in its debounced behaviour.

## Fix #15 — Power-play indicator badge

**Context:** `Series.powerPlayEnabled: boolean` + `Series.powerPlayOvers:
PowerPlaySegment[]` already exist in the TS types and are serialized by the
API (verified in `src/lib/serialize.ts` + `src/app/api/series/[id]/route.ts`).
The match's `series` is populated by the matches API
(`include: { series: true }`). This fix is purely visual.

**Scorer console (live-scorer-view.tsx):**
- Computed `series = match.series ?? null`, `currentOver` (1-indexed:
  `Math.floor(inn.balls / 6) + 1`), and `inPowerPlay` (true when
  `series.powerPlayEnabled` AND `currentOver` falls within any segment's
  `[from, to]` range).
- Passed `inPowerPlay` as a new optional prop to the `LiveScoreboard`
  sub-component.
- Rendered a `Badge` (shadcn) with the `Zap` lucide icon next to the score /
  overs display (right after the existing "Free hit" pill), styled
  `border-purple-200 bg-purple-50 text-purple-700` to match the series
  editor's power-play theme.

**Public live section (live-match-section.tsx):** The section only received
`matchId`, so I added a single `useMatch(matchId)` hook (minimal plumbing —
not "significant") to read `match.series`, then computed the same
`inPowerPlay` and rendered the same purple `Badge` in the score strip (on the
light `bg-muted/30` background where the editor's purple classes fit cleanly).

If `powerPlayEnabled` is false or no segment matches, nothing is rendered.

## TypeScript verification

Ran `bunx tsc --noEmit` and grepped for the three touched files.

- `src/lib/use-live-score.ts` — **0 errors**.
- `src/components/site/live-match-section.tsx` — **0 errors**.
- `src/components/admin/views/live-scorer-view.tsx` — 10 errors reported, ALL
  PRE-EXISTING in code regions I did NOT touch (confirmed against the original
  file snapshot):
  - Lines 92-93: `usePlayers(match?.team1Id ?? null)` — `string | null` vs
    `string | undefined` (pre-existing; was at original line 92).
  - Line 1033: `inn.teamShortName`/`totalRuns`/`totalWickets`/`totalOvers` on
    a `ScorerInnings` (wrong property names in the "Resume Scoring Session"
    backup UI; was at original line 967).
  - Lines 2045, 2089, 2196, 2197: `isKeeper`/`isCaptain`/`retired` type
    mismatches in picker sub-components (pre-existing, below my last edit).

**Zero new TypeScript errors introduced by my changes.** None of the reported
errors reference any of the new identifiers I added (`inPowerPlay`,
`latestLiveStateRef`, `latestMatchRef`, `flush`, `dbFallbackAttemptedRef`,
`gotLiveStateRef`, `cancelled`, `currentOver`, `series`, `persistImmediate`).

## Constraints honoured

- `"use client"` directives preserved at the top of all three files.
- Used only existing shadcn/ui (`Badge`) + lucide-react (`Zap`) — no new deps.
- Existing socket subscription, persist debounce, scoreboard rendering all
  unchanged in behaviour.
- No tests written. No `bun run build`. No dev server run. No git commands.
- Did not edit any Task-1-owned files (scoring.ts, scorer-auth.ts,
  series-slug-resolver.ts, src/app/api/**, mini-services/**).
