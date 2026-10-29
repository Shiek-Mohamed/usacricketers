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
  DownloadCloud,
  Images,
  Plus,
  UserCog,
  Play,
  Megaphone,
  Upload,
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
  { label: "Tournaments", view: "admin-series", icon: Trophy },
  { label: "Scorers", view: "admin-scorers", icon: UserCog },
  { label: "League Admins", view: "admin-league-admins", icon: Trophy },
  { label: "Sidebar", view: "admin-sidebar", icon: PanelRight },
  { label: "Import", view: "admin-import", icon: DownloadCloud },
  { label: "Import League", view: "admin-import-league", icon: Upload },
  { label: "Galleries", view: "admin-galleries", icon: Images },
  { label: "Videos", view: "admin-videos", icon: Play },
  { label: "Banners", view: "admin-banners", icon: Megaphone },
]

/** Grouped sidebar layout — 3 sections for less visual noise on long lists. */
const navGroups: { title: string; views: Set<ViewKey> }[] = [
  { title: "Cricket", views: new Set<ViewKey>(["admin-matches", "live-scorer", "admin-players", "admin-teams", "admin-series"]) },
  { title: "Content", views: new Set<ViewKey>(["admin-articles", "admin-galleries", "admin-videos", "admin-banners", "admin-sidebar", "admin-import", "admin-import-league"]) },
  { title: "System", views: new Set<ViewKey>(["admin-scorers", "admin-league-admins"]) },
]

function getGroup(view: ViewKey): string {
  for (const g of navGroups) if (g.views.has(view)) return g.title
  return "Overview"
}

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
      {/* Mobile horizontal nav — grouped by section, scrollable */}
      <div className="lg:hidden -mx-3 px-3">
        <div className="flex gap-1 overflow-x-auto pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
          {/* Dashboard first (always visible), then grouped sections */}
          {(() => {
            const dash = navItems.find((i) => i.view === "admin-dashboard")!
            const Icon = dash.icon
            const active = view === dash.view
            return (
              <Button
                key={dash.view}
                size="sm"
                variant={active ? "default" : "outline"}
                className="shrink-0 gap-1.5"
                onClick={() => navigate(dash.view)}
              >
                <Icon className="h-3.5 w-3.5" />
                {dash.label}
              </Button>
            )
          })()}
          {navGroups.map((group) => (
            <div key={group.title} className="flex items-center gap-1 shrink-0">
              <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </span>
              {navItems
                .filter((i) => group.views.has(i.view))
                .map((item) => {
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
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar — grouped with section headings */}
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
          <nav className="mt-3 flex flex-col gap-3 rounded-xl border bg-card p-2">
            {/* Dashboard — always at top, outside groups */}
            {(() => {
              const dash = navItems.find((i) => i.view === "admin-dashboard")!
              const Icon = dash.icon
              const active = view === dash.view
              return (
                <button
                  onClick={() => navigate(dash.view)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {dash.label}
                </button>
              )
            })()}
            {/* Grouped sections */}
            {navGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-0.5">
                <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </div>
                {navItems
                  .filter((i) => group.views.has(i.view))
                  .map((item) => {
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
              </div>
            ))}
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
