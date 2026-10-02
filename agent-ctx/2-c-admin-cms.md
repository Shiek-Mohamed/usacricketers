# Task 2-c — Admin CMS (full-stack-developer)

## Files created (7 total)
1. `src/components/admin/admin-shell.tsx` — `AdminShell` (sidebar + header + content + mobile horizontal nav + Sonner Toaster mount).
2. `src/components/admin/views/dashboard-view.tsx` — `DashboardView` (stat cards grid + recent articles table + recent matches list + quick actions).
3. `src/components/admin/views/articles-view.tsx` — `AdminArticlesView` (search + table + create/edit Dialog + delete AlertDialog).
4. `src/components/admin/views/matches-view.tsx` — `AdminMatchesView` (search + table + create/edit Dialog with series/team/format/status selects + scorecard JSON Textarea with validation + delete AlertDialog).
5. `src/components/admin/views/players-view.tsx` — `AdminPlayersView` (search + table with PlayerAvatar + create/edit Dialog with Tabs for batting/bowling stats + delete AlertDialog).
6. `src/components/admin/views/teams-view.tsx` — `AdminTeamsView` (search + table with TeamBadge + color swatches + create/edit Dialog with color pickers + preview + delete AlertDialog with cascade warning).
7. `src/components/admin/views/series-view.tsx` — `AdminSeriesView` (search + table with StatusPill/FormatPill + date range + create/edit Dialog + delete AlertDialog).

## Key implementation decisions
- **Sonner toasts**: The layout only mounts the legacy shadcn Toaster. To use sonner as instructed, I mount a Sonner `<Toaster richColors position="top-right" />` once inside `AdminShell`. This keeps admin-mode toasts self-contained without modifying the shared `layout.tsx` (avoiding conflicts with parallel agents).
- **AdminShell pattern**: A 2-column layout — left sticky sidebar (`hidden lg:flex lg:w-60`) with `CMS / Admin Console` card and a vertical nav; main content section with title + count Badge + optional action button. On mobile (`lg:hidden`), the nav collapses into a horizontal scrollable button row at the top with custom scrollbar styling.
- **CRUD pattern (consistent across all 5 views)**:
  - Search `Input` filters client-side by sensible fields.
  - `Table` inside `Card` with sticky header, `max-h-[60vh] overflow-y-auto` and custom scrollbar.
  - Edit/Delete action buttons in a `whitespace-nowrap` actions cell (icon ghost buttons).
  - Create/Edit dialog uses plain `useState` form state (no react-hook-form), `Dialog` with header/footer.
  - Delete uses `AlertDialog` with destructive-styled Action button.
  - Loading state shows `Skeleton` rows; empty state shows a friendly "No X found." row.
- **TypeScript strictness**: For matches, the scorecard JSON string is parsed via `JSON.parse(...) as Scorecard` before sending so the payload type matches `Partial<Match>` (`scorecard?: Scorecard | null`). The API endpoints also detect `typeof === "string"` but on the client we always pass an object (or `null`).
- **Validation**: Articles require title; Matches require both teams and team1 !== team2; Players require name + team; Teams require name + shortName; Series require name + shortName. Invalid scorecard JSON shows an error toast and aborts save.
- **Player stats**: Batting/Bowling stats are edited via `Tabs` (Batting / Bowling). Numeric inputs are coerced via a `num()` helper; serialised to a `BattingStat`/`BowlingStat` object on submit (the API detects objects and `JSON.stringify`s them).
- **Teams**: Color pickers use native `<input type="color">` paired with a text `Input` for the hex code; a live `TeamBadge` preview is shown.
- **Slug auto-suggestion**: In Articles, the slug auto-populates from the title (only on create mode — preserves slug when editing).

## Lint
- `bun run lint` reports 3 errors in foundation files (`src/lib/serialize.ts` — empty `{}` Prisma payload types) and 1 unused eslint-disable warning in `src/lib/use-data.ts`. These are NOT mine (foundation Task ID 1 files; per instructions I must not recreate them).
- `npx eslint src/components/admin` (just my files) → **zero errors, zero warnings**.

## Dev log
- Project compiles cleanly (`✓ Compiled in 167ms`).
- API routes return 200 OK for `/api/matches`, `/api/articles`, `/api/articles?featured=true`.
- The Module-not-found errors in the dev log are stale (from before my files were created — page.tsx already imports them).
