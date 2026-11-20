# Task 1 — Backend fixes for live-scoring system

**Agent:** backend (Task ID 1)
**Date:** 2025
**Scope:** Production scoring code — surgical fixes only. Parallel agent (Task 2) handled frontend files. This task touched ONLY the backend files listed below.

## Files changed

1. `src/lib/scorer-auth.ts` — Fix #4 (warnIfDefaultSecrets export) + signature widening for `verifyScorerToken` / `verifyLeagueAdminToken` to accept `string | null | undefined`.
2. `src/lib/scoring.ts` — Fix #3 (run-out balls-faced bug) + Fix #5 (TS errors: `strikerId`/`nonStrikerId`/`bowlerId` annotated `string | null`; inline commentary literals `kind: "..." as const`).
3. `src/lib/series-slug-resolver.ts` — Fix #5 (removed broken `db.series.findUnique({ where: { slug } })` calls — Series model has no `slug` column; resolver is now a safe no-op for collision checks).
4. `src/app/api/matches/[id]/route.ts` — Fix #1 (PUT handler now accepts three auth modes: site-admin cookie + CSRF, scorer Bearer + scorerHasSeries, league-admin Bearer. Mirrors `toss/route.ts` pattern. Existing update payload preserved).
5. `src/app/api/scoring-audit/route.ts` — Fix #2 (auth required on GET + POST via same three modes; scorerId derived from token for scorer/league-admin modes, from body only for site-admin; rate-limited POST 200/min/IP; series-gated GET/POST).
6. `mini-services/score-service/index.ts` — Fix #4 (local `warnIfDefaultSecrets()` called at boot) + Fix #6 (DB fallback on subscribe: when cache is empty, fetches `Match.liveStateJson` via `GET /api/matches/[id]`, caches result, emits to subscribing socket; non-blocking with try/catch; deduped via `matchStatePending`) + `@ts-expect-error` on the optional redis dynamic imports (pre-existing module-not-found errors silenced).

## Files READ ONLY (not modified, as instructed)

