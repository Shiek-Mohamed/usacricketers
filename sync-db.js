// sync-db.js — one-time DB schema fixup. Runs on every container boot via
// start-all.sh (idempotent). Uses the Prisma CLIENT directly (not the CLI).
//
// Fixes schema drift between old DB snapshots (on the persistent fly.io
// volume) and the current Prisma schema:
//   1. Legacy `slug` column on Series (old schema had it; current doesn't).
//   2. Date columns (startDate, endDate, createdAt, updatedAt) stored with
//      INTEGER affinity by an old Prisma version — the current client stores
//      DateTime as TEXT (ISO 8601) and can't read back integers, causing
//      "Inconsistent column data: Could not convert value ... to type
//      DateTime" errors on create()/RETURNING.
//
// Fix: recreate the Series table with correct TEXT columns, converting any
// integer-timestamp values to ISO strings during the data copy.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS script (runs via `node sync-db.js`, not bundled by Next.js)
const { PrismaClient } = require("@prisma/client")

// The correct Series schema (matches prisma/schema.prisma). DateTime columns
// are TEXT (Prisma stores ISO 8601 strings for SQLite).
const SERIES_DDL = `CREATE TABLE Series_new (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  shortName TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'ODI',
  season TEXT NOT NULL DEFAULT '2024-25',
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ongoing',
  description TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
)`

// Copy data, converting integer-timestamp dates to ISO strings. SQLite's
// `datetime(epoch, 'unixepoch')` handles seconds; Prisma stores ms, so divide
// by 1000. If the value is already TEXT (ISO), the division yields 0 →
// 1970-01-01, which is wrong — so we only use this when the column is INTEGER.
const SERIES_COPY_INTEGER = `INSERT INTO Series_new (id, name, shortName, format, season, startDate, endDate, status, description, createdAt, updatedAt)
  SELECT id, name, shortName, format, season,
    datetime(startDate/1000, 'unixepoch'),
    datetime(endDate/1000, 'unixepoch'),
    status, description,
    datetime(createdAt/1000, 'unixepoch'),
    datetime(updatedAt/1000, 'unixepoch')
  FROM "Series"`

const SERIES_COPY_TEXT = `INSERT INTO Series_new (id, name, shortName, format, season, startDate, endDate, status, description, createdAt, updatedAt)
  SELECT id, name, shortName, format, season, startDate, endDate, status, description, createdAt, updatedAt FROM "Series"`

async function main() {
  const db = new PrismaClient()
  try {
    const cols = await db.$queryRawUnsafe(
      `SELECT name, type FROM pragma_table_info('Series')`
    )
    const colMap = {}
    for (const c of cols) colMap[c.name] = c.type
    console.log("sync-db: Series columns =", JSON.stringify(colMap))

    const hasSlug = "slug" in colMap
    const dateCols = ["startDate", "endDate", "createdAt", "updatedAt"]
    const badDateCols = dateCols.filter((c) => {
      const t = String(colMap[c] || "").toUpperCase()
      // TEXT affinity columns are fine. INTEGER/NUMERIC/etc. need fixing.
      return t !== "" && t !== "TEXT" && t !== "DATETIME"
    })

    if (!hasSlug && badDateCols.length === 0) {
      console.log("✅ sync-db: Series schema OK (no slug, dates are TEXT)")
      return
    }

    if (hasSlug) console.log("sync-db: Series.slug found")
    if (badDateCols.length)
      console.log("sync-db: bad date column types:", badDateCols.join(", "))

    console.log("sync-db: recreating Series table with correct schema")
    const useIntegerConversion = badDateCols.length > 0

    await db.$executeRawUnsafe(`PRAGMA foreign_keys=off`)
    try {
      await db.$executeRawUnsafe(SERIES_DDL)
      if (useIntegerConversion) {
        await db.$executeRawUnsafe(SERIES_COPY_INTEGER)
      } else {
        await db.$executeRawUnsafe(SERIES_COPY_TEXT)
      }
      await db.$executeRawUnsafe(`DROP TABLE "Series"`)
      await db.$executeRawUnsafe(`ALTER TABLE Series_new RENAME TO Series`)
      console.log("✅ sync-db: Series table recreated with correct schema")
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
