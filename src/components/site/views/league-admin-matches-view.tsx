"use client"

import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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
  CalendarDays,
  Trophy,
  ShieldAlert,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  TeamBadge,
  FormatPill,
  StatusPill,
  formatMatchDate,
} from "@/components/cricket/ui"
import type { Match, Series, Team } from "@/lib/types"
import { LeagueSwitcher } from "@/components/site/league-switcher"

const FORMATS = ["T20", "ODI", "Test", "T10"] as const
const MATCH_STATUSES = [
  "upcoming",
  "live",
  "completed",
  "abandoned",
] as const

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

interface MatchForm {
  team1Id: string
  team2Id: string
  format: string
  matchNo: string
  status: string
  venue: string
  city: string
  startDate: string // datetime-local value
}

function emptyMatchForm(): MatchForm {
  const now = new Date()
  // local datetime string YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, "0")
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  return {
    team1Id: "",
    team2Id: "",
    format: "T20",
    matchNo: "",
    status: "upcoming",
    venue: "",
    city: "",
    startDate: local,
  }
}

function toDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ""
  }
}

export function LeagueAdminMatchesView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const session = useLeagueAdminSession((s) => s.session)
  const token = session?.token ?? null

  const [series, setSeries] = useState<Series | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // nonce/doneNonce pattern
  const [nonce, setNonce] = useState(0)
  const [doneNonce, setDoneNonce] = useState(-1)
  const stillLoading = token ? nonce !== doneNonce : false

  // dialog state
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MatchForm>(emptyMatchForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Load series + matches + teams
  useEffect(() => {
    if (!token || !id) return
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [sRes, mRes, tRes] = await Promise.all([
          fetch(`/api/league-admin/series/${id}`, { headers }),
          fetch(`/api/league-admin/matches?seriesId=${id}`, { headers }),
          fetch(`/api/league-admin/series/${id}/teams`, { headers }),
        ])
        if (!active) return
        if (sRes.status === 403) {
          setError("You do not manage this league.")
          setSeries(null)
          setMatches([])
          setTeams([])
        } else if (sRes.status === 404) {
          setError("League not found.")
          setSeries(null)
          setMatches([])
          setTeams([])
        } else if (!sRes.ok) {
          setError(`Failed to load league (${sRes.status})`)
          setSeries(null)
          setMatches([])
          setTeams([])
        } else {
          const s = (await sRes.json()) as Series
          setSeries(s)
          setTeams(s.teams ?? [])
          if (mRes.ok) setMatches((await mRes.json()) as Match[])
          if (tRes.ok) {
            const t = (await tRes.json()) as Team[]
            if (t.length > 0) setTeams(t)
          }
        }
      } catch {
        if (!active) return
        setError("Network error — could not load schedule")
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
  }, [token, id, nonce])

  function reload() {
    setNonce((n) => n + 1)
  }

  const list = matches ?? []
  const sorted = useMemo(
    () =>
      [...list].sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      ),
    [list]
  )

  if (!session) return null

  function set<K extends keyof MatchForm>(k: K, v: MatchForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyMatchForm())
    setOpen(true)
  }

  function openEdit(m: Match) {
    setEditingId(m.id)
    setForm({
      team1Id: m.team1Id,
      team2Id: m.team2Id,
      format: m.format,
      matchNo: m.matchNo,
      status: m.status,
      venue: m.venue,
      city: m.city,
      startDate: toDatetimeLocal(m.startDate),
    })
    setOpen(true)
  }

  async function handleSubmit() {
    if (!token || !id) return
    if (!form.team1Id || !form.team2Id) {
      toast.error("Pick both teams")
      return
    }
    if (form.team1Id === form.team2Id) {
      toast.error("Team 1 and Team 2 must be different")
      return
    }
    if (!form.matchNo.trim()) {
      toast.error("Match number is required (e.g. 1st Match)")
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        seriesId: id,
        team1Id: form.team1Id,
        team2Id: form.team2Id,
        format: form.format,
        matchNo: form.matchNo.trim(),
        status: form.status,
        venue: form.venue,
        city: form.city,
        startDate: form.startDate
          ? new Date(form.startDate).toISOString()
          : undefined,
      }
      if (editingId) {
        // PUT ignores seriesId (immutable), so we send the same payload.
        await jsonOrThrow<Match>(
          await fetch(`/api/league-admin/matches/${editingId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          })
        )
        toast.success("Match saved")
      } else {
        await jsonOrThrow<Match>(
          await fetch(`/api/league-admin/matches`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          })
        )
        toast.success("Match created")
      }
      setOpen(false)
      reload()
    } catch (e) {
      toast.error("Failed to save match", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(mid: string) {
    if (!token) return
    try {
      await jsonOrThrow(
        await fetch(`/api/league-admin/matches/${mid}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      toast.success("Match deleted")
      reload()
    } catch (e) {
      toast.error("Failed to delete match", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <LeagueAdminShell
      title={series ? `${series.name} · Schedule` : "Schedule"}
      onBack={() => navigate("league-admin-series-edit", id)}
      actionLabel="+ New Match"
      onAction={openCreate}
    >
      <LeagueSwitcher />
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {series && <FormatPill format={series.format} />}
          <span>
            {teams.length} team{teams.length === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <span>
            {list.length} match{list.length === 1 ? "" : "es"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={reload}
          disabled={stillLoading}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Refresh schedule"
        >
          <RefreshCw
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
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && list.length === 0 && (
        <Card className="grid place-items-center p-8 text-center">
          <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            No matches scheduled yet
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Click &ldquo;+ New Match&rdquo; to add a fixture. Both teams must
            already be participants in this league.
          </p>
          {teams.length < 2 ? (
            <p className="mt-3 text-xs text-amber-700">
              You need at least 2 teams in this league before you can schedule
              a match.
            </p>
          ) : (
            <Button
              size="sm"
              onClick={openCreate}
              className="mt-4 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              New Match
            </Button>
          )}
        </Card>
      )}

      {!loading && !error && sorted.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className={cn("max-h-[60vh] overflow-y-auto", SCROLLBAR)}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Format
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Date / Time
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="align-top font-mono text-xs text-muted-foreground">
                        {m.matchNo}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            {m.team1 && <TeamBadge team={m.team1} size="sm" />}
                            <span className="text-sm font-semibold">
                              {m.team1?.shortName ?? "TBD"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">v</span>
                          <div className="flex items-center gap-1.5">
                            {m.team2 && <TeamBadge team={m.team2} size="sm" />}
                            <span className="text-sm font-semibold">
                              {m.team2?.shortName ?? "TBD"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-0.5 block text-[11px] text-muted-foreground lg:hidden">
                          {m.venue || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="hidden align-top md:table-cell">
                        <FormatPill format={m.format} />
                      </TableCell>
                      <TableCell className="hidden align-top text-xs text-muted-foreground sm:table-cell">
                        {formatMatchDate(m.startDate)}
                      </TableCell>
                      <TableCell className="hidden align-top text-xs text-muted-foreground lg:table-cell">
                        {m.venue || "—"}
                        {m.city ? `, ${m.city}` : ""}
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusPill status={m.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right align-top">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(m)}
                          aria-label="Edit match"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteId(m.id)}
                          className="text-destructive"
                          aria-label="Delete match"
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
              <Trophy className="h-4 w-4 text-emerald-600" />
              {editingId ? "Edit Match" : "New Match"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {teams.length < 2 ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                This league has fewer than 2 teams. Add teams on the league edit
                page before scheduling matches.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="m-team1" className="text-xs">
                  Team 1
                </Label>
                <Select
                  value={form.team1Id}
                  onValueChange={(v) => set("team1Id", v)}
                  disabled={saving}
                >
                  <SelectTrigger id="m-team1" className="w-full">
                    <SelectValue placeholder="Pick team…" />
                  </SelectTrigger>
                  <SelectContent className={cn("max-h-72", SCROLLBAR)}>
                    {teams.map((t) => (
                      <SelectItem
                        key={t.id}
                        value={t.id}
                        disabled={t.id === form.team2Id}
                      >
                        <span className="flex items-center gap-2">
                          <TeamBadge team={t} size="sm" />
                          <span>
                            {t.shortName}{" "}
                            <span className="text-muted-foreground">
                              · {t.name}
                            </span>
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-team2" className="text-xs">
                  Team 2
                </Label>
                <Select
                  value={form.team2Id}
                  onValueChange={(v) => set("team2Id", v)}
                  disabled={saving}
                >
                  <SelectTrigger id="m-team2" className="w-full">
                    <SelectValue placeholder="Pick team…" />
                  </SelectTrigger>
                  <SelectContent className={cn("max-h-72", SCROLLBAR)}>
                    {teams.map((t) => (
                      <SelectItem
                        key={t.id}
                        value={t.id}
                        disabled={t.id === form.team1Id}
                      >
                        <span className="flex items-center gap-2">
                          <TeamBadge team={t} size="sm" />
                          <span>
                            {t.shortName}{" "}
                            <span className="text-muted-foreground">
                              · {t.name}
                            </span>
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="m-format" className="text-xs">
                  Format
                </Label>
                <Select
                  value={form.format}
                  onValueChange={(v) => set("format", v)}
                  disabled={saving}
                >
                  <SelectTrigger id="m-format" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-status" className="text-xs">
                  Status
                </Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => set("status", v)}
                  disabled={saving}
                >
                  <SelectTrigger id="m-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="m-matchno" className="text-xs">
                  Match No.
                </Label>
                <Input
                  id="m-matchno"
                  value={form.matchNo}
                  onChange={(e) => set("matchNo", e.target.value)}
                  placeholder="e.g. 1st Match"
                  disabled={saving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-start" className="text-xs">
                  Start date / time
                </Label>
                <Input
                  id="m-start"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="m-venue" className="text-xs">
                  Venue
                </Label>
                <Input
                  id="m-venue"
                  value={form.venue}
                  onChange={(e) => set("venue", e.target.value)}
                  placeholder="e.g. Grand Prairie Stadium"
                  disabled={saving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="m-city" className="text-xs">
                  City
                </Label>
                <Input
                  id="m-city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="e.g. Dallas"
                  disabled={saving}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || teams.length < 2}
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
                "Create Match"
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
            <AlertDialogTitle>Delete this match?</AlertDialogTitle>
            <AlertDialogDescription>
              The match will be permanently removed from the schedule. The
              associated scorecard (if any) will be lost. This cannot be undone.
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
