"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * PageNumbers — pagination with clickable page numbers + prev/next arrows.
 *
 * Shows up to 7 page buttons with ellipsis for large page counts:
 *   ← 1 2 [3] 4 5 ... 10 →
 *
 * Usage:
 *   <PageNumbers page={3} totalPages={10} onGoTo={(p) => setPage(p)} />
 */
export function PageNumbers({
  page,
  totalPages,
  loading,
  onGoTo,
}: {
  page: number
  totalPages: number
  loading?: boolean
  onGoTo: (page: number) => void
}) {
  if (totalPages <= 1) return null

  // Calculate which page numbers to show
  const pages: (number | "...")[] = []
  const maxVisible = 5 // max numbered buttons shown at once

  if (totalPages <= maxVisible + 2) {
    // Show all pages if total is small
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    // Always show page 1
    pages.push(1)

    if (page > 3) {
      pages.push("...")
    }

    // Show pages around current
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (page < totalPages - 2) {
      pages.push("...")
    }

    // Always show last page
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center gap-1">
      {/* Previous button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onGoTo(page - 1)}
        disabled={page <= 1 || loading}
        className="h-8 w-8"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>

      {/* Page number buttons */}
      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="px-1.5 text-sm text-muted-foreground select-none"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onGoTo(p)}
            disabled={loading}
            className={cn(
              "grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm font-medium transition-colors",
              p === page
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            )}
            aria-label={`Go to page ${p}`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}

      {/* Next button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onGoTo(page + 1)}
        disabled={page >= totalPages || loading}
        className="h-8 w-8"
        aria-label="Next page"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
