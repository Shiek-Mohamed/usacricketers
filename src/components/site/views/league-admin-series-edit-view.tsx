"use client"

import { useEffect, useMemo, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  Trash2,
  Save,
  Loader2,
  ShieldAlert,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { TeamBadge } from "@/components/cricket/ui"
import type { Series, Team } from "@/lib/types"
import { LeagueSwitcher } from "@/components/site/league-switcher"

const FORMATS = ["T20", "ODI", "Test", "T10"] as const
const STATUSES = ["upcoming", "ongoing", "completed"] as const

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"

interface FormState {
  name: string
  shortName: string
  format: string
  season: string
  status: string
  startDate: string
  endDate: string
  description: string
}

function emptyForm(): FormState {
  const year = new Date().getFullYear().toString()
  const today = new Date().toISOString().slice(0, 10)
  const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60)
    .toISOString()
    .slice(0, 10)
  return {
    name: "",
    shortName: "",
    format: "T20",
    season: year,
    status: "upcoming",
    startDate: today,
    endDate: end,
    description: "",
  }
}

function toDateInput(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return ""
  }
}

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

export function LeagueAdminSeriesEditView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const session = useLeagueAdminSession((s) => s.session)
  const token = session?.token ?? null
  const isNew = !id || id === "new"

  const [form, setForm] = useState<FormState>(emptyForm)
  const [series, setSeries] = useState<Series | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addExistingTeamId, setAddExistingTeamId] = useState<string>("")

  // new-team inline form
  const [newTeam, setNewTeam] = useState({
    name: "",
    shortName: "",
    country: "",
    primaryColor: "#1e3a8a",
    accentColor: "#f59e0b",
  })
  const [addingTeam, setAddingTeam] = useState(false)

  // nonce for refreshing teams list after a change
  const [teamNonce, setTeamNonce] = useState(0)

  // Load the existing series + its teams (+ all teams list) when editing.
  useEffect(() => {
    if (isNew || !token || !id) {
      setLoading(false)
      return
    }
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const headers = { Authorization: `Bearer ${token}` }
        const [sRes, tRes, aRes] = await Promise.all([
          fetch(`/api/league-admin/series/${id}`, { headers }),
          fetch(`/api/league-admin/series/${id}/teams`, { headers }),
          fetch(`/api/league-admin/teams`, { headers }),
        ])
        if (!active) return
        if (sRes.status === 401) {
          setError("Your session has expired. Please sign in again.")
          return
        }
        if (sRes.status === 403) {
          setError("You do not manage this league.")
          return
        }
        if (sRes.status === 404) {
          setError("League not found.")
          return
        }
        if (!sRes.ok) {
          setError(`Failed to load league (${sRes.status})`)
          return
        }
        const s = (await sRes.json()) as Series
        setSeries(s)
        setForm({
          name: s.name,
          shortName: s.shortName,
          format: s.format,
          season: s.season,
          status: s.status,
          startDate: toDateInput(s.startDate),
          endDate: toDateInput(s.endDate),
          description: s.description,
        })
        if (tRes.ok) setTeams((await tRes.json()) as Team[])
        if (aRes.ok) setAllTeams((await aRes.json()) as Team[])
      } catch {
        if (!active) return
        setError("Network error — could not load league")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [token, id, isNew, teamNonce])

  // Refresh just the teams list (after add/remove) without reloading the form.
  async function reloadTeams() {
    if (!token || !id || isNew) return
    try {
      const tRes = await fetch(`/api/league-admin/series/${id}/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (tRes.ok) setTeams((await tRes.json()) as Team[])
      const aRes = await fetch(`/api/league-admin/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (aRes.ok) setAllTeams((await aRes.json()) as Team[])
    } catch {
      // ignore background refresh errors
    }
  }

  // Teams not already in this league (for the "add existing" select).
  const availableTeams = useMemo(() => {
    const inIds = new Set(teams.map((t) => t.id))
    return allTeams.filter((t) => !inIds.has(t.id))
  }, [allTeams, teams])

  if (!session) return null

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!token) return
    if (!form.name.trim()) {
      toast.error("League name is required")
      return
    }
    const payload: FormState = {
      ...form,
      name: form.name.trim(),
      shortName: form.shortName.trim() || form.name.trim().slice(0, 10),
      season: form.season.trim() || new Date().getFullYear().toString(),
    }
    setSaving(true)
    try {
      if (isNew) {
        const created = await jsonOrThrow<Series>(
          await fetch(`/api/league-admin/series`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          })
        )
        toast.success("League created", {
          description: created.name,
        })
        navigate("league-admin-home")
      } else if (id) {
        await jsonOrThrow<Series>(
          await fetch(`/api/league-admin/series/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          })
        )
        toast.success("League saved")
        setTeamNonce((n) => n + 1)
      }
    } catch (e) {
      toast.error("Failed to save league", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!token || !id || isNew) return
    try {
      await jsonOrThrow(
        await fetch(`/api/league-admin/series/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      toast.success("League deleted")
      navigate("league-admin-home")
    } catch (e) {
      toast.error("Failed to delete league", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setConfirmDelete(false)
    }
  }

  async function handleAddExistingTeam() {
    if (!token || !id || isNew) return
    if (!addExistingTeamId) {
      toast.error("Pick a team to add")
      return
    }
    if (teams.some((t) => t.id === addExistingTeamId)) {
      toast.info("That team is already in this league")
      return
    }
    setAddingTeam(true)
    try {
      await jsonOrThrow<Team>(
        await fetch(`/api/league-admin/series/${id}/teams`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ teamId: addExistingTeamId }),
        })
      )
      toast.success("Team added")
      setAddExistingTeamId("")
      await reloadTeams()
    } catch (e) {
      toast.error("Failed to add team", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setAddingTeam(false)
    }
  }

  async function handleAddNewTeam() {
    if (!token || !id || isNew) return
    if (!newTeam.name.trim()) {
      toast.error("Team name is required")
      return
    }
    setAddingTeam(true)
    try {
      const created = await jsonOrThrow<Team>(
        await fetch(`/api/league-admin/series/${id}/teams`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newTeam.name.trim(),
            shortName:
              newTeam.shortName.trim() ||
              newTeam.name.trim().slice(0, 4).toUpperCase(),
            country: newTeam.country.trim(),
            primaryColor: newTeam.primaryColor,
            accentColor: newTeam.accentColor,
          }),
        })
      )
      toast.success("Team created & added", {
        description: created.name,
      })
      setNewTeam({
        name: "",
        shortName: "",
        country: "",
        primaryColor: "#1e3a8a",
        accentColor: "#f59e0b",
      })
      await reloadTeams()
    } catch (e) {
      toast.error("Failed to create team", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setAddingTeam(false)
    }
  }

  async function handleRemoveTeam(teamId: string) {
    if (!token || !id || isNew) return
    try {
      await jsonOrThrow(
        await fetch(
          `/api/league-admin/series/${id}/teams?teamId=${encodeURIComponent(teamId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        )
      )
      toast.success("Team removed")
      await reloadTeams()
    } catch (e) {
      toast.error("Failed to remove team", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  if (loading) {
    return (
      <LeagueAdminShell
        title={isNew ? "New League" : "Edit League"}
        onBack={() => navigate("league-admin-home")}
      >
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </LeagueAdminShell>
    )
  }

  if (error && !isNew) {
    return (
      <LeagueAdminShell
        title="Edit League"
        onBack={() => navigate("league-admin-home")}
      >
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      </LeagueAdminShell>
    )
  }

  return (
    <LeagueAdminShell
      title={isNew ? "New League" : series?.name ?? "Edit League"}
      onBack={() => navigate("league-admin-home")}
      actionLabel={isNew ? "Create League" : "Save Changes"}
      onAction={handleSave}
    >
      {!isNew && <LeagueSwitcher />}
      {/* League details */}
      <Card>
        <CardHeader className="gap-1.5">
          <CardTitle className="text-base">League details</CardTitle>
          <CardDescription className="text-xs">
            {isNew
              ? "Create a new league. You will be auto-assigned as the owner."
              : "Update the league information."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="la-name">Name *</Label>
            <Input
              id="la-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Major League Cricket 2025"
              disabled={saving}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="la-shortName">Short name</Label>
            <Input
              id="la-shortName"
              value={form.shortName}
              onChange={(e) => set("shortName", e.target.value)}
              placeholder={form.name.slice(0, 10) || "MLC 2025"}
              disabled={saving}
              maxLength={12}
            />
            <p className="text-[11px] text-muted-foreground">
              Defaults to the first 10 chars of the name.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="la-format">Format</Label>
            <Select
              value={form.format}
              onValueChange={(v) => set("format", v)}
              disabled={saving}
            >
              <SelectTrigger id="la-format" className="w-full">
                <SelectValue placeholder="Format" />
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
            <Label htmlFor="la-season">Season</Label>
            <Input
              id="la-season"
              value={form.season}
              onChange={(e) => set("season", e.target.value)}
              placeholder="2025"
              disabled={saving}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="la-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v)}
              disabled={saving}
            >
              <SelectTrigger id="la-status" className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="la-start">Start date</Label>
            <Input
              id="la-start"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="la-end">End date</Label>
            <Input
              id="la-end"
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="la-desc">Description</Label>
            <Textarea
              id="la-desc"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional description / rules / prize notes"
              disabled={saving}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save row (mobile-friendly: action button is in the shell header) */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("league-admin-home")}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {isNew ? "Create League" : "Save Changes"}
            </>
          )}
        </Button>
      </div>

      {/* Team management — only when editing an existing league */}
      {!isNew && (
        <Card>
          <CardHeader className="gap-1.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Teams in this league
            </CardTitle>
            <CardDescription className="text-xs">
              {teams.length} team{teams.length === 1 ? "" : "s"} · add existing
              teams or create new ones inline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current teams as removable chips */}
            {teams.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                No teams in this league yet. Add an existing team or create a
                new one below.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {teams.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-full border bg-card py-1 pl-1.5 pr-2 text-xs"
                  >
                    <TeamBadge team={t} size="sm" />
                    <span className="font-semibold">{t.shortName}</span>
                    <span className="hidden text-muted-foreground sm:inline">
                      {t.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTeam(t.id)}
                      disabled={addingTeam}
                      aria-label={`Remove ${t.name}`}
                      className="ml-1 grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add existing team */}
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">
                Add existing team
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={addExistingTeamId}
                  onValueChange={setAddExistingTeamId}
                  disabled={addingTeam || availableTeams.length === 0}
                >
                  <SelectTrigger className="min-w-[14rem] flex-1">
                    <SelectValue
                      placeholder={
                        availableTeams.length === 0
                          ? "All teams already in this league"
                          : "Pick a team…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                    className={cn("max-h-72", SCROLLBAR)}
                  >
                    {availableTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
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
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAddExistingTeam}
                  disabled={addingTeam || !addExistingTeamId}
                  className="gap-1.5"
                >
                  {addingTeam ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add
                </Button>
              </div>
            </div>

            {/* Add new team inline */}
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">
                Create a new team
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="nt-name" className="text-xs">
                    Name *
                  </Label>
                  <Input
                    id="nt-name"
                    value={newTeam.name}
                    onChange={(e) =>
                      setNewTeam((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Texas Super Kings"
                    disabled={addingTeam}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="nt-short" className="text-xs">
                    Short name
                  </Label>
                  <Input
                    id="nt-short"
                    value={newTeam.shortName}
                    onChange={(e) =>
                      setNewTeam((f) => ({ ...f, shortName: e.target.value }))
                    }
                    placeholder="TSK"
                    disabled={addingTeam}
                    maxLength={6}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="nt-country" className="text-xs">
                    Country
                  </Label>
                  <Input
                    id="nt-country"
                    value={newTeam.country}
                    onChange={(e) =>
                      setNewTeam((f) => ({ ...f, country: e.target.value }))
                    }
                    placeholder="USA"
                    disabled={addingTeam}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="nt-pc" className="text-xs">
                      Primary
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="nt-pc"
                        type="color"
                        value={newTeam.primaryColor}
                        onChange={(e) =>
                          setNewTeam((f) => ({
                            ...f,
                            primaryColor: e.target.value,
                          }))
                        }
                        disabled={addingTeam}
                        className="h-8 w-10 cursor-pointer rounded border bg-transparent"
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {newTeam.primaryColor}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="nt-ac" className="text-xs">
                      Accent
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="nt-ac"
                        type="color"
                        value={newTeam.accentColor}
                        onChange={(e) =>
                          setNewTeam((f) => ({
                            ...f,
                            accentColor: e.target.value,
                          }))
                        }
                        disabled={addingTeam}
                        className="h-8 w-10 cursor-pointer rounded border bg-transparent"
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {newTeam.accentColor}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAddNewTeam}
                  disabled={addingTeam || !newTeam.name.trim()}
                  className="gap-1.5"
                >
                  {addingTeam ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create &amp; add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete league — only when editing */}
      {!isNew && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold">Delete this league</p>
              <p className="text-xs text-muted-foreground">
                Removes the league, its team assignments and all matches in it.
                This cannot be undone.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="gap-1.5 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete League
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this league?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{series?.name ?? "this league"}&rdquo;
              along with its team assignments and scheduled matches. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LeagueAdminShell>
  )
}
