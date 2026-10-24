"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { useBannersAll } from "@/lib/use-data"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
  Code2,
  Megaphone,
} from "lucide-react"
import { toast } from "sonner"
import type { Banner, BannerType } from "@/lib/types"

/* The fixed set of placement slots the home view exposes. The admin can
 * still type any custom placement into the dropdown — these are just the
 * canonical ones we ship with. */
const PLACEMENT_OPTIONS: { value: string; label: string; rotating: boolean }[] = [
  { value: "home-live-hero", label: "Home — between Live & Hero (AdSense slot, non-rotating)", rotating: false },
  { value: "home-above-results", label: "Home — above Latest Results (rotating)", rotating: true },
  { value: "home-above-news", label: "Home — above Latest News (rotating)", rotating: true },
  { value: "home-above-galleries", label: "Home — above Latest Galleries (rotating)", rotating: true },
]

const BANNER_TYPES: { value: BannerType; label: string; icon: typeof ImageIcon; hint: string }[] = [
  { value: "image", label: "Image", icon: ImageIcon, hint: "Classic image banner with click-through" },
  { value: "adsense", label: "AdSense", icon: Megaphone, hint: "Google AdSense ad unit" },
  { value: "html", label: "HTML snippet", icon: Code2, hint: "Raw HTML (affiliate iframes, custom tags)" },
]

interface BannerFormState {
  id?: string
  type: BannerType
  title: string
  placement: string
  order: number
  published: boolean
  startDate: string
  endDate: string
  weight: number
  // image
  imageUrl: string
  linkUrl: string
  altText: string
  // adsense
  adsenseClient: string
  adsenseSlot: string
  adsenseFormat: string
  responsive: boolean
  // html
  htmlContent: string
}

const emptyForm: BannerFormState = {
  type: "image",
  title: "",
  placement: "home-live-hero",
  order: 0,
  published: true,
  startDate: "",
  endDate: "",
  weight: 1,
  imageUrl: "",
  linkUrl: "",
  altText: "",
  adsenseClient: "",
  adsenseSlot: "",
  adsenseFormat: "auto",
  responsive: true,
  htmlContent: "",
}

function toFormState(b: Banner): BannerFormState {
  return {
    id: b.id,
    type: b.type,
    title: b.title,
    placement: b.placement,
    order: b.order,
    published: b.published,
    startDate: b.startDate ? b.startDate.slice(0, 10) : "",
    endDate: b.endDate ? b.endDate.slice(0, 10) : "",
    weight: b.weight,
    imageUrl: b.imageUrl ?? "",
    linkUrl: b.linkUrl ?? "",
    altText: b.altText ?? "",
    adsenseClient: b.adsenseClient ?? "",
    adsenseSlot: b.adsenseSlot ?? "",
    adsenseFormat: b.adsenseFormat ?? "auto",
    responsive: b.responsive,
    htmlContent: b.htmlContent ?? "",
  }
}

function isDateActive(b: Banner): boolean {
  const now = Date.now()
  const start = b.startDate ? new Date(b.startDate).getTime() : -Infinity
  const end = b.endDate ? new Date(b.endDate).getTime() : Infinity
  return start <= now && now <= end
}

