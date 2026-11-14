"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"
import { useArticles, useGalleries, useVideos, usePlayers } from "@/lib/use-data"
import type { Gallery, Match, Article, Video } from "@/lib/types"
import {
  TeamBadge,
  FormatPill,
  timeAgo,
  formatDate,
} from "@/components/cricket/ui"
import { MiniScorecard } from "@/components/cricket/mini-scorecard"
import { ArticleCard } from "@/components/cricket/article-card"
// Lazy-load BannerSlot — the home page doesn't need to compile the banner
// rendering code (which pulls in next/script for AdSense) on the initial
// load. The slot renders an empty placeholder on SSR + first paint, then
// the client fetches the active banners + renders them after hydration.
// This keeps the home-page compile light (~200KB smaller bundle) which
// helps the dev server stay alive under memory pressure.
import dynamic from "next/dynamic"
const BannerSlot = dynamic(() => import("@/components/site/banner-slot").then(m => m.BannerSlot), {
  ssr: false,
  loading: () => null,
})
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { NewsletterSignup } from "@/components/site/newsletter-signup"
import { SmartImage } from "@/components/site/smart-image"
import {
  ChevronRight,
  Radio,
  Newspaper,
  Clock,
  User,
  ArrowRight,
  Images,
  Play,
} from "lucide-react"

/** Format an ISO date as "Mon DD" (e.g. "Mar 10"). */
function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

