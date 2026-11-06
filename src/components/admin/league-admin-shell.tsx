"use client"

import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  LogOut,
  Home,
  Trophy,
  Users,
  UserCheck,
  CloudRain,
  Sparkles,
  BarChart3,
  Settings,
  CalendarDays,
  ListChecks,
  Newspaper,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey } from "@/lib/types"

/** League admin sidebar navigation — CricClubs-style vertical menu.
 *  Items with `comingSoon: true` show a "Soon" badge and aren't clickable. */
const ADMIN_NAV: {
  label: string
  view: ViewKey
  icon: React.ElementType
  comingSoon?: boolean
}[] = [
  { label: "Dashboard", view: "league-admin-home", icon: Home },
  { label: "My Leagues", view: "league-admin-series-edit", icon: Trophy },
  { label: "Schedule", view: "league-admin-matches", icon: CalendarDays },
  { label: "Scorers", view: "league-admin-scorers", icon: UserCheck },
  { label: "Teams", view: "league-admin-teams", icon: Users },
  { label: "Players", view: "league-admin-players", icon: UserCheck },
  { label: "Standings", view: "league-admin-standings", icon: BarChart3 },
  { label: "Stats & Reports", view: "league-admin-stats", icon: Newspaper },
  { label: "Officials", view: "league-admin-officials", icon: Shield },
  { label: "DLS Calculator", view: "dls", icon: CloudRain },
  { label: "Settings", view: "league-admin-settings", icon: Settings },
  { label: "Pricing", view: "pricing", icon: Sparkles },
]

export function LeagueAdminShell({
  title,
  onBack,
  actionLabel,
  onAction,
  children,
}: {
  title: string
  onBack?: () => void
  actionLabel?: string
  onAction?: () => void
  children: React.ReactNode
}) {
  const exitLeagueAdminMode = useAppStore((s) => s.exitLeagueAdminMode)
  const navigate = useAppStore((s) => s.navigate)
  const view = useAppStore((s) => s.view)

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Sidebar (desktop) / top bar (mobile) */}
      <aside className="sticky top-0 z-50 w-full shrink-0 border-b bg-[#1e2a5e] text-white md:h-screen md:w-56 md:border-b-0 md:border-r">
        {/* Logo + badge + exit */}
        <div className="flex items-center justify-between px-4 py-3 md:flex-col md:items-start md:gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span className="font-extrabold text-sm tracking-tight">usacricketers</span>
          </div>
          <Badge className="bg-emerald-600 text-white md:mt-1">League Admin</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={exitLeagueAdminMode}
            className="gap-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 md:mt-3 md:w-full md:justify-start"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit to Site
          </Button>
        </div>

        {/* Navigation — horizontal scroll on mobile, vertical on desktop */}
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-y-auto md:pb-4">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon
            const isActive = view === item.view
            return (
              <button
                key={item.label}
                onClick={() => !item.comingSoon && navigate(item.view)}
                disabled={item.comingSoon}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 font-display text-xs font-bold uppercase tracking-wide transition-colors md:w-full md:justify-start",
                  isActive && !item.comingSoon && "bg-white/15 text-white",
                  !isActive && !item.comingSoon && "text-white/60 hover:bg-white/10 hover:text-white",
                  item.comingSoon && "cursor-not-allowed text-white/30",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
                {item.comingSoon && (
                  <span className="ml-auto rounded bg-white/10 px-1 py-0.5 text-[8px] font-bold uppercase">
                    Soon
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                ← Back
              </Button>
            )}
            <h1 className="flex-1 text-xl font-bold tracking-tight text-[#1e2a5e] sm:text-2xl">
              {title}
            </h1>
            {actionLabel && onAction && (
              <Button
                size="sm"
                onClick={onAction}
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                + {actionLabel}
              </Button>
            )}
          </div>
          <div className="space-y-4">{children}</div>
        </div>
      </main>
    </div>
  )
}
