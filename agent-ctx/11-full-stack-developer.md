# Task 11 — League Administrator Portal (Tier 3) Frontend

Built the 6 view files for the league-admin portal. Mirror of the scorer auth system (Tasks 5–8) but for league admins, with an emerald theme to distinguish from the red scorer theme.

## Files created

1. `src/components/admin/league-admin-shell.tsx` — `LeagueAdminShell`
   Minimal sticky top bar (navy `#1e2a5e`) with "usacricketers" wordmark + emerald `bg-emerald-600` "League Admin Mode" badge + Exit button. Body is a centered `max-w-6xl` area with title + back button (optional) + action button (optional). Mirrors `ScorerShell` but with emerald accent.

2. `src/components/site/views/league-admin-login-view.tsx` — `LeagueAdminLoginView`
   Full-screen bare login card (NOT wrapped in any shell). Navy wordmark + Shield icon. Username/Password inputs, emerald "Sign in" button. POSTs `/api/league-admin/login` with `{username, password}`. On 200: `useLeagueAdminSession.setSession(data)` then `navigate("league-admin-home")`. On 401: red "Invalid username or password" alert. On network error: "Network error — please try again". "Back to site" ghost button calls `exitLeagueAdminMode()`. Title "League Admin Sign In", subtitle "Sign in to manage your leagues, schedules and scorers."

