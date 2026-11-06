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
  Plus,
  Pencil,
  Trash2,
  Users,
  Save,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import { BulkPlayersDialog } from "@/components/admin/bulk-players/bulk-players-dialog"
import type { Team } from "@/lib/types"

/* -------------------------------------------------------------------------- */
/*  Team management view for league admins                                     */
/* -------------------------------------------------------------------------- */

export function LeagueAdminTeamsView() {
  const navigate = useAppStore((s) => s.navigate)
  const session = useLeagueAdminSession((s) => s.session)
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Team | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [bulkFor, setBulkFor] = useState<Team | null>(null)
  const token = session?.token ?? null
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` }

  // Load teams
  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data: Team[]) => { if (!cancelled) { setTeams(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setTeams([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [session])

  // Returns a promise that resolves to true on success, false on failure.
  function handleSave(team: Partial<Team>): Promise<boolean> {
    const method = team.id ? "PUT" : "POST"
    const url = team.id ? `/api/teams/${team.id}` : "/api/teams"
    return fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify(team),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok || !data?.id) {
          alert(data?.error || `Failed to save team (HTTP ${r.status})`)
          return false
        }
        const saved: Team = data
        if (method === "POST") {
          setTeams((prev) => [...(prev ?? []), saved])
        } else {
          setTeams((prev) =>
            (prev ?? []).map((t) => (t.id === saved.id ? saved : t)),
          )
        }
        setShowForm(false)
        setEditing(null)
        return true
      })
      .catch(() => {
        alert("Failed to save team")
        return false
      })
  }

  function handleDelete(teamId: string) {
    if (!confirm("Delete this team? This cannot be undone.")) return
    fetch(`/api/teams/${teamId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setTeams((prev) => (prev ?? []).filter((t) => t.id !== teamId))
      })
      .catch(() => alert("Failed to delete team"))
  }

  if (!session) {
    return <LeagueAdminShell title="Teams"><p className="text-sm text-muted-foreground">Please sign in.</p></LeagueAdminShell>
  }

  const count = teams?.length ?? 0

  return (
    <LeagueAdminShell
      title="Teams"
      actionLabel="Add Team"
      onAction={() => { setEditing(null); setShowForm(true) }}
    >
      {/* Compact stats bar */}
      {!loading && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              <ShieldCheck className="h-3 w-3" />
              {count} team{count === 1 ? "" : "s"}
            </Badge>
            {count > 0 && (
              <button
                onClick={() => navigate("league-admin-players")}
                className="font-display text-xs font-bold uppercase tracking-wide text-emerald-600 hover:text-emerald-700"
              >
                Manage Players →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Team grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : teams && teams.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onEdit={() => { setEditing(team); setShowForm(true) }}
              onDelete={() => handleDelete(team.id)}
              onBulk={() => setBulkFor(team)}
            />
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No teams yet</p>
          <p className="text-xs text-muted-foreground/70">Click &ldquo;Add Team&rdquo; to create your first team.</p>
        </Card>
      )}

      {/* Add / Edit team dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) setEditing(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Team" : "New Team"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the team details below."
                : "Create a new team for your league."}
            </DialogDescription>
          </DialogHeader>
          <TeamForm
            key={editing?.id ?? "new"}
            team={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* Bulk add players dialog */}
      {bulkFor && (
        <BulkPlayersDialog
          open={!!bulkFor}
          onOpenChange={(v) => !v && setBulkFor(null)}
          teamId={bulkFor.id}
          teamName={bulkFor.name}
          authToken={token}
        />
      )}
    </LeagueAdminShell>
  )
}

/* -------------------------------------------------------------------------- */
/*  Team card (grid item)                                                      */
/* -------------------------------------------------------------------------- */

function TeamCard({
  team,
  onEdit,
  onDelete,
  onBulk,
}: {
  team: Team
  onEdit: () => void
  onDelete: () => void
  onBulk: () => void
}) {
  return (
    <Card className="group flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-md">
      {/* Badge banner */}
      <div
        className="relative flex h-16 items-center justify-between px-3"
        style={{
          background: `linear-gradient(135deg, ${team.primaryColor} 0%, ${team.primaryColor}dd 100%)`,
        }}
      >
        <span className="font-display text-lg font-extrabold tracking-tight text-white drop-shadow-sm">
          {team.shortName.slice(0, 4).toUpperCase()}
        </span>
        {/* Accent strip */}
        <span
          className="absolute bottom-0 left-0 h-1 w-full"
          style={{ background: team.accentColor }}
        />
        {/* Color dots */}
        <div className="flex gap-1">
          <span
            className="h-3 w-3 rounded-full border border-white/40"
            style={{ background: team.primaryColor }}
            title="Primary color"
          />
          <span
            className="h-3 w-3 rounded-full border border-white/40"
            style={{ background: team.accentColor }}
            title="Accent color"
          />
        </div>
      </div>

      {/* Team info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-h-[2.5rem]">
          <div className="font-display text-sm font-bold leading-tight line-clamp-2">{team.name}</div>
          {team.country && (
            <div className="mt-0.5 text-xs text-muted-foreground truncate">{team.country}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 gap-1 px-1 text-xs"
            aria-label="Bulk add players"
            title="Bulk add players"
            onClick={onBulk}
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Players</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Edit team"
            title="Edit team"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            aria-label="Delete team"
            title="Delete team"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Team form (inside dialog)                                                  */
/* -------------------------------------------------------------------------- */

function TeamForm({
  team,
  onSave,
  onCancel,
}: {
  team: Team | null
  onSave: (team: Partial<Team>) => Promise<boolean>
  onCancel: () => void
}) {
  const [name, setName] = useState(team?.name ?? "")
  const [shortName, setShortName] = useState(team?.shortName ?? "")
  const [country, setCountry] = useState(team?.country ?? "")
  const [primaryColor, setPrimaryColor] = useState(team?.primaryColor ?? "#1e2a5e")
  const [accentColor, setAccentColor] = useState(team?.accentColor ?? "#f59e0b")
  const [description, setDescription] = useState(team?.description ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim() || !shortName.trim()) {
      alert("Team name and short name are required")
      return
    }
    setSaving(true)
    try {
      await onSave({
        id: team?.id,
        name: name.trim(),
        shortName: shortName.trim().toUpperCase(),
        country: country.trim(),
        primaryColor,
        accentColor,
        description: description.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-3 py-1">
      {/* Name + Short name */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Team Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Australia"
            className="h-9 text-sm"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Short *</label>
          <Input
            value={shortName}
            onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="AUS"
            className="h-9 text-sm uppercase"
          />
        </div>
      </div>

      {/* Country + Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Country</label>
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Australia"
            className="h-9 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Primary</label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-full cursor-pointer rounded-md border border-border bg-transparent"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium text-muted-foreground">Accent</label>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-9 w-full cursor-pointer rounded-md border border-border bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional team description"
          className="h-9 text-sm"
        />
      </div>

      {/* Live preview */}
      <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
        <span className="text-xs text-muted-foreground">Preview:</span>
        <span
          className="grid h-7 w-7 place-items-center rounded font-display text-[10px] font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
            boxShadow: `inset 0 -2px 0 ${accentColor}`,
          }}
        >
          {(shortName || "?").slice(0, 3).toUpperCase()}
        </span>
        <span className="font-display text-sm font-bold">{name || "Team Name"}</span>
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
          {team ? "Update Team" : "Create Team"}
        </Button>
      </DialogFooter>
    </div>
  )
}
