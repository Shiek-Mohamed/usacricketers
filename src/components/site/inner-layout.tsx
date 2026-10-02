"use client"

import { cn } from "@/lib/utils"

const SCROLLBAR_CLASS =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"

/**
 * Inner-page layout that keeps the page at its original (full) width while
 * constraining the readable content to a fixed text column + sidebar:
 *  - Main text column: 650px
 *  - Sidebar widget column: 300px
 * The 650 + 300 block is centred within the page's original wide content area
 * so the inner page keeps the original width it had before the sidebar was
 * added (no artificial narrow cap).
 * On screens smaller than `lg` the two columns stack (main first, sidebar
 * below) and fill the available width.
 */
export function InnerPageLayout({
  children,
  sidebar,
  className,
}: {
  children: React.ReactNode
  sidebar?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[650px_300px] lg:justify-center lg:gap-8">
        <main className="min-w-0 max-w-full">{children}</main>
        {sidebar && (
          <aside
            className={cn(
              "space-y-6 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1",
              SCROLLBAR_CLASS
            )}
          >
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
        "overflow-hidden rounded-lg border bg-card shadow-sm",
        className
      )}
    >
      <header className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-red-600" />
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
