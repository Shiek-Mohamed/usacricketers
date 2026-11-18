"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useArticle } from "@/lib/use-data"
import { api } from "@/lib/api"
import { AdminShell } from "@/components/admin/admin-shell"
import { MarkdownEditor } from "@/components/admin/markdown-editor"
import { UploadButton } from "@/components/admin/upload-button"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { ArrowLeft, Save } from "lucide-react"
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
  categories: string[]
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
    categories: ["news"],
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

export function AdminArticleEditView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)

  // id === "new" (or null) → create mode. Otherwise → edit mode.
  const isCreate = !id || id === "new"
  const { data: existing, loading } = useArticle(isCreate ? null : id)

  const [form, setForm] = useState<ArticleFormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // When editing, populate the form once the article loads.
  useEffect(() => {
    if (isCreate) {
      setForm(emptyForm())
      setHydrated(true)
      return
    }
    if (existing) {
      setForm({
        title: existing.title,
        slug: existing.slug,
        excerpt: existing.excerpt,
        content: existing.content,
        imageUrl: existing.imageUrl || "",
        imageCaption: existing.imageCaption || "",
        categories: existing.categories.length > 0 ? [...existing.categories] : ["news"],
        author: existing.author,
        tags: existing.tags,
        featured: existing.featured,
        published: existing.published,
        publishedAt: toLocalInput(existing.publishedAt),
      })
      setHydrated(true)
    }
  }, [existing, isCreate])

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (form.categories.length === 0) {
      toast.error("Pick at least one category")
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.title),
      }
      if (!isCreate && id) {
        await api.articles.update(id, payload)
        toast.success("Article updated")
      } else {
        await api.articles.create(payload)
        toast.success("Article created")
      }
      navigate("admin-articles")
    } catch (e) {
      toast.error("Failed to save article", { description: String(e) })
    } finally {
      setSaving(false)
    }
  }

  const title = isCreate ? "New Article" : "Edit Article"

  // Loading state for edit mode (waiting for the article to fetch).
  if (!hydrated && !isCreate) {
    return (
      <AdminShell
        title={title}
        actionLabel="← Back to Articles"
        onAction={() => navigate("admin-articles")}
      >
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title={title}
      actionLabel="← Back to Articles"
      onAction={() => navigate("admin-articles")}
    >
      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">
          {isCreate ? "Creating" : "Editing"}
        </Badge>
        {form.published ? (
          new Date(form.publishedAt) > new Date() ? (
            <Badge className="bg-amber-500 text-white">⏰ Scheduled</Badge>
          ) : (
            <Badge className="bg-emerald-600 text-white">Live</Badge>
          )
        ) : (
          <Badge variant="outline">Draft</Badge>
        )}
        {form.featured && <Badge className="bg-primary text-primary-foreground">Featured</Badge>}
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Title */}
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
                  slug: isCreate ? slugify(t) : f.slug,
                }))
              }}
              placeholder="Enter article title"
              autoFocus={isCreate}
            />
          </div>

          {/* Slug */}
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
            <p className="text-xs text-muted-foreground">
              URL: /news/<span className="font-mono">{form.slug || "auto-from-title"}</span>
            </p>
          </div>

          {/* Excerpt */}
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

          {/* Content */}
          <div className="grid gap-1.5">
            <Label htmlFor="content">Content</Label>
            <MarkdownEditor
              value={form.content}
              onChange={(v) => setForm((f) => ({ ...f, content: v }))}
              placeholder="Write the article body. Use the toolbar for bold, italic, alignment, headings, links and photos."
              rows={18}
            />
          </div>

          {/* Categories + Author */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Categories</Label>
              <p className="text-xs text-muted-foreground">
                Select all that apply — the post appears in each selected
                category&apos;s listing.
              </p>
              <div className="flex flex-wrap gap-2 rounded-md border bg-card p-2.5">
                {CATEGORIES.map((c) => {
                  const checked = form.categories.includes(c)
                  return (
                    <label
                      key={c}
                      className={cn(
                        "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setForm((f) => ({
                            ...f,
                            categories: checked
                              ? f.categories.filter((x) => x !== c)
                              : [...f.categories, c],
                          }))
                        }
                      />
                      {c}
                    </label>
                  )
                })}
              </div>
              {form.categories.length === 0 && (
                <p className="text-xs text-red-600">
                  Pick at least one category.
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={form.author}
                onChange={(e) =>
                  setForm((f) => ({ ...f, author: e.target.value }))
                }
                placeholder="e.g. USA Cricketers staff"
              />
            </div>
          </div>

          {/* Tags + Published At */}
          <div className="grid md:grid-cols-2 gap-4">
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
              {form.published && new Date(form.publishedAt) > new Date() && (
                <p className="text-xs text-amber-600 font-medium">
                  ⏰ This article is scheduled — it will go live at{" "}
                  {new Date(form.publishedAt).toLocaleString()}.
                </p>
              )}
            </div>
          </div>

          {/* Hero image */}
          <div className="grid gap-1.5">
            <Label htmlFor="imageUrl">Hero image URL (optional)</Label>
            <Input
              id="imageUrl"
              value={form.imageUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, imageUrl: e.target.value }))
              }
              placeholder="https://… or /uploads/your-image.png"
            />
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <UploadButton
                label="Upload hero photo"
                withBrowse
                onUploaded={(url) =>
                  setForm((f) => ({ ...f, imageUrl: url }))
                }
              />
              {form.imageUrl && (
                <img
                  src={form.imageUrl}
                  alt="Hero preview"
                  className="h-16 w-24 rounded border object-cover"
                />
              )}
            </div>
          </div>

          {/* Image caption */}
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
            <p className="text-xs text-muted-foreground">
              Shown as a small caption beneath the hero image on the article page.
            </p>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-6 pt-1 border-t">
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
        </CardContent>
      </Card>

      {/* Sticky action bar — Save + Back */}
      <div className="sticky bottom-4 z-20 flex items-center justify-end gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Button
          variant="outline"
          onClick={() => navigate("admin-articles")}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Articles
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" />
          {saving
            ? "Saving..."
            : isCreate
              ? "Create Article"
              : "Save Changes"}
        </Button>
      </div>
    </AdminShell>
  )
}
