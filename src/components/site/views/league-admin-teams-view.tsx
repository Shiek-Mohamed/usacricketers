"use client"

import { useEffect, useRef, useState } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BulkPlayersDialog } from "@/components/admin/bulk-players/bulk-players-dialog"
import type { Team } from "@/lib/types"

/* -------------------------------------------------------------------------- */
/*  Team management view for league admins                                     */
/* -------------------------------------------------------------------------- */

export function LeagueAdminTeamsView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const session = useLeagueAdminSession((s) => s.session)
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Team | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [bulkFor, setBulkFor] = useState<Team | null>(null)
  const token = session?.token ?? null
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` }

  // Load teams for the managed series
  useEffect(() => {
    if (!session) return
    let cancelled = false
    // Fetch all teams (the admin can see all teams in the system for now;
    // with multi-tenancy, this will filter by organization_id)
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data: Team[]) => { if (!cancelled) { setTeams(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setTeams([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [session])

  // Returns a promise that resolves to true on success, false on failure.
  // Awaited by the form so the "saving" spinner reflects the real request
  // state and the button stays disabled until the fetch completes.
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

  return (
    <LeagueAdminShell
      title="Teams"
      actionLabel="Add Team"
      onAction={() => { setEditing(null); setShowForm(true) }}
    >
      {/* Form (modal-style inline).
          The `key` forces React to remount TeamForm whenever the target
          team changes (or when switching between "new" and "edit"). Without
          it, useState initializers in TeamForm only run once on first mount,
          so clicking edit on a team while the form is already open would
          leave the fields showing stale (empty) data. */}
      {showForm && (
        <TeamForm
          key={editing?.id ?? "new"}
          team={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {/* Team list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : teams && teams.length > 0 ? (
        <div className="space-y-2">
          {teams.map((team) => (
            <Card key={team.id} className="flex items-center gap-3 p-3">
              {/* Team badge */}
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded font-display text-xs font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${team.primaryColor} 0%, ${team.primaryColor}cc 100%)`,
                }}
              >
                {team.shortName.slice(0, 3).toUpperCase()}
              </span>
              {/* Team info */}
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-bold truncate">{team.name}</div>
                <div className="text-xs text-muted-foreground">
                  {team.shortName}
                  {team.country && ` · ${team.country}`}
                </div>
              </div>
              {/* Actions */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Bulk add players"
                title="Bulk add players"
                onClick={() => setBulkFor(team)}
              >
                <Users className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Edit team"
                title="Edit team"
                onClick={() => { setEditing(team); setShowForm(true) }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:text-red-700"
                aria-label="Delete team"
                title="Delete team"
                onClick={() => handleDelete(team.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No teams yet. Click "Add Team" to create your first team.
          </p>
        </Card>
      )}

      {/* Player count link */}
      {teams && teams.length > 0 && (
        <div className="pt-2 text-center">
          <button
            onClick={() => navigate("league-admin-players")}
            className="font-display text-xs font-bold uppercase tracking-wide text-emerald-600 hover:text-emerald-700"
          >
            Manage Players →
          </button>
        </div>
      )}

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
/*  Team form (add/edit)                                                       */
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

  // The form renders above the team list. When a user clicks edit on a team
  // far down the list, the form opens off-screen at the top — so scroll it
  // into view on mount (and on team change, since the `key` on <TeamForm>
  // forces a remount). "start" keeps the form header visible at the top of
  // the viewport; a small negative scroll-margin (via the wrapper class)
  // leaves breathing room beneath the sticky app header.
  const formRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

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
    <div ref={formRef} className="scroll-mt-24">
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">
          {team ? "Edit Team" : "New Team"}
        </h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Name */}
        <div>
          <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
            Team Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Australia"
            className="h-9 text-sm"
          />
        </div>
        {/* Short name */}
        <div>
          <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
            Short Name *
          </label>
          <Input
            value={shortName}
            onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="AUS"
            className="h-9 text-sm uppercase"
          />
        </div>
        {/* Country */}
        <div>
          <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
            Country
          </label>
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Australia"
            className="h-9 text-sm"
          />
        </div>
        {/* Colors */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
              Primary
            </label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-full rounded-md border border-border"
            />
          </div>
          <div>
            <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
              Accent
            </label>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-9 w-full rounded-md border border-border"
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mt-3">
        <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
          Description
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional team description"
          className="h-9 text-sm"
        />
      </div>

      {/* Preview badge */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Preview:</span>
        <span
          className="grid h-8 w-8 place-items-center rounded font-display text-[10px] font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
          }}
        >
          {(shortName || "?").slice(0, 3).toUpperCase()}
        </span>
        <span className="font-display text-sm font-bold">{name || "Team Name"}</span>
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
          {team ? "Update Team" : "Create Team"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
    </div>
  )
}
