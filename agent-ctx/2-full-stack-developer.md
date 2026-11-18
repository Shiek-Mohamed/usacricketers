# Task 2 — Media Library Browser (Frontend)

**Agent:** full-stack-developer (frontend only)
**Task ID:** 2
**Status:** Completed
**Date:** 2026-11-18

## Objective

Build a shared, reusable media-library browser for the cricket CMS admin
panel so editors can pick from **all** previously uploaded images instead of
just the hardcoded 12-image `LIBRARY_IMAGES` picker. Wire it into the gallery
editor (cover + photos), the article markdown editor (image insert), and
expose it through the existing `UploadButton` via a new optional `withBrowse`
prop.

Frontend only. No `src/app/api/**` or `src/lib/**` files were touched. The
backend agent (parallel task) is building `GET /api/uploads` and `POST /api/upload`
against the shared contract; this UI was coded against that exact shape.

## Files

### NEW: `src/components/admin/media-browser.tsx`

Two exports:

1. **`MediaBrowserDialog`** — a shadcn Dialog with a searchable thumbnail grid.
   Props: `{ open, onOpenChange, onSelect, authToken? }`.
   - On `open → true`, fetches `GET /api/uploads`. Auth: if `authToken`
     provided → `Authorization: Bearer <token>`; else site-admin cookie is
     relied upon (no special header for GET).
   - States: loading (12-cell Skeleton grid), error (message + Retry button),
     empty ("No images yet. Upload one to get started." + an Upload button),
     filtered-empty ("No images match "…"" with the query echoed).
   - Live search `<Input>` filters items by `name` (case-insensitive substring).
   - Responsive grid: `grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2`
     inside `max-h-[70vh] overflow-y-auto` with the project's custom
     `[&::-webkit-scrollbar]:w-1.5 …` scrollbar style.
   - Each cell is a real `<button>` (accessible, keyboard-focusable) wrapping
     `<img loading="lazy">` (aspect-square, object-cover, rounded-md, border).
     Hover: `ring-2 ring-emerald-500` + a gradient overlay revealing the
     filename. `title`/`aria-label` = `"{name} · {human-readable size}"`.
   - Clicking a thumbnail calls `onSelect(item.url)` then `onOpenChange(false)`.
   - "Upload new" outline button at top: hidden file input → POST `/api/upload`
     with the same auth logic as `UploadButton` (Bearer if `authToken`, else
     `X-CSRF-Token` from the `csrf-token` cookie). On success: toast, refetch
     the list, call `onSelect(url)`, close the dialog — so the user
     immediately picks what they just uploaded. Spinner while uploading.
   - Dialog title "Media library", size `sm:max-w-3xl`, content padding
     `p-4 sm:p-6`. Includes a `DialogDescription` for Radix a11y.

2. **`BrowseMediaButton`** — convenience trigger.
   Props: `{ onSelect, authToken?, label?="Browse", className? }`.
   Renders a shadcn `Button` (variant="outline", size="sm") with the `Images`
   lucide icon + label; toggles a `MediaBrowserDialog` and forwards the chosen
   url to `onSelect`.

### EDIT: `src/components/admin/views/admin-galleries-view.tsx`
- Imported `BrowseMediaButton` from `@/components/admin/media-browser`.
- **Cover-image row**: switched `<UploadButton onUploaded={setCoverImage} />`
  to `<UploadButton onUploaded={setCoverImage} withBrowse />` (the cleaner of
  the two allowed options) — renders Upload + Browse inline, no double browse
  button, browse `onSelect` reuses the same `setCoverImage` handler.
- **Photo-add tools row** (the `flex flex-wrap items-center gap-2` bar): added
  `<BrowseMediaButton onSelect={(url) => addFromLibrary(url)} label="Browse library" />`
  after the "Add by URL" group, so the editor can pick from ALL previously
  uploaded images, not just the hardcoded 12.
- All existing functionality (bulk upload, URL add, library picker, reorder,
  captions, save/delete) left intact.

### EDIT: `src/components/admin/markdown-editor.tsx`
- Imported `Images` from lucide-react and `MediaBrowserDialog` from
  `@/components/admin/media-browser`.
- Added a new toolbar button (ghost icon, `Images` icon, title
  "Browse media library") immediately after the existing "Insert photo"
  button and before the alignment-separator.
- Added `browseOpen` state + a `handleBrowseInsert(url)` handler that calls
  the **existing** `applyInsert(\`![image](${url})\\n\\n\`)` — reuses the
  same insert-at-caret mechanism (and the `useLayoutEffect` selection-restore)
  that uploaded images use, so no cursor logic was duplicated.
- Rendered `<MediaBrowserDialog open={browseOpen} onOpenChange={setBrowseOpen}
  onSelect={handleBrowseInsert} />` after the existing image-insert Dialog.
- No `authToken` passed → site-admin cookie path (the markdown editor already
  uses the CSRF cookie for its own uploads).
- Existing upload / library-tab / custom-URL insert flow unchanged.

### EDIT: `src/components/admin/upload-button.tsx`
- Added optional `withBrowse?: boolean` prop (default `false`).
- Imported `BrowseMediaButton`.
- When `withBrowse` is true, renders `<BrowseMediaButton onSelect={onUploaded}
  authToken={authToken} />` as a sibling of the Upload button inside the
  existing fragment — so the browse `onSelect` calls the same `onUploaded`
  callback callers already pass, and the parent's flex `gap` handles spacing.
- When `withBrowse` is false (the default), the rendered output is **byte-for-byte
  identical** to before (fragment: hidden `<input>` + `<Button>`). Verified the
  other 6 call sites (articles, teams, banners, videos, players,
  league-admin-players) are unaffected because none pass `withBrowse`.

## API contract used
```
GET  /api/uploads  → 200 { items: { name; url; size; mtime; source: "db"|"public" }[] }
POST /api/upload    → 200 { url }   // multipart field "file"; optional ?resize=N
```
Auth headers built by small local helpers (`authHeadersForGet` /
`authHeadersForPost`) that mirror `UploadButton`'s logic exactly.

## Lint
`bun run lint` → **0 errors, 0 warnings in my files**. The only 2 warnings
reported are pre-existing `Unused eslint-disable directive` notices in
`src/app/page.tsx` and `src/components/admin/views/live-scorer-view.tsx`
(files I did not touch).

## Constraints honoured
- TypeScript strict, `"use client"` on every component holding state.
- No `src/app/api/**` and no `src/lib/**` files created or edited.
- Only existing shadcn/ui primitives used (Dialog, Button, Input, Skeleton).
- No indigo/blue; hover ring is `ring-emerald-500` (matches gallery accent).
- Responsive grid collapses to 3 columns on mobile.
- Loading + error + empty states all implemented (never a blank dialog).
- Thumbnails are real `<button>`s with `title`/`aria-label`; Dialog primitives
  provide the accessible dialog chrome.
