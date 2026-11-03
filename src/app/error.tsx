"use client"

/**
 * error.tsx — route-level error boundary.
 *
 * Activates when ANY error is thrown during rendering of a page inside the
 * root layout. Unlike global-error.tsx, this one keeps the root layout
 * (header/footer/theme) intact and only replaces the page content with a
 * friendly recoverable error card.
 *
 * This is what prevents the generic "Application error: a client-side
 * exception has occurred" page from ever appearing again.
 */
import { useEffect } from "react"
import { RotateCw, Home, AlertTriangle } from "lucide-react"
import { useAppStore } from "@/lib/store"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const navigate = useAppStore((s) => s.navigate)

  useEffect(() => {
    // Surface the real error in the console + server logs so it's debuggable
    // instead of being hidden behind the generic Next.js crash page.
    console.error("[app-error] Route-level client exception:", error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-8 w-8 text-red-500" strokeWidth={2} />
      </div>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We hit an unexpected error while rendering this page. The details have
        been logged. You can try again, or head back home.
      </p>

      {/* Actionable error detail — no more mystery crashes. */}
      <div className="mt-6 w-full rounded-lg border border-border bg-muted/50 px-4 py-3 text-left">
        <p className="break-words font-mono text-xs text-muted-foreground">
          {error.message || "Unknown error"}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
            digest: {error.digest}
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCw className="h-4 w-4" />
          Try again
        </button>
        <button
          onClick={() => {
            // Reset the error state first, then navigate home.
            reset()
            navigate("home")
          }}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Home className="h-4 w-4" />
          Back to home
        </button>
      </div>
    </div>
  )
}
