"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import type { LiveMatchState } from "./scoring"

/* ─── localStorage backup for live scoring state ───
 * The score-service caches live state in MEMORY. If it restarts (every
 * fly.io deploy), the cache is wiped + the scorer sees the setup screen.
 * To recover, we keep a backup copy in the scorer's localStorage. When the
 * score-service sends { state: null } after a restart, the scorer
 * automatically re-pushes the local backup — restoring the session without
 * the scorer losing any balls.
 *
 * Key:   `live-score:${matchId}`
 * Value: `{ state: LiveMatchState, savedAt: number }`
 * Freshness: entries older than 4 hours are ignored (stale session).
 */
const LOCAL_BACKUP_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours — matches can span a full day

function saveLocalBackup(matchId: string, state: LiveMatchState) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      `live-score:${matchId}`,
      JSON.stringify({ state, savedAt: Date.now() }),
    )
  } catch {
    // localStorage might be full or disabled (private browsing) — silently
    // skip. The DB persist (via the scorer's persist function) is the
    // primary save path.
  }
}

export function loadLocalBackup(matchId: string): LiveMatchState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(`live-score:${matchId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state: LiveMatchState; savedAt: number }
    if (Date.now() - parsed.savedAt > LOCAL_BACKUP_TTL_MS) {
      window.localStorage.removeItem(`live-score:${matchId}`)
      return null
    }
    // Only restore live sessions — completed/abandoned matches don't need
    // a backup (the final scorecard is in the DB).
    if (parsed.state.status !== "live") return null
    return parsed.state
  } catch {
    return null
  }
}

function clearLocalBackup(matchId: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(`live-score:${matchId}`)
  } catch {
    // ignore
  }
}

/**
 * useLiveScoreBackup — keeps a localStorage copy of the live scoring state
 * and auto-restores it when the score-service's in-memory cache is empty
 * (which happens after every fly.io deploy restarts the score-service).
 *
 * Call this hook at the TOP of the scorer component (before any early
 * returns) so React's rules-of-hooks are satisfied.
 *
 * - SAVE: whenever `liveState` changes, writes a backup to localStorage.
 * - RESTORE: when the server confirms no cached state (`stateReceived` &&
 *   !`liveState`), checks localStorage + re-pushes the backup via
 *   `pushState`. Only restores "live" sessions younger than 4 hours.
 * - CLEANUP: clears the backup when the match completes.
 */
export function useLiveScoreBackup(
  matchId: string | null,
  token: string | null,
  liveState: LiveMatchState | null,
  stateReceived: boolean,
  pushState: (state: LiveMatchState) => void,
) {
  // SAVE: write to localStorage whenever liveState changes.
  useEffect(() => {
    if (liveState && matchId) saveLocalBackup(matchId, liveState)
  }, [liveState, matchId])

  // RESTORE: on cache miss (score-service restarted), re-push from backup.
  // Tracks which matchId we've attempted restore for, so switching matches
  // resets the guard (allows restore for the new match).
  const restoreAttemptedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!matchId || !token || !pushState) return
    if (!stateReceived || liveState) return
    if (restoreAttemptedForRef.current === matchId) return
    restoreAttemptedForRef.current = matchId

    const backup = loadLocalBackup(matchId)
    if (!backup) return
    pushState(backup)
    toast.success("Restored live scoring session from backup", {
      description:
        "The scoring service restarted — your session was recovered from this browser.",
    })
  }, [matchId, token, pushState, stateReceived, liveState])

  // CLEANUP: clear the backup when the match completes (final scorecard
  // is in the DB — no need to keep the live session backup).
  useEffect(() => {
    if (matchId && liveState?.status === "completed") {
      clearLocalBackup(matchId)
    }
  }, [matchId, liveState?.status])
}
