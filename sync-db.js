// sync-db.js — one-time DB schema fixup. Runs on every container boot via
// start-all.sh (idempotent). Uses the Prisma CLIENT directly (not the CLI).
//
// Fixes schema drift: a legacy `slug` column on `Series` (from an older
// schema version) is NOT NULL but the current Prisma client doesn't send a
// value for it → signup fails with a constraint violation. We drop it.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS script (runs via `node sync-db.js`, not bundled by Next.js)
const { PrismaClient } = require("@prisma/client")

const SERIES_COLS =
  "(id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, shortName TEXT NOT NULL, format TEXT NOT NULL DEFAULT 'ODI', season TEXT NOT NULL DEFAULT '2024-25', startDate TEXT NOT NULL, endDate TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ongoing', description TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)"

async function main() {
  const db = new PrismaClient()
  try {
    // Check if Series.slug exists
    const cols = await db.$queryRawUnsafe(
      `SELECT name FROM pragma_table_info('Series')`
    )
    const colNames = cols.map((c) => c.name)
    console.log("sync-db: Series columns =", colNames.join(", "))
    if (!colNames.includes("slug")) {
      console.log("✅ sync-db: Series.slug already absent — nothing to do")
      return
    }
    console.log("sync-db: Series.slug found — attempting DROP COLUMN")

    // Try the simple DROP COLUMN first (SQLite 3.35.0+)
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "Series" DROP COLUMN "slug"`)
      console.log("✅ sync-db: dropped Series.slug via ALTER TABLE DROP COLUMN")
      return
    } catch (e) {
      console.log(
        "sync-db: DROP COLUMN failed (" +
          String(e).slice(0, 120) +
          ") — falling back to table recreation"
      )
    }

    // Fallback: recreate the table without the slug column (works on all
    // SQLite versions). Foreign keys are disabled during the swap so child
    // tables (Match.seriesId, etc.) don't block the DROP.
    await db.$executeRawUnsafe(`PRAGMA foreign_keys=off`)
    try {
      await db.$executeRawUnsafe(`CREATE TABLE Series_new ${SERIES_COLS}`)
      await db.$executeRawUnsafe(
        `INSERT INTO Series_new (id, name, shortName, format, season, startDate, endDate, status, description, createdAt, updatedAt) SELECT id, name, shortName, format, season, startDate, endDate, status, description, createdAt, updatedAt FROM "Series"`
      )
      await db.$executeRawUnsafe(`DROP TABLE "Series"`)
      await db.$executeRawUnsafe(`ALTER TABLE Series_new RENAME TO Series`)
      console.log("✅ sync-db: dropped Series.slug via table recreation")
    } finally {
      await db.$executeRawUnsafe(`PRAGMA foreign_keys=on`)
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.log("⚠️ sync-db failed:", String(e).slice(0, 300))
  process.exit(0) // non-fatal — don't crash the container
})
