"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAppStore } from "@/lib/store"
import { useScorerSession } from "@/lib/scorer-session"
import { useMatch, usePlayers, useMatches } from "@/lib/use-data"
import { api } from "@/lib/api"
import { useLiveScore } from "@/lib/use-live-score"
import {
  initState,
  addBatsman,
  addSquadMember,
  setBatsmen,
  setBowler,
  applyBall,
  stateToScorecard,
  oversString,
  declareInnings,
  enforceFollowOn,
  startSuperOver,
  BOWLER_CREDITED_WICKETS,
  type LiveMatchState,
  type BallEvent,
  type WicketType,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
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
  ArrowLeftRight,
  Flag,
  Repeat,
  Zap,
  Send,
  Mic,
  Loader2,
  CloudRain,
  Check,
} from "lucide-react"
import type { Player } from "@/lib/types"
import { useLiveScoreBackup } from "@/lib/use-live-score-backup"
import { calculateDLS, type DLSResult } from "@/lib/dls"

const RUN_BUTTONS = [0, 1, 2, 3, 4, 6] as const

export function LiveScorerView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const mode = useAppStore((s) => s.mode)
  const { data: match, loading } = useMatch(id)
  const { data: t1Players } = usePlayers(match?.team1Id ?? null)
  const { data: t2Players } = usePlayers(match?.team2Id ?? null)
  const { refetch } = useMatches()
  const scorerToken = useScorerSession((s) => s.session?.token ?? null)

  // Site admins don't have a scorer session — they only have the sa-session
  // httpOnly cookie the score-service can't read. Fall back to fetching a
  // god-mode scorer token (POST /api/admin/scorer-token), which the
  // score-service accepts as `tournamentIds: ["*"]` god-mode.
  //
  // NOTE: We don't gate on `mode === "admin"` because navigating directly to
  // ?view=live-scorer&id=... bypasses the admin-login flow that sets the mode.
  // Instead, we try fetching the scorer token unconditionally (if scorerToken
  // isn't already set). If the admin cookie isn't there, the API returns 401
  // and adminToken stays null — the shell shows "Not authenticated".
  const [adminToken, setAdminToken] = useState<string | null>(null)
  useEffect(() => {
    if (scorerToken) return // already have a real scorer session — prefer it
    let cancelled = false
    fetch("/api/admin/scorer-token", {
      method: "POST",
      credentials: "include",
      headers: {
        "X-CSRF-Token": typeof document !== "undefined" ? document.cookie.match(/csrf-token=([^;]+)/)?.[1] || "" : ""
      }
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return
        if (body?.token) setAdminToken(body.token)
      })
      .catch(() => {
        // 401 means the admin cookie expired or isn't there — the shell
        // below will show the "Not authenticated" gate instead.
      })
    return () => {
      cancelled = true
    }
  }, [scorerToken])

  const token = scorerToken ?? adminToken
  const { liveState, connected, stateReceived, pushState } = useLiveScore(id, token)

  // localStorage backup — MUST be called before any early returns so
  // React's rules-of-hooks are satisfied. Saves the live state to
  // localStorage on every change + auto-restores it if the score-service
  // restarts (deploys wipe its in-memory cache).
  useLiveScoreBackup(id, token, liveState, stateReceived, pushState)

  // Use the minimal ScorerShell (no admin sidebar) in scorer mode, AdminShell otherwise.
  const Shell = mode === "scorer" ? ScorerShell : AdminShell

  // History stack for undo
  const [history, setHistory] = useState<LiveMatchState[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Wicket-dialog open state — the Wicket button opens a modal that lets the
  // admin pick dismissal type + fielder(s) involved, then sends the structured
  // wicket BallEvent to applyBall via handleBall.
  const [wicketOpen, setWicketOpen] = useState(false)
  // Free-text commentary input — the scorer types a note ("DRS review taken",
  // "Rain stops play", etc.) and presses Enter / clicks Send. The entry is
  // added to liveState.commentary with kind="manual" and broadcast via the
  // socket so the public match-detail Live tab shows it instantly (rendered
  // with a blue accent + "Commentator" label so it's distinguishable from
  // the auto-generated ball-by-ball feed).
  const [commentaryText, setCommentaryText] = useState("")

  // DLS calculator state — shown when rain interrupts a limited-overs match
  const [dlsOpen, setDlsOpen] = useState(false)
  const [dlsRevisedOvers, setDlsRevisedOvers] = useState("")
  const [dlsResult, setDlsResult] = useState<DLSResult | null>(null)

  /** Calculate DLS target from the current match state (auto-filled). */
  function handleDLSCalculate() {
    if (!liveState || liveState.innings.length < 2) return
    const t1 = liveState.innings[0]
    const t2 = liveState.innings[liveState.currentInnings]
    if (!t1 || !t2) return
    const revised = Number(dlsRevisedOvers)
    if (!revised || revised <= 0) {
      toast.error("Enter the revised overs for Team 2")
      return
    }
    const result = calculateDLS(
      t1.runs,
      Math.floor(t1.balls / 6), // balls → overs
      t1.wickets,
      t2.runs,
      Math.floor(t2.balls / 6),
      t2.wickets,
      liveState.maxOvers,
      revised,
    )
    setDlsResult(result)
  }

  /** Apply the DLS target to the match state — pushes it via WebSocket so
   *  viewers see the revised target on the live scorecard. */
  function handleDLSApply() {
    if (!liveState || !dlsResult) return
    const next = {
      ...liveState,
      dlsTarget: dlsResult.revisedTarget,
      dlsRevisedOvers: Number(dlsRevisedOvers),
    }
    pushState(next)
    persist(next)
    // Add a commentary entry about the DLS revision
    const entry = {
      id: Math.random().toString(36).slice(2),
      ballNo: liveState.ballNo,
      over: oversString(liveState.innings[liveState.currentInnings]?.balls ?? 0),
      text: `🌧️ DLS: Revised target is ${dlsResult.revisedTarget} from ${dlsRevisedOvers} overs (was ${dlsResult.originalTarget} from ${liveState.maxOvers})`,
      kind: "info" as const,
    }
    const withCommentary = {
      ...next,
      commentary: [entry, ...next.commentary].slice(0, 120),
    }
    pushState(withCommentary)
    persist(withCommentary)
    toast.success(`DLS target applied: ${dlsResult.revisedTarget} from ${dlsRevisedOvers} overs`)
    setDlsOpen(false)
    setDlsResult(null)
    setDlsRevisedOvers("")
  }

  /* ------------------ Voice clip (🎙 mic) recording ------------------
   * The scorer clicks "Record voice clip", the browser captures audio from
   * `getUserMedia`, MediaRecorder collects chunks, and on stop the blob is
   * POSTed to /api/voice-clip. The returned URL is inserted into the
   * commentary feed as `[audio:/api/uploads/voice-xxx.webm]` — both the
   * live-scorer feed and the public match-detail feed detect this prefix
   * and render an inline <audio> player instead of the raw text.
   *
   * Refs hold the MediaRecorder + stream + chunk list (no re-render needed
   * while recording). `isRecording` / `isUploading` are state so the button
   * reflects what's happening. */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  /** Begin a voice clip recording. Requests microphone permission — the
   *  browser shows a permission prompt the first time, then remembers the
   *  decision for subsequent recordings on this origin. */
  async function startRecording() {
    if (!liveState || !id) return
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording is not supported in this browser")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      // Pick the most likely mime type the browser supports — Chrome/Firefox
      // emit audio/webm, Safari emits audio/mp4. We pass this through to the
      // upload so the API saves the file with the correct extension.
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : ""
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        // Tear down the mic stream first so the browser's red dot disappears.
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        const chunks = chunksRef.current
        chunksRef.current = []
        if (chunks.length === 0) return
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        })
        // Upload the blob.
        setIsUploading(true)
        try {
          const formData = new FormData()
          const ext = (recorder.mimeType || "").includes("mp4")
            ? "mp4"
            : (recorder.mimeType || "").includes("ogg")
              ? "ogg"
              : "webm"
          formData.append("audio", blob, `voice-${Date.now()}.${ext}`)
          const headers: Record<string, string> = {}
          // Always send the bearer scorer token if we have one (real scorer
          // session OR the god-mode token minted for site admins). The API
          // also accepts site-admin cookie auth as a fallback.
          if (token) headers["Authorization"] = `Bearer ${token}`
          // CSRF double-submit for the cookie-auth path (site admin).
          if (typeof document !== "undefined") {
            const csrf = document.cookie.match(/csrf-token=([^;]+)/)?.[1] || ""
            if (csrf) headers["X-CSRF-Token"] = csrf
          }
          const res = await fetch(
            `/api/voice-clip?matchId=${encodeURIComponent(id)}`,
            {
              method: "POST",
              headers,
              credentials: "include",
              body: formData,
            }
          )
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "upload failed" }))
            toast.error(`Voice clip upload failed: ${err.error || res.statusText}`)
            return
          }
          const body = (await res.json()) as { url?: string; id?: string }
          if (body?.url) {
            // Insert as a commentary entry — the feed renders an audio
            // player when the text starts with `[audio:`.
            addCommentary(`[audio:${body.url}]`)
            toast.success("Voice clip added to commentary")
          }
        } catch (e) {
          toast.error(`Voice clip upload failed: ${String(e).slice(0, 100)}`)
        } finally {
          setIsUploading(false)
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (e) {
      // Most common: user denied the mic permission, or no mic attached.
      toast.error(
        `Microphone unavailable: ${String(e).slice(0, 120)}. Allow microphone access in your browser and try again.`
      )
      setIsRecording(false)
    }
  }

  /** Stop the active recording (triggers `onstop` → upload → commentary). */
  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === "inactive") {
      // Already stopped — just make sure the stream is released.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      mediaRecorderRef.current = null
      setIsRecording(false)
      return
    }
    recorder.stop() // fires onstop → uploads + inserts commentary entry
    setIsRecording(false)
  }

  /* ------------------ Keyboard shortcuts (power-user scorers) ------------------
   * 0,1,2,3,4,6 → score N runs | . / - → dot | w → wicket dialog |
   * e → swap ends | u → undo | d → declare (Test) | s → save.
   * No deps array → re-subscribes on every render with the latest closures.
   * The function declarations (handleBall, swapEnds, etc.) are hoisted by
   * JS so they're in scope at call-time even though defined later in the
   * component body. The lint rule below is overly cautious about this
   * pattern — it's safe because the effect re-runs every render. */
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    function isTyping(el: Element | null): boolean {
      if (!el) return false
      const tag = el.tagName?.toLowerCase()
      return tag === "input" || tag === "textarea" || tag === "select" ||
        el.getAttribute("role") === "combobox" ||
        (el as HTMLElement)?.isContentEditable === true
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(document.activeElement)) return
      if (wicketOpen) return
      if (!liveState || liveState.status !== "live") return
      if (!liveState.strikerId || !liveState.nonStrikerId || !liveState.bowlerId) return
      const k = e.key.toLowerCase()
      if (["0", "1", "2", "3", "4", "6"].includes(k)) {
        e.preventDefault()
        handleBall({ kind: "run", runs: Number(k) })
      } else if (k === "." || k === "-") {
        e.preventDefault()
        handleBall({ kind: "run", runs: 0 })
      } else if (k === "w") {
        e.preventDefault()
        setWicketOpen(true)
      } else if (k === "e") {
        e.preventDefault()
        swapEnds()
      } else if (k === "u") {
        e.preventDefault()
        handleUndo()
      } else if (k === "d") {
        e.preventDefault()
        handleDeclare()
      } else if (k === "s") {
        e.preventDefault()
        if (liveState) {
          persist(liveState)
          toast.success("Scorecard saved")
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })
  /* eslint-enable react-hooks/immutability */

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
        // Surface persistence errors so the operator knows the DB write failed
        // (was previously silent — caused confusion when "Innings started"
        // toast showed but the match status didn't actually update).
        // The live socket broadcast is still the priority — this toast
        // doesn't block scoring, just informs the operator something's wrong.
        const msg = e instanceof Error ? e.message : String(e).slice(0, 200)
        toast.error("Persist failed — match state not saved", {
          description: msg,
        })
      }
    }, 800)
  }

  /** Add a manual / commentator note to the live commentary feed.
   *  Pushes the updated state through the socket (so subscribers like the
   *  public match-detail view see it instantly) and schedules a DB persist.
   *  Manual entries get kind="manual" + a blue accent in the feed so they're
   *  visually distinct from the auto-generated ball-by-ball commentary. */
  function addCommentary(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !liveState) return
    const inn = liveState.innings[liveState.currentInnings]
    const overLabel = inn ? oversString(inn.balls) : "0.0"
    const entry = {
      id: Math.random().toString(36).slice(2),
      ballNo: liveState.ballNo,
      over: overLabel,
      text: trimmed,
      kind: "manual" as const,
    }
    const next: LiveMatchState = {
      ...liveState,
      // Newest-first (matches the engine's pushCommentary pattern).
      commentary: [entry, ...liveState.commentary].slice(0, 120),
    }
    setHistory((h) => [...h, liveState].slice(-50))
    pushState(next)
    persist(next)
    setCommentaryText("")
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
    toast.success("Undid last action")
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
    // Pre-populate the squad with the full batting-team roster so the
    // "Did not bat" section of the public scorecard lists bench players.
    // Captain/keeper tags come from the explicit Player model fields
    // (was previously a brittle regex on the role string).
    for (const p of battingPlayers) {
      state = addSquadMember(state, p.id, p.name, {
        isCaptain: !!p.isCaptain,
        isKeeper: !!p.isKeeper,
      })
    }
    state = addBatsman(state, striker.id, striker.name, {
      isCaptain: !!striker.isCaptain,
      isKeeper: !!striker.isKeeper,
    })
    state = addBatsman(state, nonStriker.id, nonStriker.name, {
      isCaptain: !!nonStriker.isCaptain,
      isKeeper: !!nonStriker.isKeeper,
    })
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
    let state = addBatsman(liveState, p.id, p.name, {
      isCaptain: !!p.isCaptain,
      isKeeper: !!p.isKeeper,
    })
    // Fill whichever slot is currently empty — the striker's end if a normal
    // wicket fell (strikerId === null), or the non-striker's end if a run-out
    // happened at the non-striker's end (nonStrikerId === null). If both are
    // empty (innings restart, edge case), default to striker.
    const fillStriker = liveState.strikerId === null
    const fillNonStriker = !fillStriker && liveState.nonStrikerId === null
    state = {
      ...state,
      strikerId: fillStriker ? p.id : state.strikerId,
      nonStrikerId: fillNonStriker ? p.id : state.nonStrikerId,
    }
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

  /** "I picked the wrong striker — let me re-pick." Pushes the current state
   *  to the history stack (so Undo can recover it), then clears the strikerId
   *  slot. The Picker re-shows automatically because `needStriker` becomes
   *  true when strikerId === null. */
  function changeStriker() {
    if (!liveState || !liveState.strikerId) return
    setHistory((h) => [...h, liveState].slice(-50))
    const next = { ...liveState, strikerId: null as string | null }
    pushState(next)
    persist(next)
    toast.info("Re-pick the striker")
  }

  /** Same as changeStriker but for the non-striker slot. */
  function changeNonStriker() {
    if (!liveState || !liveState.nonStrikerId) return
    setHistory((h) => [...h, liveState].slice(-50))
    const next = { ...liveState, nonStrikerId: null as string | null }
    pushState(next)
    persist(next)
    toast.info("Re-pick the non-striker")
  }

  /** Same as changeStriker but for the bowler slot. */
  function changeBowler() {
    if (!liveState || !liveState.bowlerId) return
    setHistory((h) => [...h, liveState].slice(-50))
    const next = { ...liveState, bowlerId: null as string | null }
    pushState(next)
    persist(next)
    toast.info("Re-pick the bowler")
  }

  /** Swap the striker and non-striker ends. Used when the auto strike-rotation
   *  logic disagrees with reality (e.g. batsmen crossed on a caught-and-
   *  bowled, odd run on a wide, runner substituted, etc.). Allowed at any
   *  time — doesn't affect stats, just relabels who's on strike. */
  function swapEnds() {
    if (!liveState) return
    if (!liveState.strikerId || !liveState.nonStrikerId) {
      toast.error("Need both batsmen at the crease to swap ends")
      return
    }
    setHistory((h) => [...h, liveState].slice(-50))
    const next = {
      ...liveState,
      strikerId: liveState.nonStrikerId,
      nonStrikerId: liveState.strikerId,
    }
    pushState(next)
    persist(next)
    toast.success("Ends swapped")
  }

  function reset() {
    setHistory([])
    // clear live cache
    // (clearState not destructured here; use pushState(null) approach via a clear)
    pushState({ ...liveState!, status: "live", result: "" })
  }

  /** Test-match declaration: captain ends the current innings without being
   *  all out. No-op for limited-overs matches (those don't have declarations).
   *  Pushes the prev state to history (so Undo can recover) then runs the
   *  engine's declareInnings which marks `declared: true` + sets up the
   *  next innings / computes the result. */
  function handleDeclare() {
    if (!liveState) return
    if (liveState.maxOvers > 0) {
      toast.error("Declarations are only available in Test matches")
      return
    }
    if (liveState.status !== "live") {
      toast.error("Can't declare — innings already ended")
      return
    }
    setHistory((h) => [...h, liveState].slice(-50))
    const next = declareInnings(liveState)
    pushState(next)
    persist(next)
    toast.success("Innings declared")
  }

  /** Enforce the follow-on in a Test match. Only valid when Team A leads by
   *  200+ runs after Team B's 1st innings. Team B bats again immediately. */
  function handleFollowOn() {
    if (!liveState) return
    setHistory((h) => [...h, liveState].slice(-50))
    const next = enforceFollowOn(liveState)
    if (next === liveState) {
      toast.error("Follow-on requires a 200+ run lead in a Test after innings 1")
      return
    }
    pushState(next)
    persist(next)
    toast.success("Follow-on enforced")
  }

  /** Start a super-over after a tied limited-overs match. Creates 2 new
   *  1-over innings (one per team). */
  function handleSuperOver() {
    if (!liveState) return
    setHistory((h) => [...h, liveState].slice(-50))
    const next = startSuperOver(liveState)
    if (next === liveState) {
      toast.error("Super-over only available for tied limited-overs matches")
      return
    }
    pushState(next)
    persist(next)
    toast.success("Super Over started")
  }

  // Don't show the setup screen while reconnecting — the cached live state
  // arrives moments after the WebSocket connects. Without this guard, the
  // scorer sees a flash of the setup screen every time they navigate away
  // (e.g. to view the scorecard) and come back, because liveState is null
  // during the brief window between mount + the first `state` event.
  // Only show setup when we've actually received a state snapshot from the
  // server AND it's null/empty (the match genuinely hasn't started).
  const waitingForState = !stateReceived
  const showSetup = stateReceived && (!liveState || liveState.innings.length === 0)
  const currentInnings = liveState?.innings[liveState.currentInnings]
  // Need a new batsman if either end is empty after a wicket (a run-out can
  // empty the non-striker slot while the striker stays in).
  const needStriker = !!liveState && liveState.strikerId === null && liveState.status === "live"
  const needNonStriker =
    !!liveState &&
    liveState.nonStrikerId === null &&
    liveState.status === "live" &&
    !!currentInnings &&
    currentInnings.batsmen.length > 0 // not the very first pickup of an innings
  const needBatsman = needStriker || needNonStriker
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
                {/* Test-only: captain can declare the current innings closed
                    without being all out. Hidden for limited-overs matches. */}
                {liveState.maxOvers === 0 && liveState.status === "live" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeclare}
                    className="gap-1 border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                    title="Declare innings — Test matches only"
                  >
                    <Flag className="h-3.5 w-3.5" /> Declare
                  </Button>
                )}
                {/* Follow-on: Test only, after innings 1 (innings.length === 2),
                    when Team A leads by 200+. */}
                {liveState.maxOvers === 0 &&
                  liveState.innings.length === 2 &&
                  liveState.status === "live" &&
                  liveState.innings[0].runs - liveState.innings[1].runs >= 200 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFollowOn}
                      className="gap-1 border-blue-400 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
                      title="Enforce follow-on — Team B bats again (200+ run lead)"
                    >
                      <Repeat className="h-3.5 w-3.5" /> Follow-on
                    </Button>
                  )}
                {/* Super-over: limited-overs, match tied + completed. */}
                {liveState.maxOvers > 0 &&
                  liveState.status === "completed" &&
                  liveState.result === "Match tied" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSuperOver}
                      className="gap-1 border-purple-500 text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40"
                      title="Play a super-over tiebreaker (1 over per team)"
                    >
                      <Zap className="h-3.5 w-3.5" /> Super Over
                    </Button>
                  )}
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
                {/* DLS Calculator — shown for limited-overs matches when
                    Team 2 is batting (innings 2+). Auto-fills from the
                    current match state. */}
                {liveState.maxOvers > 0 &&
                  liveState.currentInnings >= 1 &&
                  liveState.status === "live" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setDlsOpen(true); setDlsResult(null); setDlsRevisedOvers("") }}
                      className="gap-1 border-sky-400 text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/40"
                      title="DLS Calculator — recalculate target after rain"
                    >
                      <CloudRain className="h-3.5 w-3.5" /> DLS
                    </Button>
                  )}
              </div>
            )}
          </div>

          {waitingForState ? (
            /* Reconnecting loading state — shown while the WebSocket is
               connecting + we haven't received the first state snapshot.
               Prevents the setup screen from flashing when the scorer
               navigates away + comes back. */
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                {connected
                  ? "Loading live scoring state…"
                  : "Reconnecting to live scoring…"}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground/70">
                If this takes more than a few seconds, the scoring session may
                have ended. Refresh the page to start a new session.
              </p>
            </div>
          ) : showSetup ? (
            <SetupPanel
              t1={t1}
              t2={t2}
              t1Players={t1Players ?? []}
              t2Players={t2Players ?? []}
              onStart={startInnings}
              tokenReady={!!token}
              connected={connected}
            />
          ) : (
            <div className="mt-4 space-y-5">
              {/* Live scoreboard summary */}
              {currentInnings && (
                <LiveScoreboard
                  state={liveState!}
                  onChangeStriker={changeStriker}
                  onChangeNonStriker={changeNonStriker}
                  onChangeBowler={changeBowler}
                  onSwapEnds={swapEnds}
                />
              )}

              {/* Action prompts */}
              {needBatsman && (
                <Picker
                  title={needStriker ? "New batsman (striker's end)" : "New batsman (non-striker's end)"}
                  players={(playersByTeam[currentInnings!.battingTeamId] ?? []).filter(
                    (p) => !currentInnings!.batsmen.some((b) => b.id === p.id)
                  )}
                  placeholder="Select new batsman"
                  confirmLabel="Add batsman"
                  onPick={bringInBatsman}
                />
              )}
              {needBowler && (
                <Picker
                  title="Next bowler"
                  players={playersByTeam[currentInnings!.bowlingTeamId] ?? []}
                  placeholder="Select bowler for next over"
                  confirmLabel="Set bowler"
                  onPick={pickNextBowler}
                />
              )}

              {/* Ball entry buttons */}
              {!isComplete && !needBatsman && !needBowler && (
                <BallPad onBall={handleBall} disabled={!liveState} onWicket={() => setWicketOpen(true)} />
              )}

              {/* Human / manual commentary input — only shown when there's an
                  active live innings (the setup phase has no live commentary
                  feed to attach the note to). Enter or the Send button
                  submits; Esc or empty input is a no-op. */}
              {!isComplete && !showSetup && liveState && (
                <CommentaryInput
                  value={commentaryText}
                  onChange={setCommentaryText}
                  onSubmit={() => addCommentary(commentaryText)}
                  disabled={!liveState}
                />
              )}

              {/* Voice clip (🎙) recorder — captures mic audio via the
                  MediaRecorder API, uploads it to /api/voice-clip, and
                  inserts a `[audio:URL]` entry into the commentary feed.
                  The public match-detail Live tab renders an inline audio
                  player for those entries. */}
              {!isComplete && !showSetup && liveState && (
                <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white">
                      <Mic className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Record Voice Clip
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={isRecording ? "destructive" : "default"}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isUploading || !liveState}
                      className="gap-2 bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      {isRecording ? (
                        <>
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                          Stop Recording
                        </>
                      ) : isUploading ? (
                        <>
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                          Uploading Clip…
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4" />
                          Start Recording
                        </>
                      )}
                    </Button>
                    {isRecording && (
                      <span className="flex items-center gap-1 text-sm font-bold text-red-600">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        Recording live…
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-600/70 dark:text-emerald-400/70">
                    Click to record your voice → broadcasts to all viewers as a
                    playable audio clip. Browser will ask for mic permission
                    the first time.
                    play inline on the public match detail Live tab.
                  </p>
                </div>
              )}

              {/* Wicket dialog — dismissal type + fielder picker */}
              {wicketOpen && liveState && currentInnings && (
                <WicketDialog
                  open={wicketOpen}
                  onOpenChange={setWicketOpen}
                  striker={{
                    id: liveState.strikerId!,
                    name: currentInnings.batsmen.find((b) => b.id === liveState.strikerId)?.name ?? "Striker",
                  }}
                  nonStriker={{
                    id: liveState.nonStrikerId!,
                    name: currentInnings.batsmen.find((b) => b.id === liveState.nonStrikerId)?.name ?? "Non-striker",
                  }}
                  bowler={{
                    id: liveState.bowlerId!,
                    name: currentInnings.bowlers.find((b) => b.id === liveState.bowlerId)?.name ?? "Bowler",
                  }}
                  fieldingPlayers={playersByTeam[currentInnings.bowlingTeamId] ?? []}
                  freeHit={currentInnings.freeHit}
                  onConfirm={(ev) => {
                    handleBall(ev)
                    setWicketOpen(false)
                  }}
                />
              )}

              {/* DLS Calculator panel — auto-fills from current match state */}
              {dlsOpen && liveState && liveState.innings.length >= 2 && (
                <div className="rounded-lg border-2 border-sky-400 bg-sky-50/50 p-4 dark:bg-sky-950/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CloudRain className="h-5 w-5 text-sky-500" />
                      <h3 className="font-display text-sm font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                        DLS Calculator
                      </h3>
                    </div>
                    <button onClick={() => setDlsOpen(false)} className="text-muted-foreground hover:text-foreground">
                      ✕
                    </button>
                  </div>

                  {/* Auto-filled match state */}
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-white p-2 dark:bg-card">
                      <div className="font-display text-xs font-bold uppercase text-muted-foreground">Team 1</div>
                      <div className="font-display text-base font-black">
                        {liveState.innings[0].runs}/{liveState.innings[0].wickets}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ({oversString(liveState.innings[0].balls)} ov · {liveState.maxOvers} allocated)
                      </div>
                    </div>
                    <div className="rounded-md bg-white p-2 dark:bg-card">
                      <div className="font-display text-xs font-bold uppercase text-muted-foreground">Team 2 (current)</div>
                      <div className="font-display text-base font-black">
                        {liveState.innings[liveState.currentInnings]?.runs ?? 0}/
                        {liveState.innings[liveState.currentInnings]?.wickets ?? 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ({oversString(liveState.innings[liveState.currentInnings]?.balls ?? 0)} ov faced)
                      </div>
                    </div>
                  </div>

                  {/* Revised overs input */}
                  <div className="mt-3">
                    <label className="mb-1 block font-display text-xs font-bold uppercase text-sky-700 dark:text-sky-300">
                      Revised overs for Team 2 (after rain)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={dlsRevisedOvers}
                        onChange={(e) => setDlsRevisedOvers(e.target.value)}
                        placeholder={String(liveState.maxOvers)}
                        className="h-9 flex-1 rounded-md border border-sky-300 bg-white px-3 text-sm tabular-nums dark:bg-card dark:border-sky-700"
                      />
                      <Button
                        size="sm"
                        onClick={handleDLSCalculate}
                        className="bg-sky-600 text-white hover:bg-sky-700"
                      >
                        Calculate
                      </Button>
                    </div>
                  </div>

                  {/* DLS result */}
                  {dlsResult && (
                    <div className="mt-3 rounded-md bg-[#1e2a5e] p-3 text-center text-white">
                      <p className="font-display text-xs uppercase tracking-wide text-white/60">Revised Target</p>
                      <p className="font-display text-3xl font-black">{dlsResult.revisedTarget}</p>
                      <p className="text-xs text-white/60">
                        from {dlsRevisedOvers} overs · was {dlsResult.originalTarget}
                      </p>
                      <div className="mt-2 flex justify-center gap-4 text-xs">
                        <span>T1: {dlsResult.team1Resources}%</span>
                        <span>T2: {dlsResult.team2Resources}%</span>
                        <span>RRR: {dlsResult.requiredRunRate.toFixed(1)}</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleDLSApply}
                        className="mt-3 gap-2 bg-amber-500 text-white hover:bg-amber-600"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Apply Target to Match
                      </Button>
                    </div>
                  )}

                  {/* Show current DLS target if already applied */}
                  {liveState.dlsTarget && !dlsResult && (
                    <div className="mt-3 rounded-md bg-amber-50 p-2 text-center text-sm dark:bg-amber-950/30">
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        Current DLS target: {liveState.dlsTarget} from {liveState.dlsRevisedOvers} overs
                      </span>
                    </div>
                  )}
                </div>
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
  tokenReady,
  connected,
}: {
  t1: Player["team"] | undefined
  t2: Player["team"] | undefined
  t1Players: Player[]
  t2Players: Player[]
  onStart: (battingFirstId: string, strikerId: string, nonStrikerId: string, bowlerId: string) => void
  tokenReady: boolean
  connected: boolean
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
          disabled={!battingFirstId || !strikerId || !nonStrikerId || !bowlerId || strikerId === nonStrikerId || !connected || !tokenReady}
          onClick={() => {
            if (!tokenReady) {
              toast.error("Scorer token still loading — please wait a moment and try again.")
              return
            }
            onStart(battingFirstId, strikerId, nonStrikerId, bowlerId)
          }}
        >
          <Activity className="h-4 w-4" /> {!tokenReady ? "Loading scorer token…" : !connected ? "Connecting…" : "Start innings (set LIVE)"}
        </Button>
      </div>
    </div>
  )
}

function LiveScoreboard({
  state,
  onChangeStriker,
  onChangeNonStriker,
  onChangeBowler,
  onSwapEnds,
}: {
  state: LiveMatchState
  onChangeStriker?: () => void
  onChangeNonStriker?: () => void
  onChangeBowler?: () => void
  /** Swap striker ↔ non-striker — override the auto strike-rotation logic
   *  when it disagrees with reality (caught-and-bowled crossing, etc.).
   *  Allowed at any time (not over-boundary-gated) — doesn't affect stats. */
  onSwapEnds?: () => void
}) {
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

  // A slot can be safely "Changed" only at over-boundaries — mid-over swaps
  // would mess up the bowler's figures + the batsman's balls-faced count.
  // Disable the Change button once any ball of the current over has been
  // bowled (i.e. balls % 6 !== 0). The exception is the bowler slot after a
  // wicket (still mid-over) — the bowler can be subbed off due to injury in
  // real cricket, but for our MVP we keep the rule simple: only at over
  // boundaries. Undo is still available mid-over for fixing mistakes.
  const atOverBoundary = inn.balls % 6 === 0
  const canChangeBatsmen = atOverBoundary && state.status === "live"
  const canChangeBowler = atOverBoundary && state.status === "live"

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
            {inn.freeHit && (
              <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-amber-950 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-950" />
                Free hit
              </span>
            )}
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
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase text-slate-300">Striker</div>
            {striker && onChangeStriker && (
              <ChangeButton
                onClick={onChangeStriker}
                disabled={!canChangeBatsmen}
                hint={
                  canChangeBatsmen
                    ? "Re-pick striker"
                    : "Wait for end of over (or use Undo)"
                }
              />
            )}
          </div>
          <div className="font-bold">{striker?.name ?? "—"}</div>
          <div className="text-slate-300">
            {striker ? `${striker.runs} (${striker.balls})` : "—"}
          </div>
        </div>
        <div className="relative rounded-md bg-white/10 p-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase text-slate-300">Non-striker</div>
            {nonStriker && onChangeNonStriker && (
              <ChangeButton
                onClick={onChangeNonStriker}
                disabled={!canChangeBatsmen}
                hint={
                  canChangeBatsmen
                    ? "Re-pick non-striker"
                    : "Wait for end of over (or use Undo)"
                }
              />
            )}
          </div>
          <div className="font-bold">{nonStriker?.name ?? "—"}</div>
          <div className="text-slate-300">
            {nonStriker ? `${nonStriker.runs} (${nonStriker.balls})` : "—"}
          </div>
          {/* Swap-ends button — pinned to the inner edge between the two
              batsman cells. Visible only when both batsmen are at the crease.
              Always enabled (not over-boundary-gated) because swapping ends
              doesn't affect any stats — it's just a relabel. */}
          {striker && nonStriker && onSwapEnds && (
            <button
              type="button"
              onClick={onSwapEnds}
              title="Swap striker ↔ non-striker (override the auto strike-rotation)"
              aria-label="Swap striker and non-striker ends"
              className="absolute -left-[14px] top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-slate-700 text-white shadow-md transition-colors hover:bg-slate-600"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="col-span-2 rounded-md bg-white/10 p-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase text-slate-300">Bowler</div>
            {bowler && onChangeBowler && (
              <ChangeButton
                onClick={onChangeBowler}
                disabled={!canChangeBowler}
                hint={
                  canChangeBowler
                    ? "Re-pick bowler"
                    : "Wait for end of over (or use Undo)"
                }
              />
            )}
          </div>
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

/** Tiny "Change" pill button rendered inline in the LiveScoreboard next to
 *  each player's name. Click it to clear that slot → the picker re-shows →
 *  the admin picks the correct person. Disabled mid-over (use Undo instead). */
function ChangeButton({
  onClick,
  disabled,
  hint,
}: {
  onClick: () => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      aria-label={hint ?? "Change selection"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
        disabled
          ? "cursor-not-allowed bg-white/5 text-slate-500"
          : "bg-white/15 text-amber-300 hover:bg-amber-500/30 hover:text-amber-100"
      )}
    >
      <RotateCcw className="h-2.5 w-2.5" />
      Change
    </button>
  )
}

function BallPad({
  onBall,
  onWicket,
  disabled,
}: {
  onBall: (e: BallEvent) => void
  onWicket: () => void
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
          onClick={onWicket}
        >
          Wicket
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Tap a run number, an extra, or Wicket. The Wicket button opens a
        dialog to pick dismissal type + fielder(s) involved.
        <br />
        <span className="mt-1 inline-block">
          Keyboard shortcuts:{" "}
          <code className="rounded bg-muted px-1 py-0.5">0–6</code> runs ·{" "}
          <code className="rounded bg-muted px-1 py-0.5">.</code> dot ·{" "}
          <code className="rounded bg-muted px-1 py-0.5">w</code> wicket ·{" "}
          <code className="rounded bg-muted px-1 py-0.5">e</code> swap ends ·{" "}
          <code className="rounded bg-muted px-1 py-0.5">u</code> undo ·{" "}
          <code className="rounded bg-muted px-1 py-0.5">d</code> declare ·{" "}
          <code className="rounded bg-muted px-1 py-0.5">s</code> save
        </span>
      </p>
    </div>
  )
}

/* ---------- Wicket dialog: pick dismissal type + fielder(s) ---------- */

const WICKET_TYPE_OPTIONS: { value: WicketType; label: string; hint: string }[] = [
  { value: "bowled", label: "Bowled", hint: "b Bowler" },
  { value: "caught", label: "Caught", hint: "c Fielder b Bowler" },
  { value: "lbw", label: "LBW", hint: "lbw b Bowler" },
  { value: "runout", label: "Run Out", hint: "run out (Fielder)" },
  { value: "stumped", label: "Stumped", hint: "st Keeper b Bowler" },
  { value: "hitwkt", label: "Hit Wicket", hint: "hit wkt b Bowler" },
  { value: "retiredHurt", label: "Retired Hurt", hint: "not out — may return" },
  { value: "retiredOut", label: "Retired Out", hint: "out — no ball" },
]

/** Build the dismissal summary string from the structured inputs (this is
 *  what the public scorecard renders next to the batsman's name). */
function buildDismissalText(args: {
  wicketType: WicketType
  bowlerName?: string
  fielderName?: string
}): string {
  const bowler = args.bowlerName ?? "?"
  const fielder = args.fielderName
  switch (args.wicketType) {
    case "bowled":
      return `b ${bowler}`
    case "caught":
      // Caught & bowled when no fielder is selected OR the fielder is the bowler.
      if (!fielder || fielder === bowler) return `c &b ${bowler}`
      return `c ${fielder} b ${bowler}`
    case "lbw":
      return `lbw b ${bowler}`
    case "stumped":
      return fielder ? `st ${fielder} b ${bowler}` : `st ${bowler}`
    case "runout":
      return fielder ? `run out (${fielder})` : `run out`
    case "hitwkt":
      return `hit wkt b ${bowler}`
    case "retiredHurt":
      return `retired hurt`
    case "retiredOut":
      return `retired out`
  }
}

function WicketDialog({
  open,
  onOpenChange,
  striker,
  nonStriker,
  bowler,
  fieldingPlayers,
  freeHit,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  striker: { id: string; name: string }
  nonStriker: { id: string; name: string }
  bowler: { id: string; name: string }
  fieldingPlayers: { id: string; name: string; role?: string }[]
  /** True when the current ball is a free hit — bowler-credited dismissals
   *  (bowled/caught/lbw/stumped/hit-wkt) will be REJECTED by the engine.
   *  The dialog shows a hint banner so the admin knows to pick Run Out or
   *  Retired Out instead. */
  freeHit?: boolean
  onConfirm: (ev: {
    kind: "wicket"
    wicketType: WicketType
    outBatsmanId: string
    fielderIds: string[]
    dismissal: string
  }) => void
}) {
  const [wicketType, setWicketType] = useState<WicketType>("bowled")
  const [outBatsmanId, setOutBatsmanId] = useState<string>(striker.id)
  const [fielderId, setFielderId] = useState<string>("")
  // Note: this component is conditionally rendered by the parent only when
  // `wicketOpen` is true, so it remounts fresh each time the user opens the
  // dialog — useState initial values act as the "reset on open".

  // The wicket-keeper on the fielding side (auto-prefilled for stumped).
  // Uses the explicit `isKeeper` flag on the Player model — was previously
  // a brittle regex on the role string.
  const keeperId = useMemo(() => {
    const k = fieldingPlayers.find((p) => p.isKeeper)
    return k?.id ?? ""
  }, [fieldingPlayers])

  // Derived state — avoid setState-in-effect by computing the effective
  // selections during render. The picker's `value` reads from these, so the
  // UI stays in sync without needing an effect to "correct" the user's
  // last selection when the dismissal type changes.
  // • For any dismissal type other than run-out, the batsman out is always
  //   the striker (run-out can happen at the non-striker's end).
  // • For stumped with no fielder selected, auto-prefill the keeper.
  const effectiveOutBatsmanId =
    wicketType === "runout" ? outBatsmanId : striker.id
  const effectiveFielderId =
    wicketType === "stumped" && !fielderId && keeperId ? keeperId : fielderId

  const needsFielder =
    wicketType === "caught" ||
    wicketType === "stumped" ||
    wicketType === "runout"
  const showBatsmanSelect = wicketType === "runout"

  const fielderName = fieldingPlayers.find(
    (p) => p.id === effectiveFielderId
  )?.name
  const dismissal = buildDismissalText({
    wicketType,
    bowlerName: bowler.name,
    fielderName,
  })

  const outBatsmanName =
    effectiveOutBatsmanId === striker.id
      ? striker.name
      : effectiveOutBatsmanId === nonStriker.id
        ? nonStriker.name
        : "?"

  // Free-hit-derived warning: when the current ball is a free hit AND the
  // selected dismissal type is bowler-credited, the engine will REJECT the
  // wicket (batsman survives). Show a warning so the admin knows.
  const freeHitWillReject =
    !!freeHit &&
    BOWLER_CREDITED_WICKETS.has(wicketType) &&
    wicketType !== "retired"

  function handleConfirm() {
    onConfirm({
      kind: "wicket",
      wicketType,
      outBatsmanId: effectiveOutBatsmanId,
      fielderIds: effectiveFielderId ? [effectiveFielderId] : [],
      dismissal,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-red-600 text-white">
              <Activity className="h-4 w-4" />
            </span>
            Dismiss {outBatsmanName}
          </DialogTitle>
          <DialogDescription>
            Pick the dismissal type. If caught, stumped or run out, choose the
            fielder(s) involved. The dismissal text updates live in the preview.
          </DialogDescription>
        </DialogHeader>

        {/* Free-hit banner — appears when the current ball is a free hit. */}
        {freeHit && (
          <div className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/40">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" />
              Free hit in effect
            </div>
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              Bowler-credited dismissals (bowled, caught, lbw, stumped, hit
              wicket) are <strong>not allowed</strong> on a free hit — the
              batsman survives and only run-out / retired-out stand.
              {freeHitWillReject
                ? " Picking this dismissal will be rejected by the engine — pick Run Out instead."
                : ""}
            </p>
          </div>
        )}

        <div className="grid gap-3 py-2">
          {/* Dismissal type */}
          <div className="grid gap-1.5">
            <Label>Dismissal type</Label>
            <Select value={wicketType} onValueChange={(v) => setWicketType(v as WicketType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WICKET_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="font-medium">{opt.label}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">{opt.hint}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Batsman out — only shown for run-out */}
          {showBatsmanSelect && (
            <div className="grid gap-1.5">
              <Label>Which batsman is out?</Label>
              <Select
                value={effectiveOutBatsmanId}
                onValueChange={setOutBatsmanId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={striker.id}>
                    Striker — {striker.name}
                  </SelectItem>
                  <SelectItem value={nonStriker.id}>
                    Non-striker — {nonStriker.name}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fielder(s) involved — for caught, stumped, run out */}
          {needsFielder && (
            <div className="grid gap-1.5">
              <Label>
                {wicketType === "caught"
                  ? "Catcher"
                  : wicketType === "stumped"
                    ? "Wicket-keeper"
                    : "Run-out fielder"}
              </Label>
              <Select value={effectiveFielderId} onValueChange={setFielderId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="(direct hit / no fielder)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="(direct-hit)">(direct hit / no fielder)</SelectItem>
                  {fieldingPlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.isKeeper && " †"}
                      {p.isCaptain && " (c)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {wicketType === "stumped" && keeperId && !fielderId && (
                <p className="text-[11px] text-muted-foreground">
                  Wicket-keeper auto-prefilled (you can change it).
                </p>
              )}
            </div>
          )}

          {/* Live dismissal-text preview */}
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Dismissal preview
            </div>
            <div className="mt-1 font-mono text-sm">
              <span className="font-semibold">{outBatsmanName}</span>{" "}
              <span className="text-muted-foreground">{dismissal}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="gap-1.5 bg-red-600 hover:bg-red-700"
          >
            <Activity className="h-4 w-4" />
            Confirm wicket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Picker({
  title,
  players,
  placeholder,
  onPick,
  confirmLabel = "Confirm",
}: {
  title: string
  players: { id: string; name: string }[]
  placeholder: string
  onPick: (id: string) => void
  /** Label for the commit button. Use "Add batsman" / "Set bowler" etc.
   *  Defaults to "Confirm". */
  confirmLabel?: string
}) {
  const [val, setVal] = useState("")
  const selected = players.find((p) => p.id === val)
  // Decouple selection from commit: changing the dropdown only updates the
  // local `val` state. The commit (calling onPick) requires an explicit
  // button click — so a misclick in the dropdown doesn't write to the live
  // state. If the user picks the wrong name in the dropdown, they can just
  // pick a different one before pressing Confirm.
  return (
    <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:bg-amber-950/40">
      <div className="mb-2 flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <Plus className="h-4 w-4" />
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      </div>
      {players.length === 0 ? (
        // Empty-state — the team has no bench players available (rare, but
        // happens if a team was created without enough players seeded, or
        // everyone has already batted). Tell the admin how to fix it instead
        // of opening a broken dropdown.
        <div className="rounded-md border border-dashed bg-amber-100/60 px-3 py-4 text-center text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          No eligible players left in the squad.
          <br />
          Add more players to the team via{" "}
          <span className="font-semibold">Admin → Teams → bulk-add players</span>{" "}
          (the green Users icon on the team row), then come back here.
        </div>
      ) : (
        <>
          <Select value={val} onValueChange={setVal}>
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
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {selected ? (
                <>
                  Selected: <span className="font-semibold">{selected.name}</span>
                </>
              ) : (
                "Pick a player above, then confirm."
              )}
            </span>
            <Button
              size="sm"
              disabled={!val}
              onClick={() => val && onPick(val)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
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
        {state.commentary.map((c) => {
          const isManual = c.kind === "manual"
          return (
            <div
              key={c.id}
              className={cn(
                "flex gap-2 text-xs",
                isManual && "border-l-2 border-blue-500 bg-blue-50/40 pl-2 dark:bg-blue-950/20"
              )}
            >
              <span className="w-10 shrink-0 font-mono tabular-nums text-muted-foreground">
                {c.over}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1",
                  c.kind === "wicket" && "font-bold text-red-700",
                  c.kind === "six" && "font-bold text-purple-700",
                  c.kind === "boundary" && "font-bold text-emerald-700",
                  c.kind === "extra" && "text-amber-700 dark:text-amber-300",
                  c.kind === "run" && "text-emerald-700 dark:text-emerald-300",
                  c.kind === "over" && "font-semibold text-foreground",
                  c.kind === "info" && "italic text-muted-foreground",
                  c.kind === "dot" && "text-muted-foreground/70 tabular-nums",
                  isManual && "text-foreground"
                )}
              >
                {isManual && (
                  <span className="mr-1 inline-block rounded bg-blue-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white align-middle">
                    Commentator
                  </span>
                )}
                {c.text.startsWith("[audio:") ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                      <Mic className="h-3 w-3" />
                      Voice commentary
                    </span>
                    <audio
                      src={c.text.match(/\[audio:(.+?)\]/)?.[1]}
                      controls
                      className="h-7"
                    />
                  </span>
                ) : (
                  c.text
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------ Human / manual commentary input ------------------ */

function CommentaryInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="mb-2 flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white">
          <CircleDot className="h-4 w-4" />
        </div>
        <span className="text-sm font-extrabold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Add Text Commentary
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onSubmit()
            }
          }}
          placeholder="Type your commentary here… (e.g. ‘DRS review taken', ‘Rain stops play')"
          className="flex h-10 w-full min-w-0 rounded-lg border-2 border-blue-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card dark:border-blue-800"
        />
        <Button
          size="sm"
          disabled={disabled || !value.trim()}
          onClick={onSubmit}
          className="gap-1.5 bg-blue-600 text-sm font-bold text-white hover:bg-blue-700"
        >
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] font-medium text-blue-600/70 dark:text-blue-400/70">
        Broadcasts instantly to all viewers on the Live tab. Press{" "}
        <code className="rounded bg-blue-100 px-1 py-0.5 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Enter</code> to send.
      </p>
    </div>
  )
}
