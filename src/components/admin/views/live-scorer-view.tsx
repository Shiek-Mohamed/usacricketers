"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useMatch, usePlayers, useMatches } from "@/lib/use-data"
import { api } from "@/lib/api"
import { useLiveScore } from "@/lib/use-live-score"
import {
  initState,
  addBatsman,
  setBatsmen,
  setBowler,
  applyBall,
  stateToScorecard,
  oversString,
  type LiveMatchState,
  type BallEvent,
} from "@/lib/scoring"
import { ScorecardView } from "@/components/cricket/scorecard"
import { AdminShell } from "@/components/admin/admin-shell"
import { ScorerShell } from "@/components/admin/scorer-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  Radio,
  Activity,
  Undo2,
  RotateCcw,
  Save,
  CircleDot,
  Plus,
} from "lucide-react"
import type { Player } from "@/lib/types"

const RUN_BUTTONS = [0, 1, 2, 3, 4, 6] as const

export function LiveScorerView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const mode = useAppStore((s) => s.mode)
  const { data: match, loading } = useMatch(id)
  const { data: t1Players } = usePlayers(match?.team1Id ?? null)
  const { data: t2Players } = usePlayers(match?.team2Id ?? null)
  const { refetch } = useMatches()
  const { liveState, connected, pushState } = useLiveScore(id)

  // Use the minimal ScorerShell (no admin sidebar) in scorer mode, AdminShell otherwise.
  const Shell = mode === "scorer" ? ScorerShell : AdminShell

  // History stack for undo
  const [history, setHistory] = useState<LiveMatchState[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const playersByTeam: Record<string, Player[]> = useMemo(() => {
    const m: Record<string, Player[]> = {}
    if (match) {
      m[match.team1Id] = t1Players ?? []
      m[match.team2Id] = t2Players ?? []
    }
    return m
  }, [match, t1Players, t2Players])

  if (loading) {
    return (
      <Shell title="Live Scorer">
        <Skeleton className="h-72 w-full rounded-xl" />
      </Shell>
    )
  }

  if (!match) {
    return (
      <Shell title="Live Scorer">
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No match selected.{" "}
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => navigate("admin-matches")}
            >
              Choose a match
            </Button>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  const t1 = match.team1
  const t2 = match.team2

  function persist(state: LiveMatchState) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await api.matches.update(match!.id, {
          scorecard: stateToScorecard(state),
          status: state.status,
          result: state.result,
        })
        refetch()
      } catch (e) {
        // silent — live broadcast is the priority; persistence is best-effort
      }
    }, 800)
  }

  function handleBall(event: BallEvent) {
    if (!liveState) return
    setHistory((h) => [...h, liveState].slice(-50))
    const next = applyBall(liveState, event)
    pushState(next)
    persist(next)
  }

  function handleUndo() {
    if (history.length === 0) {
      toast.info("Nothing to undo")
      return
    }
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    pushState(prev)
    persist(prev)
    toast.success("Undid last ball")
  }

  function startInnings(
    battingFirstId: string,
    strikerId: string,
    nonStrikerId: string,
    bowlerId: string
  ) {
    const battingPlayers = playersByTeam[battingFirstId] ?? []
    const bowlingPlayers =
      playersByTeam[battingFirstId === match!.team1Id ? match!.team2Id : match!.team1Id] ?? []
    const striker = battingPlayers.find((p) => p.id === strikerId)
    const nonStriker = battingPlayers.find((p) => p.id === nonStrikerId)
    const bowler = bowlingPlayers.find((p) => p.id === bowlerId)
    if (!striker || !nonStriker || !bowler) {
      toast.error("Select striker, non-striker and bowler")
      return
    }
    let state = initState(match!, battingFirstId)
    state = addBatsman(state, striker.id, striker.name)
    state = addBatsman(state, nonStriker.id, nonStriker.name)
    state = setBatsmen(state, striker.id, nonStriker.id)
    state = setBowler(state, bowler.id, bowler.name)
    setHistory([])
    pushState(state)
    persist(state)
    toast.success("Innings started — status set to LIVE")
  }

  function bringInBatsman(playerId: string) {
    if (!liveState) return
    const battingPlayers = playersByTeam[liveState.innings[liveState.currentInnings].battingTeamId] ?? []
    const p = battingPlayers.find((x) => x.id === playerId)
    if (!p) return
    let state = addBatsman(liveState, p.id, p.name)
    state = { ...state, strikerId: p.id }
    setHistory((h) => [...h, liveState].slice(-50))
    pushState(state)
    persist(state)
    toast.success(`${p.name} in`)
  }

  function pickNextBowler(playerId: string) {
    if (!liveState) return
    const bowlingPlayers = playersByTeam[liveState.innings[liveState.currentInnings].bowlingTeamId] ?? []
    const p = bowlingPlayers.find((x) => x.id === playerId)
    if (!p) return
    setHistory((h) => [...h, liveState].slice(-50))
    const state = setBowler(liveState, p.id, p.name)
    pushState(state)
    persist(state)
    toast.success(`${p.name} to bowl`)
  }

  function reset() {
    setHistory([])
    // clear live cache
    // (clearState not destructured here; use pushState(null) approach via a clear)
    pushState({ ...liveState!, status: "live", result: "" })
  }

  const showSetup = !liveState || liveState.innings.length === 0
  const currentInnings = liveState?.innings[liveState.currentInnings]
  const needBatsman = !!liveState && liveState.strikerId === null && liveState.status === "live"
  const needBowler = !!liveState && liveState.bowlerId === null && liveState.status === "live"
  const isComplete = liveState?.status === "completed"

  return (
    <Shell
      title="Live Scorer"
    >
      {/* Match header */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <FormatBadge format={match.format} />
            <span className="truncate text-sm font-semibold">{match.matchNo}</span>
            <span className="text-xs text-muted-foreground">
              {match.series?.shortName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionPill connected={connected} />
            {liveState && (
              <Badge
                className={cn(
                  "gap-1 uppercase",
                  isComplete ? "bg-emerald-600" : "bg-red-600 animate-pulse"
                )}
              >
                {isComplete ? "Completed" : "Live"}
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("admin-matches")} className="-ml-2 gap-1">
                <ArrowLeft className="h-4 w-4" /> Matches
              </Button>
              <span className="text-xs text-muted-foreground">
                {t1?.shortName} v {t2?.shortName} · {match.venue}
              </span>
            </div>
            {liveState && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleUndo} className="gap-1" disabled={history.length === 0}>
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    persist(liveState)
                    toast.success("Scorecard saved")
                  }}
                  className="gap-1"
                >
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            )}
          </div>

          {showSetup ? (
            <SetupPanel
              t1={t1}
              t2={t2}
              t1Players={t1Players ?? []}
              t2Players={t2Players ?? []}
              onStart={startInnings}
            />
          ) : (
            <div className="mt-4 space-y-5">
              {/* Live scoreboard summary */}
              {currentInnings && (
                <LiveScoreboard state={liveState!} />
              )}

              {/* Action prompts */}
              {needBatsman && (
                <Picker
                  title="New batsman"
                  players={(playersByTeam[currentInnings!.battingTeamId] ?? []).filter(
                    (p) => !currentInnings!.batsmen.some((b) => b.id === p.id)
                  )}
                  placeholder="Select new batsman"
                  onPick={bringInBatsman}
                />
              )}
              {needBowler && (
                <Picker
                  title="Next bowler"
                  players={playersByTeam[currentInnings!.bowlingTeamId] ?? []}
                  placeholder="Select bowler for next over"
                  onPick={pickNextBowler}
                />
              )}

              {/* Ball entry buttons */}
              {!isComplete && !needBatsman && !needBowler && (
                <BallPad onBall={handleBall} disabled={!liveState} />
              )}

              {isComplete && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-4 text-center">
                  <p className="text-sm font-bold text-emerald-800">
                    Match Result
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-emerald-900">
                    {liveState!.result}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1"
                    onClick={() => navigate("match-detail", match.id)}
                  >
                    View public scorecard
                  </Button>
                </div>
              )}

              {/* Commentary */}
              {liveState && liveState.commentary.length > 0 && (
                <CommentaryFeed state={liveState} />
              )}

              {/* Public scorecard preview */}
              {liveState && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-red-600" />
                    <h2 className="text-sm font-extrabold uppercase tracking-tight">
                      Live Scorecard (public view)
                    </h2>
                  </div>
                  <ScorecardView scorecard={stateToScorecard(liveState)} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Shell>
  )
}

