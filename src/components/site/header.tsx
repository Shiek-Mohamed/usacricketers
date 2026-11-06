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
  ChevronLeft,
  ChevronRight,
  RotateCw,
} from "lucide-react"
import type { ViewKey } from "@/lib/types"

// Flat list for the mobile Sheet (all items visible)
const navItems: { label: string; view: ViewKey; icon: React.ElementType }[] = [
  { label: "Home", view: "home", icon: Home },
  { label: "Live", view: "matches", icon: Activity },
  { label: "Series", view: "series", icon: Trophy },
  { label: "Teams", view: "teams", icon: Users },
  { label: "Players", view: "players", icon: UserSearch },
  { label: "Rankings", view: "rankings", icon: Trophy },
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
      { label: "Rankings", view: "rankings", icon: Trophy },
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
  // One-time "mounted" flag for next-themes (avoids hydration mismatch
  // when rendering the sun/moon icon). The setState-in-effect rule flags
  // this, but it's the canonical mount-detection pattern — a single
  // constant set with no cascading render risk.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  // Subtle shadow elevation once the page is scrolled past the top
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // PWA navigation — back/forward/refresh buttons. Only visible in
  // standalone PWA mode (no browser chrome) or on small screens.
  //
  // SSR-safe: initial state is `false` (the buttons are hidden during SSR
  // and the first client paint), then after mount we read the browser APIs
  // (matchMedia / innerWidth / history.length) and update. The reads are
  // deferred to a microtask so they're NOT synchronous setState-in-effect
  // (which the react-hooks/set-state-in-effect rule flags). The popstate
  // subscription handles subsequent back/forward navigation.
  const [showPwaNav, setShowPwaNav] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  useEffect(() => {
    const syncFromBrowser = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches
      const mobile = window.innerWidth < 768
      setShowPwaNav(standalone || mobile)
      setCanGoBack(window.history.length > 1)
      setCanGoForward(window.history.length > 1)
    }
    // Defer the initial read to a microtask so it's not a synchronous
    // setState in the effect body (keeps the linter happy + avoids the
    // cascading render the rule warns about). queueMicrotask returns
    // undefined — the one-shot is harmless if it runs after unmount
    // (setState on an unmounted component is a no-op in React 18+).
    queueMicrotask(syncFromBrowser)
    const onPopState = () => {
      setCanGoBack(window.history.length > 1)
      setCanGoForward(window.history.length > 1)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Detect if we're on an SSR route (not the SPA root at "/").
  // On SSR pages, navigate() (pushState) doesn't work because the SPA
  // view switcher isn't loaded. We need full page navigation instead.
  const isSSRPage = typeof window !== "undefined" && window.location.pathname !== "/"
  const onNavClick = (view: ViewKey) => {
    setOpen(false)
    if (isSSRPage) {
      // Full page load to the SPA root with the view param.
      // Use assign() instead of assigning to window.location.href —
      // the react-hooks/immutability rule (React Compiler) flags direct
      // mutation of window.location.href.
      window.location.assign(`/?view=${view}`)
    } else {
      // SPA navigation (works on the root page)
      navigate(view)
    }
  }
  const onScoreNav = () => {
    setOpen(false)
    if (isSSRPage) {
      window.location.assign(`/?view=scorer-landing`)
    } else {
      enterScorerLanding()
    }
  }
  const onAdminNav = () => {
    setOpen(false)
    if (isSSRPage) {
      window.location.assign(`/?view=admin-login`)
    } else {
      onAdmin()
    }
  }

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
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-white/10 bg-[#1e2a5e] text-white transition-shadow duration-300",
        scrolled ? "shadow-lg shadow-black/25" : "shadow-md"
      )}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
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
                onClick={() => onNavClick("home")}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-muted rounded-md"
              >
                <Home className="h-4 w-4" /> Home
              </button>
              {navItems.slice(1).map((item) => (
                <button
                  key={item.view}
                  onClick={() => onNavClick(item.view)}
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
                onClick={onScoreNav}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors hover:bg-muted text-emerald-600 dark:text-emerald-400 font-semibold"
              >
                <Radio className="h-4 w-4" />
                Live Scoring
              </button>
              <button
                onClick={onAdminNav}
                className="flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-muted"
              >
                <Shield className="h-4 w-4" />
                {mode === "public" ? "Admin CMS" : "Exit Admin"}
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* PWA navigation — back/forward/refresh. Only shows in standalone
            PWA mode or on mobile (desktop browsers have their own controls). */}
        {showPwaNav && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              disabled={!canGoBack}
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-default"
              aria-label="Go back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.forward()}
              disabled={!canGoForward}
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-default"
              aria-label="Go forward"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.reload()}
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Refresh page"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Logo — shrinks on mobile so the right-side CTAs fit */}
        <button
          onClick={() => onNavClick(mode === "public" ? "home" : "admin-dashboard")}
          className="flex items-center shrink-0 rounded-md transition-opacity hover:opacity-90"
        >
          <span className="font-extrabold text-base tracking-tight sm:text-xl">
            usacricketers<span className="text-amber-400">.</span>
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
                  onClick={() => group.view && onNavClick(group.view as ViewKey)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-150 hover:bg-white/10",
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
                    "flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-150 hover:bg-white/10",
                    isActive && "bg-white/15 font-semibold"
                  )}
                >
                  {group.label}
                  <ChevronDown className="h-3 w-3 opacity-60 transition-transform group-hover:rotate-180" />
                </button>
                {/* Dropdown panel — visible on hover */}
                <div className="invisible absolute left-0 top-full z-50 pt-1 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                  <div className="w-48 rounded-lg border border-white/10 bg-[#1e2a5e] py-1 shadow-xl shadow-black/30">
                    {group.children.map((child) => {
                      const Icon = child.icon
                      return (
                        <button
                          key={child.view}
                          onClick={() => onNavClick(child.view)}
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

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" />
            <Input
              placeholder="Search players, teams..."
              className="h-8 w-44 bg-white/10 border-white/20 text-white placeholder:text-white/50 pl-8 text-sm focus-visible:bg-white/15"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val) onNavClick("search")
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
          {/* Admin button — hidden on mobile (still reachable via the Sheet menu) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onAdminNav}
            className="hidden gap-1.5 border border-white/15 bg-white/5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white sm:inline-flex"
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">
              {mode === "public" ? "Admin" : "Exit"}
            </span>
          </Button>
          {mode === "public" && (
            <Button
              size="sm"
              onClick={() => {
                if (isSSRPage) {
                  window.location.assign(`/?view=scorer-landing`)
                } else {
                  onScore()
                }
              }}
              className="gap-1.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-700 hover:to-emerald-600 shadow-md shadow-emerald-900/20"
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
