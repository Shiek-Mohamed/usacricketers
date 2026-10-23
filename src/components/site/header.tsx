"use client"

import { useState, useEffect } from "react"
import { useAppStore } from "@/lib/store"
import { useTheme } from "next-themes"
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
  Images,
  Radio,
  Play,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react"
import type { ViewKey } from "@/lib/types"

// Flat list for the mobile Sheet (all items visible)
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
  { label: "Photos", view: "photos", icon: Images },
  { label: "Videos", view: "videos", icon: Play },
]

// Grouped structure for the desktop dropdown nav (4 top-level items —
// the "usacricketers" logo IS the Home link, so Home is removed from nav)
type NavChild = { label: string; view: ViewKey; icon: React.ElementType }
type NavGroup = { label: string; view?: ViewKey; children?: NavChild[] }
const navGroups: NavGroup[] = [
  {
    label: "Matches",
    children: [
      { label: "Live Scores", view: "matches", icon: Activity },
      { label: "Schedule", view: "schedule", icon: CalendarDays },
      { label: "Series", view: "series", icon: Trophy },
    ],
  },
  {
    label: "Teams",
    children: [
      { label: "All Teams", view: "teams", icon: Users },
      { label: "Players", view: "players", icon: UserSearch },
    ],
  },
  { label: "Stats", view: "stats" },
  {
    label: "News",
    children: [
      { label: "Latest News", view: "news", icon: Newspaper },
      { label: "Interviews", view: "interviews", icon: Mic },
      { label: "Photos", view: "photos", icon: Images },
      { label: "Videos", view: "videos", icon: Play },
    ],
  },
]

export function Header() {
  const navigate = useAppStore((s) => s.navigate)
  const mode = useAppStore((s) => s.mode)
  const toggleMode = useAppStore((s) => s.toggleMode)
  const enterScorerLogin = useAppStore((s) => s.enterScorerLogin)
  const enterScorerMode = useAppStore((s) => s.enterScorerMode)
  const enterScorerLanding = useAppStore((s) => s.enterScorerLanding)
  const view = useAppStore((s) => s.view)
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // "Live Scoring" button → goes to the scoring landing page (which handles
  // both scorer + league-admin sign-in).
  const onScore = () => {
    enterScorerLanding()
  }
  // "Admin" button: in public mode → admin-login (which auto-redirects to the
  // dashboard if the site-admin cookie is still valid). In admin mode → logout
  // + back to public.
  const onAdmin = async () => {
    if (mode === "admin") {
      try { await fetch("/api/admin/logout", { method: "POST" }) } catch {}
      toggleMode()
    } else {
      navigate("admin-login")
    }
  }

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
                  onScore()
                  setOpen(false)
                }}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-muted text-red-600 font-semibold"
              >
                <Radio className="h-4 w-4" />
                Live Scoring
              </button>
              <button
                onClick={() => {
                  onAdmin()
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
          className="flex items-center shrink-0"
        >
          <span className="font-extrabold text-lg tracking-tight">
            usacricketers
          </span>
        </button>

        {/* Desktop nav — dropdown menus */}
        <nav className="hidden lg:flex items-center gap-0.5 ml-2">
          {navGroups.map((group) => {
            // Flat item (no dropdown)
            if (!group.children) {
              return (
                <button
                  key={group.label}
                  onClick={() => group.view && navigate(group.view)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-white/10",
                    group.view === view && "bg-white/15 font-semibold"
                  )}
                >
                  {group.label}
                </button>
              )
            }
            // Dropdown item
            const isActive = group.children.some((c) => c.view === view)
            return (
              <div key={group.label} className="group relative">
                <button
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-white/10",
                    isActive && "bg-white/15 font-semibold"
                  )}
                >
                  {group.label}
                  <ChevronDown className="h-3 w-3 opacity-60 transition-transform group-hover:rotate-180" />
                </button>
                {/* Dropdown panel — visible on hover */}
                <div className="invisible absolute left-0 top-full z-50 pt-1 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                  <div className="w-48 rounded-lg border border-white/10 bg-[#1e2a5e] py-1 shadow-xl">
                    {group.children.map((child) => {
                      const Icon = child.icon
                      return (
                        <button
                          key={child.view}
                          onClick={() => navigate(child.view)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/10",
                            child.view === view
                              ? "bg-white/15 font-semibold text-white"
                              : "text-white/80"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {child.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
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
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val) navigate("search", val)
                }
              }}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-white/70 hover:text-white hover:bg-white/10"
            aria-label="Toggle theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onAdmin}
            className="gap-1.5 text-xs font-semibold"
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {mode === "public" ? "Admin" : "Exit"}
            </span>
          </Button>
          {mode === "public" && (
            <Button
              size="sm"
              onClick={onScore}
              className="gap-1.5 text-xs font-bold bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-700 hover:to-red-600 shadow-md"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              <span>Live Scoring</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
