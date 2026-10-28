/**
 * One-time import script: pulls all videos from usacricketers.com into the
 * local Prisma Video table. Every video on the source site is a YouTube
 * embed — this script scrapes the listing pages, follows pagination,
 * extracts metadata from each detail page, enriches with the YouTube
 * oEmbed endpoint (canonical title + high-quality thumbnail), generates
 * SEO-friendly slugs, and upserts into the database.
 *
 * Idempotent — safe to re-run. Uses slug @unique for upserts so re-running
 * picks up only new videos and updates existing ones in place.
 *
 * Usage:
 *   bun run scripts/import-usacricketers-videos.ts
 *
 * Or via the package.json script:
 *   bun run import:videos
 */

import { PrismaClient } from "@prisma/client"
import * as cheerio from "cheerio"

const SOURCE_BASE = "https://www.usacricketers.com"
const USER_AGENT =
  "Mozilla/5.0 (compatible; USACricketers-ContentMigration/1.0; +bun)"

// Be polite — small delay between requests to the source site.
const DELAY_MS = 200

// Fresh Prisma client without query logging so the console isn't spammed.
const db = new PrismaClient()

interface ListedVideo {
  detailUrl: string
  category: string
  listDate?: string
}

interface VideoDetail {
  youtubeId: string
  embedUrl: string
  title: string
  category: string
  date: string
  description: string
  sourceSlug: string
}

interface YouTubeOEmbed {
  title?: string
  authorName?: string
  thumbnailUrl?: string
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`)
  }
  return await res.text()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
}

function parseDate(s: string): Date | null {
  if (!s) return null
  // Source format: "24 Jul 2026" — Date.parse handles this directly
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed
  return null
}

/**
 * Scrape all video-detail links from the listing pages, following "Next »"
 * pagination until exhausted.
 */
async function scrapeVideoList(): Promise<ListedVideo[]> {
  const all: ListedVideo[] = []
  const seenUrls = new Set<string>()
  let currentUrl: string | null = `${SOURCE_BASE}/videos.php`
  let pageCount = 0

  while (currentUrl) {
    pageCount++
    console.log(`[listing page ${pageCount}] ${currentUrl}`)
    const html = await fetchPage(currentUrl)
    const $ = cheerio.load(html)

    // Each video card is an anchor to video-detail.php?slug=id-XX.
    // The anchor text contains: "▶ HIGHLIGHTS <title> <date>"
    // IMPORTANT: resolve relative URLs against the CURRENT page URL, not SOURCE_BASE —
    // otherwise `?page=2` on /videos.php resolves to /?page=2 (homepage) instead of
    // /videos.php?page=2 (correct next listing page).
    $("a[href*='video-detail.php']").each((_, el) => {
      const $el = $(el)
      const href = $el.attr("href") || ""
      const fullUrl = new URL(href, currentUrl).href
      if (seenUrls.has(fullUrl)) return
      seenUrls.add(fullUrl)

      const text = $el.text().trim()
      // Match "▶ HIGHLIGHTS Title here 24 Jul 2026"
      const m = text.match(/^\s*▶?\s*([A-Z]+)\s+([\s\S]+?)\s+(\d{1,2}\s+\w{3}\s+\d{4})\s*$/)
      all.push({
        detailUrl: fullUrl,
        category: m ? m[1] : "Highlights",
        listDate: m ? m[3] : undefined,
      })
    })

    // Find "Next »" link by text content. Take the FIRST match.
    // Resolve against the current page URL so `?page=N` lands on /videos.php?page=N.
    let nextHref: string | null = null
    $("a").each((_, a) => {
      if (nextHref) return // first match wins
      const t = $(a).text().trim()
      if (t.includes("Next") && t.includes("»")) {
        const h = $(a).attr("href")
        if (h && h !== "#") nextHref = h
      }
    })

    if (nextHref) {
      currentUrl = new URL(nextHref, currentUrl).href
    } else {
      currentUrl = null
    }
    await sleep(DELAY_MS)
  }

  console.log(`[listing] discovered ${all.length} videos across ${pageCount} pages\n`)
  return all
}

/**
 * Fetch a single video detail page and extract: YouTube ID (from iframe src),
 * title (h1), category (HIGHLIGHTS / INTERVIEWS / etc.), date string, and
 * description (skipping the "No description provided" placeholder).
 */
async function scrapeVideoDetail(
  url: string,
  fallbackCategory: string,
  fallbackDate?: string,
): Promise<VideoDetail | null> {
  try {
    const html = await fetchPage(url)
    const $ = cheerio.load(html)

    // Extract YouTube ID from the iframe src.
    const iframe = $("iframe[src*='youtube.com/embed/']").first()
    const embedSrc = iframe.attr("src") || ""
    const ytMatch = embedSrc.match(/youtube\.com\/embed\/([\w-]{6,})/)
    if (!ytMatch) {
      console.warn(`  ✗ no YouTube embed iframe found`)
      return null
    }
    const youtubeId = ytMatch[1]
    const embedUrl = `https://www.youtube.com/embed/${youtubeId}`

    // Title is the first <h1> in the <article> (or anywhere on the page).
    const title = ($("article h1").first().text() || $("h1").first().text() || "").trim()
    if (!title) {
      console.warn(`  ✗ no h1 title found`)
      return null
    }

    // Category — appears as a standalone uppercase word right before the h1
    // (e.g. "HIGHLIGHTS", "INTERVIEWS"). Fall back to the listing category.
    let category = fallbackCategory
    const articleText = $("article").text()
    const catMatch = articleText.match(/\b(HIGHLIGHTS|INTERVIEWS|ANALYSIS|NEWS|FEATURES|PREVIEW)\b/)
    if (catMatch) category = catMatch[1]

