import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import TurndownService from "turndown"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { db } from "@/lib/db"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export const maxDuration = 300 // one chunk must finish in 5 min

const SITE = "https://usacricketers.com"
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const UA =
  "Mozilla/5.0 (compatible; USACricketers-Importer/1.0; +https://usacricketers.local)"

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
})
turndown.remove("script").remove("style")

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    // @ts-expect-error node fetch supports this
    redirect: "follow" as const,
  })
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  return await res.text()
}

function resolveUrl(src: string): string | null {
  if (!src) return null
  if (src.startsWith("http")) return src
  if (src.startsWith("//")) return "https:" + src
  if (src.startsWith("/")) return SITE + src
  return null
}

function slugToId(s: string): string {
  return (
    s.replace(/[^a-z0-9-]+/gi, "-").slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  )
}

async function downloadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } })
    if (!res.ok) return null
    const ct = res.headers.get("content-type") || ""
    const ext =
      ct.includes("png")
        ? "png"
        : ct.includes("webp")
          ? "webp"
          : ct.includes("gif")
            ? "gif"
            : ct.includes("svg")
              ? "svg"
              : url.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg"
    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })
    const name = `${slugToId(url)}.${ext}`
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(path.join(UPLOAD_DIR, name), buf)
    return `/uploads/${name}`
  } catch {
    return null
  }
}

function parseDate(s: string): Date {
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d
  return new Date()
}

interface ParsedArticle {
  title: string
  dateISO: string
  contentHtml: string
  images: { src: string; alt: string }[]
}

function parseArticle(html: string): ParsedArticle | null {
  const $ = cheerio.load(html)
  const title =
    $(".post-headline").first().text().trim() ||
    $("h1").first().text().trim() ||
    ""
  if (!title) return null
  const dateText = $(".post-meta span").first().text().trim()
  const date = parseDate(dateText)
  let contentHtml = $(".article-body").first().html() || ""
  contentHtml = contentHtml.replace(/<!--[\s\S]*?-->/g, "")
  const images: { src: string; alt: string }[] = []
  $(".article-body img").each((_, el) => {
    const src = $(el).attr("src") || ""
    const alt = $(el).attr("alt") || ""
    if (src) images.push({ src, alt })
  })
  return { title, dateISO: date.toISOString(), contentHtml, images }
}

