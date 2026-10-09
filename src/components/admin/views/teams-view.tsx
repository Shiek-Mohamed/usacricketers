"use client"

import { useState } from "react"
import { useTeams } from "@/lib/use-data"
import { api } from "@/lib/api"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { TeamBadge } from "@/components/cricket/ui"
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
import { Plus, Pencil, Trash2, Search, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import type { Team } from "@/lib/types"

interface TeamFormState {
  name: string
  shortName: string
  country: string
  primaryColor: string
  accentColor: string
  description: string
}

const emptyForm: TeamFormState = {
  name: "",
  shortName: "",
  country: "",
  primaryColor: "#0e7490",
  accentColor: "#f59e0b",
  description: "",
}

export function AdminTeamsView() {
  const { data, loading, refetch } = useTeams()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TeamFormState>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = (data ?? []).filter((t) => {
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.shortName.toLowerCase().includes(q) ||
      t.country.toLowerCase().includes(q)
    )
  })

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(t: Team) {
    setEditingId(t.id)
    setForm({
      name: t.name,
      shortName: t.shortName,
      country: t.country,
      primaryColor: t.primaryColor,
      accentColor: t.accentColor,
      description: t.description,
    })
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Team name is required")
      return
    }
    if (!form.shortName.trim()) {
      toast.error("Short name is required")
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, shortName: form.shortName.toUpperCase() }
      if (editingId) {
        await api.teams.update(editingId, payload)
        toast.success("Team updated")
      } else {
        await api.teams.create(payload)
        toast.success("Team created")
      }
      setOpen(false)
      refetch()
    } catch (e) {
      toast.error("Failed to save team", { description: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.teams.remove(id)
      toast.success("Team deleted")
      refetch()
    } catch (e) {
      toast.error("Failed to delete (check dependencies)", {
        description: String(e),
      })
    }
    setDeleteId(null)
  }

  const previewTeam = {
    shortName: form.shortName || "TM",
    primaryColor: form.primaryColor,
    accentColor: form.accentColor,
  }

  return (
    <AdminShell
      title="Manage Teams"
      count={data?.length}
      actionLabel="+ New Team"
      onAction={openCreate}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search teams by name or country..."
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
                  <TableHead>Badge</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Short</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Country
                  </TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No teams found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <TeamBadge team={t} size="sm" />
                      </TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-xs uppercase">
                        {t.shortName}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">
                        {t.country}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-4 w-4 rounded-full border"
                            style={{ background: t.primaryColor }}
                          />
                          <span
                            className="h-4 w-4 rounded-full border"
                            style={{ background: t.accentColor }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(t)}
                          aria-label="Edit team"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(t.id)}
                          className="text-destructive"
                          aria-label="Delete team"
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Team" : "New Team"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. India"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="shortName">Short Name</Label>
                <Input
                  id="shortName"
                  value={form.shortName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      shortName: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="IND"
                  maxLength={4}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, country: e.target.value }))
                  }
                  placeholder="India"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, primaryColor: e.target.value }))
                    }
                    className="h-9 w-12 rounded border bg-transparent cursor-pointer"
                    aria-label="Primary color picker"
                  />
                  <Input
                    value={form.primaryColor}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, primaryColor: e.target.value }))
                    }
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.accentColor}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accentColor: e.target.value }))
                    }
                    className="h-9 w-12 rounded border bg-transparent cursor-pointer"
                    aria-label="Accent color picker"
                  />
                  <Input
                    value={form.accentColor}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accentColor: e.target.value }))
                    }
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
                placeholder="Team description"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              <TeamBadge team={previewTeam} size="sm" />
              <span>Badge preview</span>
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
                  : "Create Team"}
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
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Delete this
              team?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a team may cascade and delete related players and
              matches. This action cannot be undone.
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
