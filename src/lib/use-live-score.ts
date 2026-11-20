"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { LiveMatchState } from "./scoring"
import { api } from "./api"

/**
 * Subscribe to a match's live scoring state and (for the operator) push new
 * states as balls are scored. Connects to the score-service mini service via
 * the Caddy gateway using the XTransformPort query param.
 *
 * @param matchId  The match being scored (null when none is selected).
 * @param token    The signed scorer session token. Sent with every
 *                 `operator:state` / `operator:clear` emit so the
 *                 score-service can verify the scorer is permitted to write
 *                 to this match (token carries their tournamentIds).
 *                 Pass null when not authenticated — emits will be no-ops.
 *
 * Returns:
 *   - liveState:       the current cached match state (null if none)
 *   - connected:       whether the WebSocket is currently connected
 *   - stateReceived:   whether we've received the FIRST state event after
 *                      mounting/subscribing. Used by the live scorer to
 *                      distinguish "reconnecting — don't show setup screen
 *                      yet" from "server confirmed no state — show setup".
 *                      Resets to false whenever matchId changes.
 *   - pushState:       operator-only — broadcast a new state
 *   - clearState:      operator-only — clear the cached state
 */
export function useLiveScore(matchId: string | null, token: string | null) {
  const [liveState, setLiveState] = useState<LiveMatchState | null>(null)
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  // Tracks whether we've received the initial state snapshot after
  // subscribing. Without this, the scorer sees a flash of the setup screen
  // every time it navigates away + back (liveState is null for the brief
  // window between mount and the first `state` event arriving).
  const [stateReceived, setStateReceived] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const tokenRef = useRef<string | null>(token)
  // Buffer for the latest state when disconnected — on reconnect, the
  // buffered state is flushed so no scoring data is lost during brief
  // network outages (common at cricket grounds with spotty WiFi).
  const bufferedStateRef = useRef<LiveMatchState | null>(null)
  // Tracks whether we've already attempted the DB fallback for the current
  // subscription. When the score-service cache is empty (right after a deploy
  // / restart), the initial `state` event arrives as null — we then fall back
  // to the match's persisted liveStateJson in the DB so viewers don't see
  // "waiting for scorer" indefinitely when the state is actually saved. Only
  // attempted ONCE per matchId; later null emits (scorer cleared the cache)
  // are honored as null.
  const dbFallbackAttemptedRef = useRef(false)
  // True once a non-null live state has arrived from the score-service. Guards
  // the DB fallback against a race where the scorer reconnects + broadcasts
  // while the DB fetch is still in-flight — in that case we prefer the live
  // snapshot and discard the (older) DB snapshot.
  const gotLiveStateRef = useRef(false)

  // Keep the latest token available to pushState/clearState without forcing
  // a socket reconnect on every token change.
  useEffect(() => {
    tokenRef.current = token
  }, [token])

  useEffect(() => {
    if (!matchId) return
    dbFallbackAttemptedRef.current = false
    gotLiveStateRef.current = false
    // Guard the async DB fallback: if matchId changes (or the component
    // unmounts) while the fetch is in-flight, bail before updating state so we
    // don't flash the previous match's snapshot into the new subscription.
    let cancelled = false
    queueMicrotask(() => {
      setStateReceived(false)
      setLiveState(null)
    })

    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity, // never give up — scorers need persistence
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000, // cap backoff at 5 seconds
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on("connect", () => {
      setConnected(true)
      setReconnecting(false)
      socket.emit("subscribe", matchId)
      // Flush buffered state if any was queued while disconnected
      if (bufferedStateRef.current) {
        const tok = tokenRef.current
        if (tok) {
          socket.emit("operator:state", { matchId, state: bufferedStateRef.current, token: tok })
        }
        bufferedStateRef.current = null
      }
    })
    socket.on("disconnect", () => {
      setConnected(false)
      setReconnecting(true)
    })
    socket.io.on("reconnect_attempt", () => setReconnecting(true))
    socket.io.on("reconnect_failed", () => setReconnecting(true))
    socket.on("state", async (payload: { matchId: string; state: unknown }) => {
      if (payload.matchId !== matchId) return
      const incoming = (payload.state as LiveMatchState | null) ?? null
      if (incoming) {
        // Live state from the score-service — use it directly. This takes
        // over from any DB fallback snapshot once the scorer reconnects and
        // broadcasts (the live state is always newer than the persisted copy).
        gotLiveStateRef.current = true
        setLiveState(incoming)
        setStateReceived(true)
        return
      }
      // Null state. If this is the INITIAL snapshot (the score-service cache
      // is empty, e.g. right after a deploy/restart), fall back to the match's
      // persisted liveStateJson in the DB so viewers don't see "waiting for
      // scorer" indefinitely when the state is actually saved in the DB. Only
      // attempted ONCE per subscription — subsequent null emits (the scorer
      // cleared the cache) are honored as null.
      if (dbFallbackAttemptedRef.current) {
        setLiveState(null)
        setStateReceived(true)
        return
      }
      dbFallbackAttemptedRef.current = true
      try {
        const m = await api.matches.get(matchId)
        // If a live state arrived while the DB fetch was in-flight (or the
        // subscription was torn down), prefer the live snapshot / bail — don't
        // overwrite with the (older) persisted snapshot.
        if (cancelled || gotLiveStateRef.current) return
        const persisted = m?.liveStateJson
        if (persisted) {
          const parsed = JSON.parse(persisted) as LiveMatchState
          setLiveState(parsed)
        } else {
          // liveStateJson empty — no state has ever been persisted for this
          // match. Keep showing "waiting for scorer" as before.
          setLiveState(null)
        }
        setStateReceived(true)
      } catch {
        // Fetch failed or liveStateJson unparseable — keep "waiting".
        if (cancelled || gotLiveStateRef.current) return
        setLiveState(null)
        setStateReceived(true)
      }
    })

    return () => {
      cancelled = true
      socket.emit("unsubscribe", matchId)
      socket.disconnect()
      socketRef.current = null
      bufferedStateRef.current = null
    }
  }, [matchId])

  /** Operator: broadcast a new full state to all subscribers.
   *  If the socket is disconnected, the state is buffered and flushed
   *  on reconnect — no scoring data is lost during network outages. */
  const pushState = useCallback(
    (state: LiveMatchState) => {
      const socket = socketRef.current
      if (!socket || !matchId) return
      const tok = tokenRef.current
      if (!tok) return
      if (socket.connected) {
        socket.emit("operator:state", { matchId, state, token: tok })
      } else {
        // Buffer the latest state — will be flushed on reconnect.
        // Only the latest matters since pushState sends the FULL state
        // (not incremental balls), so intermediate states are redundant.
        bufferedStateRef.current = state
      }
    },
    [matchId]
  )

  const clearState = useCallback(() => {
    const socket = socketRef.current
    if (!socket || !matchId) return
    const tok = tokenRef.current
    if (!tok) return
    bufferedStateRef.current = null
    if (socket.connected) {
      socket.emit("operator:clear", { matchId, token: tok })
    }
  }, [matchId])

  return { liveState, connected, reconnecting, stateReceived, pushState, clearState }
}
