"use client"

import { useGalleries } from "@/lib/use-data"
import { useAppStore } from "@/lib/store"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Images, ChevronRight } from "lucide-react"
import type { Gallery } from "@/lib/types"

export function PhotosView() {
  const { data, loading } = useGalleries()
  const navigate = useAppStore((s) => s.navigate)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Images className="h-6 w-6 text-red-600" />
          Photos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Galleries from the cricket world — action, celebrations, and behind the scenes.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <Card className="grid min-h-[200px] place-items-center p-6">
          <p className="text-sm text-muted-foreground">No galleries yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((g) => (
            <GalleryCard key={g.id} gallery={g} onClick={() => navigate("gallery-detail", g.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function GalleryCard({ gallery, onClick }: { gallery: Gallery; onClick: () => void }) {
  const count = gallery.photos.length
  return (
    <button onClick={onClick} className="group block w-full text-left">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        {gallery.coverImage ? (
          <img src={gallery.coverImage} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : gallery.photos[0]?.src ? (
          <img src={gallery.photos[0].src} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center bg-slate-800 text-slate-500">
            <Images className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 p-4">
          <span className="rounded bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
            {count} photo{count !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <h3 className="mt-2 font-bold leading-snug transition-colors group-hover:text-red-600">
        {gallery.title}
      </h3>
      {gallery.description && (
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{gallery.description}</p>
      )}
      <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 transition-all group-hover:gap-1.5">
        View gallery <ChevronRight className="h-3 w-3" />
      </span>
    </button>
  )
}
