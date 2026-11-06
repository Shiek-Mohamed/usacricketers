"use client"

import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Radio, LogOut, ListChecks, CloudRain, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ViewKey } from "@/lib/types"

/** Scorer-specific navigation items. */
const SCORER_NAV: { label: string; view: ViewKey; icon: React.ElementType }[] = [
  { label: "My Matches", view: "scorer-home", icon: ListChecks },
  { label: "DLS Calculator", view: "dls", icon: CloudRain },
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Scorer top bar */}
      <header className="sticky top-0 z-50 border-b bg-[#1e2a5e] text-white">
        {/* Row 1: wordmark + badge + exit */}
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-red-400" />
            <span className="font-extrabold text-sm tracking-tight">usacricketers</span>
            <Badge className="ml-2 bg-red-600 text-white">Scorer Mode</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={exitScorerMode}
            className="gap-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Exit Scorer
          </Button>
        </div>
        {/* Row 2: scoring navigation */}
        <nav className="flex items-center gap-1 px-4 pb-1.5">
          {SCORER_NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 font-display text-xs font-bold uppercase tracking-wide transition-colors",
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
        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
          <h1 className="mb-4 text-xl font-bold tracking-tight">{title}</h1>
          <div className="space-y-4">{children}</div>
        </div>
      </main>
    </div>
  )
}
