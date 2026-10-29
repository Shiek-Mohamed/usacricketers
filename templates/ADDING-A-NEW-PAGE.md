# Adding a New Page / Category to the Site

This is a reference guide. Pick the scenario that matches what you're trying to add, follow the steps, and verify at the end. **Nothing in this guide is wired into the actual site — these are templates and instructions only.**

---

## Pick your scenario

| Scenario | What it is | Example | Effort | Files touched |
|---|---|---|---|---|
| **A — Static page** | One-off content page, no data, no API, no admin | About, Contact, Privacy Policy, Terms | ~30 min | 4 files |
| **B — Filter view on existing data** | New view that re-uses existing Prisma models + APIs | "Featured Videos", "Live Matches", "Upcoming Tests" | ~1-2 hrs | 5 files |
| **C — Full new content entity** | Brand-new data type with its own model + API + admin CRUD | Podcasts, Tournaments, Coaches, Grounds, Sponsors | ~4-6 hrs | 10-15 files |

If unsure, start with Scenario A. If you outgrow it (e.g., you need admin-managed content), upgrade to B or C later.

---

## Universal pattern (applies to all 3 scenarios)

No matter what you add, you'll touch these 4 places:

| Step | File | What to add |
|---|---|---|
| 1 | `src/lib/types.ts` (line ~182) | Add the new view name to the `ViewKey` union |
| 2 | `src/components/site/views/<name>-view.tsx` (new file) | The view component — wrap in `<InnerPageLayout>` per the standard sidebar pattern from Task 6 |
| 3 | `src/app/page.tsx` (the `renderView()` switch around line 62) | `case "<name>": return <<Name>View />` |
| 4 | `src/components/site/header.tsx` (line ~37, the `navItems` array) | `{ label: "<Name>", view: "<name>", icon: <LucideIcon> }` |

Everything else (Prisma model, API, admin CRUD, seed data) only applies to Scenario C.

---

## Scenario A — Simple Static Page

**Use when**: the page has fixed content you write once (About, Contact, Privacy, Terms). No admin editing needed.

### Step 1: Add the view key

Edit `src/lib/types.ts` around line 182. Find the `ViewKey` union and add your new view name (kebab-case):

```typescript
export type ViewKey =
  | "home"
  | "matches"
  | ...
  | "about"   // ← add this
```

### Step 2: Create the view component

Create `src/components/site/views/about-view.tsx`:

```typescript
"use client"

import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { NewsletterWidget } from "@/components/site/sidebar-widgets"

/**
 * AboutView — static About page.
 *
 * Replace the body content with your actual about-page text.
 * The sidebar composition matches every other content view (see Task 6
 * in worklog.md) — RecentResultsWidget + CustomSidebarBlocks + NewsletterWidget.
 *
 * For a static page, drop the RecentResultsWidget (it shows cricket match
 * results which don't belong on an About page).
 */
export function AboutView() {
  return (
    <InnerPageLayout
      header={
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            About Us
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The official home of American cricket.
          </p>
        </div>
      }
      sidebar={
        <>
          <NewsletterWidget />
          <CustomSidebarBlocks placement="about" />
        </>
      }
    >
      <div className="prose prose-slate max-w-none space-y-4 dark:prose-invert">
        <p>
          Welcome to USACricketers — your source for American cricket coverage.
        </p>

        <h2>Our Mission</h2>
        <p>
          We cover cricket across the United States — from grassroots
          recreational leagues to the national team and Major League Cricket.
        </p>

        <h2>Contact</h2>
        <p>
          Email: <a href="mailto:info@usacricketers.com">info@usacricketers.com</a>
        </p>
      </div>
    </InnerPageLayout>
  )
}
```

### Step 3: Add to page.tsx router

Edit `src/app/page.tsx`:

```typescript
// Top of file (with the other view imports, around line 35):
import { AboutView } from "@/components/site/views/about-view"

// In the renderView() switch (around line 65, after the other cases):
case "about":
  return <AboutView />
```

### Step 4: Add the nav link

Edit `src/components/site/header.tsx`:

```typescript
// Top of file — add the icon to the lucide-react import:
import { Home, Activity, Trophy, Newspaper, Info } from "lucide-react"
//                                                          ^^^^ add Info

// Around line 37 — add to the navItems array:
const navItems: { label: string; view: ViewKey; icon: React.ElementType }[] = [
  { label: "Home", view: "home", icon: Home },
  { label: "Live", view: "matches", icon: Activity },
  { label: "Series", view: "series", icon: Trophy },
  // ... existing items ...
  { label: "About", view: "about", icon: Info },  // ← add this
]
```

