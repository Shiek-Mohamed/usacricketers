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
  Plus,
  Pencil,
  Trash2,
  Users,
  X,
  Save,
  Loader2,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Player, Team } from "@/lib/types"

export function LeagueAdminPlayersView() {
  const navigate = useAppStore((s) => s.navigate)
  const session = useLeagueAdminSession((s) => s.session)
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<string>("all")
  const [editing, setEditing] = useState<Player | null>(null)
  const [showForm, setShowForm] = useState(false)
  const token = session?.token ?? null
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` }

  useEffect(() => {
    if (!session) return
    Promise.all([
      fetch("/api/teams").then((r) => r.json()),
      fetch("/api/players").then((r) => r.json()),
    ])
      .then(([t, p]: [Team[], Player[]]) => {
        setTeams(t)
        setPlayers(p)
      })
      .catch(() => { setTeams([]); setPlayers([]) })
      .finally(() => setLoading(false))
  }, [session])

  const filteredPlayers = (players ?? []).filter(
    (p) => selectedTeam === "all" || p.teamId === selectedTeam,
  )

  function handleSave(player: Partial<Player>) {
    const method = player.id ? "PUT" : "POST"
    const url = player.id ? `/api/players/${player.id}` : "/api/players"
    fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify(player),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((saved: Player) => {
        if (saved?.id) {
          if (method === "POST") {
            setPlayers((prev) => [...(prev ?? []), saved])
          } else {
            setPlayers((prev) =>
              (prev ?? []).map((p) => (p.id === saved.id ? saved : p)),
            )
          }
          setShowForm(false)
          setEditing(null)
        } else {
          alert(saved?.error || "Failed to save player")
        }
      })
      .catch(() => alert("Failed to save player"))
  }

  function handleDelete(playerId: string) {
    if (!confirm("Delete this player?")) return
    fetch(`/api/players/${playerId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setPlayers((prev) => (prev ?? []).filter((p) => p.id !== playerId))
      })
      .catch(() => alert("Failed to delete player"))
  }

  function teamName(teamId: string): string {
    return teams.find((t) => t.id === teamId)?.shortName ?? "?"
  }

  if (!session) {
    return <LeagueAdminShell title="Players"><p className="text-sm text-muted-foreground">Please sign in.</p></LeagueAdminShell>
  }

  return (
    <LeagueAdminShell
      title="Players"
      actionLabel="Add Player"
      onAction={() => { setEditing(null); setShowForm(true) }}
    >
      {/* Form */}
      {showForm && (
        <PlayerForm
          player={editing}
          teams={teams}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {/* Team filter */}
      {teams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTeam("all")}
            className={cn(
              "rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors",
              selectedTeam === "all"
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            All Teams ({players?.length ?? 0})
          </button>
          {teams.map((t) => {
            const count = (players ?? []).filter((p) => p.teamId === t.id).length
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                className={cn(
                  "rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors",
                  selectedTeam === t.id
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {t.shortName} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Player list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredPlayers.length > 0 ? (
        <div className="space-y-1.5">
          {filteredPlayers.map((player) => (
            <Card key={player.id} className="flex items-center gap-3 p-2.5">
              {/* Player avatar */}
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted font-display text-[10px] font-bold text-muted-foreground">
                {player.name.slice(0, 2).toUpperCase()}
              </span>
              {/* Player info */}
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-bold truncate">
                  {player.name}
                  {player.isCaptain && <span className="ml-1 text-xs text-muted-foreground">(c)</span>}
                  {player.isKeeper && <span className="ml-0.5 text-xs text-muted-foreground">†</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {teamName(player.teamId)} · {player.role}
                </div>
              </div>
              {/* Actions */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { setEditing(player); setShowForm(true) }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:text-red-700"
                onClick={() => handleDelete(player.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No players yet. Click "Add Player" to create your first player.
          </p>
        </Card>
      )}
    </LeagueAdminShell>
  )
}

/* -------------------------------------------------------------------------- */
/*  Player form (add/edit)                                                     */
/* -------------------------------------------------------------------------- */

function PlayerForm({
  player,
  teams,
  onSave,
  onCancel,
}: {
  player: Player | null
  teams: Team[]
  onSave: (player: Partial<Player>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(player?.name ?? "")
  const [teamId, setTeamId] = useState(player?.teamId ?? teams[0]?.id ?? "")
  const [role, setRole] = useState(player?.role ?? "Batsman")
  const [isCaptain, setIsCaptain] = useState(player?.isCaptain ?? false)
  const [isKeeper, setIsKeeper] = useState(player?.isKeeper ?? false)
  const [battingStyle, setBattingStyle] = useState(player?.battingStyle ?? "Right-hand bat")
  const [bowlingStyle, setBowlingStyle] = useState(player?.bowlingStyle ?? "")
  const [bio, setBio] = useState(player?.bio ?? "")
  const [saving, setSaving] = useState(false)

  function handleSubmit() {
    if (!name.trim() || !teamId) {
      alert("Player name and team are required")
      return
    }
    setSaving(true)
    onSave({
      id: player?.id,
      name: name.trim(),
      teamId,
      role: role.trim(),
      isCaptain,
      isKeeper,
      battingStyle: battingStyle.trim(),
      bowlingStyle: bowlingStyle.trim(),
      bio: bio.trim(),
      battingStats: player?.battingStats ?? '{"matches":0,"innings":0,"runs":0,"highest":"0","average":0,"strikeRate":0,"hundreds":0,"fifties":0,"fours":0,"sixes":0,"notOuts":0}',
      bowlingStats: player?.bowlingStats ?? null,
      imageUrl: player?.imageUrl ?? "",
    })
    setSaving(false)
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">
          {player ? "Edit Player" : "New Player"}
        </h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Name */}
        <div>
          <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
            Player Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Smith"
            className="h-9 text-sm"
          />
        </div>
        {/* Team */}
        <div>
          <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
            Team *
          </label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        {/* Role */}
        <div>
          <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option>Batsman</option>
            <option>Bowler</option>
            <option>All-rounder</option>
            <option>Wicket-keeper</option>
            <option>Wicket-keeper batsman</option>
          </select>
        </div>
        {/* Batting style */}
        <div>
          <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
            Batting Style
          </label>
          <select
            value={battingStyle}
            onChange={(e) => setBattingStyle(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option>Right-hand bat</option>
            <option>Left-hand bat</option>
          </select>
        </div>
        {/* Bowling style */}
        <div>
          <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
            Bowling Style
          </label>
          <Input
            value={bowlingStyle}
            onChange={(e) => setBowlingStyle(e.target.value)}
            placeholder="Right-arm fast"
            className="h-9 text-sm"
          />
        </div>
        {/* Captain / Keeper checkboxes */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={isCaptain}
              onChange={(e) => setIsCaptain(e.target.checked)}
              className="h-4 w-4"
            />
            Captain
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={isKeeper}
              onChange={(e) => setIsKeeper(e.target.checked)}
              className="h-4 w-4"
            />
            Wicket-keeper
          </label>
        </div>
      </div>

      {/* Bio */}
      <div className="mt-3">
        <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
          Bio
        </label>
        <Input
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Optional player bio"
          className="h-9 text-sm"
        />
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          size="sm"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {player ? "Update Player" : "Create Player"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  )
}
