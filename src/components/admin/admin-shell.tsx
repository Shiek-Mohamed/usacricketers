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
  MessageSquare,
  ShieldCheck,
  AlertCircle,
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
  { label: "Feedback", view: "admin-feedback", icon: MessageSquare },
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
  { title: "System", views: new Set<ViewKey>(["admin-scorers", "admin-league-admins", "admin-feedback"]) },
]

/** Active nav button — emerald-tinted bg + left accent bar + emerald text. */
const activeNavCls =
  "relative bg-emerald-50 text-emerald-700 font-semibold ring-1 ring-inset ring-emerald-200 " +
  "before:absolute before:left-0 before:top-1/2 before:h-5 before:-translate-y-1/2 before:w-1 before:rounded-full before:bg-emerald-500"
const idleNavCls = "relative hover:bg-accent text-foreground"

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
          {(() => {
            const dash = navItems.find((i) => i.view === "admin-dashboard")!
            const Icon = dash.icon
            const active = view === dash.view
            return (
              <Button
                key={dash.view}
                size="sm"
                variant={active ? "default" : "outline"}
                className={cn(
                  "shrink-0 gap-1.5",
                  active && "bg-emerald-600 text-white hover:bg-emerald-700",
                )}
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
                      className={cn(
                        "shrink-0 gap-1.5",
                        active && "bg-emerald-600 text-white hover:bg-emerald-700",
                      )}
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
        {/* Desktop sidebar — branded, navy section headers, emerald active */}
        <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:sticky lg:top-16 self-start">
          {/* Brand header */}
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-400 text-[#1e2a5e]">
                <ShieldCheck className="h-4 w-4" />
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
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? activeNavCls : idleNavCls,
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {dash.label}
                </button>
              )
            })()}
            {navGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-0.5">
                <div className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1e2a5e]/70">
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
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                          active ? activeNavCls : idleNavCls,
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
        </aside>

        {/* Main */}
        <section className="flex-1 min-w-0 space-y-4">
          {/* Persistent admin-mode banner — critical safety info */}
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Admin mode — changes are live on the public site
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            {typeof count === "number" && (
              <Badge variant="secondary" className="rounded-full">
                {count}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              {actionLabel && onAction && (
                <Button onClick={onAction} size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
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
