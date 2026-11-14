#!/usr/bin/env bun
/**
 * scripts/fix-article-original-images.ts
 *
 * Restores the ORIGINAL hero image for articles that had their image
 * replaced with a generic stock photo (z-cdn.chatglm.cn or /api/uploads/).
 *
 * For each affected article, fetches the original article page from
 * usacricketers.com and extracts the og:image URL.
 *
 * Usage:
 *   bun run scripts/fix-article-original-images.ts              # fix all
 *   bun run scripts/fix-article-original-images.ts --dry-run    # preview only
 */

import { PrismaClient } from "@prisma/client"
import * as cheerio from "cheerio"

const SOURCE = "https://www.usacricketers.com"
const UA = "Mozilla/5.0 (compatible; USACricketers-ImageFix/1.0)"

const db = new PrismaClient()
const DRY_RUN = process.argv.includes("--dry-run")

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function metaContent($: cheerio.CheerioAPI, selector: string): string {
  return $(selector).attr("content")?.trim() || ""
}

async function main() {
  console.log(" Article original image restorer")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode: ${DRY_RUN ? "DRY-RUN" : "SAVE"}`)
  console.log("")

  // Find articles with WRONG images (stock photos that replaced originals)
  const articles = await db.article.findMany({
    where: {
      OR: [
        { imageUrl: { contains: "z-cdn.chatglm.cn" } },
        { imageUrl: { contains: "/api/uploads/" } },
        { imageUrl: { contains: "/uploads/https-" } },
      ],
    },
    select: { id: true, slug: true, title: true, imageUrl: true },
    orderBy: { publishedAt: "desc" },
  })

  console.log(`Found ${articles.length} articles with wrong/stock images`)
  console.log("")

  if (DRY_RUN) {
    for (const a of articles.slice(0, 10)) {
      console.log(`  [DRY] "${a.title.slice(0, 45)}…"`)
      console.log(`        current: ${a.imageUrl.slice(0, 60)}`)
    }
    if (articles.length > 10) console.log(`  … and ${articles.length - 10} more`)
    return
  }

  let fixed = 0
  let skipped = 0
  let failed = 0

  for (const a of articles) {
    if (!a.slug) { skipped++; continue }

    try {
      // Fetch the original article page from usacricketers.com
      const html = await fetchHTML(`${SOURCE}/news-detail.php?slug=${encodeURIComponent(a.slug)}`)
      const $ = cheerio.load(html)

      // Extract the original og:image
      const originalImage = metaContent($, 'meta[property="og:image"]')

      if (originalImage && originalImage.length > 10) {
        // Update the article with the correct original image
        await db.article.update({
          where: { id: a.id },
          data: { imageUrl: originalImage },
        })
        fixed++
        if (fixed % 10 === 0 || fixed <= 5) {
          console.log(`  ✓ [${fixed}/${articles.length}] ${a.title.slice(0, 45)}`)
          console.log(`    → ${originalImage.slice(0, 60)}`)
        }
      } else {
        // No image on source page — keep the stock photo
        skipped++
      }
    } catch (e) {
      failed++
      if (failed <= 3) console.log(`  ✗ Failed: ${a.slug.slice(0, 30)}`)
    }

    // Be polite
    await new Promise((r) => setTimeout(r, 150))
  }

  console.log("")
  console.log(`✓ Fixed: ${fixed} (restored original images)`)
  console.log(`  Skipped: ${skipped} (no image on source page — kept stock photo)`)
  console.log(`  Failed: ${failed}`)
}

main().catch((e) => {
  console.error("✗ Fatal:", e)
  process.exit(1)
})
