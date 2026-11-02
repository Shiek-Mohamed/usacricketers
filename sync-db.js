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

    // Recreate table only if schema is wrong (slug or bad column types).
    if (hasSlug || badDateCols.length > 0) {
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
    } else {
      console.log("✅ sync-db: Series schema OK (no slug, dates are TEXT)")
    }

    // ALWAYS fix data drift: old series rows (from the seed, created via
    // prisma.series.create() with Date objects) may have integer millisecond
    // timestamps stored as text. Prisma's findMany can't convert these back
    // → P2023 "Inconsistent column data" → GET /api/series returns 500.
    // Two passes:
    //   1. Integer timestamps (all-digits, 13+ chars) → ISO 8601 via strftime.
    //   2. SQLite datetime format ("YYYY-MM-DD HH:MM:SS", from a prior run
    //      that used datetime() instead of strftime) → ISO 8601 by swapping
    //      the space for 'T' + appending '.000Z'.
    // ISO strings already containing 'T' are left untouched by both passes.
    for (const col of dateCols) {
      // Pass 1: integer timestamps (pure digits, no dashes/colons) → ISO 8601
      try {
        const r = await db.$executeRawUnsafe(
          `UPDATE "Series" SET "${col}" = strftime('%Y-%m-%dT%H:%M:%S.000Z', CAST("${col}" AS REAL)/1000, 'unixepoch') WHERE "${col}" GLOB '[0-9]*' AND "${col}" NOT GLOB '*-*' AND "${col}" NOT GLOB '*:*' AND length("${col}") >= 13`
        )
        if (r > 0) console.log(`✅ sync-db: converted ${r} integer timestamps in Series.${col}`)
      } catch (e) {
        console.log(`⚠️ sync-db: int fix Series.${col}: ${String(e).slice(0, 100)}`)
      }
      // Pass 2: "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS.000Z"
      try {
        const r = await db.$executeRawUnsafe(
          `UPDATE "Series" SET "${col}" = REPLACE("${col}", ' ', 'T') || '.000Z' WHERE "${col}" LIKE '____-__-__ __:__:__'`
        )
        if (r > 0) console.log(`✅ sync-db: reformatted ${r} datetime values in Series.${col}`)
      } catch (e) {
        console.log(`⚠️ sync-db: fmt fix Series.${col}: ${String(e).slice(0, 100)}`)
      }
      // Pass 3: fix 1970 epoch dates (corrupted by a prior conversion run
      // that misinterpreted datetime-formatted strings as integers). Set
      // to the current time so the series isn't stuck at Jan 1, 1970.
      if (col === "startDate" || col === "endDate") {
        try {
          const r = await db.$executeRawUnsafe(
            `UPDATE "Series" SET "${col}" = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE "${col}" LIKE '1970-%'`
          )
          if (r > 0) console.log(`✅ sync-db: reset ${r} epoch(1970) dates in Series.${col}`)
        } catch (e) {
          console.log(`⚠️ sync-db: epoch fix Series.${col}: ${String(e).slice(0, 100)}`)
        }
      }
    }

    // Add logoUrl column to Team table if it doesn't exist (for fly.io DB
    // which hasn't been db-pushed yet).
    try {
      const teamCols = await db.$queryRawUnsafe(`SELECT name FROM pragma_table_info('Team')`)
      const hasLogoUrl = teamCols.some((c) => c.name === 'logoUrl')
      if (!hasLogoUrl) {
        await db.$executeRawUnsafe(`ALTER TABLE "Team" ADD COLUMN "logoUrl" TEXT`)
        console.log("✅ sync-db: added logoUrl column to Team table")
      }
    } catch (e) {
      console.log(`⚠️ sync-db: Team.logoUrl column check: ${String(e).slice(0, 100)}`)
    }

    // Create NewsletterSubscriber table if it doesn't exist (for fly.io).
    try {
      const tableExists = await db.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name='NewsletterSubscriber'`)
      if (!tableExists || tableExists.length === 0) {
        await db.$executeRawUnsafe(`CREATE TABLE "NewsletterSubscriber" (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, createdAt TEXT NOT NULL)`)
        await db.$executeRawUnsafe(`CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"(email)`)
        console.log("✅ sync-db: created NewsletterSubscriber table")
      }
    } catch (e) {
      console.log(`⚠️ sync-db: NewsletterSubscriber table: ${String(e).slice(0, 100)}`)
    }

    // Create Feedback table if it doesn't exist (for fly.io).
    try {
      const fbExists = await db.$queryRawUnsafe(`SELECT name FROM sqlite_master WHERE type='table' AND name='Feedback'`)
      if (!fbExists || fbExists.length === 0) {
        await db.$executeRawUnsafe(`CREATE TABLE "Feedback" (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'General', message TEXT NOT NULL, page TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL)`)
        console.log("✅ sync-db: created Feedback table")
      }
    } catch (e) {
      console.log(`⚠️ sync-db: Feedback table: ${String(e).slice(0, 100)}`)
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.log("⚠️ sync-db failed:", String(e).slice(0, 300))
  process.exit(0) // non-fatal — don't crash the container
})
