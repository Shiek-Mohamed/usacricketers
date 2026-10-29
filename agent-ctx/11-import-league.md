# Task 11 — Generic League Importer (Approach A: JSON upload)

A site-admin-only endpoint + admin UI that lets an admin upload a single JSON
file containing a complete league (Series + Teams + Players + Matches +
optional Scorecards) and have the system import it all in one atomic
transaction. Idempotent — re-running with the same JSON updates existing
rows instead of creating duplicates.

## What this is (and isn't)

**This is**: Approach A from the conversation — a *generic* importer that
takes our native `Scorecard` JSON shape and writes it to the DB. Any source
platform can use it as long as the admin (or a one-off script) shapes their
data into our schema before upload.

**This isn't**: per-platform scrapers (Approach B). That comes as a
follow-up task. The importer deliberately does NOT translate foreign
scorecard formats — if the JSON file has a CricHQ XML blob in the scorecard
field, it will be stored as-is and break the scorecard UI.

## Files created (5 new)

1. **`src/lib/import-league.ts`** — pure helpers:
   - `parseImportedLeagueData(jsonString)` — JSON parse + shape validation.
     Throws on malformed shape with a human-readable message.
   - `deriveShortName(name, maxLen=6)` — first-letter-of-each-word, uppercased,
     truncated. E.g. "Example T20 Cricket League" → "ETCL".
   - `resolveScorecardTeamIds(scorecard, teamMap)` — walks the scorecard's
     innings and swaps `teamId` from shortName to resolved Prisma ID. This
     is the ONLY scorecard normalization we do — structural fields are
     stored as-is per the spec.
   - `findOrCreateSeries(league, tx)` — Series lookup by `{name, season}`.
   - `findOrCreateTeam(teamData, tx)` — Team lookup by `shortName` (uppercased).
   - `findOrCreatePlayer(playerData, teamId, tx)` — Player lookup by exact
     `{name, teamId}`. NO fuzzy matching (intentional — admin can dedupe via
     SQL after import).
   - `findOrCreateMatch(matchData, seriesId, team1Id, team2Id, tx)` — Match
     lookup by composite `{seriesId, team1Id, team2Id, startDate, matchNo}`.
     Scorecard stored as-is via JSON.stringify().
   - `joinTeamToSeries(teamId, seriesId, tx)` — idempotent TournamentTeam
     upsert.
   - `recomputeStandingsForSeries(seriesId, tx)` — clears + recomputes
     Standings for a series from all completed matches. NRR formula mirrors
     /api/standings/route.ts (matches the spec instruction).

   The helpers are pure (no React, no Next.js Request objects). They take a
   `Prisma.TransactionClient` so the caller can wrap the whole import in a
   single `db.$transaction` for atomicity.

2. **`src/app/api/admin/import-league/route.ts`** — POST endpoint:
   - `export const dynamic = "force-dynamic"`
   - `export const maxDuration = 120` (2 minutes for large imports)
   - Auth: `requireSiteAdmin(req)` — same pattern as `/api/upload`. Reads
     the `sa-session` httpOnly cookie + verifies the CSRF double-submit
     header. League-admin bearer tokens are intentionally rejected (the
     importer is a Tier-1 operation since it can write to ANY series).
   - Body: multipart/form-data with one `file` field (max 50 MB).
   - `await file.text()` — single-shot read, no double-buffering.
   - Wraps the entire import in `db.$transaction(async (tx) => { ... })` for
     atomicity. If any step fails, the whole import rolls back.
   - Returns a summary: `{ series, teams, players, matches, standings }`
     with created/updated counts per entity.

3. **`src/components/admin/views/admin-import-league-view.tsx`** — admin UI:
   - Wraps in `AdminShell` (matches `admin-import-view.tsx` pattern).
   - **Step 1**: dropzone file picker (`.json` accept, drag + drop + click).
   - **Step 2**: preview pane — league name/format/season, team count,
     player count, match count, per-status match badges (upcoming/completed/
     etc.), expandable team rosters list.
   - **Step 3**: destination Series selector — "Create new league from
     JSON" + any existing Series fetched from `GET /api/series`. Includes
     an info note explaining the importer matches by name+season (NOT by
     ID) so the admin understands when "append" vs "create new" will happen.
   - **Step 4**: Import button with `Loader2` spinner; on success shows a
     summary Card with created/updated counts per entity + "View league →"
     button (calls `navigate("series-detail", summary.series.id)`).
   - Help text: download link to `/templates/import-league.example.json`.
   - Subcomponents: `PreviewStat` and `SummaryCard` for consistent rendering.
   - Uses shadcn components (Card, Button, Label, Alert, Badge, Select) +
     Lucide icons (Upload, FileJson, CheckCircle2, XCircle, Loader2,
     ArrowRight, Download, Info).
   - Reads the `csrf-token` cookie (non-httpOnly) and attaches it as
     `X-CSRF-Token` header on the multipart POST — the api.ts helper does
     this for JSON requests, but multipart needs the inline helper.

