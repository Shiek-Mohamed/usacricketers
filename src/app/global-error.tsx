"use client"

/**
 * global-error.tsx — the LAST line of defense.
 *
 * This catches errors that bubble all the way up to (or happen inside) the
 * root layout itself. Per Next.js App Router rules it MUST render its own
 * <html> and <body> because it replaces the root layout entirely when it
 * activates.
 *
 * Without this file, a crash in the root layout produces the generic
 * "Application error: a client-side exception has occurred" page.
 */
import { useEffect } from "react"
import { RotateCw, AlertTriangle } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the real error so it shows up in the server logs / browser console
    // instead of being swallowed by the generic error page.
    console.error("[global-error] Uncaught client exception:", error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          background: "#0f1430",
          color: "#fff",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            maxWidth: "640px",
            margin: "0 auto",
            padding: "64px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              borderRadius: "9999px",
              background: "rgba(239, 68, 68, 0.15)",
              marginBottom: "24px",
            }}
          >
            <AlertTriangle
              size={32}
              color="#fca5a5"
              strokeWidth={2}
            />
          </div>

          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              margin: "0 0 12px",
              letterSpacing: "-0.01em",
            }}
          >
            usacricketers<span style={{ color: "#fbbf24" }}>.</span>
          </h1>

          <p
            style={{
              fontSize: "18px",
              fontWeight: 600,
              margin: "0 0 8px",
              color: "#fca5a5",
            }}
          >
            Something went wrong
          </p>

          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.7)",
              margin: "0 0 24px",
            }}
          >
            An unexpected error occurred while loading the page. The site team
            has been notified via the console log. You can try reloading — most
            of the time that clears it.
          </p>

          {/* Show the actual error message so it's actionable, not a mystery.
              The digest is Next.js's stable error id (useful for debugging). */}
          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "12px 16px",
              margin: "0 0 24px",
              fontSize: "12px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: "rgba(255,255,255,0.6)",
              textAlign: "left",
              wordBreak: "break-word",
            }}
          >
            {error.message || "Unknown error"}
            {error.digest ? ` · digest: ${error.digest}` : ""}
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              onClick={() => reset()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "#fbbf24",
                color: "#0f1430",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <RotateCw size={16} />
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
          </div>

          <p
            style={{
              marginTop: "32px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            © {new Date().getFullYear()} USACricketers
          </p>
        </div>
      </body>
    </html>
  )
}
