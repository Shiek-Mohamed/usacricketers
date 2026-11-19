"use client"

import { useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import { Badge } from "@/components/ui/badge"
import { Users, Upload, ClipboardPaste, CheckCircle2, AlertTriangle, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"

const ROLES = [
  "Batsman",
  "Bowler",
  "All-rounder",
  "Wicket-keeper",
] as const

const ROLE_ALIASES: Record<string, string> = {
  bat: "Batsman",
  batsman: "Batsman",
  batter: "Batsman",
  bowl: "Bowler",
  bowler: "Bowler",
  ar: "All-rounder",
  "all-rounder": "All-rounder",
  allrounder: "All-rounder",
  "all rounder": "All-rounder",
  wk: "Wicket-keeper",
  keeper: "Wicket-keeper",
  "wicket-keeper": "Wicket-keeper",
  wicketkeeper: "Wicket-keeper",
}

/** Normalise an arbitrary role-string into one of the four canonical roles. */
function normaliseRole(raw: string): string {
  const k = raw.trim().toLowerCase()
  if (!k) return "Batsman"
  if (ROLE_ALIASES[k]) return ROLE_ALIASES[k]
  // Substring fallback (handles "Opening batsman", "left-arm orthodox bowler")
  if (k.includes("keeper") || k.includes("wicket")) return "Wicket-keeper"
  if (k.includes("bowl")) return "Bowler"
  if (k.includes("all") && k.includes("round")) return "All-rounder"
  if (k.includes("bat")) return "Batsman"
  return "Batsman"
}

export interface ParsedPlayerRow {
  name: string
  role: string
  isCaptain: boolean
  isKeeper: boolean
  battingStyle: string
  bowlingStyle: string
}

/**
 * Parse a free-form paste into a list of player rows. Supports:
 *  - CSV:        "Babar Azam, Batsman, Right-hand bat, Right-arm fast"
 *  - TSV:        "Babar Azam\tBatsman\tRight-hand bat\tRight-arm fast"
 *  - Pipe:      "Babar Azam | Batsman | Right-hand bat | Right-arm fast"
 *  - Semicolon:  "Babar Azam; Batsman; Right-hand bat; Right-arm fast"
 *  - One-per-line with just names (no extra fields)
 *
 * The first row is treated as a header if it contains the words "name" or
 * "role" (case-insensitive) — that row is dropped from the data set.
 *
 * Column order is positional: [name, role?, battingStyle?, bowlingStyle?].
 * Empty lines are ignored. Lines starting with `#` are treated as comments.
 */
export function parsePlayerRows(input: string): ParsedPlayerRow[] {
  const raw = input.trim()
  if (!raw) return []

  // Detect delimiter by counting occurrences in the first non-empty line.
  const firstLine = raw.split(/\r?\n/).find((l) => l.trim()) ?? ""
  let delim = "," // default
  const counts: Array<[string, number]> = [
    [",", (firstLine.match(/,/g) || []).length],
    ["\t", (firstLine.match(/\t/g) || []).length],
    ["|", (firstLine.match(/\|/g) || []).length],
    [";", (firstLine.match(/;/g) || []).length],
  ]
  counts.sort((a, b) => b[1] - a[1])
  if (counts[0][1] > 0) delim = counts[0][0]

  const lines = raw.split(/\r?\n/)
  let rows: string[][] = []
  let headerDetected = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const cols = delim === " " ? [trimmed] : trimmed.split(delim).map((c) => c.trim())
    if (!headerDetected) {
      const joined = cols.join(" ").toLowerCase()
      if (
        cols.length >= 2 &&
        (joined.includes("name") || joined.includes("role"))
      ) {
        headerDetected = true
        continue
      }
    }
    rows.push(cols)
  }

  // One-per-line mode: if there are no delimiters anywhere, treat every line
  // as just a player name with sensible defaults.
  if (rows.length > 0 && rows.every((r) => r.length === 1)) {
    return rows
      .map((r) => r[0])
      .filter((n) => n.trim())
      .map((name) => ({
        name,
        role: "Batsman",
        isCaptain: false,
        isKeeper: false,
        battingStyle: "Right-hand bat",
        bowlingStyle: "",
      }))
  }

  // Positional parse — [name, role?, battingStyle?, bowlingStyle?]
  // Auto-detect captain/keeper from the role string (e.g. "Captain",
  // "Wicket-keeper", "Keeper & Captain"). The admin can override per-player
  // later via the player edit form — this is just a smart default.
  return rows
    .filter((r) => r.length >= 1 && r[0])
    .map((r) => {
      const roleStr = r[1] ?? ""
      const roleLower = roleStr.toLowerCase()
      return {
        name: r[0],
        role: normaliseRole(roleStr),
        isCaptain:
          roleLower.includes("captain") ||
          roleLower.includes("(c)") ||
          roleLower.includes(" (c)"),
        isKeeper:
          roleLower.includes("keeper") ||
          roleLower.includes("wicket") ||
          roleLower.includes("†"),
        battingStyle: (r[2] ?? "Right-hand bat").trim() || "Right-hand bat",
        bowlingStyle: (r[3] ?? "").trim(),
      }
    })
    .filter((p) => p.name)
}

export interface CopySourceTeam {
  id: string
  name: string
  shortName: string
  playerCount: number
}

export interface CopySource {
  id: string
  name: string
  shortName: string
  season: string
  format: string
  status: string
  teams: CopySourceTeam[]
}

export interface BulkPlayersDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  teamId: string
  teamName: string
  /** Called after a successful bulk insert (so the parent can refetch). */
  onDone?: (createdCount: number) => void
  /** Optional prefill text — e.g. when used inside the tournament editor's
   * "create team + players" flow, the textarea contents from that form are
   * forwarded here so the user doesn't have to re-paste. */
  initialText?: string
  /** Optional Bearer token for league-admin auth. When provided, the upload
   *  fetch uses `Authorization: Bearer <token>` instead of the CSRF cookie
   *  used by site-admins. */
  authToken?: string | null
}

