#!/usr/bin/env bun
/**
 * scripts/import-usacricketers-posts.ts
 *
 * Imports articles from usacricketers.com (a custom PHP site).
 *
 * Site structure:
 *   Listing:  /news.php?page=N  (paginated, ~13 articles per page, newest first)
 *   Detail:   /news-detail.php?slug=[slug]
 *
 * The source site doesn't expose publication dates on article pages, so we
 * derive a synthetic date from the listing position (page 1 = newest, page
 * 50 = oldest). Each article gets a date spaced ~1 day apart going backwards
 * from today. This gives correct chronological ordering even though the
 * exact dates are approximate.
 *
 * Saves each article immediately after fetching (so progress isn't lost if
 * the process is interrupted). Deduplicates by slug — safe to re-run.
 *
 * Usage:
 *   bun run scripts/import-usacricketers-posts.ts              # import all
 *   bun run scripts/import-usacricketers-posts.ts --dry-run    # preview without saving
 *   bun run scripts/import-usacricketers-posts.ts --limit 5    # only newest 5
 */

import { PrismaClient } from "@prisma/client"
import * as cheerio from "cheerio"

const SOURCE_BASE = "https://www.usacricketers.com"
const USER_AGENT =
  "Mozilla/5.0 (compatible; USACricketers-ContentMigration/1.0; +bun)"

const db = new PrismaClient()

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const limitIdx = args.indexOf("--limit")
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) || 0 : 0

interface ListedArticle {
  slug: string
  title?: string
  position: number // 0 = newest
}

/** Fetch HTML with a browser-like User-Agent. */
async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

/** Extract a meta tag's content attribute from cheerio. */
function metaContent($: cheerio.CheerioAPI, selector: string): string {
  return $(selector).attr("content")?.trim() || ""
}

/** Collect all article slugs from the news listing pages.
 *  Returns articles newest-first (matching the listing order). */
