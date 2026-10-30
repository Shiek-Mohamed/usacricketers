"use client"

import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  ShieldOff,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Scorer, Series } from "@/lib/types"
import { LeagueSwitcher } from "@/components/site/league-switcher"

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"

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

interface CreateForm {
  username: string
  email: string
  name: string
  password: string
  seriesId: string
  active: boolean
}

interface EditForm {
  name: string
  email: string
  password: string
  active: boolean
  tournamentIds: string[]
}

function emptyCreate(currentSeriesId: string): CreateForm {
  return {
    username: "",
    email: "",
    name: "",
    password: "",
    seriesId: currentSeriesId,
    active: true,
  }
}

export function LeagueAdminScorersView() {
  const id = useAppStore((s) => s.id) // series ID passed for context
  const navigate = useAppStore((s) => s.navigate)
  const session = useLeagueAdminSession((s) => s.session)
  const token = session?.token ?? null

  const [scorers, setScorers] = useState<Scorer[] | null>(null)
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // nonce for refresh
  const [nonce, setNonce] = useState(0)
  const [doneNonce, setDoneNonce] = useState(-1)
  const stillLoading = token ? nonce !== doneNonce : false

  // dialog state
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<CreateForm>(() =>
    emptyCreate(id ?? "")
  )
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    email: "",
    password: "",
    active: true,
    tournamentIds: [],
  })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const seriesLookup = useMemo(() => {
    const m: Record<string, Series> = {}
    for (const s of allSeries) m[s.id] = s
    return m
  }, [allSeries])

  useEffect(() => {
    if (!token) return
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [scRes, seRes] = await Promise.all([
          fetch("/api/league-admin/scorers", { headers }),
          fetch("/api/league-admin/series", { headers }),
        ])
        if (!active) return
        if (scRes.status === 401 || seRes.status === 401) {
          setError("Your session has expired. Please sign in again.")
          setScorers([])
          setAllSeries([])
        } else if (!scRes.ok || !seRes.ok) {
          setError("Failed to load scorers")
          setScorers([])
          setAllSeries([])
        } else {
          const [s, se] = await Promise.all([scRes.json(), seRes.json()])
          if (!active) return
          setScorers(s as Scorer[])
          setAllSeries(se as Series[])
        }
      } catch {
        if (!active) return
        setError("Network error — could not load scorers")
      } finally {
        if (active) {
          setLoading(false)
          setDoneNonce(nonce)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [token, nonce])

  function reload() {
    setNonce((n) => n + 1)
  }

  if (!session) return null

  function openCreate() {
    setEditingId(null)
    // Pre-select the current league (if it's still in the admin's managed list)
    const stillOwned = id && allSeries.some((s) => s.id === id)
    setCreateForm(emptyCreate(stillOwned ? id! : allSeries[0]?.id ?? ""))
    setOpen(true)
  }

  function openEdit(s: Scorer) {
    setEditingId(s.id)
    setEditForm({
      name: s.name,
      email: s.email ?? "",
      password: "",
      active: s.active,
      tournamentIds: [...s.tournamentIds],
    })
    setOpen(true)
  }

  async function handleCreate() {
    if (!token) return
    if (!createForm.username.trim()) {
      toast.error("Username is required")
      return
    }
    if (!createForm.email.trim()) {
      toast.error("Email is required")
      return
    }
    if (!createForm.name.trim()) {
      toast.error("Display name is required")
      return
    }
    if (!createForm.password) {
      toast.error("Password is required")
      return
    }
    if (!createForm.seriesId) {
      toast.error("Pick a league to assign this scorer to")
      return
    }
    setSaving(true)
    try {
      await jsonOrThrow<Scorer>(
        await fetch(`/api/league-admin/scorers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            username: createForm.username.trim(),
            email: createForm.email.trim(),
            password: createForm.password,
            name: createForm.name.trim(),
            seriesId: createForm.seriesId,
            active: createForm.active,
          }),
        })
      )
      toast.success("Scorer created & assigned")
      setOpen(false)
      reload()
    } catch (e) {
      toast.error("Failed to create scorer", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!token || !editingId) return
    if (!editForm.name.trim()) {
      toast.error("Display name is required")
      return
    }
    if (!editForm.email.trim()) {
      toast.error("Email is required")
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        active: editForm.active,
        tournamentIds: editForm.tournamentIds,
      }
      if (editForm.password) payload.password = editForm.password
      await jsonOrThrow<Scorer>(
        await fetch(`/api/league-admin/scorers/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
      )
      toast.success("Scorer updated")
      setOpen(false)
      reload()
    } catch (e) {
      toast.error("Failed to update scorer", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(sid: string) {
    if (!token) return
    try {
      await jsonOrThrow(
        await fetch(`/api/league-admin/scorers/${sid}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      toast.success("Scorer deleted")
      reload()
    } catch (e) {
      toast.error("Failed to delete scorer", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setDeleteId(null)
    }
  }

  function toggleTournamentInEdit(sid: string) {
    setEditForm((f) => {
      const has = f.tournamentIds.includes(sid)
      return {
        ...f,
        tournamentIds: has
          ? f.tournamentIds.filter((x) => x !== sid)
          : [...f.tournamentIds, sid],
      }
    })
  }

  const list = scorers ?? []

  return (
    <LeagueAdminShell
      title="Scorers"
      onBack={() => navigate("league-admin-series-edit", id)}
      actionLabel="+ New Scorer"
      onAction={openCreate}
    >
      <LeagueSwitcher />
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 text-xs text-muted-foreground">
        <div>
          {allSeries.length} managed league{allSeries.length === 1 ? "" : "s"} ·{" "}
          {list.length} scorer{list.length === 1 ? "" : "s"}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={reload}
          disabled={stillLoading}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Refresh scorers"
        >
          <Loader2
            className={cn("h-3.5 w-3.5", stillLoading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 rounded px-2 py-0.5 font-semibold text-red-700 underline-offset-2 hover:underline dark:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-2 p-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && list.length === 0 && (
        <Card className="grid place-items-center p-8 text-center">
          <UserCog className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            No scorers yet
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Create a scorer account and assign them to one of your leagues.
            They will only be able to score matches in leagues you assign them
            to.
          </p>
          <Button
            size="sm"
            onClick={openCreate}
            className="mt-4 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            New Scorer
          </Button>
        </Card>
      )}

      {!loading && !error && list.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className={cn("max-h-[60vh] overflow-y-auto", SCROLLBAR)}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Leagues
                    </TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {s.username}
                      </TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <LeagueBadges
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
                          <Badge
                            variant="outline"
                            className="gap-1 text-muted-foreground"
                          >
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-emerald-600" />
              {editingId ? "Edit Scorer" : "New Scorer"}
            </DialogTitle>
          </DialogHeader>

          {!editingId ? (
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="sc-username">Username</Label>
                <Input
                  id="sc-username"
                  value={createForm.username}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      username: e.target.value,
                    }))
                  }
                  placeholder="e.g. njohnson"
                  disabled={saving}
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Used by the scorer to sign in. Must be unique.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sc-email">
                  Email{" "}
                  <span className="font-normal text-red-600">*</span>
                </Label>
                <Input
                  id="sc-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      email: e.target.value,
                    }))
                  }
                  placeholder="scorer@league.org"
                  disabled={saving}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sc-name">Display name</Label>
                <Input
                  id="sc-name"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Nick Johnson"
                  disabled={saving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sc-password">Password</Label>
                <Input
                  id="sc-password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      password: e.target.value,
                    }))
                  }
                  placeholder="Set a temporary password"
                  disabled={saving}
                  autoComplete="new-password"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="sc-series">Assign to league</Label>
                <Select
                  value={createForm.seriesId}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, seriesId: v }))
                  }
                  disabled={saving || allSeries.length === 0}
                >
                  <SelectTrigger id="sc-series" className="w-full">
                    <SelectValue
                      placeholder={
                        allSeries.length === 0
                          ? "No managed leagues"
                          : "Pick a league…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className={cn("max-h-72", SCROLLBAR)}>
                    {allSeries.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.shortName} · {s.format})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  The scorer will be able to score matches in this league.
                  Assign more leagues later from the edit dialog.
                </p>
              </div>

              <label className="flex w-fit items-center gap-2 pt-1 text-sm font-medium">
                <Switch
                  checked={createForm.active}
                  onCheckedChange={(c) =>
                    setCreateForm((f) => ({ ...f, active: c }))
                  }
                  disabled={saving}
                />
                Active
                <span className="text-[11px] font-normal text-muted-foreground">
                  (inactive scorers cannot sign in)
                </span>
              </label>
            </div>
          ) : (
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="se-email">
                  Email{" "}
                  <span className="font-normal text-red-600">*</span>
                </Label>
                <Input
                  id="se-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="scorer@league.org"
                  disabled={saving}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="se-name">Display name</Label>
                <Input
                  id="se-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Nick Johnson"
                  disabled={saving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="se-password">
                  New password{" "}
                  <span className="font-normal text-muted-foreground">
                    (leave blank to keep current)
                  </span>
                </Label>
                <Input
                  id="se-password"
                  type="password"
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Leave blank to keep"
                  disabled={saving}
                  autoComplete="new-password"
                />
              </div>

              <label className="flex w-fit items-center gap-2 pt-1 text-sm font-medium">
                <Switch
                  checked={editForm.active}
                  onCheckedChange={(c) =>
                    setEditForm((f) => ({ ...f, active: c }))
                  }
                  disabled={saving}
                />
                Active
              </label>

              <div className="grid gap-2 pt-2">
                <Label>Assigned leagues</Label>
                <p className="text-[11px] text-muted-foreground">
                  The scorer can only score matches in the leagues you select
                  here. All assignments must be within leagues you manage.
                </p>
                {allSeries.length === 0 ? (
                  <p className="rounded-md border bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
                    You have no managed leagues.
                  </p>
                ) : (
                  <div
                    className={cn(
                      "max-h-56 overflow-y-auto rounded-md border bg-card p-2",
                      SCROLLBAR
                    )}
                  >
                    <ul className="space-y-1">
                      {allSeries.map((s) => {
                        const checked = editForm.tournamentIds.includes(s.id)
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
                                onCheckedChange={() =>
                                  toggleTournamentInEdit(s.id)
                                }
                              />
                              <span className="min-w-0 flex-1 truncate font-medium">
                                {s.name}
                              </span>
                              <Badge
                                variant="secondary"
                                className="shrink-0 text-[10px]"
                              >
                                {s.format}
                              </Badge>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {editForm.tournamentIds.length} selected
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={saving}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editingId ? (
                "Save Changes"
              ) : (
                "Create Scorer"
              )}
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
              The scorer will immediately lose access and will no longer be
              able to sign in. Their league assignments will be removed. This
              cannot be undone.
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
    </LeagueAdminShell>
  )
}

/* --------------------------------- bits --------------------------------- */

function LeagueBadges({
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
        {ids.map((sid) => {
          const s = lookup[sid]
          return (
            <Badge
              key={sid}
              variant="outline"
              className="text-[10px] font-medium"
            >
              {s?.shortName ?? sid.slice(0, 6)}
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
