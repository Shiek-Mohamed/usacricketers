"use client"

import { useState } from "react"
import { usePlayers, useTeams } from "@/lib/use-data"
import { api } from "@/lib/api"
import { AdminShell } from "@/components/admin/admin-shell"
import { UploadButton } from "@/components/admin/upload-button"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PlayerAvatar } from "@/components/cricket/ui"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Plus, Pencil, Trash2, Search } from "lucide-react"
import { toast } from "sonner"
import type { Player, BattingStat, BowlingStat } from "@/lib/types"

const ROLES = ["Batsman", "Bowler", "All-rounder", "Wicket-keeper"] as const

const emptyBatting: BattingStat = {
  matches: 0,
  innings: 0,
  runs: 0,
  highest: "0",
  average: 0,
  strikeRate: 0,
  hundreds: 0,
  fifties: 0,
  fours: 0,
  sixes: 0,
  notOuts: 0,
}

const emptyBowling: BowlingStat = {
  matches: 0,
  innings: 0,
  balls: 0,
  runs: 0,
  wickets: 0,
  best: "0/0",
  economy: 0,
  average: 0,
  strikeRate: 0,
  maidens: 0,
}

interface PlayerFormState {
  name: string
  teamId: string
  role: string
  battingStyle: string
  bowlingStyle: string
  bio: string
  imageUrl: string
  batting: BattingStat
  bowling: BowlingStat
}

const emptyForm: PlayerFormState = {
  name: "",
  teamId: "",
  role: "Batsman",
  battingStyle: "Right-hand bat",
  bowlingStyle: "",
  bio: "",
  imageUrl: "",
  batting: { ...emptyBatting },
  bowling: { ...emptyBowling },
}

const battingFields: {
  key: keyof BattingStat
  label: string
  type: "number" | "text"
}[] = [
  { key: "matches", label: "Matches", type: "number" },
  { key: "innings", label: "Innings", type: "number" },
  { key: "runs", label: "Runs", type: "number" },
  { key: "highest", label: "Highest", type: "text" },
  { key: "average", label: "Average", type: "number" },
  { key: "strikeRate", label: "Strike Rate", type: "number" },
  { key: "hundreds", label: "100s", type: "number" },
  { key: "fifties", label: "50s", type: "number" },
  { key: "fours", label: "4s", type: "number" },
  { key: "sixes", label: "6s", type: "number" },
  { key: "notOuts", label: "Not Outs", type: "number" },
]

const bowlingFields: {
  key: keyof BowlingStat
  label: string
  type: "number" | "text"
}[] = [
  { key: "matches", label: "Matches", type: "number" },
  { key: "innings", label: "Innings", type: "number" },
  { key: "balls", label: "Balls", type: "number" },
  { key: "runs", label: "Runs", type: "number" },
  { key: "wickets", label: "Wickets", type: "number" },
  { key: "best", label: "Best", type: "text" },
  { key: "economy", label: "Economy", type: "number" },
  { key: "average", label: "Average", type: "number" },
  { key: "strikeRate", label: "Strike Rate", type: "number" },
  { key: "maidens", label: "Maidens", type: "number" },
]

