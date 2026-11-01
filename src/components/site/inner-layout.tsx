"use client"

import { cn } from "@/lib/utils"

/**
 * Inner-page layout where the top header section (including any large hero
 * image) renders full-width, and the 300px sidebar starts BELOW that header
 * section — beside the main body content.
 *
 *  - `header`: full-width top section (back button, title, hero image, etc.)
 *  - `children`: main body column (fills remaining width next to the sidebar)
 *  - `sidebar`: 300px widget column, begins below the header/large image
 *  - `mainWidth` (px): optional — caps the main column to a readable width
 *    (e.g. articles want a narrower text column). When set, the grid uses
 *    fixed `[mainWidth 300px]` columns and the whole block is centred.
 *
 * On screens smaller than `lg` the body and sidebar stack (body first, sidebar
 * below).
 */
export function InnerPageLayout({
  header,
  children,
  sidebar,
  mainWidth,
  className,
}: {
  header?: React.ReactNode
  children: React.ReactNode
  sidebar?: React.ReactNode
  mainWidth?: number
  className?: string
}) {
  return (
    <div
      className={cn("space-y-6", mainWidth && "mx-auto w-full", className)}
      style={
        mainWidth
          ? ({ maxWidth: `${mainWidth + 300 + 32}px` } as React.CSSProperties)
          : undefined
      }
    >
      {header}
      <div
        className={cn(
          "grid grid-cols-1 gap-8",
          mainWidth
            ? "lg:grid-cols-[var(--inner-main-w)_300px]"
            : "lg:grid-cols-[1fr_300px]"
        )}
        style={
          mainWidth
            ? ({
                // CSS var read by the lg:grid-cols-[...] above.
                ["--inner-main-w" as string]: `${mainWidth}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <main className="min-w-0 max-w-full">{children}</main>
        {sidebar && (
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  )
}

/**
 * A titled sidebar widget card with the brand accent bar.
 */
export function SidebarWidget({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-shadow duration-200 hover:shadow-md",
        className
      )}
    >
      <header className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <h3 className="text-[11px] font-extrabold uppercase tracking-wide">
            {title}
          </h3>
        </div>
        {action}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}
