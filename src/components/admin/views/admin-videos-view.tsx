"use client"

import { useRef, useState } from "react"
import { useVideos } from "@/lib/use-data"
import { api } from "@/lib/api"
import { extractYouTubeId } from "@/lib/youtube"
import { AdminShell } from "@/components/admin/admin-shell"
import { UploadButton } from "@/components/admin/upload-button"
import { videoThumbnailUrl } from "@/components/site/views/videos-view"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  Youtube,
  Upload,
  Loader2,
  Film,
  Play,
  Check,
  X,
  Image as ImageIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Video } from "@/lib/types"

const CATEGORIES = [
  "Highlights",
  "Interviews",
  "Analysis",
  "Features",
  "News",
] as const

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"

interface VideoFormState {
  title: string
  slug: string
  description: string
  source: "youtube" | "upload"
  videoUrl: string
  thumbnailUrl: string
  duration: string
  category: string
  author: string
  tags: string
  featured: boolean
  published: boolean
  publishedAt: string
}

function emptyForm(): VideoFormState {
  return {
    title: "",
    slug: "",
    description: "",
    source: "youtube",
    videoUrl: "",
    thumbnailUrl: "",
    duration: "",
    category: "Highlights",
    author: "USA Cricketers",
    tags: "",
    featured: false,
    published: true,
    publishedAt: new Date().toISOString().slice(0, 16),
  }
}

function slugify(t: string) {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
}

function toLocalInput(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 16)
  } catch {
    return new Date().toISOString().slice(0, 16)
  }
}

function toLocalDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

/* ------------------- Inline VideoUploadButton ------------------- */

/**
 * Inline component (no separate file). Posts a video file to
 * /api/upload-video using XMLHttpRequest so we get real upload
 * progress for large files (up to 500MB).
 */