    // Date — somewhere inside the article there's a "DD Mon YYYY" string.
    let date = fallbackDate || ""
    if (!date) {
      const dateMatch = articleText.match(/(\d{1,2}\s+\w{3}\s+\d{4})/)
      if (dateMatch) date = dateMatch[1]
    }

    // Description — first <p> in the article that isn't "No description provided".
    let description = ""
    $("article p").each((_, p) => {
      const t = $(p).text().trim()
      if (t && !/no description provided/i.test(t)) {
        description = t
        return false // break each
      }
    })

    // Source slug — used for traceability but not for our own slug (which we
    // generate from the title for SEO).
    const sourceSlugMatch = url.match(/slug=([^&]+)/)
    const sourceSlug = sourceSlugMatch ? decodeURIComponent(sourceSlugMatch[1]) : ""

    return { youtubeId, embedUrl, title, category, date, description, sourceSlug }
  } catch (e) {
    console.warn(`  ✗ scrape failed: ${(e as Error).message}`)
    return null
  }
}

/**
 * Enrich with YouTube oEmbed (canonical title + high-quality thumbnail).
 * This is the public, no-API-key endpoint — works for any public video.
 * Returns {} if the video is private, removed, or oEmbed is unreachable.
 */
async function fetchYouTubeOEmbed(youtubeId: string): Promise<YouTubeOEmbed> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeId}&format=json`
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    })
    if (!res.ok) return {}
    const data = (await res.json()) as {
      title?: string
      author_name?: string
      thumbnail_url?: string
    }
    return {
      title: data.title,
      authorName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    }
  } catch {
    return {}
  }
}

async function main(): Promise<void> {
  console.log("=== USA Cricketers — video import ===\n")

  // Step 1: scrape the listing pages
  console.log("Step 1: scraping listing pages (following Next » pagination)…")
  const listed = await scrapeVideoList()
  if (listed.length === 0) {
    console.log("No videos found. Aborting.")
    await db.$disconnect()
    return
  }

  // Step 2: scrape each detail page + enrich via oEmbed
  console.log(`Step 2: scraping ${listed.length} video detail pages + enriching via oEmbed…\n`)
  const details: Array<VideoDetail & { oembed: YouTubeOEmbed }> = []
  for (let i = 0; i < listed.length; i++) {
    const v = listed[i]
    const progress = `[${i + 1}/${listed.length}]`
    console.log(`${progress} ${v.detailUrl}`)
    const detail = await scrapeVideoDetail(v.detailUrl, v.category, v.listDate)
    if (!detail) continue
    const oembed = await fetchYouTubeOEmbed(detail.youtubeId)
    details.push({ ...detail, oembed })
    // Use the canonical YouTube title if our scrape got something obviously truncated.
    const canonical = oembed.title && oembed.title.length > detail.title.length
    if (canonical) {
      console.log(`    canonical YouTube title used: "${oembed.title}"`)
    }
    await sleep(DELAY_MS)
  }
  console.log(`\nScraped ${details.length}/${listed.length} videos successfully.\n`)

  // Step 3: upsert into the database
  console.log("Step 3: upserting into the Video table (slug @unique → idempotent)…\n")
  let created = 0
  let updated = 0
  let failed = 0
  const slugCount = new Map<string, number>()

  for (const v of details) {
    const baseSlug = slugify(v.title)
    if (!baseSlug) {
      console.warn(`  ✗ couldn't slugify title: "${v.title}"`)
      failed++
      continue
    }
    // De-dupe slugs in case two videos have the same title.
    let slug = baseSlug
    let n = slugCount.get(baseSlug) || 0
    while (slugCount.has(slug)) {
      n += 1
      slug = `${baseSlug}-${n}`
    }
    slugCount.set(slug, 1)

    const thumbnailUrl =
      v.oembed.thumbnailUrl ||
      `https://img.youtube.com/vi/${v.youtubeId}/maxresdefault.jpg`
    // Description strategy: scraped description → canonical YT title → our title.
    const description =
      v.description || v.oembed.title || v.title
    const publishedAt =
      parseDate(v.date) || new Date()

    try {
      // Check if exists first so we can count created vs updated accurately.
      const existing = await db.video.findUnique({ where: { slug } })
      await db.video.upsert({
        where: { slug },
        create: {
          title: v.oembed.title || v.title,
          slug,
          description,
          source: "youtube",
          videoUrl: v.embedUrl,
          youtubeId: v.youtubeId,
          thumbnailUrl,
          duration: "",
          category: v.category.charAt(0) + v.category.slice(1).toLowerCase(),
          author: "USA Cricketers",
          tags: "USA Cricket",
          featured: false,
          published: true,
          publishedAt,
        },
        update: {
          title: v.oembed.title || v.title,
          description,
          videoUrl: v.embedUrl,
          youtubeId: v.youtubeId,
          thumbnailUrl,
          category: v.category.charAt(0) + v.category.slice(1).toLowerCase(),
          publishedAt,
        },
      })
      if (existing) updated++
      else created++
    } catch (e) {
      console.warn(`  ✗ DB upsert failed for "${v.title}": ${(e as Error).message}`)
      failed++
    }
  }

  // Step 4: summary
  const total = await db.video.count()
  console.log("\n=== Import summary ===")
  console.log(`Listed:    ${listed.length}`)
  console.log(`Scraped:   ${details.length}`)
  console.log(`Created:   ${created}`)
  console.log(`Updated:   ${updated}`)
  console.log(`Failed:    ${failed}`)
  console.log(`DB total:  ${total} videos`)
  console.log()

  await db.$disconnect()
}

main().catch((e) => {
  console.error("Import failed:", e)
  process.exit(1)
})
