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
  Images,
  Radio,
} from "lucide-react"
import type { ViewKey } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// Demo-grade scorer PIN. For production, use server-issued tokens / NextAuth.
const SCORER_PIN = process.env.NEXT_PUBLIC_SCORER_PIN || "score123"

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
]

export function Header() {
  const navigate = useAppStore((s) => s.navigate)
  const mode = useAppStore((s) => s.mode)
  const toggleMode = useAppStore((s) => s.toggleMode)
  const enterScorerMode = useAppStore((s) => s.enterScorerMode)
  const view = useAppStore((s) => s.view)
  const [open, setOpen] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinInput, setPinInput] = useState("")

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
          {mode === "public" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPinOpen(true)}
              className="gap-1.5 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10"
              title="Score a match live"
            >
              <Radio className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Score</span>
            </Button>
          )}
        </div>
      </div>

      {/* Scorer PIN gate */}
      <Dialog open={pinOpen} onOpenChange={setPinOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-red-600" />
              Scorer Access
            </DialogTitle>
            <DialogDescription>
              Enter the scorer PIN to access live scoring. This does not give
              access to the admin CMS.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Input
              type="password"
              placeholder="Scorer PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pinInput.trim() === SCORER_PIN) {
                    enterScorerMode()
                    setPinOpen(false)
                    setPinInput("")
                  }
                }
              }}
              className="text-center text-lg tracking-widest"
              autoFocus
            />
            <Button
              onClick={() => {
                if (pinInput.trim() === SCORER_PIN) {
                  enterScorerMode()
                  setPinOpen(false)
                  setPinInput("")
                }
              }}
              className="w-full gap-1.5 bg-red-600 text-white hover:bg-red-700"
            >
              <Radio className="h-4 w-4" /> Enter Scorer Mode
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
