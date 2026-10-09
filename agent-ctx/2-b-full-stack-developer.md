# Task 2-b — full-stack-developer (public cluster 2)

## Scope
Built 7 public-site view components (client components) for the cricket CMS.

## Files created
1. `/home/z/my-project/src/components/site/views/series-view.tsx` — `SeriesView`
2. `/home/z/my-project/src/components/site/views/series-detail-view.tsx` — `SeriesDetailView`
3. `/home/z/my-project/src/components/site/views/teams-view.tsx` — `TeamsView`
4. `/home/z/my-project/src/components/site/views/team-detail-view.tsx` — `TeamDetailView`
5. `/home/z/my-project/src/components/site/views/players-view.tsx` — `PlayersView`
6. `/home/z/my-project/src/components/site/views/player-detail-view.tsx` — `PlayerDetailView`
7. `/home/z/my-project/src/components/site/views/stats-view.tsx` — `StatsView`

## Key contracts honored
- All views are `"use client"` and `export function XView()`.
- `useAppStore` for `id` + `navigate`.
- `use-data.ts` hooks: `useSeries`, `useSeriesItem`, `useTeams`, `useTeam`, `usePlayers` (accepts `teamId?`), `usePlayer`, `useMatches`.
- Cricket UI: `TeamBadge`, `PlayerAvatar`, `StatusPill`, `formatMatchDate`, `formatMatchTime`.
- `MiniScorecard` from `@/components/cricket/mini-scorecard`.
- shadcn: Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Skeleton, Tabs/TabsList/TabsTrigger/TabsContent, Select/*, Table/*, Separator.
- recharts: `BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell`.
- Types: `BattingStat`, `BowlingStat`, `Player`, `Series`, `Team`, `Match` from `@/lib/types`.

## Notes / decisions
- Cricket palette only (emerald/red/amber, slate neutrals — NO indigo/blue brand colors).
- Custom scrollbar styling applied to the squad list in `team-detail-view.tsx` via `[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border`.
- `FormatPill` doesn't accept `className` — replaced usages on gradient banners with a manual `<span>` that mirrors the pill's size/typography but renders white-on-transparent.
- Replaced the non-existent `lucide-react` `BowlingBall` icon with the valid `Disc` icon (verified via `node -e "const L=require('lucide-react'); console.log('BowlingBall' in L, 'Disc' in L)"` → false / true).
- Player detail charts: one batting BarChart (Runs/100s/50s/4s/6s) and, when bowler stats exist, one bowling BarChart (Wickets/Maidens), both wrapped in Card with `ResponsiveContainer`.
- Stats `Rankings` tab uses a per-format weight (Test ×1.0, ODI ×0.85, T20I ×0.55) on the same aggregate runs/wickets to produce plausible mock differentiation across the 3 format columns; the displayed value is the raw stat.
- Records tab: Most Runs, Most Wickets, Highest Individual Score (parses numeric part of `highest`), Best Bowling (parses `X/Y`, sorts by wickets desc then runs asc).
- Team Performance chart aggregates player batting runs per team and labels x-axis with `shortName`.
- `stats-view.tsx`: replaced `Record<string, number>` with `{ [key: string]: number }` because TS was throwing "Type 'Record' is not generic" (likely a recharts import shadowing the global `Record` utility type) — the indexed-access syntax avoids the collision cleanly.

## Lint / type-check status
- `bunx eslint src/components/site/views/` → clean (no errors/warnings in any of the 7 files).
- `bunx tsc --noEmit -p tsconfig.json` → no errors in the 7 view files.
- The remaining `bun run lint` errors are all in foundation files (`src/lib/serialize.ts` empty-object-type, `src/lib/use-data.ts` unused eslint-disable) and are OUTSIDE my task scope.

## Integration with page.tsx
All 7 components are already imported by `src/app/page.tsx` (added by orchestrator in Task 1) and resolve correctly. The only remaining `dev.log` "Module not found" entries are for the still-pending admin views (`@/components/admin/views/*`) which belong to other agents.
