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
import type { LeagueAdmin, Series } from "@/lib/types"

/* ------------------------- inline fetch helpers ------------------------- */

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

async function listAdmins(): Promise<LeagueAdmin[]> {
  return jsonOrThrow<LeagueAdmin[]>(await fetch("/api/league-admins"))
}

async function createAdmin(payload: {
  username: string
  password: string
  name: string
  active?: boolean
  managedSeriesIds?: string[]
}): Promise<LeagueAdmin> {
  return jsonOrThrow<LeagueAdmin>(
    await fetch("/api/league-admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  )
}

async function updateAdmin(
  id: string,
  payload: {
    name?: string
    active?: boolean
    password?: string
    managedSeriesIds?: string[]
  }
): Promise<LeagueAdmin> {
  return jsonOrThrow<LeagueAdmin>(
    await fetch(`/api/league-admins/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  )
}

async function deleteAdmin(id: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/league-admins/${id}`, { method: "DELETE" }))
}

/* ------------------------------- view ------------------------------- */

interface AdminFormState {
  username: string
  name: string
  password: string
  active: boolean
  managedSeriesIds: string[]
}

function emptyForm(): AdminFormState {
  return { username: "", name: "", password: "", active: true, managedSeriesIds: [] }
}

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"

export function AdminLeagueAdminsView() {
  const seriesApi = useSeries()
  const allSeries: Series[] = seriesApi.data ?? []
  const seriesLookup = useMemo(() => {
    const m: Record<string, Series> = {}
    for (const s of allSeries) m[s.id] = s
    return m
  }, [allSeries])

  const [admins, setAdmins] = useState<LeagueAdmin[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AdminFormState>(emptyForm())
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAdmins()
      setAdmins(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load league admins")
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

  function openEdit(a: LeagueAdmin) {
    setEditingId(a.id)
    setForm({
      username: a.username,
      name: a.name,
      password: "",
      active: a.active,
      managedSeriesIds: [...a.managedSeriesIds],
    })
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.username.trim()) {
      toast.error("Username is required")
      return
    }
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!editingId && !form.password) {
      toast.error("Password is required when creating a league admin")
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const payload: Parameters<typeof updateAdmin>[1] = {
          name: form.name.trim(),
          active: form.active,
          managedSeriesIds: form.managedSeriesIds,
        }
        if (form.password) payload.password = form.password
        await updateAdmin(editingId, payload)
        toast.success("League admin updated")
      } else {
        await createAdmin({
          username: form.username.trim(),
          password: form.password,
          name: form.name.trim(),
          active: form.active,
          managedSeriesIds: form.managedSeriesIds,
        })
        toast.success("League admin created")
      }
      setOpen(false)
      await reload()
    } catch (e) {
      toast.error("Failed to save league admin", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAdmin(id)
      toast.success("League admin deleted")
      await reload()
    } catch (e) {
      toast.error("Failed to delete league admin", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
    setDeleteId(null)
  }

  function toggleLeague(id: string) {
    setForm((f) => {
      const has = f.managedSeriesIds.includes(id)
      return {
        ...f,
        managedSeriesIds: has
          ? f.managedSeriesIds.filter((x) => x !== id)
          : [...f.managedSeriesIds, id],
      }
    })
  }

  const list = admins ?? []

  return (
    <AdminShell
      title="League Admins"
      count={admins?.length}
      actionLabel="+ New League Admin"
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
                  <TableHead className="hidden md:table-cell">Leagues</TableHead>
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
                      No league admin accounts yet. Click &ldquo;+ New League
                      Admin&rdquo; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {a.username}
                      </TableCell>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <LeaguesBadges
                          ids={a.managedSeriesIds}
                          lookup={seriesLookup}
                          allSeries={allSeries}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {a.active ? (
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
                          onClick={() => openEdit(a)}
                          aria-label="Edit league admin"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(a.id)}
                          className="text-destructive"
                          aria-label="Delete league admin"
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
              {editingId ? "Edit League Admin" : "New League Admin"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="la-username">Username</Label>
              <Input
                id="la-username"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
                placeholder="e.g. arizona_admin"
                disabled={!!editingId}
                autoComplete="off"
              />
              {editingId ? (
                <p className="text-[11px] text-muted-foreground">
                  Username cannot be changed after creation.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Used by the league admin to sign in (via the &ldquo;League
                  Admin Sign In&rdquo; button).
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="la-name">Display name</Label>
              <Input
                id="la-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Arizona Cricket Association"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="la-password">
                Password{" "}
                {editingId && (
                  <span className="font-normal text-muted-foreground">
                    (leave blank to keep current)
                  </span>
                )}
              </Label>
              <Input
                id="la-password"
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
                (inactive league admins cannot sign in)
              </span>
            </label>

            {/* Managed-leagues multi-select */}
            <div className="grid gap-2 pt-2">
              <Label>Managed leagues</Label>
              <p className="text-[11px] text-muted-foreground">
                The leagues this admin can manage (create matches, add teams,
                assign scorers). They can also create NEW leagues from their
                portal — those auto-assign to them.
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
                    No leagues exist yet. The admin can create their own from
                    their portal, or create one here first.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {allSeries.map((s) => {
                      const checked = form.managedSeriesIds.includes(s.id)
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
                              onCheckedChange={() => toggleLeague(s.id)}
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
                {form.managedSeriesIds.length} selected
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
                  : "Create League Admin"}
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
            <AlertDialogTitle>Delete this league admin account?</AlertDialogTitle>
            <AlertDialogDescription>
              The league admin will immediately lose access and will no longer
              be able to sign in. Their league assignments will be removed (the
              leagues themselves are NOT deleted). This action cannot be undone.
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

function LeaguesBadges({
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
      <span className="text-xs text-muted-foreground">No leagues</span>
    )
  }
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
      {ids.length} of {allSeries.length} leagues
    </span>
  )
}
