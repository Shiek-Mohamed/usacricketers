import { db } from "../src/lib/db"
import { Prisma } from "@prisma/client"

async function main() {
  console.log("🌱 Seeding cricket CMS database...")

  // Clean
  await db.match.deleteMany()
  await db.player.deleteMany()
  await db.series.deleteMany()
  await db.team.deleteMany()
  await db.article.deleteMany()

  // ===== TEAMS =====
  const teams = [
    { name: "India", shortName: "IND", country: "India", primaryColor: "#1a4d8f", accentColor: "#f59e0b", description: "The India men's national cricket team, also known as the Men in Blue, represents India in men's international cricket." },
    { name: "Australia", shortName: "AUS", country: "Australia", primaryColor: "#0a7d1e", accentColor: "#fde047", description: "The Australian men's national cricket team represents Australia in men's international cricket." },
    { name: "England", shortName: "ENG", country: "England", primaryColor: "#1d4ed8", accentColor: "#dc2626", description: "The England cricket team represents England and Wales in international cricket." },
    { name: "Pakistan", shortName: "PAK", country: "Pakistan", primaryColor: "#15803d", accentColor: "#16a34a", description: "The Pakistan national cricket team represents Pakistan in men's international cricket." },
    { name: "South Africa", shortName: "RSA", country: "South Africa", primaryColor: "#1e7d3a", accentColor: "#fde047", description: "The South Africa national cricket team represents South Africa in men's international cricket." },
    { name: "New Zealand", shortName: "NZ", country: "New Zealand", primaryColor: "#1e293b", accentColor: "#ef4444", description: "The New Zealand national cricket team represents New Zealand in men's international cricket." },
    { name: "Sri Lanka", shortName: "SL", country: "Sri Lanka", primaryColor: "#1e40af", accentColor: "#f59e0b", description: "The Sri Lanka national cricket team represents Sri Lanka in men's international cricket." },
    { name: "Bangladesh", shortName: "BAN", country: "Bangladesh", primaryColor: "#15803d", accentColor: "#dc2626", description: "The Bangladesh national cricket team represents Bangladesh in men's international cricket." },
  ]

  const teamRecords = await Promise.all(
    teams.map((t) => db.team.create({ data: t }))
  )
  const teamByShort: Record<string, typeof teamRecords[0]> = {}
  teamRecords.forEach((t) => (teamByShort[t.shortName] = t))

  // ===== PLAYERS =====
  const playerData: Array<Omit<Prisma.PlayerCreateInput, "team"> & { teamShort: string }> = [
    // India
    { name: "Rohit Sharma", teamShort: "IND", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm offbreak", bio: "Indian captain and one of the greatest opening batters of the modern era.", imageUrl: "", battingStats: JSON.stringify({ matches: 473, innings: 457, runs: 19700, highest: "264", average: 48.9, strikeRate: 92.2, hundreds: 48, fifties: 106, fours: 2100, sixes: 620, notOuts: 18 }), bowlingStats: JSON.stringify({ matches: 473, innings: 9, balls: 96, runs: 105, wickets: 9, best: "2/21", economy: 6.56, average: 11.7, strikeRate: 10.7, maidens: 0 }) },
    { name: "Virat Kohli", teamShort: "IND", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm medium", bio: "One of the greatest batters of all time, known for his consistency and chase mastery.", imageUrl: "", battingStats: JSON.stringify({ matches: 552, innings: 539, runs: 26942, highest: "254*", average: 53.6, strikeRate: 93.4, hundreds: 80, fifties: 140, fours: 2590, sixes: 300, notOuts: 31 }), bowlingStats: JSON.stringify({ matches: 552, innings: 49, balls: 662, runs: 541, wickets: 8, best: "1/14", economy: 4.9, average: 67.6, strikeRate: 82.8, maidens: 7 }) },
    { name: "Jasprit Bumrah", teamShort: "IND", role: "Bowler", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm fast", bio: "The premier fast bowler in world cricket, master of yorkers and accuracy.", imageUrl: "", battingStats: JSON.stringify({ matches: 121, innings: 51, runs: 245, highest: "16*", average: 6.6, strikeRate: 70.0, hundreds: 0, fifties: 0, fours: 28, sixes: 4, notOuts: 14 }), bowlingStats: JSON.stringify({ matches: 121, innings: 119, balls: 6400, runs: 4250, wickets: 384, best: "6/19", economy: 3.98, average: 11.1, strikeRate: 16.7, maidens: 320 }) },
    { name: "Ravindra Jadeja", teamShort: "IND", role: "All-rounder", battingStyle: "Left-hand bat", bowlingStyle: "Left-arm orthodox", bio: "World-class all-rounder, brilliant fielder, and match-winner in all formats.", imageUrl: "", battingStats: JSON.stringify({ matches: 380, innings: 289, runs: 6420, highest: "175*", average: 35.4, strikeRate: 84.2, hundreds: 4, fifties: 35, fours: 720, sixes: 180, notOuts: 78 }), bowlingStats: JSON.stringify({ matches: 380, innings: 350, balls: 16800, runs: 9450, wickets: 583, best: "7/42", economy: 3.37, average: 16.2, strikeRate: 28.8, maidens: 980 }) },
    { name: "Rishabh Pant", teamShort: "IND", role: "Wicket-keeper", battingStyle: "Left-hand bat", bowlingStyle: "", bio: "Explosive wicket-keeper batter known for fearless match-winning knocks.", imageUrl: "", battingStats: JSON.stringify({ matches: 156, innings: 142, runs: 5980, highest: "159*", average: 43.6, strikeRate: 89.1, hundreds: 12, fifties: 28, fours: 660, sixes: 210, notOuts: 6 }), bowlingStats: null },

    // Australia
    { name: "Pat Cummins", teamShort: "AUS", role: "Bowler", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm fast", bio: "Australian captain and one of the world's best fast bowlers.", imageUrl: "", battingStats: JSON.stringify({ matches: 194, innings: 130, runs: 1980, highest: "64", average: 17.5, strikeRate: 78.2, hundreds: 0, fifties: 4, fours: 220, sixes: 60, notOuts: 32 }), bowlingStats: JSON.stringify({ matches: 194, innings: 188, balls: 9800, runs: 6200, wickets: 470, best: "7/44", economy: 3.79, average: 13.2, strikeRate: 20.9, maidens: 450 }) },
    { name: "Steve Smith", teamShort: "AUS", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm legbreak", bio: "One of the finest Test batters of his generation, unorthodox and prolific.", imageUrl: "", battingStats: JSON.stringify({ matches: 318, innings: 301, runs: 17980, highest: "239", average: 56.7, strikeRate: 71.2, hundreds: 44, fifties: 85, fours: 1820, sixes: 120, notOuts: 15 }), bowlingStats: JSON.stringify({ matches: 318, innings: 40, balls: 580, runs: 510, wickets: 17, best: "3/23", economy: 5.27, average: 30.0, strikeRate: 34.1, maidens: 2 }) },
    { name: "David Warner", teamShort: "AUS", role: "Batsman", battingStyle: "Left-hand bat", bowlingStyle: "Right-arm legbreak", bio: "Aggressive opening batter and one of Australia's greatest white-ball openers.", imageUrl: "", battingStats: JSON.stringify({ matches: 383, innings: 376, runs: 18612, highest: "335*", average: 42.5, strikeRate: 87.4, hundreds: 49, fifties: 76, fours: 1980, sixes: 320, notOuts: 10 }), bowlingStats: null },
    { name: "Mitchell Starc", teamShort: "AUS", role: "Bowler", battingStyle: "Left-hand bat", bowlingStyle: "Left-arm fast", bio: "Lethal left-arm fast bowler, master of white-ball cricket.", imageUrl: "", battingStats: JSON.stringify({ matches: 220, innings: 134, runs: 2310, highest: "99", average: 18.5, strikeRate: 88.2, hundreds: 0, fifties: 8, fours: 250, sixes: 75, notOuts: 28 }), bowlingStats: JSON.stringify({ matches: 220, innings: 215, balls: 11200, runs: 7100, wickets: 612, best: "6/28", economy: 3.80, average: 11.6, strikeRate: 18.3, maidens: 520 }) },
    { name: "Glenn Maxwell", teamShort: "AUS", role: "All-rounder", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm offbreak", bio: "The 'Big Show' - explosive batter and handy off-spinner.", imageUrl: "", battingStats: JSON.stringify({ matches: 251, innings: 224, runs: 8420, highest: "201*", average: 35.8, strikeRate: 121.4, hundreds: 9, fifties: 42, fours: 720, sixes: 580, notOuts: 18 }), bowlingStats: JSON.stringify({ matches: 251, innings: 165, balls: 5200, runs: 4300, wickets: 145, best: "4/46", economy: 4.96, average: 29.7, strikeRate: 35.9, maidens: 60 }) },

    // England
    { name: "Joe Root", teamShort: "ENG", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm offbreak", bio: "England's premier Test batter and former captain.", imageUrl: "", battingStats: JSON.stringify({ matches: 325, innings: 304, runs: 18452, highest: "254", average: 51.5, strikeRate: 68.3, hundreds: 36, fifties: 88, fours: 1950, sixes: 88, notOuts: 21 }), bowlingStats: JSON.stringify({ matches: 325, innings: 90, balls: 2400, runs: 1850, wickets: 60, best: "5/8", economy: 4.62, average: 30.8, strikeRate: 40.0, maidens: 28 }) },
    { name: "Ben Stokes", teamShort: "ENG", role: "All-rounder", battingStyle: "Left-hand bat", bowlingStyle: "Right-arm fast-medium", bio: "England's inspirational all-rounder and World Cup hero.", imageUrl: "", battingStats: JSON.stringify({ matches: 289, innings: 256, runs: 11240, highest: "258", average: 38.1, strikeRate: 95.2, hundreds: 18, fifties: 56, fours: 1080, sixes: 380, notOuts: 26 }), bowlingStats: JSON.stringify({ matches: 289, innings: 210, balls: 8900, runs: 5800, wickets: 305, best: "6/22", economy: 3.91, average: 19.0, strikeRate: 29.2, maidens: 240 }) },
    { name: "Jofra Archer", teamShort: "ENG", role: "Bowler", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm fast", bio: "Express fast bowler who led England to World Cup glory in 2019.", imageUrl: "", battingStats: JSON.stringify({ matches: 78, innings: 40, runs: 480, highest: "30*", average: 13.7, strikeRate: 110.2, hundreds: 0, fifties: 0, fours: 52, sixes: 18, notOuts: 8 }), bowlingStats: JSON.stringify({ matches: 78, innings: 76, balls: 3200, runs: 2580, wickets: 158, best: "6/40", economy: 4.84, average: 16.3, strikeRate: 20.3, maidens: 40 }) },
    { name: "Harry Brook", teamShort: "ENG", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm medium", bio: "Dynamic young batter who has taken international cricket by storm.", imageUrl: "", battingStats: JSON.stringify({ matches: 95, innings: 86, runs: 3680, highest: "186", average: 44.8, strikeRate: 96.5, hundreds: 10, fifties: 18, fours: 380, sixes: 110, notOuts: 4 }), bowlingStats: null },

    // Pakistan
    { name: "Babar Azam", teamShort: "PAK", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm offbreak", bio: "Pakistan captain and one of the most elegant batters in the modern game.", imageUrl: "", battingStats: JSON.stringify({ matches: 268, innings: 258, runs: 12840, highest: "196", average: 47.8, strikeRate: 88.2, hundreds: 31, fifties: 58, fours: 1280, sixes: 180, notOuts: 12 }), bowlingStats: JSON.stringify({ matches: 268, innings: 12, balls: 180, runs: 165, wickets: 2, best: "1/18", economy: 5.5, average: 82.5, strikeRate: 90, maidens: 0 }) },
    { name: "Shaheen Afridi", teamShort: "PAK", role: "Bowler", battingStyle: "Left-hand bat", bowlingStyle: "Left-arm fast", bio: "Spearhead of Pakistan's pace attack, lethal with the new ball.", imageUrl: "", battingStats: JSON.stringify({ matches: 142, innings: 78, runs: 920, highest: "26", average: 8.7, strikeRate: 92.1, hundreds: 0, fifties: 0, fours: 88, sixes: 30, notOuts: 28 }), bowlingStats: JSON.stringify({ matches: 142, innings: 140, balls: 6800, runs: 4900, wickets: 342, best: "6/35", economy: 4.32, average: 14.3, strikeRate: 19.9, maidens: 180 }) },
    { name: "Mohammad Rizwan", teamShort: "PAK", role: "Wicket-keeper", battingStyle: "Right-hand bat", bowlingStyle: "", bio: "Gritty wicket-keeper batter and a cornerstone of Pakistan's batting.", imageUrl: "", battingStats: JSON.stringify({ matches: 198, innings: 184, runs: 7250, highest: "171*", average: 42.6, strikeRate: 84.5, hundreds: 14, fifties: 32, fours: 720, sixes: 80, notOuts: 14 }), bowlingStats: null },

    // South Africa
    { name: "Kagiso Rabada", teamShort: "RSA", role: "Bowler", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm fast", bio: "South Africa's strike bowler with express pace and aggression.", imageUrl: "", battingStats: JSON.stringify({ matches: 178, innings: 95, runs: 1240, highest: "37", average: 9.5, strikeRate: 76.5, hundreds: 0, fifties: 0, fours: 130, sixes: 28, notOuts: 30 }), bowlingStats: JSON.stringify({ matches: 178, innings: 174, balls: 8200, runs: 5200, wickets: 412, best: "7/12", economy: 3.80, average: 12.6, strikeRate: 19.9, maidens: 280 }) },
    { name: "Quinton de Kock", teamShort: "RSA", role: "Wicket-keeper", battingStyle: "Left-hand bat", bowlingStyle: "", bio: "Explosive opener and wicket-keeper, one of South Africa's great white-ball batters.", imageUrl: "", battingStats: JSON.stringify({ matches: 262, innings: 251, runs: 11240, highest: "178*", average: 38.7, strikeRate: 92.4, hundreds: 22, fifties: 51, fours: 1180, sixes: 220, notOuts: 18 }), bowlingStats: null },
    { name: "Aiden Markram", teamShort: "RSA", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm offbreak", bio: "Elegant top-order batter and handy off-spinner, South Africa's white-ball captain.", imageUrl: "", battingStats: JSON.stringify({ matches: 168, innings: 158, runs: 6240, highest: "175", average: 41.6, strikeRate: 88.2, hundreds: 14, fifties: 32, fours: 680, sixes: 120, notOuts: 12 }), bowlingStats: JSON.stringify({ matches: 168, innings: 60, balls: 1800, runs: 1450, wickets: 42, best: "3/21", economy: 4.83, average: 34.5, strikeRate: 42.9, maidens: 12 }) },
    { name: "Temba Bavuma", teamShort: "RSA", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "", bio: "South Africa's Test captain and a resilient top-order batter.", imageUrl: "", battingStats: JSON.stringify({ matches: 98, innings: 92, runs: 4120, highest: "172", average: 44.8, strikeRate: 71.2, hundreds: 9, fifties: 21, fours: 460, sixes: 40, notOuts: 8 }), bowlingStats: null },
    { name: "David Miller", teamShort: "RSA", role: "Batsman", battingStyle: "Left-hand bat", bowlingStyle: "Right-arm offbreak", bio: "Explosive finisher and one of South Africa's great white-ball batters.", imageUrl: "", battingStats: JSON.stringify({ matches: 287, innings: 248, runs: 6920, highest: "139", average: 41.5, strikeRate: 108.2, hundreds: 7, fifties: 39, fours: 540, sixes: 280, notOuts: 60 }), bowlingStats: null },
    { name: "Heinrich Klaasen", teamShort: "RSA", role: "Wicket-keeper", battingStyle: "Right-hand bat", bowlingStyle: "", bio: "Destructive middle-order wicket-keeper batter, a six-hitting machine.", imageUrl: "", battingStats: JSON.stringify({ matches: 102, innings: 95, runs: 3480, highest: "119", average: 40.5, strikeRate: 122.4, hundreds: 4, fifties: 18, fours: 320, sixes: 190, notOuts: 18 }), bowlingStats: null },
    { name: "Tristan Stubbs", teamShort: "RSA", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm offbreak", bio: "Young middle-order batter with a bright future across formats.", imageUrl: "", battingStats: JSON.stringify({ matches: 42, innings: 40, runs: 1380, highest: "94", average: 38.3, strikeRate: 102.1, hundreds: 0, fifties: 11, fours: 120, sixes: 50, notOuts: 6 }), bowlingStats: null },
    { name: "Marco Jansen", teamShort: "RSA", role: "Bowler", battingStyle: "Left-hand bat", bowlingStyle: "Left-arm fast", bio: "Tall left-arm quick and handy lower-order batter.", imageUrl: "", battingStats: JSON.stringify({ matches: 48, innings: 38, runs: 620, highest: "34", average: 16.3, strikeRate: 92.4, hundreds: 0, fifties: 0, fours: 60, sixes: 18, notOuts: 10 }), bowlingStats: JSON.stringify({ matches: 48, innings: 46, balls: 2100, runs: 1480, wickets: 88, best: "5/32", economy: 4.23, average: 16.8, strikeRate: 23.9, maidens: 40 }) },
    { name: "Anrich Nortje", teamShort: "RSA", role: "Bowler", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm fast", bio: "Express-pace bowler who rattles batters with raw speed.", imageUrl: "", battingStats: JSON.stringify({ matches: 72, innings: 32, runs: 280, highest: "18", average: 9.7, strikeRate: 88.1, hundreds: 0, fifties: 0, fours: 30, sixes: 8, notOuts: 12 }), bowlingStats: JSON.stringify({ matches: 72, innings: 70, balls: 3200, runs: 2280, wickets: 132, best: "6/44", economy: 4.28, average: 17.3, strikeRate: 24.2, maidens: 52 }) },
    { name: "Tabraiz Shamsi", teamShort: "RSA", role: "Bowler", battingStyle: "Left-hand bat", bowlingStyle: "Left-arm chinaman", bio: "Wily wrist-spinner and a T20 specialist.", imageUrl: "", battingStats: JSON.stringify({ matches: 68, innings: 30, runs: 180, highest: "12", average: 7.8, strikeRate: 95.0, hundreds: 0, fifties: 0, fours: 18, sixes: 5, notOuts: 14 }), bowlingStats: JSON.stringify({ matches: 68, innings: 66, balls: 2400, runs: 1980, wickets: 94, best: "4/24", economy: 4.95, average: 21.1, strikeRate: 25.5, maidens: 22 }) },
    { name: "Keshav Maharaj", teamShort: "RSA", role: "Bowler", battingStyle: "Left-hand bat", bowlingStyle: "Left-arm orthodox", bio: "South Africa's lead spinner and handy lower-order batter.", imageUrl: "", battingStats: JSON.stringify({ matches: 56, innings: 48, runs: 940, highest: "72", average: 22.9, strikeRate: 78.2, hundreds: 0, fifties: 3, fours: 100, sixes: 12, notOuts: 14 }), bowlingStats: JSON.stringify({ matches: 56, innings: 54, balls: 3600, runs: 2180, wickets: 168, best: "9/27", economy: 3.63, average: 13.0, strikeRate: 21.4, maidens: 130 }) },

    // New Zealand
    { name: "Kane Williamson", teamShort: "NZ", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm offbreak", bio: "New Zealand's inspirational captain and a modern batting great.", imageUrl: "", battingStats: JSON.stringify({ matches: 312, innings: 296, runs: 13820, highest: "251", average: 49.0, strikeRate: 74.5, hundreds: 38, fifties: 68, fours: 1450, sixes: 90, notOuts: 18 }), bowlingStats: JSON.stringify({ matches: 312, innings: 80, balls: 2100, runs: 1620, wickets: 45, best: "3/15", economy: 4.63, average: 36.0, strikeRate: 46.7, maidens: 22 }) },
    { name: "Trent Boult", teamShort: "NZ", role: "Bowler", battingStyle: "Right-hand bat", bowlingStyle: "Left-arm fast", bio: "New Zealand's greatest fast bowler, master of swing and the new ball.", imageUrl: "", battingStats: JSON.stringify({ matches: 196, innings: 110, runs: 1450, highest: "38", average: 11.2, strikeRate: 78.4, hundreds: 0, fifties: 0, fours: 150, sixes: 35, notOuts: 22 }), bowlingStats: JSON.stringify({ matches: 196, innings: 192, balls: 8600, runs: 5400, wickets: 388, best: "6/24", economy: 3.77, average: 13.9, strikeRate: 22.2, maidens: 320 }) },
    { name: "Devon Conway", teamShort: "NZ", role: "Batsman", battingStyle: "Left-hand bat", bowlingStyle: "Right-arm medium", bio: "Stylish South-African born opener who has flourished for New Zealand.", imageUrl: "", battingStats: JSON.stringify({ matches: 128, innings: 122, runs: 4820, highest: "200*", average: 42.3, strikeRate: 86.4, hundreds: 11, fifties: 22, fours: 520, sixes: 90, notOuts: 10 }), bowlingStats: null },

    // Sri Lanka
    { name: "Dimuth Karunaratne", teamShort: "SL", role: "Batsman", battingStyle: "Left-hand bat", bowlingStyle: "Right-arm medium", bio: "Sri Lankan Test opener and former captain.", imageUrl: "", battingStats: JSON.stringify({ matches: 108, innings: 192, runs: 6840, highest: "244", average: 39.8, strikeRate: 56.2, hundreds: 16, fifties: 32, fours: 760, sixes: 30, notOuts: 10 }), bowlingStats: null },
    { name: "Wanindu Hasaranga", teamShort: "SL", role: "All-rounder", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm legbreak", bio: "Sri Lanka's leg-spin sensation and a potent white-ball all-rounder.", imageUrl: "", battingStats: JSON.stringify({ matches: 145, innings: 112, runs: 2480, highest: "78", average: 22.0, strikeRate: 110.2, hundreds: 0, fifties: 9, fours: 210, sixes: 110, notOuts: 28 }), bowlingStats: JSON.stringify({ matches: 145, innings: 140, balls: 2980, runs: 2680, wickets: 168, best: "4/9", economy: 5.39, average: 15.95, strikeRate: 17.7, maidens: 30 }) },
    { name: "Pathum Nissanka", teamShort: "SL", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "", bio: "Promising young opener who has cemented his place at the top of the order.", imageUrl: "", battingStats: JSON.stringify({ matches: 92, innings: 88, runs: 3680, highest: "137*", average: 42.3, strikeRate: 88.5, hundreds: 8, fifties: 22, fours: 380, sixes: 50, notOuts: 8 }), bowlingStats: null },
    { name: "Kusal Mendis", teamShort: "SL", role: "Wicket-keeper", battingStyle: "Right-hand bat", bowlingStyle: "", bio: "Aggressive wicket-keeper batter and Sri Lanka's middle-order mainstay.", imageUrl: "", battingStats: JSON.stringify({ matches: 162, innings: 152, runs: 5840, highest: "102*", average: 38.4, strikeRate: 89.2, hundreds: 8, fifties: 34, fours: 620, sixes: 60, notOuts: 14 }), bowlingStats: null },
    { name: "Dhananjaya de Silva", teamShort: "SL", role: "Batsman", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm offbreak", bio: "Elegant middle-order batter and part-time off-spinner.", imageUrl: "", battingStats: JSON.stringify({ matches: 118, innings: 108, runs: 4280, highest: "166", average: 41.2, strikeRate: 81.4, hundreds: 10, fifties: 24, fours: 480, sixes: 50, notOuts: 12 }), bowlingStats: JSON.stringify({ matches: 118, innings: 40, balls: 900, runs: 720, wickets: 18, best: "2/24", economy: 4.80, average: 40.0, strikeRate: 50.0, maidens: 4 }) },
    { name: "Charith Asalanka", teamShort: "SL", role: "Batsman", battingStyle: "Left-hand bat", bowlingStyle: "Right-arm offbreak", bio: "Stylish left-hander who leads Sri Lanka's white-ball side.", imageUrl: "", battingStats: JSON.stringify({ matches: 78, innings: 74, runs: 2980, highest: "110*", average: 42.5, strikeRate: 102.4, hundreds: 4, fifties: 20, fours: 280, sixes: 80, notOuts: 8 }), bowlingStats: null },
    { name: "Angelo Mathews", teamShort: "SL", role: "All-rounder", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm medium", bio: "Veteran all-rounder and former captain, a Sri Lankan great.", imageUrl: "", battingStats: JSON.stringify({ matches: 298, innings: 278, runs: 9840, highest: "200", average: 41.0, strikeRate: 74.8, hundreds: 13, fifties: 60, fours: 920, sixes: 80, notOuts: 38 }), bowlingStats: JSON.stringify({ matches: 298, innings: 150, balls: 4200, runs: 3180, wickets: 92, best: "3/12", economy: 4.54, average: 34.6, strikeRate: 45.7, maidens: 40 }) },
    { name: "Dasun Shanaka", teamShort: "SL", role: "All-rounder", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm medium", bio: "Power-hitter and seam-bowling all-rounder.", imageUrl: "", battingStats: JSON.stringify({ matches: 86, innings: 74, runs: 1820, highest: "74*", average: 24.6, strikeRate: 118.2, hundreds: 0, fifties: 6, fours: 150, sixes: 80, notOuts: 14 }), bowlingStats: JSON.stringify({ matches: 86, innings: 48, balls: 960, runs: 820, wickets: 24, best: "3/15", economy: 5.13, average: 34.2, strikeRate: 40.0, maidens: 4 }) },
    { name: "Dushmantha Chameera", teamShort: "SL", role: "Bowler", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm fast", bio: "Sri Lanka's fastest bowler, a genuine pace weapon.", imageUrl: "", battingStats: JSON.stringify({ matches: 88, innings: 42, runs: 320, highest: "14", average: 7.6, strikeRate: 90.0, hundreds: 0, fifties: 0, fours: 30, sixes: 6, notOuts: 12 }), bowlingStats: JSON.stringify({ matches: 88, innings: 86, balls: 3200, runs: 2380, wickets: 118, best: "5/38", economy: 4.46, average: 20.2, strikeRate: 27.1, maidens: 30 }) },
    { name: "Maheesh Theekshana", teamShort: "SL", role: "Bowler", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm offbreak", bio: "Mystery off-spinner with a potent carrom ball.", imageUrl: "", battingStats: JSON.stringify({ matches: 64, innings: 28, runs: 180, highest: "10", average: 8.2, strikeRate: 90.0, hundreds: 0, fifties: 0, fours: 18, sixes: 4, notOuts: 10 }), bowlingStats: JSON.stringify({ matches: 64, innings: 62, balls: 2200, runs: 1780, wickets: 84, best: "4/19", economy: 4.85, average: 21.2, strikeRate: 26.2, maidens: 18 }) },
    { name: "Lahiru Kumara", teamShort: "SL", role: "Bowler", battingStyle: "Right-hand bat", bowlingStyle: "Right-arm fast", bio: "Hostile fast bowler who hits the deck hard.", imageUrl: "", battingStats: JSON.stringify({ matches: 52, innings: 26, runs: 160, highest: "8", average: 7.3, strikeRate: 84.2, hundreds: 0, fifties: 0, fours: 14, sixes: 4, notOuts: 8 }), bowlingStats: JSON.stringify({ matches: 52, innings: 50, balls: 1800, runs: 1380, wickets: 76, best: "5/45", economy: 4.60, average: 18.2, strikeRate: 23.7, maidens: 18 }) },

    // Bangladesh
    { name: "Shakib Al Hasan", teamShort: "BAN", role: "All-rounder", battingStyle: "Left-hand bat", bowlingStyle: "Left-arm orthodox", bio: "Bangladesh's greatest cricketer - world-class all-rounder across all formats.", imageUrl: "", battingStats: JSON.stringify({ matches: 388, innings: 356, runs: 14680, highest: "217", average: 41.5, strikeRate: 84.2, hundreds: 25, fifties: 76, fours: 1480, sixes: 280, notOuts: 32 }), bowlingStats: JSON.stringify({ matches: 388, innings: 360, balls: 16800, runs: 9800, wickets: 698, best: "7/36", economy: 3.50, average: 14.04, strikeRate: 24.1, maidens: 980 }) },
    { name: "Mushfiqur Rahim", teamShort: "BAN", role: "Wicket-keeper", battingStyle: "Right-hand bat", bowlingStyle: "", bio: "Bangladesh's most reliable batter and long-serving wicket-keeper.", imageUrl: "", battingStats: JSON.stringify({ matches: 348, innings: 332, runs: 11820, highest: "219", average: 37.8, strikeRate: 74.2, hundreds: 18, fifties: 58, fours: 1280, sixes: 120, notOuts: 20 }), bowlingStats: null },
    { name: "Mustafizur Rahman", teamShort: "BAN", role: "Bowler", battingStyle: "Left-hand bat", bowlingStyle: "Left-arm fast-medium", bio: "The 'Fizz' - master of the cutter and variations in white-ball cricket.", imageUrl: "", battingStats: JSON.stringify({ matches: 128, innings: 45, runs: 320, highest: "14", average: 7.3, strikeRate: 80.0, hundreds: 0, fifties: 0, fours: 30, sixes: 8, notOuts: 10 }), bowlingStats: JSON.stringify({ matches: 128, innings: 126, balls: 2680, runs: 2280, wickets: 198, best: "6/10", economy: 5.10, average: 11.5, strikeRate: 13.5, maidens: 28 }) },
  ]

  await Promise.all(
    playerData.map((p) =>
      db.player.create({
        data: {
          name: p.name,
          role: p.role,
          battingStyle: p.battingStyle,
          bowlingStyle: p.bowlingStyle || "",
          battingStats: p.battingStats,
          bowlingStats: p.bowlingStats || "",
          bio: p.bio,
          imageUrl: p.imageUrl,
          team: { connect: { id: teamByShort[p.teamShort].id } },
        },
      })
    )
  )

  // ===== SERIES =====
  const seriesData = [
    { name: "Border-Gavaskar Trophy 2024-25", shortName: "BGT 2024-25", format: "Test", season: "2024-25", startDate: new Date("2024-11-22"), endDate: new Date("2025-01-07"), status: "completed", description: "Five-Test series between Australia and India." },
    { name: "India tour of England 2025", shortName: "IND v ENG 2025", format: "Test", season: "2025", startDate: new Date("2025-06-20"), endDate: new Date("2025-08-04"), status: "ongoing", description: "Five-Test series in England." },
    { name: "Champions Trophy 2025", shortName: "CT 2025", format: "ODI", season: "2025", startDate: new Date("2025-02-19"), endDate: new Date("2025-03-09"), status: "completed", description: "The ICC Champions Trophy hosted in Pakistan." },
    { name: "Australia tour of New Zealand 2025", shortName: "AUS v NZ 2025", format: "T20I", season: "2025", startDate: new Date("2025-03-05"), endDate: new Date("2025-03-12"), status: "completed", description: "Three-match T20I series." },
    { name: "South Africa tour of West Indies 2025", shortName: "RSA v WI 2025", format: "ODI", season: "2025", startDate: new Date("2025-07-10"), endDate: new Date("2025-07-20"), status: "upcoming", description: "Three ODIs and two Tests." },
  ]
  const seriesRecords = await Promise.all(
    seriesData.map((s) => db.series.create({ data: s }))
  )

  // ===== MATCHES =====
  const matchesData = [
    // Completed Test - IND vs AUS (BGT)
    {
      seriesId: seriesRecords[0].id,
      team1Short: "IND",
      team2Short: "AUS",
      format: "Test",
      matchNo: "1st Test",
      status: "completed",
      venue: "Adelaide Oval",
      city: "Adelaide",
      startDate: new Date("2024-12-06"),
      result: "Australia won by 10 wickets",
      scorecard: JSON.stringify({
        note: "Day 5 - Australia chased down the target.",
        innings: [
          {
            teamId: teamByShort["IND"].id,
            teamShortName: "IND",
            total: "180",
            totalRuns: 180,
            totalWickets: 10,
            totalOvers: "59.2",
            declared: false,
            batting: [
              { name: "Yashasvi Jaiswal", runs: 24, balls: 42, fours: 3, sixes: 0, strikeRate: 57.1, dismissal: "c Carey b Starc", isBatting: false },
              { name: "KL Rahul", runs: 24, balls: 50, fours: 2, sixes: 0, strikeRate: 48.0, dismissal: "lbw b Boland", isBatting: false },
              { name: "Virat Kohli", runs: 7, balls: 8, fours: 1, sixes: 0, strikeRate: 87.5, dismissal: "c Smith b Boland", isBatting: false },
              { name: "Rishabh Pant", runs: 21, balls: 35, fours: 2, sixes: 1, strikeRate: 60.0, dismissal: "c Head b Cummins", isBatting: false },
              { name: "Ravindra Jadeja", runs: 42, balls: 60, fours: 5, sixes: 0, strikeRate: 70.0, dismissal: "c Smith b Hazlewood", isBatting: false },
              { name: "Nitish Reddy", runs: 23, balls: 38, fours: 2, sixes: 1, strikeRate: 60.5, dismissal: "c Labuschagne b Lyon", isBatting: false },
              { name: "R Ashwin", runs: 0, balls: 4, fours: 0, sixes: 0, strikeRate: 0.0, dismissal: "lbw b Lyon", isBatting: false },
              { name: "Jasprit Bumrah", runs: 0, balls: 2, fours: 0, sixes: 0, strikeRate: 0.0, dismissal: "b Starc", isBatting: false },
              { name: "Mohammed Siraj", runs: 14, balls: 18, fours: 2, sixes: 0, strikeRate: 77.8, dismissal: "c sub b Hazlewood", isBatting: false },
              { name: "Harshit Rana", runs: 0, balls: 1, fours: 0, sixes: 0, strikeRate: 0.0, dismissal: "not out", isBatting: true },
              { name: "Extras", runs: 35, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissal: "(b 12, lb 14, w 6, nb 3)", isBatting: false },
            ],
            bowling: [
              { name: "Mitchell Starc", overs: "18", maidens: 4, runs: 41, wickets: 3, economy: 2.27, isBowling: false },
              { name: "Pat Cummins", overs: "16", maidens: 3, runs: 36, wickets: 2, economy: 2.25, isBowling: false },
              { name: "Josh Hazlewood", overs: "14.2", maidens: 4, runs: 35, wickets: 3, economy: 2.45, isBowling: false },
              { name: "Nathan Lyon", overs: "7", maidens: 1, runs: 28, wickets: 2, economy: 4.0, isBowling: false },
              { name: "Scott Boland", overs: "4", maidens: 1, runs: 18, wickets: 0, economy: 4.5, isBowling: false },
            ],
            fallOfWickets: ["32 (Rahul)", "56 (Kohli)", "67 (Jaiswal)", "141 (Pant)", "141 (Reddy)", "153 (Jadeja)", "153 (Ashwin)", "175 (Bumrah)", "180 (Siraj)"],
          },
          {
            teamId: teamByShort["AUS"].id,
            teamShortName: "AUS",
            total: "337",
            totalRuns: 337,
            totalWickets: 10,
            totalOvers: "102",
            declared: false,
            batting: [
              { name: "Usman Khawaja", runs: 13, balls: 32, fours: 1, sixes: 0, strikeRate: 40.6, dismissal: "c Pant b Bumrah", isBatting: false },
              { name: "Nathan McSweeney", runs: 39, balls: 99, fours: 4, sixes: 0, strikeRate: 39.4, dismissal: "c Rahul b Siraj", isBatting: false },
              { name: "Marnus Labuschagne", runs: 64, balls: 142, fours: 8, sixes: 0, strikeRate: 45.1, dismissal: "c Pant b Bumrah", isBatting: false },
              { name: "Steven Smith", runs: 36, balls: 67, fours: 5, sixes: 0, strikeRate: 53.7, dismissal: "c Jaiswal b Jadeja", isBatting: false },
              { name: "Travis Head", runs: 140, balls: 141, fours: 17, sixes: 1, strikeRate: 99.3, dismissal: "b Siraj", isBatting: false },
              { name: "Alex Carey", runs: 26, balls: 48, fours: 3, sixes: 0, strikeRate: 54.2, dismissal: "c Pant b Jadeja", isBatting: false },
              { name: "Mitchell Marsh", runs: 23, balls: 32, fours: 2, sixes: 1, strikeRate: 71.9, dismissal: "b Jadeja", isBatting: false },
              { name: "Pat Cummins", runs: 18, balls: 32, fours: 1, sixes: 1, strikeRate: 56.3, dismissal: "c Jadeja b Ashwin", isBatting: false },
              { name: "Mitchell Starc", runs: 10, balls: 19, fours: 1, sixes: 0, strikeRate: 52.6, dismissal: "run out (Siraj)", isBatting: false },
              { name: "Nathan Lyon", runs: 0, balls: 1, fours: 0, sixes: 0, strikeRate: 0, dismissal: "not out", isBatting: true },
              { name: "Josh Hazlewood", runs: 2, balls: 5, fours: 0, sixes: 0, strikeRate: 40, dismissal: "c Pant b Ashwin", isBatting: false },
              { name: "Extras", runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissal: "(b 4, lb 4, w 0, nb 0)", isBatting: false },
            ],
            bowling: [
              { name: "Jasprit Bumrah", overs: "24", maidens: 6, runs: 56, wickets: 3, economy: 2.33, isBowling: false },
              { name: "Mohammed Siraj", overs: "21", maidens: 3, runs: 80, wickets: 2, economy: 3.81, isBowling: false },
              { name: "Ravindra Jadeja", overs: "23", maidens: 5, runs: 62, wickets: 3, economy: 2.70, isBowling: false },
              { name: "R Ashwin", overs: "17", maidens: 2, runs: 57, wickets: 2, economy: 3.35, isBowling: false },
              { name: "Nitish Reddy", overs: "11", maidens: 0, runs: 48, wickets: 0, economy: 4.36, isBowling: false },
              { name: "Harshit Rana", overs: "6", maidens: 0, runs: 34, wickets: 0, economy: 5.67, isBowling: false },
            ],
            fallOfWickets: ["34 (Khawaja)", "100 (McSweeney)", "164 (Smith)", "169 (Labuschagne)", "241 (Carey)", "241 (Cummins)", "282 (Marsh)", "297 (Starc)", "299 (Hazlewood)"],
          },
        ],
      }),
    },
    // Live ODI - IND vs AUS (CT final)
    {
      seriesId: seriesRecords[2].id,
      team1Short: "IND",
      team2Short: "NZ",
      format: "ODI",
      matchNo: "Final",
      status: "live",
      venue: "Dubai International Stadium",
      city: "Dubai",
      startDate: new Date("2025-03-09"),
      result: "",
      scorecard: JSON.stringify({
        note: "Live: India need 35 runs from 38 balls, 6 wickets in hand.",
        innings: [
          {
            teamId: teamByShort["NZ"].id,
            teamShortName: "NZ",
            total: "251/7",
            totalRuns: 251,
            totalWickets: 7,
            totalOvers: "50",
            declared: false,
            batting: [
              { name: "Will Young", runs: 15, balls: 22, fours: 1, sixes: 0, strikeRate: 68.2, dismissal: "c Rahul b Shami", isBatting: false },
              { name: "Rachin Ravindra", runs: 37, balls: 47, fours: 4, sixes: 1, strikeRate: 78.7, dismissal: "c Jaiswal b Kuldeep", isBatting: false },
              { name: "Kane Williamson", runs: 17, balls: 28, fours: 1, sixes: 0, strikeRate: 60.7, dismissal: "lbw b Jadeja", isBatting: false },
              { name: "Daryl Mitchell", runs: 63, balls: 86, fours: 4, sixes: 1, strikeRate: 73.3, dismissal: "c Axar b Shami", isBatting: false },
              { name: "Tom Latham", runs: 42, balls: 52, fours: 3, sixes: 0, strikeRate: 80.8, dismissal: "b Shami", isBatting: false },
              { name: "Glenn Phillips", runs: 34, balls: 30, fours: 2, sixes: 2, strikeRate: 113.3, dismissal: "not out", isBatting: true },
              { name: "Extras", runs: 30, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissal: "(b 8, lb 6, w 12, nb 4)", isBatting: false },
            ],
            bowling: [
              { name: "Mohammed Shami", overs: "10", maidens: 1, runs: 48, wickets: 3, economy: 4.80, isBowling: false },
              { name: "Hardik Pandya", overs: "9", maidens: 0, runs: 52, wickets: 1, economy: 5.78, isBowling: false },
              { name: "Ravindra Jadeja", overs: "10", maidens: 0, runs: 47, wickets: 1, economy: 4.70, isBowling: false },
              { name: "Kuldeep Yadav", overs: "10", maidens: 0, runs: 55, wickets: 1, economy: 5.50, isBowling: false },
              { name: "Varun Chakravarthy", overs: "8", maidens: 0, runs: 36, wickets: 1, economy: 4.50, isBowling: false },
              { name: "Axar Patel", overs: "3", maidens: 0, runs: 13, wickets: 0, economy: 4.33, isBowling: false },
            ],
            fallOfWickets: ["39 (Young)", "69 (Williamson)", "78 (Ravindra)", "155 (Latham)", "196 (Mitchell)", "219 (Santner)"],
          },
          {
            teamId: teamByShort["IND"].id,
            teamShortName: "IND",
            total: "217/4",
            totalRuns: 217,
            totalWickets: 4,
            totalOvers: "42.4",
            declared: false,
            batting: [
              { name: "Shubman Gill", runs: 31, balls: 50, fours: 3, sixes: 0, strikeRate: 62.0, dismissal: "c Williamson b Henry", isBatting: false },
              { name: "Rohit Sharma", runs: 19, balls: 25, fours: 2, sixes: 1, strikeRate: 76.0, dismissal: "c Ravindra b Santner", isBatting: false },
              { name: "Virat Kohli", runs: 48, balls: 60, fours: 4, sixes: 1, strikeRate: 80.0, dismissal: "lbw b Ravindra", isBatting: false },
              { name: "Shreyas Iyer", runs: 22, balls: 30, fours: 1, sixes: 1, strikeRate: 73.3, dismissal: "not out", isBatting: true },
              { name: "KL Rahul", runs: 12, balls: 18, fours: 1, sixes: 0, strikeRate: 66.7, dismissal: "not out", isBatting: true },
              { name: "Hardik Pandya", runs: 45, balls: 32, fours: 3, sixes: 2, strikeRate: 140.6, dismissal: "run out (Phillips)", isBatting: false },
              { name: "Axar Patel", runs: 14, balls: 10, fours: 1, sixes: 1, strikeRate: 140, dismissal: "not out", isBatting: true },
              { name: "Extras", runs: 14, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissal: "(b 6, lb 4, w 4, nb 0)", isBatting: false },
            ],
            bowling: [
              { name: "Matt Henry", overs: "9", maidens: 0, runs: 45, wickets: 1, economy: 5.00, isBowling: false },
              { name: "Kyle Jamieson", overs: "8", maidens: 0, runs: 42, wickets: 0, economy: 5.25, isBowling: false },
              { name: "Mitchell Santner", overs: "10", maidens: 0, runs: 44, wickets: 1, economy: 4.40, isBowling: false },
              { name: "Rachin Ravindra", overs: "8", maidens: 0, runs: 46, wickets: 1, economy: 5.75, isBowling: false },
              { name: "Glenn Phillips", overs: "7.4", maidens: 0, runs: 38, wickets: 1, economy: 4.86, isBowling: true },
              { name: "Michael Bracewell", overs: "0", maidens: 0, runs: 0, wickets: 0, economy: 0, isBowling: false },
            ],
            fallOfWickets: ["58 (Gill)", "72 (Rohit)", "144 (Kohli)", "192 (Hardik)"],
          },
        ],
      }),
    },
    // Upcoming Test - IND vs ENG
    {
      seriesId: seriesRecords[1].id,
      team1Short: "ENG",
      team2Short: "IND",
      format: "Test",
      matchNo: "1st Test",
      status: "upcoming",
      venue: "Headingley",
      city: "Leeds",
      startDate: new Date("2025-06-20"),
      result: "",
      scorecard: "",
    },
    {
      seriesId: seriesRecords[1].id,
      team1Short: "ENG",
      team2Short: "IND",
      format: "Test",
      matchNo: "2nd Test",
      status: "upcoming",
      venue: "Edgbaston",
      city: "Birmingham",
      startDate: new Date("2025-07-02"),
      result: "",
      scorecard: "",
    },
    // Completed T20I
    {
      seriesId: seriesRecords[3].id,
      team1Short: "NZ",
      team2Short: "AUS",
      format: "T20I",
      matchNo: "3rd T20I",
      status: "completed",
      venue: "Eden Park",
      city: "Auckland",
      startDate: new Date("2025-03-12"),
      result: "Australia won by 8 wickets",
      scorecard: JSON.stringify({
        note: "Australia chased 110 in 12.2 overs.",
        innings: [
          {
            teamId: teamByShort["NZ"].id,
            teamShortName: "NZ",
            total: "109",
            totalRuns: 109,
            totalWickets: 10,
            totalOvers: "19.2",
            declared: false,
            batting: [
              { name: "Finn Allen", runs: 28, balls: 18, fours: 2, sixes: 2, strikeRate: 155.6, dismissal: "c Maxwell b Zampa", isBatting: false },
              { name: "Devon Conway", runs: 11, balls: 9, fours: 1, sixes: 0, strikeRate: 122.2, dismissal: "b Hazlewood", isBatting: false },
              { name: "Kane Williamson", runs: 19, balls: 22, fours: 2, sixes: 0, strikeRate: 86.4, dismissal: "lbw b Maxwell", isBatting: false },
              { name: "Glenn Phillips", runs: 22, balls: 14, fours: 1, sixes: 1, strikeRate: 157.1, dismissal: "b Zampa", isBatting: false },
              { name: "Extras", runs: 12, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissal: "(b 4, lb 4, w 4)", isBatting: false },
            ],
            bowling: [
              { name: "Josh Hazlewood", overs: "4", maidens: 1, runs: 22, wickets: 2, economy: 5.50, isBowling: false },
              { name: "Mitchell Starc", overs: "3.2", maidens: 0, runs: 26, wickets: 2, economy: 7.80, isBowling: false },
              { name: "Adam Zampa", overs: "4", maidens: 0, runs: 18, wickets: 3, economy: 4.50, isBowling: false },
              { name: "Glenn Maxwell", overs: "4", maidens: 0, runs: 20, wickets: 1, economy: 5.00, isBowling: false },
            ],
            fallOfWickets: ["24 (Conway)", "41 (Allen)", "62 (Williamson)", "89 (Phillips)"],
          },
          {
            teamId: teamByShort["AUS"].id,
            teamShortName: "AUS",
            total: "110/2",
            totalRuns: 110,
            totalWickets: 2,
            totalOvers: "12.2",
            declared: false,
            batting: [
              { name: "Travis Head", runs: 42, balls: 26, fours: 5, sixes: 2, strikeRate: 161.5, dismissal: "b Santner", isBatting: false },
              { name: "Mitchell Marsh", runs: 38, balls: 22, fours: 4, sixes: 1, strikeRate: 172.7, dismissal: "not out", isBatting: true },
              { name: "Glenn Maxwell", runs: 14, balls: 6, fours: 1, sixes: 1, strikeRate: 233.3, dismissal: "not out", isBatting: true },
              { name: "Extras", runs: 6, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissal: "(b 2, lb 2, w 2)", isBatting: false },
            ],
            bowling: [
              { name: "Trent Boult", overs: "3", maidens: 0, runs: 28, wickets: 0, economy: 9.33, isBowling: false },
              { name: "Tim Southee", overs: "3", maidens: 0, runs: 24, wickets: 0, economy: 8.00, isBowling: false },
              { name: "Mitchell Santner", overs: "3.2", maidens: 0, runs: 24, wickets: 1, economy: 7.20, isBowling: false },
              { name: "Ish Sodhi", overs: "3", maidens: 0, runs: 34, wickets: 1, economy: 11.33, isBowling: false },
            ],
            fallOfWickets: ["62 (Head)"],
          },
        ],
      }),
    },
    // Upcoming SA vs WI
    {
      seriesId: seriesRecords[4].id,
      team1Short: "RSA",
      team2Short: "SL",
      format: "ODI",
      matchNo: "1st ODI",
      status: "upcoming",
      venue: "Kensington Oval",
      city: "Bridgetown",
      startDate: new Date("2025-07-10"),
      result: "",
      scorecard: "",
    },
    // Completed - Pak vs SA Champions Trophy group
    {
      seriesId: seriesRecords[2].id,
      team1Short: "PAK",
      team2Short: "RSA",
      format: "ODI",
      matchNo: "Group A",
      status: "completed",
      venue: "National Stadium",
      city: "Karachi",
      startDate: new Date("2025-02-26"),
      result: "South Africa won by 7 wickets",
      scorecard: JSON.stringify({
        note: "South Africa chased 243 with 8 balls to spare.",
        innings: [
          {
            teamId: teamByShort["PAK"].id,
            teamShortName: "PAK",
            total: "242",
            totalRuns: 242,
            totalWickets: 10,
            totalOvers: "49.1",
            declared: false,
            batting: [
              { name: "Babar Azam", runs: 64, balls: 72, fours: 5, sixes: 1, strikeRate: 88.9, dismissal: "c de Kock b Rabada", isBatting: false },
              { name: "Mohammad Rizwan", runs: 41, balls: 50, fours: 3, sixes: 0, strikeRate: 82.0, dismissal: "c Markram b Maharaj", isBatting: false },
              { name: "Extras", runs: 22, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissal: "(b 8, lb 6, w 8)", isBatting: false },
            ],
            bowling: [
              { name: "Kagiso Rabada", overs: "10", maidens: 1, runs: 38, wickets: 3, economy: 3.80, isBowling: false },
              { name: "Marco Jansen", overs: "9.1", maidens: 0, runs: 48, wickets: 2, economy: 5.23, isBowling: false },
              { name: "Keshav Maharaj", overs: "10", maidens: 0, runs: 42, wickets: 2, economy: 4.20, isBowling: false },
              { name: "Aiden Markram", overs: "10", maidens: 0, runs: 55, wickets: 2, economy: 5.50, isBowling: false },
            ],
            fallOfWickets: ["38 (Rizwan)", "112 (Babar)", "180 (Salman)"],
          },
          {
            teamId: teamByShort["RSA"].id,
            teamShortName: "RSA",
            total: "245/3",
            totalRuns: 245,
            totalWickets: 3,
            totalOvers: "48.4",
            declared: false,
            batting: [
              { name: "Quinton de Kock", runs: 78, balls: 62, fours: 8, sixes: 2, strikeRate: 125.8, dismissal: "b Shaheen", isBatting: false },
              { name: "Aiden Markram", runs: 45, balls: 40, fours: 4, sixes: 1, strikeRate: 112.5, dismissal: "c Rizwan b Hasaranga", isBatting: false },
              { name: "Extras", runs: 18, balls: 0, fours: 0, sixes: 0, strikeRate: 0, dismissal: "(b 6, lb 4, w 8)", isBatting: false },
            ],
            bowling: [
              { name: "Shaheen Afridi", overs: "9", maidens: 0, runs: 58, wickets: 2, economy: 6.44, isBowling: false },
              { name: "Naseem Shah", overs: "9.4", maidens: 0, runs: 62, wickets: 1, economy: 6.34, isBowling: false },
            ],
            fallOfWickets: ["48 (de Kock)", "110 (Markram)"],
          },
        ],
      }),
    },
  ]

  await Promise.all(
    matchesData.map((m) =>
      db.match.create({
        data: {
          series: m.seriesId ? { connect: { id: m.seriesId } } : undefined,
          team1: { connect: { id: teamByShort[m.team1Short].id } },
          team2: { connect: { id: teamByShort[m.team2Short].id } },
          format: m.format,
          matchNo: m.matchNo,
          status: m.status,
          venue: m.venue,
          city: m.city,
          startDate: m.startDate,
          result: m.result,
          scorecard: m.scorecard || "",
        },
      })
    )
  )

  // ===== ARTICLES =====
  const articles = [
    {
      title: "India clinch Champions Trophy with four-wicket win over New Zealand",
      slug: "india-clinch-champions-trophy-final",
      excerpt: "Rohit Sharma's men etched their names into history with a clinical chase to claim their third Champions Trophy title in Dubai.",
      content: `# India clinch Champions Trophy

India were crowned champions of the ICC Champions Trophy 2025 after a composed four-wicket win over New Zealand in the final at the Dubai International Stadium.

Captain **Rohit Sharma** led from the front with a brisk 19, but it was the experienced middle order that steadied the chase after early jolts. **Virat Kohli** anchored with 48 off 60, while **Hardik Pandya** provided the impetus with a scintillating 45 off 32 deliveries, laced with three fours and two sixes.

## New Zealand post 251

Earlier, asked to bat first, New Zealand recovered from a top-order wobble thanks to **Daryl Mitchell's** 63 and **Tom Latham's** 42. **Glenn Phillips** provided the late flourish with an unbeaten 34 off 30 balls, taking the Black Caps to a competitive 251 for 7.

**Mohammed Shami** was the pick of the bowlers, finishing with 3 for 48, while **Varun Chakravarthy** stifled the middle overs with 1 for 36 in his eight.

## The chase

India lost both openers inside the powerplay, but Kohli and Shreyas Iyer rebuilt with a watchful stand. The asking rate crept over seven, before Pandya walked in and swung the momentum decisively.

## What they said

> "This means the world to us. To win an ICC event after such a long time is special," Rohit said at the presentation.

Captain **Kane Williamson** praised New Zealand's fight: "Credit to India, they were the better side on the day, but I'm proud of how we competed throughout the tournament."

## Key numbers

- India's third Champions Trophy title (2002 shared, 2013, 2025)
- Virat Kohli: 48 runs, his 18th fifty in ICC events
- Mohammed Shami: 9 wickets in the tournament at 16.88

The triumph caps a remarkable turnaround for an Indian side that had not won an ICC ODI event since 2013.`,
      imageUrl: "/cricket/hero-trophy.png",
      imageCaption: "India celebrate with the Champions Trophy after their four-wicket win over New Zealand in the final at the Dubai International Stadium. Photo: Getty Images",
      category: "news",
      author: "ESPNcricinfo staff",
      tags: "India,New Zealand,Champions Trophy,Rohit Sharma,Shami",
      featured: true,
      publishedAt: new Date("2025-03-09T20:30:00"),
    },
    {
      title: "Bumrah's brilliance: Anatomy of a fast-bowling masterclass",
      slug: "bumrah-fast-bowling-masterclass-analysis",
      excerpt: "A deep dive into what makes Jasprit Bumrah the most lethal fast bowler in world cricket across all formats.",
      content: `# The Bumrah masterclass

Few fast bowlers in the modern era have commanded the awe that **Jasprit Bumrah** does. His action is unorthodox, his run-up short, yet the carnage he wreaks is remorseless.

## The action

Bumrah's trademark stiff-arm delivery stride generates an extraordinary whip through the crease. His hyperextension at release - the knee bending inward - has been studied by biomechanists for years.

## The yorker

In white-ball cricket, Bumrah's yorker is the gold standard. He lands it on a sixpence under pressure, more often than not swinging it late into the right-hander's base.

> "He is the best in the world at the moment, across formats," said **Pat Cummins** earlier this year.

## Numbers that matter

| Format | Matches | Wickets | Average |
| --- | --- | --- | --- |
| Test | 36 | 159 | 20.0 |
| ODI | 89 | 149 | 23.0 |
| T20I | 78 | 89 | 17.3 |

The India spearhead remains the benchmark by which fast bowling in this era is measured.`,
      imageUrl: "/cricket/bumrah-bowling.png",
      imageCaption: "Jasprit Bumrah in his delivery stride — the premier fast bowler of the era. Photo: AFP via Getty Images",
      category: "analysis",
      author: "Sampath Bandarupadhy",
      tags: "India,Bumrah,analysis,fast bowling",
      featured: true,
      publishedAt: new Date("2025-03-01T09:00:00"),
    },
    {
      title: "Border-Gavaskar Trophy: Five things we learned",
      slug: "border-gavaskar-trophy-five-things-learned",
      excerpt: "Australia reclaimed the Border-Gavaskar Trophy after a thrilling five-Test series. Here are the key takeaways.",
      content: `# Five things we learned from the BGT

Australia reclaimed the Border-Gavaskar Trophy for the first time in a decade with a 3-1 series win over India.

## 1. The new Australia

Under **Pat Cummins**, Australia have built a formidable red-ball unit. **Travis Head's** series-defining 140 at Adelaide was the catalyst.

## 2. India's transitional pains

With an ageing top order and a fledgling middle order, India showed flashes but lacked the consistency of past campaigns.

## 3. Bumrah stood alone

**Jasprit Bumrah** was the standout, taking 22 wickets at 14.0 in three Tests. Without him, the series would have been a rout.

## 4. The next generation

**Yashasvi Jaiswal** and **Nitish Reddy** announced themselves on the biggest stage, suggesting India's future is in safe hands.

## 5. The Border-Gavaskar's place

For sheer theatre, there is nothing in Test cricket quite like an Australia-India series contested over five Tests.`,
      imageUrl: "/cricket/border-gavaskar.png",
      imageCaption: "Travis Head raises his bat after a series-defining century during the Adelaide Test. Photo: Cricket Australia",
      category: "feature",
      author: "Daniel Brettig",
      tags: "Australia,India,Border-Gavaskar,Test cricket",
      featured: true,
      publishedAt: new Date("2025-01-08T11:00:00"),
    },
    {
      title: "Root, Kohli and Williamson: A statistical comparison",
      slug: "root-kohli-williamson-statistical-comparison",
      excerpt: "How do the Fab Four stack up against each other across formats? We crunch the numbers.",
      content: `# The Fab Four: By the numbers

**Joe Root**, **Virat Kohli**, **Kane Williamson** and **Steve Smith** have defined an era of batting. Here is how they compare.

## Test runs

- **Joe Root**: 18,452 at 51.5
- **Virat Kohli**: 9,230 at 49.3
- **Steve Smith**: 9,685 at 56.9
- **Kane Williamson**: 8,745 at 49.2

## White-ball mastery

Kohli's ODI numbers - 13,994 runs at 58.7 with 51 centuries - stand apart as the defining white-ball resume of his generation.

## Verdict

Each great offers something distinct. Root's hunger for runs, Smith's unorthodoxy, Williamson's calm, and Kohli's relentlessness - all four are masters of their craft.`,
      imageUrl: "",
      category: "analysis",
      author: "S Rajesh",
      tags: "Root,Kohli,Williamson,Smith,stats",
      featured: false,
      publishedAt: new Date("2025-02-15T13:00:00"),
    },
    {
      title: "Travis Head: The man for the big occasion",
      slug: "travis-head-man-for-big-occasion",
      excerpt: "From World Cup final centuries to Ashes heroics, Travis Head has made a habit of delivering when it matters most.",
      content: `# Travis Head: The big-match player

There are players who *accumulate*, and players who decide matches. **Travis Head** is emphatically the latter.

## The WTC Final

His 163 at The Oval in the 2023 World Test Championship final set up Australia's triumph over India.

## The ODI World Cup final

A stunning 137 off 120 balls against India in Ahmedabad sealed the 2023 World Cup.

## The Adelaide Test

His 141 against India in the second Test of the 2024-25 Border-Gavaskar Trophy was the innings that turned the series.

![Head raises his bat after a series-defining century during the Adelaide Test. Photo: Cricket Australia](/cricket/border-gavaskar.png)

> "I just love the big moments," Head told ESPNcricinfo. "The bigger the game, the more it sharpens my focus."

<div style="text-align:center;">A defining figure of Australia's golden run.</div>

Head has become Australia's indisposable match-winner.`,
      imageUrl: "/cricket/travis-head.png",
      imageCaption: "Travis Head plays a cover drive on his way to another match-winning innings. Photo: Getty Images",
      category: "feature",
      author: "Tristan Lavalette",
      tags: "Australia,Head,feature,World Cup",
      featured: false,
      publishedAt: new Date("2025-01-05T08:00:00"),
    },
    {
      title: "Rachin Ravindra: The rise of New Zealand's new talisman",
      slug: "rachin-ravindra-new-zealand-talisman",
      excerpt: "Born in Wellington to Indian parents, Rachin Ravindra is fast becoming the heartbeat of New Zealand cricket.",
      content: `# The rise of Rachin Ravindra

**Rachin Ravindra** was the breakout star of the 2023 ODI World Cup, and he has only gone from strength to strength.

## A name to remember

Named after **Rahul Dravid** and **Sachin Tendulkar** - Rachin - the left-hander has lived up to the billing.

## Style

A left-hander with a flowing, wristy technique, Ravindra mixes orthodoxy with white-ball innovation. His left-arm spin provides a handy second string.

## What's next

Still only 25, Ravindra has the all-format game to rival the greats of New Zealand cricket. The 2025 Champions Trophy was another step in his evolution.`,
      imageUrl: "",
      category: "feature",
      author: "Andrew Fidel Fernando",
      tags: "New Zealand,Ravindra,feature",
      featured: false,
      publishedAt: new Date("2025-03-10T10:00:00"),
    },
    {
      title: "Shaheen Afridi: Can he rediscover his lethal best?",
      slug: "shaheen-afridi-rediscover-lethal-best",
      excerpt: "After injuries and a dip in form, Pakistan's spearhead is fighting to get back to the bowler who terrified batters worldwide.",
      content: `# Shaheen Afridi's search for his best

**Shaheen Afridi** burst onto the scene as a once-in-a-generation left-arm quick. Injuries, however, have tested him.

## The 2021-22 peak

A six-wicket haul at the T20 World Cup against India announced Shaheen to the world. His new-ball spell to **Rohit Sharma** and **KL Rahul** became iconic.

## The injury

A knee injury ruled him out for much of 2022, and he has never quite looked the same force since.

## The road back

Pakistan will need their spearhead at his lethal best for the 2025-26 World Test Championship cycle.`,
      imageUrl: "",
      category: "analysis",
      author: "Mohammad Isam",
      tags: "Pakistan,Shaheen,analysis",
      featured: false,
      publishedAt: new Date("2025-02-20T09:00:00"),
    },
    {
      title: "Shakib Al Hasan: A Bangladesh legend's complicated legacy",
      slug: "shakib-al-hasan-bangladesh-legacy",
      excerpt: "Bangladesh's greatest cricketer remains as enigmatic as he is brilliant, even as his international career nears its end.",
      content: `# Shakib's complicated legacy

**Shakib Al Hasan** is, statistically, Bangladesh's greatest cricketer - and one of the finest all-rounders the game has seen.

## The numbers

Nearly 15,000 international runs and almost 700 wickets. Few active players can match the all-round heft of the southpaw from Magura.

## The controversies

And yet, Shakib's career has been punctuated by suspensions, run-ins with the establishment, and a spell away from the game.

## The verdict

When the dust settles, the all-rounder will be remembered as the player who, for two decades, carried Bangladesh cricket on his shoulders.`,
      imageUrl: "",
      category: "feature",
      author: "Mohammad Isam",
      tags: "Bangladesh,Shakib,feature",
      featured: false,
      publishedAt: new Date("2025-01-20T07:00:00"),
    },
    // ===== INTERVIEWS =====
    {
      title: "In conversation with Pat Cummins: leading Australia's golden era",
      slug: "in-conversation-with-pat-cummins",
      excerpt: "The Australia captain on leadership, the World Cup highs, and what drives the most feared pace attack in world cricket.",
      content: `# In conversation with Pat Cummins

We sat down with **Pat Cummins** to talk about captaining Australia, his fast-bowling craft, and the mentality behind a golden era.

## On captaincy

> "I think the biggest thing I've learned is that you don't have to be the loudest voice in the room. Sometimes the best leadership is just setting the standard with the ball in your hand."

Cummins took over the one-day captaincy at a time of transition and has since lifted both the ODI World Cup and the World Test Championship mace.

## On the World Cup final

> "Ahmedabad was the pinnacle. To chase 240 on that wicket, with the whole of India willing us to lose — that's the kind of day you play cricket for."

## On his bowling

He remains the benchmark for accuracy and pace. His economy rate in white-ball cricket is among the best in the game's history.

> "The yorker is my reset button. When the batter is on top, I go back to what I know I can land nine times out of ten."

## What's next

With a home summer and an away tour of England looming, Cummins is focused on keeping the group hungry.

> "The danger isn't losing — it's thinking you've made it."`,
      imageUrl: "/cricket/inline-captain-trophy.png",
      imageCaption: "Pat Cummins lifts the trophy after another triumph. Photo: Getty Images",
      category: "interview",
      author: "ESPNcricinfo staff",
      tags: "Australia,Cummins,interview,captaincy",
      featured: false,
      publishedAt: new Date("2025-02-28T10:00:00"),
    },
    {
      title: "Babar Azam: 'I want to be remembered as Pakistan's greatest batter'",
      slug: "babar-azam-pakistan-greatest-batter-interview",
      excerpt: "Pakistan's batting talisman on chasing greatness, handling expectation, and the weight of a nation's hopes.",
      content: `# Babar Azam: chasing greatness

**Babar Azam** is the batting heartbeat of Pakistan. We spoke to him about his craft, the pressure of carrying a nation, and his ambitions.

## On his technique

> "People talk about elegance, but for me it's about efficiency. Every movement has a purpose. I don't want to waste energy at the crease."

## On the pressure

> "When you walk out in Karachi or Lahore, you're not just playing for yourself. Every person in the stadium has an opinion on your shot selection. You learn to block it out."

## On his goals

Babar's ODI average hovers above 47, with 31 international hundreds. He is blunt about where he wants to end up.

> "I want to be remembered as Pakistan's greatest batter. Not for the averages or the hundreds — for the matches I won."

## On the next generation

> "The young boys coming through — they're fearless. My job is to give them a platform at the top of the order so they can express themselves."`,
      imageUrl: "/cricket/inline-batsman-pull.png",
      imageCaption: "Babar Azam in his trademark fluent stride. Photo: AFP",
      category: "interview",
      author: "ESPNcricinfo staff",
      tags: "Pakistan,Babar Azam,interview",
      featured: false,
      publishedAt: new Date("2025-02-10T09:00:00"),
    },
    {
      title: "Jasprit Bumrah on the art of the yorker and handling pressure",
      slug: "bumrah-yorker-pressure-interview",
      excerpt: "India's pace spearhead on the delivery that defines him, the mindset for the death overs, and learning to trust his body again.",
      content: `# Bumrah on the yorker

**Jasprit Bumrah** is the most feared fast bowler in the world. We caught up with him to dissect his craft.

## The yorker

> "It's the one ball a batter can't score off if you land it. Everyone talks about pace and bounce, but the yorker is the great equaliser."

## Handling the death overs

> "In the last over, I don't think about the batter. I think about the ball I want to bowl and where my field is. The rest is execution."

## The injury comeback

A stress fracture kept him out for much of 2022. He is candid about the mental toll.

> "When you can't bowl, you question everything. But it taught me patience — to respect my body, to come back smarter, not just harder."

## On captaincy and leadership

> "I don't need the armband to lead. When a young quick comes to me for advice, that's leadership."`,
      imageUrl: "/cricket/inline-fast-bowler-roar.png",
      imageCaption: "Bumrah celebrates another wicket. Photo: BCCI",
      category: "interview",
      author: "ESPNcricinfo staff",
      tags: "India,Bumrah,interview,fast bowling",
      featured: false,
      publishedAt: new Date("2025-01-15T08:00:00"),
    },
    {
      title: "Kane Williamson: the calmest man in cricket",
      slug: "kane-williamson-calmest-man-interview",
      excerpt: "New Zealand's former captain on serenity at the crease, the World Cup heartbreak, and why temperament trumps talent.",
      content: `# The calmest man in cricket

**Kane Williamson** has built a career on composure. We spoke about the mindset behind the man.

## On staying calm

> "I think it comes from acceptance. You're going to get out. You're going to have bad days. The trick is not to let one ball cost you two."

## The 2019 World Cup final

> "That day in London — I don't think any of us will ever fully process it. The rules were the rules. We walked off as runners-up, and I was proud of how we carried ourselves."

## On temperament vs talent

> "Talent gets you to the team. Temperament keeps you there. The best batters I've played with aren't always the most gifted — they're the ones who find a way."

## What's next for New Zealand

> "The next generation is ready. My role now is to help them believe they belong at this level."`,
      imageUrl: "/cricket/inline-stadium-crowd.png",
      imageCaption: "Williamson walks out to a packed house. Photo: Getty Images",
      category: "interview",
      author: "ESPNcricinfo staff",
      tags: "New Zealand,Williamson,interview",
      featured: false,
      publishedAt: new Date("2025-01-10T11:00:00"),
    },
  ]

  await Promise.all(
    articles.map((a) => db.article.create({ data: a }))
  )

  // ===== SIDEBAR BLOCKS (admin-managed custom widgets) =====
  await db.sidebarBlock.deleteMany()
  const sidebarBlocks = [
    {
      title: "Follow cricinfo",
      content: "Get live scores, breaking news and analysis in your inbox. **[Subscribe to the newsletter](#)** for the daily cricket briefing.",
      placement: "all",
      order: 10,
      published: true,
    },
    {
      title: "Series spotlight",
      content: "India tour of England 2025 — five Tests across the English summer. [View series](#) · [Schedule](#)",
      placement: "article,match",
      order: 20,
      published: true,
    },
    {
      title: "Top run-scorers",
      content: "**Virat Kohli** leads the all-time run charts — *26,942* international runs at *53.6*. [Full stats](#)",
      placement: "player",
      order: 30,
      published: true,
    },
  ]
  await Promise.all(
    sidebarBlocks.map((b) => db.sidebarBlock.create({ data: b }))
  )

  console.log("✅ Seed complete!")
  const counts = {
    teams: await db.team.count(),
    players: await db.player.count(),
    series: await db.series.count(),
    matches: await db.match.count(),
    articles: await db.article.count(),
    sidebarBlocks: await db.sidebarBlock.count(),
  }
  console.log(counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
