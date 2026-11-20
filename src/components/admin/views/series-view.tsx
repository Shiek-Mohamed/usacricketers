"use client"

import { useState, type ReactNode } from "react"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Plus, Pencil, Trash2, Save, ArrowLeft, Trophy, Users, X, Radio, Scale, BarChart3, ChevronUp, ChevronDown,
  Info, Zap, ClipboardList, Pointer, Gem,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Series, Team, PowerPlaySegment } from "@/lib/types"
import { BulkPlayersDialog } from "@/components/admin/bulk-players/bulk-players-dialog"
import { parsePlayerRows } from "@/components/admin/bulk-players/bulk-players-dialog"
import { PenaltiesCard } from "@/components/admin/penalties-card"
import { UploadButton } from "@/components/admin/upload-button"

const SCROLLBAR = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
const FORMATS = ["Test", "ODI", "T20I", "T10", "T25", "T30", "T35", "Custom"] as const
const STATUSES = ["upcoming", "ongoing", "completed"] as const
const FORMAT_OVERS: Record<string, number> = { Test: 90, ODI: 50, T20I: 20, T10: 10, T25: 25, T30: 30, T35: 35 }

/** Small ⓘ info tooltip — matches the CricClub Create-Series info icons. */
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground" aria-label="More info">
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{text}</TooltipContent>
    </Tooltip>
  )
}

/** Sectioned card with a colored icon badge + title + description, matching
 *  the CricClub Create-Series section layout. */
