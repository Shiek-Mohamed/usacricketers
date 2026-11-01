"use client"

import { useEffect, useMemo, useState } from "react"
import { useSeries } from "@/lib/use-data"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Plus, Pencil, Trash2, ShieldCheck, ShieldOff } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Scorer, Series } from "@/lib/types"

/* ------------------------- inline fetch helpers ------------------------- */

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

async function listScorers(): Promise<Scorer[]> {
  return jsonOrThrow<Scorer[]>(await fetch("/api/scorers"))
}

async function createScorer(payload: {
  username: string
  email: string
  password: string
  name: string
  active?: boolean
  tournamentIds?: string[]
}): Promise<Scorer> {
  return jsonOrThrow<Scorer>(
    await fetch("/api/scorers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": typeof document !== "undefined" ? document.cookie.match(/csrf-token=([^;]+)/)?.[1] || "" : ""
      },
      body: JSON.stringify(payload),
    })
  )
}

async function updateScorer(
  id: string,
  payload: {
    name?: string
    email?: string
    active?: boolean
    password?: string
    tournamentIds?: string[]
  }
): Promise<Scorer> {
  return jsonOrThrow<Scorer>(
    await fetch(`/api/scorers/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": typeof document !== "undefined" ? document.cookie.match(/csrf-token=([^;]+)/)?.[1] || "" : ""
      },
      body: JSON.stringify(payload),
    })
  )
}

async function deleteScorer(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/scorers/${id}`, {
    method: "DELETE",
    headers: {
      "X-CSRF-Token": typeof document !== "undefined" ? document.cookie.match(/csrf-token=([^;]+)/)?.[1] || "" : ""
    }
  }))
}

/* ------------------------------- view ------------------------------- */

interface ScorerFormState {
  username: string
  email: string
  name: string
  password: string
  active: boolean
  tournamentIds: string[]
}

function emptyForm(): ScorerFormState {
  return { username: "", email: "", name: "", password: "", active: true, tournamentIds: [] }
}

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"

