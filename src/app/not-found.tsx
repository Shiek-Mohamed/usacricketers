import Link from "next/link"
import { Home, Search, Newspaper, Trophy, Users, Activity } from "lucide-react"

/**
 * not-found.tsx — branded 404 page.
 *
 * Renders when:
 *   - A visitor hits a URL that doesn't match any route
 *   - `notFound()` is called from a server component (e.g. article not found)
 *
 * Kept as a server component (no "use client") so it works even if the
 * client bundle fails to load. Uses real <Link>/<a> tags so navigation
 * works without JS.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      {/* Big 404 */}
      <div className="relative">
        <span className="text-[120px] font-black leading-none tracking-tighter text-[#1e2a5e] sm:text-[160px]">
          404
        </span>
        <span className="absolute -right-2 top-2 h-3 w-3 rounded-full bg-amber-400 sm:top-4 sm:h-4 sm:w-4" />
      </div>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        You're caught behind the stumps
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        The page you're looking for was bowled out, never existed, or moved to
        a new URL. Let's get you back to the action.
      </p>

      {/* Primary CTA — back home */}
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#1e2a5e] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#283672]"
      >
        <Home className="h-4 w-4" />
        Back to homepage
      </Link>

      {/* Popular destinations */}
      <div className="mt-10 w-full">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Or jump to
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <PopularLink
            href="/?view=matches"
            icon={Activity}
            label="Live Scores"
          />
          <PopularLink
            href="/?view=news"
            icon={Newspaper}
            label="Latest News"
          />
          <PopularLink
            href="/?view=schedule"
            icon={Trophy}
            label="Schedule"
          />
          <PopularLink
            href="/?view=teams"
            icon={Users}
            label="Teams"
          />
          <PopularLink
            href="/?view=players"
            icon={Users}
            label="Players"
          />
          <PopularLink
            href="/?view=search"
            icon={Search}
            label="Search"
          />
        </div>
      </div>
    </div>
  )
}

function PopularLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ElementType
  label: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-sm"
    >
      <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-[#1e2a5e]" />
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
    </Link>
  )
}
