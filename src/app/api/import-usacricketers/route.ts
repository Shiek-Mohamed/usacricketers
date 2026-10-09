import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import TurndownService from "turndown"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { db } from "@/lib/db"

export const maxDuration = 300 // allow a long-ish import run

const SITE = "https://usacricketers.com"
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const UA =
  "Mozilla/5.0 (compatible; CricinfoCMS-Importer/1.0; +https://cricinfo.local)"

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
})
// Drop noisy inline styles / scripts; keep images so we can localise them.
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
  // hashed, URL-safe filename; keep it short + unique
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
            : "svg".includes(ct)
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
  // e.g. "08 Oct 2026"
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
  // article body
  let contentHtml = $(".article-body").first().html() || ""
  // strip HTML comments (the site has commented-out bylines etc.)
  contentHtml = contentHtml.replace(/<!--[\s\S]*?-->/g, "")
  const images: { src: string; alt: string }[] = []
  $(".article-body img").each((_, el) => {
    const src = $(el).attr("src") || ""
    const alt = $(el).attr("alt") || ""
    if (src) images.push({ src, alt })
  })
  return { title, dateISO: date.toISOString(), contentHtml, images }
}

export async function POST(req: NextRequest) {
  let limit = 15
  try {
    const body = await req.json().catch(() => ({}))
    if (body && typeof body.limit === "number") limit = Math.min(50, Math.max(1, body.limit))
  } catch {
    /* ignore */
  }

  const report = { found: 0, imported: 0, updated: 0, failed: 0, errors: [] as string[] }

  try {
    // 1. Discover article slugs from the homepage.
    const home = await fetchText(SITE + "/")
    const slugSet = new Set<string>()
    const re = /\/news-detail\.php\?slug=([^"'&]+)/g
    let m
    while ((m = re.exec(home)) !== null) {
      slugSet.add(decodeURIComponent(m[1]))
    }
    const slugs = Array.from(slugSet)
    report.found = slugs.length
    const batch = slugs.slice(0, limit)

    // 2. For each article: fetch → parse → download images → convert → upsert.
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

        // Download each in-body image and rewrite its src to a local path.
        const rewrites = new Map<string, string>()
        for (const img of parsed.images) {
          const abs = resolveUrl(img.src)
          if (!abs) continue
          // skip logo/ads by size heuristics is unreliable; rely on being inside .article-body
          const local = await downloadImage(abs)
          if (local) rewrites.set(img.src, local)
        }
        let contentHtml = parsed.contentHtml
        for (const [orig, local] of rewrites) {
          // rewrite both absolute and relative forms
          contentHtml = contentHtml.split(orig).join(local)
          const abs = resolveUrl(orig)
          if (abs) contentHtml = contentHtml.split(abs).join(local)
        }

        const markdown = turndown
          .turndown(contentHtml)
          // Ensure inline images are followed by a blank line so they render
          // as block <figure> images rather than merging into the next paragraph.
          .replace(/(!\[[^\]]*\]\([^)]+\))(?=\S)/g, "$1\n\n")
          .trim()

        // Plain-text excerpt (strip images, links, markdown syntax).
        const excerpt = markdown
          .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
          .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
          .replace(/[#>*`_~]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 180)

        // Build a clean slug (the source slug is already URL-safe).
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "")

        const existing = await db.article.findUnique({ where: { slug: cleanSlug } })
        const data = {
          title: parsed.title,
          slug: cleanSlug,
          excerpt,
          content: markdown,
          imageUrl: [...rewrites.values()][0] || null, // first in-body image as hero
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
        // politeness pause
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
