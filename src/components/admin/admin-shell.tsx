"use client"

import * as React from "react"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import {
  LayoutDashboard,
  FileText,
  Activity,
  UserSearch,
  Users,
  Trophy,
  Radio,
  PanelRight,
  Plus,
} from "lucide-react"
import type { ViewKey } from "@/lib/types"

interface AdminShellProps {
  title: string
  count?: number
  actionLabel?: string
  onAction?: () => void
  children: React.ReactNode
}

const navItems: { label: string; view: ViewKey; icon: React.ElementType }[] = [
  { label: "Dashboard", view: "admin-dashboard", icon: LayoutDashboard },
  { label: "Articles", view: "admin-articles", icon: FileText },
  { label: "Matches", view: "admin-matches", icon: Activity },
  { label: "Live Scorer", view: "live-scorer", icon: Radio },
  { label: "Players", view: "admin-players", icon: UserSearch },
  { label: "Teams", view: "admin-teams", icon: Users },
  { label: "Series", view: "admin-series", icon: Trophy },
  { label: "Sidebar", view: "admin-sidebar", icon: PanelRight },
]

export function AdminShell({
  title,
  count,
  actionLabel,
  onAction,
  children,
}: AdminShellProps) {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile horizontal nav */}
      <div className="lg:hidden -mx-3 px-3">
        <div className="flex gap-1 overflow-x-auto pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = view === item.view
            return (
              <Button
                key={item.view}
                size="sm"
                variant={active ? "default" : "outline"}
                className="shrink-0 gap-1.5"
                onClick={() => navigate(item.view)}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:sticky lg:top-20 self-start">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground font-extrabold text-lg">
                c
              </span>
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  CMS
                </div>
                <div className="text-sm font-semibold">Admin Console</div>
              </div>
            </div>
          </div>
          <nav className="mt-3 flex flex-col gap-1 rounded-xl border bg-card p-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = view === item.view
              return (
                <button
                  key={item.view}
                  onClick={() => navigate(item.view)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              )
            })}
          </nav>
          <p className="mt-3 px-2 text-[11px] text-muted-foreground">
            Admin mode — changes are live
          </p>
        </aside>

        {/* Main */}
        <section className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            {typeof count === "number" && (
              <Badge variant="secondary" className="rounded-full">
                {count}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              {actionLabel && onAction && (
                <Button onClick={onAction} size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  {actionLabel}
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-4">{children}</div>
        </section>
      </div>

      {/* Sonner toaster scoped to admin views */}
      <SonnerToaster richColors position="top-right" />
    </div>
  )
}