export function AdminBannersView() {
  const { data: banners, loading, refetch } = useBannersAll()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BannerFormState>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setForm(emptyForm)
    setOpen(true)
  }
  function openEdit(b: Banner) {
    setForm(toFormState(b))
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    // Type-specific validation
    if (form.type === "image" && !form.imageUrl) {
      toast.error("Image banner needs an image URL — upload an image first")
      return
    }
    if (form.type === "adsense" && (!form.adsenseClient || !form.adsenseSlot)) {
      toast.error("AdSense banner needs both the publisher ID (ca-pub-...) and the slot ID")
      return
    }
    if (form.type === "html" && !form.htmlContent.trim()) {
      toast.error("HTML banner needs the HTML snippet")
      return
    }
    setSaving(true)
    try {
      const payload: Partial<Banner> = {
        type: form.type,
        title: form.title.trim(),
        placement: form.placement,
        order: form.order,
        published: form.published,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        weight: form.weight,
        imageUrl: form.imageUrl || null,
        linkUrl: form.linkUrl || null,
        altText: form.altText || null,
        adsenseClient: form.adsenseClient || null,
        adsenseSlot: form.adsenseSlot || null,
        adsenseFormat: form.adsenseFormat || null,
        responsive: form.responsive,
        htmlContent: form.htmlContent || null,
      }
      if (form.id) {
        await api.banners.update(form.id, payload)
        toast.success("Banner updated")
      } else {
        await api.banners.create(payload)
        toast.success("Banner created")
      }
      setOpen(false)
      refetch()
    } catch (e) {
      toast.error("Failed to save banner", { description: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.banners.remove(id)
      toast.success("Banner deleted")
      refetch()
    } catch (e) {
      toast.error("Failed to delete", { description: String(e) })
    }
    setDeleteId(null)
  }

  function set<K extends keyof BannerFormState>(key: K, value: BannerFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <AdminShell
      title="Advertising Banners"
      count={banners?.length}
      actionLabel="+ New Banner"
      onAction={openCreate}
    >
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[65vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-12">Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Placement</TableHead>
                  <TableHead className="hidden md:table-cell">Schedule</TableHead>
                  <TableHead className="text-center">Stats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : !banners || banners.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      No banners yet. Click <strong>+ New Banner</strong> to create your first ad.
                    </TableCell>
                  </TableRow>
                ) : (
                  banners.map((b) => {
                    const active = isDateActive(b) && b.published
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn_type_badge(b.type)}
                          >
                            {b.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {b.title}
                          {b.type === "image" && b.imageUrl && (
                            <img
                              src={b.imageUrl}
                              alt={b.altText || b.title}
                              className="mt-1 max-h-10 rounded border"
                            />
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            {b.placement}
                          </code>
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            order {b.order} · weight {b.weight}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {b.startDate ? b.startDate.slice(0, 10) : "—"} →{" "}
                          {b.endDate ? b.endDate.slice(0, 10) : "∞"}
                        </TableCell>
                        <TableCell className="text-center text-xs tabular-nums">
                          <div>
                            <span className="font-semibold">{b.impressions}</span>
                            <span className="text-muted-foreground"> imp</span>
                          </div>
                          <div className="text-muted-foreground">
                            <span className="font-semibold">{b.clicks}</span>
                            <span> clicks</span>
                          </div>
                          {b.impressions > 0 && (
                            <div className="text-[10px] text-emerald-600">
                              CTR {((b.clicks / b.impressions) * 100).toFixed(2)}%
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={active ? "default" : "secondary"}
                            className={active ? "bg-emerald-600" : ""}
                          >
                            {active ? "Live" : b.published ? "Scheduled" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(b)}
                            aria-label="Edit banner"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteId(b.id)}
                            className="text-destructive"
                            aria-label="Delete banner"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Banner" : "New Banner"}
            </DialogTitle>
            <DialogDescription>
              Choose a banner type. Image banners support click-through tracking.
              AdSense is non-rotating (Google TOS). HTML snippets render raw —
              only paste trusted partner code.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="b-title">Title (internal — not shown to viewers)</Label>
              <Input
                id="b-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Spring sale leaderboard"
              />
            </div>

            <Tabs
              value={form.type}
              onValueChange={(v) => set("type", v as BannerType)}
            >
              <TabsList className="grid w-full grid-cols-3">
                {BANNER_TYPES.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* image */}
              <TabsContent value="image" className="mt-3 space-y-3">
                <div className="grid gap-1.5">
                  <Label>Image</Label>
                  {form.imageUrl ? (
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <img
                        src={form.imageUrl}
                        alt={form.altText || "banner"}
                        className="max-h-16 rounded"
                      />
                      <code className="flex-1 truncate text-xs text-muted-foreground">
                        {form.imageUrl}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => set("imageUrl", "")}
                      >
                        Replace
                      </Button>
                    </div>
                  ) : (
                    <UploadButton onUploaded={(url) => set("imageUrl", url)} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="b-link">Click-through URL (optional)</Label>
                    <Input
                      id="b-link"
                      value={form.linkUrl}
                      onChange={(e) => set("linkUrl", e.target.value)}
                      placeholder="https://sponsor.com/offer"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="b-alt">Alt text (accessibility)</Label>
                    <Input
                      id="b-alt"
                      value={form.altText}
                      onChange={(e) => set("altText", e.target.value)}
                      placeholder="Sponsor name + offer"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* adsense */}
              <TabsContent value="adsense" className="mt-3 space-y-3">
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <strong>Non-rotating.</strong> AdSense slots never time-rotate
                  (Google TOS forbids aggressive ad refreshing). Place at most
                  one AdSense banner per slot — additional ones in the same
                  placement are ignored.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="b-client">Publisher ID (ca-pub-…)</Label>
                    <Input
                      id="b-client"
                      value={form.adsenseClient}
                      onChange={(e) => set("adsenseClient", e.target.value)}
                      placeholder="ca-pub-1234567890123456"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="b-slot">Slot ID</Label>
                    <Input
                      id="b-slot"
                      value={form.adsenseSlot}
                      onChange={(e) => set("adsenseSlot", e.target.value)}
                      placeholder="1234567890"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Ad format</Label>
                    <Select
                      value={form.adsenseFormat}
                      onValueChange={(v) => set("adsenseFormat", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="horizontal">Horizontal</SelectItem>
                        <SelectItem value="vertical">Vertical</SelectItem>
                        <SelectItem value="rectangle">Rectangle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <Switch
                      checked={form.responsive}
                      onCheckedChange={(v) => set("responsive", v)}
                      id="b-responsive"
                    />
                    <Label htmlFor="b-responsive" className="cursor-pointer">
                      Full-width responsive
                    </Label>
                  </div>
                </div>
              </TabsContent>

              {/* html */}
              <TabsContent value="html" className="mt-3 space-y-3">
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <strong>Raw HTML is rendered as-is.</strong> Only paste
                    snippets from trusted partners (AdSense, affiliate
                    networks, your own ad server). Malicious HTML can blank the
                    page. Add DOMPurify sanitization later if you don&apos;t
                    fully trust your site admins.
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="b-html">HTML snippet</Label>
                  <Textarea
                    id="b-html"
                    value={form.htmlContent}
                    onChange={(e) => set("htmlContent", e.target.value)}
                    rows={8}
                    placeholder={
                      '<iframe src="https://affiliate.example.com/ad?size=728x90" loading="lazy" scrolling="no" class="w-full" />'
                    }
                    className="font-mono text-xs"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Common fields: placement, schedule, weight, published */}
            <div className="mt-2 grid gap-3 rounded-md border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Placement (slot)</Label>
                  <Select
                    value={form.placement}
                    onValueChange={(v) => set("placement", v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLACEMENT_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="b-order">Order (lower shows first)</Label>
                  <Input
                    id="b-order"
                    type="number"
                    value={form.order}
                    onChange={(e) => set("order", Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="b-start">Start date (optional)</Label>
                  <Input
                    id="b-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="b-end">End date (optional)</Label>
                  <Input
                    id="b-end"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set("endDate", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="b-weight">Rotation weight (higher = more often)</Label>
                  <Input
                    id="b-weight"
                    type="number"
                    min="1"
                    value={form.weight}
                    onChange={(e) => set("weight", Number(e.target.value) || 1)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Defaults to 1 (equal weighting). Set 5 to show 5× more
                    often than weight-1 banners in the same slot.
                  </p>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch
                    checked={form.published}
                    onCheckedChange={(v) => set("published", v)}
                    id="b-published"
                  />
                  <Label htmlFor="b-published" className="cursor-pointer">
                    Published
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving…" : form.id ? "Save Changes" : "Create Banner"}
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
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Delete this banner?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The banner will be removed from the rotation pool immediately.
              Stats (impressions + clicks) are lost. This cannot be undone.
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
    </AdminShell>
  )
}

/* Helper: tailwind classes per banner-type badge color. */
function cn_type_badge(type: BannerType): string {
  switch (type) {
    case "image":
      return "bg-blue-50 text-blue-700 border-blue-300"
    case "adsense":
      return "bg-amber-50 text-amber-700 border-amber-300"
    case "html":
      return "bg-purple-50 text-purple-700 border-purple-300"
    default:
      return ""
  }
}
