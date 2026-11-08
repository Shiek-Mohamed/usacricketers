"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import type { Match } from "@/lib/types"

/**
 * useNotifications — browser notification manager for match events.
 *
 * Polls /api/matches every 30 seconds when enabled + permission granted.
 * Fires browser notifications when:
 *   - A match transitions from upcoming → live ("🔴 IND vs NZ is now live!")
 *   - A match transitions from live → completed ("✅ Australia won by 8 wickets")
 *
 * Usage:
 *   const { enabled, requestPermission, disable } = useNotifications()
 *
 * The `enabled` state is persisted to localStorage so the preference
 * survives page reloads. Permission is requested via the browser's native
 * Notification API.
 */

const STORAGE_KEY = "match-notifications-enabled"
const POLL_INTERVAL = 30_000 // 30 seconds

export function useNotifications() {
  // Lazy-init from localStorage + browser permission state — avoids
  // setState-in-effect by reading the initial values at useState time.
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false
    const stored = localStorage.getItem(STORAGE_KEY)
    const hasPermission = typeof Notification !== "undefined" && Notification.permission === "granted"
    return stored === "true" && hasPermission
  })
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification === "undefined") return "default"
    return Notification.permission
  })
  const prevStatusesRef = useRef<Map<string, string>>(new Map())

  // If the user previously enabled notifications but permission was revoked
  // (e.g., user cleared site settings), re-request on mount.
  useEffect(() => {
    if (typeof Notification === "undefined") return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "true" && Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        setPermission(p)
        if (p === "granted") {
          setEnabled(true)
        }
      })
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return
    const p = await Notification.requestPermission()
    setPermission(p)
    if (p === "granted") {
      setEnabled(true)
      localStorage.setItem(STORAGE_KEY, "true")
      // Fire a test notification
      new Notification("Notifications enabled 🏏", {
        body: "You'll be notified when matches go live and when results are posted.",
        icon: "/favicon.ico",
      })
    }
  }, [])

  const disable = useCallback(() => {
    setEnabled(false)
    localStorage.setItem(STORAGE_KEY, "false")
  }, [])

  // Poll for match status changes
  useEffect(() => {
    if (!enabled || permission !== "granted") return
    if (typeof Notification === "undefined") return

    let active = true

    async function checkMatches() {
      if (!active) return
      try {
        const res = await fetch("/api/matches?pageSize=20")
        if (!res.ok) return
        const matches: Match[] = await res.json()
        const now = new Map<string, string>()

        for (const m of matches) {
          now.set(m.id, m.status)
          const prev = prevStatusesRef.current.get(m.id)

          if (prev && prev !== m.status) {
            // Status changed — fire notification
            const t1 = m.team1?.shortName ?? "Team 1"
            const t2 = m.team2?.shortName ?? "Team 2"

            if (prev === "upcoming" && m.status === "live") {
              new Notification(`🔴 ${t1} vs ${t2} is LIVE!`, {
                body: `${m.format} · ${m.venue || "Match in progress"}\nTap to follow live scoring.`,
                icon: "/favicon.ico",
                tag: `live-${m.id}`,
              })
            } else if (prev === "live" && m.status === "completed") {
              const result = m.result || "Match completed"
              new Notification(`✅ ${t1} vs ${t2} — Result`, {
                body: result,
                icon: "/favicon.ico",
                tag: `result-${m.id}`,
              })
            }
          }
        }
        prevStatusesRef.current = now
      } catch {
        // Silently fail — notifications are non-critical
      }
    }

    // Initial check immediately, then poll
    checkMatches()
    const interval = setInterval(checkMatches, POLL_INTERVAL)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [enabled, permission])

  return { enabled, permission, requestPermission, disable }
}