function num(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function AdminPlayersView() {
  const { data, loading, refetch } = usePlayers()
  const teams = useTeams()
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PlayerFormState>(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const teamMap = Object.fromEntries((teams.data ?? []).map((t) => [t.id, t]))
  const filtered = (data ?? []).filter((p) => {
    const q = search.toLowerCase()
    const teamName =
      p.team?.name?.toLowerCase() ??
      teamMap[p.teamId]?.name?.toLowerCase() ??
      ""
    return (
      p.name.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      teamName.includes(q)
    )
  })

  function openCreate() {
    setEditingId(null)
    setForm({
      ...emptyForm,
      batting: { ...emptyBatting },
      bowling: { ...emptyBowling },
      teamId: teams.data?.[0]?.id ?? "",
    })
    setOpen(true)
  }

  function openEdit(p: Player) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      teamId: p.teamId,
      role: p.role,
      battingStyle: p.battingStyle,
      bowlingStyle: p.bowlingStyle,
      bio: p.bio,
      imageUrl: p.imageUrl,
      batting: { ...emptyBatting, ...p.battingStats },
      bowling: p.bowlingStats
        ? { ...emptyBowling, ...p.bowlingStats }
        : { ...emptyBowling },
    })
    setOpen(true)
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (!form.teamId) {
      toast.error("Team is required")
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        teamId: form.teamId,
        role: form.role,
        battingStyle: form.battingStyle,
        bowlingStyle: form.bowlingStyle,
        bio: form.bio,
        imageUrl: form.imageUrl,
        battingStats: form.batting,
        bowlingStats: form.bowling,
      }
      if (editingId) {
        await api.players.update(editingId, payload)
        toast.success("Player updated")
      } else {
        await api.players.create(payload)
        toast.success("Player created")
      }
      setOpen(false)
      refetch()
    } catch (e) {
      toast.error("Failed to save player", { description: String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.players.remove(id)
      toast.success("Player deleted")
      refetch()
    } catch (e) {
      toast.error("Failed to delete", { description: String(e) })
    }
    setDeleteId(null)
  }

  return (
    <AdminShell
      title="Manage Players"
      count={data?.length}
      actionLabel="+ New Player"
      onAction={openCreate}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search players by name, team or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Batting Style
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No players found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const team = p.team ?? teamMap[p.teamId]
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PlayerAvatar
                              name={p.name}
                              team={team}
                              size="sm"
                            />
                            <span className="font-medium">{p.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {team ? (
                            <Badge variant="secondary">
                              {team.shortName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          {p.role}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {p.battingStyle}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(p)}
                            aria-label="Edit player"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteId(p.id)}
                            className="text-destructive"
                            aria-label="Delete player"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Player" : "New Player"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Virat Kohli"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Team</Label>
                <Select
                  value={form.teamId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, teamId: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.data?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="battingStyle">Batting Style</Label>
                <Input
                  id="battingStyle"
                  value={form.battingStyle}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, battingStyle: e.target.value }))
                  }
                  placeholder="Right-hand bat"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bowlingStyle">Bowling Style</Label>
                <Input
                  id="bowlingStyle"
                  value={form.bowlingStyle}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bowlingStyle: e.target.value }))
                  }
                  placeholder="Right-arm fast"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Photo</Label>
              <div className="flex items-center gap-3">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt=""
                    className="h-16 w-16 rounded-full object-cover border"
                  />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-full border bg-muted text-muted-foreground text-xs">
                    No photo
                  </div>
                )}
                <div className="flex-1 space-y-1.5">
                  <Input
                    id="imageUrl"
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, imageUrl: e.target.value }))
                    }
                    placeholder="URL or upload →"
                  />
                  <div className="flex gap-2">
                    <UploadButton
                      label="Upload photo"
                      resize={300}
                      onUploaded={(url) =>
                        setForm((f) => ({ ...f, imageUrl: url }))
                      }
                    />
                    {form.imageUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Uploaded photos are auto-resized to 300×300 (optimal for avatars).
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bio: e.target.value }))
                }
                rows={3}
                placeholder="Player biography"
              />
            </div>

            <Tabs defaultValue="batting" className="rounded-lg border p-2">
              <TabsList className="w-full">
                <TabsTrigger value="batting" className="flex-1">
                  Batting Stats
                </TabsTrigger>
                <TabsTrigger value="bowling" className="flex-1">
                  Bowling Stats
                </TabsTrigger>
              </TabsList>
              <TabsContent value="batting" className="pt-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {battingFields.map((f) => (
                    <div key={f.key} className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">
                        {f.label}
                      </Label>
                      <Input
                        type={f.type}
                        value={String(form.batting[f.key])}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            batting: {
                              ...s.batting,
                              [f.key]:
                                f.type === "number"
                                  ? num(e.target.value)
                                  : e.target.value,
                            },
                          }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="bowling" className="pt-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {bowlingFields.map((f) => (
                    <div key={f.key} className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">
                        {f.label}
                      </Label>
                      <Input
                        type={f.type}
                        value={String(form.bowling[f.key])}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            bowling: {
                              ...s.bowling,
                              [f.key]:
                                f.type === "number"
                                  ? num(e.target.value)
                                  : e.target.value,
                            },
                          }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "Create Player"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this player?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the player record. Their stats will be
              lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  )
}
