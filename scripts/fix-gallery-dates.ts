#!/usr/bin/env bun
/**
 * scripts/fix-gallery-dates.ts
 *
 * Updates the createdAt field of imported galleries to reflect their
 * chronological order on usacricketers.com (page 1 = newest, later
 * pages = older). Assigns synthetic dates spaced ~7 days apart going
 * backwards from today.
 *
 * Usage:
 *   bun run scripts/fix-gallery-dates.ts              # fix all
 *   bun run scripts/fix-gallery-dates.ts --dry-run    # preview without saving
 */

import { PrismaClient } from "@prisma/client"
import * as cheerio from "cheerio"

const SOURCE_BASE = "https://usacricketers.com"
const USER_AGENT = "Mozilla/5.0 (compatible; USACricketers-GalleryImporter/1.0)"

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
  console.log(" Gallery date fixer")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode: ${DRY_RUN ? "DRY-RUN" : "SAVE"}`)
  console.log("")

  // Step 1: Collect gallery slugs from listing pages (newest first)
  const slugPositions = new Map<string, number>()
  const seenSlugs = new Set<string>()
  let page = 1
  let emptyPages = 0

  console.log("→ Scanning gallery listing pages…")
  while (emptyPages < 2 && page <= 10) {
    try {
      const html = await fetchHTML(`${SOURCE_BASE}/gallery.php?page=${page}`)
      const re = /\/gallery-detail\.php\?slug=([^"'&]+)/g
      let m: RegExpExecArray | null
      let found = 0
      while ((m = re.exec(html)) !== null) {
        const slug = decodeURIComponent(m[1])
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug)
          slugPositions.set(slug, slugPositions.size)
          found++
        }
      }
      if (found === 0) emptyPages++
      else {
        emptyPages = 0
        console.log(`  Page ${page}: ${found} galleries`)
      }
      page++
      await new Promise((r) => setTimeout(r, 200))
    } catch (e) {
      emptyPages++
    }
  }

  console.log(`  ✓ Found ${slugPositions.size} galleries on listing`)

  // Step 2: Get all galleries from DB
  const dbGalleries = await db.gallery.findMany({
    select: { id: true, slug: true, title: true, createdAt: true },
  })
  console.log(`  DB has ${dbGalleries.length} galleries`)

  // Step 3: Update dates based on listing position
  const now = Date.now()
  const dayMs = 7 * 24 * 60 * 60 * 1000 // 7 days apart for galleries
  const total = slugPositions.size
  let updated = 0
  let skipped = 0

  console.log(`\n→ Updating dates (newest first)…`)

  // Sort DB galleries by listing position (lowest position = newest)
  const toUpdate = dbGalleries
    .map((g) => ({ ...g, position: slugPositions.get(g.slug) }))
    .filter((g) => g.position !== undefined)
    .sort((a, b) => (a.position! - b.position!))

  for (const g of toUpdate) {
    // Position 0 = newest = today, position N = N weeks ago
    const weeksAgo = g.position!
    const newDate = new Date(now - weeksAgo * dayMs)

    if (DRY_RUN) {
      console.log(`  [DRY] ${newDate.toISOString().slice(0, 10)} — ${g.title?.slice(0, 50)}`)
    } else {
      await db.gallery.update({
        where: { id: g.id },
        data: { createdAt: newDate },
      })
      if (updated % 5 === 0) {
        console.log(`  ✓ [${updated + 1}/${toUpdate.length}] ${newDate.toISOString().slice(0, 10)} — ${g.title?.slice(0, 50)}`)
      }
    }
    updated++
  }

  skipped = dbGalleries.length - toUpdate.length
  console.log(`\n✓ Updated: ${updated}`)
  console.log(`  Skipped (not in listing): ${skipped}`)
}

main().catch((e) => {
  console.error("✗ Fatal:", e)
  process.exit(1)
})
