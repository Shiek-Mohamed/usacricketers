"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Scale, Trash2, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

interface PenaltyRow {
  id: string
  teamId: string
  teamName: string
  teamShortName: string
  type: string
  value: number
  reason: string
  createdAt: string
}

interface TeamOpt {
  teamId: string
  teamName: string
  teamShortName: string
}

function csrfToken(): string {
  if (typeof document === "undefined") return ""
  return document.cookie.match(/csrf-token=([^;]+)/)?.[1] || ""
}

/**
 * Penalties & Deductions management card — mounted inside the admin
 * Tournament editor. Lists existing penalties for the series, lets the
 * admin add a points deduction or NRR adjustment, and remove one. Uses
 * site-admin cookie + CSRF auth (the admin CMS context).
 *
 * The standings recomputation is automatic: GET /api/standings reads these
 * rows, so after an add/remove the admin just hits "Refresh" on the
 * standings table (or waits ~30s for the SWR cache).
 */
export function PenaltiesCard({ seriesId }: { seriesId: string }) {
  const [penalties, setPenalties] = useState<PenaltyRow[] | null>(null)
  const [teams, setTeams] = useState<TeamOpt[]>([])
  const [busy, setBusy] = useState(false)
  const [teamId, setTeamId] = useState("")
  const [type, setType] = useState<"points" | "nrr">("points")
  const [value, setValue] = useState("")
  const [reason, setReason] = useState("")

  async function refetch() {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`/api/series/${seriesId}/penalties`),
        fetch(`/api/standings?seriesId=${seriesId}`),
      ])
      const pData = await pRes.json().catch(() => ({ items: [] }))
      const sData = await sRes.json().catch(() => [])
      setPenalties(Array.isArray(pData?.items) ? pData.items : [])
      setTeams(
        Array.isArray(sData)
          ? sData.map((s: TeamOpt) => ({
              teamId: s.teamId,
              teamName: s.teamName,
              teamShortName: s.teamShortName,
            }))
          : [],
      )
    } catch {
      setPenalties([])
    }
  }

  useEffect(() => {
    if (!seriesId) return
    let cancelled = false
    const load = async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          fetch(`/api/series/${seriesId}/penalties`),
          fetch(`/api/standings?seriesId=${seriesId}`),
        ])
        const pData = await pRes.json().catch(() => ({ items: [] }))
        const sData = await sRes.json().catch(() => [])
        if (cancelled) return
        setPenalties(Array.isArray(pData?.items) ? pData.items : [])
        setTeams(
          Array.isArray(sData)
            ? sData.map((s: TeamOpt) => ({
                teamId: s.teamId,
                teamName: s.teamName,
                teamShortName: s.teamShortName,
              }))
            : [],
        )
      } catch {
        if (!cancelled) setPenalties([])
      }
    }
    load()
    return () => {
      cancelled = true
      setPenalties(null)
    }
  }, [seriesId])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!teamId) {
      toast.error("Select a team")
      return
    }
    const v = parseFloat(value)
    if (!isFinite(v) || v === 0) {
      toast.error("Enter a non-zero value")
      return
    }
    if (type === "points" && v <= 0) {
      toast.error("Points deduction must be positive (e.g. 2 deducts 2 points)")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/series/${seriesId}/penalties`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken() },
        body: JSON.stringify({ teamId, type, value: v, reason: reason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Failed to add penalty")
        return
      }
      toast.success("Penalty added")
      setTeamId("")
      setValue("")
      setReason("")
      await refetch()
    } catch (e) {
      toast.error("Failed to add penalty", { description: String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this penalty? Standings will recompute without it.")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/penalties/${id}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfToken() },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Failed to delete")
        return
      }
      toast.success("Penalty removed")
      await refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-bold">Penalties &amp; Deductions</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Dock points or adjust NRR for a team. Applied to the auto-computed
          standings; the raw match-derived totals are never changed.
        </p>

        {/* Existing penalties */}
        {penalties === null ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : penalties.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
            No penalties applied yet.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <ul className="space-y-1.5">
              {penalties.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{p.teamName}</span>
                      {p.type === "points" ? (
                        <Badge variant="destructive" className="text-[10px]">
                          −{p.value} pts
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          {p.value > 0 ? "+" : ""}
                          {Number(p.value).toFixed(3)} NRR
                        </Badge>
                      )}
                    </div>
                    {p.reason && (
                      <p className="truncate text-[11px] text-muted-foreground">{p.reason}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(p.id)}
                    disabled={busy}
                    className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete penalty"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add form */}
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-lg border bg-muted/20 p-3"
        >
          <p className="text-xs font-semibold text-muted-foreground">Add a penalty</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid w-full gap-1 sm:w-48">
              <Label className="text-[11px]">Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select team…" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.teamId} value={t.teamId}>
                      {t.teamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-full gap-1 sm:w-44">
              <Label className="text-[11px]">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as "points" | "nrr")}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">Points deduction</SelectItem>
                  <SelectItem value="nrr">NRR adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid w-full gap-1 sm:w-28">
              <Label className="text-[11px]">{type === "points" ? "Points" : "NRR ±"}</Label>
              <Input
                type="number"
                step={type === "points" ? "1" : "0.001"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-9 text-sm"
                placeholder={type === "points" ? "2" : "-0.5"}
              />
            </div>
            <Button type="submit" size="sm" disabled={busy || !teamId} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional, e.g. Slow over-rate)"
            className="h-9 text-sm"
          />
        </form>
      </CardContent>
    </Card>
  )
}
