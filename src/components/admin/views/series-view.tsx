"use client"

import { useState } from "react"
import { useSeries, useTeams, useMatches } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
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
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus, Pencil, Trash2, Save, ArrowLeft, Trophy, Users, X, Radio,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Series, Team } from "@/lib/types"
import { BulkPlayersDialog } from "@/components/admin/bulk-players/bulk-players-dialog"
import { parsePlayerRows } from "@/components/admin/bulk-players/bulk-players-dialog"

const SCROLLBAR = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
const FORMATS = ["Test", "ODI", "T20I", "T10", "T25", "T30", "T35"] as const
const STATUSES = ["upcoming", "ongoing", "completed"] as const

export function AdminSeriesView() {
  const { data, loading, refetch } = useSeries()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const navigate = useAppStore((s) => s.navigate)

  function openCreate() { setCreating(true); setEditingId(null) }
  function openEdit(id: string) { setEditingId(id); setCreating(false) }
  function close() { setEditingId(null); setCreating(false) }

  const editing = data?.find((s) => s.id === editingId)

  if (creating || editing) {
    return (
      <TournamentEditor
        tournament={editing ?? null}
        onSave={async () => { await refetch(); close() }}
        onRefresh={async () => { await refetch() }}
        onCancel={close}
        onScoreMatch={(matchId: string) => navigate("live-scorer", matchId)}
      />
    )
  }

  return (
    <AdminShell title="Tournaments" count={data?.length} actionLabel="+ New Tournament" onAction={openCreate}>
      <Card>
        <CardContent className="p-0">
          <div className={cn("max-h-[60vh] overflow-y-auto", SCROLLBAR)}>
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-center">Teams</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : (data ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No tournaments yet. Click “New Tournament” to create one.</TableCell></TableRow>
                ) : (
                  (data ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge variant="secondary">{s.format}</Badge></TableCell>
                      <TableCell className="text-center">{s.teams?.length ?? 0}</TableCell>
                      <TableCell className="capitalize text-xs">{s.status}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s.id)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(s.id)} className="text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this tournament?</AlertDialogTitle><AlertDialogDescription>All matches in this tournament will have their series cleared (not deleted).</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={async () => { if (deleteId) { await api.series.remove(deleteId); toast.success("Tournament deleted"); refetch(); } setDeleteId(null); }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  )
}

/* ---------------- Tournament Editor (full page) ---------------- */

