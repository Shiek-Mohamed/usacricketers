"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Shield, Save, Loader2, Check, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Match } from "@/lib/types"

interface SeriesItem { id: string; name: string; shortName: string }

export function LeagueAdminOfficialsView() {
  const session = useLeagueAdminSession((s) => s.session)
  const [series, setSeries] = useState<SeriesItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  // Editable officials state per match
  const [officials, setOfficials] = useState<Record<string, { umpires: string; tvUmpire: string; referee: string }>>({})

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch("/api/series")
      .then((r) => r.json())
      .then((data: SeriesItem[]) => {
        if (cancelled) return
        const managed = data.filter((s: SeriesItem) => session.managedSeriesIds.includes(s.id))
        const list = managed.length > 0 ? managed : data
        setSeries(list)
        if (list.length > 0) setSelectedId(list[0].id)
        else setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    fetch(`/api/matches`)
      .then((r) => r.json())
      .then((data: Match[]) => {
        if (cancelled) return
        const filtered = data.filter((m) => m.seriesId === selectedId)
        setMatches(filtered)
        // Initialize officials state from match data
        const init: Record<string, { umpires: string; tvUmpire: string; referee: string }> = {}
        filtered.forEach((m) => {
          init[m.id] = { umpires: m.umpires || "", tvUmpire: m.tvUmpire || "", referee: m.referee || "" }
        })
        setOfficials(init)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  function handleSave(matchId: string) {
    const data = officials[matchId]
    if (!data) return
    setSaving(matchId)
    setSaved(null)
    fetch(`/api/matches/${matchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(() => { setSaving(null); setSaved(matchId); setTimeout(() => setSaved(null), 2000) })
      .catch(() => { setSaving(null); alert("Failed to save") })
  }

  if (!session) {
    return <LeagueAdminShell title="Officials"><p className="text-sm text-muted-foreground">Please sign in.</p></LeagueAdminShell>
  }

  return (
    <LeagueAdminShell title="Officials">
      {/* Series selector */}
      {series.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {series.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedId(s.id); setLoading(true) }}
              className={cn(
                "rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors",
                selectedId === s.id ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {s.shortName}
            </button>
          ))}
        </div>
      )}

      {/* Match list with officials assignment */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : matches.length > 0 ? (
        <div className="space-y-2">
          {matches.map((match) => {
            const data = officials[match.id] || { umpires: "", tvUmpire: "", referee: "" }
            return (
              <Card key={match.id} className="p-3">
                {/* Match header */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-[#1e2a5e]" />
                    <span className="font-display text-sm font-bold">
                      {match.team1?.shortName} v {match.team2?.shortName}
                    </span>
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                      match.status === "live" && "bg-red-100 text-red-700",
                      match.status === "completed" && "bg-emerald-100 text-emerald-700",
                      match.status === "upcoming" && "bg-amber-100 text-amber-700",
                    )}>
                      {match.status}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{match.matchNo}</span>
                </div>

                {/* Officials inputs */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="mb-0.5 block font-display text-[10px] font-bold uppercase tracking-wide text-muted-foreground">On-field Umpires</label>
                    <Input
                      value={data.umpires}
                      onChange={(e) => setOfficials((prev) => ({ ...prev, [match.id]: { ...prev[match.id], umpires: e.target.value } }))}
                      placeholder="John Smith, Jane Doe"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block font-display text-[10px] font-bold uppercase tracking-wide text-muted-foreground">TV Umpire</label>
                    <Input
                      value={data.tvUmpire}
                      onChange={(e) => setOfficials((prev) => ({ ...prev, [match.id]: { ...prev[match.id], tvUmpire: e.target.value } }))}
                      placeholder="Third umpire name"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block font-display text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Match Referee</label>
                    <Input
                      value={data.referee}
                      onChange={(e) => setOfficials((prev) => ({ ...prev, [match.id]: { ...prev[match.id], referee: e.target.value } }))}
                      placeholder="Referee name"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Save button */}
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleSave(match.id)}
                    disabled={saving === match.id}
                    className="gap-1.5 h-7 text-xs"
                  >
                    {saving === match.id ? <Loader2 className="h-3 w-3 animate-spin" /> : saved === match.id ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                    {saving === match.id ? "Saving..." : saved === match.id ? "Saved!" : "Save"}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No matches in this series. Schedule matches first to assign officials.
          </p>
        </Card>
      )}
    </LeagueAdminShell>
  )
}