### Step 5: Verify

```bash
# Lint
bun run lint

# Dev server auto-reloads — open in browser
# Navigate to / → click "About" in the header
# You should see your new About page
```

### Variations on Scenario A

- **Privacy Policy page**: same pattern, replace `about` with `privacy`, use a `Shield` icon
- **Contact page**: same pattern, optionally add a contact form (use shadcn `Form` + `Input` + `Textarea` + a server action to send email)
- **Multiple static pages**: each gets its own view file + its own case in page.tsx + its own entry in navItems

---

## Scenario B — Filter View on Existing Data

**Use when**: you want a new way to display data that already exists (e.g., a "Featured Videos" page that filters the `Video` table by `featured: true`).

### Step 1: Add the view key

```typescript
// src/lib/types.ts — add to ViewKey union:
| "featured-videos"
```

### Step 2: Create the view component

Create `src/components/site/views/featured-videos-view.tsx`:

```typescript
"use client"

import { useVideos } from "@/lib/use-data"
import { VideoCard } from "@/components/site/views/videos-view"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { NewsletterWidget } from "@/components/site/sidebar-widgets"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { Film } from "lucide-react"

/**
 * FeaturedVideosView — curated list of featured videos.
 * Reuses the existing useVideos() hook with { featured: true } filter —
 * no new API route, no new Prisma model needed.
 */
export function FeaturedVideosView() {
  const { data, loading } = useVideos({ featured: true })

  return (
    <InnerPageLayout
      header={
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Film className="h-6 w-6 text-red-600" aria-hidden="true" />
            Featured Videos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hand-picked highlights and interviews from USA cricket.
          </p>
        </div>
      }
      sidebar={
        <>
          <NewsletterWidget />
          <CustomSidebarBlocks placement="video" />
        </>
      }
    >
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-lg" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <Card className="grid min-h-[200px] place-items-center p-6">
          <p className="text-sm text-muted-foreground">
            No featured videos yet. Check back soon.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data ?? []).map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </InnerPageLayout>
  )
}
```

### Step 3: Add to page.tsx + nav (same as Scenario A, steps 3-4)

```typescript
// src/app/page.tsx:
import { FeaturedVideosView } from "@/components/site/views/featured-videos-view"

case "featured-videos":
  return <FeaturedVideosView />
```

```typescript
// src/components/site/header.tsx:
{ label: "Featured", view: "featured-videos", icon: Film },
```

### Reusable hooks available (no need to write new ones)

Look in `src/lib/use-data.ts` for the full list. The most common ones:

| Hook | Filter params | Use case |
|---|---|---|
| `useMatches()` | `{ status?, seriesId?, teamId? }` | filter matches |
| `useArticles()` | `{ category?, slug?, featured? }` | filter articles |
| `useVideos()` | `{ category?, featured? }` | filter videos |
| `useTeams()` | — | list teams |
| `usePlayers(teamId?)` | optional team filter | list players |
| `useSeries()` | — | list series |
| `useGalleries()` | — | list photo galleries |

### What you DON'T need for Scenario B

- ❌ No new Prisma model — reuse `Match`, `Article`, `Video`, etc.
- ❌ No new API route — reuse the existing hooks above
- ❌ No admin CRUD — admin already manages the underlying entities

---

## Scenario C — Full New Content Entity

**Use when**: you need a brand-new content type with its own database table, admin CRUD, and views. Example: "Podcasts".

This is a 10-15 file change. The fastest path is to find an existing similar entity (Videos is the closest template for any media-like content) and copy-rename.

### Step 1: Add the Prisma model

Edit `prisma/schema.prisma`. Find an existing similar model (e.g., `Video`) and copy-paste, renaming to your new entity:

```prisma
model Podcast {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  description String   @default("")
  audioUrl    String   // direct file URL or Spotify/Apple embed URL
  duration    String   @default("") // display string e.g. "45:32"
  category    String   @default("Interview") // Interview, Analysis, Highlights
  author      String   @default("USA Cricketers")
  tags        String   @default("")
  featured    Boolean  @default(false)
  published   Boolean  @default(true)
  publishedAt DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([published, publishedAt])
  @@index([category, publishedAt])
  @@index([featured, publishedAt])
}
```

### Step 2: Push the schema

```bash
bun run db:push
```

This creates the new table in SQLite without touching existing data.

### Step 3: Add the TypeScript type

Edit `src/lib/types.ts`. Find an existing similar interface (e.g., `Video`) and copy-paste, renaming:

