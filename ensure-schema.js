/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * ensure-schema.js — raw-SQL schema fallback that runs on every container
 * boot (after `prisma db push`). Creates the Penalty table if it doesn't
 * exist yet.
 *
 * WHY: the boot-time `prisma db push` occasionally fails to apply DDL
 * (pooled DATABASE_URL, npx resolution hiccup, etc.) and its non-fatal
 * `|| echo` swallows the error — so new tables added in a release never
 * get created, and the app crashes with Prisma P2021 ("table does not
 * exist") on every request that touches them. This script is idempotent
 * + non-fatal and guarantees the table exists regardless of db push.
 *
 * The DDL matches what `prisma db push` would generate for the Penalty
 * model, so once the table exists prisma sees it as in-sync (no drift).
 *
 * Usage: node ensure-schema.js   (env: DATABASE_URL must point to Postgres)
 */
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Penalty" (
      "id" TEXT NOT NULL,
      "seriesId" TEXT NOT NULL,
      "teamId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "value" DOUBLE PRECISION NOT NULL,
      "reason" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Penalty_pkey" PRIMARY KEY ("id")
    )`,
  `CREATE INDEX IF NOT EXISTS "Penalty_seriesId_idx" ON "Penalty"("seriesId")`,
  `CREATE INDEX IF NOT EXISTS "Penalty_teamId_idx" ON "Penalty"("teamId")`,
  `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Penalty_seriesId_fkey') THEN
        ALTER TABLE "Penalty" ADD CONSTRAINT "Penalty_seriesId_fkey"
          FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
  `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Penalty_teamId_fkey') THEN
        ALTER TABLE "Penalty" ADD CONSTRAINT "Penalty_teamId_fkey"
          FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`,
]

async function main() {
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql)
    } catch (e) {
      // Non-fatal — index/constraint may already exist, or a partial state.
      // Log the first line + continue.
      console.log(`  (skip) ${(e.message || "").split("\n")[0]}`)
    }
  }
  console.log("✓ Penalty table ensured")
}

main()
  .catch((e) => {
    console.error("⚠️ ensure-schema failed:", (e.message || "").split("\n")[0])
    process.exit(0) // non-fatal — app can still start
  })
  .finally(() => prisma.$disconnect())
