"use client"

import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Shield, LogOut, ArrowLeft, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Minimal wrapper for league-admin mode — a thin sticky top bar with
 * "usacricketers" wordmark + emerald "League Admin Mode" badge + Exit button.
 * NO admin sidebar, NO admin nav. Mirrors ScorerShell.
 */
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal league-admin top bar */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-[#1e2a5e] px-4 text-white">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="font-extrabold text-sm tracking-tight">
            usacricketers
          </span>
          <Badge className="ml-2 bg-emerald-600 text-white">
            League Admin Mode
          </Badge>
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