```typescript
export interface Podcast {
  id: string
  title: string
  slug: string
  description: string
  audioUrl: string
  duration: string
  category: string
  author: string
  tags: string
  featured: boolean
  published: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
}
```

Also add the new view names to the `ViewKey` union (same as Scenario A):

```typescript
| "podcasts"
| "podcast-detail"
| "admin-podcasts"
```

### Step 4: Add the serialize helper

Edit `src/lib/serialize.ts`. Copy the `serializeVideo()` function and rename:

```typescript
import type { Podcast as PrismaPodcast } from "@prisma/client"
import type { Podcast } from "@/lib/types"

export function serializePodcast(p: PrismaPodcast): Podcast {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    audioUrl: p.audioUrl,
    duration: p.duration,
    category: p.category,
    author: p.author,
    tags: p.tags,
    featured: p.featured,
    published: p.published,
    publishedAt: p.publishedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}
```

### Step 5: Add the API routes

Create `src/app/api/podcasts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializePodcast } from "@/lib/serialize"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const featured = searchParams.get("featured") === "true"

  const where: { published?: boolean; category?: string; featured?: boolean } = {
    published: true,
  }
  if (category) where.category = category
  if (featured) where.featured = true

  const podcasts = await db.podcast.findMany({
    where,
    orderBy: { publishedAt: "desc" },
  })

  return NextResponse.json(podcasts.map(serializePodcast))
}

export async function POST(req: NextRequest) {
  // Admin-only — copy the admin guard pattern from src/app/api/videos/route.ts
  // ... (see videos/route.ts for the full admin-guard pattern)
}
```

Create `src/app/api/podcasts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializePodcast } from "@/lib/serialize"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const podcast = await db.podcast.findUnique({ where: { id } })
  if (!podcast) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(serializePodcast(podcast))
}

// Add PUT, DELETE following the same pattern as src/app/api/videos/[id]/route.ts
```

**Easiest approach**: literally copy `src/app/api/videos/` → `src/app/api/podcasts/` recursively, then find-replace `video` → `podcast` and `Video` → `Podcast`.

### Step 6: Add the api client methods

Edit `src/lib/api.ts`. Find the `videos` block and copy-paste, renaming:

```typescript
podcasts: {
  list: (params?: { category?: string; featured?: boolean }) =>
    fetcher<Podcast[]>("/api/podcasts" + (params ? "?" + new URLSearchParams(...).toString() : "")),
  get: (id: string) => fetcher<Podcast>(`/api/podcasts/${id}`),
  create: (data) => fetcher<Podcast>("/api/podcasts", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => fetcher<Podcast>(`/api/podcasts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => fetcher<void>(`/api/podcasts/${id}`, { method: "DELETE" }),
},
```

### Step 7: Add the data hooks

Edit `src/lib/use-data.ts`:

```typescript
export const usePodcasts = (params?: { category?: string; featured?: boolean }) =>
  useFetch<Podcast[]>(() => api.podcasts.list(params), [params?.category, params?.featured])

export const usePodcast = (id: string | null) =>
  useFetch<Podcast>(() => (id ? api.podcasts.get(id) : Promise.reject()), [id])
```

### Step 8: Create the public view components

Create `src/components/site/views/podcasts-view.tsx` (list view — copy from `videos-view.tsx` and rename):

```typescript
"use client"

import { useState } from "react"
import { usePodcasts } from "@/lib/use-data"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { NewsletterWidget } from "@/components/site/sidebar-widgets"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Podcast as PodcastIcon } from "lucide-react"
import { useAppStore } from "@/lib/store"

export function PodcastsView() {
  const { data, loading } = usePodcasts()
  const navigate = useAppStore((s) => s.navigate)

  return (
    <InnerPageLayout
      header={
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <PodcastIcon className="h-6 w-6 text-red-600" />
            Podcasts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cricket interviews, analysis, and highlights — listen on the go.
          </p>
        </div>
      }
      sidebar={
        <>
          <NewsletterWidget />
          <CustomSidebarBlocks placement="podcast" />
        </>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <Card className="grid min-h-[200px] place-items-center p-6">
          <p className="text-sm text-muted-foreground">No podcasts yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md transition-shadow p-4"
              onClick={() => navigate("podcast-detail", p.id)}
            >
              <div className="flex items-center gap-4">
                <PodcastIcon className="h-10 w-10 text-red-600 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{p.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {p.category} · {p.duration || "—"} · {p.author}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </InnerPageLayout>
  )
}
```

Create `src/components/site/views/podcast-detail-view.tsx` (detail view — copy from `video-detail-view.tsx` and rename, swap the iframe for an `<audio>` tag):

```typescript
"use client"

import { usePodcast, usePodcasts } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { RecentResultsWidget } from "@/components/site/sidebar-widgets"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, User } from "lucide-react"