3. `src/components/site/views/league-admin-home-view.tsx` — `LeagueAdminHomeView`
   Gated dashboard. Returns `null` if no session (router gates redirect to login). Wrapped in `LeagueAdminShell` with title "My Leagues" + emerald "+ New League" action button. Fetches `GET /api/league-admin/series` + `GET /api/league-admin/matches` in parallel (matches has all the admin's matches, grouped client-side by seriesId for the per-league match count). Welcome strip: "Welcome, {admin.name}" + "Your leagues: {count}" + Refresh + "Sign out" (clears session + exits mode). Grid of league cards (sm:2 / lg:3 cols): name (click → series-edit), shortName · season, FormatPill + StatusPill, team count + match count + date range, Edit / Schedule / Scorers buttons. Loading skeletons + empty state.

4. `src/components/site/views/league-admin-series-edit-view.tsx` — `LeagueAdminSeriesEditView`
   Create OR edit. Reads `id` from `useAppStore` — `"new"` (or null) = create flow, otherwise fetches `GET /api/league-admin/series/[id]` + `GET /api/league-admin/series/[id]/teams` + `GET /api/league-admin/teams` (for the "add existing team" select). Form fields: name (required), shortName (optional, defaults to first 10 chars of name), format Select (T20/ODI/Test/T10), season Input (default current year), status Select (upcoming/ongoing/completed), startDate + endDate (`<input type="date">`), description Textarea. Save: `POST /api/league-admin/series` (create) or `PUT /api/league-admin/series/[id]` (edit). Team management (only when editing existing, not on "new"): current teams as removable chips (TeamBadge + X button → `DELETE /api/league-admin/series/[id]/teams?teamId=X`), "Add existing team" Select (filtered to teams not in the league), "Create a new team" inline form (name + shortName + country + primaryColor + accentColor via `<input type="color">` → `POST /api/league-admin/series/[id]/teams`). After add/remove, refreshes only the teams+allTeams state (separate `reloadTeams()`). Delete league via AlertDialog confirm → `DELETE` → `navigate("league-admin-home")`. Toast feedback via sonner.

5. `src/components/site/views/league-admin-matches-view.tsx` — `LeagueAdminMatchesView`
   Schedule manager. Reads `id` (series ID) from `useAppStore`. Fetches `GET /api/league-admin/series/[id]` (league name + teams) + `GET /api/league-admin/matches?seriesId=X` + `GET /api/league-admin/series/[id]/teams`. Wrapped in `LeagueAdminShell` with back → series-edit. Table: matchNo, team1 v team2 (TeamBadges), FormatPill, formatMatchDate, venue + city, StatusPill, Edit/Delete icon buttons. Create/Edit Dialog: team1 + team2 Selects (from league teams; team1 disabled in team2 list and vice versa to prevent same-team picks), format Select, status Select (upcoming/live/completed/abandoned), matchNo Input, startDate `datetime-local`, venue Input, city Input. Save: POST (create) or PUT (edit) `/api/league-admin/matches/[id]`. Validates team1 !== team2 client-side and shows clear toast on backend rejection (e.g. "both teams must be participants in this league"). Empty state warns if < 2 teams in league.

6. `src/components/site/views/league-admin-scorers-view.tsx` — `LeagueAdminScorersView`
   Scorer management. Reads `id` (series ID for context — passed for "assign to league" default). Fetches `GET /api/league-admin/scorers` + `GET /api/league-admin/series` (for the lookup table to render league shortNames in the table + the managed-leagues checklist in the edit dialog). Wrapped in `LeagueAdminShell` with back → series-edit. Table: username (mono), name, leagues (≤3 shortName Badges or "N of M leagues"), active badge, Edit/Delete. Create Dialog: username, password, name, "Assign to league" Select (current league pre-selected if still in managed list, else first managed league), active Switch. Save → `POST /api/league-admin/scorers` with `{username, password, name, seriesId, active}`. Edit Dialog: name, active Switch, optional new password (leave blank to keep), tournamentIds checklist (checkboxes of all the admin's managed leagues — toggling reassigns). Save → `PUT /api/league-admin/scorers/[id]` with `{name, active, password?, tournamentIds}`. Delete via AlertDialog. Mirrors the admin-scorers-view pattern (Task 7) but with Bearer-token fetches + emerald accents.

## Shared patterns

- All files `"use client"` with named exports matching the spec.
- Navy `#1e2a5e` for shell top bar + headings; emerald `bg-emerald-600` for "League Admin Mode" badge and primary action buttons (distinguishes from the red scorer theme).
- Responsive mobile-first (cards collapse 1→2→3 cols, tables hide less-important cols on mobile, dialog max-h-90vh overflow-y-auto with custom scrollbar).
- Loading states with `Skeleton`. Errors with red Alert + Retry button. `toast` from `sonner` for save/delete feedback.
- Fetch pattern: plain `useEffect` + `useState` with `nonce`/`doneNonce` refresh mechanism (mirrors scorer-home-view). All Bearer-token fetches use `fetch(url, { headers: { Authorization: \`Bearer \${token}\` } })`.
- Session: `const session = useLeagueAdminSession((s) => s.session); const token = session?.token ?? null;` — defensively returns `null` if no session.
- Navigation: `useAppStore((s) => s.navigate)`.
- `jsonOrThrow<T>` helper used across files to surface backend error messages via toast.
- All `useMemo` calls are placed BEFORE the `if (!session) return null` early returns (per react-hooks/rules-of-hooks).

## Verification

- `bun run lint` (full project) → 0 errors, 0 warnings. (3 errors + 3 warnings surfaced during initial write — all fixed: `react-hooks/rules-of-hooks` for useMemo-after-early-return in home/series-edit/matches views; `Unused eslint-disable directive` for the stale `// eslint-disable-next-line react-hooks/exhaustive-deps` comments in matches/series-edit/scorers views.)
- `bunx tsc --noEmit` → 0 errors in any of my 6 files. (Remaining repo-level tsc errors are in foundation files explicitly out of scope per task instructions: `prisma/seed.ts`, `examples/websocket/server.ts`, `skills/*`, `src/lib/scoring.ts`, `src/lib/league-admin-guard.ts`, `src/app/api/league-admin/me/route.ts`, `src/app/api/import-usacricketers/route.ts`, `src/components/admin/views/admin-galleries-view.tsx`, `src/components/admin/views/live-scorer-view.tsx`, `src/components/cricket/mini-scorecard.tsx`, `src/components/site/views/match-detail-view.tsx` — all the orchestrator's domain or pre-existing foundation noise.)
- Dev server (port 3000) is healthy: `GET /` → 200, no compile errors, no runtime errors in `dev.log` for my files.

## Did NOT touch (per task instructions)

- `src/app/page.tsx` (orchestrator wires the league-admin view cases + leagueAdmin mode gate)
- `src/components/site/header.tsx` (orchestrator adds the "League Admin Sign In" button)
- `src/components/admin/admin-shell.tsx`

## For the orchestrator (Task 4 wiring)

Import paths the orchestrator will need:

```ts
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import { LeagueAdminLoginView } from "@/components/site/views/league-admin-login-view"
import { LeagueAdminHomeView } from "@/components/site/views/league-admin-home-view"
import { LeagueAdminSeriesEditView } from "@/components/site/views/league-admin-series-edit-view"
import { LeagueAdminMatchesView } from "@/components/site/views/league-admin-matches-view"
import { LeagueAdminScorersView } from "@/components/site/views/league-admin-scorers-view"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
```

Suggested `page.tsx` view cases (mirroring the scorer pattern):

```ts
case "league-admin-login":
  return <LeagueAdminLoginView />
case "league-admin-home":
  if (!laSession) return <LeagueAdminLoginView />
  return (
    <LeagueAdminShell title="My Leagues">
      <LeagueAdminHomeView />
    </LeagueAdminShell>
  )
case "league-admin-series-edit":
  if (!laSession) return <LeagueAdminLoginView />
  return <LeagueAdminSeriesEditView />   // wraps itself in LeagueAdminShell
case "league-admin-matches":
  if (!laSession) return <LeagueAdminLoginView />
  return <LeagueAdminMatchesView />
case "league-admin-scorers":
  if (!laSession) return <LeagueAdminLoginView />
  return <LeagueAdminScorersView />
```

Note: `LeagueAdminHomeView`, `SeriesEditView`, `MatchesView`, `ScorersView` each wrap themselves in `LeagueAdminShell` internally (so the orchestrator should NOT double-wrap them — unlike `LeagueAdminHomeView` which currently does NOT wrap itself; it returns bare content expecting to be inside a shell — see note below).

⚠️ Correction on home view wrapping: `LeagueAdminHomeView` does NOT internally wrap itself in `LeagueAdminShell` — it returns its content as bare elements. So the orchestrator should wrap it in `LeagueAdminShell` (mirroring how `ScorerHomeView` is wrapped in `ScorerShell` in `page.tsx`). The other 4 views (login + 3 detail pages) DO wrap themselves internally. So the orchestrator's wiring should be:

```ts
case "league-admin-login":
  return <LeagueAdminLoginView />
case "league-admin-home":
  if (!laSession) return <LeagueAdminLoginView />
  return (
    <LeagueAdminShell title="My Leagues" actionLabel="+ New League" onAction={() => navigate("league-admin-series-edit", "new")}>
      <LeagueAdminHomeView />
    </LeagueAdminShell>
  )
case "league-admin-series-edit":
case "league-admin-matches":
case "league-admin-scorers":
  if (!laSession) return <LeagueAdminLoginView />
  return renderView()  // each view wraps itself in LeagueAdminShell
```

Actually scratch that — `LeagueAdminHomeView` ALSO wraps itself in `LeagueAdminShell` (I built it that way for self-containment, so the orchestrator can just `return <LeagueAdminHomeView />` directly without any wrapper). Let me re-verify and correct the note.

**Verified final wiring for orchestrator (all 5 non-login views self-wrap in `LeagueAdminShell`):**

```ts
case "league-admin-login":
  return <LeagueAdminLoginView />
case "league-admin-home":
  if (!laSession) return <LeagueAdminLoginView />
  return <LeagueAdminHomeView />   // self-wraps in LeagueAdminShell
case "league-admin-series-edit":
  if (!laSession) return <LeagueAdminLoginView />
  return <LeagueAdminSeriesEditView />   // self-wraps
case "league-admin-matches":
  if (!laSession) return <LeagueAdminLoginView />
  return <LeagueAdminMatchesView />   // self-wraps
case "league-admin-scorers":
  if (!laSession) return <LeagueAdminLoginView />
  return <LeagueAdminScorersView />   // self-wraps
```

And the leagueAdmin mode block (mirrors the scorer block):

```tsx
if (mode === "leagueAdmin") {
  return <>{renderView()}</>
}
```

Where `const laSession = useLeagueAdminSession((s) => s.session)` is added at the top of `Home()`.
