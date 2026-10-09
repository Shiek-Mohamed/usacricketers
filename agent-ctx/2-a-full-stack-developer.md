# Work Record — Task 2-a

**Agent:** full-stack-developer (public cluster 1)
**Task:** Build 6 public-site view components (home, matches, match-detail, news, article-detail, schedule)
**Date:** 2025

## Files Created

All under `/home/z/my-project/src/components/site/views/`:

1. `home-view.tsx` — `export function HomeView()`
2. `matches-view.tsx` — `export function MatchesView()`
3. `match-detail-view.tsx` — `export function MatchDetailView()`
4. `news-view.tsx` — `export function NewsView()`
5. `article-detail-view.tsx` — `export function ArticleDetailView()`
6. `schedule-view.tsx` — `export function ScheduleView()`

## Implementation Notes

- All files start with `"use client"` and use named exports.
- Use the foundation contracts from `worklog.md` exactly: `useAppStore`, `useMatches/useMatch/useArticles/useArticle`, `TeamBadge/StatusPill/FormatPill/formatMatchDate/formatMatchTime`, `MiniScorecard`, `ArticleCard`, `ScorecardView`, `cn`.
- Cricket palette: red accent bars + dark slate primary, emerald result banners, amber "to be announced" callouts. No indigo/blue brand color.
- `match.scorecard.innings` is already deserialized to a `Scorecard | null` object — used directly without JSON.parse.
- ReactMarkdown (in package.json) used for article content with custom element renderers (headings, blockquote border-primary, table border-collapse, lists, code blocks). No tailwind typography plugin.
- Loading: `Skeleton` from `@/components/ui/skeleton`. Errors: `Alert` destructive variant.
- `SectionTitle` inline helper in home-view: red accent bar + uppercase text + optional "View all →" Button.
- `ScheduleView` groups by YYYY-MM with sticky month headers offset `top-14` (under sticky 14-unit header).

## Lint Status

- Ran `bun run lint` — all 6 of my files pass cleanly (verified by `npx eslint` on just the 6 files).
- Fixed 2 self-introduced issues during dev:
  - Removed unused `eslint-disable @next/next/no-img-element` directive in article-detail-view.
  - Restructured `useMemo` for `readTime` to use stable `content` variable (was `[data?.content]`) to satisfy React Compiler `preserve-manual-memoization`.
- Remaining pre-existing errors are in foundation files outside this task scope:
  - `src/lib/serialize.ts` — `{}` types (`@typescript-eslint/no-empty-object-type`)
  - `src/lib/use-data.ts` — unused eslint-disable directive (warning only)

## Notes for Following Agents

- `Match.scorecard.innings` is an `Innings[]` with `teamId` matching `match.team1Id`/`match.team2Id`. Use `.filter((i) => i.teamId === match.team1Id)` to get a team's innings.
- `ArticleCard` variants: `default`, `featured`, `compact`, `horizontal` — already exist, just import.
- `MiniScorecard` is itself clickable and calls `navigate("match-detail", match.id)` internally — for grids just render `<MiniScorecard match={m} />`.
- For detail views, read `id` from `useAppStore((s) => s.id)` and call `useMatch(id)` / `useArticle(id)`.
- Section header pattern (used in home-view and others): a `span.h-5.w-1.rounded-full.bg-red-600` + bold uppercase `h2` — reusable for any future list view.
