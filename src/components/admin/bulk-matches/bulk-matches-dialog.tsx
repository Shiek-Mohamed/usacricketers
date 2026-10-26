"use client"

import { useMemo, useState } from "react"
import { api } from "@/lib/api"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CalendarPlus, ClipboardPaste, CheckCircle2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

/**
 * Parse a free-form CSV/TSV paste into match rows. Each row:
 *   team1Name, team2Name, format, venue, city, startDate, matchNo
 *
 * The startDate can be a date string ("2025-10-28") or datetime
 * ("2025-10-28 14:00"). Format is optional (defaults to T20I).
 */
function parseMatchRows(input: string) {
  const raw = input.trim()
  if (!raw) return []

  const firstLine = raw.split(/\r?\n/).find((l) => l.trim()) ?? ""
  let delim = ","
  const counts: Array<[string, number]> = [
    [",", (firstLine.match(/,/g) || []).length],
    ["\t", (firstLine.match(/\t/g) || []).length],
    ["|", (firstLine.match(/\|/g) || []).length],
    [";", (firstLine.match(/;/g) || []).length],
  ]
  counts.sort((a, b) => b[1] - a[1])
  if (counts[0][1] > 0) delim = counts[0][0]

  const lines = raw.split(/\r?\n/)
  let headerDetected = false
  const rows: string[][] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const cols = trimmed.split(delim).map((c) => c.trim())
    if (!headerDetected) {
      const joined = cols.join(" ").toLowerCase()
      if (cols.length >= 2 && (joined.includes("team") || joined.includes("date"))) {
        headerDetected = true
        continue
      }
    }
    rows.push(cols)
  }

  return rows
    .filter((r) => r.length >= 2 && r[0] && r[1])
    .map((r) => ({
      team1Name: r[0],
      team2Name: r[1],
      format: r[2] || "T20I",
      venue: r[3] || "TBD",
      city: r[4] || "",
      startDate: r[5] || new Date().toISOString().slice(0, 16),
      matchNo: r[6] || undefined,
    }))
}

export function BulkMatchesDialog({
  open,
  onOpenChange,
  seriesId,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  seriesId?: string
  onDone?: (createdCount: number) => void
}) {
  const [text, setText] = useState("")
  const [defaultFormat, setDefaultFormat] = useState("T20I")
  const [busy, setBusy] = useState(false)

  const parsed = useMemo(() => parseMatchRows(text), [text])

  async function handleUpload() {
    if (parsed.length === 0) {
      toast.error("Nothing to upload — paste some match rows first")
      return
    }
    setBusy(true)
    try {
      const result = await api.matches.bulkCreate(
        parsed.map((p) => ({ ...p, format: p.format || defaultFormat })),
        seriesId
      )
      if (result.skipped > 0) {
        toast.warning(
          `${result.created} created, ${result.skipped} skipped`,
          { description: result.skippedRows.slice(0, 5).join("; ") }
        )
      } else {
        toast.success(`${result.created} match${result.created === 1 ? "" : "es"} created`)
      }
      onDone?.(result.created)
      onOpenChange(false)
      setText("")
    } catch (e) {
      toast.error("Bulk schedule failed", { description: String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-emerald-600" />
            Bulk schedule matches
          </DialogTitle>
          <DialogDescription>
            Paste fixture rows below. One match per line. CSV, TSV, pipe, or
            semicolon delimiters all work. Column order is positional:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              team1, team2, format?, venue?, city?, startDate, matchNo?
            </code>
            . Team names are matched case-insensitively by short name (e.g.
            &ldquo;IND&rdquo;) or full name.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="bulk-text">Fixtures (paste from a spreadsheet)</Label>
            <Textarea
              id="bulk-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={
                [
                  "IND, AUS, T20I, Wankhede Stadium, Mumbai, 2025-10-28 19:00, 1st Match",
                  "IND, AUS, T20I, Eden Gardens, Kolkata, 2025-10-30 19:00, 2nd Match",
                  "IND, AUS, ODI, Wankhede Stadium, Mumbai, 2025-11-02 14:00, 3rd Match",
                  "",
                  "# or just team names (defaults applied):",
                  "PAK, RSA",
                  "ENG, NZL",
                ].join("\n")
              }
              className="font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3 text-xs">
            <span className="font-medium">Default format (for name-only rows):</span>
            <Select value={defaultFormat} onValueChange={setDefaultFormat}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Test", "ODI", "T20I", "T10"].map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {parsed.length > 0 ? (
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ClipboardPaste className="h-3.5 w-3.5" /> Preview
                </div>
                <Badge variant="secondary" className="text-xs">
                  {parsed.length} match{parsed.length === 1 ? "" : "es"} ready
                </Badge>
              </div>
              <div className="max-h-48 overflow-y-auto p-2 text-xs [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-muted-foreground">
                      <th className="px-1 py-1">#</th>
                      <th>Team 1</th>
                      <th>Team 2</th>
                      <th>Format</th>
                      <th>Venue</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 20).map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-1 py-1 text-muted-foreground">{i + 1}</td>
                        <td className="font-medium">{p.team1Name}</td>
                        <td className="font-medium">{p.team2Name}</td>
                        <td>{p.format}</td>
                        <td className="truncate max-w-32">{p.venue}</td>
                        <td className="text-muted-foreground">{p.startDate.slice(0, 16)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.length > 20 && (
                <div className="border-t px-3 py-1.5 text-center text-[11px] text-muted-foreground">
                  … and {parsed.length - 20} more
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center text-xs text-muted-foreground">
              {text.trim()
                ? "No valid rows detected — check the delimiter."
                : "Paste a list of fixtures above to see a preview here."}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={busy || parsed.length === 0}
            className="gap-1.5"
          >
            {busy ? (
              <>
                <CalendarPlus className="h-4 w-4 animate-pulse" />
                Creating…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Create {parsed.length} match{parsed.length === 1 ? "" : "es"}
              </>
            )}
          </Button>
        </DialogFooter>

        {parsed.length === 0 && text.trim() && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Parsed 0 rows from this input.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
