# Task 9 — full-stack-developer (video views)

## Files created
1. `src/components/site/views/videos-view.tsx` — `VideosView` named export + shared `VideoCard` + `videoThumbnailUrl` helper.
2. `src/components/site/views/video-detail-view.tsx` — `VideoDetailView` named export.
3. `src/components/admin/views/admin-videos-view.tsx` — `AdminVideosView` named export + inline `VideoUploadButton` + `YouTubePreview` + `ThumbCell`.

## What I built (concrete)

### `videos-view.tsx`
- Navy header band `bg-[#1e2a5e]` with `text-2xl sm:text-3xl font-extrabold uppercase` heading "Videos" (same navy as the Interviews section heading in `home-view.tsx`).
- 5 category pills: All / Highlights / Interviews / Analysis / Features — same style as `news-view.tsx` (rounded-full, primary-foreground when active, muted-foreground hover when not).
- Responsive grid: 1 col mobile → 2 col tablet (`sm:grid-cols-2`) → 4 col desktop (`lg:grid-cols-4`).
- `VideosSkeleton` for loading state with 8 aspect-[16/9] Skeleton cards.
- `Card` empty-state when no videos in category.
- `VideoCard` exported for reuse on the homepage Videos section.
- `videoThumbnailUrl(video)` helper exported for the admin thumbnail cell — picks `thumbnailUrl` → YouTube hqdefault → `""` (gray placeholder).

### `video-detail-view.tsx`
- Reads `id` from `useAppStore((s) => s.id)` and `navigate` from `useAppStore((s) => s.navigate)`.
- `useVideo(id)` for the main record; `useVideos({ limit: 5 })` for the related strip.
- Centered `max-w-4xl` layout.
- Back button: "← Videos" → `navigate("videos")`.
- Player (`VideoPlayer`): `<iframe>` for YouTube (`allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"`, `allowFullScreen`, 16:9, rounded, black bg); `<video controls poster=...>` for uploads.
- Title (`text-2xl font-extrabold sm:text-3xl`), category Badge, "View on YouTube" external-link pill for youtube source, author + date + duration meta row.
- `VideoMarkdown` component reuses the same ReactMarkdown + rehypeRaw element renderer set as `ArticleDetailView` (h1-h4, p, a, ul/ol/li, blockquote, hr, strong/em, code/pre, table/thead/th/td, img with figcaption).
- Tags as secondary Badges (parsed from comma-separated `video.tags`).
- `RelatedVideos` horizontal-scroll strip (260-280px cards, custom scrollbar) — excludes the current video, shows up to 4.
- `VideoDetailSkeleton` + not-found Alert (red `variant="destructive"`) with a "Video not found" title and a back-to-videos button.

### `admin-videos-view.tsx`
- Wrapped in `AdminShell` with `title="Videos"`, count Badge, `+ New Video` action button.
- Table columns: Thumbnail (72×40px 16:9 with mini play overlay) / Title (truncate) / Source (red YouTube Badge or secondary Upload Badge) / Category (outline Badge) / Published (Live/Draft Badge) / Date / Actions (edit + delete icon buttons).
- Loading rows = Skeleton placeholders. Empty-state row spans all 7 columns.
- Create/Edit Dialog: `Tabs` for source ("YouTube link" / "Upload file") — switching clears `videoUrl`. For YouTube: an Input for the raw URL with a live `YouTubePreview` (uses `extractYouTubeId` from `@/lib/youtube` and shows the `img.youtube.com/vi/{id}/hqdefault.jpg` thumbnail). For Upload: an inline `VideoUploadButton` component using XMLHttpRequest to report real progress percentage, plus a remove button after upload.
- All other fields: Title (required, auto-slug on create), Slug (editable), Description Textarea (markdown-supported), Category Select (Highlights/Interviews/Analysis/Features/News), Duration Input ("m:ss" placeholder), Author Input, Tags Input (comma-separated), Custom-thumbnail Input + UploadButton (image), Featured Switch, Published Switch, Published-at datetime-local.
- On save: validates title + videoUrl; for youtube also validates a parseable ID. Sends `{ ...form, videoUrl: <raw YouTube URL or local /uploads path>, publishedAt: ISO }`. Create → `api.videos.create`. Edit → `api.videos.update`. Both close the Dialog and `refetch()`.
- Delete via AlertDialog confirm — warns that `/uploads/videos/` files remain on disk (only the DB record is removed).
- Live-count summary footer (`Loader2` while loading, `Check` with count when done, `X` when empty).