function TournamentEditor({
  tournament, onSave, onRefresh, onCancel, onScoreMatch,
}: {
  tournament: Series | null
  onSave: () => void
  onRefresh: () => void
  onCancel: () => void
  onScoreMatch: (matchId: string) => void
}) {
  const teamsApi = useTeams()
  const matchesApi = useMatches()
  const navigate = useAppStore((s) => s.navigate)

  const [name, setName] = useState(tournament?.name ?? "")
  const [shortName, setShortName] = useState(tournament?.shortName ?? "")
  const [format, setFormat] = useState(tournament?.format ?? "T20I")
  const [season, setSeason] = useState(tournament?.season ?? "2025")
  const [status, setStatus] = useState(tournament?.status ?? "upcoming")
  const [description, setDescription] = useState(tournament?.description ?? "")
  const [startDate, setStartDate] = useState(tournament?.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(tournament?.endDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  // New-team quick-create form
  const [newTeamName, setNewTeamName] = useState("")
  const [newTeamShort, setNewTeamShort] = useState("")
  const [newTeamColor, setNewTeamColor] = useState("#1e3a8a")
  const [addingTeam, setAddingTeam] = useState(false)
  // Optional: bulk players to add alongside the new team at creation time.
  const [newTeamPlayersText, setNewTeamPlayersText] = useState("")

  // Add-existing-team select
  const [addExistingId, setAddExistingId] = useState("")

  // Bulk-players dialog target (a team that's already in the tournament)
  const [bulkFor, setBulkFor] = useState<Team | null>(null)

  const tournamentTeams = tournament?.teams ?? []
  const allTeams = teamsApi.data ?? []
  const availableTeams = allTeams.filter((t) => !tournamentTeams.some((tt) => tt.id === t.id))
  const tournamentMatches = (matchesApi.data ?? []).filter((m) => m.seriesId === tournament?.id)

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      const payload = { name, shortName: shortName || name.slice(0, 20), format, season, status, description, startDate, endDate }
      if (tournament) { await api.series.update(tournament.id, payload); toast.success("Tournament saved") }
      else { await api.series.create(payload); toast.success("Tournament created") }
      onSave()
    } catch (e) { toast.error("Failed to save", { description: String(e) }) }
    finally { setSaving(false) }
  }

  async function addExistingTeam() {
    if (!addExistingId || !tournament) return
    setAddingTeam(true)
    try {
      await api.series.addTeam(tournament.id, { teamId: addExistingId })
      toast.success("Team added to tournament")
      setAddExistingId("")
      onRefresh()
    } catch (e) { toast.error("Failed to add team") }
    finally { setAddingTeam(false) }
  }

  async function createNewTeam() {
    if (!newTeamName.trim() || !tournament) return
    setAddingTeam(true)
    try {
      // 1. Create the team and add it to the tournament in a single call.
      const createdTeam = await api.series.addTeam(tournament.id, {
        name: newTeamName,
        shortName: (newTeamShort || newTeamName).toUpperCase().slice(0, 4),
        primaryColor: newTeamColor,
      })
      // 2. If the admin pasted player rows, bulk-add them to the new team.
      const rows = parsePlayerRows(newTeamPlayersText)
      if (rows.length > 0) {
        try {
          const result = await api.players.bulkCreate(
            createdTeam.id,
            rows.map((r) => ({
              name: r.name,
              role: r.role,
              isCaptain: r.isCaptain,
              isKeeper: r.isKeeper,
              battingStyle: r.battingStyle,
              bowlingStyle: r.bowlingStyle,
            }))
          )
          toast.success(
            `Team "${newTeamName}" created + added — ${result.created} player${result.created === 1 ? "" : "s"} imported` +
              (result.skipped > 0 ? `, ${result.skipped} skipped` : "")
          )
        } catch (e) {
          toast.warning(
            `Team "${newTeamName}" created, but player import failed`,
            { description: String(e) }
          )
        }
      } else {
        toast.success(`Team "${newTeamName}" created + added`)
      }
      setNewTeamName("")
      setNewTeamShort("")
      setNewTeamColor("#1e3a8a")
      setNewTeamPlayersText("")
      onRefresh()
    } catch (e) {
      toast.error("Failed to create team")
    } finally {
      setAddingTeam(false)
    }
  }

  async function removeTeam(teamId: string) {
    if (!tournament) return
    await api.series.removeTeam(tournament.id, teamId)
    toast.success("Team removed from tournament")
    onRefresh()
  }

  async function createMatchAndScore() {
    if (!tournament || tournamentTeams.length < 2) { toast.error("Add at least 2 teams first"); return }
    try {
      const match = await api.matches.create({
        seriesId: tournament.id,
        team1Id: tournamentTeams[0].id,
        team2Id: tournamentTeams[1].id,
        format: tournament.format,
        matchNo: `${tournamentMatches.length + 1}${ordinal(tournamentMatches.length + 1)} Match`,
        status: "upcoming",
        venue: "TBD",
        startDate: new Date().toISOString(),
      })
      toast.success("Match created — opening Live Scorer")
      onScoreMatch(match.id)
    } catch (e) { toast.error("Failed to create match") }
  }

  return (
    <AdminShell title={tournament ? "Edit Tournament" : "New Tournament"} actionLabel={undefined} onAction={undefined}>
      <div className="space-y-5">
        <Button variant="ghost" size="sm" onClick={onCancel} className="-ml-2 gap-1"><ArrowLeft className="h-4 w-4" /> Back to tournaments</Button>

        {/* Details */}
        <Card><CardContent className="grid gap-4 p-4 sm:p-6">
          <div className="grid gap-1.5"><Label htmlFor="t-name">Tournament name</Label><Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday T20 League 2025" /></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="grid gap-1.5"><Label>Short name</Label><Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="STL 2025" /></div>
            <div className="grid gap-1.5"><Label>Format</Label><Select value={format} onValueChange={setFormat}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-1.5"><Label>Season</Label><Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2025" /></div>
            <div className="grid gap-1.5"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="t-desc">Description</Label><Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        </CardContent></Card>

        {/* Teams */}
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-600" /><h2 className="text-base font-bold">Teams ({tournamentTeams.length})</h2></div>

            {tournamentTeams.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tournamentTeams.map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-2 rounded-full border bg-muted/30 py-1 pl-2 pr-1">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: t.primaryColor }}>{t.shortName.slice(0, 2)}</span>
                    <span className="text-xs font-medium">{t.name}</span>
                    <button
                      type="button"
                      onClick={() => setBulkFor(t)}
                      title="Bulk add players to this team"
                      className="grid h-5 w-5 place-items-center rounded-full text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    >
                      <Users className="h-3 w-3" />
                    </button>
                    <button onClick={() => removeTeam(t.id)} className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No teams yet. Add existing teams or create new ones below.</p>
            )}

            {/* Add existing team */}
            {availableTeams.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={addExistingId} onValueChange={setAddExistingId}>
                  <SelectTrigger className="h-9 w-52 text-sm"><SelectValue placeholder="Add existing team…" /></SelectTrigger>
                  <SelectContent>{availableTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" onClick={addExistingTeam} disabled={addingTeam || !addExistingId} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
              </div>
            )}

            {/* Quick-create new team */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Create a new team</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team name" className="h-9 w-40 text-sm" />
                <Input value={newTeamShort} onChange={(e) => setNewTeamShort(e.target.value)} placeholder="ABBR" maxLength={4} className="h-9 w-16 text-sm uppercase" />
                <input type="color" value={newTeamColor} onChange={(e) => setNewTeamColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border" title="Team color" />
                <Button type="button" variant="outline" size="sm" onClick={createNewTeam} disabled={addingTeam || !newTeamName.trim()} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Create &amp; Add</Button>
              </div>
              {/* Optional bulk players for the new team — parsed + added in one shot alongside team creation */}
              <div className="mt-3 grid gap-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Players (optional — one per line, or CSV: name, role, bat, bowl)
                </label>
                <Textarea
                  value={newTeamPlayersText}
                  onChange={(e) => setNewTeamPlayersText(e.target.value)}
                  rows={4}
                  placeholder={
                    [
                      "Babar Azam, Batsman, Right-hand bat",
                      "Shaheen Afridi, Bowler, Left-hand bat, Left-arm fast",
                      "Mohammad Rizwan, Wicket-keeper",
                      "",
                      "# or just names:",
                      "Shadab Khan",
                    ].join("\n")
                  }
                  className="font-mono text-xs"
                />
                {newTeamPlayersText.trim() && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {parsePlayerRows(newTeamPlayersText).length} player{parsePlayerRows(newTeamPlayersText).length === 1 ? "" : "s"} will be imported when the team is created.
                  </p>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Tip: you can also bulk-add players to an existing tournament team using the green <Users className="inline h-3 w-3 -translate-y-0.5" /> button on each team chip above.</p>
            </div>
          </CardContent>
        </Card>

        {/* Matches + Score */}
        {tournament && (
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold"><Trophy className="h-5 w-5 text-emerald-600" /> Matches ({tournamentMatches.length})</h2>
                <Button size="sm" onClick={createMatchAndScore} disabled={tournamentTeams.length < 2} className="gap-1.5 bg-red-600 text-white hover:bg-red-700">
                  <Radio className="h-3.5 w-3.5" /> Create match &amp; score live
                </Button>
              </div>
              {tournamentTeams.length < 2 && <p className="text-xs text-amber-600">Add at least 2 teams to create a match.</p>}
              {tournamentMatches.length > 0 && (
                <div className="space-y-1 text-sm">
                  {tournamentMatches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span>{m.matchNo} · {m.team1?.shortName} v {m.team2?.shortName} · <span className="capitalize text-muted-foreground">{m.status}</span></span>
                      <Button size="sm" variant="ghost" onClick={() => navigate("live-scorer", m.id)} className="gap-1 text-red-600 hover:bg-red-50"><Radio className="h-3 w-3" /> Score</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Save / Cancel */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> {saving ? "Saving…" : tournament ? "Save Changes" : "Create Tournament"}</Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>

      {/* Bulk players dialog (opened by the green Users button on each team chip) */}
      {bulkFor && (
        <BulkPlayersDialog
          open={!!bulkFor}
          onOpenChange={(v) => !v && setBulkFor(null)}
          teamId={bulkFor.id}
          teamName={bulkFor.name}
          onDone={() => onRefresh()}
        />
      )}
    </AdminShell>
  )
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
