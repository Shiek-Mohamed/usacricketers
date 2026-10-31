import { NextRequest, NextResponse } from "next/server"
import { execSync } from "child_process"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/setup
 *
 * One-time database setup endpoint. Creates tables + seeds data.
 * Call this once after deploying to Fly.io (replaces the SSH approach).
 *
 * Usage: curl https://usacricketers.fly.dev/api/setup
 *
 * After setup succeeds, this endpoint can be ignored (calling it again
 * is idempotent — it won't create duplicate data).
 */
export async function GET(req: NextRequest) {
  const steps: string[] = []
  const force = new URL(req.url).searchParams.get("force") === "true"

  try {
    // Step 1: Sync DB schema — drop legacy columns not in the current
    // Prisma schema. Uses sync-db.js (Prisma client, not the CLI — the CLI
    // has missing transitive deps in the runtime image).
    steps.push("Syncing DB schema...")
    try {
      const out = execSync("node sync-db.js 2>&1", {
        cwd: "/app",
        timeout: 30000,
        encoding: "utf-8" as BufferEncoding,
      })
      steps.push("✅ Schema synced: " + String(out).trim().slice(0, 1500))
    } catch (e) {
      steps.push("⚠️ sync-db output: " + String(e).slice(0, 1500))
    }

    // Step 1b: Create admin account if it doesn't exist (always runs)
    const adminExists = await db.siteAdmin.count()

    // DIAGNOSTIC: show what the APP's Prisma client sees for Series + the
    // DATABASE_URL it's using. Also try a raw INSERT to surface the exact
    // DB rejection (avoids BigInt serialization by selecting only text cols).
    try {
      const cols = await db.$queryRawUnsafe(
        `SELECT name, type FROM pragma_table_info('Series')`
      )
      steps.push(
        "DIAG: DATABASE_URL=" +
          String(process.env.DATABASE_URL || "(unset)").slice(0, 80)
      )
      steps.push(
        "DIAG: Series columns=" +
          cols.map((c: { name: string; type: string }) => c.name).join(", ")
      )
      // Try a raw INSERT with exactly the fields the signup sends
      const now = new Date().toISOString()
      await db.$executeRawUnsafe(
        `INSERT INTO "Series" (id, name, shortName, format, season, startDate, endDate, status, description, createdAt, updatedAt) VALUES ('diag-test','Diag','DIAG','T20','2026','${now}','${now}','upcoming','','${now}','${now}')`
      )
      steps.push("DIAG: raw INSERT succeeded — cleaning up")
      await db.$executeRawUnsafe(`DELETE FROM "Series" WHERE id='diag-test'`)
    } catch (e) {
      steps.push("DIAG err: " + String(e).slice(0, 400))
    }

    if (adminExists === 0 || force) {
      if (adminExists > 0) {
        await db.siteAdmin.deleteMany({})
        steps.push("Deleted existing admin account")
      }
      steps.push("Creating admin account...")
      await db.siteAdmin.create({
        data: {
          email: "admin@usacricketers.test",
          passwordHash: hashPassword("admin123"),
          name: "Site Admin",
          active: true,
        },
      })
      steps.push("✅ Admin account created (email: admin@usacricketers.test, password: admin123)")
    } else {
      steps.push(`Admin account already exists (${adminExists} admins)`)
    }

    // Step 2: Check if already seeded (skip if data exists AND force is not set)
    const teamCount = await db.team.count()
    const seriesCount = await db.series.count()
    if (teamCount > 0 && seriesCount > 0 && !force) {
      steps.push(`Database already has ${teamCount} teams + ${seriesCount} series — skipping seed`)
      return NextResponse.json({
        ok: true,
        steps,
        message: "Database already set up. Use ?force=true to re-seed.",
      })
    }

    // If force=true, clear existing data first
    if (force && teamCount > 0) {
      steps.push("Clearing existing data (force=true)...")
      await db.articleSeries.deleteMany()
      await db.standing.deleteMany()
      await db.match.deleteMany()
      await db.tournamentTeam.deleteMany()
      await db.player.deleteMany()
      await db.team.deleteMany()
      await db.series.deleteMany()
      await db.article.deleteMany()
      await db.video.deleteMany()
      await db.gallery.deleteMany()
      await db.scorerAssignment.deleteMany()
      await db.scorer.deleteMany()
      await db.leagueAdminAssignment.deleteMany()
      await db.leagueAdmin.deleteMany()
      await db.banner.deleteMany()
      await db.sidebarBlock.deleteMany()
      steps.push("✅ Cleared all data")
    }

    // Step 3: Seed
    steps.push("Seeding database...")
    execSync("bun run prisma/seed.ts", {
      cwd: "/app",
      stdio: "pipe",
      timeout: 120000,
    })
    steps.push("✅ Seed complete")

    // Step 4: Import videos
    steps.push("Importing videos from usacricketers.com...")
    try {
      execSync("bun run scripts/import-usacricketers-videos.ts", {
        cwd: "/app",
        stdio: "pipe",
        timeout: 120000,
      })
      steps.push("✅ Videos imported")
    } catch {
      steps.push("⚠️ Video import skipped (may have failed)")
    }

    // Step 5: Verify
    const teams = await db.team.count()
    const players = await db.player.count()
    const matches = await db.match.count()
    const articles = await db.article.count()
    const videos = await db.video.count()
    steps.push(`✅ Verification: ${teams} teams, ${players} players, ${matches} matches, ${articles} articles, ${videos} videos`)

    return NextResponse.json({
      ok: true,
      steps,
      counts: { teams, players, matches, articles, videos },
    })
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    steps.push(`❌ Error: ${error}`)
    return NextResponse.json(
      { ok: false, steps, error },
      { status: 500 },
    )
  }
}
