"use client"

import { useEffect, useState } from "react"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { useAppStore } from "@/lib/store"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy } from "lucide-react"
import type { Series } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * LeagueSwitcher — dropdown at the top of league-admin views that lets the
 * admin quickly switch between their leagues without going back to the
 * dashboard. Stays on the same view (e.g., still in "Matches") but
 * reloads with the new league's data.
 *
 * Pattern: standard SaaS "workspace/account switcher" — same as Slack
 * workspaces, GitHub orgs, Stripe accounts, Vercel projects.
 *
 * Visibility rules:
 *   • 0 leagues → hidden (nothing to switch)
 *   • 1 league → hidden (no switching needed)
 *   • 2+ leagues → shown
 *
 * On select: calls navigate(currentView, newSeriesId) which keeps the
 * same view in the Zustand store but updates the id — the view's
 * useEffect on `id` re-runs + refetches the new league's data.
 */
async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

const SUPPORTED_VIEWS = new Set([
  "league-admin-matches",
  "league-admin-scorers",
  "league-admin-series-edit",
])

export function LeagueSwitcher({ className }: { className?: string }) {
  const session = useLeagueAdminSession((s) => s.session)
  const token = session?.token ?? null
  const currentId = useAppStore((s) => s.id)
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)

  const [series, setSeries] = useState<Series[] | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch the admin's full series list (with names + formats + seasons)
  // so the dropdown can show meaningful labels — the session only stores
  // series IDs (managedSeriesIds), not the full objects.
  useEffect(() => {
    if (!token) {
      setSeries(null)
      return
    }
    let active = true
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/league-admin/series", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await jsonOrThrow<Series[]>(res)
        if (active) setSeries(data)
      } catch {
        if (active) setSeries([])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [token])

  // Don't render the switcher if:
  //   - the current view isn't a league-admin sub-view (e.g., it's the dashboard)
  //   - the admin has 0 or 1 leagues (no switching possible/needed)
  //   - still loading (show a skeleton, then decide whether to render)
  if (!SUPPORTED_VIEWS.has(view)) return null
  if (loading) {
    return (
      <div className={cn("mb-4 flex items-center gap-2", className)}>
        <Trophy className="h-4 w-4 text-red-600" aria-hidden="true" />
        <Skeleton className="h-9 w-[280px] rounded-md" />
      </div>
    )
  }
  if (!series || series.length <= 1) return null

  const current = series.find((s) => s.id === currentId)

  return (
    <div className={cn("mb-4 flex items-center gap-2", className)}>
      <Trophy
        className="h-4 w-4 shrink-0 text-red-600"
        aria-hidden="true"
      />
      <Select
        value={currentId ?? undefined}
        onValueChange={(newId) => {
          // Stay on the same view, just switch the league ID —
          // the view's useEffect on `id` re-runs + refetches.
          if (SUPPORTED_VIEWS.has(view)) {
            navigate(view, newId)
          }
        }}
      >
        <SelectTrigger
          className="w-[280px]"
          aria-label="Switch league"
        >
          <SelectValue placeholder="Select a league">
            {current ? (
              <span className="truncate">
                {current.name}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  · {current.format}
                </span>
              </span>
            ) : (
              "Select a league"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {series.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.format} · {s.season}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
