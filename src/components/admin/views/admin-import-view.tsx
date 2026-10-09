"use client"

import { useState } from "react"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DownloadCloud, Loader2, ExternalLink, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"

interface ImportReport {
  found: number
  imported: number
  updated: number
  failed: number
  errors: string[]
  error?: string
}

export function AdminImportView() {
  const [limit, setLimit] = useState(15)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)

  async function runImport() {
    setRunning(true)
    setReport(null)
    try {
      const res = await fetch("/api/import-usacricketers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      })
      const data: ImportReport = await res.json()
      setReport(data)
      if (res.ok) {
        toast.success(
          `Imported ${data.imported} new, updated ${data.updated}, failed ${data.failed}`
        )
      } else {
        toast.error("Import failed", { description: data.error })
      }
    } catch (e) {
      toast.error("Import failed", { description: String(e) })
    } finally {
      setRunning(false)
    }
  }

  return (
    <AdminShell title="Import from WordPress">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DownloadCloud className="h-4 w-4 text-emerald-600" />
            Import stories from usacricketers.com
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This site&apos;s WordPress REST API and RSS feed are disabled, so the
            importer <strong>scrapes</strong> the public article pages instead
            (discovers slugs from the homepage, fetches each{" "}
            <code>/news-detail.php?slug=…</code> page, extracts the title, body
            and images, downloads the images to{" "}
            <code>/uploads/</code>, converts the HTML body to markdown, and saves
            the article). Re-running updates existing articles (matched by slug).
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="limit">How many articles</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={50}
                value={limit}
                onChange={(e) =>
                  setLimit(Math.min(50, Math.max(1, Number(e.target.value) || 1)))
                }
                className="w-32"
              />
            </div>
            <Button
              onClick={runImport}
              disabled={running}
              className="gap-2"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <DownloadCloud className="h-4 w-4" />
              )}
              {running ? "Importing…" : "Run import"}
            </Button>
            <a
              href="https://usacricketers.com/"
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              usacricketers.com <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {report && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{report.found} found on homepage</Badge>
                <Badge className="bg-emerald-600 text-white">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> {report.imported} new
                </Badge>
                <Badge variant="secondary">{report.updated} updated</Badge>
                {report.failed > 0 && (
                  <Badge className="bg-red-600 text-white">
                    <XCircle className="mr-1 h-3 w-3" /> {report.failed} failed
                  </Badge>
                )}
              </div>
              {report.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    {report.errors.length} error(s)
                  </summary>
                  <ul className="mt-2 space-y-1 text-red-600">
                    {report.errors.map((e, i) => (
                      <li key={i} className="font-mono">
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