export function PodcastDetailView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data: podcast, loading } = usePodcast(id)
  const { data: allPodcasts } = usePodcasts({ limit: 5 })
  const allMatches = useMatches()  // for the sidebar

  if (loading) return <Skeleton />
  if (!podcast) return <Card><p>Not found.</p></Card>

  return (
    <InnerPageLayout
      header={
        <Button variant="ghost" size="sm" onClick={() => navigate("podcasts")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Podcasts
        </Button>
      }
      sidebar={
        <>
          <RecentResultsWidget matches={allMatches.data ?? []} />
          <CustomSidebarBlocks placement="podcast" />
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Badge>{podcast.category}</Badge>
          <h1 className="text-2xl font-extrabold tracking-tight mt-2">
            {podcast.title}
          </h1>
          <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1"><User className="h-3 w-3" /> {podcast.author}</span>
            {podcast.duration && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {podcast.duration}</span>
            )}
          </div>
        </div>

        {/* Audio player — adjust the source per podcast host (direct file, Spotify embed, etc.) */}
        <audio controls className="w-full">
          <source src={podcast.audioUrl} />
          Your browser does not support the audio element.
        </audio>

        {podcast.description && (
          <p className="text-sm text-foreground/80 leading-relaxed">
            {podcast.description}
          </p>
        )}
      </div>
    </InnerPageLayout>
  )
}
```

### Step 9: Create the admin view

Create `src/components/admin/views/admin-podcasts-view.tsx` — copy from `src/components/admin/views/admin-videos-view.tsx` and rename. The admin shell expects a `AdminPodcastsView` component with CRUD list + edit form.

### Step 10: Wire it all into page.tsx + nav

Same as Scenario A, but add multiple cases:

```typescript
// src/app/page.tsx:
import { PodcastsView } from "@/components/site/views/podcasts-view"
import { PodcastDetailView } from "@/components/site/views/podcast-detail-view"
import { AdminPodcastsView } from "@/components/admin/views/admin-podcasts-view"

case "podcasts": return <PodcastsView />
case "podcast-detail": return <PodcastDetailView />
case "admin-podcasts": return <AdminPodcastsView />
```

```typescript
// src/components/site/header.tsx:
{ label: "Podcasts", view: "podcasts", icon: Podcast },
```

Add admin sidebar entry by editing `src/components/admin/admin-shell.tsx` (or wherever the admin nav config is — check the worklog for the exact file).

### Step 11: Add seed data (optional but recommended)

Edit `prisma/seed.ts`. Add 3-5 sample podcasts so the page isn't empty on first load.

### Step 12: Update the worklog

Append a new Task ID entry to `worklog.md` per the standard pattern — this is non-negotiable project convention.

### Shortcut for Scenario C

If the new entity is similar to an existing one (e.g., Podcasts ≈ Videos), do this:

```bash
# Bulk copy
cp -r src/app/api/videos src/app/api/podcasts
cp src/components/site/views/videos-view.tsx src/components/site/views/podcasts-view.tsx
cp src/components/site/views/video-detail-view.tsx src/components/site/views/podcast-detail-view.tsx
cp src/components/admin/views/admin-videos-view.tsx src/components/admin/views/admin-podcasts-view.tsx

