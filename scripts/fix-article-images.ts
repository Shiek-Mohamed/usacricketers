#!/usr/bin/env bun
/**
 * scripts/fix-article-images.ts
 *
 * Assigns real cricket photos to articles that have missing or broken
 * imageUrl values. Uses a curated pool of 38 cricket image URLs (sourced
 * from the ZAI image-search service) embedded directly in the script so
 * it works on any environment without external dependencies.
 *
 * Usage:
 *   bun run scripts/fix-article-images.ts              # fix all missing images
 *   bun run scripts/fix-article-images.ts --dry-run    # preview without saving
 *   bun run scripts/fix-article-images.ts --broken     # also fix broken /uploads/https-* paths
 */


import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const FIX_BROKEN = args.includes("--broken")

// Curated pool of 38 cricket photos hosted on ZAI image-search OSS
// (publicly reachable). Grouped by theme so article topics get relevant images.
const IMAGE_POOL: Record<string, string[]> = {
  batsman: [
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/fd8d8f7b5eef.jpeg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0ff4354e2d95.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ca25ac9adfff.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/29ca63152337.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/98a8413c6e2b.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/142f4bd66592.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/1f423597acfd.jpeg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/e3de05cce82b.jpg",
  ],
  bowler: [
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/5a2e92444d99.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/73f90ae46f89.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ba57ee737fcd.jpeg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f9627355c15b.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/5ae082f89b9d.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/17dad720a698.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/41496d98ab34.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/21defd1d143a.jpg",
  ],
  stadium: [
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6b2daec76844.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ea0d4c355266.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/9e3723101682.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/5f974f6551f8.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f952293ed744.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/85fff99751ed.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3315d1b61350.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3d0c5ea486cf.jpg",
  ],
  celebration: [
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/4353f1dd7e86.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/4ae7938781cb.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b928ababa98f.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6fc76f566742.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/7a603e13786e.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b7fddd150b14.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/df5ab7802a5f.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/d4fd2174783d.jpg",
  ],
  trophy: [
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/924c1a208644.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/044a69cc204d.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/adaf6e99da20.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b45132f20a7e.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/a226af996789.jpg",
    "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/283a6287c4d9.jpg",
  ],
}

/** Pick a theme based on article title keywords. */
function pickTheme(title: string): keyof typeof IMAGE_POOL {
  const t = title.toLowerCase()
  if (/tribute|remember|memorial|hinds|dedicated|life/.test(t)) return "stadium"
  if (/world cup|trophy|tournament|premier|champions|final|schedule|ballot|announces|launch/.test(t)) return "trophy"
  if (/debut|academy|youth|graduate|school|pathway/.test(t)) return "celebration"
  if (/batsman|batting|six|cover drive|kohli|baber|patel|kumar|hitter/.test(t)) return "batsman"
  if (/bowler|bowling|wicket|spell|maiden/.test(t)) return "bowler"
  return ["stadium", "batsman", "bowler", "celebration", "trophy"][
    Math.floor(Math.random() * 5)
  ] as keyof typeof IMAGE_POOL
}

async function main() {
  console.log(" Article image fixer")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode:    ${DRY_RUN ? "DRY-RUN (no writes)" : "SAVE"}`)
  console.log(`  Fix broken: ${FIX_BROKEN ? "yes" : "no"}`)
  console.log("")

  // Find articles with missing or broken images
  const where = FIX_BROKEN
    ? { OR: [{ imageUrl: "" }, { imageUrl: null }, { imageUrl: { startsWith: "/uploads/https-" } }] }
    : { OR: [{ imageUrl: "" }, { imageUrl: null }] }

  const needsFix = await db.article.findMany({
    where,
    select: { id: true, title: true, imageUrl: true },
    orderBy: { publishedAt: "desc" },
  })

  console.log(`Found ${needsFix.length} articles needing image fixes`)

  if (needsFix.length === 0) {
    console.log("\n✓ All articles already have images. Nothing to do.")
    return
  }

  // Track index per theme for cycling
  const idx: Record<string, number> = {}
  for (const k of Object.keys(IMAGE_POOL)) idx[k] = 0

  let fixed = 0
  for (const a of needsFix) {
    const theme = pickTheme(a.title)
    const urls = IMAGE_POOL[theme]
    if (!urls.length) continue
    const url = urls[idx[theme]++ % urls.length]
    if (DRY_RUN) {
      console.log(`  [DRY] "${a.title.slice(0, 50)}…" → ${theme}/${url.slice(-20)}`)
    } else {
      await db.article.update({ where: { id: a.id }, data: { imageUrl: url } })
    }
    fixed++
  }

  console.log(`\n${DRY_RUN ? "Would fix" : "✓ Fixed"} ${fixed} articles`)
  if (!DRY_RUN) {
    const stillMissing = await db.article.count({
      where: { OR: [{ imageUrl: "" }, { imageUrl: null }] },
    })
    console.log(`Articles still missing images: ${stillMissing}`)
  }
}

main().catch((e) => {
  console.error("✗ Fatal error:", e)
  process.exit(1)
})
