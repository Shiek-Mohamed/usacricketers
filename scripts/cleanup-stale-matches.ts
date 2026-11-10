#!/usr/bin/env bun
/**
 * scripts/cleanup-stale-matches.ts
 *
 * Re-categorizes matches with stale statuses so the matches page shows
 * accurate Live / Upcoming / Recent tabs:
 *   - "live" matches older than 7 days → "completed" (stale, never updated)
 *   - "upcoming" matches with past start dates → "completed" (already played)
 *   - Optionally deletes matches older than a cutoff (--delete-older-than DAYS)
 *
 * Usage:
 *   bun run scripts/cleanup-stale-matches.ts                    # fix stale statuses
 *   bun run scripts/cleanup-stale-matches.ts --dry-run           # preview without saving
 *   bun run scripts/cleanup-stale-matches.ts --delete-older-than 365  # also delete very old
 */


import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const deleteOlderIdx = args.indexOf("--delete-older-than")
const DELETE_OLDER_THAN_DAYS = deleteOlderIdx >= 0 ? parseInt(args[deleteOlderIdx + 1], 10) || 0 : 0

async function main() {
  console.log(" Stale match cleanup")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log(`  Mode:    ${DRY_RUN ? "DRY-RUN (no writes)" : "SAVE"}`)
  if (DELETE_OLDER_THAN_DAYS) {
    console.log(`  Delete:  matches older than ${DELETE_OLDER_THAN_DAYS} days`)
  }
  console.log("")

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 1. Stale "live" matches (older than 7 days)
  const staleLive = await db.match.findMany({
    where: { status: "live", startDate: { lt: sevenDaysAgo } },
    select: { id: true, matchNo: true, startDate: true, venue: true },
  })
  console.log(`Stale "live" matches (older than 7 days): ${staleLive.length}`)
  for (const m of staleLive) {
    console.log(`  ${m.startDate.toISOString().slice(0, 10)} "${m.matchNo}" @ ${m.venue?.slice(0, 30)}`)
  }

  // 2. Stale "upcoming" matches (past start date)
  const staleUpcoming = await db.match.findMany({
    where: { status: "upcoming", startDate: { lt: now } },
    select: { id: true, matchNo: true, startDate: true, venue: true },
  })
  console.log(`\nStale "upcoming" matches (past start date): ${staleUpcoming.length}`)
  for (const m of staleUpcoming) {
    console.log(`  ${m.startDate.toISOString().slice(0, 10)} "${m.matchNo}" @ ${m.venue?.slice(0, 30)}`)
  }

  // 3. Very old matches (for optional deletion)
  let veryOld: { id: string; matchNo: string; startDate: Date }[] = []
  if (DELETE_OLDER_THAN_DAYS) {
    const cutoff = new Date(now.getTime() - DELETE_OLDER_THAN_DAYS * 24 * 60 * 60 * 1000)
    veryOld = await db.match.findMany({
      where: { startDate: { lt: cutoff } },
      select: { id: true, matchNo: true, startDate: true },
    })
    console.log(`\nVery old matches (older than ${DELETE_OLDER_THAN_DAYS} days): ${veryOld.length}`)
    for (const m of veryOld.slice(0, 10)) {
      console.log(`  ${m.startDate.toISOString().slice(0, 10)} "${m.matchNo}"`)
    }
    if (veryOld.length > 10) console.log(`  … and ${veryOld.length - 10} more`)
  }

  if (DRY_RUN) {
    console.log("\n[DRY-RUN] No changes made.")
    return
  }

  // Apply fixes
  let updated = 0
  for (const m of staleLive) {
    await db.match.update({ where: { id: m.id }, data: { status: "completed" } })
    updated++
  }
  for (const m of staleUpcoming) {
    await db.match.update({ where: { id: m.id }, data: { status: "completed" } })
    updated++
  }
  let deleted = 0
  if (DELETE_OLDER_THAN_DAYS) {
    for (const m of veryOld) {
      await db.match.delete({ where: { id: m.id } })
      deleted++
    }
  }

  console.log(`\n✓ Updated ${updated} match statuses`)
  if (deleted) console.log(`✓ Deleted ${deleted} very old matches`)

  // Final state
  const byStatus = await db.match.groupBy({ by: ["status"], _count: true })
  console.log(`\nFinal state:`)
  for (const s of byStatus) console.log(`  ${s.status}: ${s._count}`)
}

main().catch((e) => {
  console.error("✗ Fatal error:", e)
  process.exit(1)
})
