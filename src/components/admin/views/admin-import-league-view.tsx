"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Download,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { api } from "@/lib/api"
import { parseCsvImport, previewCsvImport } from "@/lib/csv-import"
import type { ImportedLeagueData, Series } from "@/lib/types"

/** Mirror of the API response from POST /api/admin/import-league. */
interface ImportSummary {
  series: { id: string; name: string; shortName: string; season: string; created: boolean }
  teams: { total: number; created: number; updated: number }
  players: { created: number; updated: number }
  matches: { total: number; created: number; updated: number; errors: string[] }
  standings: { teams: number; matches: number }
}

/** Read the CSRF token from the non-httpOnly `csrf-token` cookie and return
 *  it as an `X-CSRF-Token` header value, or null if no cookie is set. The
 *  admin login flow sets both cookies; this just reads the JS-readable one
 *  so we can attach it on the multipart POST (which bypasses the api.ts
 *  helper that normally does this for JSON payloads). */
function readCSRFHeader(): Record<string, string> {
  if (typeof document === "undefined") return {}
  const match = document.cookie.match(/(?:^|; )csrf-token=([^;]+)/)
  return match ? { "X-CSRF-Token": match[1] } : {}
}

/** Count matches per status (upcoming/completed/live/abandoned) for the
 *  preview pane. Returns a map of status → count. */
function countMatchStatuses(data: ImportedLeagueData): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of data.matches ?? []) {
    const s = (m.status || "upcoming").toLowerCase()
    out[s] = (out[s] || 0) + 1
  }
  return out
}

/** Total player count across all teams — for the preview pane. */
function countPlayers(data: ImportedLeagueData): number {
  let n = 0
  for (const t of data.teams) n += t.players?.length ?? 0
  return n
}

const TEMPLATE_URL = "/templates/import-league.example.json"