## What I did NOT touch (per the instructions)
- `src/app/page.tsx` (router) — orchestrator wires `videos` / `video-detail` / `admin-videos` cases.
- `src/components/site/header.tsx`, `src/components/site/footer.tsx`, `src/components/site/views/home-view.tsx` — orchestrator wires the homepage Videos section.
- `src/components/admin/admin-shell.tsx` — the orchestrator adds the "Videos" nav item.

## Lint / type-check / smoke tests
- `bunx eslint <my 3 files>` → 0 errors, 0 warnings.
- `bun run lint` (full project) → 0 errors, 0 warnings.
- `bunx tsc --noEmit` → 0 errors in any of my 3 files (remaining repo-level tsc noise is in foundation files: `prisma/seed.ts`, `src/lib/scoring.ts`, `src/components/cricket/mini-scorecard.tsx`, `src/components/site/views/match-detail-view.tsx`, `src/components/admin/views/admin-galleries-view.tsx`, `src/components/admin/views/live-scorer-view.tsx`, `skills/*` — all out of my scope).
- Hit a runtime PrismaClient cache issue (the running dev server had `globalThis.prisma` cached from before the `Video` model was added — same issue Task 6 hit). Fixed by `bunx prisma generate` + restarting the dev server. After restart, all 7 CRUD smoke tests pass:
  - `GET /api/videos` → `[]` HTTP 200
  - `POST /api/videos` (youtube) → HTTP 200, backend extracted `dQw4w9WgXcQ`, transformed URL to embed form, derived thumbnail
  - `GET /api/videos/:id` → HTTP 200, full record
  - `PUT /api/videos/:id` → HTTP 200, only `title` and `featured` updated
  - `POST /api/videos` (upload) → HTTP 200, `videoUrl` stored as-is, `youtubeId=""`
  - `GET /api/videos` (list, ordered by publishedAt desc) → HTTP 200, 2 records
  - `DELETE /api/videos/:id` × 2 → `{ok:true}` HTTP 200
- Dev server now running on :3000 (PID 3600, started by my own restart), listening and serving requests cleanly.

## Known limitation (NOT a bug in my code)
The `/api/videos` GET endpoint only returns `published: true` records (per the orchestrator's Task 1-2 API design). This means the admin table will not list draft (unpublished) videos — only published ones. The "Published" Badge column is therefore always "Live" in the current admin table. If the orchestrator wants the admin to see drafts, they can extend the API to accept a `?drafts=true` query (similar to `useSidebarBlocks(placement, drafts)`) — my view's `useVideos()` call would just need a `drafts` param threaded through.

## Notes for the orchestrator
1. `VideoCard` is exported from `src/components/site/views/videos-view.tsx` — import it directly for the homepage Videos section. Signature: `({ video, onOpen }: { video: Video; onOpen: () => void })`.
2. `videoThumbnailUrl(video)` is also exported from the same file — useful anywhere you need to resolve the best thumbnail for a video.
3. `video-detail-view` uses `InnerPageLayout`? **No** — I used a centered `max-w-4xl` layout because the player + description flow more naturally as a single column for video content. The `InnerPageLayout` would push the description into a narrow 600px column, which is too narrow for a 16:9 video player. The 4xl-width centered layout gives the player + description proper room while still being readable on mobile.
4. The `video-detail` view's related-videos strip uses a horizontal scroll (`overflow-x-auto`) on mobile and desktop — 4 cards of 260-280px each.
