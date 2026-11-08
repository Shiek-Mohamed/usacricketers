"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { LeagueAdminShell } from "@/components/admin/league-admin-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Pencil,
  Trash2,
  Users,
  Save,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UploadButton } from "@/components/admin/upload-button"
import type { Player, Team } from "@/lib/types"

const ROLES = ["Batsman", "Bowler", "All-rounder", "Wicket-keeper", "Wicket-keeper batsman"] as const

export function LeagueAdminPlayersView() {
  const navigate = useAppStore((s) => s.navigate)
  const initialTeamId = useAppStore((s) => s.id)
  const session = useLeagueAdminSession((s) => s.session)
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<string>(initialTeamId ?? "all")
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
        if (initialTeamId && !t.some((tm) => tm.id === initialTeamId)) {
          setSelectedTeam("all")
        }
      })
      .catch(() => { setTeams([]); setPlayers([]) })
      .finally(() => setLoading(false))
  }, [session, initialTeamId])

  const filteredPlayers = (players ?? []).filter(
    (p) => selectedTeam === "all" || p.teamId === selectedTeam,
  )

  // Sync the selected team when the store's `id` changes (e.g. the user
  // clicks a team card on the teams view, or deep-links directly to
  // ?view=league-admin-players&id=<teamId>). Using the "adjust state during
  // render" pattern (instead of an effect) avoids cascading renders and is
  // the React-recommended way to sync derived state with a prop/store value.
  // Without this, `selectedTeam` would be captured on first render — before
  // page.tsx's URL-sync effect runs — so the team filter would never apply
  // on a fresh page load with ?id=<teamId> in the URL.
  const [lastNavId, setLastNavId] = useState<string | null>(initialTeamId ?? null)
  if ((initialTeamId ?? null) !== lastNavId) {
    setLastNavId(initialTeamId ?? null)
    setSelectedTeam(initialTeamId ?? "all")
  }

  // Returns a promise so the form's saving state reflects the real request.
  function handleSave(player: Partial<Player>): Promise<boolean> {
    const method = player.id ? "PUT" : "POST"
    const url = player.id ? `/api/players/${player.id}` : "/api/players"
    return fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify(player),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok || !data?.id) {
          alert(data?.error || `Failed to save player (HTTP ${r.status})`)
          return false
        }
        const saved: Player = data
        if (method === "POST") {
          setPlayers((prev) => [...(prev ?? []), saved])
        } else {
          setPlayers((prev) =>
            (prev ?? []).map((p) => (p.id === saved.id ? saved : p)),
          )
        }
        setShowForm(false)
        setEditing(null)
        return true
      })
      .catch(() => {
        alert("Failed to save player")
        return false
      })
  }

  function handleDelete(playerId: string) {
    if (!confirm("Delete this player?")) return
    fetch(`/api/players/${playerId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setPlayers((prev) => (prev ?? []).filter((p) => p.id !== playerId))
      })
      .catch(() => alert("Failed to delete player"))
  }

  function teamFor(teamId: string): Team | undefined {
    return teams.find((t) => t.id === teamId)
  }

  const selectedTeamObj = selectedTeam !== "all" ? teamFor(selectedTeam) ?? null : null
  const headerTitle = selectedTeamObj
    ? `Players · ${selectedTeamObj.name}`
    : "Players"
  const count = filteredPlayers.length

  if (!session) {
    return <LeagueAdminShell title="Players"><p className="text-sm text-muted-foreground">Please sign in.</p></LeagueAdminShell>
  }

  return (
    <LeagueAdminShell
      title={headerTitle}
      onBack={selectedTeamObj ? () => navigate("league-admin-teams") : undefined}
      actionLabel="Add Player"
      onAction={() => { setEditing(null); setShowForm(true) }}
    >
      {/* Compact stats + team filter */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-xs">
            <ShieldCheck className="h-3 w-3" />
            {count} player{count === 1 ? "" : "s"}
          </Badge>
          {teams.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedTeam("all")}
                className={cn(
                  "rounded-full px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-wide transition-colors",
                  selectedTeam === "all"
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                All ({players?.length ?? 0})
              </button>
              {teams.map((t) => {
                const c = (players ?? []).filter((p) => p.teamId === t.id).length
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeam(t.id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-wide transition-colors",
                      selectedTeam === t.id
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {t.shortName} ({c})
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Player grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredPlayers.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredPlayers.map((player) => {
            const team = teamFor(player.teamId)
            return (
              <PlayerCard
                key={player.id}
                player={player}
                team={team}
                onEdit={() => { setEditing(player); setShowForm(true) }}
                onDelete={() => handleDelete(player.id)}
                onViewStats={() => navigate("player-detail", player.id)}
              />
            )
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No players yet</p>
          <p className="text-xs text-muted-foreground/70">Click &ldquo;Add Player&rdquo; or use bulk upload from the Teams view.</p>
        </Card>
      )}

      {/* Add / Edit player dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Player" : "New Player"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the player details below."
                : "Add a new player to a team."}
            </DialogDescription>
          </DialogHeader>
          <PlayerForm
            key={editing?.id ?? "new"}
            player={editing}
            teams={teams}
            defaultTeamId={selectedTeam !== "all" ? selectedTeam : undefined}
            authToken={token}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </DialogContent>
      </Dialog>
    </LeagueAdminShell>
  )
}

/* -------------------------------------------------------------------------- */
/*  Player card (grid item)                                                    */
/* -------------------------------------------------------------------------- */

function PlayerCard({
  player,
  team,
  onEdit,
  onDelete,
  onViewStats,
}: {
  player: Player
  team?: Team
  onEdit: () => void
  onDelete: () => void
  onViewStats: () => void
}) {
  const teamColor = team?.primaryColor ?? "#94a3b8"
  return (
    <Card className="group relative flex items-start gap-4 overflow-hidden p-4 pl-5 transition-shadow hover:shadow-md">
      {/* Left accent stripe in team color */}
      <span
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: teamColor }}
      />
      {/* Clickable avatar + info → navigates to the player's stats page */}
      <button
        type="button"
        onClick={onViewStats}
        className="flex min-w-0 flex-1 items-start gap-4 text-left"
        aria-label={`View ${player.name} stats`}
        title="View stats"
      >
        {/* Avatar — player photo if available, otherwise initials on a
            team-colored gradient. Large (h-20) so faces are clearly
            visible in the 2-per-row layout. */}
        {player.imageUrl ? (
          <img
            src={player.imageUrl}
            alt={player.name}
            className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-background"
            loading="lazy"
          />
        ) : (
          <span
            className="grid h-20 w-20 shrink-0 place-items-center rounded-full font-display text-xl font-bold text-white ring-4 ring-background"
            style={{ background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}bb 100%)` }}
          >
            {player.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold leading-tight line-clamp-1">{player.name}</span>
            {player.isCaptain && <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">C</span>}
            {player.isKeeper && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">WK</span>}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            {team && <span className="font-bold uppercase tracking-wide" style={{ color: teamColor }}>{team.shortName}</span>}
            <span className="text-muted-foreground/50">·</span>
            <span className="truncate text-muted-foreground">{player.role}</span>
          </div>
          {/* Batting / bowling style */}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {player.battingStyle && (
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground/60">Bat:</span>
                {player.battingStyle.replace(" bat", "")}
              </span>
            )}
            {player.bowlingStyle && (
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground/60">Bowl:</span>
                {player.bowlingStyle}
              </span>
            )}
          </div>
          <div className="mt-1.5 text-xs font-bold uppercase tracking-wide text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">
            View Stats →
          </div>
        </div>
      </button>
      {/* Actions — edit + delete side by side with labels */}
      <div className="flex shrink-0 self-center items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2 opacity-60 transition-opacity group-hover:opacity-100"
          aria-label="Edit player"
          title="Edit player"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wide">Edit</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-2 text-destructive opacity-60 transition-opacity group-hover:opacity-100 hover:text-destructive"
          aria-label="Delete player"
          title="Delete player"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wide">Delete</span>
        </Button>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Player form (inside dialog)                                                */
/* -------------------------------------------------------------------------- */

function PlayerForm({
  player,
  teams,
  defaultTeamId,
  authToken,
  onSave,
  onCancel,
}: {
  player: Player | null
  teams: Team[]
  defaultTeamId?: string
  authToken?: string | null
  onSave: (player: Partial<Player>) => Promise<boolean>
  onCancel: () => void
}) {
  const [name, setName] = useState(player?.name ?? "")
  const [teamId, setTeamId] = useState(player?.teamId ?? defaultTeamId ?? teams[0]?.id ?? "")
  const [role, setRole] = useState(player?.role ?? "Batsman")
  const [isCaptain, setIsCaptain] = useState(player?.isCaptain ?? false)
  const [isKeeper, setIsKeeper] = useState(player?.isKeeper ?? false)
  const [battingStyle, setBattingStyle] = useState(player?.battingStyle ?? "Right-hand bat")
  const [bowlingStyle, setBowlingStyle] = useState(player?.bowlingStyle ?? "")
  const [bio, setBio] = useState(player?.bio ?? "")
  const [imageUrl, setImageUrl] = useState(player?.imageUrl ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !teamId) {
      alert("Player name and team are required")
      return
    }
    setSaving(true)
    try {
      await onSave({
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
        imageUrl: imageUrl.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-3 py-1">
      {/* Photo + Name + Team */}
      <div className="flex items-start gap-3">
        {/* Photo upload */}
        <div className="grid shrink-0 gap-1">
          <label className="text-xs font-medium text-muted-foreground">Photo</label>
          <div className="flex items-center gap-2">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Player"
                className="h-11 w-11 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-muted font-display text-[11px] font-bold text-muted-foreground">
                {(name || "?").slice(0, 2).toUpperCase()}
              </span>
            )}
            <UploadButton
              label="Upload"
              resize={300}
              authToken={authToken}
              onUploaded={(url) => setImageUrl(url)}
            />
            {imageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => setImageUrl("")}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        {/* Name + Team */}
        <div className="grid flex-1 grid-cols-3 gap-3">
          <div className="col-span-2 grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Player Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              className="h-9 text-sm"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Team *</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.shortName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Role + Batting + Bowling */}
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Batting</label>
          <select
            value={battingStyle}
            onChange={(e) => setBattingStyle(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option>Right-hand bat</option>
            <option>Left-hand bat</option>
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Bowling</label>
          <Input
            value={bowlingStyle}
            onChange={(e) => setBowlingStyle(e.target.value)}
            placeholder="Right-arm fast"
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Captain / Keeper */}
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

      {/* Bio */}
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground">Bio</label>
        <Input
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Optional player bio"
          className="h-9 text-sm"
        />
      </div>

      <DialogFooter className="gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          size="sm"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {player ? "Update Player" : "Create Player"}
        </Button>
      </DialogFooter>
    </div>
  )
}