function VideoUploadButton({
  onUploaded,
  className,
}: {
  onUploaded: (url: string) => void
  className?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  function handleUpload(file: File) {
    setUploading(true)
    setProgress(0)
    const fd = new FormData()
    fd.append("file", file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload-video")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      setUploading(false)
      try {
        const data = JSON.parse(xhr.responseText || "{}")
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          onUploaded(data.url)
          toast.success("Video uploaded", {
            description: `${(file.size / (1024 * 1024)).toFixed(1)} MB · ${file.type || "video"}`,
          })
        } else {
          toast.error(data.error || `Upload failed (HTTP ${xhr.status})`)
        }
      } catch {
        toast.error("Upload failed — bad response from server")
      }
      if (fileRef.current) fileRef.current.value = ""
    }
    xhr.onerror = () => {
      setUploading(false)
      toast.error("Upload failed — network error")
      if (fileRef.current) fileRef.current.value = ""
    }
    xhr.send(fd)
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {uploading ? `Uploading… ${progress}%` : "Upload video"}
      </Button>
      {uploading && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </>
  )
}

/* ----------------------- YouTube live preview ----------------------- */

function YouTubePreview({ url }: { url: string }) {
  const id = extractYouTubeId(url)
  if (!id) return null
  return (
    <div className="mt-2">
      <div className="aspect-[16/9] w-full overflow-hidden rounded-md border bg-muted">
        <img
          src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Video ID: <span className="font-mono">{id}</span> · thumbnail preview
        fetched live from YouTube.
      </p>
    </div>
  )
}

/* ----------------------- Thumbnail cell ----------------------- */

function ThumbCell({ video }: { video: Video }) {
  const thumb = videoThumbnailUrl(video)
  return (
    <div className="relative h-10 w-[72px] shrink-0 overflow-hidden rounded-md bg-muted">
      {thumb ? (
        <img src={thumb} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center bg-slate-800 text-slate-500">
          <Play className="h-3.5 w-3.5" />
        </div>
      )}
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white">
          <Play className="h-2.5 w-2.5 fill-white" />
        </span>
      </span>
    </div>
  )
}

/* ------------------------- The view itself ------------------------- */

export function AdminVideosView() {
  const { data, loading, refetch } = useVideos({ drafts: true })
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<VideoFormState>(emptyForm())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(v: Video) {
    setEditingId(v.id)
    setForm({
      title: v.title,
      slug: v.slug,
      description: v.description,
      source: v.source,
      videoUrl: v.source === "youtube" && v.youtubeId ? `https://www.youtube.com/watch?v=${v.youtubeId}` : v.videoUrl,
      thumbnailUrl: v.thumbnailUrl || "",
      duration: v.duration,
      category: v.category,
      author: v.author,
      tags: v.tags,
      featured: v.featured,
      published: v.published,
      publishedAt: toLocalInput(v.publishedAt),
    })
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!form.videoUrl.trim()) {
      toast.error(
        form.source === "youtube"
          ? "YouTube URL is required"
          : "Please upload a video file"
      )
      return
    }
    if (form.source === "youtube" && !extractYouTubeId(form.videoUrl)) {
      toast.error("Could not parse a YouTube video ID from that URL")
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug || slugify(form.title),
        description: form.description,
        source: form.source,
        // For YouTube, send the raw URL — backend extracts the ID.
        // For uploads, send the local /uploads/videos/... path.
        videoUrl: form.videoUrl,
        thumbnailUrl: form.thumbnailUrl,
        duration: form.duration,
        category: form.category,
        author: form.author,
        tags: form.tags,
        featured: form.featured,
        published: form.published,
        publishedAt: form.publishedAt
          ? new Date(form.publishedAt).toISOString()
          : new Date().toISOString(),
      }
      if (editingId) {
        await api.videos.update(editingId, payload)
        toast.success("Video updated")
      } else {
        await api.videos.create(payload)
        toast.success("Video created")
      }
      setOpen(false)
      refetch()
    } catch (e) {
      toast.error("Failed to save video", { description: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.videos.remove(id)
      toast.success("Video deleted")
      refetch()
    } catch (e) {
      toast.error("Failed to delete", { description: String(e) })
    }
    setDeleteId(null)
  }

  return (
    <AdminShell
      title="Videos"
      count={data?.length}
      actionLabel="+ New Video"
      onAction={openCreate}
    >
      <Card>
        <CardContent className="p-0">
          <div className={cn("max-h-[60vh] overflow-y-auto", SCROLLBAR)}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-[100px]">Thumbnail</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Published</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No videos published yet. Click “New Video” to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  (data ?? []).map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <ThumbCell video={v} />
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate font-medium">
                        {v.title}
                      </TableCell>
                      <TableCell>
                        {v.source === "youtube" ? (
                          <Badge className="gap-1 bg-red-600 text-white">
                            <Youtube className="h-3 w-3" /> YouTube
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Film className="h-3 w-3" /> Upload
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{v.category}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {v.published ? (
                          <Badge className="bg-emerald-600 text-white">
                            Live
                          </Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {toLocalDate(v.publishedAt)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(v)}
                          aria-label="Edit video"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(v.id)}
                          className="text-destructive"
                          aria-label="Delete video"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Video" : "New Video"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {/* Source — Tabs */}
            <div className="grid gap-1.5">
              <Label>Source</Label>
              <Tabs
                value={form.source}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    source: v as "youtube" | "upload",
                    // clear the URL when switching source to avoid confusion
                    videoUrl: "",
                  }))
                }
              >
                <TabsList className="w-full">
                  <TabsTrigger value="youtube" className="flex-1 gap-1.5">
                    <Youtube className="h-3.5 w-3.5" /> YouTube link
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1 gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Upload file
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Source-specific input */}
            {form.source === "youtube" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="youtube-url">YouTube URL</Label>
                <Input
                  id="youtube-url"
                  value={form.videoUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, videoUrl: e.target.value }))
                  }
                  placeholder="https://www.youtube.com/watch?v=… or youtu.be/… or bare ID"
                />
                <p className="text-[11px] text-muted-foreground">
                  Accepts watch URLs, youtu.be, /embed/, /shorts/, or the bare
                  11-char ID. The backend extracts the ID for you.
                </p>
                {form.videoUrl && <YouTubePreview url={form.videoUrl} />}
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="upload-video">Video file</Label>
                {form.videoUrl ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                    <Film className="h-4 w-4 text-emerald-600" />
                    <span className="flex-1 truncate font-mono text-xs">
                      {form.videoUrl}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() =>
                        setForm((f) => ({ ...f, videoUrl: "" }))
                      }
                      aria-label="Remove uploaded video"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <VideoUploadButton
                    onUploaded={(url) =>
                      setForm((f) => ({ ...f, videoUrl: url }))
                    }
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Uploaded videos can be large (up to 500MB). Progress is shown
                  in real time.
                </p>
              </div>
            )}

            {/* Title + Slug */}
            <div className="grid gap-1.5">
              <Label htmlFor="v-title">Title</Label>
              <Input
                id="v-title"
                value={form.title}
                onChange={(e) => {
                  const t = e.target.value
                  setForm((f) => ({
                    ...f,
                    title: t,
                    slug: editingId ? f.slug : slugify(t),
                  }))
                }}
                placeholder="e.g. India clinch Champions Trophy in thriller"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="v-slug">Slug</Label>
              <Input
                id="v-slug"
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }
                placeholder="auto-from-title"
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="v-desc">Description (Markdown supported)</Label>
              <Textarea
                id="v-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={4}
                placeholder="A short summary or full show-notes — Markdown is supported on the detail page."
              />
            </div>

            {/* Category + Author */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-author">Author</Label>
                <Input
                  id="v-author"
                  value={form.author}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, author: e.target.value }))
                  }
                  placeholder="e.g. USA Cricketers staff"
                />
              </div>
            </div>

            {/* Duration + Published At */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="v-duration">Duration (e.g. 5:32)</Label>
                <Input
                  id="v-duration"
                  value={form.duration}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration: e.target.value }))
                  }
                  placeholder="m:ss"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-publishedAt">Published At</Label>
                <Input
                  id="v-publishedAt"
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, publishedAt: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Tags */}
            <div className="grid gap-1.5">
              <Label htmlFor="v-tags">Tags (comma-separated)</Label>
              <Input
                id="v-tags"
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
                placeholder="india, odi, highlights"
              />
            </div>

            {/* Custom thumbnail */}
            <div className="grid gap-1.5">
              <Label>Custom thumbnail (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.thumbnailUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))
                  }
                  placeholder={
                    form.source === "youtube"
                      ? "Auto-uses YouTube thumbnail if blank"
                      : "Upload a poster image (otherwise the player shows none)"
                  }
                  className="flex-1"
                />
                <UploadButton
                  label="Upload"
                  onUploaded={(url) =>
                    setForm((f) => ({ ...f, thumbnailUrl: url }))
                  }
                />
              </div>
              {form.thumbnailUrl && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="aspect-[16/9] h-12 overflow-hidden rounded border bg-muted">
                    <img
                      src={form.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-destructive"
                    onClick={() =>
                      setForm((f) => ({ ...f, thumbnailUrl: "" }))
                    }
                  >
                    <X className="h-3 w-3" /> Remove
                  </Button>
                </div>
              )}
              {form.thumbnailUrl === "" && form.source === "youtube" && (
                <p className="text-[11px] text-muted-foreground">
                  <ImageIcon className="mr-0.5 inline h-3 w-3" />
                  Blank = the YouTube hqdefault thumbnail will be used.
                </p>
              )}
            </div>

            {/* Switches */}
            <div className="flex items-center gap-6 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Switch
                  checked={form.featured}
                  onCheckedChange={(c) =>
                    setForm((f) => ({ ...f, featured: c }))
                  }
                />
                Featured
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Switch
                  checked={form.published}
                  onCheckedChange={(c) =>
                    setForm((f) => ({ ...f, published: c }))
                  }
                />
                Published
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving
                ? "Saving…"
                : editingId
                  ? "Save Changes"
                  : "Create Video"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              The video record will be permanently removed. Any uploaded video
              files in <code className="rounded bg-muted px-1">/uploads/videos/</code>
              {" "}will remain on disk — only the database entry is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Live-count summary footer (matches articles-view style) */}
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : data && data.length > 0 ? (
          <>
            <Check className="h-3 w-3 text-emerald-600" />
            {data.length} published video{data.length !== 1 ? "s" : ""}.
          </>
        ) : (
          <>
            <X className="h-3 w-3 text-muted-foreground/40" />
            No published videos yet.
          </>
        )}
      </p>
    </AdminShell>
  )
}
