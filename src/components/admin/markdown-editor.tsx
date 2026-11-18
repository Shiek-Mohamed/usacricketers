"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Bold,
  Italic,
  Heading2,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Images,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { MediaBrowserDialog } from "@/components/admin/media-browser"

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
const CUSTOM = "__custom__"

interface PendingSel {
  start: number
  end: number
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 12,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingSel = useRef<PendingSel | null>(null)

  const [imgOpen, setImgOpen] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [tab, setTab] = useState<"library" | "upload">("library")
  const [libChoice, setLibChoice] = useState<string>(LIBRARY_IMAGES[0])
  const [customUrl, setCustomUrl] = useState("")
  const [uploadedUrl, setUploadedUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [imgCaption, setImgCaption] = useState("")

  // Restore textarea selection after a toolbar action updates the value.
  useLayoutEffect(() => {
    const ta = taRef.current
    const sel = pendingSel.current
    if (ta && sel) {
      ta.focus()
      ta.setSelectionRange(sel.start, sel.end)
      pendingSel.current = null
    }
  }, [value])

  function applyWrap(before: string, after: string, placeholder: string) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end) || placeholder
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end)
    pendingSel.current = {
      start: start + before.length,
      end: start + before.length + selected.length,
    }
    onChange(next)
  }

  function applyLinePrefix(prefix: string) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    pendingSel.current = { start: start + prefix.length, end: start + prefix.length }
    onChange(next)
  }

  function applyInsert(text: string) {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = value.slice(0, start) + text + value.slice(end)
    pendingSel.current = { start: start + text.length, end: start + text.length }
    onChange(next)
  }

  const resolvedUrl =
    tab === "upload"
      ? uploadedUrl.trim()
      : libChoice === CUSTOM
        ? customUrl.trim()
        : libChoice
  const canInsert = resolvedUrl.length > 0

  function resetImageState() {
    setLibChoice(LIBRARY_IMAGES[0])
    setCustomUrl("")
    setUploadedUrl("")
    setImgCaption("")
    setTab("library")
    if (fileRef.current) fileRef.current.value = ""
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast.error("Choose a file first")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        headers: {
          "X-CSRF-Token": typeof document !== "undefined" ? document.cookie.match(/csrf-token=([^;]+)/)?.[1] || "" : ""
        }
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        toast.error(data.error || "Upload failed")
        return
      }
      setUploadedUrl(data.url)
      toast.success("Photo uploaded")
    } catch (e) {
      toast.error("Upload failed", { description: String(e) })
    } finally {
      setUploading(false)
    }
  }

  function insertImage() {
    if (!canInsert) return
    const caption = imgCaption.trim()
    const md = `![${caption}](${resolvedUrl})\n\n`
    setImgOpen(false)
    resetImageState()
    applyInsert(md)
  }

  // Insert an image chosen from the shared media-library browser. Reuses the
  // same applyInsert() cursor logic the upload path uses, so the markdown lands
  // at the caret (or appends) exactly like an uploaded image would.
  function handleBrowseInsert(url: string) {
    applyInsert(`![image](${url})\n\n`)
  }

  const btn = "h-8 w-8 p-0"

  return (
    <div className="rounded-md border">
      {/* Toolbar — z-30 so it sits above the sticky action bar (z-20) at the
          bottom of the article editor page. Without this, the "Insert photo"
          and other toolbar buttons get covered when the editor is scrolled
          near the bottom of the viewport. */}
      <div className="relative z-30 flex flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-1.5">
        <Button type="button" variant="ghost" size="icon" className={btn} title="Bold" onClick={() => applyWrap("**", "**", "bold text")}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={btn} title="Italic" onClick={() => applyWrap("*", "*", "italic text")}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={btn} title="Heading" onClick={() => applyLinePrefix("## ")}>
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={btn} title="Quote" onClick={() => applyLinePrefix("> ")}>
          <Quote className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={btn} title="Link" onClick={() => applyWrap("[", "](https://)", "link text")}>
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={btn} title="Insert photo" onClick={() => setImgOpen(true)}>
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={btn} title="Browse media library" onClick={() => setBrowseOpen(true)}>
          <Images className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className={cn(btn)} title="Align left" onClick={() => applyWrap('<div style="text-align:left">', "</div>", "Left-aligned text")}>
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={cn(btn)} title="Align center" onClick={() => applyWrap('<div style="text-align:center">', "</div>", "Centered text")}>
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={cn(btn)} title="Align right" onClick={() => applyWrap('<div style="text-align:right">', "</div>", "Right-aligned text")}>
          <AlignRight className="h-4 w-4" />
        </Button>
        <span className="ml-auto pr-1 text-[10px] text-muted-foreground">
          Markdown
        </span>
      </div>
      {/* Textarea */}
      <Textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-none border-0 font-mono text-sm focus-visible:ring-0"
      />

      {/* Insert image dialog */}
      <Dialog
        open={imgOpen}
        onOpenChange={(o) => {
          setImgOpen(o)
          if (!o) resetImageState()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert photo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "library" | "upload")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="library">Library</TabsTrigger>
                <TabsTrigger value="upload">Upload</TabsTrigger>
              </TabsList>

              <TabsContent value="library" className="mt-3">
                <div className="grid gap-1.5">
                  <Label>Choose a photo</Label>
                  <Select
                    value={libChoice}
                    onValueChange={(v) => {
                      setLibChoice(v)
                      if (v !== CUSTOM) setCustomUrl("")
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIBRARY_IMAGES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.replace("/cricket/", "").replace(".png", "")}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM}>Custom URL…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {libChoice === CUSTOM && (
                  <div className="mt-3 grid gap-1.5">
                    <Label htmlFor="imgUrl">Image URL</Label>
                    <Input
                      id="imgUrl"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://… or /uploads/your-image.png"
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upload" className="mt-3">
                <div className="grid gap-2">
                  <Label htmlFor="imgFile">Upload from your computer</Label>
                  <Input
                    id="imgFile"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    ref={fileRef}
                    onChange={() => {
                      // Auto-upload immediately when a file is selected —
                      // saves the user from having to click a separate
                      // "Upload" button before "Insert" becomes active.
                      setUploadedUrl("")
                      // Small delay so fileRef.current.files is populated
                      setTimeout(() => handleUpload(), 0)
                    }}
                  />
                  {uploading && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Uploading…
                    </p>
                  )}
                  {uploadedUrl && (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      ✓ Uploaded — click Insert to add to the article
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    PNG, JPEG, WebP, GIF or SVG · max 10 MB. Saved to <code>/uploads/</code>.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {resolvedUrl && (
              <div className="aspect-[16/9] w-full overflow-hidden rounded-md border bg-muted">
                <img
                  src={resolvedUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="imgCaption">Caption (optional)</Label>
              <Input
                id="imgCaption"
                value={imgCaption}
                onChange={(e) => setImgCaption(e.target.value)}
                placeholder="e.g. India celebrate the wicket. Photo: Getty Images"
              />
              <p className="text-[11px] text-muted-foreground">
                Shown beneath the photo on the article page.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImgOpen(false)
                resetImageState()
              }}
            >
              Cancel
            </Button>
            <Button onClick={insertImage} disabled={!canInsert}>
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media library browser — picks from every previously uploaded image */}
      <MediaBrowserDialog
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        onSelect={handleBrowseInsert}
      />
    </div>
  )
}