function SectionCard({
  icon, title, description, accent = "emerald", children,
}: {
  icon: ReactNode
  title: string
  description: string
  accent?: "emerald" | "amber" | "violet" | "slate"
  children: ReactNode
}) {
  const accents: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  }
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accents[accent])}>{icon}</div>
          <div>
            <h3 className="text-sm font-bold">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

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
  const [customOvers, setCustomOvers] = useState(() => {
    // If editing a custom format like "T8", extract the number.
    const match = tournament?.format?.match(/^T(\d+)$/i)
    return match ? parseInt(match[1], 10) : 12
  })
  const [season, setSeason] = useState(tournament?.season ?? "2025")
  const [status, setStatus] = useState(tournament?.status ?? "upcoming")
  const [description, setDescription] = useState(tournament?.description ?? "")
  const [startDate, setStartDate] = useState(tournament?.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(tournament?.endDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))
  // Classification & playing-rules metadata (CricClub "Create Series Info")
  const [ballType, setBallType] = useState(tournament?.ballType ?? "Leather")
  const [category, setCategory] = useState(tournament?.category ?? "Men")
  const [level, setLevel] = useState(tournament?.level ?? "Club")
  const [playersPerTeam, setPlayersPerTeam] = useState(tournament?.playersPerTeam ?? 11)
  const [squadLimit, setSquadLimit] = useState(tournament?.squadLimit ?? 0)
  const [logoUrl, setLogoUrl] = useState(tournament?.logoUrl ?? "")
  // Points system + ranking criteria (CricClub Points Settings + How to Rank)
  const [winPoints, setWinPoints] = useState(tournament?.winPoints ?? 2)
  const [lossPoints, setLossPoints] = useState(tournament?.lossPoints ?? 0)
  const [tiePoints, setTiePoints] = useState(tournament?.tiePoints ?? 1)
  const [abandonedPoints, setAbandonedPoints] = useState(tournament?.abandonedPoints ?? 1)
  const [bonusPoints, setBonusPoints] = useState(tournament?.bonusPoints ?? 0)
  const [rankCriteria, setRankCriteria] = useState<string[]>((tournament?.rankCriteria ?? "points,nrr,wins").split(",").map((s) => s.trim()).filter(Boolean))
  // Group/stage + power-play config (CricClub "Create Series Info")
  const [numberOfGroups, setNumberOfGroups] = useState(tournament?.numberOfGroups ?? 1)
  const [powerPlayEnabled, setPowerPlayEnabled] = useState(tournament?.powerPlayEnabled ?? false)
  const [powerPlaySegments, setPowerPlaySegments] = useState<PowerPlaySegment[]>(tournament?.powerPlayOvers ?? [])
  // Squad-limit toggle (mockup: "Is the team squad size limited?"). Off =
  // unlimited (squadLimit 0); On reveals a max-players number input.
  const [squadLimited, setSquadLimited] = useState((tournament?.squadLimit ?? 0) > 0)
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
  // Overs per side for the "Series Format" section — derived from the format
  // for standard formats, or the custom-overs stepper when "Custom" is chosen.
  const isCustomFormat = format === "Custom" || /^T\d+$/i.test(format)
  const oversPerSide = isCustomFormat ? customOvers : (FORMAT_OVERS[format] ?? 20)

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      // When "Custom" is selected, store as "T{N}" (e.g. "T12", "T8") so
      // maxOversForFormat() can parse it.
      const actualFormat = format === "Custom" ? `T${customOvers}` : format
      const payload = { name, shortName: shortName || name.slice(0, 20), format: actualFormat, season, status, description, startDate, endDate, ballType, category, level, playersPerTeam: Number(playersPerTeam), squadLimit: squadLimited ? Number(squadLimit) || 15 : 0, logoUrl: logoUrl || null, winPoints: Number(winPoints), lossPoints: Number(lossPoints), tiePoints: Number(tiePoints), abandonedPoints: Number(abandonedPoints), bonusPoints: Number(bonusPoints), rankCriteria: rankCriteria.join(","), numberOfGroups: Number(numberOfGroups), powerPlayEnabled, powerPlayOvers: powerPlaySegments }
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

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="flex w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="details" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
              <Trophy className="h-4 w-4" /> Details
            </TabsTrigger>
            <TabsTrigger value="points" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
              <BarChart3 className="h-4 w-4" /> Points & Ranking
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
              <Users className="h-4 w-4" /> Teams
            </TabsTrigger>
            {tournament && (
              <TabsTrigger value="matches" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
                <Radio className="h-4 w-4" /> Matches
              </TabsTrigger>
            )}
            {tournament?.id && (
              <TabsTrigger value="penalties" className="gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-4 py-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:border-emerald-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none whitespace-nowrap">
                <Scale className="h-4 w-4" /> Penalties
              </TabsTrigger>
            )}
          </TabsList>

          {/* Details — sectioned to mirror the CricClub Create-Series Info screen */}
          <TabsContent value="details">
            <div className="space-y-4">

              {/* ── Basic Details ── */}
              <SectionCard
                icon={<ClipboardList className="h-4 w-4" />}
                accent="emerald"
                title="Basic Details"
                description="Essential information about your series"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="t-name">Series Name <span className="text-destructive">*</span></Label>
                  <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter Series Name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Start Date <span className="text-destructive">*</span></Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div className="grid gap-1.5"><Label>End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5"><Label>Short name</Label><Input value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="STL 2025" /></div>
                  <div className="grid gap-1.5"><Label>Season</Label><Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="2025" /></div>
                  <div className="grid gap-1.5"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1">Number of Groups <InfoTip text="Split teams into this many groups for a group-stage → knockout structure. 1 = single round-robin." /></Label>
                    <Input type="number" min={1} max={16} value={numberOfGroups} onChange={(e) => setNumberOfGroups(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1">Ball Type <InfoTip text="The type of ball used in this series — affects scoring norms." /></Label>
                    <Select value={ballType} onValueChange={setBallType}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["Leather","Hard Tennis","Soft Tennis","Tape Ball"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1">Players Allowed per Team <InfoTip text="Number of players per side on the field (default 11)." /></Label>
                    <Input type="number" min={1} max={20} value={playersPerTeam} onChange={(e) => setPlayersPerTeam(Number(e.target.value) || 11)} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Series logo</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    {logoUrl ? <img src={logoUrl} alt="Series logo" className="h-12 w-12 rounded-lg border object-cover" /> : null}
                    <UploadButton label="Upload logo" withBrowse onUploaded={(url) => setLogoUrl(url)} />
                    {logoUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")}>Remove</Button>}
                  </div>
                </div>
                <div className="grid gap-1.5"><Label htmlFor="t-desc">Description</Label><Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
              </SectionCard>

              {/* ── Team & Squad Settings ── */}
              <SectionCard
                icon={<Users className="h-4 w-4" />}
                accent="emerald"
                title="Team & Squad Settings"
                description="Configure team limits and club structure"
              >
                <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 px-4 py-3">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-1 text-sm font-medium">Is the team squad size limited? <InfoTip text="When enabled, set the maximum squad size each team can register." /></Label>
                    <p className="text-xs text-muted-foreground">Off = unlimited squad size.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs font-semibold", !squadLimited ? "text-foreground" : "text-muted-foreground")}>No</span>
                    <Switch checked={squadLimited} onCheckedChange={(v) => { setSquadLimited(v); if (!v) setSquadLimit(0) }} />
                    <span className={cn("text-xs font-semibold", squadLimited ? "text-foreground" : "text-muted-foreground")}>Yes</span>
                  </div>
                </div>
                {squadLimited && (
                  <div className="grid max-w-xs gap-1.5">
                    <Label>Squad limit (max players per team)</Label>
                    <Input type="number" min={1} value={squadLimit === 0 ? 15 : squadLimit} onChange={(e) => setSquadLimit(Number(e.target.value) || 15)} />
                  </div>
                )}
              </SectionCard>

              {/* ── Series Format ── */}
              <SectionCard
                icon={<Pointer className="h-4 w-4" />}
                accent="amber"
                title="Series Format"
                description="Define the format and playing rules for your series"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="flex items-center gap-1">Format <InfoTip text="Match format determines overs per side and scoring rules." /></Label>
                    <Select value={isCustomFormat ? "Custom" : format} onValueChange={(v) => setFormat(v)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Overs per Side</Label>
                    <Input type="number" min={1} max={90} value={oversPerSide} onChange={(e) => { const n = Math.max(1, Math.min(90, parseInt(e.target.value) || 1)); setCustomOvers(n); setFormat("Custom") }} disabled={!isCustomFormat} />
                  </div>
                  <div className="grid gap-1.5"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["Men","Women","Mixed","Boys","Girls"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-1.5"><Label>Level</Label><Select value={level} onValueChange={setLevel}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["International","State","District","Club","School","Corporate"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
                </div>

                {/* Power Play sub-block */}
                <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 dark:border-purple-900 dark:bg-purple-950/30">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-600" />
                      <div>
                        <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300">Power Play</h4>
                        <p className="text-xs text-muted-foreground">Configure power play overs for enhanced gameplay</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn("text-xs font-semibold", !powerPlayEnabled ? "text-foreground" : "text-muted-foreground")}>No</span>
                      <Switch checked={powerPlayEnabled} onCheckedChange={setPowerPlayEnabled} />
                      <span className={cn("text-xs font-semibold", powerPlayEnabled ? "text-foreground" : "text-muted-foreground")}>Yes</span>
                    </div>
                  </div>
                  {powerPlayEnabled && (
                    <div className="mt-3 space-y-2">
                      {powerPlaySegments.map((seg, i) => (
                        <div key={i} className="rounded-lg border bg-card p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Power Play {i + 1}</span>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:text-destructive" onClick={() => setPowerPlaySegments(powerPlaySegments.filter((_, j) => j !== i))} aria-label="Remove power play"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1"><Label className="text-xs text-muted-foreground">From</Label><Input type="number" min={0} value={seg.from} onChange={(e) => setPowerPlaySegments(powerPlaySegments.map((s, j) => j === i ? { ...s, from: Number(e.target.value) || 0 } : s))} /></div>
                            <div className="grid gap-1"><Label className="text-xs text-muted-foreground">To</Label><Input type="number" min={0} value={seg.to} onChange={(e) => setPowerPlaySegments(powerPlaySegments.map((s, j) => j === i ? { ...s, to: Number(e.target.value) || 0 } : s))} /></div>
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" className="w-full border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/40" onClick={() => setPowerPlaySegments([...powerPlaySegments, { from: 1, to: 6 }])}><Plus className="mr-1 h-4 w-4" /> Add power play</Button>
                    </div>
                  )}
                </div>
              </SectionCard>

            </div>
          </TabsContent>

          {/* Points & Ranking */}
          <TabsContent value="points">
            <Card><CardContent className="grid gap-4 p-4 sm:p-6">
              <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-600" /><h2 className="text-base font-bold">Points System</h2><Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"><Gem className="h-3 w-3" />Pro</Badge></div>
              <p className="text-xs text-muted-foreground">Points awarded per match outcome. Applied to the auto-computed standings table.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="grid gap-1.5"><Label>Win</Label><Input type="number" min={0} value={winPoints} onChange={(e) => setWinPoints(Number(e.target.value) || 0)} /></div>
                <div className="grid gap-1.5"><Label>Loss</Label><Input type="number" min={0} value={lossPoints} onChange={(e) => setLossPoints(Number(e.target.value) || 0)} /></div>
                <div className="grid gap-1.5"><Label>Tie</Label><Input type="number" min={0} value={tiePoints} onChange={(e) => setTiePoints(Number(e.target.value) || 0)} /></div>
                <div className="grid gap-1.5"><Label>Abandoned</Label><Input type="number" min={0} value={abandonedPoints} onChange={(e) => setAbandonedPoints(Number(e.target.value) || 0)} /></div>
                <div className="grid gap-1.5"><Label>Bonus</Label><Input type="number" min={0} value={bonusPoints} onChange={(e) => setBonusPoints(Number(e.target.value) || 0)} /></div>
              </div>
              <div className="grid gap-1.5 pt-2">
                <Label>How to rank teams (tie-breaker order)</Label>
                <p className="text-xs text-muted-foreground">Higher-listed criteria are applied first when teams are level.</p>
                <div className="space-y-1.5">
                  {rankCriteria.map((c, i) => (
                    <div key={c} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}.</span>
                      <span className="flex-1 text-sm font-medium">{c === "points" ? "Most Points" : c === "nrr" ? "NRR" : c === "headToHead" ? "Head to head" : c === "wins" ? "No. of wins" : "Win percentage"}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => { const arr = [...rankCriteria]; [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; setRankCriteria(arr) }}><ChevronUp className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === rankCriteria.length - 1} onClick={() => { const arr = [...rankCriteria]; [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; setRankCriteria(arr) }}><ChevronDown className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={rankCriteria.length <= 1} onClick={() => setRankCriteria(rankCriteria.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
                {["points", "nrr", "headToHead", "wins", "winPercentage"].filter((c) => !rankCriteria.includes(c)).length > 0 && (
                  <Select value="" onValueChange={(c) => { if (c) setRankCriteria([...rankCriteria, c]) }}>
                    <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="+ Add criterion" /></SelectTrigger>
                    <SelectContent>
                      {["points", "nrr", "headToHead", "wins", "winPercentage"].filter((c) => !rankCriteria.includes(c)).map((c) => <SelectItem key={c} value={c}>{c === "points" ? "Most Points" : c === "nrr" ? "NRR" : c === "headToHead" ? "Head to head" : c === "wins" ? "No. of wins" : "Win percentage"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent></Card>
          </TabsContent>

          {/* Teams */}
          <TabsContent value="teams">
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
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-8 text-center">
                    <Users className="h-7 w-7 text-emerald-600" />
                    <p className="text-sm font-medium">No teams yet</p>
                    <p className="text-xs text-muted-foreground">Add an existing team or create a new one to get started.</p>
                  </div>
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
                    <label className="text-xs font-medium text-muted-foreground">
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
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {parsePlayerRows(newTeamPlayersText).length} player{parsePlayerRows(newTeamPlayersText).length === 1 ? "" : "s"} will be imported when the team is created.
                      </p>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Tip: you can also bulk-add players to an existing tournament team using the green <Users className="inline h-3 w-3 -translate-y-0.5" /> button on each team chip above.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Matches + Score */}
          {tournament && (
            <TabsContent value="matches">
              <Card>
                <CardContent className="p-4 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-bold"><Trophy className="h-5 w-5 text-emerald-600" /> Matches ({tournamentMatches.length})</h2>
                    <Button size="sm" onClick={createMatchAndScore} disabled={tournamentTeams.length < 2} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
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
            </TabsContent>
          )}

          {tournament?.id && (
            <TabsContent value="penalties">
              <PenaltiesCard seriesId={tournament.id} />
            </TabsContent>
          )}
        </Tabs>

        {/* Sticky save bar — always visible while scrolling a tab's content */}
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"><Save className="h-4 w-4" /> {saving ? "Saving…" : tournament ? "Save Changes" : "Create Tournament"}</Button>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
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