/* --------------------------- sub-components --------------------------- */

function FormatBadge({ format }: { format: string }) {
  return (
    <span className="inline-flex items-center rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
      {format}
    </span>
  )
}

function ConnectionPill({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
        connected
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-amber-300 bg-amber-50 text-amber-700"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          connected ? "bg-emerald-600" : "bg-amber-500 animate-pulse"
        )}
      />
      {connected ? "Connected" : "Connecting…"}
    </span>
  )
}

function SetupPanel({
  t1,
  t2,
  t1Players,
  t2Players,
  onStart,
}: {
  t1: Player["team"] | undefined
  t2: Player["team"] | undefined
  t1Players: Player[]
  t2Players: Player[]
  onStart: (battingFirstId: string, strikerId: string, nonStrikerId: string, bowlerId: string) => void
}) {
  const [battingFirstId, setBattingFirstId] = useState(t1?.id ?? "")
  const [strikerId, setStrikerId] = useState("")
  const [nonStrikerId, setNonStrikerId] = useState("")
  const [bowlerId, setBowlerId] = useState("")

  const battingPlayers =
    battingFirstId === t1?.id ? t1Players : battingFirstId === t2?.id ? t2Players : []
  const bowlingPlayers =
    battingFirstId === t1?.id
      ? t2Players
      : battingFirstId === t2?.id
        ? t1Players
        : []

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-bold uppercase tracking-wide">
            Start live innings
          </h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Batting first
            </label>
            <Select
              value={battingFirstId}
              onValueChange={(v) => {
                setBattingFirstId(v)
                setStrikerId("")
                setNonStrikerId("")
                setBowlerId("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {t1 && <SelectItem value={t1.id}>{t1.name}</SelectItem>}
                {t2 && <SelectItem value={t2.id}>{t2.name}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Opening bowler
            </label>
            <Select
              value={bowlerId}
              onValueChange={setBowlerId}
              disabled={!bowlingPlayers.length}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select bowler" />
              </SelectTrigger>
              <SelectContent>
                {bowlingPlayers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Striker
            </label>
            <Select
              value={strikerId}
              onValueChange={setStrikerId}
              disabled={!battingPlayers.length}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select striker" />
              </SelectTrigger>
              <SelectContent>
                {battingPlayers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Non-striker
            </label>
            <Select
              value={nonStrikerId}
              onValueChange={setNonStrikerId}
              disabled={!battingPlayers.length}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select non-striker" />
              </SelectTrigger>
              <SelectContent>
                {battingPlayers
                  .filter((p) => p.id !== strikerId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          className="mt-4 w-full gap-1.5 bg-red-600 text-white hover:bg-red-700"
          disabled={!battingFirstId || !strikerId || !nonStrikerId || !bowlerId || strikerId === nonStrikerId}
          onClick={() => onStart(battingFirstId, strikerId, nonStrikerId, bowlerId)}
        >
          <Activity className="h-4 w-4" /> Start innings (set LIVE)
        </Button>
      </div>
    </div>
  )
}

function LiveScoreboard({ state }: { state: LiveMatchState }) {
  const inn = state.innings[state.currentInnings]
  const striker = inn.batsmen.find((b) => b.id === state.strikerId)
  const nonStriker = inn.batsmen.find((b) => b.id === state.nonStrikerId)
  const bowler = inn.bowlers.find((b) => b.id === state.bowlerId)
  const overs = oversString(inn.balls)
  const runRate = inn.balls > 0 ? (inn.runs / inn.balls * 6).toFixed(2) : "0.00"
  const target = inn.target
  const ballsLeft = state.maxOvers > 0 ? state.maxOvers * 6 - inn.balls : null
  const runsNeeded = target ? target - inn.runs : null
  const reqRate =
    target && ballsLeft && ballsLeft > 0
      ? ((runsNeeded! / ballsLeft) * 6).toFixed(2)
      : null

  return (
    <div className="rounded-lg border bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {inn.battingTeamShortName} · Innings {state.currentInnings + 1}
            {target ? ` · need ${runsNeeded} runs` : ""}
          </div>
          <div className="mt-1 text-4xl font-extrabold tabular-nums">
            {inn.runs}/{inn.wickets}
            <span className="ml-2 text-lg font-normal text-slate-300">
              ({overs} ov)
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-300">
            CRR {runRate}
            {reqRate && ` · RRR ${reqRate}`}
            {ballsLeft !== null && ` · ${ballsLeft} balls left`}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md bg-white/10 p-2.5">
          <div className="text-[10px] uppercase text-slate-300">Striker</div>
          <div className="font-bold">{striker?.name ?? "—"}</div>
          <div className="text-slate-300">
            {striker ? `${striker.runs} (${striker.balls})` : "—"}
          </div>
        </div>
        <div className="rounded-md bg-white/10 p-2.5">
          <div className="text-[10px] uppercase text-slate-300">Non-striker</div>
          <div className="font-bold">{nonStriker?.name ?? "—"}</div>
          <div className="text-slate-300">
            {nonStriker ? `${nonStriker.runs} (${nonStriker.balls})` : "—"}
          </div>
        </div>
        <div className="col-span-2 rounded-md bg-white/10 p-2.5">
          <div className="text-[10px] uppercase text-slate-300">Bowler</div>
          <div className="flex items-center justify-between">
            <span className="font-bold">{bowler?.name ?? "—"}</span>
            <span className="text-slate-300">
              {bowler
                ? `${oversString(bowler.balls)} - ${bowler.maidens} - ${bowler.runsConceded} - ${bowler.wickets}`
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function BallPad({
  onBall,
  disabled,
}: {
  onBall: (e: BallEvent) => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Score this ball
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {RUN_BUTTONS.map((r) => (
          <Button
            key={r}
            variant={r === 4 || r === 6 ? "default" : "outline"}
            className={cn(
              "h-12 text-lg font-extrabold tabular-nums",
              r === 4 && "bg-emerald-600 hover:bg-emerald-700",
              r === 6 && "bg-purple-600 hover:bg-purple-700"
            )}
            disabled={disabled}
            onClick={() => onBall({ kind: "run", runs: r })}
          >
            {r}
          </Button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Button variant="outline" className="h-10 gap-1" disabled={disabled} onClick={() => onBall({ kind: "wide" })}>
          Wide
        </Button>
        <Button variant="outline" className="h-10 gap-1" disabled={disabled} onClick={() => onBall({ kind: "noball" })}>
          No Ball
        </Button>
        <Button
          variant="default"
          className="h-10 gap-1 bg-red-600 hover:bg-red-700"
          disabled={disabled}
          onClick={() =>
            onBall({
              kind: "wicket",
              dismissal: "b (bowler)",
            })
          }
        >
          Wicket
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Tap a run number, an extra, or Wicket. Strike, overs and the scorecard update automatically.
      </p>
    </div>
  )
}

function Picker({
  title,
  players,
  placeholder,
  onPick,
}: {
  title: string
  players: { id: string; name: string }[]
  placeholder: string
  onPick: (id: string) => void
}) {
  const [val, setVal] = useState("")
  return (
    <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-amber-800">
        <Plus className="h-4 w-4" />
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      </div>
      <Select value={val} onValueChange={(v) => { setVal(v); onPick(v); }}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {players.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function CommentaryFeed({ state }: { state: LiveMatchState }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <CircleDot className="h-3.5 w-3.5 text-red-600" />
        <h3 className="text-[11px] font-extrabold uppercase tracking-wide">
          Live Commentary
        </h3>
      </div>
      <div className="max-h-64 space-y-1.5 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        {state.commentary.map((c) => (
          <div key={c.id} className="flex gap-2 text-xs">
            <span className="w-10 shrink-0 font-mono tabular-nums text-muted-foreground">
              {c.over}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1",
                c.kind === "wicket" && "font-bold text-red-700",
                c.kind === "six" && "font-bold text-purple-700",
                c.kind === "boundary" && "font-bold text-emerald-700",
                c.kind === "over" && "font-semibold text-foreground",
                c.kind === "info" && "italic text-muted-foreground"
              )}
            >
              {c.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
