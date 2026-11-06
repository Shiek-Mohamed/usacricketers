"use client"

import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Radio,
  LogOut,
  ListChecks,
  CloudRain,
  Sparkles,
  Settings,
  Users,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey } from "@/lib/types"

/** Scorer sidebar navigation — CricClubs-style vertical menu. */
const SCORER_NAV: {
  label: string
  view: ViewKey
  icon: React.ElementType
  comingSoon?: boolean
}[] = [
  { label: "My Matches", view: "scorer-home", icon: ListChecks },
  { label: "DLS Calculator", view: "dls", icon: CloudRain },
  { label: "Player Rankings", view: "rankings", icon: BarChart3 },
  { label: "My Profile", view: "scorer-home", icon: Settings, comingSoon: true },
  { label: "Pricing", view: "pricing", icon: Sparkles },
]

export function ScorerShell({
  title,
  children,
}: {
  title: string
  count?: number
  actionLabel?: string
  onAction?: () => void
  children: React.ReactNode
}) {
  const exitScorerMode = useAppStore((s) => s.exitScorerMode)
  const navigate = useAppStore((s) => s.navigate)
  const view = useAppStore((s) => s.view)

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      {/* Sidebar (desktop) / top bar (mobile) */}
      <aside className="sticky top-0 z-50 w-full shrink-0 border-b bg-[#1e2a5e] text-white md:h-screen md:w-52 md:border-b-0 md:border-r">
        {/* Logo + badge + exit */}
        <div className="flex items-center justify-between px-4 py-3 md:flex-col md:items-start md:gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-red-400" />
            <span className="font-extrabold text-sm tracking-tight">usacricketers</span>
          </div>
          <Badge className="bg-red-600 text-white md:mt-1">Scorer Mode</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={exitScorerMode}
            className="gap-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 md:mt-3 md:w-full md:justify-start"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit Scorer
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-y-auto md:pb-4">
          {SCORER_NAV.map((item) => {
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
        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
          <h1 className="mb-4 text-xl font-bold tracking-tight">{title}</h1>
          <div className="space-y-4">{children}</div>
        </div>
      </main>
    </div>
  )
}
