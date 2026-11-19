"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Images,
  ImageOff,
  Loader2,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/**
 * Shared media library browser.
 *
 * Talks to the backend with the same auth model as `UploadButton`:
 *   - league-admins pass `authToken` → `Authorization: Bearer <token>`
 *   - site-admins omit it → rely on the csrf-token cookie
 *     (GET needs no special header, POST sends `X-CSRF-Token`).
 *
 * Two exports:
 *   - `MediaBrowserDialog` — the bare Dialog (open state owned by caller)
 *   - `BrowseMediaButton`  — an outline Button trigger that manages its own
 *     open state and forwards `onSelect(url)` to the caller.
 */

interface UploadItem {
  name: string
  url: string
  size: number
  mtime: number
  source: "db" | "public"
}

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

function authHeadersForGet(authToken?: string | null): Record<string, string> {
  if (authToken) return { Authorization: `Bearer ${authToken}` }
  // site-admin cookie is sent automatically; GET needs no CSRF header.
  return {}
}

function authHeadersForPost(authToken?: string | null): Record<string, string> {
  if (authToken) return { Authorization: `Bearer ${authToken}` }
  const csrf =
    typeof document !== "undefined"
      ? document.cookie.match(/csrf-token=([^;]+)/)?.[1] || ""
      : ""
  return { "X-CSRF-Token": csrf }
}

export function MediaBrowserDialog({
  open,
  onOpenChange,
  onSelect,
  authToken,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string) => void
  authToken?: string | null
}) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/uploads", {
        headers: authHeadersForGet(authToken),
      })
      if (!res.ok) throw new Error(`Failed to load media (${res.status})`)
      const data = await res.json()
      setItems(Array.isArray(data?.items) ? (data.items as UploadItem[]) : [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [authToken])

  useEffect(() => {
    if (open) {
      // Reset the search each time the dialog is opened so the user starts
      // from a clean list rather than a stale filter.
      setQuery("")
      load()
    }
  }, [open, load])

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: authHeadersForPost(authToken),
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        toast.error(data.error || "Upload failed")
        return
      }
      toast.success("Photo uploaded")
      // Refetch so the new image lands at the top of the grid, then hand the
      // freshly-uploaded URL straight back to the caller so they can use it
      // immediately without an extra click.
      await load()
      onSelect(data.url as string)
      onOpenChange(false)
    } catch (e) {
      toast.error("Upload failed", { description: String(e) })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function pick(url: string) {
    onSelect(url)
    onOpenChange(false)
  }

  const q = query.trim().toLowerCase()
  const filtered = q ? items.filter((it) => it.name.toLowerCase().includes(q)) : items

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>
            Browse every previously uploaded image. Click a thumbnail to insert it.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
          }}
        />

        {/* Toolbar: live search + upload-new */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by filename…"
              className="h-9 pl-8 text-sm"
              aria-label="Search media by filename"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload new
          </Button>
        </div>

        {/* Grid + loading/error/empty states (never leaves a blank dialog) */}
        <div className={cn("max-h-[70vh] overflow-y-auto rounded-md", SCROLLBAR)}>
          {loading ? (
            <div className="grid grid-cols-3 gap-2 p-1 sm:grid-cols-4 md:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-md" />
              ))}
            </div>
          ) : error ? (
            <div className="grid place-items-center gap-2 py-12 text-center">
              <ImageOff className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={load}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="grid place-items-center gap-2 py-12 text-center">
              {q ? (
                <>
                  <ImageOff className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No images match &ldquo;{query.trim()}&rdquo;.
                  </p>
                </>
              ) : (
                <>
                  <Images className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No images yet. Upload one to get started.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="gap-1.5"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Upload an image
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-1 sm:grid-cols-4 md:grid-cols-6">
              {filtered.map((it) => (
                <button
                  key={it.url}
                  type="button"
                  onClick={() => pick(it.url)}
                  title={`${it.name} · ${formatBytes(it.size)}`}
                  aria-label={`Insert ${it.name}, ${formatBytes(it.size)}`}
                  className="group relative aspect-square overflow-hidden rounded-md border transition-shadow hover:ring-2 hover:ring-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                >
                  <img
                    src={it.url}
                    alt={it.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-black/0 to-black/0 p-1.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="truncate">{it.name}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function BrowseMediaButton({
  onSelect,
  authToken,
  label = "Browse",
  className,
}: {
  onSelect: (url: string) => void
  authToken?: string | null
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1.5", className)}
        onClick={() => setOpen(true)}
      >
        <Images className="h-3.5 w-3.5" />
        {label}
      </Button>
      <MediaBrowserDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={onSelect}
        authToken={authToken}
      />
    </>
  )
}