- `src/app/api/matches/[id]/toss/route.ts` — read as the auth pattern to mirror.
- `src/lib/db.ts` — read for context.
- `src/lib/rate-limit.ts` — read to mirror the rate-limit helper API.
- `src/app/api/internal/match-series/route.ts` — read to mirror the internal-secret auth pattern.
- `src/lib/league-admin-guard.ts` — read for `authenticateLeagueAdmin` API.
- `prisma/schema.prisma` — read to confirm Series has no `slug` column (Fix #5 root cause) and to inspect `ScoringAudit` schema (Fix #2).
- `src/lib/serialize.ts` — read to confirm `serializeMatch` exposes `liveStateJson` (Fix #6).
- `src/components/admin/views/live-scorer-view.tsx` — read (Task 2's file, not modified by me) to understand how `logAudit` and `persist` are called from the frontend.

## Fix-by-fix summary

### Fix #1 — Scorer persist 401s (auth mismatch)
**Problem:** `PUT /api/matches/[id]` only accepted `requireSiteAdmin(req)` (site-admin cookie). Scorers log in via `/api/scorer/login` and hold only a Bearer token, so every `persist()` from scorer-mode returned 401 and `liveStateJson`/`scorecard`/`status` were never written to the DB.
**Fix:** Added an `isAuthorized(req, matchSeriesId)` helper mirroring `toss/route.ts`. PUT now accepts: (1) site-admin cookie + CSRF (via `requireSiteAdmin`), (2) scorer Bearer verified with `verifyScorerToken` + `scorerHasSeries` gate, (3) league-admin Bearer via `authenticateLeagueAdmin`. The handler fetches the match's `seriesId` first (one extra `findUnique`) so the scorer series-gate can run. Existing update payload (liveStateJson, scorecard, status, toss, etc.) is byte-for-byte preserved. Returns 401 if no mode succeeds. GET remains public; DELETE remains site-admin-only (unchanged).

### Fix #2 — /api/scoring-audit had zero authentication
**Problem:** GET and POST were fully open. POST read `scorerId` from the request body (forgeable). Anyone could pollute the audit trail or DoS the table.
**Fix:**
- Added a `resolveAuth(req)` helper returning a discriminated union: `{ mode: "siteAdmin" } | { mode: "scorer"; scorerId } | { mode: "leagueAdmin"; scorerId; managedSeriesIds }`. All three modes supported on GET and POST.
- POST: rate-limited FIRST (200/min/IP via `rateLimit`) so a flood is throttled before any DB work. Then auth required. `scorerId` is derived from the verified token for scorer mode (`payload.scorerId`) and synthesized as `league-admin:<adminId>` for league-admin mode. The body's `scorerId` is IGNORED for these modes. Only site-admins (cookie auth, acting on behalf) may pass `scorerId` via the body. Match series-gated via `canAccessMatch` (scorerHasSeries for scorers, canManageSeries for league-admins, always-true for site-admins). 403 if the caller isn't assigned to the match's series.
- GET: auth required. With a `matchId`, series-gated. Without a `matchId`, site-admins get the recent 500 rows (desc); scorers/league-admins get `[]` (must scope by matchId so the series gate can apply per-row).
- Preserved the existing audit schema (`matchId`, `scorerId`, `action`, `ballNo`, `detail`) and the non-fatal error-handling contract (errors logged, scoring not blocked).

### Fix #3 — Run-out balls-faced bug
**Problem:** In `applyBall`'s wicket case, `outBatsman.balls += 1` only fired when `isStrikerOut`. When the NON-striker was run out on a legal delivery, the striker faced that ball but their `balls` count was never incremented — distorting strike rates.
**Fix:** Reworked the credit logic at `scoring.ts` lines 584-602:
```ts
if (event.wicketType !== "retiredOut") {
  if (isStrikerOut) {
    outBatsman.balls += 1   // striker dismissed — they faced this ball
  } else if (isNonStrikerOut) {
    striker.balls += 1      // non-striker run out — STRIKER faced this ball
  }
}
```
Preserved all special-case rules: retired-out (no delivery, `isLegal=false`, no ball credit), retired-hurt (breaks out before this block, no delivery), free-hit-rejection (handles its own ball credit in its own branch above), bowler-credited dismissals (caught/bowled/lbw/stumped/hit-wkt can only apply to the striker). Wide balls do NOT count as a ball faced (untouched `wide` case). No-balls DO count (untouched `noball` case — though note: no-balls set `isLegal=false` so they don't count toward the over's legal ball count, but the batsman still faces a no-ball; the existing noball case does NOT increment `striker.balls`, which matches the original code's behavior — left unchanged to avoid scope creep).

### Fix #4 — Default-secret fail-fast/warn
**Problem:** `SCORER_SECRET` and `INTERNAL_SECRET` defaulted to insecure shipped values with no warning.
**Fix:**
- `scorer-auth.ts`: factored defaults into named constants (`DEFAULT_SCORER_SECRET`, `DEFAULT_INTERNAL_SECRET`) and exported `warnIfDefaultSecrets()` that reads `process.env` directly (so it's pure and importable from any context) and `console.warn`s a loud message for each default secret. Does NOT throw — preserves dev experience.
- `score-service/index.ts`: defined a local `warnIfDefaultSecrets()` (mirrors the scorer-auth export but uses the score-service's local secret constants — the score-service is a standalone bun project and importing scorer-auth would pull in the Prisma db client, an unwanted heavy dep). Called once in the `httpServer.listen` boot callback.

### Fix #5 — TypeScript errors
**`scoring.ts`:**
- Lines 422-424: annotated `let strikerId: string | null`, `let nonStrikerId: string | null`, `let bowlerId: string | null`. The early-return guard narrowed `state.strikerId` etc. to `string`, so `let strikerId = state.strikerId` inferred `string` and the later `strikerId = null` reassignments (retired-hurt, wicket, over-end) failed strictNullChecks. Explicit annotation fixes all 5 errors at lines 561/563/627/629/681.
- Lines 746, 782, 1048: added `as const` to `kind: "over"` / `kind: "info"` / `kind: "info"` in inline commentary object literals. Without `as const`, the `kind` field widened to `string` and the array `[ { kind: "..." }, ...commentary ].slice(0, 120)` failed to assign to `CommentaryEntry[]`. Fixes 3 errors at lines 722/758/1024.
**`series-slug-resolver.ts`:** The resolver called `db.series.findUnique({ where: { slug: explicit } })`, but the Series model in `prisma/schema.prisma` has NO `slug` column (slugs live on League/Team/Player, not Series). Removed the `db` import and both `findUnique({ where: { slug } })` calls. The slug-collision check is now a no-op (`existsFn` always returns `false`) — safe because there's no slug column to collide against. Reserved-slug validation and auto-derivation from name are preserved. If a slug column is added to Series in the future, restore the `findUnique` lookups.
**`scorer-auth.ts`:** widened `verifyScorerToken(token: string)` and `verifyLeagueAdminToken(token: string)` to accept `string | null | undefined` with an early `if (!token) return null` guard. This is a backward-compatible signature change that incidentally fixes TWO pre-existing TS errors in files I was told NOT to edit: `src/app/api/matches/[id]/toss/route.ts(29,37)` and `src/lib/league-admin-guard.ts(33,42)` — both called `verifyXxxToken(token)` where `token: string | null` from `readBearerToken`. The implementation was already null-safe in practice (the callers wrapped in try/catch), but the type signature didn't reflect that.
**`score-service/index.ts`:** added `// @ts-expect-error optional dependency — ...` directives on the two dynamic imports (`@socket.io/redis-adapter`, `redis`) inside `attachRedisAdapter`'s try/catch. These packages are intentionally optional (single-instance mode works without them) and aren't installed; the directives silence the pre-existing module-not-found errors.

### Fix #6 — Score-service DB fallback on subscribe
**Problem:** `cache` (in-memory `Map`) was the source of truth. On every fly.io deploy the cache is wiped, and viewers see "waiting for scorer" indefinitely even though `Match.liveStateJson` has the state in the DB.
**Fix:**
- Added `matchStatePending` map (dedupes concurrent fetches for the same match).
- Added `fetchMatchState(matchId)`: if `cache.has(matchId)`, returns the cached value (state OR null sentinel). Otherwise fetches `GET /api/matches/[id]` (public endpoint — no INTERNAL_SECRET needed), parses `liveStateJson`, caches the result (state OR null) and returns it. On network error: does NOT cache the failure (so the next subscriber can retry once the API is reachable). On malformed JSON / missing field: caches null (so we don't re-fetch for a match that genuinely has no state yet). Cleaned up the inflight marker via `p.finally(...)`.
- Updated the `subscribe` handler: if `cache.has(matchId)`, emit the cached value immediately. Otherwise emit `{ state: null }` immediately (non-blocking — the subscribe handshake isn't stalled), then kick off `fetchMatchState(matchId)`; when it resolves with a non-null state, emit `{ state }` to the subscribing socket. The room-wide broadcast still happens via the scorer's `operator:state` event — the DB fetch only hydrates the initial state for the subscribing socket.
- Try/catch around the fetch ensures a failure doesn't crash the service (falls back to null state, which is what the viewer already got).

## Verification

Ran `cd /home/z/my-project && bunx tsc --noEmit 2>&1 | grep -E "scoring.ts|series-slug-resolver.ts|scorer-auth.ts|matches/\[id\]|scoring-audit|score-service"` — **zero matches** (exit 1 from grep = no errors in target files).

Also confirmed the pre-existing `toss/route.ts(29,37)` and `league-admin-guard.ts(33,42)` errors are now gone (fixed as a side effect of the signature widening in `scorer-auth.ts`).

Ran `bunx eslint` on all 6 edited files — **zero lint errors**.

## Constraints honored

- Did NOT touch any frontend/component files (Task 2's scope).
- Did NOT touch `src/app/api/matches/[id]/toss/route.ts` (read-only) or `src/lib/db.ts` (read-only).
- Did NOT run git commands or commit.
- Did NOT run `bun run build` (forbidden in this env).
- Did NOT run the dev server.
- Did NOT add new dependencies.
- Did NOT write tests.
- Used existing helpers (`requireSiteAdmin`, `verifyScorerToken`, `verifyLeagueAdminToken`, `readBearerToken`, `scorerHasSeries`, `canManageSeries`, `authenticateLeagueAdmin`, `rateLimit`) — no reinvented auth or rate-limiting.
- Preserved existing behavior: site-admin path, persist payload, audit schema, score-service broadcast flow.

## Notes for the operator (commit + deploy)

- The frontend `logAudit` call in `src/components/admin/views/live-scorer-view.tsx` does NOT currently send the scorer Bearer token (only the body). With the new auth on `/api/scoring-audit` POST, scorer-mode audit logging will return 401 until Task 2 adds `Authorization: Bearer <scorerToken>` to that fetch. The `logAudit` call is wrapped in `.catch(() => {})` (non-fatal) so scoring continues either way.
- The signature widening of `verifyScorerToken` / `verifyLeagueAdminToken` is backward-compatible — all existing callers pass `string` or `string | null`, both now accepted.
- The `series-slug-resolver.ts` change makes the slug-collision check a no-op. This is correct for the current schema (Series has no slug column). If a slug column is added later, restore the `db.series.findUnique({ where: { slug } })` lookups.
- The score-service's `fetchMatchState` hits `GET /api/matches/[id]` (public) on every fresh-subscribe-when-cache-empty (deduped per-match). For high-traffic matches this is bounded by the `matchStatePending` dedupe — one fetch per match per cache-miss window. Once cached (state or null), subsequent subscribers get the cached value instantly.
