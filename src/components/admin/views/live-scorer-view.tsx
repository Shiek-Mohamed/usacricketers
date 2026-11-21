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
import { Input } from "@/components/ui/input"
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
import { Switch } from "@/components/ui/switch"
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
  RotateCw,
  Sparkles,
} from "lucide-react"
import type { Match, Player } from "@/lib/types"
import { useLiveScoreBackup, loadLocalBackup } from "@/lib/use-live-score-backup"
import { calculateDLS, type DLSResult } from "@/lib/dls"

/** Log a scoring action to the audit trail (non-fatal — fire and forget). */
function logAudit(matchId: string, scorerId: string | null, action: string, ballNo: number, detail: string, token?: string | null) {
  fetch("/api/scoring-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ matchId, scorerId, action, ballNo, detail }),
  }).catch(() => {}) // non-fatal
}

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
  const session = useScorerSession((s) => s.session)

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
  const { liveState, connected, reconnecting, stateReceived, pushState, clearState } = useLiveScore(id, token)

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
  // Latest liveState + match held in refs so the flush-on-close effect
  // (registered once, before the early returns) can persist the pending state
  // synchronously when the tab is hidden / closed — guards against data loss
  // if the browser crashes / loses WiFi within the 800ms persist debounce.
  const latestLiveStateRef = useRef<LiveMatchState | null>(null)
  const latestMatchRef = useRef<Match | null>(null)
  // Tracks the last bowler — used to enforce the cricket rule that a bowler
  // cannot bowl two consecutive overs. Updated whenever the bowlerId changes
  // from a value to null (which happens at over end in the scoring engine).
  const lastBowlerRef = useRef<string | null>(null)

  // Track the last bowler: when bowlerId goes from a value to null (over end),
  // capture the previous value so we can prevent consecutive-over bowling.
  useEffect(() => {
    if (liveState?.bowlerId) {
      lastBowlerRef.current = liveState.bowlerId
    }
  }, [liveState?.bowlerId])
  // Keep the latest liveState + match in refs for the flush-on-close handler.
  useEffect(() => {
    latestLiveStateRef.current = liveState ?? null
  }, [liveState])
  useEffect(() => {
    latestMatchRef.current = match ?? null
  }, [match])
  // Flush-on-close: when the tab is hidden / unloaded while a debounced
  // persist (800ms) is still pending, fire the save immediately so the latest
  // ball isn't lost if the browser crashes / loses WiFi within that window.
  // Only acts when a persist is actually pending (saveTimer.current set) —
  // otherwise a no-op, which also makes it harmless in read-only contexts
  // (the public viewer never schedules a persist, so saveTimer stays null).
  // Fire-and-forget with `keepalive` so the request survives page teardown
  // (sendBeacon can't send a JSON PUT with headers, so fetch is used here).
  useEffect(() => {
    const flush = () => {
      const timer = saveTimer.current
      if (!timer) return
      clearTimeout(timer)
      saveTimer.current = null
      const state = latestLiveStateRef.current
      const m = latestMatchRef.current
      if (!state || !m) return
      const csrf =
        typeof document !== "undefined"
          ? document.cookie.match(/csrf-token=([^;]+)/)?.[1] || ""
          : ""
      void fetch(`/api/matches/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          scorecard: stateToScorecard(state),
          status: state.status,
          result: state.result,
          liveStateJson: JSON.stringify(state),
        }),
        keepalive: true,
      }).catch(() => {})
    }
    window.addEventListener("visibilitychange", flush)
    window.addEventListener("pagehide", flush)
    window.addEventListener("beforeunload", flush)
    return () => {
      window.removeEventListener("visibilitychange", flush)
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("beforeunload", flush)
    }
  }, [])
  // Wicket-dialog open state — the Wicket button opens a modal that lets the
  // admin pick dismissal type + fielder(s) involved, then sends the structured
  // wicket BallEvent to applyBall via handleBall.
  const [wicketOpen, setWicketOpen] = useState(false)
  // No-ball-dialog open state — the No Ball button (and the Shift+N keyboard
  // shortcut) opens a modal that lets the scorer optionally enter runs scored
  // off the bat (e.g. a four hit off a no-ball) plus rare byes/leg-byes. The
  // common case (just the +1 no-ball penalty) is the default — runsOffBat=0,
  // byes=0, legByes=0 — so the scorer can confirm immediately for a bare
  // no-ball, matching the old single-click behaviour.
  const [noballOpen, setNoballOpen] = useState(false)
  // Reset-confirmation dialog open state — Reset is destructive (clears all
  // scoring for the match), so it's gated behind an AlertDialog confirm.
  const [resetOpen, setResetOpen] = useState(false)
  // Jump-to-ball confirmation — when the scorer clicks a past ball in the
  // commentary feed more than a few balls back, confirm before discarding the
  // balls scored since (the bounded, safe version of "edit a past ball").
  const [jumpBackTarget, setJumpBackTarget] = useState<number | null>(null)
  // Free-text commentary input — the scorer types a note ("DRS review taken",
  // "Rain stops play", etc.) and presses Enter / clicks Send. The entry is
  // added to liveState.commentary with kind="manual" and broadcast via the
  // socket so the public match-detail Live tab shows it instantly (rendered
  // with a blue accent + "Commentator" label so it's distinguishable from
  // the auto-generated ball-by-ball feed).
  const [commentaryText, setCommentaryText] = useState("")
  // AI commentary toggle — when ON, the scorer auto-generates a short prose
  // line for key events (wicket/boundary/six/milestone/over) via
  // /api/ai-commentary. AUGMENTS the templated feed (does NOT replace the
  // structured ball entries — those power jump-to-ball, badges, charts).
  const [aiCommentaryEnabled, setAiCommentaryEnabled] = useState(true)

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
    if (id) logAudit(id, liveState.scorerId ?? null, "dls_applied", liveState.ballNo, `Target: ${dlsResult.revisedTarget} from ${dlsRevisedOvers} overs (was ${dlsResult.originalTarget})`, token)
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
   * Shift+W → wide | Shift+N → no-ball dialog (opens the runs-off-bat prompt)
   * Shift+B → bye (1) | Shift+L → leg-bye (1).
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
      if (noballOpen) return
      // Block scoring shortcuts while a destructive confirm dialog is open
      // (Reset / jump-back) — the modal already traps focus, but keyboard
      // events can still bubble on some browsers/platforms.
      if (resetOpen) return
      if (jumpBackTarget !== null) return
      if (!liveState || liveState.status !== "live") return
      if (!liveState.strikerId || !liveState.nonStrikerId || !liveState.bowlerId) return
      // Shift-modified keys → extras (Shift+W/N/B/L). Checked BEFORE the
      // lowercase single-key shortcuts so they don't collide with the bare
      // `w` (wicket dialog) shortcut. Any other Shift+key combo is a no-op
      // (returns without falling through) so the scorer doesn't accidentally
      // score a ball while reaching for a capital letter elsewhere.
      if (e.shiftKey) {
        const sk = e.key.toLowerCase()
        if (sk === "w") {
          e.preventDefault()
          handleBall({ kind: "wide" })
        } else if (sk === "n") {
          e.preventDefault()
          setNoballOpen(true)
        } else if (sk === "b") {
          e.preventDefault()
          handleBall({ kind: "bye", runs: 1 })
        } else if (sk === "l") {
          e.preventDefault()
          handleBall({ kind: "legbye", runs: 1 })
        }
        return
      }
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

  // Extra players created on-the-fly during live scoring (via the Picker's
  // quick-add). Merged into playersByTeam so the dropdowns update instantly.
  const [extraPlayers, setExtraPlayers] = useState<Player[]>([])

  const playersByTeam: Record<string, Player[]> = useMemo(() => {
    const m: Record<string, Player[]> = {}
    if (match) {
      m[match.team1Id] = [...(t1Players ?? []), ...extraPlayers.filter((p) => p.teamId === match.team1Id)]
      m[match.team2Id] = [...(t2Players ?? []), ...extraPlayers.filter((p) => p.teamId === match.team2Id)]
    }
    return m
  }, [match, t1Players, t2Players, extraPlayers])

  // Quick-add a player during live scoring — creates via API, adds to
  // extraPlayers, and auto-picks them (calls onPick with the new ID).
  async function liveQuickAddPlayer(name: string, teamId: string, role: string, onPick?: (id: string) => void) {
    if (!name.trim() || !teamId || !token) return
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), teamId, role, battingStyle: "Right-hand bat", bowlingStyle: role === "Bowler" ? "Right-arm medium" : "" }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const player: Player = await res.json()
      setExtraPlayers((prev) => [...prev, player])
      onPick?.(player.id)
      toast.success(`${player.name} added`)
    } catch (e) {
      toast.error("Failed to add player", { description: String(e) })
    }
  }

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
          // Save the FULL LiveMatchState to the DB so scoring can be resumed
          // even after the score-service restarts AND localStorage is cleared
          // (e.g. different browser, overnight, weekend). The liveStateJson
          // field stores the complete state including striker/bowler IDs.
          liveStateJson: JSON.stringify(state),
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
      scorerId: liveState.scorerId ?? undefined,
      timestamp: new Date().toISOString(),
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

  /** Fire an LLM-generated prose commentary line for a KEY event that just
   *  happened on this ball (wicket / boundary / six / milestone / over-end).
   *  AUGMENTS the templated feed — the structured ball entry stays as the
   *  canonical record (it powers jump-to-ball, badges, charts); the AI line
   *  is a parallel narrative inserted right after the triggering entry.
   *
   *  Non-blocking: the templated entry + state are already pushed (handleBall
   *  called pushState(next) before this). This fires the LLM call async; when
   *  the prose arrives (~1-2s) it reads the LATEST liveState
   *  (latestLiveStateRef) so scoring can continue in the meantime, inserts
   *  the kind="ai" entry immediately AFTER the triggering ball entry (by id,
   *  so it stays in position even if newer balls have since been scored), and
   *  pushes the updated state through the normal pipeline.
   *
   *  Gated to key events only (not every delivery) to bound cost/latency —
   *  see /api/ai-commentary. One LLM call per ball at most (the highest-
   *  priority key event wins: wicket > milestone > six > boundary > over). */
  function maybeGenerateAiCommentary(
    prev: LiveMatchState,
    next: LiveMatchState,
    event: BallEvent,
  ) {
    if (!aiCommentaryEnabled || !token || !match) return
    const inn = next.innings[next.currentInnings]
    if (!inn) return

    // Diff commentary: the new entries are those at the front of
    // next.commentary whose ids weren't in prev.commentary. (applyBall
    // prepends newest-first.)
    const prevIds = new Set(prev.commentary.map((c) => c.id))
    const newEntries = next.commentary.filter((c) => !prevIds.has(c.id))

    // Pick the highest-priority KEY event. One prose line per ball.
    const PRIORITY: Record<string, number> = {
      wicket: 5, milestone: 4, six: 3, boundary: 2, over: 1,
    }
    let best: { id: string; kind: string; over: string; ballNo: number; text: string } | null = null
    for (const c of newEntries) {
      const p = PRIORITY[c.kind]
      if (p == null) continue
      if (!best || p > PRIORITY[best.kind]) {
        best = { id: c.id, kind: c.kind, over: c.over, ballNo: c.ballNo, text: c.text }
      }
    }
    if (!best) return

    // Capture into consts for the async closure (avoids TS narrowing issues
    // with the `let best` across the fetch boundary).
    const trigId = best.id
    const trigKind = best.kind as "wicket" | "milestone" | "six" | "boundary" | "over"
    const trigOver = best.over
    const trigBallNo = best.ballNo
    const trigText = best.text

    const striker = inn.batsmen.find((b) => b.id === next.strikerId)
    const nonStriker = inn.batsmen.find((b) => b.id === next.nonStrikerId)
    const bowler = inn.bowlers.find((b) => b.id === next.bowlerId)

    // For wickets, pull the structured dismissal + out batsman name from the
    // BallEvent (source of truth — cleaner than reverse-engineering from
    // state, where the out slot may already be cleared/refilled).
    let dismissal: string | undefined
    let outBatsmanName: string | undefined
    if (event.kind === "wicket") {
      dismissal = event.dismissal
      const outB = inn.batsmen.find((b) => b.id === event.outBatsmanId)
      outBatsmanName = outB?.name
    }

    const payload = {
      matchId: match.id,
      format: next.format,
      innings: {
        battingTeam: inn.battingTeamShortName || undefined,
        bowlingTeam: inn.bowlingTeamShortName || undefined,
        runs: inn.runs,
        wickets: inn.wickets,
        overs: oversString(inn.balls),
        inningsNo: next.currentInnings + 1,
        target: inn.target ?? undefined,
      },
      striker: striker?.name,
      nonStriker: nonStriker?.name,
      bowler: bowler?.name,
      event: {
        kind: trigKind,
        runs: "runs" in event ? event.runs : undefined,
        over: trigOver,
        ballNo: trigBallNo,
        dismissal,
        outBatsman: outBatsmanName,
        description: trigKind === "milestone" || trigKind === "over" ? trigText : undefined,
      },
    }

    fetch("/api/ai-commentary", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const prose: string | null = data?.prose ?? null
        const audioUrl: string | null = data?.audioUrl ?? null
        if (!prose) return
        const current = latestLiveStateRef.current
        if (!current) return
        // Insert the AI line immediately AFTER the triggering ball entry (by
        // id) so it stays positioned right below the ball it describes, even
        // if newer balls have since been prepended while the LLM was thinking.
        const idx = current.commentary.findIndex((c) => c.id === trigId)
        if (idx < 0) return // trimmed past 120 cap or state reset — drop
        const aiEntry = {
          id: Math.random().toString(36).slice(2),
          ballNo: trigBallNo,
          over: trigOver,
          text: prose,
          kind: "ai" as const,
          scorerId: current.scorerId ?? undefined,
          timestamp: new Date().toISOString(),
          audioUrl: audioUrl ?? undefined,
        }
        const newCommentary = [...current.commentary]
        newCommentary.splice(idx + 1, 0, aiEntry)
        const updated: LiveMatchState = {
          ...current,
          commentary: newCommentary.slice(0, 120),
        }
        setHistory((h) => [...h, current].slice(-50))
        pushState(updated)
        persist(updated)
      })
      .catch(() => {
        // LLM call failed — silent (the route already swallows + returns null).
      })
  }

  function handleBall(event: BallEvent) {
    if (!liveState) return
    setHistory((h) => [...h, liveState].slice(-50))
    const next = applyBall(liveState, event)
    pushState(next)
    persist(next)
    // AI commentary — fire-and-forget. Non-blocking: the templated entry +
    // state are already pushed; the AI prose arrives ~1-2s later and is
    // inserted after the triggering ball entry. Gated to key events only.
    maybeGenerateAiCommentary(liveState, next, event)
    // Audit trail — log every ball scored
    if (id) logAudit(id, liveState.scorerId ?? null, "ball_scored", next.ballNo, `${event.kind}${'runs' in event ? ` ${event.runs}` : ''}`, token)
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
    // Audit trail — log every undo
    if (id) logAudit(id, prev.scorerId ?? null, "undo", prev.ballNo, "Reverted last action", token)
  }

  /* ------------------ Jump-to-ball undo (bounded edit-past-ball) ------------------
   * The scorer clicks a past ball in the commentary feed → restore the state
   * to right after that ball was scored, in one click (instead of clicking
   * Undo N times). Uses the existing `history` stack — no snapshot+replay.
   *
   * Mechanics: `history[i]` is the state AFTER ball i was scored (history[0]
   * = initial state, history[N-1] = state before the latest ball). The
   * current `liveState` = state_N. Each handleBall call pushes exactly one
   * ball-type commentary entry, so the K-th newest ball entry in the
   * commentary feed corresponds to history[N - K + 1] (or liveState if K=1).
   *
   * Truncates history to the entries before the target so Undo continues
   * naturally from the restored point. Guarded: only backward jumps, and a
   * confirm dialog for jumps more than 3 balls back (destructive — balls
   * scored since then are lost). */
  const BALL_COMMENTARY_KINDS = new Set([
    "run",
    "boundary",
    "six",
    "wicket",
    "extra",
    "dot",
  ])

  function handleJumpToBall(commentaryId: string) {
    if (!liveState) return
    // Find the clicked entry's ball index (1-indexed from newest ball).
    let ballIndex = -1
    let count = 0
    for (const c of liveState.commentary) {
      if (BALL_COMMENTARY_KINDS.has(c.kind)) {
        count++
        if (c.id === commentaryId) {
          ballIndex = count
          break
        }
      }
    }
    if (ballIndex < 1) return // not a ball entry — not clickable
    if (ballIndex === 1) {
      toast.info("Already at the latest ball")
      return
    }
    // Target history index = history.length - ballIndex + 1.
    // (history.length = N handleBall calls; target = state_{N - ballIndex + 1}.)
    const targetIdx = history.length - ballIndex + 1
    if (targetIdx < 0 || targetIdx >= history.length) {
      // Out of history range (too far back — history is capped at 50).
      toast.error("Can't jump back that far", {
        description: "History only keeps the last 50 balls. Use Reset to start over.",
      })
      return
    }
    const ballsDiscarded = ballIndex - 1
    if (ballsDiscarded > 3) {
      // Destructive — confirm before discarding more than 3 balls.
      setJumpBackTarget(targetIdx)
      return
    }
    executeJumpBack(targetIdx)
  }

  function executeJumpBack(targetIdx: number) {
    if (!liveState) return
    const target = history[targetIdx]
    if (!target) return
    const ballsDiscarded = history.length - targetIdx
    // Restore the target state and truncate history to entries before it,
    // so Undo continues naturally from the restored point.
    setHistory((h) => h.slice(0, targetIdx))
    pushState(target)
    persist(target)
    toast.success(`Jumped back ${ballsDiscarded} ball${ballsDiscarded !== 1 ? "s" : ""}`)
    if (id) logAudit(id, target.scorerId ?? null, "jump_back", target.ballNo, `Jumped back ${ballsDiscarded} balls to ball ${target.ballNo}`, token)
    setJumpBackTarget(null)
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
    // Set the scorer's ID on the state so every commentary entry records
    // who scored it (closes scoring data gap #10 — scorer identity per ball).
    state.scorerId = session?.scorer?.id ?? null
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
    if (id) logAudit(id, state.scorerId ?? null, "innings_started", 0, `Innings ${state.currentInnings + 1}: ${battingFirstId === match!.team1Id ? t1?.shortName : t2?.shortName} batting first`, token)
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
    // If this batter is RETURNING from retired-hurt, clear the flag (they're
    // back at the crease — no longer "available to return"). Also reset the
    // dismissal string (it was "retired hurt" while away; now they're batting
    // again, so dismissal should be empty until/unless they're actually out).
    // addBatsman dedupes by id (won't overwrite the existing entry), so we
    // patch the batsman entry directly here.
    const inn = state.innings[state.currentInnings]
    const batIdx = inn.batsmen.findIndex((b) => b.id === p.id)
    if (batIdx >= 0 && inn.batsmen[batIdx].retiredHurt) {
      const newBatsmen = inn.batsmen.map((b) =>
        b.id === p.id ? { ...b, retiredHurt: false, dismissal: "" } : b
      )
      const newInnings = [...state.innings]
      newInnings[state.currentInnings] = { ...inn, batsmen: newBatsmen }
      state = { ...state, innings: newInnings }
    }
    // Fill whichever slot is currently empty — the striker's end if a normal
    // wicket fell (strikerId === null), or the non-striker's end if a run-out
    // happened at the non-striker's end (nonStrikerId === null). A retired-
    // hurt batter returning fills the slot they vacated (the engine cleared
    // the slot they retired from). If both are empty (innings restart, edge
    // case), default to striker.
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
    // Cricket rule: a bowler cannot bowl two consecutive overs.
    // The previous bowler is tracked in lastBowlerRef (updated whenever
    // bowlerId changes from a value to null at over end).
    if (playerId === lastBowlerRef.current) {
      toast.error("A bowler cannot bowl two consecutive overs", {
        description: "Pick a different bowler for this over.",
      })
      return
    }
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

  /** Destructive reset — clears ALL scoring for this match and returns to a
   *  fresh empty innings. Gated behind an AlertDialog confirm (set `resetOpen`
   *  to true to show it). Wired to:
   *    1. `clearState()` — clears the score-service cache + emits null so
   *       viewers see "waiting for scorer" until the new state arrives.
   *    2. A fresh `initState(...)` using the team that was batting first in
   *       the current live state (preserves the toss / batting-first choice
   *       so the scorer doesn't have to re-pick the team). Falls back to
   *       team1Id if the prior state is missing or malformed.
   *    3. `pushState(fresh)` + `persist(fresh)` — broadcasts the fresh state
   *       to viewers + saves it to the DB (overwriting the stale state).
   *    4. `setHistory([])` — clears the local undo stack so Undo can't
   *       resurrect the discarded scoring. */
  function reset() {
    if (!match) return
    // Determine the batting-first team from the prior state (preserves the
    // toss result). Fall back to team1Id if the prior state is missing.
    const battingFirstId =
      liveState?.innings?.[0]?.battingTeamId ?? match.team1Id
    const fresh = initState(match, battingFirstId)
    // Preserve the scorer's ID so commentary entries continue to be
    // attributed to the right scorer after the reset.
    fresh.scorerId = session?.scorer?.id ?? null
    // 1. Clear the score-service cache — viewers see "waiting" briefly.
    clearState()
    // 2. Broadcast the fresh empty innings.
    pushState(fresh)
    // 3. Clear the undo stack — the discarded scoring is gone for good.
    setHistory([])
    // 4. Persist the fresh state to the DB (overwrites the stale state).
    persist(fresh)
    toast.success("Scoring reset — fresh innings ready")
    if (id) logAudit(id, fresh.scorerId ?? null, "reset", 0, "Scoring reset — all balls cleared", token)
    setResetOpen(false)
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
  // Power-play indicator: show a badge when the batting innings' current over
  // (1-indexed — the over currently being bowled) falls within one of the
  // series' configured power-play over-ranges. Visual only — the scoring
  // engine does not (yet) enforce power-play fielding restrictions; this just
  // surfaces the status to the scorer next to the score.
  const series = match.series ?? null
  const currentOver = currentInnings ? Math.floor(currentInnings.balls / 6) + 1 : 0
  const inPowerPlay =
    !!(series?.powerPlayEnabled &&
      currentOver > 0 &&
      series.powerPlayOvers.some((seg) => currentOver >= seg.from && currentOver <= seg.to))
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
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1e2a5e] px-4 py-3 text-white sm:px-6">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <FormatBadge format={match.format} />
            <span className="truncate text-sm font-bold uppercase">{t1?.shortName} <span className="text-white/50">v</span> {t2?.shortName}</span>
            <span className="text-xs text-white/60">· {match.matchNo}</span>
            <span className="text-xs text-white/50">{match.series?.shortName}</span>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionPill connected={connected} reconnecting={reconnecting} />
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
                <Button variant="outline" onClick={handleUndo} className="gap-1.5 h-11 px-4 text-sm font-bold transition-transform active:scale-95 sm:h-9 sm:px-3 sm:text-xs" disabled={history.length === 0}>
                  <Undo2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Undo
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
                  className="gap-1.5 h-11 px-4 text-sm font-bold transition-transform active:scale-95 sm:h-9 sm:px-3 sm:text-xs"
                >
                  <Save className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> Save
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
                {/* Reset — destructive: clears ALL scoring for this match.
                    Gated behind an AlertDialog confirm. Hidden once the
                    match is completed (no point resetting a finished match). */}
                {liveState.status !== "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResetOpen(true)}
                    className="gap-1 border-red-400 text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                    title="Reset all scoring for this match — cannot be undone"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
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
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="flex items-center gap-2 text-amber-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-semibold">
                  {connected ? "Loading live scoring state…" : "Reconnecting to live scoring…"}
                </span>
              </div>
              <div className="w-full max-w-md space-y-3">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg" />
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 rounded-lg" />
                  ))}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Retry / refresh
              </Button>
              <p className="max-w-xs text-xs text-muted-foreground/70">
                If this takes more than a few seconds, the scoring session may have ended.
              </p>
            </div>
          ) : showSetup ? (
            <>
              {/* Resume from backup — checks localStorage first, then the DB
                  (liveStateJson field on the match record). This covers all
                  scenarios: overnight, weekend, different browser, score-service
                  restart, etc. */}
              {id && token && (() => {
                // Try localStorage backup first (fastest, most complete)
                const localBackup = loadLocalBackup(id)
                // Fall back to DB-saved liveStateJson (survives browser clears)
                const dbBackup = !localBackup && match?.liveStateJson
                  ? (() => { try { return JSON.parse(match.liveStateJson) as LiveMatchState } catch { return null } })()
                  : null
                const backup = localBackup ?? dbBackup
                if (!backup) return null
                const inn = backup.innings[backup.currentInnings]
                const source = localBackup ? "this browser" : "the database"
                return (
                  <div className="mb-4 rounded-lg border-2 border-emerald-400 bg-emerald-50 p-4 dark:bg-emerald-950/40">
                    <div className="mb-2 flex items-center gap-2">
                      <RotateCw className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Resume Scoring Session
                      </h3>
                    </div>
                    <p className="mb-3 text-sm text-emerald-800 dark:text-emerald-300">
                      A previous scoring session was found in {source}
                      {inn ? ` — ${inn.teamShortName} ${inn.totalRuns}/${inn.totalWickets} (${inn.totalOvers} ov)` : ""}.
                      Resume from where you left off, or start a new innings below.
                    </p>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => {
                        pushState(backup)
                        toast.success("Scoring session restored!")
                      }}
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      Resume Scoring
                    </Button>
                  </div>
                )
              })()}
              <SetupPanel
              t1={t1}
              t2={t2}
              t1Players={t1Players ?? []}
              t2Players={t2Players ?? []}
              onStart={startInnings}
              tokenReady={!!token}
              connected={connected}
              matchId={match?.id}
              token={token}
            />
            </>
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
                  inPowerPlay={inPowerPlay}
                />
              )}

              {/* Action prompts */}
              {needBatsman && (
                <Picker
                  title={needStriker ? "New batsman (striker's end)" : "New batsman (non-striker's end)"}
                  players={(playersByTeam[currentInnings!.battingTeamId] ?? []).filter(
                    (p) => {
                      // Exclude dismissed batters and batters currently at the
                      // crease. ALLOW retired-hurt batters to return (they're
                      // not out, not at the crease — their slot was cleared
                      // when they retired hurt). Closes the "retired-hurt →
                      // can't return" gap: previously any batter already in
                      // inn.batsmen was excluded, so a retired-hurt batter
                      // could never be picked back up.
                      const bat = currentInnings!.batsmen.find((b) => b.id === p.id)
                      if (!bat) return true // not yet batted — selectable
                      if (bat.out) return false // dismissed — can't return
                      if (p.id === liveState!.strikerId || p.id === liveState!.nonStrikerId) return false // at the crease
                      // In the batting list but not out and not at the crease —
                      // only happens when retired-hurt. Selectable (returning).
                      return bat.retiredHurt === true
                    }
                  )}
                  placeholder="Select new batsman"
                  confirmLabel="Add batsman"
                  onPick={bringInBatsman}
                  teamId={currentInnings!.battingTeamId}
                  onQuickAdd={(name, tid, cb) => liveQuickAddPlayer(name, tid, "Batsman", cb)}
                />
              )}
              {needBowler && (
                <Picker
                  title="Next bowler"
                  players={(playersByTeam[currentInnings!.bowlingTeamId] ?? []).filter(
                    (p) => p.id !== lastBowlerRef.current
                  )}
                  placeholder="Select bowler for next over"
                  confirmLabel="Set bowler"
                  onPick={pickNextBowler}
                  teamId={currentInnings!.bowlingTeamId}
                  onQuickAdd={(name, tid, cb) => liveQuickAddPlayer(name, tid, "Bowler", cb)}
                />
              )}

              {/* Ball entry buttons */}
              {!isComplete && !needBatsman && !needBowler && (
                <BallPad
                  onBall={handleBall}
                  disabled={!liveState}
                  onWicket={() => setWicketOpen(true)}
                  onNoBall={() => setNoballOpen(true)}
                />
              )}

              {/* AI commentary toggle — when ON, the scorer auto-generates a
                  short prose line for key events (wickets, boundaries,
                  sixes, milestones, over-end) via /api/ai-commentary. AUGMENTS
                  the templated feed — the structured ball entries stay as the
                  canonical record (they power jump-to-ball, badges, charts). */}
              {!isComplete && !showSetup && liveState && (
                <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">AI Commentary</span>
                      <span className="text-[10px] text-muted-foreground">
                        Auto-narrates wickets, boundaries, sixes &amp; milestones
                      </span>
                    </div>
                  </div>
                  <Switch
                    checked={aiCommentaryEnabled}
                    onCheckedChange={setAiCommentaryEnabled}
                    aria-label="Toggle AI commentary"
                  />
                </div>
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
                  <p className="mt-1.5 text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70">
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

              {/* No-ball dialog — lets the scorer optionally enter runs off
                  the bat (e.g. a four hit off a no-ball) plus rare byes/
                  leg-byes. The common case (just +1 no-ball) is the default —
                  the scorer can confirm immediately. Emits the extended
                  BallEvent { kind: "noball", runsOffBat, byes, legByes }. */}
              {noballOpen && liveState && currentInnings && (
                <NoBallDialog
                  open={noballOpen}
                  onOpenChange={setNoballOpen}
                  striker={{
                    id: liveState.strikerId!,
                    name: currentInnings.batsmen.find((b) => b.id === liveState.strikerId)?.name ?? "Striker",
                  }}
                  freeHit={currentInnings.freeHit}
                  limitedOvers={liveState.maxOvers > 0}
                  onConfirm={(ev) => {
                    handleBall(ev)
                    setNoballOpen(false)
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
                <CommentaryFeed state={liveState} onJumpToBall={handleJumpToBall} />
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

      {/* Reset confirmation dialog — destructive: clears ALL scoring. */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all scoring for this match?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear every ball scored so far and return the match to a
              fresh empty innings (preserving the toss / batting-first team).
              The live broadcast will briefly show "waiting for scorer" until
              the new state arrives. <strong>This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={reset}
            >
              Reset scoring
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Jump-back confirmation — shown when the scorer clicks a past ball
          more than 3 balls back in the commentary feed. Confirms before
          discarding the balls scored since (bounded edit-past-ball). */}
      <AlertDialog
        open={jumpBackTarget !== null}
        onOpenChange={(v) => { if (!v) setJumpBackTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Jump back {jumpBackTarget !== null ? history.length - jumpBackTarget : 0} ball{(jumpBackTarget !== null ? history.length - jumpBackTarget : 0) !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Restores the scoring state to right after the clicked ball was
              scored. Balls scored since then will be lost. You can still Undo
              from the restored point. This is the bounded, safe version of
              "edit a past ball" — full snapshot+replay is not supported.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (jumpBackTarget !== null) executeJumpBack(jumpBackTarget)
              }}
            >
              Jump back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function ConnectionPill({ connected, reconnecting }: { connected: boolean; reconnecting?: boolean }) {
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
      {connected ? "Connected" : reconnecting ? "Reconnecting…" : "Connecting…"}
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
  matchId,
  token,
}: {
  t1: Player["team"] | undefined
  t2: Player["team"] | undefined
  t1Players: Player[]
  t2Players: Player[]
  onStart: (battingFirstId: string, strikerId: string, nonStrikerId: string, bowlerId: string) => void
  tokenReady: boolean
  connected: boolean
  matchId?: string
  token?: string | null
}) {
  const [battingFirstId, setBattingFirstId] = useState(t1?.id ?? "")
  const [strikerId, setStrikerId] = useState("")
  const [nonStrikerId, setNonStrikerId] = useState("")
  const [bowlerId, setBowlerId] = useState("")
  const [tossWinnerId, setTossWinnerId] = useState("")
  const [tossDecision, setTossDecision] = useState("")
  // Quick-add player state — lets the scorer create a player on-the-fly
  // if someone isn't in the team roster (late arrival, missing from CMS).
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [addPlayerName, setAddPlayerName] = useState("")
  const [addPlayerTeam, setAddPlayerTeam] = useState("")
  const [addPlayerRole, setAddPlayerRole] = useState("Batsman")
  const [addingPlayer, setAddingPlayer] = useState(false)
  // Locally created players (merged with the prop data so dropdowns update
  // without needing a refetch from the parent).
  const [extraPlayers, setExtraPlayers] = useState<Player[]>([])

  // Merge prop players with locally-created ones.
  const allT1Players = [...t1Players, ...extraPlayers.filter((p) => p.teamId === t1?.id)]
  const allT2Players = [...t2Players, ...extraPlayers.filter((p) => p.teamId === t2?.id)]

  // When the toss winner + decision are both set, auto-fill the batting-first
  // team: if the winner chose "bat", they bat first; if "bowl", the other
  // team bats first. Also persist the toss to the match record.
  function applyToss(winnerId: string, decision: string) {
    if (!winnerId || !decision || !t1 || !t2) return
    const battingFirst = decision === "bat" ? winnerId : (winnerId === t1.id ? t2.id : t1.id)
    setBattingFirstId(battingFirst)
    setStrikerId("")
    setNonStrikerId("")
    setBowlerId("")
    // Persist the toss to the match record (best-effort — don't block start)
    if (matchId && token) {
      fetch(`/api/matches/${matchId}/toss`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tossWinnerId: winnerId, tossDecision: decision }),
      }).catch(() => {})
    }
  }

  const battingPlayers =
    battingFirstId === t1?.id ? allT1Players : battingFirstId === t2?.id ? allT2Players : []
  const bowlingPlayers =
    battingFirstId === t1?.id
      ? allT2Players
      : battingFirstId === t2?.id
        ? allT1Players
        : []

  // Quick-add a player to a team — creates via API, adds to local state,
  // and auto-selects them in the specified slot (striker/non-striker/bowler).
  async function quickAddPlayer(name: string, teamId: string, role: string, slot?: "striker" | "nonStriker" | "bowler") {
    if (!name.trim() || !teamId || !token) return
    setAddingPlayer(true)
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), teamId, role, battingStyle: "Right-hand bat", bowlingStyle: role === "Bowler" ? "Right-arm medium" : "" }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const player: Player = await res.json()
      setExtraPlayers((prev) => [...prev, player])
      if (slot === "striker") setStrikerId(player.id)
      else if (slot === "nonStriker") setNonStrikerId(player.id)
      else if (slot === "bowler") setBowlerId(player.id)
      setAddPlayerName("")
      setShowAddPlayer(false)
      toast.success(`${player.name} added`)
    } catch (e) {
      toast.error("Failed to add player", { description: String(e) })
    } finally {
      setAddingPlayer(false)
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-bold uppercase tracking-wide">
            Start live innings
          </h3>
        </div>
        {/* Toss section */}
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Toss</span>
            <span className="text-[10px] text-muted-foreground">(optional)</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              value={tossWinnerId}
              onValueChange={(v) => {
                setTossWinnerId(v)
                if (tossDecision) applyToss(v, tossDecision)
              }}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Won by" /></SelectTrigger>
              <SelectContent>
                {t1 && <SelectItem value={t1.id}>{t1.name}</SelectItem>}
                {t2 && <SelectItem value={t2.id}>{t2.name}</SelectItem>}
              </SelectContent>
            </Select>
            <Select
              value={tossDecision}
              onValueChange={(v) => {
                setTossDecision(v)
                if (tossWinnerId) applyToss(tossWinnerId, v)
              }}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Elected to" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bat">Bat</SelectItem>
                <SelectItem value="bowl">Bowl</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

        {/* Quick add player — for when a batsman/bowler isn't in the roster */}
        <div className="mt-3 rounded-md border border-dashed border-border p-3">
          {!showAddPlayer ? (
            <button
              onClick={() => {
                setShowAddPlayer(true)
                setAddPlayerTeam(battingFirstId || t1?.id || "")
              }}
              className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Add player not in list
            </button>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <Input
                  value={addPlayerName}
                  onChange={(e) => setAddPlayerName(e.target.value)}
                  placeholder="Player name"
                  className="h-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && addPlayerName.trim() && addPlayerTeam) {
                      quickAddPlayer(addPlayerName, addPlayerTeam, addPlayerRole)
                    }
                  }}
                />
                <Select value={addPlayerTeam} onValueChange={setAddPlayerTeam}>
                  <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Team" /></SelectTrigger>
                  <SelectContent>
                    {t1 && <SelectItem value={t1.id}>{t1.shortName}</SelectItem>}
                    {t2 && <SelectItem value={t2.id}>{t2.shortName}</SelectItem>}
                  </SelectContent>
                </Select>
                <Select value={addPlayerRole} onValueChange={setAddPlayerRole}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Batsman">Batsman</SelectItem>
                    <SelectItem value="Bowler">Bowler</SelectItem>
                    <SelectItem value="All-rounder">All-rounder</SelectItem>
                    <SelectItem value="Wicket-keeper">WK</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={!addPlayerName.trim() || !addPlayerTeam || addingPlayer}
                  onClick={() => quickAddPlayer(addPlayerName, addPlayerTeam, addPlayerRole)}
                >
                  {addingPlayer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add
                </Button>
              </div>
              <button
                onClick={() => { setShowAddPlayer(false); setAddPlayerName("") }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
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
  inPowerPlay,
}: {
  state: LiveMatchState
  onChangeStriker?: () => void
  onChangeNonStriker?: () => void
  onChangeBowler?: () => void
  /** Swap striker ↔ non-striker — override the auto strike-rotation logic
   *  when it disagrees with reality (caught-and-bowled crossing, etc.).
   *  Allowed at any time (not over-boundary-gated) — doesn't affect stats. */
  onSwapEnds?: () => void
  /** When true, the current over is inside a series-configured power-play
   *  range — render a "Power Play" badge next to the score. Visual only. */
  inPowerPlay?: boolean
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
            {inPowerPlay && (
              <Badge className="ml-3 border-purple-200 bg-purple-50 font-bold uppercase tracking-wide text-purple-700">
                <Zap className="h-3 w-3" />
                Power Play
              </Badge>
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
  onNoBall,
  disabled,
}: {
  onBall: (e: BallEvent) => void
  onWicket: () => void
  /** Open the no-ball dialog (lets the scorer optionally enter runs off the
   *  bat + byes/leg-byes). The common case (just +1 no-ball) is the default
   *  in the dialog, so the scorer can confirm immediately. */
  onNoBall: () => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-xl border p-3 sm:p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Score this ball
      </div>
      {/* Run buttons — 3 columns on mobile (big touch targets), 6 on desktop */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 sm:gap-2">
        {RUN_BUTTONS.map((r) => {
          const isDot = r === 0
          const isBoundary = r === 4 || r === 6
          return (
            <Button
              key={r}
              variant={isBoundary ? "default" : "outline"}
              className={cn(
                "h-16 text-2xl font-extrabold tabular-nums transition-transform active:scale-95 sm:h-12 sm:text-lg",
                isDot && "text-muted-foreground",
                r === 4 && "bg-sky-600 text-white hover:bg-sky-700",
                r === 6 && "bg-fuchsia-600 text-white hover:bg-fuchsia-700",
              )}
              disabled={disabled}
              onClick={() => onBall({ kind: "run", runs: r })}
            >
              {isDot ? "•" : r}
            </Button>
          )
        })}
      </div>
      {/* Extras + Wicket — bigger buttons for touch */}
      <div className="mt-2.5 grid grid-cols-3 gap-2.5 sm:gap-2">
        <Button
          variant="outline"
          className="h-14 gap-1 text-sm font-bold transition-transform active:scale-95 sm:h-10"
          disabled={disabled}
          onClick={() => onBall({ kind: "wide" })}
        >
          Wide
        </Button>
        <Button
          variant="outline"
          className="h-14 gap-1 text-sm font-bold transition-transform active:scale-95 sm:h-10"
          disabled={disabled}
          onClick={onNoBall}
        >
          No Ball
        </Button>
        <Button
          variant="default"
          className="h-14 gap-1 bg-red-600 text-sm font-bold hover:bg-red-700 transition-transform active:scale-95 sm:h-10"
          disabled={disabled}
          onClick={onWicket}
        >
          Wicket
        </Button>
      </div>
      {/* Keyboard shortcuts — hidden on small screens (touch doesn't need them) */}
      <p className="mt-3 hidden text-xs text-muted-foreground sm:block">
        Keyboard:{" "}
        <code className="rounded bg-muted px-1 py-0.5">0–6</code> runs ·{" "}
        <code className="rounded bg-muted px-1 py-0.5">.</code> dot ·{" "}
        <code className="rounded bg-muted px-1 py-0.5">w</code> wicket ·{" "}
        <code className="rounded bg-muted px-1 py-0.5">e</code> swap ·{" "}
        <code className="rounded bg-muted px-1 py-0.5">u</code> undo ·{" "}
        <code className="rounded bg-muted px-1 py-0.5">s</code> save ·{" "}
        <code className="rounded bg-muted px-1 py-0.5">⇧W</code> wide ·{" "}
        <code className="rounded bg-muted px-1 py-0.5">⇧N</code> no-ball ·{" "}
        <code className="rounded bg-muted px-1 py-0.5">⇧B</code> bye ·{" "}
        <code className="rounded bg-muted px-1 py-0.5">⇧L</code> leg-bye
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
  // (`BOWLER_CREDITED_WICKETS` already excludes retiredOut / retiredHurt /
  // runout, so the extra guard is belt-and-braces — kept for clarity.)
  const freeHitWillReject =
    !!freeHit &&
    BOWLER_CREDITED_WICKETS.has(wicketType) &&
    wicketType !== "retiredOut"

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
                <p className="text-xs text-muted-foreground">
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

/* ---------- No-ball dialog: optional runs off the bat + byes/leg-byes ---------- */

const NO_BALL_RUN_OPTIONS = [0, 1, 2, 3, 4, 6] as const

function NoBallDialog({
  open,
  onOpenChange,
  striker,
  freeHit,
  limitedOvers,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  striker: { id: string; name: string }
  /** True when the current ball is a free hit (rare — a no-ball during a
   *  free hit keeps the free hit pending). Just drives a banner hint. */
  freeHit?: boolean
  /** True for limited-overs matches (maxOvers > 0) — the no-ball triggers a
   *  free hit on the next legal delivery. Drives the banner hint. */
  limitedOvers?: boolean
  onConfirm: (ev: {
    kind: "noball"
    runsOffBat: number
    byes: number
    legByes: number
  }) => void
}) {
  // Runs off the bat — default 0 (the common case: just the +1 no-ball
  // penalty). Picked from the same options as the run buttons (0/1/2/3/4/6).
  const [runsOffBat, setRunsOffBat] = useState<number>(0)
  // Byes / leg-byes off the no-ball — rare. Default 0.
  const [byes, setByes] = useState<number>(0)
  const [legByes, setLegByes] = useState<number>(0)
  // Note: this component is conditionally rendered by the parent only when
  // `noballOpen` is true, so it remounts fresh each time — useState initial
  // values act as the "reset on open".

  const totalRuns = 1 + runsOffBat + byes + legByes

  function handleConfirm() {
    onConfirm({
      kind: "noball",
      runsOffBat,
      byes,
      legByes,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-600 text-white">
              <CircleDot className="h-4 w-4" />
            </span>
            No Ball
          </DialogTitle>
          <DialogDescription>
            A no-ball concedes +1 (against the bowler) and the next legal ball
            {limitedOvers ? " is a free hit." : " is re-bowled."} Optionally
            enter runs scored off the bat (e.g. a four hit off a no-ball) —
            these go to {striker.name} and against the bowler. Byes/leg-byes
            are rare on a no-ball.
          </DialogDescription>
        </DialogHeader>

        {/* Free-hit banner — shown when the current ball is already a free
            hit (a no-ball during a free hit keeps it pending) OR when this
            no-ball will trigger a free hit (limited-overs). */}
        {(freeHit || limitedOvers) && (
          <div className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/40">
            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" />
              {freeHit ? "Free hit in effect" : "Free hit next ball"}
            </div>
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              {freeHit
                ? "This no-ball was bowled during a free hit — the free hit carries over to the next legal delivery."
                : "The next LEGAL delivery will be a free hit. Bowler-credited dismissals (bowled/caught/lbw/stumped/hit-wkt) won't be allowed."}
            </p>
          </div>
        )}

        <div className="grid gap-3 py-2">
          {/* Runs off the bat — same button grid as the run pad */}
          <div className="grid gap-1.5">
            <Label>
              Runs off the bat <span className="text-muted-foreground">(default 0)</span>
            </Label>
            <div className="grid grid-cols-6 gap-1.5">
              {NO_BALL_RUN_OPTIONS.map((r) => {
                const isDot = r === 0
                const isBoundary = r === 4 || r === 6
                const selected = runsOffBat === r
                return (
                  <Button
                    key={r}
                    type="button"
                    variant={selected ? "default" : "outline"}
                    className={cn(
                      "h-10 text-base font-extrabold tabular-nums transition-transform active:scale-95",
                      isBoundary && !selected && "border-sky-400 text-sky-700",
                      r === 4 && selected && "bg-sky-600 text-white hover:bg-sky-700",
                      r === 6 && selected && "bg-fuchsia-600 text-white hover:bg-fuchsia-700",
                    )}
                    onClick={() => setRunsOffBat(r)}
                  >
                    {isDot ? "0" : r}
                  </Button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Goes to {striker.name}&apos;s runs + balls faced, and against the bowler.
            </p>
          </div>

          {/* Byes / leg-byes — rare on a no-ball */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="noball-byes">
                Byes <span className="text-muted-foreground">(rare)</span>
              </Label>
              <Input
                id="noball-byes"
                type="number"
                min={0}
                max={6}
                value={byes}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setByes(Number.isFinite(v) && v >= 0 ? Math.min(v, 6) : 0)
                }}
                className="h-9 tabular-nums"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="noball-legbyes">
                Leg-byes <span className="text-muted-foreground">(rare)</span>
              </Label>
              <Input
                id="noball-legbyes"
                type="number"
                min={0}
                max={6}
                value={legByes}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setLegByes(Number.isFinite(v) && v >= 0 ? Math.min(v, 6) : 0)
                }}
                className="h-9 tabular-nums"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Byes/leg-byes go to the innings total + extras breakdown, but NOT
            against the bowler and NOT as balls faced.
          </p>

          {/* Live total preview */}
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Total runs on this ball
            </div>
            <div className="mt-1 font-mono text-sm">
              +1 (no-ball)
              {runsOffBat > 0 && (
                <span className="text-emerald-700 dark:text-emerald-300">
                  {" "}+ {runsOffBat} (off bat)
                </span>
              )}
              {byes > 0 && (
                <span className="text-amber-700 dark:text-amber-300">
                  {" "}+ {byes} (byes)
                </span>
              )}
              {legByes > 0 && (
                <span className="text-amber-700 dark:text-amber-300">
                  {" "}+ {legByes} (leg-byes)
                </span>
              )}
              {" "}= <span className="font-bold">{totalRuns}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="gap-1.5 bg-amber-600 text-white hover:bg-amber-700"
          >
            <CircleDot className="h-4 w-4" />
            Confirm no ball ({totalRuns} run{totalRuns !== 1 ? "s" : ""})
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
  teamId,
  onQuickAdd,
}: {
  title: string
  players: { id: string; name: string }[]
  placeholder: string
  onPick: (id: string) => void
  confirmLabel?: string
  teamId?: string
  onQuickAdd?: (name: string, teamId: string, onPick: (id: string) => void) => void
}) {
  const [val, setVal] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState("")
  const [adding, setAdding] = useState(false)
  const selected = players.find((p) => p.id === val)

  async function handleAdd() {
    if (!addName.trim() || !teamId || !onQuickAdd) return
    setAdding(true)
    // The parent's onQuickAdd creates the player + calls onPick with the
    // new ID, which auto-selects them.
    onQuickAdd(addName.trim(), teamId, (id) => {
      setVal(id)
      setShowAdd(false)
      setAddName("")
    })
    setAdding(false)
  }

  return (
    <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:bg-amber-950/40">
      <div className="mb-2 flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <Plus className="h-4 w-4" />
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      </div>
      {players.length === 0 && !onQuickAdd ? (
        <div className="rounded-md border border-dashed bg-amber-100/60 px-3 py-4 text-center text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          No eligible players left in the squad.
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

          {/* Quick add player — inline form */}
          {onQuickAdd && (
            <div className="mt-2">
              {!showAdd ? (
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Add player not in list
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="Player name"
                    className="h-8 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && addName.trim()) handleAdd()
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={!addName.trim() || adding}
                    onClick={handleAdd}
                  >
                    {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Add
                  </Button>
                  <button
                    onClick={() => { setShowAdd(false); setAddName("") }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

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

function CommentaryFeed({
  state,
  onJumpToBall,
}: {
  state: LiveMatchState
  /** Click a past ball entry to jump the scoring state back to right after
   *  that ball was scored (bounded undo — uses the existing history stack,
   *  no snapshot+replay). Only ball-type entries (run/boundary/six/wicket/
   *  extra/dot) are clickable; info/over/manual entries are not. */
  onJumpToBall?: (commentaryId: string) => void
}) {
  // Ball-entry kinds are clickable (jump-to-ball). Computed once per render.
  const BALL_KINDS = new Set([
    "run",
    "boundary",
    "six",
    "wicket",
    "extra",
    "dot",
  ])
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <CircleDot className="h-3.5 w-3.5 text-red-600" />
        <h3 className="text-xs font-extrabold uppercase tracking-wide">
          Live Commentary
        </h3>
        {onJumpToBall && (
          <span className="ml-auto text-[10px] font-medium text-muted-foreground">
            Click a past ball to jump back
          </span>
        )}
      </div>
      <div className="max-h-64 space-y-1.5 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        {state.commentary.map((c) => {
          const isManual = c.kind === "manual"
          const isBallEntry = BALL_KINDS.has(c.kind)
          const canJump = !!onJumpToBall && isBallEntry
          return (
            <div
              key={c.id}
              className={cn(
                "flex gap-2 text-xs",
                isManual && "border-l-2 border-blue-500 bg-blue-50/40 pl-2 dark:bg-blue-950/20",
                canJump &&
                  "cursor-pointer rounded-md transition-colors hover:bg-muted/60"
              )}
              onClick={canJump ? () => onJumpToBall?.(c.id) : undefined}
              title={canJump ? "Click to jump back to this ball" : undefined}
              role={canJump ? "button" : undefined}
              tabIndex={canJump ? 0 : undefined}
              onKeyDown={
                canJump
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onJumpToBall?.(c.id)
                      }
                    }
                  : undefined
              }
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
                  c.kind === "ai" && "italic text-foreground/80",
                  isManual && "text-foreground"
                )}
              >
                {isManual && (
                  <span className="mr-1 inline-block rounded bg-blue-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white align-middle">
                    Commentator
                  </span>
                )}
                {c.kind === "ai" && (
                  <span className="mr-1 inline-block rounded bg-slate-700 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white align-middle">
                    AI
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
                  <>
                    {c.text}
                    {c.kind === "ai" && c.audioUrl && (
                      <audio
                        controls
                        src={c.audioUrl}
                        preload="none"
                        className="mt-1 h-7 w-full max-w-[240px]"
                      />
                    )}
                  </>
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
      <p className="mt-1.5 text-xs font-medium text-blue-600/70 dark:text-blue-400/70">
        Broadcasts instantly to all viewers on the Live tab. Press{" "}
        <code className="rounded bg-blue-100 px-1 py-0.5 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Enter</code> to send.
      </p>
    </div>
  )
}
