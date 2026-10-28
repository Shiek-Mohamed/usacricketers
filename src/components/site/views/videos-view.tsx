"use client"

import { useState } from "react"
import { useVideos } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Video } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Play } from "lucide-react"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { NewsletterWidget } from "@/components/site/sidebar-widgets"

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "Highlights", label: "Highlights" },
  { key: "Interviews", label: "Interviews" },
  { key: "Analysis", label: "Analysis" },
  { key: "Features", label: "Features" },
]

/** Format an ISO date as e.g. "Mar 10, 2025". */
function formatVideoDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

/**
 * Pick the best available thumbnail URL for a video:
 *  - custom thumbnailUrl if set
 *  - else YouTube hqdefault if it's a YouTube video with a known ID
 *  - else "" (caller renders a gray placeholder)
 */
export function videoThumbnailUrl(video: Video): string {
  if (video.thumbnailUrl && video.thumbnailUrl.trim()) return video.thumbnailUrl
  if (video.source === "youtube" && video.youtubeId) {
    return `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`
  }
  return ""
}

/**
 * Shared video card. Used in the Videos listing page AND the homepage
 * "Videos" section. 16:9 thumbnail with a centered play button overlay,
 * a duration badge bottom-right, category + title + date below.
 */
export function VideoCard({
  video,
  onOpen,
}: {
  video: Video
  onOpen: () => void
}) {
  const thumb = videoThumbnailUrl(video)
  return (
    <button
      onClick={onOpen}
      className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded-lg"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center bg-slate-800 text-slate-500">
            <Play className="h-8 w-8" />
          </div>
        )}
        {/* dark gradient for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {/* circular play overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
            <Play className="h-5 w-5 fill-white" />
          </span>
        </div>
        {video.duration && (
          <span
            className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white"
            suppressHydrationWarning
          >
            {video.duration}
          </span>
        )}
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-red-600">
        {video.category}
      </p>
      <h3 className="mt-0.5 line-clamp-2 font-bold leading-snug text-foreground transition-colors group-hover:text-red-600">
        {video.title}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatVideoDate(video.publishedAt)}
      </p>
    </button>
  )
}

function VideosSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[16/9] w-full rounded-lg" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function VideosView() {
  const navigate = useAppStore((s) => s.navigate)
  const [category, setCategory] = useState<string>("all")
  const apiCategory = category && category !== "all" ? category : undefined

  const { data, loading } = useVideos({ category: apiCategory })
  const videos = data ?? []

  return (
    <InnerPageLayout
      header={
        /* Navy header band — matches the Interviews section heading */
        <div className="rounded-lg bg-[#1e2a5e] px-5 py-6 text-white sm:px-8 sm:py-8">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">
            Videos
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Highlights, interviews, analysis and features from the cricket world.
          </p>
        </div>
      }
      sidebar={
        <>
          <NewsletterWidget />
          <CustomSidebarBlocks placement="video" />
        </>
      }
    >
      <div className="space-y-6">
        {/* Category pills */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c.key
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                aria-pressed={active}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <VideosSkeleton />
        ) : videos.length === 0 ? (
          <Card className="grid min-h-[200px] place-items-center p-6">
            <p className="text-sm text-muted-foreground">
              No videos in this category yet.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onOpen={() => navigate("video-detail", v.id)}
              />
            ))}
          </div>
        )}
      </div>
    </InnerPageLayout>
  )
}
