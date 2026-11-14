#!/usr/bin/env bun
/**
 * scripts/check-uploads.ts
 *
 * Monitors the upload directory size on the Fly volume (1GB limit).
 * Optionally cleans up old uploads that are no longer referenced by
 * any article, player, or team in the database.
 *
 * Usage:
 *   bun run scripts/check-uploads.ts              # check size only
 *   bun run scripts/check-uploads.ts --cleanup     # check + delete unreferenced files
 *   bun run scripts/check-uploads.ts --cleanup --older-than 30  # delete files >30 days old
 */

import { readdir, stat, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
const args = process.argv.slice(2)
const CLEANUP = args.includes("--cleanup")
const olderThanIdx = args.indexOf("--older-than")
const OLDER_THAN_DAYS = olderThanIdx >= 0 ? parseInt(args[olderThanIdx + 1], 10) || 0 : 0

const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads")
const VOLUME_LIMIT_MB = 1024 // 1GB

async function main() {
  console.log(" Upload Volume Monitor")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

  if (!existsSync(UPLOAD_DIR)) {
    console.log("✓ Upload directory doesn't exist yet — nothing to check.")
    return
  }

  // Get total size
  const files = await readdir(UPLOAD_DIR)
  let totalSize = 0
  const fileInfos: { name: string; size: number; mtime: Date }[] = []

  for (const file of files) {
    const filepath = path.join(UPLOAD_DIR, file)
    const stats = await stat(filepath)
    totalSize += stats.size
    fileInfos.push({ name: file, size: stats.size, mtime: stats.mtime })
  }

  const totalMB = Math.round(totalSize / 1024 / 1024)
  const pct = Math.round((totalMB / VOLUME_LIMIT_MB) * 100)

  console.log(`  Files: ${files.length}`)
  console.log(`  Size: ${totalMB}MB / ${VOLUME_LIMIT_MB}MB (${pct}%)`)

  if (pct > 80) {
    console.log(`  ⚠️  WARNING: Over 80% capacity!`)
  } else if (pct > 60) {
    console.log(`  ⚡ Approaching capacity — monitor closely.`)
  } else {
    console.log(`  ✓ Healthy.`)
  }

  if (!CLEANUP) {
    console.log("\n  To clean up unreferenced files: bun run scripts/check-uploads.ts --cleanup")
    return
  }

  // Cleanup: find files not referenced by any DB record
  console.log("\n→ Checking for unreferenced files…")

  // Collect all referenced filenames from the DB
  const referencedFiles = new Set<string>()

  // Articles (imageUrl + content)
  const articles = await db.article.findMany({ select: { imageUrl: true, content: true } })
  for (const a of articles) {
    if (a.imageUrl) {
      const match = a.imageUrl.match(/\/api\/uploads\/(.+)$/)
      if (match) referencedFiles.add(match[1])
    }
    // Also check content for embedded images
    if (a.content) {
      const matches = a.content.matchAll(/\/api\/uploads\/([^)"'\s]+)/g)
      for (const m of matches) referencedFiles.add(m[1])
    }
  }

  // Players (imageUrl)
  const players = await db.player.findMany({ select: { imageUrl: true } })
  for (const p of players) {
    if (p.imageUrl) {
      const match = p.imageUrl.match(/\/api\/uploads\/(.+)$/)
      if (match) referencedFiles.add(match[1])
    }
  }

  // Teams (logoUrl)
  const teams = await db.team.findMany({ select: { logoUrl: true } })
  for (const t of teams) {
    if (t.logoUrl) {
      const match = t.logoUrl.match(/\/api\/uploads\/(.+)$/)
      if (match) referencedFiles.add(match[1])
    }
  }

  // Videos (thumbnailUrl, videoUrl)
  const videos = await db.video.findMany({ select: { thumbnailUrl: true, videoUrl: true } })
  for (const v of videos) {
    for (const field of [v.thumbnailUrl, v.videoUrl]) {
      if (field) {
        const match = field.match(/\/api\/uploads\/(.+)$/)
        if (match) referencedFiles.add(match[1])
      }
    }
  }

  // Galleries (coverImage + photos)
  const galleries = await db.gallery.findMany({ select: { coverImage: true, photos: true } })
  for (const g of galleries) {
    if (g.coverImage) {
      const match = g.coverImage.match(/\/api\/uploads\/(.+)$/)
      if (match) referencedFiles.add(match[1])
    }
    if (g.photos) {
      try {
        const photos = JSON.parse(g.photos) as { src?: string }[]
        for (const p of photos) {
          if (p.src) {
            const match = p.src.match(/\/api\/uploads\/(.+)$/)
            if (match) referencedFiles.add(match[1])
          }
        }
      } catch {}
    }
  }

  console.log(`  Referenced files in DB: ${referencedFiles.size}`)

  // Find unreferenced files (optionally filtered by age)
  const now = Date.now()
  const ageCutoff = OLDER_THAN_DAYS > 0 ? now - OLDER_THAN_DAYS * 24 * 60 * 60 * 1000 : 0

  const unreferenced = fileInfos.filter((f) => {
    if (referencedFiles.has(f.name)) return false
    if (ageCutoff > 0 && f.mtime.getTime() > ageCutoff) return false
    return true
  })

  if (unreferenced.length === 0) {
    console.log("  ✓ No unreferenced files found — all uploads are in use.")
    return
  }

  const unreferencedSize = unreferenced.reduce((sum, f) => sum + f.size, 0)
  const unreferencedMB = Math.round(unreferencedSize / 1024 / 1024)

  console.log(`  Unreferenced files: ${unreferenced.length} (${unreferencedMB}MB)`)
  if (OLDER_THAN_DAYS > 0) {
    console.log(`  (filtered to files older than ${OLDER_THAN_DAYS} days)`)
  }

  console.log("\n→ Deleting unreferenced files…")
  let deleted = 0
  let freedBytes = 0
  for (const f of unreferenced) {
    try {
      await unlink(path.join(UPLOAD_DIR, f.name))
      deleted++
      freedBytes += f.size
    } catch (e) {
      console.log(`  ✗ Could not delete: ${f.name}`)
    }
  }

  const freedMB = Math.round(freedBytes / 1024 / 1024)
  console.log(`\n✓ Deleted ${deleted} files, freed ${freedMB}MB`)
  console.log(`  New size: ${totalMB - freedMB}MB / ${VOLUME_LIMIT_MB}MB`)
}

main().catch((e) => {
  console.error("✗ Fatal:", e)
  process.exit(1)
})
