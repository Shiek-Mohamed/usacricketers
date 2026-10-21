/**
 * Tiny structured logger — emits one-line JSON to stdout (server-side only).
 * No external dependency; safe to swap for pino/winston later. In production
 * behind a process manager, these lines are picked up by the host's log
 * shipper (Datadog/CloudWatch/Loki).
 *
 * Usage:
 *   import { logger } from "@/lib/logger"
 *   logger.info("article.created", { id, slug })
 *   logger.error("article.create.failed", { error: String(e) })
 *
 * Wire to an error-reporting service (Sentry) by setting `reportError` below
 * to forward `error` events when a SENTRY_DSN env var is present.
 */

type Level = "info" | "warn" | "error"

function emit(level: Level, event: string, meta?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(meta ?? {}),
  })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
  // Forward errors to an external APM if configured (Sentry etc.). Wire this
  // up by setting SENTRY_DSN + installing @sentry/node — left as a stub so
  // the call site is already in place.
  if (level === "error" && process.env.SENTRY_DSN) {
    // TODO: Sentry.captureMessage(`${event}: ${JSON.stringify(meta)}`)
  }
}

export const logger = {
  info: (event: string, meta?: Record<string, unknown>) => emit("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => emit("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit("error", event, meta),
}

/** Wrap an async API handler so thrown errors are logged + re-thrown. */
export function withLogging<TArgs extends unknown[], TRet>(
  event: string,
  fn: (...args: TArgs) => Promise<TRet>
): (...args: TArgs) => Promise<TRet> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args)
    } catch (e) {
      logger.error(`${event}.failed`, { error: String(e).slice(0, 200) })
      throw e
    }
  }
}
