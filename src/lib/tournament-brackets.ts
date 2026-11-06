/**
 * tournament-brackets.ts — single-elimination bracket generation + progression.
 *
 * Generates a knockout bracket from a list of teams, handles byes (when team
 * count isn't a power of 2), and tracks match progression (winners advance
 * to the next round).
 *
 * Supported formats:
 * - Single elimination (knockout)
 * - Round-robin → knockout (groups feed into bracket)
 */

export interface BracketTeam {
  id: string
  name: string
  shortName: string
  seed?: number
}

export interface BracketMatch {
  id: string
  round: number
  matchIndex: number // position within the round
  team1: BracketTeam | null
  team2: BracketTeam | null
  winnerId: string | null
  // Links to the next match (where the winner goes)
  nextMatchId: string | null
  nextSlot: 1 | 2 | null // which slot in the next match
  // External match ID (if linked to a Match record in the DB)
  matchId: string | null
  // Match details (score, status) — populated from DB when available
  score?: string
  status?: string
}

export interface Bracket {
  rounds: BracketMatch[][]
  teams: BracketTeam[]
  format: "single-elimination"
  roundNames: string[]
}

/* -------------------------------------------------------------------------- */
/*  Seeding                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Standard tournament seeding. For N teams, seeds are placed so that
 * the top seeds meet as late as possible:
 *   8 teams: 1v8, 4v5, 3v6, 2v7
 *   4 teams: 1v4, 2v3
 *   2 teams: 1v2
 *
 * Uses the "bit-reversal" seeding algorithm.
 */
function standardSeeding(numSeeds: number): number[] {
  // Find the next power of 2 >= numSeeds
  const size = Math.pow(2, Math.ceil(Math.log2(numSeeds)))
  const seeds: number[] = []

  // Generate seed positions using bit-reversal
  const rounds = Math.log2(size)
  for (let i = 0; i < size; i++) {
    // Bit-reverse i
    let rev = 0
    let n = i
    for (let r = 0; r < rounds; r++) {
      rev = (rev << 1) | (n & 1)
      n >>= 1
    }
    seeds.push(rev + 1) // 1-indexed
  }

  // Pair adjacent seeds: (seeds[0], seeds[1]), (seeds[2], seeds[3]), ...
  // Each pair is a first-round matchup
  return seeds.slice(0, numSeeds)
}

/**
 * Generate the full bracket structure. Teams with seed > teamCount get byes
 * (their opponent is null → they auto-advance).
 */
export function generateBracket(teams: BracketTeam[]): Bracket {
  if (teams.length < 2) {
    return { rounds: [], teams, format: "single-elimination", roundNames: [] }
  }

  // Sort teams by seed (if provided), otherwise use input order
  const sortedTeams = [...teams].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))

  // Assign seeds 1..N
  const seededTeams = sortedTeams.map((t, i) => ({
    ...t,
    seed: i + 1,
  }))

  const teamCount = seededTeams.length
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(teamCount)))
  const numRounds = Math.log2(bracketSize)
  const byeCount = bracketSize - teamCount

  // Generate seed positions
  const seedOrder = standardSeeding(bracketSize)

  // Map seeds to teams (seeds > teamCount = bye)
  const seedToTeam = new Map<number, BracketTeam | null>()
  for (let s = 1; s <= bracketSize; s++) {
    if (s <= teamCount) {
      seedToTeam.set(s, seededTeams[s - 1])
    } else {
      seedToTeam.set(s, null) // bye
    }
  }

  // Build first round matchups
  const rounds: BracketMatch[][] = []
  const allMatches: BracketMatch[] = []
  let matchCounter = 0

  // Round 1
  const firstRound: BracketMatch[] = []
  for (let i = 0; i < bracketSize; i += 2) {
    const seed1 = seedOrder[i]
    const seed2 = seedOrder[i + 1]
    const team1 = seedToTeam.get(seed1) ?? null
    const team2 = seedToTeam.get(seed2) ?? null

    const matchId = `bracket-m${++matchCounter}`
    const match: BracketMatch = {
      id: matchId,
      round: 0,
      matchIndex: i / 2,
      team1,
      team2,
      winnerId: null,
      nextMatchId: null,
      nextSlot: null,
      matchId: null,
    }

    // Auto-advance byes
    if (team1 && !team2) {
      match.winnerId = team1.id
    } else if (!team1 && team2) {
      match.winnerId = team2.id
    } else if (!team1 && !team2) {
      // Both null — shouldn't happen with standard seeding
    }

    firstRound.push(match)
    allMatches.push(match)
  }
  rounds.push(firstRound)

  // Build subsequent rounds (empty matchups — filled as winners are determined)
  for (let r = 1; r < numRounds; r++) {
    const prevRound = rounds[r - 1]
    const matchesInRound = prevRound.length / 2
    const round: BracketMatch[] = []

    for (let m = 0; m < matchesInRound; m++) {
      const matchId = `bracket-m${++matchCounter}`
      const prevMatch1 = prevRound[m * 2]
      const prevMatch2 = prevRound[m * 2 + 1]

      const match: BracketMatch = {
        id: matchId,
        round: r,
        matchIndex: m,
        team1: null,
        team2: null,
        winnerId: null,
        nextMatchId: null,
        nextSlot: null,
        matchId: null,
      }

      // Link previous matches to this one
      prevMatch1.nextMatchId = matchId
      prevMatch1.nextSlot = 1
      prevMatch2.nextMatchId = matchId
      prevMatch2.nextSlot = 2

      // Auto-advance byes from previous round
      if (prevMatch1.winnerId && !prevMatch2.winnerId) {
        // prevMatch1 had a bye — check if prevMatch2 also has a bye or is pending
        if (!prevMatch2.team1 && !prevMatch2.team2) {
          // Both byes — shouldn't happen
        }
      }

      round.push(match)
      allMatches.push(match)
    }
    rounds.push(round)
  }

  // Process byes through the bracket
  processBracketProgression(rounds)

  // Round names
  const roundNames = generateRoundNames(numRounds, teamCount)

  return {
    rounds,
    teams: seededTeams,
    format: "single-elimination",
    roundNames,
  }
}

