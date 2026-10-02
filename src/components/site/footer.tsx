"use client"

import { useAppStore } from "@/lib/store"
import { Trophy, Users, CalendarDays, Newspaper, BarChart3, Activity } from "lucide-react"
import type { ViewKey } from "@/lib/types"

const footerNav: { title: string; links: { label: string; view: ViewKey }[] }[] = [
  {
    title: "Cricket",
    links: [
      { label: "Live Scores", view: "matches" },
      { label: "Schedule", view: "schedule" },
      { label: "Series", view: "series" },
      { label: "Stats", view: "stats" },
    ],
  },
  {
    title: "Teams",
    links: [
      { label: "All Teams", view: "teams" },
      { label: "Players", view: "players" },
      { label: "Rankings", view: "stats" },
      { label: "Records", view: "stats" },
    ],
  },
  {
    title: "News",
    links: [
      { label: "Latest News", view: "news" },
      { label: "Features", view: "news" },
      { label: "Analysis", view: "news" },
      { label: "Opinion", view: "news" },
    ],
  },
]

const iconForView: Record<string, React.ElementType> = {
  matches: Activity,
  schedule: CalendarDays,
  series: Trophy,
  stats: BarChart3,
  teams: Users,
  players: Users,
  news: Newspaper,
}

export function Footer() {
  const navigate = useAppStore((s) => s.navigate)

  return (
    <footer className="mt-auto border-t border-border/60 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground font-extrabold text-lg">
                c
              </span>
              <span className="font-extrabold text-lg tracking-tight">
                cricinfo
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground max-w-xs">
              The definitive home of cricket. Live scores, news, stats and analysis
              from every corner of the cricket world.
            </p>
          </div>
          {footerNav.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-foreground">
                {section.title}
              </h3>
              <ul className="space-y-1.5">
                {section.links.map((link) => {
                  const Icon = iconForView[link.view] ?? Activity
                  return (
                    <li key={link.label}>
                      <button
                        onClick={() => navigate(link.view)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                      >
                        <Icon className="h-3 w-3" />
                        {link.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-4 sm:flex-row">
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Cricinfo CMS Demo. Built with Next.js 16.
            Data is illustrative.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Made with ♥ for cricket lovers
          </p>
        </div>
      </div>
    </footer>
  )
}
