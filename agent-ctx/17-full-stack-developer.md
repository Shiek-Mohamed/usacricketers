# Task 17 — Add article-to-league multi-select in the CMS article form

**Agent**: full-stack-developer
**Task ID**: 17
**Date**: 2026-10-30
**Status**: ✅ Complete

## Context

Continuation of Task 16, which added the `ArticleSeries` join table to the
Prisma schema (so an article can be associated with one or more leagues /
Series for display on the `/league/<slug>` public homepage). Task 17 wires
that join table into the **CMS article editor** so the admin can pick which
leagues an article belongs to directly from the article form — no manual SQL.

You can see the prior context (schema, slug helpers, league homepage data
fetchers) in `agent-ctx/16-full-stack-developer.md`.

## What was built

### Step 1 — `seriesIds` added to the `Article` type (`src/lib/types.ts`)

Added `seriesIds: string[]` to the `Article` interface (with a doc comment
explaining it's populated by the API routes from the `ArticleSeries` join
table, not stored on the `Article` row itself).

### Step 2 — `serializeArticle` accepts `seriesIds` (`src/lib/serialize.ts`)

Changed the signature from `serializeArticle(a)` to
`serializeArticle(a, seriesIds?: string[])`. The new field defaults to `[]`
so existing call sites that don't care about the association (e.g. the search
endpoint) keep working unchanged. API routes that *do* care pass the
`articleSeries` rows in.

### Step 3 — Article API routes

Shared a typed include constant in both files so the join rows always come
alongside the article:

```ts
const ARTICLE_INCLUDE_SERIES = {
  articleSeries: { select: { seriesId: true } },
} as const satisfies Prisma.ArticleInclude
```

**`src/app/api/articles/route.ts`**:
- **GET list**: `db.article.findMany(..., { include: ARTICLE_INCLUDE_SERIES })`
  and maps each row with `serializeArticle(a, seriesIdsFrom(a))` where
  `seriesIdsFrom(a) = a.articleSeries.map(row => row.seriesId)`. Same for the
  single-article-by-slug branch (`?slug=…`) so the public article-detail page
  gets the same response shape.
- **POST create**: parses `seriesIds` from the body via `coerceSeriesIds`
  (de-dupes + filters non-strings), then runs `db.$transaction` —
  `article.create` followed by `articleSeries.createMany` for the selected
  series IDs, then re-fetches the article with the include so the response
  carries the freshly-created associations.

**`src/app/api/articles/[id]/route.ts`**:
- **GET single**: `findUnique({ where: { id }, include: ARTICLE_INCLUDE_SERIES })`
  → `serializeArticle(article, seriesIdsFrom(article))`.
