"use client"

import { useState } from "react"
import { useMatches, useTeams, useSeries } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { api } from "@/lib/api"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TeamBadge,
  StatusPill,
  FormatPill,
  formatMatchDate,
} from "@/components/cricket/ui"
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
import { Plus, Pencil, Trash2, Search, Info, Radio, CalendarPlus, FileText } from "lucide-react"
import { toast } from "sonner"
import type { Match, Scorecard } from "@/lib/types"
import { BulkMatchesDialog } from "@/components/admin/bulk-matches/bulk-matches-dialog"

const FORMATS = ["Test", "ODI", "T20I", "T10", "T25", "T30", "T35"] as const
const STATUSES = ["upcoming", "live", "completed", "abandoned"] as const
const NONE_SERIES = "__none__"

interface MatchFormState {
  seriesId: string
  team1Id: string
  team2Id: string
  format: string
  matchNo: string
  status: string
  venue: string
  city: string
  startDate: string
  result: string
  manOfMatch: string
  umpires: string
  tvUmpire: string
  referee: string
  scorecard: string
}

const emptyForm: MatchFormState = {
  seriesId: "",
  team1Id: "",
  team2Id: "",
  format: "ODI",
  matchNo: "1st Match",
  status: "upcoming",
  venue: "",
  city: "",
  startDate: new Date().toISOString().slice(0, 16),
  result: "",
  manOfMatch: "",
  umpires: "",
  tvUmpire: "",
  referee: "",
  scorecard: "",
}

function toLocalInput(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 16)
  } catch {
    return new Date().toISOString().slice(0, 16)
  }
}

