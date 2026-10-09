"use client"

import { useEffect, useState } from "react"
import { useArticles } from "@/lib/use-data"
import { api } from "@/lib/api"
import { AdminShell } from "@/components/admin/admin-shell"
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
import { Plus, Pencil, Trash2, Search, Check, X } from "lucide-react"
import { toast } from "sonner"
import type { Article } from "@/lib/types"

const CATEGORIES = ["news", "feature", "analysis", "interview", "opinion"] as const

interface ArticleFormState {
  title: string
  slug: string
  excerpt: string
  content: string
  imageUrl: string
  imageCaption: string
  category: string
  author: string
  tags: string
  featured: boolean
  published: boolean
  publishedAt: string
}

function emptyForm(): ArticleFormState {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    imageUrl: "",
    imageCaption: "",
    category: "news",
    author: "",
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

export function AdminArticlesView() {
  const [search, setSearch] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [page, setPage] = useState(1)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => {
    setPage(1)
  }, [debouncedQ])

  const { data, loading, refetch } = useArticles({
    q: debouncedQ || undefined,
    page,
    pageSize: 20,
  })
  const items = data?.items ?? []
  const totalPages = data?.totalPages ?? 1
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ArticleFormState>(emptyForm())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(a: Article) {
    setEditingId(a.id)
    setForm({
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      content: a.content,
      imageUrl: a.imageUrl || "",
      imageCaption: a.imageCaption || "",
      category: a.category,
      author: a.author,
      tags: a.tags,
      featured: a.featured,
      published: a.published,
      publishedAt: toLocalInput(a.publishedAt),
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
      const payload = {
        ...form,
        slug: form.slug || slugify(form.title),
      }
      if (editingId) {
        await api.articles.update(editingId, payload)
        toast.success("Article updated")
      } else {
        await api.articles.create(payload)
        toast.success("Article created")
      }
      setOpen(false)
      refetch()
    } catch (e) {
      toast.error("Failed to save article", { description: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.articles.remove(id)
      toast.success("Article deleted")
      refetch()
    } catch (e) {
      toast.error("Failed to delete", { description: String(e) })
    }
    setDeleteId(null)
  }

  return (
    <AdminShell
      title="Manage Articles"
      count={data?.total}
      actionLabel="+ New Article"
      onAction={openCreate}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search articles by title, author or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden md:table-cell">Author</TableHead>
                  <TableHead className="text-center">Featured</TableHead>
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
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-8"
                    >
                      No articles found.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[220px] truncate font-medium">
                        {a.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {a.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {a.author}
                      </TableCell>
                      <TableCell className="text-center">
                        {a.featured ? (
                          <Check className="inline h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="inline h-4 w-4 text-muted-foreground/40" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {a.published ? (
                          <Badge className="bg-emerald-600 text-white">
                            Live
                          </Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {new Date(a.publishedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(a)}
                          aria-label="Edit article"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(a.id)}
                          className="text-destructive"
                          aria-label="Delete article"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
            {data ? ` · ${data.total} total` : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Article" : "New Article"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => {
                  const t = e.target.value
                  setForm((f) => ({
                    ...f,
                    title: t,
                    slug: editingId ? f.slug : slugify(t),
                  }))
                }}
                placeholder="Enter article title"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }
                placeholder="auto-from-title"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excerpt: e.target.value }))
                }
                rows={2}
                placeholder="Short summary"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                rows={6}
                className="font-mono text-xs"
                placeholder="Full article body (plain text / markdown)"
              />
            </div>
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
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={form.author}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, author: e.target.value }))
                  }
                  placeholder="e.g. ESPNcricinfo staff"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tags: e.target.value }))
                  }
                  placeholder="india, odi, kohli"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="publishedAt">Published At</Label>
                <Input
                  id="publishedAt"
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, publishedAt: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="imageUrl">Image URL (optional)</Label>
              <Input
                id="imageUrl"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="imageCaption">Image caption (optional)</Label>
              <Input
                id="imageCaption"
                value={form.imageCaption}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imageCaption: e.target.value }))
                }
                placeholder="e.g. India celebrate with the Champions Trophy in Dubai. Photo: Getty Images"
              />
              <p className="text-[11px] text-muted-foreground">
                Shown as a small caption beneath the hero image on the article page.
              </p>
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Switch
                  checked={form.featured}
                  onCheckedChange={(c) =>
                    setForm((f) => ({ ...f, featured: c }))
                  }
                />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
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
            <Button onClick={handleSubmit} disabled={saving}>
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Create Article"}
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
            <AlertDialogTitle>Delete this article?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the article from the database. This
              action cannot be undone.
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
