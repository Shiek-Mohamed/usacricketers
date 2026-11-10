"use client"

import { useAppStore } from "@/lib/store"
import { Trophy, Users, CalendarDays, Newspaper, BarChart3, Activity, Mic, Images, Play, MessageSquare } from "lucide-react"
import type { ViewKey } from "@/lib/types"
import { NewsletterSignup } from "@/components/site/newsletter-signup"

const footerNav: { title: string; links: { label: string; view: ViewKey; category?: string }[] }[] = [
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
      { label: "Latest News", view: "news", category: "all" },
      { label: "Features", view: "news", category: "feature" },
      { label: "Analysis", view: "news", category: "analysis" },
      { label: "Opinion", view: "news", category: "opinion" },
      { label: "Interviews", view: "interviews" },
      { label: "Photo Galleries", view: "photos" },
      { label: "Videos", view: "videos" },
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
  interviews: Mic,
  photos: Images,
  videos: Play,
}

export function Footer() {
  const navigate = useAppStore((s) => s.navigate)

  return (
    <footer className="mt-auto bg-gradient-to-b from-[#1e2a5e] to-[#171f48] text-white">
      {/* Subtle amber accent bar separating page content from footer */}
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center">
              <span className="font-extrabold text-xl tracking-tight text-white">
                usacricketers<span className="text-amber-400">.</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-white/70">
              The definitive home of cricket. Live scores, news, stats and analysis
              from every corner of the cricket world.
            </p>
            <button
              onClick={() => navigate("feedback")}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-400 transition-colors duration-200 hover:text-amber-300"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Feedback
            </button>
            {/* Newsletter signup — footer variant (dark, compact) */}
            <div className="mt-5">
              <NewsletterSignup variant="footer" />
            </div>
          </div>
          {footerNav.map((section) => (
            <div key={section.title}>
              <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-white/90">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => {
                  const Icon = iconForView[link.view] ?? Activity
                  return (
                    <li key={link.label}>
                      <button
                        onClick={() => navigate(link.view, link.category ?? null)}
                        className="inline-flex items-center gap-1.5 text-[13px] text-white/70 transition-colors duration-200 hover:text-amber-300"
                      >
                        <Icon className="h-3 w-3 transition-colors duration-200" />
                        {link.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-5 sm:flex-row">
          <p className="text-[11px] text-white/60">
            © {new Date().getFullYear()} USACricketers CMS Demo. Built with Next.js 16.
            Data is illustrative.
          </p>
          <p className="text-[11px] text-white/60">
            Made with ♥ for cricket lovers
          </p>
        </div>
      </div>
    </footer>
  )
}
