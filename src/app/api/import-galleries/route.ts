import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { db } from "@/lib/db"
import { requireSiteAdmin } from "@/lib/scorer-auth"
import { rateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const SITE = "https://usacricketers.com"
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const UA =
  "Mozilla/5.0 (compatible; USACricketers-GalleryImporter/1.0; +https://usacricketers.local)"

interface GalleryPhoto {
  src: string
  caption: string
}

function randomName(ext: string): string {
  return (
    Buffer.from(Math.random().toString(36).slice(2) + Date.now().toString(36))
      .toString("hex")
      .slice(0, 16) +
    "." +
    ext
  )
}

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

async function downloadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } })
    if (!res.ok) return null
    const ct = res.headers.get("content-type") || ""
    const ext = ct.includes("png")
      ? "png"
      : ct.includes("webp")
        ? "webp"
        : ct.includes("gif")
          ? "gif"
          : url.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg"
    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })
    const name = randomName(ext)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(path.join(UPLOAD_DIR, name), buf)
    return `/uploads/${name}`
  } catch {
    return null
  }
}

function isLogo(src: string): boolean {
  const s = src.toLowerCase()
  return (
    s.includes("logo") ||
    s.includes("ad8512e2c014") || // the site logo hash
    s.includes("/images/usac") ||
    s.includes("favicon")
  )
}

interface ParsedGallery {
  title: string
  photos: { src: string; alt: string }[]
}

function parseGallery(html: string): ParsedGallery | null {
  const $ = cheerio.load(html)
  const title = $("h1").first().text().trim() || ""
  if (!title) return null
  const photos: { src: string; alt: string }[] = []
  $(".gallery-item img").each((_, el) => {
    const src = $(el).attr("src") || ""
    const alt = $(el).attr("alt") || ""
    if (src && !isLogo(src)) photos.push({ src, alt })
  })
  // Fallback: if no .gallery-item images, try all images in the main content area
  if (photos.length === 0) {
    $("article img, .post-content img, main img").each((_, el) => {
      const src = $(el).attr("src") || ""
      const alt = $(el).attr("alt") || ""
      if (src && !isLogo(src) && !src.includes("avatar")) photos.push({ src, alt })
    })
  }
  return { title, photos }
}

export async function POST(req: NextRequest) {
  // Site-admin only
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // Rate limit
  const limited = rateLimit(req, { limit: 10, windowMs: 60_000 })
  if (limited) return limited

  let limit = 12
  let pageStart = 1
  let pageEnd = 1
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.limit === "number") limit = Math.min(50, Math.max(1, body.limit))
    if (typeof body.pageStart === "number") pageStart = Math.max(1, body.pageStart)
    if (typeof body.pageEnd === "number") pageEnd = Math.max(pageStart, body.pageEnd)
  } catch {
    /* ignore */
  }

  const report = {
    found: 0,
    imported: 0,
    updated: 0,
    failed: 0,
    errors: [] as string[],
  }

  try {
    // 1. Discover gallery slugs from gallery listing pages
    const slugSet = new Set<string>()
    for (let p = pageStart; p <= pageEnd; p++) {
      try {
        const html = await fetchText(`${SITE}/gallery.php?page=${p}`)
        const re = /\/gallery-detail\.php\?slug=([^"'&]+)/g
        let m: RegExpExecArray | null
        while ((m = re.exec(html)) !== null) {
          slugSet.add(decodeURIComponent(m[1]))
        }
      } catch (e) {
        report.errors.push(`gallery listing page ${p}: ${String(e).slice(0, 100)}`)
      }
      await new Promise((r) => setTimeout(r, 40))
    }
    const slugs = Array.from(slugSet)
    report.found = slugs.length
    const batch = slugs.slice(0, limit)

    // 2. For each gallery: fetch → parse → download images → upsert
    for (const slug of batch) {
      try {
        const url = `${SITE}/gallery-detail.php?slug=${encodeURIComponent(slug)}`
        const html = await fetchText(url)
        const parsed = parseGallery(html)
        if (!parsed) {
          report.failed++
          report.errors.push(`${slug}: could not parse`)
          continue
        }

        // Download each photo
        const photos: GalleryPhoto[] = []
        for (const img of parsed.photos) {
          const abs = resolveUrl(img.src)
          if (!abs) continue
          const local = await downloadImage(abs)
          if (local) photos.push({ src: local, caption: img.alt || "" })
        }

        const cleanSlug = slug
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")

        const existing = await db.gallery.findUnique({ where: { slug: cleanSlug } })
        const data = {
          title: parsed.title,
          slug: cleanSlug,
          description: "",
          coverImage: photos[0]?.src || "",
          photos: JSON.stringify(photos),
          published: true,
        }
        if (existing) {
          await db.gallery.update({ where: { id: existing.id }, data })
          report.updated++
        } else {
          await db.gallery.create({ data })
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
