"use client"

import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { useAppStore } from "@/lib/store"
import { useMatches, useVideo, useVideos } from "@/lib/use-data"
import type { Video } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { VideoCard } from "@/components/site/views/videos-view"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { RecentResultsWidget } from "@/components/site/sidebar-widgets"
import {
  ArrowLeft,
  Clock,
  User,
  Info,
  Play,
  ExternalLink,
} from "lucide-react"

function formatDate(iso: string): string {
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

/* ------------------------------- Player ------------------------------- */

function VideoPlayer({ video }: { video: Video }) {
  if (video.source === "upload") {
    return (
      <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-black">
        <video
          controls
          poster={video.thumbnailUrl || undefined}
          className="h-full w-full"
          preload="metadata"
        >
          <source src={video.videoUrl} />
          <p className="p-4 text-sm text-white">
            Your browser does not support embedded videos. Download:{" "}
            <a
              href={video.videoUrl}
              className="underline text-white"
              download
            >
              {video.videoUrl.split("/").pop()}
            </a>
          </p>
        </video>
      </div>
    )
  }

  // YouTube embed
  return (
    <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-black">
      <iframe
        src={video.videoUrl}
        title={video.title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}

/* ----------------------------- Markdown ------------------------------ */

function VideoMarkdown({ content }: { content: string }) {
  if (!content || !content.trim()) return null
  return (
    <div className="text-foreground">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 text-2xl font-extrabold leading-tight sm:text-3xl">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-3 text-xl font-bold leading-tight sm:text-2xl">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-2 text-lg font-bold leading-tight sm:text-xl">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-4 mb-2 text-base font-semibold leading-tight">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-foreground/90">{children}</p>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-red-600 underline underline-offset-2 hover:text-red-700"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 ml-5 list-disc space-y-1.5 leading-relaxed">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 ml-5 list-decimal space-y-1.5 leading-relaxed">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-4 border-l-4 border-primary pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-border" />,
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-4 text-sm">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/60">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-2">{children}</td>
          ),
          img: ({ src, alt }) => {
            const caption = alt && alt.trim() ? alt : ""
            return (
              <figure className="my-6">
                <img
                  src={typeof src === "string" ? src : undefined}
                  alt={caption}
                  className="block w-full rounded-lg"
                />
                {caption ? (
                  <figcaption className="mt-0.5 text-[0.8rem] leading-[1.525] text-black">
                    <span>{caption}</span>
                  </figcaption>
                ) : null}
              </figure>
            )
          },
        }}
        rehypePlugins={[rehypeRaw]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/* ------------------------------ Skeleton ----------------------------- */

function VideoDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="aspect-[16/9] w-full rounded-lg" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------ Related ------------------------------ */

function RelatedVideos({
  current,
  videos,
}: {
  current: string
  videos: Video[]
}) {
  const navigate = useAppStore((s) => s.navigate)
  const related = videos.filter((v) => v.id !== current).slice(0, 4)
  if (related.length === 0) return null
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-red-600" aria-hidden />
        <h2 className="text-sm font-extrabold uppercase tracking-tight sm:text-base">
          Related Videos
        </h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        {related.map((v) => (
          <div
            key={v.id}
            className="w-[260px] shrink-0 sm:w-[280px]"
          >
            <VideoCard
              video={v}
              onOpen={() => navigate("video-detail", v.id)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------- View -------------------------------- */

export function VideoDetailView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data, loading, error } = useVideo(id)
  const { data: related } = useVideos({ limit: 5 })
  // Standard sidebar needs recent match results — fetch them at the view level.
  const { data: matchesData } = useMatches()

  const sidebar = (
    <>
      <RecentResultsWidget matches={matchesData ?? []} />
      <CustomSidebarBlocks placement="video" />
    </>
  )

  if (loading) {
    return (
      <InnerPageLayout sidebar={sidebar}>
        <VideoDetailSkeleton />
      </InnerPageLayout>
    )
  }

  if (error || !data) {
    return (
      <InnerPageLayout sidebar={sidebar}>
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("videos")}
            className="-ml-2 gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Back to videos
          </Button>
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertTitle>Video not found</AlertTitle>
            <AlertDescription>
              {error || "This video may have been removed or is no longer available."}
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("videos")}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> All videos
          </Button>
        </div>
      </InnerPageLayout>
    )
  }

  const video: Video = data
  const tags = video.tags
    ? video.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : []

  return (
    <InnerPageLayout
      header={
        /* Hero section — back button + player + title + meta (full-width top) */
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("videos")}
            className="-ml-2 gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Videos
          </Button>

          <VideoPlayer video={video} />

          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">
                {video.category}
              </Badge>
              {video.source === "youtube" ? (
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View on YouTube
                </a>
              ) : null}
            </div>
            <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">
              {video.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {video.author && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {video.author}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(video.publishedAt)}
              </span>
              {video.duration && (
                <span className="inline-flex items-center gap-1">
                  <Play className="h-3 w-3 fill-current" />
                  {video.duration}
                </span>
              )}
            </div>
          </header>
        </div>
      }
      sidebar={sidebar}
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Description */}
        {video.description && video.description.trim() ? (
          <div className="border-t pt-4">
            <VideoMarkdown content={video.description} />
          </div>
        ) : null}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-xs font-semibold text-muted-foreground">
              Tags:
            </span>
            {tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        )}

        {/* Related videos */}
        <div className="border-t pt-4">
          <RelatedVideos
            current={video.id}
            videos={related ?? []}
          />
        </div>
      </div>
    </InnerPageLayout>
  )
}
