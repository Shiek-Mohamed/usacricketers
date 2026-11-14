#!/usr/bin/env bun
/**
 * scripts/clear-bad-scorecards.ts
 * Clears scorecards that have totalRuns:0 (bad data from the
 * fetch-scorecards run before the field-name fix).
 */
import { PrismaClient } from "@prisma/client"
const db = new PrismaClient()

async function main() {
  const matches = await db.match.findMany({
    where: { scorecard: { not: "" } },
    select: { id: true, matchNo: true, scorecard: true },
  })

  let cleared = 0
  for (const m of matches) {
    try {
      const sc = JSON.parse(m.scorecard)
      if (sc.innings && Array.isArray(sc.innings)) {
        const totalRuns = sc.innings.reduce((sum: number, inn: any) =>
          sum + (inn.totalRuns || 0), 0)
        if (totalRuns === 0) {
          await db.match.update({
            where: { id: m.id },
            data: { scorecard: "" },
          })
          console.log(`  Cleared: ${m.matchNo}`)
          cleared++
        }
      }
    } catch {}
  }
  console.log(`\nCleared ${cleared} bad scorecards`)
}

main().catch(console.error).finally(() => process.exit(0))
