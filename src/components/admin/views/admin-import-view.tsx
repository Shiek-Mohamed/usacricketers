"use client"

import { useRef, useState } from "react"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DownloadCloud,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Search,
  Square,
  Globe,
  Images,
} from "lucide-react"
import { toast } from "sonner"

interface ScanResult {
  totalPages: number
  perPage: number
  estimatedTotal: number
  sampleSlugs: string[]
}

interface ChunkReport {
  found: number
  imported: number
  updated: number
  failed: number
  totalPages: number
  pageProcessed: number
  errors: string[]
  error?: string
}

interface RunningTotals {
  imported: number
  updated: number
  failed: number
  pagesDone: number
}

const CHUNK_SIZE = 5 // archive pages per API call (~65 articles, ~2 min, well under the 5-min cap)

export function AdminImportView() {
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<ScanResult | null>(null)

  const [pageStart, setPageStart] = useState(1)
  const [pageEnd, setPageEnd] = useState(244)
  const [order, setOrder] = useState<"oldest" | "newest">("oldest")
  const [downloadImages, setDownloadImages] = useState(true)

  const [running, setRunning] = useState(false)
  const [totals, setTotals] = useState<RunningTotals | null>(null)
  const [progress, setProgress] = useState(0)
  const [recentErrors, setRecentErrors] = useState<string[]>([])
  const [currentChunk, setCurrentChunk] = useState<string>("")

  // Gallery import state
  const [galPageEnd, setGalPageEnd] = useState(2)
  const [galRunning, setGalRunning] = useState(false)
  const [galReport, setGalReport] = useState<{
    found: number
    imported: number
    updated: number
    failed: number
    errors: string[]
  } | null>(null)

  const cancelRef = useRef(false)

  async function scanSite() {
    setScanning(true)
    setScan(null)
    try {
      const res = await fetch("/api/import-usacricketers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "discover" }),
      })
      const data: ScanResult = await res.json()
      if (res.ok) {
        setScan(data)
        setPageEnd(data.totalPages)
        toast.success(
          `Found ${data.totalPages} archive pages · ~${data.estimatedTotal} articles`
        )
      } else {
        toast.error("Scan failed")
      }
    } catch (e) {
      toast.error("Scan failed", { description: String(e) })
    } finally {
      setScanning(false)
    }
  }

  async function runFullImport() {
    if (!scan) {
      toast.error("Scan the site first")
      return
    }
    const start = Math.max(1, pageStart)
    const end = Math.min(scan.totalPages, pageEnd)
    if (end < start) {
      toast.error("End page must be ≥ start page")
      return
    }

    setRunning(true)
    cancelRef.current = false
    setTotals({ imported: 0, updated: 0, failed: 0, pagesDone: 0 })
    setProgress(0)
    setRecentErrors([])
    setCurrentChunk("")

    const acc: RunningTotals = { imported: 0, updated: 0, failed: 0, pagesDone: 0 }
    const totalChunks = Math.ceil((end - start + 1) / CHUNK_SIZE)
    let chunkIndex = 0

    // Build the list of chunk [lo, hi] page ranges in the requested order.
    // Oldest-first (chronological): page 244 → 1, so the first chunk is the
    // highest page range and we send descending ranges to the API.
    // Newest-first: page 1 → 244, ascending.
    const chunks: [number, number][] = []
    if (order === "oldest") {
      for (let cs = end; cs >= start; cs -= CHUNK_SIZE) {
        const ce = Math.max(start, cs - CHUNK_SIZE + 1)
        // send descending range (cs > ce) so the API processes oldest first
        chunks.push([cs, ce])
      }
    } else {
      for (let cs = start; cs <= end; cs += CHUNK_SIZE) {
        const ce = Math.min(end, cs + CHUNK_SIZE - 1)
        chunks.push([cs, ce])
      }
    }

    for (const [cs, ce] of chunks) {
      if (cancelRef.current) {
        toast.info("Import stopped")
        break
      }
      setCurrentChunk(`${Math.min(cs, ce)}–${Math.max(cs, ce)}`)
      try {
        const res = await fetch("/api/import-usacricketers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "import",
            pageStart: cs,
            pageEnd: ce,
            downloadImages,
          }),
        })
        const data: ChunkReport = await res.json()
        acc.imported += data.imported
        acc.updated += data.updated
        acc.failed += data.failed
        acc.pagesDone += Math.abs(cs - ce) + 1
        setTotals({ ...acc })
        chunkIndex++
        setProgress(Math.round((chunkIndex / totalChunks) * 100))
        if (data.errors.length > 0) {
          setRecentErrors((prev) =>
            [...data.errors.slice(-3), ...prev].slice(0, 8)
          )
        }
      } catch (e) {
        acc.failed += 1
        setTotals({ ...acc })
        setRecentErrors((prev) =>
          [`chunk ${cs}-${ce}: ${String(e).slice(0, 80)}`, ...prev].slice(0, 8)
        )
      }
    }
    setCurrentChunk("")

    setRunning(false)
    if (!cancelRef.current) {
      toast.success(
        `Import complete: ${acc.imported} new, ${acc.updated} updated, ${acc.failed} failed`
      )
    }
  }

  function stopImport() {
    cancelRef.current = true
    setRunning(false)
  }

  async function runGalleryImport() {
    setGalRunning(true)
    setGalReport(null)
    try {
      const res = await fetch("/api/import-galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageStart: 1, pageEnd: galPageEnd, limit: 50 }),
      })
      const data = await res.json()
      setGalReport(data)
      if (res.ok) {
        toast.success(
          `Galleries: ${data.imported} new, ${data.updated} updated, ${data.failed} failed`
        )
      } else {
        toast.error("Gallery import failed", { description: data.error })
      }
    } catch (e) {
      toast.error("Gallery import failed", { description: String(e) })
    } finally {
      setGalRunning(false)
    }
  }

  return (
    <AdminShell title="Import from usacricketers.com">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-emerald-600" />
            Migrate stories from usacricketers.com
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            The source site has no WordPress REST API, RSS feed, or sitemap, so
            the importer <strong>scrapes</strong> the public{" "}
            <code>/news.php?page=N</code> archive (one page per chunk) and each{" "}
            <code>/news-detail.php?slug=…</code> article. It extracts the title,
            body and images, downloads the images to{" "}
            <code>/uploads/</code>, converts the HTML body to markdown, and
            upserts by slug. Re-running the same range updates existing articles.
          </p>

          {/* Step 1: scan */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wide">
                1 · Scan the archive
              </h3>
              <Button
                onClick={scanSite}
                disabled={scanning || running}
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {scanning ? "Scanning…" : "Scan site"}
              </Button>
            </div>
            {scan && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">
                  {scan.totalPages} archive pages
                </Badge>
                <Badge variant="secondary">
                  ~{scan.perPage} per page
                </Badge>
                <Badge className="bg-emerald-600 text-white">
                  ~{scan.estimatedTotal} articles total
                </Badge>
              </div>
            )}
            {!scan && (
              <p className="text-xs text-muted-foreground">
                Click <strong>Scan site</strong> to discover how many articles
                exist before importing.
              </p>
            )}
          </div>

          {/* Step 2: import range */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide">
              2 · Import a page range
            </h3>
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="from">From page</Label>
                <Input
                  id="from"
                  type="number"
                  min={1}
                  max={scan?.totalPages ?? 244}
                  value={pageStart}
                  onChange={(e) =>
                    setPageStart(
                      Math.max(1, Number(e.target.value) || 1)
                    )
                  }
                  disabled={running}
                  className="w-28"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="to">To page</Label>
                <Input
                  id="to"
                  type="number"
                  min={1}
                  max={scan?.totalPages ?? 244}
                  value={pageEnd}
                  onChange={(e) =>
                    setPageEnd(Math.max(1, Number(e.target.value) || 1))
                  }
                  disabled={running}
                  className="w-28"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="order">Order</Label>
                <Select
                  value={order}
                  onValueChange={(v) => setOrder(v as "oldest" | "newest")}
                  disabled={running}
                >
                  <SelectTrigger id="order" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oldest">
                      Oldest first (chronological)
                    </SelectItem>
                    <SelectItem value="newest">Newest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-1.5">
                <Switch
                  id="dl-img"
                  checked={downloadImages}
                  onCheckedChange={setDownloadImages}
                  disabled={running}
                />
                <Label htmlFor="dl-img" className="text-sm cursor-pointer">
                  Download images
                </Label>
              </div>
              <div className="ml-auto flex gap-2">
                {running ? (
                  <Button
                    onClick={stopImport}
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                  >
                    <Square className="h-4 w-4" /> Stop
                  </Button>
                ) : (
                  <Button
                    onClick={runFullImport}
                    disabled={!scan}
                    size="sm"
                    className="gap-1.5"
                  >
                    <DownloadCloud className="h-4 w-4" />
                    {scan
                      ? `Import pages ${pageStart}–${pageEnd}`
                      : "Scan first"}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Imports in chunks of {CHUNK_SIZE} archive pages per request (≈
              {CHUNK_SIZE * 13} articles per chunk).{" "}
              {order === "oldest"
                ? "Oldest-first: page 244 → 1 (chronological order)."
                : "Newest-first: page 1 → 244."}{" "}
              Run it in the background and keep this tab open —{" "}
              {scan ? `${scan.totalPages} pages` : "244 pages"} takes several
              minutes. You can stop and resume anytime; already-imported
              articles are updated, not duplicated.
            </p>
            {downloadImages && (
              <p className="text-xs text-amber-600">
                ⚠️ Downloading images for the full archive (~3,000 articles) will
                use several GB of disk. Turn off “Download images” to keep
                images on usacricketers.com’s URLs instead (faster, no disk use).
              </p>
            )}
          </div>

          {/* Step 3: progress */}
          {totals && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  {running ? "Importing…" : "Import finished"}
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {progress}%
                  {running && currentChunk && ` · page ${currentChunk}`}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className="bg-emerald-600 text-white">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> {totals.imported} new
                </Badge>
                <Badge variant="secondary">{totals.updated} updated</Badge>
                {totals.failed > 0 && (
                  <Badge className="bg-red-600 text-white">
                    <XCircle className="mr-1 h-3 w-3" /> {totals.failed} failed
                  </Badge>
                )}
                {scan && (
                  <Badge variant="outline">
                    {totals.pagesDone}/{Math.min(scan.totalPages, pageEnd) - pageStart + 1} pages
                  </Badge>
                )}
              </div>
              {recentErrors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    recent errors
                  </summary>
                  <ul className="mt-2 space-y-1 text-red-600 max-h-32 overflow-y-auto">
                    {recentErrors.map((e, i) => (
                      <li key={i} className="font-mono break-all">
                        {e}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <a
              href="https://usacricketers.com/news.php"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              usacricketers.com/news.php <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Gallery Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Images className="h-4 w-4 text-amber-600" />
            Import Photo Galleries from usacricketers.com
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This importer scrapes the{" "}
            <code>/gallery.php</code> listing + each{" "}
            <code>/gallery-detail.php?slug=…</code> page. It extracts the
            gallery title, downloads all photos to{" "}
            <code>/uploads/</code>, and saves the gallery with its photos.
            Re-running updates existing galleries (matched by slug).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="gal-pages">Gallery listing pages</Label>
              <Input
                id="gal-pages"
                type="number"
                min={1}
                max={10}
                value={galPageEnd}
                onChange={(e) =>
                  setGalPageEnd(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-32"
                disabled={galRunning}
              />
            </div>
            <Button
              onClick={runGalleryImport}
              disabled={galRunning}
              className="gap-2"
            >
              {galRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <DownloadCloud className="h-4 w-4" />
              )}
              {galRunning ? "Importing…" : `Import galleries (pages 1–${galPageEnd})`}
            </Button>
            <a
              href="https://usacricketers.com/gallery.php"
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              usacricketers.com/gallery.php <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {galReport && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{galReport.found} found</Badge>
                <Badge className="bg-emerald-600 text-white">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> {galReport.imported} new
                </Badge>
                <Badge variant="secondary">{galReport.updated} updated</Badge>
                {galReport.failed > 0 && (
                  <Badge className="bg-red-600 text-white">
                    <XCircle className="mr-1 h-3 w-3" /> {galReport.failed} failed
                  </Badge>
                )}
              </div>
              {galReport.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    {galReport.errors.length} error(s)
                  </summary>
                  <ul className="mt-2 space-y-1 text-red-600 max-h-32 overflow-y-auto">
                    {galReport.errors.map((e, i) => (
                      <li key={i} className="font-mono break-all">
                        {e}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  )
}