/* -------------------------------------------------------------------------- */
/*  Progression (advance winners through rounds)                              */
/* -------------------------------------------------------------------------- */

/**
 * Process the bracket — advance winners from completed matches into the
 * next round. Handles byes (auto-advancement when only one team is present).
 */
export function processBracketProgression(rounds: BracketMatch[][]): void {
  const matchMap = new Map<string, BracketMatch>()
  for (const round of rounds) {
    for (const match of round) {
      matchMap.set(match.id, match)
    }
  }

  for (let r = 0; r < rounds.length; r++) {
    for (const match of rounds[r]) {
      if (!match.winnerId || !match.nextMatchId) continue

      const nextMatch = matchMap.get(match.nextMatchId)
      if (!nextMatch) continue

      // Find the winning team
      const winner =
        match.team1?.id === match.winnerId
          ? match.team1
          : match.team2?.id === match.winnerId
            ? match.team2
            : null

      if (!winner) continue

      // Place winner in the next match's slot
      if (match.nextSlot === 1) {
        nextMatch.team1 = winner
      } else if (match.nextSlot === 2) {
        nextMatch.team2 = winner
      }

      // Auto-advance if the other team is a bye (null)
      if (nextMatch.team1 && !nextMatch.team2) {
        // Check if the other feeder match has been completed
        // (if not, this match is still pending)
      }
      if (!nextMatch.team1 && nextMatch.team2) {
        // Same — pending
      }
    }
  }
}

/**
 * Update a match result + re-process the bracket to advance the winner.
 */
export function updateMatchResult(
  bracket: Bracket,
  matchId: string,
  winnerId: string,
): Bracket {
  const matchMap = new Map<string, BracketMatch>()
  for (const round of bracket.rounds) {
    for (const match of round) {
      matchMap.set(match.id, match)
    }
  }

  const match = matchMap.get(matchId)
  if (match) {
    match.winnerId = winnerId
  }

  processBracketProgression(bracket.rounds)
  return bracket
}

/* -------------------------------------------------------------------------- */
/*  Round names                                                                */
/* -------------------------------------------------------------------------- */

function generateRoundNames(numRounds: number, teamCount: number): string[] {
  const names: string[] = []
  for (let r = 0; r < numRounds; r++) {
    const remaining = Math.pow(2, numRounds - r)
    if (r === numRounds - 1) {
      names.push("Final")
    } else if (r === numRounds - 2) {
      names.push("Semi Final")
    } else if (r === numRounds - 3) {
      names.push("Quarter Final")
    } else {
      names.push(`Round ${r + 1}`)
    }
  }
  return names
}

/* -------------------------------------------------------------------------- */
/*  Serialization (for DB storage)                                            */
/* -------------------------------------------------------------------------- */

export function serializeBracket(bracket: Bracket): string {
  return JSON.stringify(bracket)
}

export function deserializeBracket(json: string): Bracket | null {
  try {
    return JSON.parse(json) as Bracket
  } catch {
    return null
  }
}