# Find-replace (case-sensitive) across those copies:
#   video → podcast
#   Video → Podcast
#   VIDEO → PODCAST
```

Then edit `src/lib/api.ts`, `src/lib/use-data.ts`, `src/lib/serialize.ts`, `src/lib/types.ts`, `prisma/schema.prisma` manually. Cuts ~6 hours of work to ~2 hours.

---

## Verification checklist (do this for all 3 scenarios)

After you build the new page, verify:

- [ ] `bun run lint` exits 0 (zero errors/warnings)
- [ ] `tail -50 /home/z/my-project/dev.log` shows clean compiles, no runtime errors
- [ ] Open the dev server at `http://localhost:3000` (in the Preview Panel, not your local browser)
- [ ] Click the new nav link → page renders correctly
- [ ] Test on desktop AND mobile viewport (the InnerPageLayout should stack the sidebar below on mobile)
- [ ] Sticky footer is preserved (the footer should still stick to the bottom of the viewport on short pages)
- [ ] Click into any existing page → confirm nothing broke (the new view shouldn't have side effects on others)
- [ ] Append a Task ID entry to `worklog.md` per the standard pattern

## Common mistakes to avoid

| Mistake | Symptom | Fix |
|---|---|---|
| Forgot to add the ViewKey | TypeScript error: `Type '"about"' is not assignable to type 'ViewKey'` | Add it to `src/lib/types.ts` line 182 |
| Forgot to add the case to `page.tsx` renderView | Clicking the nav link renders a blank page or falls through to the default case | Add the `case "about": return <AboutView />` line |
| Forgot to add the icon to the lucide-react import in header.tsx | ESLint error: unused import / undefined variable | Add the icon name to the existing import statement |
| Used a blue/indigo color | VLM (and the user) flags it | Use red-600 for accents, slate for neutrals, emerald for "completed/won", amber for "today/upcoming" |
| Forgot to wrap in `InnerPageLayout` | New page runs edge-to-edge (looks inconsistent with other pages) | Wrap the body content in `<InnerPageLayout header={...} sidebar={...}>...</InnerPageLayout>` |
| Added per-card `setInterval` for any time-based display | Causes full-list re-renders, bad perf | Use a single parent-level `useEffect` + `setInterval` + `setTick` pattern (see `schedule-view.tsx` lines 113-120 for the template) |
| Forgot to run `bun run db:push` after editing the Prisma schema | API returns "table does not exist" errors | Run `bun run db:push` |
| Forgot to update `worklog.md` | Next agent/dev has no idea what changed | Append a Task ID entry per the standard pattern (see existing entries in `worklog.md` for format) |

## How to delegate to a subagent

If you want a subagent to do this work instead of doing it yourself, give it this kind of prompt:

> Build a new `<view-name>` page on this Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui cricket CMS. The view is `<Scenario A/B/C>`.
>
> Steps:
> 1. Add `<view-name>` to the `ViewKey` union in `src/lib/types.ts`
> 2. Create `src/components/site/views/<view-name>-view.tsx` — wrap in `<InnerPageLayout>` with appropriate sidebar widgets per the standard pattern (see `schedule-view.tsx` for the template)
> 3. Add the case to `page.tsx`'s `renderView()` switch
> 4. Add the nav link to `header.tsx`'s `navItems` array (around line 37)
> 5. [(if Scenario C) add Prisma model + serialize + API + admin + seed data — see the worklog for the `Video` entity as a template]
>
> Design constraints:
> - No indigo or blue as primary brand color
> - Mobile-first responsive
> - Sticky footer preserved (content-only changes; don't touch the root wrapper)
> - shadcn/ui components only (don't create new primitives)
> - TypeScript strict — must pass `bun run lint` cleanly
>
> Verify after: `bun run lint` exit 0, dev.log shows clean compiles, page renders in browser via agent-browser.
>
> Report back: files touched, lint output, any issues, worklog entry appended with Task ID N.

## Reference files (good templates to copy from)

| If you're building... | Copy from... |
|---|---|
| Static content page (About/Contact) | `src/components/site/views/article-detail-view.tsx` (minus the dynamic data parts) |
| List page with grid + search | `src/components/site/views/teams-view.tsx` |
| List page with tabs | `src/components/site/views/matches-view.tsx` |
| List page with month grouping | `src/components/site/views/schedule-view.tsx` |
| Detail page with related items | `src/components/site/views/video-detail-view.tsx` |
| Detail page with scorecard | `src/components/site/views/match-detail-view.tsx` |
| Admin CRUD list | `src/components/admin/views/admin-videos-view.tsx` |
| API list+create route | `src/app/api/videos/route.ts` |
| API get+update+delete route | `src/app/api/videos/[id]/route.ts` |
| Prisma model for media content | `prisma/schema.prisma` — search for `model Video` |
| Serialize helper | `src/lib/serialize.ts` — search for `serializeVideo` |
| Data hook | `src/lib/use-data.ts` — search for `useVideos` |
| API client methods | `src/lib/api.ts` — search for `videos:` |

## Final reminder

Every time you add a new page or feature, **append a Task ID entry to `worklog.md`**. This is the project's most important convention — without it, future agents (and your future self) have no idea what was built, why, or how to maintain it. The Task IDs in `worklog.md` are the source of truth for the project's history.

Format:
```markdown
---
Task ID: <next number>
Agent: orchestrator (Z.ai) [+ subagent if delegated]
Task: <one-line description>

Work Log:
- <what you did, file by file>

Stage Summary:
- <bullet-point summary of what's now live>
```