async function collectSlugs(): Promise<ListedArticle[]> {
  const articles: ListedArticle[] = []
  const seenSlugs = new Set<string>()
  let page = 1
  let emptyPages = 0

  console.log("→ Scanning news listing pages…")
  while (emptyPages < 2 && page <= 50) {
    const url = `${SOURCE_BASE}/news.php?page=${page}`
    try {
      const html = await fetchHTML(url)
      const $ = cheerio.load(html)

      let foundOnPage = 0
      $("a[href*='news-detail.php']").each((_, el) => {
        const href = $(el).attr("href") || ""
        const slugMatch = href.match(/slug=([^&"']+)/)
        if (!slugMatch) return
        const slug = decodeURIComponent(slugMatch[1])
        if (seenSlugs.has(slug)) return
        seenSlugs.add(slug)

        const title = $(el).find(".text-sm.font-semibold, h3, h2").first().text().trim() || undefined
        articles.push({ slug, title, position: articles.length })
        foundOnPage++
      })

      if (foundOnPage === 0) {
        emptyPages++
      } else {
        emptyPages = 0
        console.log(`  Page ${page}: ${foundOnPage} articles`)
      }
      page++
      await new Promise((r) => setTimeout(r, 200))
    } catch (e) {
      console.log(`  Page ${page}: failed (${e})`)
      emptyPages++
    }
  }

  console.log(`  ✓ Found ${articles.length} unique articles`)
  return articles
}

/** Fetch + parse a single article detail page. Returns null on failure. */
async function fetchArticleDetail(slug: string): Promise<{
  title: string
  excerpt: string
  content: string
  imageUrl: string
  tags: string
} | null> {
  const url = `${SOURCE_BASE}/news-detail.php?slug=${encodeURIComponent(slug)}`
  try {
    const html = await fetchHTML(url)
    const $ = cheerio.load(html)

    const title =
      metaContent($, 'meta[property="og:title"]') ||
      $("title").text().replace(/\s*[|–—].*$/, "").trim() ||
      slug

    const excerpt = metaContent($, 'meta[name="description"]') ||
      metaContent($, 'meta[property="og:description"]') ||
      ""

    const imageUrl = metaContent($, 'meta[property="og:image"]') || ""
    const tags = metaContent($, 'meta[name="keywords"]') || ""

    // Extract content from <div class="content">
    let content = ""
    const contentDiv = $("div.content").first()
    if (contentDiv.length) {
      contentDiv.find("script, style").remove()
      content = contentDiv.html() || ""
      content = content.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, "</p><p>")
    }

    return {
      title: title.replace(/\s*[|–—].*$/, "").trim(),
      excerpt: excerpt.slice(0, 300),
      content,
      imageUrl,
      tags,
    }
  } catch (e) {
    console.log(`  ✗ Failed: ${slug} — ${e}`)
    return null
  }
}

async function main() {
  console.log(" USACricketers.com post importer")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode: ${DRY_RUN ? "DRY-RUN" : "SAVE"}`)
  console.log("")

  // Step 1: Collect all article slugs (newest first)
  const listed = await collectSlugs()
  if (listed.length === 0) {
    console.log("\n✗ No articles found.")
    return
  }

  // Step 2: Dedup — skip slugs already in DB
  const existingSlugs = new Set<string>()
  const existing = await db.article.findMany({ select: { slug: true } })
  for (const a of existing) existingSlugs.add(a.slug)

  let toImport = listed.filter((l) => !existingSlugs.has(l.slug))
  console.log(`\n  ${existingSlugs.size} already in DB (skipping)`)
  console.log(`  ${toImport.length} new articles to import`)

  if (LIMIT) {
    toImport = toImport.slice(0, LIMIT)
    console.log(`  Limited to ${toImport.length} (newest)`)
  }

  if (toImport.length === 0) {
    console.log("\n✓ All articles already imported.")
    return
  }

  // Step 3: Reverse to import oldest-first (chronological order)
  toImport.reverse()
  // Synthetic date: position 0 (oldest) = N days ago, last = today
  const now = Date.now()
  const total = toImport.length
  const dayMs = 24 * 60 * 60 * 1000

  if (DRY_RUN) {
    console.log("\n  [DRY-RUN] First 10 (oldest first):")
    for (const l of toImport.slice(0, 10)) {
      const daysAgo = total - 1 - (total - 1 - (toImport.indexOf(l)))
      const date = new Date(now - daysAgo * dayMs).toISOString().slice(0, 10)
      console.log(`    ${date} — ${l.title?.slice(0, 50) || l.slug}`)
    }
    return
  }

  // Step 4: Fetch + save each article immediately (oldest first)
  console.log(`\n→ Importing ${toImport.length} articles (oldest first)…`)
  let saved = 0
  let failed = 0

  for (let i = 0; i < toImport.length; i++) {
    const l = toImport[i]
    // Synthetic date: oldest article = (total-1) days ago, newest = today
    const daysAgo = total - 1 - i
    const syntheticDate = new Date(now - daysAgo * dayMs)

    const detail = await fetchArticleDetail(l.slug)
    if (!detail) {
      failed++
      continue
    }

    try {
      await db.article.create({
        data: {
          title: detail.title,
          slug: l.slug,
          excerpt: detail.excerpt,
          content: detail.content,
          imageUrl: detail.imageUrl,
          imageCaption: "",
          category: JSON.stringify(["news"]),
          author: "USA Cricketers",
          tags: detail.tags,
          featured: false,
          published: true,
          publishedAt: syntheticDate,
        },
      })
      saved++
      if (saved % 10 === 0 || i === toImport.length - 1) {
        console.log(`  ✓ [${saved}/${toImport.length}] ${syntheticDate.toISOString().slice(0, 10)} — ${detail.title.slice(0, 50)}`)
      }
    } catch (e: any) {
      if (e?.code === "P2002") {
        // Unique constraint — slug already exists, skip
      } else {
        console.log(`  ✗ Save failed: ${l.slug} — ${e.message?.slice(0, 60)}`)
      }
      failed++
    }

    // Be polite — 200ms between requests
    await new Promise((r) => setTimeout(r, 200))
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✓ Imported: ${saved}`)
  console.log(`✗ Failed: ${failed}`)
  console.log(`  Total in DB: ${existingSlugs.size + saved}`)
}

main().catch((e) => {
  console.error("✗ Fatal error:", e)
  process.exit(1)
})