export function AdminImportLeagueView() {
  const navigate = useAppStore((s) => s.navigate)

  // ── State ──────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ImportedLeagueData | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [destination, setDestination] = useState<string>("new")
  // "new" = create new league from JSON, else the seriesId of the selected
  // existing series. (Note: the importer matches by name+season, NOT by
  // ID — see the info note below the selector.)

  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // CSV import state
  const [csvMode, setCsvMode] = useState(false)
  const [csvLeagueName, setCsvLeagueName] = useState("")
  const [csvSeason, setCsvSeason] = useState(String(new Date().getFullYear()))
  const [csvFormat, setCsvFormat] = useState("T20")
  const [csvTeams, setCsvTeams] = useState("")
  const [csvPlayers, setCsvPlayers] = useState("")
  const [csvMatches, setCsvMatches] = useState("")
  const [csvPreview, setCsvPreview] = useState<{
    teamCount: number
    playerCount: number
    matchCount: number
    sampleTeams: string[]
    sampleMatches: string[]
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch existing series list for the destination selector ─────────
  useEffect(() => {
    let cancelled = false
    fetch("/api/series")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Series[]) => {
        if (!cancelled) setSeriesList(list)
      })
      .catch(() => {
        /* non-fatal — destination selector just shows "create new" only */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Reset summary when a new file is picked ───────────────────────
  useEffect(() => {
    setSummary(null)
    setImportError(null)
  }, [file])

  // ── Parse the selected file client-side for preview + validation ───
  useEffect(() => {
    if (!file) {
      setParsed(null)
      setParseError(null)
      return
    }
    let cancelled = false
    file
      .text()
      .then((text) => {
        if (cancelled) return
        try {
          const raw = JSON.parse(text)
          // Light client-side validation — the server is the source of
          // truth, but we want to show a friendly error before the user
          // clicks Import if the JSON is obviously malformed.
          if (
            typeof raw !== "object" ||
            raw === null ||
            Array.isArray(raw) ||
            typeof raw.league !== "object" ||
            !Array.isArray(raw.teams)
          ) {
            throw new Error(
              "JSON shape invalid — expected { league, teams, matches? }"
            )
          }
          setParsed(raw as ImportedLeagueData)
          setParseError(null)
        } catch (e) {
          setParsed(null)
          setParseError((e as Error).message)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setParsed(null)
          setParseError(`could not read file: ${(e as Error).message}`)
        }
      })
    return () => {
      cancelled = true
    }
  }, [file])

  // ── Per-status match counts for the preview pane ──────────────────
  const matchStatuses = useMemo(
    () => (parsed ? countMatchStatuses(parsed) : {}),
    [parsed]
  )
  const totalPlayers = useMemo(
    () => (parsed ? countPlayers(parsed) : 0),
    [parsed]
  )

  const canImport = !!file && !!parsed && !parseError && !importing

  // ── Handlers ───────────────────────────────────────────────────────
  function pickFile(f: File | null) {
    if (!f) return
    // Accept only JSON-ish files. Some browsers don't set type=application/json
    // for *.json files, so also check the extension as a fallback.
    const isJson =
      f.type === "application/json" ||
      /\.json$/i.test(f.name)
    if (!isJson) {
      toast.error("Please select a JSON file")
      return
    }
    setFile(f)
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  async function runImport() {
    if (!file || !parsed) return
    setImporting(true)
    setSummary(null)
    setImportError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/import-league", {
        method: "POST",
        headers: readCSRFHeader(), // multipart boundary is auto-set by fetch
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error || `Import failed (${res.status})`)
        toast.error("Import failed", { description: data.error })
        return
      }
      setSummary(data as ImportSummary)
      toast.success("League imported successfully")
    } catch (e) {
      setImportError(String(e))
      toast.error("Import failed", { description: String(e) })
    } finally {
      setImporting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <AdminShell title="Import League">
      {/* Mode toggle: JSON vs CSV */}
      <div className="flex gap-2">
        <Button
          variant={!csvMode ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setCsvMode(false)}
        >
          <FileJson className="h-3.5 w-3.5" /> JSON Import
        </Button>
        <Button
          variant={csvMode ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setCsvMode(true)}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> CSV Import
        </Button>
      </div>

      {/* CSV Import Mode */}
      {csvMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Import from CSV (CricClubs / PlayCricket / Excel)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              <strong>How it works:</strong> Export your league data from CricClubs (or any platform)
              as CSV files. Paste the CSV content into the boxes below. The importer auto-detects
              column headers (e.g., "Team Name", "team_name", "teamname" all work).
            </div>

            {/* League info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-bold">League Name *</Label>
                <Input value={csvLeagueName} onChange={(e) => setCsvLeagueName(e.target.value)} placeholder="Arizona Premier Cricket League" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-bold">Season</Label>
                <Input value={csvSeason} onChange={(e) => setCsvSeason(e.target.value)} placeholder="2025" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-bold">Format</Label>
                <Select value={csvFormat} onValueChange={setCsvFormat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T20">T20</SelectItem>
                    <SelectItem value="ODI">ODI (50 over)</SelectItem>
                    <SelectItem value="Test">Test</SelectItem>
                    <SelectItem value="T10">T10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CSV text areas */}
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-bold">Teams CSV (optional)</Label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  value={csvTeams}
                  onChange={(e) => setCsvTeams(e.target.value)}
                  placeholder={"Team Name,Short Name,Country\nAustralia,AUS,Australia\nIndia,IND,India"}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-bold">Players CSV (optional)</Label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  value={csvPlayers}
                  onChange={(e) => setCsvPlayers(e.target.value)}
                  placeholder={"Player Name,Team,Role,Batting Style\nVirat Kohli,India,Batsman,Right-hand bat\nJasprit Bumrah,India,Bowler,Right-hand bat"}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-bold">Matches CSV (optional)</Label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  value={csvMatches}
                  onChange={(e) => setCsvMatches(e.target.value)}
                  placeholder={"Team 1,Team 2,Date,Venue,Result,Format\nIndia,Australia,2025-03-09,Dubai,India won by 4 wickets,T20"}
                />
              </div>
            </div>

            {/* Preview + Import buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!csvLeagueName || (!csvTeams && !csvPlayers && !csvMatches)}
                onClick={() => {
                  try {
                    const preview = previewCsvImport({
                      leagueName: csvLeagueName,
                      season: csvSeason,
                      format: csvFormat,
                      teamsCsv: csvTeams || undefined,
                      playersCsv: csvPlayers || undefined,
                      matchesCsv: csvMatches || undefined,
                    })
                    setCsvPreview(preview)
                    if (preview.teamCount + preview.playerCount + preview.matchCount === 0) {
                      toast.warning("No data parsed — check your CSV format")
                    } else {
                      toast.success(`Parsed: ${preview.teamCount} teams, ${preview.playerCount} players, ${preview.matchCount} matches`)
                    }
                  } catch (e) {
                    toast.error("CSV parse failed", { description: String(e) })
                  }
                }}
              >
                <Info className="h-3.5 w-3.5" /> Preview
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={importing || !csvLeagueName || (!csvTeams && !csvPlayers && !csvMatches)}
                onClick={async () => {
                  setImporting(true)
                  setImportError(null)
                  try {
                    const data = parseCsvImport({
                      leagueName: csvLeagueName,
                      season: csvSeason,
                      format: csvFormat,
                      teamsCsv: csvTeams || undefined,
                      playersCsv: csvPlayers || undefined,
                      matchesCsv: csvMatches || undefined,
                    })
                    const res = await fetch("/api/admin/import-league", {
                      method: "POST",
                      headers: withCSRF({ "Content-Type": "application/json" }),
                      body: JSON.stringify(data),
                    })
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}))
                      throw new Error(err.error || `HTTP ${res.status}`)
                    }
                    const result = await res.json()
                    setSummary(result)
                    toast.success("League imported successfully!")
                  } catch (e) {
                    setImportError(String(e))
                    toast.error("Import failed", { description: String(e) })
                  } finally {
                    setImporting(false)
                  }
                }}
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Import League
              </Button>
            </div>

            {/* Preview results */}
            {csvPreview && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="secondary">{csvPreview.teamCount} teams</Badge>
                  <Badge variant="secondary">{csvPreview.playerCount} players</Badge>
                  <Badge variant="secondary">{csvPreview.matchCount} matches</Badge>
                </div>
                {csvPreview.sampleTeams.length > 0 && (
                  <div>
                    <span className="text-xs font-bold uppercase text-muted-foreground">Sample teams: </span>
                    <span className="text-xs">{csvPreview.sampleTeams.join(", ")}</span>
                  </div>
                )}
                {csvPreview.sampleMatches.length > 0 && (
                  <div>
                    <span className="text-xs font-bold uppercase text-muted-foreground">Sample matches: </span>
                    <span className="text-xs">{csvPreview.sampleMatches.join(", ")}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* JSON Import Mode (existing) */}
      {!csvMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileJson className="h-4 w-4 text-emerald-600" />
              Import a league from JSON
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Upload a JSON file matching the{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
              ImportedLeagueData
            </code>{" "}
            schema to import a league (Series), its teams, players, and
            matches in one shot. The importer is{" "}
            <strong>idempotent</strong> — re-running with the same JSON
            updates existing rows instead of creating duplicates. The
            entire import runs in a single database transaction, so if any
            step fails the whole import rolls back.
          </p>

          {/* Step 1: file picker / dropzone */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide">
              1 · Choose a JSON file
            </h3>
            <label
              htmlFor="league-file"
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
                dragOver
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                  : "border-border hover:border-emerald-400 hover:bg-muted/50"
              }`}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm font-medium">
                {file ? file.name : "Drop a JSON file here or click to browse"}
              </div>
              {file && (
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              )}
              <input
                ref={fileInputRef}
                id="league-file"
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) pickFile(f)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
              />
            </label>
            {parseError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>JSON parse error</AlertTitle>
                <AlertDescription className="font-mono text-xs">
                  {parseError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Step 2: preview pane */}
          {parsed && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide">
                2 · Preview
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <PreviewStat label="League name" value={parsed.league.name} />
                <PreviewStat
                  label="Format"
                  value={parsed.league.format || "T20 (default)"}
                />
                <PreviewStat
                  label="Season"
                  value={parsed.league.season || "Current year (default)"}
                />
                <PreviewStat
                  label="Teams"
                  value={`${parsed.teams.length} team${parsed.teams.length === 1 ? "" : "s"}`}
                />
                <PreviewStat
                  label="Players"
                  value={`${totalPlayers} player${totalPlayers === 1 ? "" : "s"} total`}
                />
                <PreviewStat
                  label="Matches"
                  value={`${parsed.matches?.length ?? 0} match${(parsed.matches?.length ?? 0) === 1 ? "" : "es"}`}
                />
              </div>
              {(parsed.matches?.length ?? 0) > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    Match statuses:
                  </span>
                  {Object.entries(matchStatuses).map(([status, count]) => (
                    <Badge key={status} variant="secondary" className="gap-1">
                      <span className="font-mono">{status}</span>·{count}
                    </Badge>
                  ))}
                </div>
              )}
              {/* Team list summary */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Show team rosters ({parsed.teams.length})
                </summary>
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                  {parsed.teams.map((t) => (
                    <li key={t.shortName} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {t.shortName}
                      </Badge>
                      <span className="font-medium">{t.name}</span>
                      {t.players && (
                        <span className="text-muted-foreground">
                          · {t.players.length} player
                          {t.players.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          {/* Step 3: destination series selector */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide">
              3 · Destination league
            </h3>
            <div className="grid gap-2">
              <Label htmlFor="destination" className="text-xs text-muted-foreground">
                Where should the data land?
              </Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger id="destination" className="w-full sm:w-[28rem]">
                  <SelectValue placeholder="Choose a destination league" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">
                    Create new league from JSON
                  </SelectItem>
                  {seriesList.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Existing leagues
                      </div>
                      {seriesList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.season}) · {s.shortName}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>How matching works:</strong> the importer matches
                leagues by <code>name + season</code>, teams by{" "}
                <code>shortName</code>, players by <code>name + team</code>,
                and matches by{" "}
                <code>seriesId + team1Id + team2Id + startDate + matchNo</code>.
                If you select an existing league above but your JSON&apos;s{" "}
                <code>league.name</code> + <code>league.season</code> don&apos;t
                match it, a <em>new</em> league will be created. To append to
                the selected league, ensure the JSON&apos;s league name + season
                match.
              </div>
            </div>
          </div>

          {/* Step 4: import button */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <a
              href={TEMPLATE_URL}
              download
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3 w-3" />
              Download example template
            </a>
            <Button
              onClick={runImport}
              disabled={!canImport}
              size="sm"
              className="gap-1.5"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {importing ? "Importing…" : "Import league"}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Result card */}
      {(summary || importError) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {summary ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              {summary ? "Import complete" : "Import failed"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {importError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="font-mono text-xs break-all">
                  {importError}
                </AlertDescription>
              </Alert>
            )}
            {summary && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SummaryCard
                    title="League"
                    created={summary.series.created ? 1 : 0}
                    updated={summary.series.created ? 0 : 1}
                    total={1}
                    detail={`${summary.series.name} · ${summary.series.shortName} · ${summary.series.season}`}
                  />
                  <SummaryCard
                    title="Teams"
                    created={summary.teams.created}
                    updated={summary.teams.updated}
                    total={summary.teams.total}
                  />
                  <SummaryCard
                    title="Players"
                    created={summary.players.created}
                    updated={summary.players.updated}
                    total={summary.players.created + summary.players.updated}
                  />
                  <SummaryCard
                    title="Matches"
                    created={summary.matches.created}
                    updated={summary.matches.updated}
                    total={summary.matches.total}
                    errors={summary.matches.errors}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">
                    Standings: {summary.standings.teams} teams,{" "}
                    {summary.standings.matches} matches processed
                  </Badge>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      navigate("series-detail", summary.series.id)
                    }
                  >
                    View league
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSummary(null)
                      setImportError(null)
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </AdminShell>
  )
}

/* ─── Small subcomponents ──────────────────────────────────────────────── */

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium truncate" title={value}>
        {value}
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  created,
  updated,
  total,
  detail,
  errors,
}: {
  title: string
  created: number
  updated: number
  total: number
  detail?: string
  errors?: string[]
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold">{title}</h4>
        <Badge variant="outline">{total} total</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {created > 0 ? (
          <Badge className="bg-emerald-600 text-white">
            <CheckCircle2 className="mr-1 h-3 w-3" /> {created} created
          </Badge>
        ) : (
          <Badge variant="secondary">{created} created</Badge>
        )}
        {updated > 0 ? (
          <Badge className="bg-emerald-700 text-white">
            {updated} updated
          </Badge>
        ) : (
          <Badge variant="secondary">{updated} updated</Badge>
        )}
      </div>
      {detail && (
        <div className="text-xs text-muted-foreground">{detail}</div>
      )}
      {errors && errors.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-red-600">
            {errors.length} match error{errors.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-1 text-red-600 max-h-32 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            {errors.map((e, i) => (
              <li key={i} className="font-mono break-all">
                {e}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
