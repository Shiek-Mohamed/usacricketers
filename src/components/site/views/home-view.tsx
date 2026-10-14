"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"
import { useMatches, useArticles, useGalleries } from "@/lib/use-data"
import type { Gallery, Match, Article } from "@/lib/types"
import {
  TeamBadge,
  FormatPill,
  timeAgo,
} from "@/components/cricket/ui"
import { MiniScorecard } from "@/components/cricket/mini-scorecard"
import { ArticleCard } from "@/components/cricket/article-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronRight,
  Radio,
  CalendarClock,
  Newspaper,
  Trophy,
  Clock,
  User,
  ArrowRight,
  Images,
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
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ElementType
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-red-600" aria-hidden />
        {Icon && <Icon className="h-4 w-4 text-red-600" />}
        <h2 className="text-sm font-extrabold uppercase tracking-tight sm:text-base">
          {title}
        </h2>
      </div>
      {actionLabel && onAction && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAction}
          className="h-7 gap-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
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

/** Compact horizontal live-match bar (cricket.com.au-style live strip). */
function LiveMatchStrip({ match }: { match: Match }) {
  const navigate = useAppStore((s) => s.navigate)
  const t1 = match.team1
  const t2 = match.team2
  const t1Score = inningsTotal(match, match.team1Id)
  const t2Score = inningsTotal(match, match.team2Id)
  return (
    <button
      onClick={() => navigate("match-detail", match.id)}
      className="group flex w-full flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-shadow hover:shadow-md sm:px-4"
    >
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-red-600">
          Live
        </span>
      </span>
      <FormatPill format={match.format} />
      <span className="hidden text-xs text-muted-foreground sm:inline">
        {match.matchNo}
        {match.series?.shortName ? ` · ${match.series.shortName}` : ""}
      </span>
      <div className="ml-auto flex items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2">
          {t1 && <TeamBadge team={t1} size="sm" />}
          <span className="text-sm font-bold">{t1?.shortName}</span>
          {t1Score && (
            <span className="text-sm font-extrabold tabular-nums">
              {t1Score}
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-muted-foreground">v</span>
        <div className="flex items-center gap-2">
          {t2 && <TeamBadge team={t2} size="sm" />}
          <span className="text-sm font-bold">{t2?.shortName}</span>
          {t2Score && (
            <span className="text-sm font-extrabold tabular-nums">
              {t2Score}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

/** The big featured story — asymmetric split: text card (left) layered over a large image (right). */
function FeaturedHero({ article }: { article: Article }) {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <article
      onClick={() => navigate("article-detail", article.id)}
      className="group relative grid cursor-pointer grid-cols-1 items-stretch overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-lg lg:grid-cols-12"
    >
      {/* Text card — left, layered over the image on large screens */}
      <div className="order-2 flex flex-col justify-center bg-card p-5 shadow-xl ring-1 ring-black/5 lg:order-1 lg:col-span-5 lg:-mr-12 lg:z-10 lg:p-8">
        <span className="inline-flex w-fit items-center rounded-sm bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {article.category}
        </span>
        <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight transition-colors group-hover:text-red-600 sm:text-3xl lg:text-[2rem]">
          {article.title}
        </h2>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {article.excerpt}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {article.author}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {timeAgo(article.publishedAt)}
          </span>
        </div>
        <span className="mt-5 inline-flex w-fit items-center gap-1 text-sm font-bold text-red-600 transition-all group-hover:gap-2">
          Read story
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
      {/* Image — right, the large hero visual */}
      <div className="relative order-1 min-h-[260px] overflow-hidden bg-muted lg:order-2 lg:col-span-7 lg:min-h-[440px]">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-700 to-slate-900 text-slate-400">
            <Newspaper className="h-12 w-12" />
          </div>
        )}
      </div>
    </article>
  )
}

/** A secondary story card — image on top, headline + meta below. */
function SecondaryStoryCard({ article }: { article: Article }) {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <button
      onClick={() => navigate("article-detail", article.id)}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {article.imageUrl ? (
          <img
            src={article.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-slate-700 to-slate-900 text-slate-400">
            <Newspaper className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-sm bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
          {article.category}
        </span>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 font-bold leading-snug transition-colors group-hover:text-red-600">
          {article.title}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            {article.author}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(article.publishedAt)}
          </span>
        </div>
      </div>
    </button>
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
  const { data: matchesData, loading: matchesLoading } = useMatches()
  const { data: featuredArticles, loading: articlesLoadingFeatured } =
    useArticles({ featured: true, pageSize: 12 })
  const { data: allArticles, loading: articlesLoadingAll } = useArticles({ pageSize: 12 })
  const { data: interviewData } = useArticles({ category: "interview", pageSize: 6 })

  const matches = matchesData ?? []
  const liveMatch = matches.find((m) => m.status === "live")

  const completedMatches = useMemo(
    () => matches.filter((m) => m.status === "completed").slice(0, 6),
    [matches]
  )
  const upcomingMatches = useMemo(
    () => matches.filter((m) => m.status === "upcoming").slice(0, 6),
    [matches]
  )

  const featuredItems = featuredArticles?.items ?? []
  const latestItems = allArticles?.items ?? []

  // Featured hero = most recent article that has a hero image; secondary = next 3 with images.
  const withImages = useMemo(
    () => latestItems.filter((a) => a.imageUrl),
    [latestItems]
  )
  const heroStory = withImages[0] ?? featuredItems[0] ?? latestItems[0] ?? null
  const secondaryStories = withImages.slice(1, 4)
  const latestNews = latestItems.slice(0, 8)

  const heroLoading = articlesLoadingFeatured && articlesLoadingAll

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero section — cricket.com.au-style featured story */}
      <section className="space-y-5">
        {/* Live match strip */}
        {matchesLoading ? (
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : liveMatch ? (
          <LiveMatchStrip match={liveMatch} />
        ) : null}

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

      {/* Latest Results */}
      {completedMatches.length > 0 && (
        <section>
          <SectionTitle
            title="Latest Results"
            icon={Trophy}
            actionLabel="All matches"
            onAction={() => navigate("matches")}
          />
          <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
            {matchesLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-40 w-72 shrink-0 rounded-lg"
                  />
                ))
              : completedMatches.map((m) => (
                  <div key={m.id} className="w-72 shrink-0">
                    <MiniScorecard match={m} />
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* Upcoming Matches */}
      {upcomingMatches.length > 0 && (
        <section>
          <SectionTitle
            title="Upcoming Matches"
            icon={CalendarClock}
            actionLabel="Full schedule"
            onAction={() => navigate("schedule")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matchesLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-lg" />
                ))
              : upcomingMatches.map((m) => (
                  <MiniScorecard key={m.id} match={m} />
                ))}
          </div>
        </section>
      )}

      {/* Latest News */}
      <section>
        <SectionTitle
          title="Latest News"
          icon={Newspaper}
          actionLabel="View all"
          onAction={() => navigate("news")}
        />
        {articlesLoadingAll ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {latestNews.map((a) => (
              <ArticleCard key={a.id} article={a} variant="default" />
            ))}
          </div>
        ) : (
          <Card className="grid place-items-center p-6">
            <p className="text-sm text-muted-foreground">No news yet.</p>
          </Card>
        )}
      </section>

      {/* Interviews — styled per the provided sample design */}
      <InterviewsSection articles={interviewData?.items ?? []} />

      {/* Photo Galleries — 4-column card grid (sample design) */}
      <GalleriesSection />
    </div>
  )
}

/* ---- Interviews section (sample-design: navy header + gradient cards + popular sidebar) ---- */

function InterviewsSection({ articles }: { articles: Article[] }) {
  const navigate = useAppStore((s) => s.navigate)
  if (!articles.length) return null
  const hero = articles[0]
  const secondary = articles.slice(1, 3)
  const popular = articles.slice(0, 3)

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
              onClick={() => navigate("article-detail", hero.id)}
            />
          )}
          {secondary.map((a) => (
            <InterviewCard
              key={a.id}
              article={a}
              variant="secondary"
              onClick={() => navigate("article-detail", a.id)}
            />
          ))}
        </div>

        {/* Right: Popular Interviews numbered list */}
        <aside className="lg:col-span-4">
          <div className="mb-5 border-b pb-4">
            <h3 className="text-lg font-bold uppercase tracking-wide text-[#1e2a5e] sm:text-xl">
              Popular Interviews
            </h3>
          </div>
          <ul className="space-y-5">
            {popular.map((a, i) => (
              <li key={a.id}>
                <button
                  onClick={() => navigate("article-detail", a.id)}
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
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  )
}

function InterviewCard({
  article,
  variant,
  onClick,
}: {
  article: Article
  variant: "hero" | "secondary"
  onClick: () => void
}) {
  const hero = variant === "hero"
  return (
    <button
      onClick={onClick}
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
            {timeAgo(article.publishedAt)}
          </time>
        </div>
      </div>
    </button>
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
        <span className="text-[11px] font-extrabold uppercase tracking-wide text-black">
          {photoCount > 0 ? `Photos · ${photoCount}` : "Photos"}
        </span>
        <h3 className="mt-1 line-clamp-2 text-base font-bold leading-snug text-black transition-colors group-hover:text-red-600">
          {gallery.title}
        </h3>
        <time className="mt-1.5 block text-[13px] font-normal text-gray-500">
          {formatShortDate(gallery.createdAt)}
        </time>
      </div>
    </button>
  )
}
