"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import {
  Save,
  Loader2,
  Settings,
  Check,
  Trophy,
  SlidersHorizontal,
  Info,
} from "lucide-react"

interface SeriesConfig {
  id: string
  name: string
  shortName: string
  format: string
  season: string
  status: string
  description: string
}

export function LeagueAdminSettingsView() {
  const session = useLeagueAdminSession((s) => s.session)
  const [series, setSeries] = useState<SeriesConfig[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [shortName, setShortName] = useState("")
  const [format, setFormat] = useState("T20")
  const [season, setSeason] = useState("2026")
  const [status, setStatus] = useState("upcoming")
  const [description, setDescription] = useState("")
  const [winPoints, setWinPoints] = useState("2")
  const [tiePoints, setTiePoints] = useState("1")
  const [lossPoints, setLossPoints] = useState("0")
  const [maxOvers, setMaxOvers] = useState("20")

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch("/api/series")
      .then((r) => r.json())
      .then((data: SeriesConfig[]) => {
        if (cancelled) return
        const managed = data.filter((s) => session.managedSeriesIds.includes(s.id))
        const list = managed.length > 0 ? managed : data
        setSeries(list)
        if (list.length > 0) {
          const first = list[0]
          setSelectedId(first.id)
          setName(first.name)
          setShortName(first.shortName)
          setFormat(first.format)
          setSeason(first.season)
          setStatus(first.status)
          setDescription(first.description)
        }
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [session])

  function loadConfig(s: SeriesConfig) {
    setName(s.name)
    setShortName(s.shortName)
    setFormat(s.format)
    setSeason(s.season)
    setStatus(s.status)
    setDescription(s.description)
  }

  function handleSave() {
    if (!selectedId) return
    setSaving(true)
    setSaved(false)
    fetch(`/api/series/${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, shortName, format, season, status, description }),
    })
      .then((r) => r.json())
      .then(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) })
      .catch(() => { setSaving(false); alert("Failed to save settings") })
  }

  if (!session) {
    return <LeagueAdminShell title="Settings"><p className="text-sm text-muted-foreground">Please sign in.</p></LeagueAdminShell>
  }

  const selectedSeries = series?.find((s) => s.id === selectedId)

  return (
    <LeagueAdminShell title="Settings">
      {/* Series selector */}
      {loading ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : series && series.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {series.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedId(s.id); loadConfig(s) }}
              className={`rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors ${
                selectedId === s.id ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s.shortName}
            </button>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Settings className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No leagues found. Create a league first.</p>
        </Card>
      )}

      {selectedId && (
        <div className="space-y-4">
          {/* Series header card — CricClub-style identity banner */}
          <Card className="gap-0 overflow-hidden p-0">
            <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3 sm:px-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-600/10">
                <Trophy className="h-5 w-5 text-emerald-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Editing Series
                </p>
                <h2 className="truncate text-base font-bold">{selectedSeries?.name || "Untitled"}</h2>
              </div>
              <span className="hidden shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:inline">
                {selectedSeries?.format} · {selectedSeries?.season}
              </span>
            </div>
          </Card>

          {/* Accordion sections — CricClub League Info pattern */}
          <Accordion type="multiple" defaultValue={["info", "match"]}>
            {/* Series Information */}
            <AccordionItem value="info" className="overflow-hidden rounded-lg border bg-card px-0">
              <AccordionTrigger className="group flex items-center gap-3 border-b px-4 py-3 text-left hover:no-underline sm:px-6 [&[data-state=open]]:border-b">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/10">
                  <Info className="h-4 w-4 text-blue-600" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold">Series Information</p>
                  <p className="text-xs text-muted-foreground">Name, format, season & status</p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-4 sm:px-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="League Name">
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
                  </Field>
                  <Field label="Short Name">
                    <Input value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 6))} className="h-9 text-sm uppercase" />
                  </Field>
                  <Field label="Format">
                    <select value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option>T10</option>
                      <option>T20</option>
                      <option>T20I</option>
                      <option>ODI</option>
                      <option>Test</option>
                      <option>T25</option>
                      <option>T30</option>
                      <option>T35</option>
                    </select>
                  </Field>
                  <Field label="Season">
                    <Input value={season} onChange={(e) => setSeason(e.target.value)} className="h-9 text-sm" />
                  </Field>
                  <Field label="Status">
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </Field>
                  <Field label="Description">
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 text-sm" />
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Match Configuration */}
            <AccordionItem value="match" className="overflow-hidden rounded-lg border bg-card px-0">
              <AccordionTrigger className="group flex items-center gap-3 border-b px-4 py-3 text-left hover:no-underline sm:px-6">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/10">
                  <SlidersHorizontal className="h-4 w-4 text-amber-600" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold">Match Configuration</p>
                  <p className="text-xs text-muted-foreground">Overs, points & scoring rules</p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-4 sm:px-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Overs/Innings">
                    <Input type="number" value={maxOvers} onChange={(e) => setMaxOvers(e.target.value)} className="h-9 text-sm tabular-nums" />
                  </Field>
                  <Field label="Win Points">
                    <Input type="number" value={winPoints} onChange={(e) => setWinPoints(e.target.value)} className="h-9 text-sm tabular-nums" />
                  </Field>
                  <Field label="Tie Points">
                    <Input type="number" value={tiePoints} onChange={(e) => setTiePoints(e.target.value)} className="h-9 text-sm tabular-nums" />
                  </Field>
                  <Field label="Loss Points">
                    <Input type="number" value={lossPoints} onChange={(e) => setLossPoints(e.target.value)} className="h-9 text-sm tabular-nums" />
                  </Field>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Points configuration is used by the standings table once the competition rules engine processes results.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Changes apply to <span className="font-semibold text-foreground">{selectedSeries?.name}</span>
            </span>
          </div>
        </div>
      )}
    </LeagueAdminShell>
  )
}

/** Small label + child input wrapper used inside each accordion section. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
