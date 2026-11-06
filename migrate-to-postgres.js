/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * migrate-to-postgres.js — imports data from migration/migration-data.json
 * into the PostgreSQL database. Runs after `prisma db push` creates the
 * tables. Idempotent — skips if data already exists.
 *
 * Usage: node migrate-to-postgres.js
 * Env: DATABASE_URL must point to the PostgreSQL database
 */
const { PrismaClient } = require("@prisma/client")
const fs = require("fs")
const path = require("path")

const prisma = new PrismaClient()

async function main() {
  // Check if data already exists (idempotent)
  const articleCount = await prisma.article.count()
  if (articleCount > 0) {
    console.log("📦 Database already has data — skipping migration.")
    return
  }

  const dataPath = path.join(__dirname, "migration", "migration-data.json")
  if (!fs.existsSync(dataPath)) {
    console.log("⚠️ No migration-data.json found — skipping (fresh database).")
    return
  }

  console.log("📦 Loading migration data...")
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"))

  // Insert in dependency order (parents before children)

  // 1. Series (no dependencies)
  if (data.series?.length) {
    console.log(`  Inserting ${data.series.length} series...`)
    await prisma.series.createMany({ data: data.series, skipDuplicates: true })
  }

  // 2. Teams (no dependencies)
  if (data.teams?.length) {
    console.log(`  Inserting ${data.teams.length} teams...`)
    await prisma.team.createMany({ data: data.teams, skipDuplicates: true })
  }

  // 3. Players (depends on Teams)
  if (data.players?.length) {
    console.log(`  Inserting ${data.players.length} players...`)
    await prisma.player.createMany({ data: data.players, skipDuplicates: true })
  }

  // 4. TournamentTeam (depends on Series + Teams)
  if (data.tournamentTeams?.length) {
    console.log(`  Inserting ${data.tournamentTeams.length} tournament teams...`)
    await prisma.tournamentTeam.createMany({ data: data.tournamentTeams, skipDuplicates: true })
  }

  // 5. Matches (depends on Series + Teams)
  if (data.matches?.length) {
    console.log(`  Inserting ${data.matches.length} matches...`)
    await prisma.match.createMany({ data: data.matches, skipDuplicates: true })
  }

  // 6. Standings (depends on Series + Teams)
  if (data.standings?.length) {
    console.log(`  Inserting ${data.standings.length} standings...`)
    await prisma.standing.createMany({ data: data.standings, skipDuplicates: true })
  }

  // 7. Articles (no dependencies)
  if (data.articles?.length) {
    console.log(`  Inserting ${data.articles.length} articles...`)
    await prisma.article.createMany({ data: data.articles, skipDuplicates: true })
  }

  // 8. Galleries (no dependencies)
  if (data.galleries?.length) {
    console.log(`  Inserting ${data.galleries.length} galleries...`)
    await prisma.gallery.createMany({ data: data.galleries, skipDuplicates: true })
  }

  // 9. Videos (no dependencies)
  if (data.videos?.length) {
    console.log(`  Inserting ${data.videos.length} videos...`)
    await prisma.video.createMany({ data: data.videos, skipDuplicates: true })
  }

  // 10. Banners (no dependencies)
  if (data.banners?.length) {
    console.log(`  Inserting ${data.banners.length} banners...`)
    await prisma.banner.createMany({ data: data.banners, skipDuplicates: true })
  }

  // 11. SiteAdmins (no dependencies)
  if (data.siteAdmins?.length) {
    console.log(`  Inserting ${data.siteAdmins.length} site admins...`)
    await prisma.siteAdmin.createMany({ data: data.siteAdmins, skipDuplicates: true })
  }

  // 12. Scorers (no dependencies)
  if (data.scorers?.length) {
    console.log(`  Inserting ${data.scorers.length} scorers...`)
    await prisma.scorer.createMany({ data: data.scorers, skipDuplicates: true })
  }

  // 13. ScorerAssignments (depends on Scorer + Series)
  if (data.scorerAssignments?.length) {
    console.log(`  Inserting ${data.scorerAssignments.length} scorer assignments...`)
    await prisma.scorerAssignment.createMany({ data: data.scorerAssignments, skipDuplicates: true })
  }

  // 14. LeagueAdmins (no dependencies)
  if (data.leagueAdmins?.length) {
    console.log(`  Inserting ${data.leagueAdmins.length} league admins...`)
    await prisma.leagueAdmin.createMany({ data: data.leagueAdmins, skipDuplicates: true })
  }

  // 15. LeagueAdminAssignments (depends on LeagueAdmin + Series)
  if (data.leagueAdminAssignments?.length) {
    console.log(`  Inserting ${data.leagueAdminAssignments.length} league admin assignments...`)
    await prisma.leagueAdminAssignment.createMany({ data: data.leagueAdminAssignments, skipDuplicates: true })
  }

  // 16. NewsletterSubscribers (no dependencies)
  if (data.newsletterSubscribers?.length) {
    console.log(`  Inserting ${data.newsletterSubscribers.length} newsletter subscribers...`)
    await prisma.newsletterSubscriber.createMany({ data: data.newsletterSubscribers, skipDuplicates: true })
  }

  // 17. SidebarBlocks (no dependencies)
  if (data.sidebarBlocks?.length) {
    console.log(`  Inserting ${data.sidebarBlocks.length} sidebar blocks...`)
    await prisma.sidebarBlock.createMany({ data: data.sidebarBlocks, skipDuplicates: true })
  }

  // 18. Feedback (no dependencies)
  if (data.feedback?.length) {
    console.log(`  Inserting ${data.feedback.length} feedback...`)
    await prisma.feedback.createMany({ data: data.feedback, skipDuplicates: true })
  }

  console.log("✅ Migration complete!")
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Migration failed:", e.message)
    prisma.$disconnect()
    // Don't exit with error — let the app start even if migration fails
    // (the app can work with an empty database)
  })
