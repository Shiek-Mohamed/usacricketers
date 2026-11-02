/**
 * One-time backfill script: assign a `slug` to every existing Series row
 * based on its `name`, in kebab-case. Collisions are resolved with -2/-3 suffix.
 *
 * Run with:
 *   bun run scripts/backfill-league-slugs.ts
 *
 * Idempotent: re-running will skip Series that already have a non-empty slug,
 * so it's safe to run multiple times. Reserved slugs (api, admin, league …)
 * are skipped past with -2 suffix.
 */

import { PrismaClient } from "@prisma/client"
import {
  slugifyLeagueName,
  isReservedSlug,
} from "../src/lib/league-slug"

const db = new PrismaClient()

async function main() {
  const series = await db.series.findMany({ select: { id: true, name: true, slug: true } })
  if (series.length === 0) {
    console.log("No Series rows — nothing to backfill.")
    return
  }

  // Track slugs we've already used in this run (so two Series with the same
  // name don't collide even if the second's existsFn check doesn't see the
  // first one because the first hasn't been committed yet — Prisma's
  // unique constraint would throw, but we want graceful -2 suffixing).
  const usedSlugs = new Set<string>()
  for (const s of series) {
    if (s.slug && !isReservedSlug(s.slug)) {
      usedSlugs.add(s.slug)
    }
  }

  let updated = 0
  let skipped = 0

  for (const s of series) {
    if (s.slug) {
      console.log(`SKIP  ${s.id}  "${s.name}"  (already has slug: "${s.slug}")`)
      skipped++
      continue
    }

    const base = slugifyLeagueName(s.name)

    // existsFn: check both the DB and the in-run set.
    const existsFn = async (slug: string) => {
      if (usedSlugs.has(slug)) return true
      const clash = await db.series.findUnique({ where: { slug }, select: { id: true } })
      return Boolean(clash)
    }

    let candidate = base
    if (isReservedSlug(candidate) || (await existsFn(candidate))) {
      // Walk -2, -3, …
      for (let i = 2; i <= 1000; i++) {
        const c = `${base}-${i}`
        if (!isReservedSlug(c) && !(await existsFn(c))) {
          candidate = c
          break
        }
      }
    }

    await db.series.update({ where: { id: s.id }, data: { slug: candidate } })
    usedSlugs.add(candidate)
    console.log(`SET   ${s.id}  "${s.name}"  →  "${candidate}"`)
    updated++
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped} (out of ${series.length} total Series).`)
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
