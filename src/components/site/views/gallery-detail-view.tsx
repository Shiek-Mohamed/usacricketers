"use client"

import { useState, useCallback, useEffect } from "react"
import { useGallery } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, X, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { NewsletterWidget } from "@/components/site/sidebar-widgets"

export function GalleryDetailView() {
  const id = useAppStore((s) => s.id)
  const navigate = useAppStore((s) => s.navigate)
  const { data, loading } = useGallery(id)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const next = useCallback(() => setLightboxIdx((i) => (i === null ? i : (i + 1) % (data?.photos.length ?? 1))), [data])
  const prev = useCallback(() => setLightboxIdx((i) => (i === null ? i : (i - 1 + (data?.photos.length ?? 1)) % (data?.photos.length ?? 1))), [data])

  useEffect(() => {
    if (lightboxIdx === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null)
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [lightboxIdx, next, prev])

  if (loading) {
    return (
      <InnerPageLayout
        sidebar={
          <>
            <NewsletterWidget />
            <CustomSidebarBlocks placement="gallery" />
          </>
        }
      >
        <Skeleton className="h-96 w-full rounded-lg" />
      </InnerPageLayout>
    )
  }

  if (!data) {
    return (
      <InnerPageLayout
        sidebar={
          <>
            <NewsletterWidget />
            <CustomSidebarBlocks placement="gallery" />
          </>
        }
      >
        <Card className="grid min-h-[200px] place-items-center p-6">
          <p className="text-sm text-muted-foreground">Gallery not found.</p>
        </Card>
      </InnerPageLayout>
    )
  }

  const photos = data.photos

  return (
    <InnerPageLayout
      header={
        /* Page header — back button + title + description + photo count */
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("photos")} className="-ml-2 gap-1">
            <ArrowLeft className="h-4 w-4" /> All galleries
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{data.title}</h1>
            {data.description && <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      }
      sidebar={
        <>
          <NewsletterWidget />
          <CustomSidebarBlocks placement="gallery" />
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setLightboxIdx(i)}
              className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
            >
              <img src={p.src} alt={p.caption} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
              {p.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="line-clamp-2 text-xs font-semibold text-white">{p.caption}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox — fixed-position overlay, rendered outside the grid flow */}
      {lightboxIdx !== null && photos[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null) }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            className="absolute left-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); prev() }}
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <figure className="mx-auto max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={photos[lightboxIdx].src}
              alt={photos[lightboxIdx].caption}
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />
            {photos[lightboxIdx].caption && (
              <figcaption className="mt-1 text-sm font-semibold leading-[1.525] text-white text-center">
                {photos[lightboxIdx].caption}
              </figcaption>
            )}
            <p className="mt-1 text-center text-xs text-white/50">
              {lightboxIdx + 1} / {photos.length}
            </p>
          </figure>
          <button
            className="absolute right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); next() }}
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </InnerPageLayout>
  )
}