export function AdminScorerView() {
  const seriesApi = useSeries()
  const allSeries: Series[] = seriesApi.data ?? []
  const seriesLookup = useMemo(() => {
    const m: Record<string, Series> = {}
    for (const s of allSeries) m[s.id] = s
    return m
  }, [allSeries])

  const [scorers, setScorers] = useState<Scorer[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ScorerFormState>(emptyForm())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listScorers()
      setScorers(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scorers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(s: Scorer) {
    setEditingId(s.id)
    setForm({
      username: s.username,
      email: s.email ?? "",
      name: s.name,
      password: "",
      active: s.active,
      tournamentIds: [...s.tournamentIds],
    })
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.username.trim()) {
      toast.error("Username is required")
      return
    }
    if (!form.email.trim()) {
      toast.error("Email is required")
      return
    }
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!editingId && !form.password) {
      toast.error("Password is required when creating a scorer")
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const payload: Parameters<typeof updateScorer>[1] = {
          name: form.name.trim(),
          email: form.email.trim(),
          active: form.active,
          tournamentIds: form.tournamentIds,
        }
        if (form.password) payload.password = form.password
        await updateScorer(editingId, payload)
        toast.success("Scorer updated")
      } else {
        await createScorer({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          active: form.active,
          tournamentIds: form.tournamentIds,
        })
        toast.success("Scorer created")
      }
      setOpen(false)
      await reload()
    } catch (e) {
      toast.error("Failed to save scorer", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteScorer(id)
      toast.success("Scorer deleted")
      await reload()
    } catch (e) {
      toast.error("Failed to delete scorer", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
    setDeleteId(null)
  }

  function toggleTournament(id: string) {
    setForm((f) => {
      const has = f.tournamentIds.includes(id)
      return {
        ...f,
        tournamentIds: has
          ? f.tournamentIds.filter((x) => x !== id)
          : [...f.tournamentIds, id],
      }
    })
  }

  const list = scorers ?? []

  return (
    <AdminShell
      title="Scorer Accounts"
      count={scorers?.length}
      actionLabel="+ New Scorer"
      onAction={openCreate}
    >
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className={cn("max-h-[60vh] overflow-y-auto", SCROLLBAR)}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Tournaments
                  </TableHead>
                  <TableHead className="text-center">Active</TableHead>
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
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No scorer accounts yet. Click &ldquo;+ New Scorer&rdquo; to
                      create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {s.username}
                      </TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <TournamentBadges
                          ids={s.tournamentIds}
                          lookup={seriesLookup}
                          allSeries={allSeries}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {s.active ? (
                          <Badge className="gap-1 bg-emerald-600 text-white">
                            <ShieldCheck className="h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <ShieldOff className="h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(s)}
                          aria-label="Edit scorer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(s.id)}
                          className="text-destructive"
                          aria-label="Delete scorer"
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Scorer" : "New Scorer"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="scorer-username">Username</Label>
              <Input
                id="scorer-username"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
                placeholder="e.g. njohnson"
                disabled={!!editingId}
                autoComplete="off"
              />
              {editingId ? (
                <p className="text-[11px] text-muted-foreground">
                  Username cannot be changed after creation.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Used by the scorer to sign in.
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="scorer-email">
                Email{" "}
                <span className="font-normal text-red-600">*</span>
              </Label>
              <Input
                id="scorer-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="scorer@league.org"
                autoComplete="email"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="scorer-name">Display name</Label>
              <Input
                id="scorer-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Nick Johnson"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="scorer-password">
                Password{" "}
                {editingId && (
                  <span className="font-normal text-muted-foreground">
                    (leave blank to keep current)
                  </span>
                )}
              </Label>
              <Input
                id="scorer-password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                placeholder={editingId ? "Leave blank to keep" : "Set a password"}
                autoComplete="new-password"
              />
            </div>

            <label className="flex w-fit items-center gap-2 pt-1 text-sm font-medium">
              <Switch
                checked={form.active}
                onCheckedChange={(c) =>
                  setForm((f) => ({ ...f, active: c }))
                }
              />
              Active
              <span className="text-[11px] font-normal text-muted-foreground">
                (inactive scorers cannot sign in)
              </span>
            </label>

            {/* Tournament multi-select */}
            <div className="grid gap-2 pt-2">
              <Label>Tournaments</Label>
              <p className="text-[11px] text-muted-foreground">
                Selected scorers will only see matches that belong to these
                tournaments.
              </p>
              <div
                className={cn(
                  "max-h-56 overflow-y-auto rounded-md border bg-card p-2",
                  SCROLLBAR
                )}
              >
                {seriesApi.loading ? (
                  <div className="space-y-2 p-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                ) : allSeries.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    No tournaments exist yet. Create a tournament first.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {allSeries.map((s) => {
                      const checked = form.tournamentIds.includes(s.id)
                      return (
                        <li key={s.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                              checked && "bg-accent/60"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleTournament(s.id)}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {s.name}
                            </span>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {s.format}
                            </Badge>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {form.tournamentIds.length} selected
              </p>
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
                  : "Create Scorer"}
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
            <AlertDialogTitle>Delete this scorer account?</AlertDialogTitle>
            <AlertDialogDescription>
              The scorer will immediately lose access and will no longer be able
              to sign in. Their tournament assignments will be removed. This
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

/* ------------------------------- bits ------------------------------- */

function TournamentBadges({
  ids,
  lookup,
  allSeries,
}: {
  ids: string[]
  lookup: Record<string, Series>
  allSeries: Series[]
}) {
  if (ids.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No tournaments</span>
    )
  }
  // If 3 or fewer, show short names; otherwise show count.
  if (ids.length <= 3) {
    return (
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => {
          const s = lookup[id]
          return (
            <Badge
              key={id}
              variant="outline"
              className="text-[10px] font-medium"
            >
              {s?.shortName ?? id.slice(0, 6)}
            </Badge>
          )
        })}
      </div>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      {ids.length} of {allSeries.length} tournaments
    </span>
  )
}
