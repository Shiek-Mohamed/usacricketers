"use client"

import { useRef, useState } from "react"
import { useGalleries } from "@/lib/use-data"
import { api } from "@/lib/api"
import { AdminShell } from "@/components/admin/admin-shell"
import { UploadButton } from "@/components/admin/upload-button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Plus,
  Pencil,
  Trash2,
  Save,
  ArrowLeft,
  Images,
  Upload,
  Link as LinkIcon,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Gallery, PhotoItem } from "@/lib/types"

const LIBRARY_IMAGES = [
  "/cricket/hero-trophy.png",
  "/cricket/bumrah-bowling.png",
  "/cricket/border-gavaskar.png",
  "/cricket/travis-head.png",
  "/cricket/inline-stadium-crowd.png",
  "/cricket/inline-batsman-pull.png",
  "/cricket/inline-spin-bowler.png",
  "/cricket/inline-keeper-dive.png",
  "/cricket/inline-fielding-celebrate.png",
  "/cricket/inline-captain-trophy.png",
  "/cricket/inline-fast-bowler-roar.png",
  "/cricket/inline-nets-training.png",
]

const SCROLLBAR = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"

export function AdminGalleriesView() {
  const { data, loading, refetch } = useGalleries()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function openCreate() { setCreating(true); setEditingId(null) }
  function openEdit(id: string) { setEditingId(id); setCreating(false) }
  function closeEditor() { setEditingId(null); setCreating(false) }

  const editingGallery = data?.find((g) => g.id === editingId)

  if (creating || editingGallery) {
    return (
      <GalleryEditor
        gallery={editingGallery ?? null}
        onSave={async () => { await refetch(); closeEditor() }}
        onCancel={closeEditor}
      />
    )
  }

  return (
    <AdminShell title="Galleries" count={data?.length} actionLabel="+ New Gallery" onAction={openCreate}>
      <Card>
        <CardContent className="p-0">
          <div className={cn("max-h-[60vh] overflow-y-auto", SCROLLBAR)}>
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-center">Photos</TableHead>
                  <TableHead className="text-center">Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : (data ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No galleries yet. Click “New Gallery” to create one.</TableCell></TableRow>
                ) : (
                  (data ?? []).map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.title}</TableCell>
                      <TableCell className="text-center"><Badge variant="secondary" className="tabular-nums">{g.photos.length}</Badge></TableCell>
                      <TableCell className="text-center">{g.published ? "✓" : "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(g.id)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(g.id)} className="text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this gallery?</AlertDialogTitle><AlertDialogDescription>Photos won't be deleted from /uploads/ — only the gallery record is removed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={async () => { if (deleteId) { await api.galleries.remove(deleteId); toast.success("Gallery deleted"); refetch(); } setDeleteId(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  )
}

/* ---------------- Gallery Editor (full page) ---------------- */

function GalleryEditor({ gallery, onSave, onCancel }: { gallery: Gallery | null; onSave: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(gallery?.title ?? "")
  const [description, setDescription] = useState(gallery?.description ?? "")
  const [coverImage, setCoverImage] = useState(gallery?.coverImage ?? "")
  const [published, setPublished] = useState(gallery?.published ?? true)
  const [photos, setPhotos] = useState<PhotoItem[]>(gallery?.photos ?? [])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleBulkUpload(files: FileList) {
    setUploading(true)
    const newPhotos: PhotoItem[] = []
    for (const f of Array.from(files)) {
      try {
        const fd = new FormData(); fd.append("file", f)
        const res = await fetch("/api/upload", { method: "POST", body: fd })
        const data = await res.json()
        if (data.url) newPhotos.push({ src: data.url, caption: "" })
      } catch { /* skip failed */ }
    }
    setPhotos((p) => [...p, ...newPhotos])
    setUploading(false)
    if (newPhotos.length) toast.success(`Uploaded ${newPhotos.length} photo${newPhotos.length !== 1 ? "s" : ""}`)
    if (fileRef.current) fileRef.current.value = ""
  }

  function addFromLibrary(src: string) { setPhotos((p) => [...p, { src, caption: "" }]) }
  function addByUrl() { if (urlInput.trim()) { setPhotos((p) => [...p, { src: urlInput.trim(), caption: "" }]); setUrlInput(""); } }
  function updateCaption(idx: number, caption: string) { setPhotos((p) => p.map((ph, i) => i === idx ? { ...ph, caption } : ph)) }
  function removePhoto(idx: number) { setPhotos((p) => p.filter((_, i) => i !== idx)) }
  function movePhoto(idx: number, dir: -1 | 1) { setPhotos((p) => { const n = [...p]; const j = idx + dir; if (j < 0 || j >= n.length) return p; [n[idx], n[j]] = [n[j], n[idx]]; return n; }) }

  async function handleSave() {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true)
    try {
      const payload = { title, description, coverImage: coverImage || photos[0]?.src || "", photos: JSON.stringify(photos), published }
      if (gallery) { await api.galleries.update(gallery.id, payload); toast.success("Gallery updated") }
      else { await api.galleries.create(payload); toast.success("Gallery created") }
      onSave()
    } catch (e) { toast.error("Failed to save", { description: String(e) }) }
    finally { setSaving(false) }
  }

  return (
    <AdminShell title={gallery ? "Edit Gallery" : "New Gallery"} actionLabel={undefined} onAction={undefined}>
      <div className="space-y-5">
        <Button variant="ghost" size="sm" onClick={onCancel} className="-ml-2 gap-1"><ArrowLeft className="h-4 w-4" /> Back to galleries list</Button>

        {/* Gallery details */}
        <Card><CardContent className="grid gap-4 p-4 sm:p-6">
          <div className="grid gap-1.5">
            <Label htmlFor="g-title">Title</Label>
            <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. India v Australia: Adelaide Test in photos" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-desc">Description</Label>
            <Textarea id="g-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short summary of the gallery" />
          </div>
          <div className="grid gap-1.5">
            <Label>Cover image</Label>
            <div className="flex items-center gap-2">
              <Input value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="Auto-uses first photo if blank" className="flex-1" />
              <UploadButton label="Upload" onUploaded={setCoverImage} />
            </div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={published} onCheckedChange={setPublished} /><Label className="text-sm font-medium">Published</Label></div>
        </CardContent></Card>

        {/* Photo Manager */}
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Images className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold">Photos ({photos.length})</h2>
            </div>

            {/* Add-photo tools */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
              {/* Upload multiple */}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleBulkUpload(e.target.files)} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload photos
              </Button>
              {/* Add by URL */}
              <div className="flex items-center gap-1.5">
                <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Paste image URL…" className="h-9 w-52 text-sm" onKeyDown={(e) => e.key === "Enter" && addByUrl()} />
                <Button type="button" variant="outline" size="sm" onClick={addByUrl} className="gap-1.5"><LinkIcon className="h-3.5 w-3.5" /> Add</Button>
              </div>
            </div>

            {/* Library picker */}
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Or pick from the library:</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {LIBRARY_IMAGES.map((src) => (
                  <button key={src} type="button" onClick={() => addFromLibrary(src)} className="group relative aspect-square overflow-hidden rounded-md border hover:ring-2 hover:ring-emerald-500" title={src.replace("/cricket/", "").replace(".png", "")}>
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"><Plus className="h-5 w-5 text-white" /></div>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo list */}
            {photos.length > 0 ? (
              <div className={cn("space-y-2 max-h-[500px] overflow-y-auto rounded-lg border p-2", SCROLLBAR)}>
                {photos.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md border p-2">
                    <img src={p.src} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover" />
                    <Input value={p.caption} onChange={(e) => updateCaption(i, e.target.value)} placeholder="Caption (optional)" className="flex-1 text-sm" />
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePhoto(i, -1)} disabled={i === 0}><ChevronUp className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => movePhoto(i, 1)} disabled={i === photos.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePhoto(i)}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid place-items-center rounded-lg border border-dashed py-12 text-sm text-muted-foreground">
                No photos yet. Upload, paste a URL, or pick from the library above.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save / Cancel */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> {saving ? "Saving…" : gallery ? "Save Changes" : "Create Gallery"}</Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </AdminShell>
  )
}