export function BulkPlayersDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  onDone,
  initialText = "",
  authToken = null,
}: BulkPlayersDialogProps) {
  const [text, setText] = useState(initialText)
  const [defaultRole, setDefaultRole] = useState<string>("Batsman")
  const [busy, setBusy] = useState(false)

  // "Copy from previous series" state — one fetch builds the whole picker:
  // recent series → their teams (target team excluded) with player counts.
  // The most recent series/team is auto-selected so one click copies.
  const [copyBusy, setCopyBusy] = useState(false)
  const [sources, setSources] = useState<CopySource[] | null>(null)
  const [sourceSeriesId, setSourceSeriesId] = useState("")
  const [sourceTeamId, setSourceTeamId] = useState("")

  const sourceSeries = sources?.find((s) => s.id === sourceSeriesId) ?? null
  const sourceTeams = sourceSeries?.teams ?? []

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSources(null)
    setSourceSeriesId("")
    setSourceTeamId("")
    fetch(
      `/api/players/copy-sources?excludeTeamId=${encodeURIComponent(teamId)}`,
    )
      .then((r) => r.json())
      .then((d: { sources?: CopySource[] }) => {
        if (cancelled) return
        const list = Array.isArray(d?.sources) ? d.sources : []
        setSources(list)
        if (list[0]) {
          setSourceSeriesId(list[0].id)
          setSourceTeamId(list[0].teams[0]?.id ?? "")
        }
      })
      .catch(() => {
        if (!cancelled) setSources([])
      })
    return () => {
      cancelled = true
    }
  }, [open, teamId])

  async function handleCopy() {
    if (!sourceTeamId) {
      toast.error("Select a team to copy from")
      return
    }
    if (!teamId) {
      toast.error("No target team selected")
      return
    }
    setCopyBusy(true)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`
      } else {
        headers["X-CSRF-Token"] =
          typeof document !== "undefined"
            ? document.cookie.match(/csrf-token=([^;]+)/)?.[1] || ""
            : ""
      }
      const res = await fetch("/api/players/copy", {
        method: "POST",
        headers,
        body: JSON.stringify({ sourceTeamId, targetTeamId: teamId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Copy failed")
        return
      }
      const sourceName =
        sourceTeams.find((t) => t.id === sourceTeamId)?.name || "team"
      if (data.created > 0) {
        toast.success(
          `Copied ${data.created} player${data.created === 1 ? "" : "s"} from ${sourceName}`,
          data.skipped > 0
            ? { description: `${data.skipped} skipped (already exist)` }
            : undefined,
        )
      } else {
        toast.info(data.message || "No players copied — all already exist")
      }
      onDone?.(data.created)
      onOpenChange(false)
      setSourceTeamId("")
    } catch (e) {
      toast.error("Copy failed", { description: String(e) })
    } finally {
      setCopyBusy(false)
    }
  }

  const parsed = useMemo(() => parsePlayerRows(text), [text])

  // Apply the default-role override to rows that have no role field set
  // (e.g. one-name-per-line mode), so the preview reflects what will actually
  // be saved. Rows that DID specify a role are left alone.
  const preview = useMemo(() => {
    const hasOnlyNames = parsed.length > 0 && parsed.every((p) => p.role === "Batsman" && text.split(/\r?\n/).every((l) => l.trim().split(/[,\t|;]/).length === 1))
    return parsed.map((p) => ({
      ...p,
      role: hasOnlyNames ? defaultRole : p.role,
    }))
  }, [parsed, defaultRole, text])

  async function handleUpload() {
    if (!teamId) {
      toast.error("No team selected")
      return
    }
    if (preview.length === 0) {
      toast.error("Nothing to upload — paste some player rows first")
      return
    }
    setBusy(true)
    try {
      // League admins pass a Bearer token; site admins rely on the CSRF
      // cookie attached by api.players.bulkCreate. Branch on which auth
      // mode the caller supplied.
      const payload = {
        teamId,
        players: preview.map((p) => ({
          name: p.name,
          role: p.role,
          isCaptain: p.isCaptain,
          isKeeper: p.isKeeper,
          battingStyle: p.battingStyle,
          bowlingStyle: p.bowlingStyle,
        })),
      }
      const result = authToken
        ? await fetch("/api/players/bulk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload),
          }).then(async (r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json()
          })
        : await api.players.bulkCreate(payload.teamId, payload.players)
      const res = result as { created: number; skipped: number; skippedNames: string[] }
      if (res.skipped > 0) {
        toast.warning(
          `${res.created} added, ${res.skipped} skipped (already exist)`,
          {
            description: res.skippedNames.slice(0, 8).join(", ") + (res.skippedNames.length > 8 ? "…" : ""),
          }
        )
      } else {
        toast.success(`${res.created} player${res.created === 1 ? "" : "s"} added to ${teamName}`)
      }
      onDone?.(res.created)
      onOpenChange(false)
      setText("")
    } catch (e) {
      toast.error("Bulk upload failed", { description: String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            Bulk add players to {teamName}
          </DialogTitle>
          <DialogDescription>
            Paste player rows below. One player per line. CSV, TSV, pipe, or
            semicolon delimiters all work. Column order is positional:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              name, role, battingStyle, bowlingStyle
            </code>
            . The first row is auto-detected as a header if it contains the
            word &ldquo;name&rdquo; or &ldquo;role&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Copy roster from a previous series — CricClub "Copy from Previous" */}
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Copy roster from a previous series
                </span>
              </div>
              {sources === null && (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading…
                </span>
              )}
            </div>
            {sources !== null && sources.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No previous series with player rosters found yet — add players
                to a team first, or use the paste option below.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={sourceSeriesId}
                    onValueChange={(id) => {
                      setSourceSeriesId(id)
                      const s = sources?.find((x) => x.id === id)
                      setSourceTeamId(s?.teams[0]?.id ?? "")
                    }}
                    disabled={sources === null}
                  >
                    <SelectTrigger className="h-9 w-full text-sm sm:w-56">
                      <SelectValue placeholder="Select series…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sources ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {s.season ? ` · ${s.season}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sourceTeamId}
                    onValueChange={setSourceTeamId}
                    disabled={sources === null || sourceTeams.length === 0}
                  >
                    <SelectTrigger className="h-9 w-full text-sm sm:w-56">
                      <SelectValue placeholder="Select team…" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceTeams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} · {t.playerCount} player{t.playerCount === 1 ? "" : "s"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleCopy}
                    disabled={copyBusy || !sourceTeamId}
                    className="gap-1.5"
                  >
                    {copyBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy Roster
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Duplicates every player from the selected team into {teamName}. Names that already exist are skipped.
                </p>
              </>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bulk-text">Players (paste from a spreadsheet, CSV, or just one name per line)</Label>
            <Textarea
              id="bulk-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={
                [
                  "Babar Azam, Batsman, Right-hand bat, Right-arm legbreak",
                  "Shaheen Afridi, Bowler, Left-hand bat, Left-arm fast",
                  "Mohammad Rizwan, Wicket-keeper, Right-hand bat, Right-arm medium",
                  "",
                  "# or just names (one per line):",
                  "Shadab Khan",
                  "Ifitikhar Ahmed",
                ].join("\n")
              }
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3 text-xs">
            <span className="font-medium">Default role for name-only rows:</span>
            <Select value={defaultRole} onValueChange={setDefaultRole}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">
              (only applies when rows are plain names with no role column)
            </span>
          </div>

          {/* Live preview */}
          {preview.length > 0 ? (
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Preview
                </div>
                <Badge variant="secondary" className="text-xs">
                  {preview.length} player{preview.length === 1 ? "" : "s"} ready
                </Badge>
              </div>
              <div className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden sm:table-cell">Batting</TableHead>
                      <TableHead className="hidden sm:table-cell">Bowling</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 50).map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{p.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{p.role}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {p.battingStyle}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {p.bowlingStyle || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {preview.length > 50 && (
                <div className="border-t px-3 py-1.5 text-center text-[11px] text-muted-foreground">
                  … and {preview.length - 50} more
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
              {text.trim()
                ? "No valid rows detected — check the delimiter."
                : "Paste a list of players above to see a preview here."}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={busy || preview.length === 0}
            className="gap-1.5"
          >
            {busy ? (
              <>
                <Upload className="h-4 w-4 animate-pulse" />
                Uploading…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Add {preview.length} player{preview.length === 1 ? "" : "s"}
              </>
            )}
          </Button>
        </DialogFooter>

        {preview.length === 0 && text.trim() && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Parsed 0 rows from this input.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
