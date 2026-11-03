"use client"

/**
 * ViewErrorBoundary — a tight, recoverable error boundary for the SPA view
 * switcher in src/app/page.tsx.
 *
 * Why this exists in ADDITION to app/error.tsx:
 *   The SPA swaps views (home / matches / teams / ...) via Zustand state
 *   without changing the URL route. app/error.tsx only catches errors at the
 *   route level. Without this inner boundary, a crash inside any single view
 *   (e.g. a malformed API response, a null deref in one component) would
 *   bubble all the way up and take out the header, footer, and navigation —
 *   forcing a full page reload.
 *
 *   With this boundary, only the view area shows the error card. The header,
 *   footer, and all navigation stay fully usable, so the user can just click
 *   another menu item and keep going.
 */
import { Component, type ReactNode } from "react"
import { RotateCw, AlertTriangle } from "lucide-react"

interface Props {
  children: ReactNode
  /** Optional label shown in the error card (e.g. "Teams view"). */
  label?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Logged to console so the actual error + component stack is visible
    // for debugging instead of being swallowed by a generic crash page.
    console.error(
      `[ViewErrorBoundary${this.props.label ? `:${this.props.label}` : ""}] view crashed — isolated:`,
      error,
      info.componentStack,
    )
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const { error } = this.state
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-12 text-center">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-7 w-7 text-red-500" strokeWidth={2} />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          This section hit an error
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The rest of the site is still working — use the menu to go somewhere
          else, or try loading this section again.
        </p>
        {error?.message && (
          <div className="mt-5 w-full break-words rounded-lg border border-border bg-muted/50 px-4 py-3 text-left font-mono text-xs text-muted-foreground">
            {error.message}
          </div>
        )}
        <button
          onClick={this.reset}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCw className="h-4 w-4" />
          Retry this section
        </button>
      </div>
    )
  }
}