export function AdminMatchesView() {
  const { data, loading, refetch } = useMatches()
  const teams = useTeams()
  const series = useSeries()
  const navigate = useAppStore((s) => s.navigate)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MatchFormState>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const filtered = (data ?? []).filter((m) => {
    const q = search.toLowerCase()
    const hay = `${m.team1?.shortName ?? ""} ${m.team2?.shortName ?? ""} ${m.venue} ${m.city} ${m.format} ${m.matchNo}`.toLowerCase()
    return hay.includes(q)
  })

  function openCreate() {
    setEditingId(null)
    setForm({
      ...emptyForm,
      team1Id: teams.data?.[0]?.id ?? "",
      team2Id: teams.data?.[1]?.id ?? "",
    })
    setOpen(true)
  }

  function openEdit(m: Match) {
    setEditingId(m.id)
    setForm({
      seriesId: m.seriesId ?? "",
      team1Id: m.team1Id,
      team2Id: m.team2Id,
      format: m.format,
      matchNo: m.matchNo,
      status: m.status,
      venue: m.venue,
      city: m.city,
      startDate: toLocalInput(m.startDate),
      result: m.result,
      manOfMatch: m.manOfMatch || "",
      umpires: m.umpires || "",
      tvUmpire: m.tvUmpire || "",
      referee: m.referee || "",
      scorecard: m.scorecard
        ? JSON.stringify(m.scorecard, null, 2)
        : "",
    })
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.team1Id || !form.team2Id) {
      toast.error("Both teams are required")
      return
    }
    if (form.team1Id === form.team2Id) {
      toast.error("Team 1 and Team 2 cannot be the same")
      return
    }
    let scorecardValue: Scorecard | null = null
    if (form.scorecard.trim()) {
      try {
        scorecardValue = JSON.parse(form.scorecard) as Scorecard
      } catch {
        toast.error("Invalid scorecard JSON", {
          description: "Please check the JSON syntax",
        })
        return
      }
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        seriesId: form.seriesId || null,
        scorecard: scorecardValue,
      }
      if (editingId) {
        await api.matches.update(editingId, payload)
        toast.success("Match updated")
      } else {
        await api.matches.create(payload)
        toast.success("Match created")
      }
      setOpen(false)
      refetch()
    } catch (e) {
      toast.error("Failed to save match", { description: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.matches.remove(id)
      toast.success("Match deleted")
      refetch()
    } catch (e) {
      toast.error("Failed to delete", { description: String(e) })
    }
    setDeleteId(null)
  }

  return (
    <AdminShell
      title="Manage Matches"
      count={data?.length}
      actionLabel="+ New Match"
      onAction={openCreate}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by team, venue or format..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkOpen(true)}
          className="gap-1.5 whitespace-nowrap"
        >
          <CalendarPlus className="h-4 w-4" /> Bulk Schedule
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Match No</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Venue
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Date
                  </TableHead>
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
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground py-8"
                    >
                      No matches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.matchNo}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {m.team1 && <TeamBadge team={m.team1} size="sm" />}
                          <span className="text-xs font-semibold">v</span>
                          {m.team2 && <TeamBadge team={m.team2} size="sm" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <FormatPill format={m.format} />
                      </TableCell>
                      <TableCell>
                        <StatusPill status={m.status} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {m.venue}
                        {m.city ? `, ${m.city}` : ""}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatMatchDate(m.startDate)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("live-scorer", m.id)}
                          className="mr-1 gap-1 border-red-300 text-red-700 hover:bg-red-50"
                          aria-label="Score live"
                        >
                          <Radio className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Score</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              const data = await api.matches.generatePreview(m.id)
                              toast.success("Preview article generated", {
                                description: "Created as a draft — review and publish.",
                              })
                              refetch()
                            } catch (e) {
                              toast.error("Failed to generate preview", { description: String(e) })
                            }
                          }}
                          aria-label="Generate match preview article"
                          title="Generate match preview article"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Match" : "New Match"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Team 1</Label>
                <Select
                  value={form.team1Id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, team1Id: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.data?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.shortName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Team 2</Label>
                <Select
                  value={form.team2Id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, team2Id: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.data?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.shortName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Series</Label>
                <Select
                  value={form.seriesId || NONE_SERIES}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      seriesId: v === NONE_SERIES ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_SERIES}>No series</SelectItem>
                    {series.data?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Format</Label>
                <Select
                  value={form.format}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, format: v }))
                  }
                >
                  <SelectTrigger className="w-full">
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
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="matchNo">Match No</Label>
                <Input
                  id="matchNo"
                  value={form.matchNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, matchNo: e.target.value }))
                  }
                  placeholder="1st Match"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  value={form.venue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, venue: e.target.value }))
                  }
                  placeholder="e.g. M.Chinnaswamy Stadium"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                  placeholder="Bengaluru"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="result">Result</Label>
                <Input
                  id="result"
                  value={form.result}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, result: e.target.value }))
                  }
                  placeholder="e.g. India won by 6 wickets"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="manOfMatch">Player of the Match</Label>
                <Input
                  id="manOfMatch"
                  value={form.manOfMatch}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, manOfMatch: e.target.value }))
                  }
                  placeholder="e.g. Virat Kohli"
                />
              </div>
            </div>

            {/* Match officials — umpires + TV umpire + referee */}
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Match officials (optional)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="umpires">On-field umpires</Label>
                  <Input
                    id="umpires"
                    value={form.umpires}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, umpires: e.target.value }))
                    }
                    placeholder="e.g. Aleem Dar, Richard Kettleborough"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="tvUmpire">TV umpire</Label>
                  <Input
                    id="tvUmpire"
                    value={form.tvUmpire}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tvUmpire: e.target.value }))
                    }
                    placeholder="e.g. Chris Gaffaney"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="referee">Match referee</Label>
                  <Input
                    id="referee"
                    value={form.referee}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, referee: e.target.value }))
                    }
                    placeholder="e.g. Andy Pycroft"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-2 text-xs text-amber-800">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Scorecard:</strong> the full scorecard JSON is seeded for
                some matches. You can edit it here as a raw JSON string —
                invalid JSON will be rejected on save. For new matches, leave
                blank to start without a scorecard.
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="scorecard">Scorecard (JSON, optional)</Label>
              <Textarea
                id="scorecard"
                value={form.scorecard}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scorecard: e.target.value }))
                }
                rows={5}
                className="font-mono text-xs"
                placeholder='{ "innings": [], "note": "" }'
              />
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
                  : "Create Match"}
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
              This will permanently remove the match and its scorecard from the
              database.
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
      {/* Bulk match scheduling dialog */}
      <BulkMatchesDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onDone={() => refetch()}
      />
    </AdminShell>
  )
}
