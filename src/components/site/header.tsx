"use client"

import { useState, useEffect } from "react"
import { useAppStore } from "@/lib/store"
import { useScorerSession } from "@/lib/scorer-session"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
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
  { label: "Photos", view: "photos", icon: Images },
  { label: "Videos", view: "videos", icon: Play },
]

export function Header() {
  const navigate = useAppStore((s) => s.navigate)
  const mode = useAppStore((s) => s.mode)
  const toggleMode = useAppStore((s) => s.toggleMode)
  const enterScorerLogin = useAppStore((s) => s.enterScorerLogin)
  const enterScorerMode = useAppStore((s) => s.enterScorerMode)
  const enterLeagueAdminLogin = useAppStore((s) => s.enterLeagueAdminLogin)
  const enterLeagueAdminMode = useAppStore((s) => s.enterLeagueAdminMode)
  const view = useAppStore((s) => s.view)
  const scorerSession = useScorerSession((s) => s.session)
  const leagueAdminSession = useLeagueAdminSession((s) => s.session)
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  // "Score" button: go straight to scorer-home if a session exists, else to login.
  const onScore = () => {
    if (scorerSession) enterScorerMode()
    else enterScorerLogin()
  }
  // "League Admin" button: same pattern.
  const onLeagueAdmin = () => {
    if (leagueAdminSession) enterLeagueAdminMode()
    else enterLeagueAdminLogin()
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
                {scorerSession ? "Scorer Mode" : "Scorer Sign In"}
              </button>
              <button
                onClick={() => {
                  onLeagueAdmin()
                  setOpen(false)
                }}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-muted text-emerald-600 font-semibold"
              >
                <Trophy className="h-4 w-4" />
                {leagueAdminSession ? "League Admin" : "League Admin Sign In"}
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
              variant="ghost"
              size="sm"
              onClick={onScore}
              className="gap-1.5 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10"
              title="Score a match live"
            >
              <Radio className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {scorerSession ? "Score" : "Scorer Sign In"}
              </span>
            </Button>
          )}
          {mode === "public" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLeagueAdmin}
              className="gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 hover:bg-white/10"
              title="Manage your leagues"
            >
              <Trophy className="h-3.5 w-3.5" />
              <span className="hidden md:inline">
                {leagueAdminSession ? "League Admin" : "League Admin Sign In"}
              </span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
