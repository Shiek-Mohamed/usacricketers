"use client"

import { useState } from "react"
import { useSidebarBlocks } from "@/lib/use-data"
import { api } from "@/lib/api"
import { AdminShell } from "@/components/admin/admin-shell"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { toast } from "sonner"
import type { SidebarBlock } from "@/lib/types"

const PLACEMENTS = [
  { value: "all", label: "All pages" },
  { value: "article", label: "Articles" },
  { value: "match", label: "Match" },
  { value: "player", label: "Player" },
  { value: "team", label: "Team" },
  { value: "series", label: "Series" },
]

interface BlockFormState {
  title: string
  content: string
  placement: string
  order: number
  published: boolean
}

const emptyForm: BlockFormState = {
  title: "",
  content: "",
  placement: "all",
  order: 0,
  published: true,
}

function placementLabel(p: string): string {
  const found = PLACEMENTS.find((x) => x.value === p)
  if (found) return found.label
  // comma-separated custom placements
  return p
    .split(",")
    .map((s) => PLACEMENTS.find((x) => x.value === s.trim())?.label || s.trim())
    .join(", ")
}

export function AdminSidebarView() {
  const { data, loading, refetch } = useSidebarBlocks(undefined, true) // drafts=true for admin
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BlockFormState>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setOpen(true)
  }

  function openEdit(b: SidebarBlock) {
    setEditingId(b.id)
    setForm({
      title: b.title,
      content: b.content,
      placement: b.placement,
      order: b.order,
      published: b.published,
    })
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    setSaving(true)
    try {
      const payload = { ...form }
      if (editingId) {
        await api.sidebarBlocks.update(editingId, payload)
        toast.success("Sidebar block updated")
      } else {
        await api.sidebarBlocks.create(payload)
        toast.success("Sidebar block created")
      }
      setOpen(false)
      refetch()
    } catch (e) {
      toast.error("Failed to save", { description: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.sidebarBlocks.remove(id)
      toast.success("Sidebar block deleted")
      refetch()
    } catch (e) {
      toast.error("Failed to delete", { description: String(e) })
    }
    setDeleteId(null)
  }

  return (
    <AdminShell
      title="Sidebar Blocks"
      count={data?.length}
      actionLabel="+ New block"
      onAction={openCreate}
    >
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead className="text-center">Order</TableHead>
                  <TableHead className="text-center">Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No sidebar blocks yet. Click “New block” to add a custom
                      widget (promo, blurb, links, image) to the inner-page
                      sidebars.
                    </TableCell>
                  </TableRow>
                ) : (
                  (data ?? []).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {placementLabel(b.placement)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {b.order}
                      </TableCell>
                      <TableCell className="text-center">
                        {b.published ? (
                          <Check className="inline h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="inline h-4 w-4 text-muted-foreground/40" />
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(b)}
                          aria-label="Edit block"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(b.id)}
                          className="text-destructive"
                          aria-label="Delete block"
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit sidebar block" : "New sidebar block"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="blockTitle">Title</Label>
              <Input
                id="blockTitle"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Follow us, Series promo, Sponsored"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Placement</Label>
                <Select
                  value={form.placement}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, placement: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLACEMENTS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Where this block appears in the sidebar.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="blockOrder">Order</Label>
                <Input
                  id="blockOrder"
                  type="number"
                  value={form.order}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      order: Number(e.target.value) || 0,
                    }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Lower numbers appear first.
                </p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Content</Label>
              <MarkdownEditor
                value={form.content}
                onChange={(v) => setForm((f) => ({ ...f, content: v }))}
                placeholder="Write the widget body — supports bold, italic, links, photos, alignment."
                rows={10}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={form.published}
                onCheckedChange={(c) =>
                  setForm((f) => ({ ...f, published: c }))
                }
              />
              <Label className="text-sm font-medium">Published</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create block"}
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
            <AlertDialogTitle>Delete this sidebar block?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the custom widget from the sidebars.
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