function SectionTitle({
  title,
  actionLabel,
  onAction,
  icon: Icon,
  onDark,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ElementType
  onDark?: boolean
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-red-600" aria-hidden />
        {Icon && <Icon className="h-4 w-4 text-red-600" />}
        <h2
          className={cn(
            "text-sm font-extrabold uppercase tracking-tight sm:text-base",
            onDark && "text-white"
          )}
        >
          {title}
        </h2>
      </div>
      {actionLabel && onAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAction}
          className={cn(
            "h-7 gap-0.5 text-xs font-semibold",
            onDark
              ? "text-white/70 hover:text-white"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

/** Last innings total for a team in a match, e.g. "217/4". */
function inningsTotal(match: Match, teamId: string): string {
  const sc = match.scorecard
  if (!sc?.innings) return ""
  const inn = sc.innings.filter((i) => i.teamId === teamId)
  if (!inn.length) return ""
  const last = inn[inn.length - 1]
  return `${last.totalRuns}/${last.totalWickets}`
}

/** Prominent live-match card — dark navy gradient (matches the match page
 *  hero). Shows LIVE badge, both teams + scores, format, and a CTA to view
 *  the match page. Renders as `<a href="/matches/${id}">` for SEO + deep-link.
 */
function LiveMatchStrip({ match }: { match: Match }) {
  const t1 = match.team1
  const t2 = match.team2
  const t1Score = inningsTotal(match, match.team1Id)
  const t2Score = inningsTotal(match, match.team2Id)
  const href = `/matches/${match.id}`
  return (
    <a
      href={href}
      className="group block w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#1e2a5e] to-[#0f1729] dark:from-[#1e2a5e] dark:to-[#1a2540] dark:from-[#1e2a5e] dark:to-[#1a2540] p-4 text-left shadow-lg transition-shadow hover:shadow-xl sm:p-5"
    >
      {/* Top row — LIVE badge + format + match info */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Live
          </span>
          <FormatPill format={match.format} />
          <span className="hidden text-xs text-white/50 sm:inline">
            {match.matchNo}{match.series?.shortName ? ` · ${match.series.shortName}` : ""}
          </span>
        </div>
        <span className="text-xs font-bold text-white/40 transition-colors group-hover:text-white/70">
          View Match →
        </span>
      </div>

      {/* Teams + scores — centered, symmetric */}
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        {/* Team 1 */}
        <div className="flex flex-col items-center gap-1">
          {t1 && (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 ring-2 ring-white/20 sm:h-12 sm:w-12">
              <TeamBadge team={t1} size="sm" />
            </div>
          )}
          <span className="text-xs font-bold uppercase tracking-wide text-white/70 sm:text-sm">{t1?.shortName}</span>
          {t1Score ? (
            <span className="text-lg font-extrabold tabular-nums text-white sm:text-2xl">{t1Score}</span>
          ) : (
            <span className="text-xs text-white/40">Yet to bat</span>
          )}
        </div>

        {/* VS */}
        <span className="text-sm font-bold uppercase tracking-widest text-white/30">vs</span>

        {/* Team 2 */}
        <div className="flex flex-col items-center gap-1">
          {t2 && (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 ring-2 ring-white/20 sm:h-12 sm:w-12">
              <TeamBadge team={t2} size="sm" />
            </div>
          )}
          <span className="text-xs font-bold uppercase tracking-wide text-white/70 sm:text-sm">{t2?.shortName}</span>
          {t2Score ? (
            <span className="text-lg font-extrabold tabular-nums text-white sm:text-2xl">{t2Score}</span>
          ) : (
            <span className="text-xs text-white/40">Yet to bat</span>
          )}
        </div>
      </div>
    </a>
  )
}

/** The big featured story — asymmetric split: text card (left) layered over a large image (right). */
function FeaturedHero({ article }: { article: Article }) {
  // Direct link to the SSR article page — full page navigation.
  const href = article.slug
    ? `/news/${article.slug}`
    : `/?view=article-detail&id=${article.id}`
  return (
    <a
      href={href}
      className="group relative grid grid-cols-1 items-stretch overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-lg lg:grid-cols-12"
    >
      {/* Text card — left, layered over the image on large screens */}
      <div className="order-2 flex flex-col justify-center bg-card p-5 shadow-xl ring-1 ring-black/5 lg:order-1 lg:col-span-5 lg:-mr-12 lg:z-10 lg:p-8">
        <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight transition-colors group-hover:text-red-600 sm:text-3xl lg:text-[2rem]">
          {article.title}
        </h2>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-foreground">
          {article.excerpt}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {article.author}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDate(article.publishedAt)}
          </span>
        </div>
        <span className="mt-5 inline-flex w-fit items-center gap-1 text-sm font-bold text-red-600 transition-all group-hover:gap-2">
          Read story
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
      {/* Image — right, the large hero visual. next/image via SmartImage
          for automatic WebP/AVIF + responsive srcset. */}
      <div className="relative order-1 min-h-[260px] overflow-hidden bg-muted lg:order-2 lg:col-span-7 lg:min-h-[440px]">
        {article.imageUrl ? (
          <SmartImage
            src={article.imageUrl}
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="absolute inset-0 object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-700 to-slate-900 text-slate-400">
            <Newspaper className="h-12 w-12" />
          </div>
        )}
      </div>
    </a>
  )
}

/** A secondary story card — image on top, headline + meta below. */
function SecondaryStoryCard({ article }: { article: Article }) {
  const href = article.slug
    ? `/news/${article.slug}`
    : `/?view=article-detail&id=${article.id}`
  return (
    <a
      href={href}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {article.imageUrl ? (
          <SmartImage
            src={article.imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-slate-700 to-slate-900 text-slate-400">
            <Newspaper className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 font-bold leading-snug transition-colors group-hover:text-red-600">
          {article.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {article.author}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(article.publishedAt)}
          </span>
        </div>
      </div>
    </a>
  )
}

function HomeHeroSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border lg:grid-cols-12">
        <Skeleton className="order-2 h-64 lg:order-1 lg:col-span-5" />
        <Skeleton className="order-1 h-64 lg:order-2 lg:col-span-8" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export function HomeView() {
  const navigate = useAppStore((s) => s.navigate)
  // Match data is now fetched by the global LiveScoreTicker (rendered in the
  // app shell below the header), so the homepage no longer needs its own
  // useMatches() call.
  const { data: featuredArticles, loading: articlesLoadingFeatured } =
    useArticles({ featured: true, pageSize: 12 })
  const { data: allArticles, loading: articlesLoadingAll } = useArticles({ pageSize: 16 })
  const { data: interviewData } = useArticles({ category: "interview", pageSize: 9 })

  const featuredItems = featuredArticles?.items ?? []
  const latestItems = allArticles?.items ?? []

  // Featured hero = most recent article that has a hero image; secondary = next 3 with images.
  const withImages = useMemo(
    () => latestItems.filter((a) => a.imageUrl),
    [latestItems]
  )
  const heroStory = withImages[0] ?? featuredItems[0] ?? latestItems[0] ?? null
  const secondaryStories = withImages.slice(1, 4)

  // Exclude the hero + secondary stories from Latest News so they don't
  // appear twice on the homepage.
  const featuredIds = useMemo(
    () =>
      new Set(
        [heroStory?.id, ...secondaryStories.map((a) => a.id)].filter(
          Boolean,
        ) as string[],
      ),
    [heroStory, secondaryStories],
  )
  const latestNews = useMemo(
    () => latestItems.filter((a) => !featuredIds.has(a.id)).slice(0, 8),
    [latestItems, featuredIds],
  )

  const heroLoading = articlesLoadingFeatured && articlesLoadingAll

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero section — cricket.com.au-style featured story.
          The live/recent/upcoming match carousel now lives in the global
          LiveScoreTicker (rendered below the header on every page), so we
          skip the duplicate here and go straight to the featured story. */}
      <section className="space-y-5">
        {/* AD SLOT — between the ticker and the hero (AdSense, non-rotating) */}
        <BannerSlot placement="home-live-hero" />

        {/* Featured hero story (split layout: text card + large image) */}
        {heroLoading ? (
          <HomeHeroSkeleton />
        ) : heroStory ? (
          <FeaturedHero article={heroStory} />
        ) : (
          <Card className="grid min-h-[200px] place-items-center p-6">
            <p className="text-sm text-muted-foreground">No stories available.</p>
          </Card>
        )}

        {/* Secondary stories — 3 cards */}
        {secondaryStories.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {secondaryStories.map((a) => (
              <SecondaryStoryCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </section>

      {/* AD SLOT — above Latest News (rotating) */}
      <BannerSlot placement="home-above-news" />

      {/* Latest News */}
      <section>
        <SectionTitle
          title="Latest News"
          icon={Newspaper}
          actionLabel="View all"
          onAction={() => navigate("news")}
        />
        {articlesLoadingAll ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[16/9] w-full rounded-lg" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : latestNews.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {latestNews.map((a) => (
              <ArticleCard key={a.id} article={a} variant="default" showCategory={false} showTags={false} />
            ))}
          </div>
        ) : (
          <Card className="grid place-items-center p-6">
            <p className="text-sm text-muted-foreground">No news yet.</p>
          </Card>
        )}
      </section>

      {/* Newsletter signup — prominent placement right after Latest News,
          where readers are most likely to subscribe after seeing fresh
          content. Inline variant = light card style. */}
      <NewsletterSignup variant="inline" />

      {/* Star Players — 8 player cards with career stats */}
      <StarPlayersSection />

      {/* Interviews — styled per the provided sample design */}
      <InterviewsSection articles={interviewData?.items ?? []} />

      {/* AD SLOT — above Photo Galleries (rotating) */}
      <BannerSlot placement="home-above-galleries" />

      {/* Photo Galleries — 4-column card grid (sample design) */}
      <GalleriesSection />

      {/* Videos — jumbo + 4 small (interview-section-style layout) */}
      <VideosSection />
    </div>
  )
}

/* ---- Interviews section (sample-design: navy header + gradient cards + popular sidebar) ---- */

function InterviewsSection({ articles }: { articles: Article[] }) {
  const navigate = useAppStore((s) => s.navigate)
  if (!articles.length) return null
  const hero = articles[0]
  const secondary = articles.slice(1, 3)
  const popular = articles.slice(3, 9)

  return (
    <section className="space-y-6">
      {/* Section header — navy "Interviews" + See More link */}
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-extrabold tracking-tight uppercase text-[#1e2a5e] sm:text-3xl">
          Interviews
        </h2>
        <button
          onClick={() => navigate("interviews")}
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#1e2a5e] hover:opacity-70 transition-opacity"
        >
          See More Interviews
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left: hero card (spans 2 cols) + 2 secondary cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-8">
          {hero && (
            <InterviewCard
              article={hero}
              variant="hero"
            />
          )}
          {secondary.map((a) => (
            <InterviewCard
              key={a.id}
              article={a}
              variant="secondary"
            />
          ))}
        </div>

        {/* Right: Popular Interviews numbered list */}
        {popular.length > 0 && (
        <aside className="lg:col-span-4">
          <div className="mb-5 border-b pb-4">
            <h3 className="text-lg font-bold uppercase tracking-wide text-[#1e2a5e] sm:text-xl">
              Popular Interviews
            </h3>
          </div>
          <ul className="space-y-5">
            {popular.map((a, i) => (
              <li key={a.id}>
                <a
                  href={a.slug ? `/news/${a.slug}` : `/?view=article-detail&id=${a.id}`}
                  className="group flex items-start gap-4 text-left"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gray-300 pt-0.5 text-base font-bold text-[#1e2a5e]">
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <span className="mb-1 block text-xs font-medium text-gray-500">
                      Interview
                    </span>
                    <p className="font-bold leading-snug text-gray-900 transition-colors group-hover:text-[#1e2a5e]">
                      {a.title}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </aside>
        )}
      </div>
    </section>
  )
}

function InterviewCard({
  article,
  variant,
}: {
  article: Article
  variant: "hero" | "secondary"
}) {
  const hero = variant === "hero"
  const href = article.slug
    ? `/news/${article.slug}`
    : `/?view=article-detail&id=${article.id}`
  return (
    <a
      href={href}
      className={cn(
        "group relative block w-full overflow-hidden rounded-xl bg-black text-left",
        hero ? "aspect-[16/9] md:col-span-2 md:aspect-[21/9]" : "aspect-[4/3]"
      )}
    >
      {article.imageUrl ? (
        <img
          src={article.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-slate-800" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex h-full w-full flex-col justify-end p-5 md:p-6">
        <div className="mt-auto">
          <span className="mb-2 inline-block text-sm font-medium text-white/90">
            Interview
          </span>
          <h3
            className={cn(
              "mb-2 font-bold leading-tight text-white transition-colors group-hover:text-blue-200",
              hero ? "text-2xl md:text-3xl" : "text-lg line-clamp-2"
            )}
          >
            {article.title}
          </h3>
          <time className="text-sm font-medium text-gray-300">
            {formatDate(article.publishedAt)}
          </time>
        </div>
      </div>
    </a>
  )
}

/* ---- Star Players section (8 player cards with career stats) ---- */

function StarPlayersSection() {
  const navigate = useAppStore((s) => s.navigate)
  const { data: playersData, loading } = usePlayers()

  const players = useMemo(() => {
    const all = playersData ?? []
    return all
      .filter((p) => {
        try {
          const stats = typeof p.battingStats === "string" ? JSON.parse(p.battingStats) : p.battingStats
          return stats && stats.runs > 0
        } catch { return false }
      })
      .sort((a, b) => {
        try {
          const sa = typeof a.battingStats === "string" ? JSON.parse(a.battingStats) : a.battingStats
          const sb = typeof b.battingStats === "string" ? JSON.parse(b.battingStats) : b.battingStats
          return (sb?.runs || 0) - (sa?.runs || 0)
        } catch { return 0 }
      })
      .slice(0, 8)
  }, [playersData])

  if (!loading && players.length === 0) return null

  return (
    <section className="rounded-xl bg-[#1e2a5e] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-extrabold uppercase tracking-wide text-white sm:text-xl">
          Star Players
        </h2>
        <button
          onClick={() => navigate("players")}
          className="text-xs font-semibold text-amber-400 transition-colors hover:text-amber-300"
        >
          View all →
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-white/5 p-3">
              <Skeleton className="mx-auto mb-2 h-12 w-12 rounded-full" />
              <Skeleton className="mx-auto h-3 w-20" />
              <Skeleton className="mx-auto mt-1 h-2 w-16" />
            </div>
          ))
        ) : (
          players.map((p) => {
            let stats: any = {}
            try {
              stats = typeof p.battingStats === "string" ? JSON.parse(p.battingStats) : p.battingStats || {}
            } catch {}
            return (
              <a
                key={p.id}
                href={p.id ? `/players/${p.id}` : "#"}
                className="group rounded-lg bg-white/5 p-3 text-center transition-colors hover:bg-white/10"
              >
                <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-sm font-extrabold text-white shadow-md ring-2 ring-white/10">
                  {p.name?.slice(0, 2).toUpperCase() || "?"}
                </div>
                <p className="truncate text-xs font-semibold text-white">
                  {p.name}
                </p>
                <p className="text-[11px] font-medium text-amber-400">
                  {stats.runs ? `${stats.runs} runs` : p.role}
                </p>
                {stats.matches && (
                  <p className="text-[10px] text-white/70">
                    {stats.matches} matches
                  </p>
                )}
              </a>
            )
          })
        )}
      </div>
    </section>
  )
}

/* ---- Galleries section (4-column card grid per the provided sample design) ---- */

function GalleriesSection() {
  const navigate = useAppStore((s) => s.navigate)
  const { data, loading } = useGalleries()
  const galleries = useMemo(() => (data ?? []).slice(0, 4), [data])

  if (!loading && galleries.length === 0) return null

  return (
    <section>
      <SectionTitle
        title="Photo Galleries"
        icon={Images}
        actionLabel="View all"
        onAction={() => navigate("photos")}
      />
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[16/9] w-full rounded-lg" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {galleries.map((g) => (
            <GalleryCard
              key={g.id}
              gallery={g}
              onClick={() => navigate("gallery-detail", g.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Gallery card — matches the provided sample layout:
 * 16:9 landscape image (light-gray placeholder with an Images icon when empty),
 * an uppercase category label, a bold headline, and a "Mon DD" date.
 * Transparent card body (content sits directly on the white page background).
 */
function GalleryCard({
  gallery,
  onClick,
}: {
  gallery: Gallery
  onClick: () => void
}) {
  // Prefer the explicit cover image; fall back to the first photo.
  const cover = gallery.coverImage || gallery.photos[0]?.src || ""
  const photoCount = gallery.photos.length

  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col text-left"
    >
      {/* Image / placeholder */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted">
        {cover ? (
          <img
            src={cover}
            alt={gallery.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gray-100 text-gray-400">
            <Images className="h-10 w-10" />
          </div>
        )}
      </div>
      {/* Text content (transparent body, sits on white) */}
      <div className="mt-3">
        <span className="text-xs font-extrabold uppercase tracking-wide text-foreground">
          {photoCount > 0 ? `Photos · ${photoCount}` : "Photos"}
        </span>
        <h3 className="mt-1 line-clamp-2 text-base font-bold leading-snug text-foreground transition-colors group-hover:text-red-600">
          {gallery.title}
        </h3>
        <time className="mt-1.5 block text-[13px] font-normal text-gray-500">
          {formatShortDate(gallery.createdAt)}
        </time>
      </div>
    </button>
  )
}

/* ---- Videos section (jumbo left + 4 small right, interview-section-style) ---- */

function VideosSection() {
  const navigate = useAppStore((s) => s.navigate)
  const { data, loading } = useVideos({ limit: 5 })
  const videos = useMemo(() => data ?? [], [data])

  if (!loading && videos.length === 0) return null

  const jumbo = videos[0]
  const small = videos.slice(1, 5)

  return (
    <section className="space-y-6">
      {/* Section header — navy "Videos" + See More link (matches Interviews) */}
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-extrabold uppercase tracking-tight text-[#1e2a5e] sm:text-3xl">
          Videos
        </h2>
        <button
          onClick={() => navigate("videos")}
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[#1e2a5e] hover:opacity-70 transition-opacity"
        >
          See More Videos
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="aspect-[16/9] w-full rounded-xl lg:col-span-8" />
          <div className="space-y-3 lg:col-span-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left: jumbo video */}
          <div className="lg:col-span-8">
            {jumbo && (
              <JumboVideoCard video={jumbo} onClick={() => navigate("video-detail", jumbo.id)} />
            )}
          </div>
          {/* Right: 3 small videos stacked */}
          <div className="space-y-4 lg:col-span-4">
            {small.map((v) => (
              <SmallVideoCard key={v.id} video={v} onClick={() => navigate("video-detail", v.id)} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** Resolve a display thumbnail for a video (custom → YouTube hqdefault → none). */
function videoThumb(v: Video): string {
  if (v.thumbnailUrl) return v.thumbnailUrl
  if (v.source === "youtube" && v.youtubeId)
    return `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`
  return ""
}

/** Large 16:9 video card with play overlay + title/meta on a gradient bottom. */
function JumboVideoCard({ video, onClick }: { video: Video; onClick: () => void }) {
  const thumb = videoThumb(video)
  return (
    <button
      onClick={onClick}
      className="group relative block w-full overflow-hidden rounded-xl bg-black text-left"
    >
      <div className="relative aspect-[16/9] w-full">
        {thumb ? (
          <img
            src={thumb}
            alt={video.title}
            className="absolute inset-0 h-full w-full object-cover opacity-95 transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-slate-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
        {/* Play button */}
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110">
            <Play className="h-7 w-7 fill-black text-black" />
          </span>
        </div>
        {/* Bottom content */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <span className="mb-2 inline-block rounded-sm bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {video.category}
          </span>
          <h3 className="text-xl font-bold leading-tight text-white sm:text-2xl">
            {video.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-300">
            {video.duration && <span>{video.duration}</span>}
            <span>· {formatShortDate(video.publishedAt)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

/** Small horizontal video card: 16:9 thumbnail left, title/meta right. */
function SmallVideoCard({ video, onClick }: { video: Video; onClick: () => void }) {
  const thumb = videoThumb(video)
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-stretch gap-3 overflow-hidden rounded-lg border bg-card text-left transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/9] w-32 shrink-0 overflow-hidden bg-muted sm:w-36">
        {thumb ? (
          <img
            src={thumb}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-slate-800 text-slate-500">
            <Play className="h-5 w-5" />
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-black/60">
            <Play className="h-3.5 w-3.5 fill-white text-white" />
          </span>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-2 pr-3">
        <span className="text-[10px] font-bold uppercase tracking-wide text-red-600">
          {video.category}
        </span>
        <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug transition-colors group-hover:text-red-600">
          {video.title}
        </h3>
        <span className="mt-auto text-xs text-muted-foreground">
          {video.duration && `${video.duration} · `}
          {formatShortDate(video.publishedAt)}
        </span>
      </div>
    </button>
  )
}