/** Pull article slugs + the max page number out of an archive page's HTML. */
function parseArchivePage(html: string): { slugs: string[]; maxPage: number } {
  const slugSet = new Set<string>()
  const reSlug = /\/news-detail\.php\?slug=([^"'&]+)/g
  let m: RegExpExecArray | null
  while ((m = reSlug.exec(html)) !== null) {
    slugSet.add(decodeURIComponent(m[1]))
  }
  // pagination links look like /news.php?page=N — find the largest N
  let maxPage = 1
  const rePage = /\?page=(\d+)/g
  while ((m = rePage.exec(html)) !== null) {
    const n = parseInt(m[1], 10)
    if (!isNaN(n) && n > maxPage) maxPage = n
  }
  return { slugs: Array.from(slugSet), maxPage }
}

interface ImportOptions {
  mode?: "discover" | "import" | "homepage"
  pageStart?: number
  pageEnd?: number
  limit?: number
  downloadImages?: boolean
}

export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let opts: ImportOptions = {}
  try {
    opts = (await req.json().catch(() => ({}))) as ImportOptions
  } catch {
    /* ignore */
  }
  const mode = opts.mode || "homepage"
  const downloadImages = opts.downloadImages !== false // default true

  const report = {
    mode,
    found: 0,
    imported: 0,
    updated: 0,
    failed: 0,
    totalPages: 0,
    pageProcessed: 0,
    errors: [] as string[],
  }

  try {
    // ---------- DISCOVER: report the archive size without importing ----------
    if (mode === "discover") {
      const html = await fetchText(`${SITE}/news.php?page=1`)
      const { slugs, maxPage } = parseArchivePage(html)
      report.totalPages = maxPage
      report.found = slugs.length
      return NextResponse.json({
        totalPages: maxPage,
        perPage: slugs.length,
        estimatedTotal: maxPage * slugs.length,
        sampleSlugs: slugs.slice(0, 5),
      })
    }

    // ---------- IMPORT: crawl a page range, fetch + parse each article ----------
    if (mode === "import") {
      // First, find the archive size (so we can clamp + report it).
      const firstHtml = await fetchText(`${SITE}/news.php?page=1`)
      const { maxPage } = parseArchivePage(firstHtml)
      report.totalPages = maxPage

      // Support descending ranges (pageStart > pageEnd) so the UI can request
      // oldest-first: page 244 → 240, then 239 → 235, … (chronological order).
      const reqStart = opts.pageStart ?? 1
      const reqEnd = opts.pageEnd ?? maxPage
      const descending = reqStart > reqEnd
      const lo = Math.max(1, Math.min(reqStart, reqEnd))
      const hi = Math.min(maxPage, Math.max(reqStart, reqEnd))

      // Build the ordered list of archive pages to crawl.
      const pages: number[] = []
      for (let p = lo; p <= hi; p++) pages.push(p)
      if (descending) pages.reverse()

      // Collect slugs across the requested page range, in order.
      const slugList: string[] = []
      for (const p of pages) {
        try {
          const html =
            p === 1 ? firstHtml : await fetchText(`${SITE}/news.php?page=${p}`)
          const { slugs } = parseArchivePage(html)
          slugList.push(...slugs)
          report.pageProcessed = p
        } catch (e) {
          report.errors.push(`archive page ${p}: ${String(e).slice(0, 100)}`)
        }
        // tiny pause between archive pages
        await new Promise((r) => setTimeout(r, 40))
      }
      // Dedupe while preserving order (the same article can appear on
      // adjacent pages near a boundary).
      const seen = new Set<string>()
      const slugs = slugList.filter((s) => {
        if (seen.has(s)) return false
        seen.add(s)
        return true
      })
      report.found = slugs.length

      // Fetch + parse + upsert each article (in chronological order when
      // the page range was descending).
      for (const slug of slugs) {
        try {
          const url = `${SITE}/news-detail.php?slug=${encodeURIComponent(slug)}`
          const html = await fetchText(url)
          const parsed = parseArticle(html)
          if (!parsed) {
            report.failed++
            report.errors.push(`${slug}: could not parse`)
            continue
          }

          // Download each in-body image (or keep the original URL if skipping).
          const rewrites = new Map<string, string>()
          if (downloadImages) {
            for (const img of parsed.images) {
              const abs = resolveUrl(img.src)
              if (!abs) continue
              const local = await downloadImage(abs)
              if (local) rewrites.set(img.src, local)
            }
          }

          let contentHtml = parsed.contentHtml
          for (const [orig, local] of rewrites) {
            contentHtml = contentHtml.split(orig).join(local)
            const abs = resolveUrl(orig)
            if (abs) contentHtml = contentHtml.split(abs).join(local)
          }

          const markdown = turndown
            .turndown(contentHtml)
            .replace(/(!\[[^\]]*\]\([^)]+\))(?=\S)/g, "$1\n\n")
            .trim()

          const excerpt = markdown
            .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
            .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
            .replace(/[#>*`_~]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 180)

          const cleanSlug = slug
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "")

          const existing = await db.article.findUnique({
            where: { slug: cleanSlug },
          })
          const data = {
            title: parsed.title,
            slug: cleanSlug,
            excerpt,
            content: markdown,
            imageUrl: [...rewrites.values()][0] || null,
            imageCaption: parsed.images[0]?.alt || null,
            category: "news",
            author: "USA Cricketers",
            tags: "USA Cricket",
            featured: false,
            published: true,
            publishedAt: new Date(parsed.dateISO),
          }
          if (existing) {
            await db.article.update({ where: { id: existing.id }, data })
            report.updated++
          } else {
            await db.article.create({ data })
            report.imported++
          }
          await new Promise((r) => setTimeout(r, 50))
        } catch (e) {
          report.failed++
          report.errors.push(`${slug}: ${String(e).slice(0, 120)}`)
        }
      }

      return NextResponse.json(report)
    }

    // ---------- HOMEPAGE (legacy): only the articles linked on / ----------
    // Backward-compatible behaviour: scrape the homepage for slugs.
    const home = await fetchText(SITE + "/")
    const { slugs } = parseArchivePage(home)
    report.found = slugs.length
    const batch = slugs.slice(0, Math.min(50, Math.max(1, opts.limit ?? 15)))

    for (const slug of batch) {
      try {
        const url = `${SITE}/news-detail.php?slug=${encodeURIComponent(slug)}`
        const html = await fetchText(url)
        const parsed = parseArticle(html)
        if (!parsed) {
          report.failed++
          report.errors.push(`${slug}: could not parse`)
          continue
        }
        const rewrites = new Map<string, string>()
        if (downloadImages) {
          for (const img of parsed.images) {
            const abs = resolveUrl(img.src)
            if (!abs) continue
            const local = await downloadImage(abs)
            if (local) rewrites.set(img.src, local)
          }
        }
        let contentHtml = parsed.contentHtml
        for (const [orig, local] of rewrites) {
          contentHtml = contentHtml.split(orig).join(local)
          const abs = resolveUrl(orig)
          if (abs) contentHtml = contentHtml.split(abs).join(local)
        }
        const markdown = turndown
          .turndown(contentHtml)
          .replace(/(!\[[^\]]*\]\([^)]+\))(?=\S)/g, "$1\n\n")
          .trim()
        const excerpt = markdown
          .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
          .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
          .replace(/[#>*`_~]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 180)
        const cleanSlug = slug
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
        const existing = await db.article.findUnique({
          where: { slug: cleanSlug },
        })
        const data = {
          title: parsed.title,
          slug: cleanSlug,
          excerpt,
          content: markdown,
          imageUrl: [...rewrites.values()][0] || null,
          imageCaption: parsed.images[0]?.alt || null,
          category: "news",
          author: "USA Cricketers",
          tags: "USA Cricket",
          featured: false,
          published: true,
          publishedAt: new Date(parsed.dateISO),
        }
        if (existing) {
          await db.article.update({ where: { id: existing.id }, data })
          report.updated++
        } else {
          await db.article.create({ data })
          report.imported++
        }
        await new Promise((r) => setTimeout(r, 80))
      } catch (e) {
        report.failed++
        report.errors.push(`${slug}: ${String(e).slice(0, 120)}`)
      }
    }
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json(
      { ...report, error: String(e).slice(0, 200) },
      { status: 500 }
    )
  }
}