- **PUT update**: `db.$transaction` — `article.update`, then a **diff-and-sync**
  of the associations (only when `body.seriesIds !== undefined`, so partial
  PATCHes that omit the field don't wipe existing associations):
  1. `articleSeries.findMany({ where: { articleId } })` → existing set
  2. `toDelete = existing − new`
  3. `toCreate = new − existing`
  4. `deleteMany({ where: { articleId, seriesId: { in: toDelete } } })`
  5. `createMany({ data: toCreate.map(...) })`

  This avoids both the conditional-spread type pitfall and the missing
  `skipDuplicates` option (see "Issues" below).

### Step 4 — Admin article form (`src/components/admin/views/articles-view.tsx`)

- Added `seriesIds: string[]` to `ArticleFormState`.
- `emptyForm()` returns `seriesIds: []`.
- `openEdit(a)` populates `seriesIds: a.seriesIds?.length ? [...a.seriesIds] : []`
  (the API now returns it).
- Added `const { data: allSeries } = useSeries()` (the existing hook from
  `@/lib/use-data`) so the form has the full league list.
- Inserted a **"Leagues"** section in the form, **after the Tags/Published-At
  grid and before the Image URL field**. It mirrors the existing Categories
  checkbox pattern exactly:
  - bordered `bg-card` container
  - `flex flex-wrap gap-2` of `<label>` chips, each with a `Checkbox` + the
    series name
  - selected chips get `border-primary bg-primary/10 text-primary`
  - unselected chips get `text-muted-foreground hover:bg-accent`
  - toggling updates `form.seriesIds` (filter-out on uncheck, push on check)
- The container is capped at `max-h-48 overflow-y-auto` with the same custom
  scrollbar styling used elsewhere in the admin (`[&::-webkit-scrollbar]…`)
  so a long league list stays scrollable instead of pushing the dialog.
- Empty state: "No leagues available. Create a Series first…" when
  `allSeries` is empty.
- Helper line below: "N leagues selected." when ≥1 is checked.
- `handleSubmit` already spreads `...form` into the POST/PUT payload, so
  `seriesIds` rides along automatically — no extra wiring needed.

### Step 5 — Verification

**Lint**: `bun run lint` → exit 0 (no errors, no warnings).

**Type-check**: `bunx tsc --noEmit` → no errors in any of the modified files
(see "Issues" for the two type errors caught + fixed during dev).

**Runtime sync logic** (exercised the exact transaction code from the route
handlers against the live SQLite DB via a throwaway script — script deleted
afterwards, not committed):

| step | `seriesIds` sent | DB associations after | expected |
| ---- | ---------------- | --------------------- | -------- |
| POST create | `[A]` | `[A]` | ✓ |
| GET single | — | returns `[A]` | ✓ |
| PUT add B | `[A, B]` | `[A, B]` (A preserved, B added) | ✓ |
| PUT remove A | `[B]` | `[B]` (A deleted, B preserved) | ✓ |
| PUT clear | `[]` | `[]` | ✓ |
| DELETE article | — | 0 (cascade) | ✓ |

**League homepage loop**: created a published article, associated it with the
Arizona Premier Cricket League via an `ArticleSeries` row, called
`getLeagueArticles(league.id)` → the article appeared at the top of the
results (most recent `publishedAt`). After deleting the article (cascade
removes the join row), the count returned to baseline. This confirms step 6
of the spec — the article will render in the league homepage's hero/news
section once associated.

## Files modified

| Path | Change |
| ---- | ------ |
| `src/lib/types.ts` | added `seriesIds: string[]` to `Article` interface |
| `src/lib/serialize.ts` | `serializeArticle` accepts optional `seriesIds` param, includes it in output (defaults to `[]`) |
| `src/app/api/articles/route.ts` | GET list + slug lookup include `articleSeries` + map to `seriesIds`; POST create accepts `seriesIds` and syncs in a transaction |
| `src/app/api/articles/[id]/route.ts` | GET single includes `articleSeries`; PUT update accepts `seriesIds` and does diff-and-sync in a transaction |
| `src/app/api/search/route.ts` | `articles.map(serializeArticle)` → `articles.map((a) => serializeArticle(a))` (callback arity changed) |
| `src/components/admin/views/articles-view.tsx` | added `seriesIds` to form state + empty/edit init; added "Leagues" checkbox section using `useSeries()` |

## Lint output

```
$ bun run lint
$ eslint .
EXIT: 0
```

## Issues encountered

1. **`skipDuplicates: true` rejected by Prisma's generated types.** The
   initial POST/PUT code used `articleSeries.createMany({ data, skipDuplicates: true })`.
   `bunx tsc --noEmit` flagged it with `Type 'true' is not assignable to type
   'never'` — turns out this Prisma version's `ArticleSeriesCreateManyArgs`
   only exposes `data` (no `skipDuplicates`). Replaced with a **proper
   diff-and-sync** in PUT (fetch existing → compute `toDelete`/`toCreate` →
   deleteMany with `seriesId: { in: toDelete }` + createMany for `toCreate`
   only). POST doesn't need it at all (the article is brand-new, so no
   existing associations to clash with). This is also more efficient: no
   wasted insert-then-ignore attempts.

2. **Conditional spread + Prisma exact types.** An earlier draft of the PUT
   deleteMany used
   `where: { articleId: id, ...(seriesIds.length > 0 ? { seriesId: { notIn: seriesIds } } : {}) }`.
   The conditional-spread union interacted badly with Prisma's exact `where`
   types and produced a downstream `never` cascade. Rewrote as an explicit
   `Prisma.ArticleSeriesWhereInput` built imperatively (`deleteMany({ where:
   { articleId, seriesId: { in: toDelete } } })`) — cleaner and type-clean.

3. **`articles.map(serializeArticle)` arity break.** Adding the optional
   `seriesIds` param to `serializeArticle` changed its signature from
   `(a) => Article` to `(a, seriesIds?) => Article`. `Array.prototype.map`
   calls the callback with `(value, index, array)`, so the `index: number`
   got passed as `seriesIds` → `tsc` error `Type 'number' is not assignable
   to 'string[]'` in `src/app/api/search/route.ts`. Fixed by wrapping the
   callback: `articles.map((a) => serializeArticle(a))`.

4. **Dev server was not running** during verification (the system-managed
   `next dev` had exited and hadn't been restarted). Per the project rules I
   did not start it myself. Instead I verified the runtime behavior by
   executing the exact Prisma transaction logic from the route handlers
   against the live SQLite database via a one-off `bun -e` script, plus
   called `getLeagueArticles()` directly to confirm the league-page loop.
   Lint + tsc cover the compile-time correctness; the script run covers the
   data-layer correctness. The admin UI checkbox list itself is plain JSX
   rendered from `useSeries()` output and is covered by the type-checker +
   the existing Categories checkbox pattern it mirrors.
