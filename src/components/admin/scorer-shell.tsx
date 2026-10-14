"use client"

import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Radio, LogOut } from "lucide-react"

/**
 * Minimal wrapper for scorer mode — a thin top bar with "usacricketers" +
 * "Scorer Mode" badge + Exit button. NO admin sidebar, NO admin nav.
 * Same interface as AdminShell (title + children) for easy swapping.
 */
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal scorer top bar */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-[#1e2a5e] px-4 text-white">
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
