#!/usr/bin/env bun
/**
 * scripts/fix-article-dates.ts
 *
 * Fixes the publishedAt dates of articles imported from usacricketers.com.
 *
 * The source site doesn't expose publication dates, so we use the listing
 * page position as a proxy: page 1 = newest, page 50 = oldest. Each article
 * gets a synthetic date spaced ~1 day apart going backwards from today.
 *
 * Usage:
 *   bun run scripts/fix-article-dates.ts              # fix all
 *   bun run scripts/fix-article-dates.ts --dry-run    # preview without saving
 */

import { PrismaClient } from "@prisma/client"
import * as cheerio from "cheerio"

const SOURCE_BASE = "https://www.usacricketers.com"
const USER_AGENT =
  "Mozilla/5.0 (compatible; USACricketers-ContentMigration/1.0; +bun)"

const db = new PrismaClient()
const DRY_RUN = process.argv.includes("--dry-run")

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function main() {
  console.log(" Article date fixer")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode: ${DRY_RUN ? "DRY-RUN" : "SAVE"}`)
  console.log("")

  // Step 1: Collect slug→position from listing (newest first)
  const slugPositions = new Map<string, number>() // slug → position (0=newest)
  const seenSlugs = new Set<string>()
  let page = 1
  let emptyPages = 0

  console.log("→ Scanning listing pages…")
  while (emptyPages < 2 && page <= 50) {
    try {
      const html = await fetchHTML(`${SOURCE_BASE}/news.php?page=${page}`)
      const $ = cheerio.load(html)
      let found = 0
      $("a[href*='news-detail.php']").each((_, el) => {
        const href = $(el).attr("href") || ""
        const m = href.match(/slug=([^&"']+)/)
        if (!m) return
        const slug = decodeURIComponent(m[1])
        if (seenSlugs.has(slug)) return
        seenSlugs.add(slug)
        slugPositions.set(slug, slugPositions.size)
        found++
      })
      if (found === 0) emptyPages++
      else { emptyPages = 0; console.log(`  Page ${page}: ${found}`) }
      page++
      await new Promise((r) => setTimeout(r, 200))
    } catch (e) {
      emptyPages++
    }
  }

  console.log(`  ✓ Found ${slugPositions.size} articles on listing`)

  // Step 2: Get all articles from DB
  const dbArticles = await db.article.findMany({
    select: { id: true, slug: true, publishedAt: true, title: true },
  })
  console.log(`  DB has ${dbArticles.length} articles`)

  // Step 3: Update dates based on listing position
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const total = slugPositions.size
  let updated = 0
  let skipped = 0

  console.log(`\n→ Updating dates (oldest first)…`)

  // Sort DB articles by listing position (oldest first = highest position first)
  const toUpdate = dbArticles
    .map((a) => ({ ...a, position: slugPositions.get(a.slug) }))
    .filter((a) => a.position !== undefined)
    .sort((a, b) => (b.position! - a.position!)) // oldest first

  for (const a of toUpdate) {
    const daysAgo = total - 1 - a.position!
    const newDate = new Date(now - daysAgo * dayMs)

    if (DRY_RUN) {
      if (updated < 10 || updated % 50 === 0) {
        console.log(`  [DRY] ${newDate.toISOString().slice(0, 10)} — ${a.title?.slice(0, 50)}`)
      }
    } else {
      await db.article.update({
        where: { id: a.id },
        data: { publishedAt: newDate },
      })
      if (updated % 50 === 0) {
        console.log(`  ✓ [${updated + 1}/${toUpdate.length}] ${newDate.toISOString().slice(0, 10)} — ${a.title?.slice(0, 50)}`)
      }
    }
    updated++
  }

  // Articles not in the listing (original migration data) — skip
  skipped = dbArticles.length - toUpdate.length

  console.log(`\n✓ Updated: ${updated}`)
  console.log(`  Skipped (not in listing): ${skipped}`)
}

main().catch((e) => {
  console.error("✗ Fatal:", e)
  process.exit(1)
})