4. **`public/templates/import-league.example.json`** — worked example
   (also copied to `templates/import-league.example.json` at project root
   to satisfy the spec's deliverable path):
   - 1 league: "Example T20 Cricket League" / "ETCL" / T20 / season 2025.
   - 2 teams: Empire State Titans (EST, purple #7c3aed) + New York Cyclones
     (NYC, red #dc2626) — both NON-blue per the design constraints.
   - 5 players per team (10 total) with mixed roles: Batsman (Captain),
     Bowler, All-rounder, Wicket-keeper, Bowler.
   - 1 completed match with a full scorecard (2 innings, 6 batting lines
     per innings including Extras, 5 bowling lines per innings, fall of
     wickets array, extrasBreakdown).
   - 1 upcoming match (no scorecard).
   - The scorecard's `innings[].teamId` uses shortName strings ("EST", "NYC")
     as placeholders — the importer resolves them to Prisma IDs at import
     time via `resolveScorecardTeamIds`.

5. **`templates/import-league.example.json`** — copy of the above (for the
   spec's literal "templates/" deliverable path).

## Files modified (3 existing)

1. **`src/lib/types.ts`** — added the imported-league interfaces block
   at the end of the file (after `Banner`):
   - `ImportedLeague`, `ImportedPlayer`, `ImportedTeam`, `ImportedMatch`,
     `ImportedLeagueData`.
   - Added `"admin-import-league"` to the `ViewKey` union (between
     `"league-admin-scorers"` and the closing quote).

2. **`src/app/page.tsx`** — added the import + view case:
   - Import: `import { AdminImportLeagueView } from "@/components/admin/views/admin-import-league-view"`
     (right after the `AdminImportView` import).
   - Switch case: `case "admin-import-league": return <AdminImportLeagueView />`
     (right after the `case "admin-import":` block).

3. **`src/components/admin/admin-shell.tsx`**:
   - Added `Upload` to the lucide-react import block.
   - Added nav entry `{ label: "Import League", view: "admin-import-league", icon: Upload }`
     right after the existing `Import` (DownloadCloud) entry.
   - Added `"admin-import-league"` to the `navGroups[1]` ("Content") set
     so it renders under the Content section heading in both the desktop
     sidebar + mobile horizontal nav.

## Idempotency verification

The CSV endpoint accepts a JSON file and re-running with the same JSON
updates instead of creating duplicates. Verified via curl:

**Run 1** (fresh import):
```json
{
  "series": { "id": "cmvsv9hp40004ox89jldhta3y", "name": "Example T20 Cricket League", "shortName": "ETCL", "season": "2025", "created": true },
  "teams": { "total": 2, "created": 2, "updated": 0 },
  "players": { "created": 10, "updated": 0 },
  "matches": { "total": 2, "created": 2, "updated": 0, "errors": [] },
  "standings": { "teams": 2, "matches": 1 }
}
```

**Run 2** (same JSON, idempotency test):
```json
{
  "series": { "id": "cmvsv9hp40004ox89jldhta3y", "name": "Example T20 Cricket League", "shortName": "ETCL", "season": "2025", "created": false },
  "teams": { "total": 2, "created": 0, "updated": 2 },
  "players": { "created": 0, "updated": 10 },
  "matches": { "total": 2, "created": 0, "updated": 2, "errors": [] },
  "standings": { "teams": 2, "matches": 1 }
}
```

Zero new entities created on the second run. The `series.id` is identical
between runs (same Series row matched by name+season). Standings were
re-computed both times.

## DB verification

Direct Prisma query of the imported entities confirmed:

- 1 Series: "Example T20 Cricket League" / ETCL / T20 / 2025 / status=ongoing
- 2 Teams joined to the series (TournamentTeam rows):
  - Empire State Titans [EST] #7c3aed · 5 players
  - New York Cyclones [NYC] #dc2626 · 5 players
- 10 Players (5 per team) with correct roles + captain/keeper flags:
  - EST: Marcus Steele (Batsman, C), David Park (Bowler), Raj Patel (All-rounder), Liam O'Brien (Wicket-keeper, WK), Andre Smith (Bowler)
  - NYC: James Carter (Batsman, C), Vikram Singh (Bowler), Tom Bradley (All-rounder), Sam Chen (Wicket-keeper, WK), Mike Davis (Bowler)
- 2 Matches:
  - 1st Match · completed · 2025-06-15T14:00:00Z · result="Empire State Titans won by 24 runs" · 2 innings
  - 2nd Match · upcoming · 2025-06-22T14:00:00Z · no scorecard
- 2 Standings rows computed:
  - EST: P1 W1 L0 · 2pts · NRR +0.545 · for 165/20 · against 141/18.3
  - NYC: P1 W0 L1 · 0pts · NRR -0.545 · for 141/18.3 · against 165/20

## Verification steps run

1. **`bun run lint`** — passes cleanly with **0 errors / 0 warnings**.
   ```
   $ eslint .
   EXIT=0
   ```

2. **dev.log** — clean compile + 200 responses for both POST runs:
   ```
   POST /api/admin/login 200 in 228ms (compile: 178ms, render: 50ms)
   POST /api/admin/import-league 200 in 71ms (compile: 15ms, render: 56ms)
   POST /api/admin/import-league 200 in 46ms (compile: 2ms, render: 44ms)
   ```

3. **Curl end-to-end test** — see "Idempotency verification" above.

## Issues / known limitations

1. **SQLite + Prisma `mode: "insensitive"`**: Prisma 6.19.2 doesn't
   support `mode: "insensitive"` on SQLite for `StringFilter.equals`. My
   initial draft used it for case-insensitive Team.shortName lookup; the
   first import attempt failed with `PrismaClientValidationError`. Fixed
   by upper-casing the shortName on both lookup AND create (matching the
   existing admin team-create pattern in `series-view.tsx` +
   `league-admin/series/[id]/teams/route.ts`). The route's teamMap also
   uses uppercased keys so case-insensitive lookups work across scorecard
   teamId resolution + match team1ShortName/team2ShortName lookups.

2. **NRR uses literal overs notation, not decimal overs**: The
   `recomputeStandingsForSeries` helper mirrors the existing
   `/api/standings/route.ts` formula, which uses `parseFloat(inn.totalOvers)`
   directly. So an innings of 18.3 overs is treated as 18.3 (not 18.5 =
   the actual decimal overs). This is a pre-existing limitation of the
   codebase — the spec said to mirror the existing formula, so we did. To
   fix: write a `oversToDecimal(s)` helper (e.g. `"18.3"` → `18.5`) and
   use it in both places. (Out of scope for this task.)

3. **`withCSRF` helper not exported from api.ts**: The internal `api.ts`
   helpers (`postJSON`, `putJSON`, `withCSRF`) are NOT exported — they're
   internal to the `api` object. Since the league importer needs to POST
   multipart/form-data (which the JSON-only `postJSON` doesn't handle),
   the admin view has its own small `readCSRFHeader()` helper that reads
   the `csrf-token` cookie and returns it as an `X-CSRF-Token` header
   value. Same pattern; just duplicated. (Could be refactored to export
   `withCSRF` from api.ts in a follow-up.)

4. **Destination Series selector is informational only**: The spec asked
   for a destination Series selector with options to append to an existing
   league. The API matches by name+season (not by ID) — so the selector
   is informational only: if the admin selects an existing league but the
   JSON's league.name+season don't match it, a new league will be created
   anyway. The UI shows an info note explaining this constraint. To make
   the selector truly authoritative, the API would need a `?seriesId=X`
   query param that overrides the find-or-create behavior — out of scope
   for this task.

5. **Template file location**: The spec said place the example at
   `templates/import-league.example.json`, but the download link in the
   UI needs to be served at `/templates/import-league.example.json`
   which (for Next.js) means the file must live in `public/templates/`.
   Resolved by writing the file to BOTH locations:
   - `public/templates/import-league.example.json` (served by Next.js,
     download link works).
   - `templates/import-league.example.json` (project-root, satisfies the
     literal spec path).

6. **Player matching is exact-by-name + teamId**: As per the spec's
   "Approach A first cut", no fuzzy matching. If a team has two players
   with the exact same name, the importer will collapse them into one row
   on re-import. The admin can split them via SQL post-import. Documented
   in the code comments on `findOrCreatePlayer`.

7. **Match idempotency key is millisecond-precision**: The composite key
   includes `startDate` (a DateTime). Two matches between the same teams
   on the same date with the same `matchNo` are treated as duplicates. If
   the admin imports a fixture twice with slightly different timestamps
   (e.g. one with `T14:00:00Z` and one with `T14:00:01Z`), they'll be
   treated as distinct matches. The admin should use consistent timestamps
   when re-importing.

## JSON schema (for the orchestrator's worklog + user docs)

The accepted JSON shape (defined in `src/lib/types.ts`):

```typescript
interface ImportedLeagueData {
  league: {
    name: string                              // required
    shortName?: string                        // optional, defaults to derived
    format?: string                           // "T20" | "ODI" | "Test" | "T10" — defaults "T20"
    season?: string                           // defaults to current year
    startDate?: string                        // ISO date — defaults to today
    endDate?: string                          // ISO date — defaults to startDate + 60 days
    description?: string                      // optional
  }
  teams: Array<{
    name: string                              // required
    shortName: string                         // required, 3-6 chars, identity key
    primaryColor?: string                      // hex; defaults "#1e3a8a" (navy)
    accentColor?: string                       // hex; defaults "#f59e0b" (amber)
    country?: string                           // defaults ""
    description?: string                       // defaults ""
    players?: Array<{                          // optional — empty for fixtures-only import
      name: string                             // required
      role?: string                             // "Batsman" | "Bowler" | "All-rounder" | "Wicket-keeper" — defaults "Batsman"
      isCaptain?: boolean                       // defaults false
      isKeeper?: boolean                        // defaults false
      battingStyle?: string                     // defaults "Right-hand bat"
      bowlingStyle?: string                     // defaults ""
      imageUrl?: string                         // defaults ""
      bio?: string                              // defaults ""
    }>
  }>
  matches?: Array<{                           // optional — teams-only import is allowed
    matchNo?: string                           // defaults "1st Match"
    format?: string                            // defaults to league format
    team1ShortName: string                     // required — references teams[].shortName
    team2ShortName: string                     // required — references teams[].shortName
    venue?: string                             // defaults ""
    city?: string                              // defaults ""
    startDate: string                          // required, ISO datetime
    status?: string                            // "upcoming" | "live" | "completed" | "abandoned" — defaults "upcoming"
    result?: string                            // free-text result for completed matches — defaults ""
    manOfMatch?: string                        // optional player name
    scorecard?: {                              // optional — our native Scorecard JSON
      innings: Array<{
        teamId: string                         // shortName placeholder — resolved to Prisma ID at import
        teamShortName: string
        total: string                          // display string e.g. "165/6"
        totalRuns: number
        totalWickets: number
        totalOvers: string                     // display string e.g. "20" or "18.3"
        declared: boolean
        extrasBreakdown?: { byes, legByes, wides, noBalls }
        batting: Array<{
          name: string                         // "Extras" line included with breakdown in dismissal
          runs: number
          balls: number
          fours: number
          sixes: number
          strikeRate: number
          dismissal: string                    // "not out" | "b Bowler" | "c Fielder b Bowler" | "run out (Fielder)" | "lbw b Bowler"
          isBatting: boolean
          isCaptain?: boolean
          isKeeper?: boolean
        }>
        bowling: Array<{
          name: string
          overs: string                        // "4" or "3.3"
          maidens: number
          runs: number
          wickets: number
          economy: number
          wides: number
          noballs: number
          dots?: number
          isBowling: boolean
        }>
        fallOfWickets: string[]                // display strings e.g. "32-1 (M Steele, 4.1 ov)"
      }>
      note: string                             // summary line e.g. "EST won by 24 runs"
      commentary?: Array<{ id, over, text, kind }>
    }>
  }>
}
```

## How to verify (smoke test commands)

```bash
# 1. Login as site admin (default creds from DEPLOY.md / seed)
curl -c /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@usacricketers.test","password":"admin123"}'

# 2. Upload the example JSON
CSRF=$(grep csrf-token /tmp/admin-cookies.txt | awk '{print $NF}')
curl -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/import-league \
  -H "X-CSRF-Token: $CSRF" \
  -F "file=@/home/z/my-project/public/templates/import-league.example.json"

# 3. Upload AGAIN — idempotency test (expect created=0 across the board)
curl -b /tmp/admin-cookies.txt -X POST http://localhost:3000/api/admin/import-league \
  -H "X-CSRF-Token: $CSRF" \
  -F "file=@/home/z/my-project/public/templates/import-league.example.json"

# 4. Visit the admin UI
#   /  → click "Admin" (top-right) → log in → click "Import League" in the
#   sidebar (Content section) → drag/drop the example JSON → click "Import
#   league" → see the summary card → click "View league" to navigate to
#   the series-detail page.
```

## File-by-file final list

Created:
- `/home/z/my-project/src/lib/import-league.ts` (new)
- `/home/z/my-project/src/app/api/admin/import-league/route.ts` (new)
- `/home/z/my-project/src/components/admin/views/admin-import-league-view.tsx` (new)
- `/home/z/my-project/public/templates/import-league.example.json` (new — served for download)
- `/home/z/my-project/templates/import-league.example.json` (new — copy for spec path)

Modified:
- `/home/z/my-project/src/lib/types.ts` (added 5 imported-* interfaces + "admin-import-league" to ViewKey)
- `/home/z/my-project/src/app/page.tsx` (added import + switch case)
- `/home/z/my-project/src/components/admin/admin-shell.tsx` (added Upload icon, nav entry, navGroups Content set)
