# Task 1 — Backend: Upload POST + Uploads List GET

**Agent**: backend-developer
**Scope**: BACKEND ONLY. Created two new API route files. Touched zero frontend/component/lib files.

## Files created

1. `src/app/api/upload/route.ts` — `POST /api/upload` (multipart image upload)
2. `src/app/api/uploads/route.ts` — `GET /api/uploads` (admin media browser listing)

## API contract (matches shared spec exactly)

```
GET  /api/uploads  -> 200 { items: { name: string; url: string; size: number; mtime: number; source: "db"|"public" }[] }
POST /api/upload    -> 200 { url: string }      // field "file"; optional ?resize=N
```

Error shapes:
- `400 { error: "no file" }`
- `400 { error: "only images allowed" }`
- `401 { error: "unauthorized" }`
- `500 { error: "upload failed" }` (POST) / `500 { error: "listing failed" }` (GET)
- `429 { error: "Too many requests..." }` (GET, via rateLimit)

## File A — POST /api/upload

- `export const dynamic = "force-dynamic"` (matches other upload routes).
- **Dual auth**: `requireSiteAdmin(req)` first (cookie + CSRF on POST); if null, try `verifyLeagueAdminToken(readBearerToken(authHeader))`. 401 if neither.
- Reads `file` from `await req.formData()`. Rejects non-File/non-Blob entries with `400 { error: "no file" }`.
- Validates `file.type.startsWith("image/")` -> else `400 { error: "only images allowed" }`.
- `?resize=N`: parsed with `Number.parseInt`, must be finite + positive, clamped `min(1024, max(16, n))`. When set: `sharp(raw).resize(N, N, { fit: "cover", position: "centre" }).jpeg({ quality: 85 }).toBuffer()` and forced `.jpg` extension.
- When NOT resizing: original bytes written verbatim (`Buffer.from(await file.arrayBuffer())`), extension derived from MIME via `mimeToImageExt()` (`image/png`->.png, webp->.webp, gif->.gif, jpeg/jpg->.jpg, default .jpg). Animated GIFs preserved (no re-encode).
- Storage dir: `path.join(process.cwd(), "db", "uploads")`, `mkdir -p` (recursive) before write.
- Filename: `stripExt(originalName) + targetExt` -> `slugifyFilename(...)` -> `ensureUniqueFilename(slug, async (n) => existsSync(path.join(dir, n)))`. SEO-preserving -2/-3 collision suffix.
- Returns `200 { url: "/api/uploads/" + finalFilename }`.
- Wrapped in try/catch -> `500 { error: "upload failed" }`.

## File B — GET /api/uploads

- `export const dynamic = "force-dynamic"`.
- `rateLimit(req, { limit: 120, windowMs: 60_000 })` first (mirrors `/api/galleries`).
- **Dual auth** (same as File A). Note: for GET, `requireSiteAdmin` does NOT enforce CSRF (only POST/PUT/DELETE/PATCH), so a valid site-admin cookie alone passes.
- Reads BOTH `db/uploads/` and `public/uploads/` via `readdir({ withFileTypes: true })`. Missing dir (ENOENT) -> treated as empty (swallowed in catch).
- Per file: `stat()` for `size` + `mtimeMs`. Item: `{ name, url: "/api/uploads/"+name, size, mtime: mtimeMs, source }`.
- Image-ext filter only: `.png, .jpg, .jpeg, .webp, .gif, .svg` (case-insensitive via `.toLowerCase()`).
- Dedup by name: `db` wins (collected first into the Map; later `public` entries with same name are skipped via `out.has(name)` check). Matches serve route priority.
- Sorted by `mtime` DESC (newest first).
- `Cache-Control: no-store` set on the response (admin-only, never edge-cached).
- Returns `200 { items: MediaItem[] }`.
- Wrapped in try/catch -> `500 { error: "listing failed" }`.

## Decisions

1. **Extension source-of-truth**: On the preserve-format path, the extension is derived from `file.type` (MIME), NOT the original filename. So a PNG mislabeled `photo.jpg` is saved as `photo.png`. Achieved by stripping the original ext then appending the MIME-derived ext before slugifying. The resize path always forces `.jpg` regardless.
2. **Collision logic**: Reused `ensureUniqueFilename(slug, async (n) => existsSync(path.join(uploadDir, n)))` exactly as specified — sequential -2/-3 suffixes (SEO-preserving). The `existsSync` check is synchronous-wrapped in an async lambda to match the helper's `(name) => Promise<boolean>` signature.
3. **`File` instanceof check**: Used `!(entry instanceof File)` (the global web `File`), matching the existing `/api/voice-clip/route.ts` pattern (verified working in this codebase's Node runtime). Also guards `typeof entry === "string"` (form field instead of file).
4. **`sharp` import**: Default import `import sharp from "sharp"` — sharp 0.34.3 supports both default + named, default is the documented form.
5. **Dirent/Stats typing**: Imported `type { Dirent, Stats } from "fs"` for clean typing of `readdir({withFileTypes:true})` result and `stat()` return.
6. **GET 500 catch**: Returns `500 { error: "listing failed" }` (not the POST's "upload failed") so the two routes have distinct error signals.
7. **Symlinks**: `collectDir` accepts `entry.isFile() || entry.isSymbolicLink()` (a symlink to a file still serves). Matches serve-route behaviour which reads basenames regardless of type.
8. **Per-file stat race**: If a file vanishes between `readdir` and `stat`, the inner `catch` skips it rather than failing the whole listing.

## Lint result

`cd /home/z/my-project && bun run lint` -> **0 errors, 2 warnings**, BOTH in pre-existing files I did NOT touch:
- `src/app/page.tsx:117` — unused eslint-disable directive (react-hooks/exhaustive-deps)
- `src/components/admin/views/live-scorer-view.tsx:373` — unused eslint-disable directive (react-hooks/immutability)

My two new files: **0 errors, 0 warnings.**

## Files NOT touched (confirmed)

- Did NOT create/edit anything under `src/components/`.
- Did NOT create/edit anything under `src/lib/`.
- Did NOT touch `src/app/api/uploads/[name]/route.ts` (the existing serve route).
- Did NOT install any packages (sharp ^0.34.3 was already present).
- Did NOT run `bun run build`.

## Dev server status

Checked `/home/z/my-project/dev.log` — server running clean on port 3000, no compile errors related to the new routes. Routes are admin-gated so they will compile on first authenticated request.
