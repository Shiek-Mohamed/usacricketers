"use client"

import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, LogOut, ArrowLeft, Plus, Home, Trophy, Users, UserCheck, CloudRain, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey } from "@/lib/types"

/** League admin navigation items. */
const ADMIN_NAV: { label: string; view: ViewKey; icon: React.ElementType }[] = [
  { label: "Dashboard", view: "league-admin-home", icon: Home },
  { label: "My Leagues", view: "league-admin-series-edit", icon: Trophy },
  { label: "Matches", view: "league-admin-matches", icon: Users },
  { label: "Scorers", view: "league-admin-scorers", icon: UserCheck },
  { label: "DLS", view: "dls", icon: CloudRain },
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* League admin top bar */}
      <header className="sticky top-0 z-50 border-b bg-[#1e2a5e] text-white">
        {/* Row 1: wordmark + badge + exit */}
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span className="font-extrabold text-sm tracking-tight">usacricketers</span>
            <Badge className="ml-2 bg-emerald-600 text-white">League Admin</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={exitLeagueAdminMode}
            className="gap-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit
          </Button>
        </div>
        {/* Row 2: admin navigation */}
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-1.5">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors",
                  view === item.view
                    ? "bg-white/15 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-3 w-3" />
                {item.label}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
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
                <Plus className="h-4 w-4" />
                {actionLabel}
              </Button>
            )}
          </div>
          <div className={cn("space-y-4")}>{children}</div>
        </div>
      </main>
    </div>
  )
}
