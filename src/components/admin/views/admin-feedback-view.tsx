"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  RefreshCw,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/* ------------------------------- types ------------------------------- */

interface FeedbackRow {
  id: string
  name: string | null
  email: string | null
  category: string | null
  message: string | null
  page: string | null
  createdAt: string | null
}

/* ----------------------------- helpers ----------------------------- */

/** Read the CSRF token from the csrf-token cookie (double-submit pattern). */
function getCSRFToken(): string {
  if (typeof document === "undefined") return ""
  return document.cookie.match(/csrf-token=([^;]+)/)?.[1] || ""
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

async function listFeedback(): Promise<FeedbackRow[]> {
  return jsonOrThrow<FeedbackRow[]>(
    await fetch("/api/feedback", {
      headers: {
        "X-CSRF-Token": getCSRFToken(),
      },
      cache: "no-store",
    })
  )
}

/** Map a category string to a colored badge variant + classes. */
function categoryBadgeClass(category: string | null | undefined): string {
  const c = (category || "").trim().toLowerCase()
  switch (c) {
    case "bug report":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900"
    case "feature request":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900"
    case "content correction":
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900"
    case "general":
    case "other":
    default:
      return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700"
  }
}

/** Format an ISO date string into a readable date + time. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

const SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"

/* ------------------------------- view ------------------------------- */

export function AdminFeedbackView() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const reload = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await listFeedback()
      setRows(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load feedback"
      setError(msg)
      if (silent) toast.error("Failed to refresh feedback", { description: msg })
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const list = rows ?? []

  return (
    <AdminShell title="Feedback" count={rows?.length}>
      {/* Action row — refresh button */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => reload(true)}
          disabled={refreshing || loading}
          className="gap-1.5"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        /* Empty state */
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No feedback yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Submissions from the public feedback form will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Feedback table */
        <Card>
          <CardContent className="p-0">
            <div className={cn("max-h-[70vh] overflow-y-auto", SCROLLBAR)}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-[140px]">Date</TableHead>
                    <TableHead className="w-[140px]">Category</TableHead>
                    <TableHead className="w-[180px]">From</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[180px]">Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((row) => {
                    const isOpen = expanded.has(row.id)
                    const message = row.message || ""
                    const isLong = message.length > 140
                    return (
                      <TableRow key={row.id} className="align-top">
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium",
                              categoryBadgeClass(row.category)
                            )}
                          >
                            {row.category || "General"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {row.name || "Anonymous"}
                          </div>
                          {row.email ? (
                            <a
                              href={`mailto:${row.email}`}
                              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                            >
                              {row.email}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No email
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div
                            className={cn(
                              "text-sm whitespace-pre-wrap break-words",
                              !isOpen && isLong && "line-clamp-3"
                            )}
                          >
                            {message || (
                              <span className="text-muted-foreground italic">
                                (empty)
                              </span>
                            )}
                          </div>
                          {isLong && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-7 gap-1 px-2 text-xs text-muted-foreground"
                              onClick={() => toggleExpanded(row.id)}
                            >
                              {isOpen ? (
                                <>
                                  <ChevronUp className="h-3 w-3" /> Show less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" /> Show more
                                </>
                              )}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.page ? (
                            <a
                              href={row.page}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                              title={row.page}
                            >
                              <span className="max-w-[140px] truncate">
                                {row.page}
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  )
}
