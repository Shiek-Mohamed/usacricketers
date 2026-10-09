"use client"

import { cn } from "@/lib/utils"

const SCROLLBAR_CLASS =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"

/**
 * Inner-page layout where the top header section (including any large hero
 * image) renders full-width, and the 300px sidebar starts BELOW that header
 * section — beside the main body content.
 *
 *  - `header`: full-width top section (back button, title, hero image, etc.)
 *  - `children`: main body column (fills remaining width next to the sidebar)
 *  - `sidebar`: 300px widget column, begins below the header/large image
 *
 * On screens smaller than `lg` the body and sidebar stack (body first, sidebar
 * below).
 */
export function InnerPageLayout({
  header,
  children,
  sidebar,
  className,
}: {
  header?: React.ReactNode
  children: React.ReactNode
  sidebar?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {header}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
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
