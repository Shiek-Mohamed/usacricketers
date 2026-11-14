"use client"

import { cn } from "@/lib/utils"

/**
 * PageNumbers — Material-style pagination bar.
 *
 *   «  ‹  |  1  2  [3]  4  5  |  ›  »
 *   Showing 21 - 40 of 628
 *
 * Features:
 *   - First page («) and Last page (») buttons
 *   - Previous (‹) and Next (›) arrow buttons
 *   - Page numbers with current page in bold
 *   - Ellipsis (...) for large page counts
 *   - White pill container with dividers
 *   - "Showing X - Y of Z" summary below
 *   - Disabled state (gray) for first/prev when on page 1, next/last when on last page
 */

export function PageNumbers({
  page,
  totalPages,
  pageSize = 10,
  total,
  loading,
  onGoTo,
}: {
  page: number
  totalPages: number
  pageSize?: number
  total?: number
  loading?: boolean
  onGoTo: (page: number) => void
}) {
  if (totalPages <= 1) return null

  // Calculate which page numbers to show
  const pages: (number | "...")[] = []
  const maxVisible = 5

  if (totalPages <= maxVisible + 2) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push("...")
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (page < totalPages - 2) pages.push("...")
    pages.push(totalPages)
  }

  // Calculate "Showing X - Y of Z"
  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total ?? page * pageSize)

  const btnBase =
    "grid place-items-center transition-colors select-none"
  const btnSize = "h-9 w-9 text-sm"
  const enabled = "text-blue-600 hover:bg-blue-50 cursor-pointer"
  const disabled = "text-gray-300 cursor-default"

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Pagination bar — white pill with dividers */}
      <div className="inline-flex items-center rounded-lg border bg-white shadow-sm">
        {/* First page */}
        <button
          onClick={() => page > 1 && !loading && onGoTo(1)}
          disabled={page <= 1 || loading}
          className={cn(btnBase, btnSize, "rounded-l-lg", page <= 1 ? disabled : enabled)}
          aria-label="First page"
        >
          «
        </button>

        {/* Previous */}
        <button
          onClick={() => page > 1 && !loading && onGoTo(page - 1)}
          disabled={page <= 1 || loading}
          className={cn(btnBase, btnSize, page <= 1 ? disabled : enabled)}
          aria-label="Previous page"
        >
          ‹
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200" />

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              className="grid h-9 w-9 place-items-center text-sm text-gray-400 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => !loading && onGoTo(p)}
              disabled={loading}
              className={cn(
                btnBase,
                btnSize,
                p === page
                  ? "font-bold text-gray-900"
                  : "text-gray-600 hover:bg-gray-50 cursor-pointer"
              )}
              aria-label={`Go to page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}

        {/* Divider */}
        <div className="h-5 w-px bg-gray-200" />

        {/* Next */}
        <button
          onClick={() => page < totalPages && !loading && onGoTo(page + 1)}
          disabled={page >= totalPages || loading}
          className={cn(btnBase, btnSize, page >= totalPages ? disabled : enabled)}
          aria-label="Next page"
        >
          ›
        </button>

        {/* Last page */}
        <button
          onClick={() => page < totalPages && !loading && onGoTo(totalPages)}
          disabled={page >= totalPages || loading}
          className={cn(btnBase, btnSize, "rounded-r-lg", page >= totalPages ? disabled : enabled)}
          aria-label="Last page"
        >
          »
        </button>
      </div>

      {/* Summary */}
      {typeof total === "number" && (
        <p className="text-xs text-gray-500">
          Showing <span className="font-medium text-gray-700">{startItem}</span> -{" "}
          <span className="font-medium text-gray-700">{endItem}</span> of{" "}
          <span className="font-medium text-gray-700">{total.toLocaleString()}</span>
        </p>
      )}
    </div>
  )
}
