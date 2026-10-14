# Task 7 — Scorer Frontend (full-stack-developer)

## Scope
Built the per-scorer, per-tournament authentication UI on top of the existing
Next.js 16 cricket CMS: scorer login view, scoped scorer home view, admin
scorer-account CRUD, and the scorer-session store + token-aware live-scoring
hook that back them. Did NOT touch `src/app/page.tsx`, `header.tsx`,
`scorer-shell.tsx`, `mini-services/score-service/index.ts`, or `src/lib/store.ts`
(those are wired by the orchestrator in Task 8).

## Files

### Created
1. **`src/lib/scorer-session.ts`** — Zustand store, persisted to localStorage
   under `scorer-session-v1`. `session`, `setSession`, `clear`, `hydrated`,
   `setHydrated`. Hydrates synchronously on module load (client only).
2. **`src/components/site/views/scorer-login-view.tsx`** — `ScorerLoginView`
   (named export). Full-screen centered layout (no `ScorerShell`), navy
   `usacricketers` wordmark, red `Sign in` button, username/password fields,
   loading state on the button, red error text on 401, "Back to site" link
   that calls `exitScorerMode()`. On success → `setSession(data)` + navigate
   to `scorer-home`.
3. **`src/components/admin/views/admin-scorers-view.tsx`** — `AdminScorerView`
   (named export). Wrapped in `AdminShell` with `title="Scorer Accounts"`,
   count Badge, and `+ New Scorer` action. Table columns: Username, Name,
   Tournaments (Badges / count), Active (Badge), Actions (edit/delete).
   Create/Edit Dialog with username (disabled on edit), name, password
   (required on create, "Leave blank to keep" placeholder on edit), active
   `Switch`, and a checklist of all Series using `Checkbox`. Delete uses
   `AlertDialog`. Sonner `toast` feedback. Inline fetch helpers
   (`listScorers`, `createScorer`, `updateScorer`, `deleteScorer`) because
   `@/lib/api` doesn't yet have a scorer namespace. Series lookup built from
   `useSeries()`.

### Modified
4. **`src/components/site/views/scorer-home-view.tsx`** — replaced the
   `useMatches()` call (which fetched ALL matches) with a token-scoped
   `fetch("/api/scorer/matches", { headers: { Authorization: \`Bearer \${token}\` } })`
   using the scorer session token. Shows "Welcome, {scorer.name}" header card
   with "Your tournaments: {count}" + matches-visible count + Refresh +
   Sign out buttons. Defensive `if (!session) return null`. Keeps the same
   three sections (Live / Upcoming / Recently Completed) and same `MatchRow`
   component (re-typed from `any` → `Match`). Skeletons + empty state + red
   error Alert with Retry. Uses the `nonce`-derived-`loading` pattern from
   `use-data.ts` to avoid the `react-hooks/set-state-in-effect` rule.
5. **`src/lib/use-live-score.ts`** — signature changed to
   `useLiveScore(matchId: string | null, token: string | null)`. Removed the
   `SCORER_TOKEN` env constant entirely. Token stored in a `tokenRef` so
   socket-emits always read the latest value without forcing reconnects.
   `pushState` emits `operator:state` with `{ matchId, state, token }`;
   `clearState` emits `operator:clear` with `{ matchId, token }`. Both
   no-op when `token` is null.
6. **`src/components/admin/views/live-scorer-view.tsx`** — added
   `useScorerSession` import and `const token = useScorerSession((s) => s.session?.token ?? null)`,
   then `useLiveScore(id, token)`. Single targeted change; did not refactor
   anything else (pre-existing tsc noise at lines 55-56 about `usePlayers`
   accepting `string | undefined` is left untouched as instructed).

## Key contracts for the orchestrator (Task 8)
- The scorer-session store reads/writes localStorage key `scorer-session-v1`
  containing a JSON-serialized `ScorerSession`. `useScorerSession` exposes
  `.session`, `.setSession(s)`, `.clear()`, `.hydrated`. The login view calls
  `setSession(data)` after a successful `POST /api/scorer/login` and the home
  view calls `clear()` + `exitScorerMode()` on sign-out.
- `useLiveScore(matchId, token)` now sends the scorer's signed token with
  every `operator:state` / `operator:clear` emit. The score-service must
  verify this token (via `verifyScorerToken`) and check that the match's
  `seriesId` is in the scorer's `tournamentIds`. Reject emits without a
  valid token.
- The login view (`scorer-login`) and admin CRUD view (`admin-scorers`) are
  both `ViewKey`s already present in `@/lib/types`. The page router needs
  to:
  - render `<ScorerLoginView />` when `view === "scorer-login"` (and only
    in scorer mode), WITHOUT the `ScorerShell` wrapper (it's full-screen).
  - render `<AdminScorerView />` when `view === "admin-scorers"` (admin
    mode; the view already wraps itself in `AdminShell`).
  - gate `scorer-home`: if no session in the store, navigate to
    `scorer-login` instead of rendering `ScorerHomeView` (or render
    `ScorerLoginView` directly). `ScorerHomeView` defensively returns null
    if there's no session.

## Style adherence
- No indigo/blue primary colors. Cricket palette: red accent for login CTA
  and live indicators, emerald for active badges, slate neutrals.
- Mobile-first responsive. shadcn `Card`, `Button`, `Input`, `Label`,
  `Switch`, `Checkbox`, `Dialog`, `AlertDialog`, `Table`, `Skeleton`,
  `Badge`, `Alert` (custom-styled).
- Loading states with `Skeleton` everywhere. Errors with red `Alert` /
  inline text. `sonner` `toast` for admin feedback.
- Lint: `bun run lint` → 0 errors, 0 warnings (verified).

## Verification
- `bun run lint` — clean (0 errors, 0 warnings) for the whole project.
- Per-file ESLint check on all 6 of my files — clean.
- `bunx tsc --noEmit` — my files have zero new type errors. Pre-existing
  errors in `live-scorer-view.tsx` lines 55-56 (passing `null` to
  `usePlayers` which expects `string | undefined`) are NOT from my changes;
  they predate this task and were intentionally left untouched per the
  "Only ONE change needed in this file" instruction.
- Dev log shows `✓ Compiled in 150ms` after my edits; the existing 200
  responses on `/` confirm the frontend renders. (500s on `/api/scorer/*`
  are Task 6 backend `db.scorer` undefined errors — not in my scope.)
