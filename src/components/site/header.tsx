"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Menu,
  Search,
  Shield,
  Trophy,
  Users,
  UserSearch,
  CalendarDays,
  Newspaper,
  BarChart3,
  Home,
  Activity,
  Mic,
} from "lucide-react"
import type { ViewKey } from "@/lib/types"

const navItems: { label: string; view: ViewKey; icon: React.ElementType }[] = [
  { label: "Home", view: "home", icon: Home },
  { label: "Live", view: "matches", icon: Activity },
  { label: "Series", view: "series", icon: Trophy },
  { label: "Teams", view: "teams", icon: Users },
  { label: "Players", view: "players", icon: UserSearch },
  { label: "Stats", view: "stats", icon: BarChart3 },
  { label: "Schedule", view: "schedule", icon: CalendarDays },
  { label: "News", view: "news", icon: Newspaper },
  { label: "Interviews", view: "interviews", icon: Mic },
]

export function Header() {
  const navigate = useAppStore((s) => s.navigate)
  const mode = useAppStore((s) => s.mode)
  const toggleMode = useAppStore((s) => s.toggleMode)
  const view = useAppStore((s) => s.view)
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#1e2a5e] text-white shadow-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-4">
        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-white/10"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-background text-foreground">
            <div className="flex flex-col gap-1 pt-6">
              <button
                onClick={() => {
                  navigate("home")
                  setOpen(false)
                }}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-muted rounded-md"
              >
                <Home className="h-4 w-4" /> Home
              </button>
              {navItems.slice(1).map((item) => (
                <button
                  key={item.view}
                  onClick={() => {
                    navigate(item.view)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-muted",
                    view === item.view && "bg-muted font-semibold"
                  )}
                >
                  <item.icon className="h-4 w-4" /> {item.label}
                </button>
              ))}
              <div className="my-2 h-px bg-border" />
              <button
                onClick={() => {
                  toggleMode()
                  setOpen(false)
                }}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-muted"
              >
                <Shield className="h-4 w-4" />
                {mode === "public" ? "Admin CMS" : "Exit Admin"}
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <button
          onClick={() => navigate(mode === "public" ? "home" : "admin-dashboard")}
          className="flex items-center gap-2 shrink-0"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-[#1e2a5e] font-extrabold text-lg">
            c
          </span>
          <span className="hidden sm:block font-extrabold text-lg tracking-tight">
            cricinfo
          </span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-0.5 ml-2">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-white/10",
                view === item.view && "bg-white/15 font-semibold"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" />
            <Input
              placeholder="Search players, teams..."
              className="h-8 w-44 bg-white/10 border-white/20 text-white placeholder:text-white/50 pl-8 text-sm focus-visible:bg-white/15"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  navigate("players")
                }
              }}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleMode}
            className="gap-1.5 text-xs font-semibold"
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {mode === "public" ? "Admin" : "Exit"}
            </span>
          </Button>
        </div>
      </div>
    </header>
  )
}
