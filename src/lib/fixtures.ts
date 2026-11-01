/**
 * Fixture generation algorithms for tournament scheduling.
 *
 * Supports:
 *   - Single round-robin (each team plays every other once)
 *   - Double round-robin (home + away)
 *   - Group stage + knockout (split into groups, round-robin within each,
 *     then knockout bracket for qualifiers)
 *   - Pure knockout (single elimination with byes)
 *
 * Uses the "circle method" for round-robin — the standard algorithm that
 * produces balanced rounds where each team plays at most once per round.
 */

export interface FixtureTeam {
  id: string
  name: string
}

export interface Fixture {
  team1Id: string
  team2Id: string
  matchNo: number
  /** 0-indexed round number (within the group for group-stage) */
  round: number
  /** Estimated match date (computed from startDate + interval) */
  dateISO: string
  /** Group label for group-stage fixtures (e.g., "Group A"). null otherwise */
  group?: string | null
  /** Knockout round label (e.g., "Final", "Semi-Final"). null for round-robin */
  knockoutRound?: string | null
}

export type ScheduleFormat =
  | "round-robin-single"
  | "round-robin-double"
  | "group-knockout"
  | "knockout"

/* ----------------------- Round-robin (circle method) ---------------------- */

/**
 * Generate a single round-robin fixture list using the circle method.
 * Each team plays every other team exactly once. If the team count is odd,
 * a "bye" is added (the team paired with the bye sits out that round).
 *
 * Returns fixtures grouped by round (each round = array of pairings).
 */
function singleRoundRobinPairings(
  teams: FixtureTeam[]
): FixtureTeam[][] {
  const list = [...teams]
  if (list.length < 2) return []
  // Odd → add a null "bye" team
  if (list.length % 2 !== 0) list.push(null as unknown as FixtureTeam)

  const numRounds = list.length - 1
  const half = list.length / 2
  const rounds: FixtureTeam[][] = []

  for (let r = 0; r < numRounds; r++) {
    const round: FixtureTeam[] = []
    for (let i = 0; i < half; i++) {
      const home = list[i]
      const away = list[list.length - 1 - i]
      if (home && away) {
        // Alternate home/away each round for fairness
        if (r % 2 === 0) {
          round.push(home, away)
        } else {
          round.push(away, home)
        }
      }
    }
    rounds.push(round)
    // Rotate: keep index 0 fixed, move the last element to index 1
    list.splice(1, 0, list.pop()!)
  }
  return rounds
}

/**
 * Convert round-robin pairings (grouped by round) into flat fixtures with
 * dates assigned (one match per `intervalDays`, starting at `startDate`).
 */
function pairingsToFixtures(
  rounds: FixtureTeam[][],
  startDate: Date,
  intervalDays: number,
  group?: string | null
): Fixture[] {
  const fixtures: Fixture[] = []
  let matchNo = 1
  let dayOffset = 0

  for (let r = 0; r < rounds.length; r++) {
    const round = rounds[r]
    for (let i = 0; i < round.length; i += 2) {
      const team1 = round[i]
      const team2 = round[i + 1]
      if (!team1 || !team2) continue
      const date = new Date(startDate)
      date.setDate(date.getDate() + dayOffset)
      fixtures.push({
        team1Id: team1.id,
        team2Id: team2.id,
        matchNo,
        round: r,
        dateISO: date.toISOString(),
        group: group ?? null,
        knockoutRound: null,
      })
      matchNo++
      dayOffset += intervalDays
    }
  }
  return fixtures
}

/* ----------------------------- Public API --------------------------------- */

export function generateRoundRobin(
  teams: FixtureTeam[],
  double: boolean,
  startDate: Date,
  intervalDays: number
): Fixture[] {
  if (teams.length < 2) return []
  const single = singleRoundRobinPairings(teams)
  let fixtures = pairingsToFixtures(single, startDate, intervalDays)

  if (double) {
    // Reverse all pairings (swap home/away) for the second leg
    const reversed = single.map((round) => {
      const swapped: FixtureTeam[] = []
      for (let i = 0; i < round.length; i += 2) {
        swapped.push(round[i + 1], round[i])
      }
      return swapped
    })
    const secondLeg = pairingsToFixtures(
      reversed,
      startDate,
      intervalDays
    )
    // Offset second-leg dates to start after the first leg
    const firstLegEnd = fixtures.length > 0 ? fixtures[fixtures.length - 1].dateISO : startDate.toISOString()
    const offsetMs = new Date(firstLegEnd).getTime() - startDate.getTime() + intervalDays * 86400000
    secondLeg.forEach((f) => {
      f.dateISO = new Date(new Date(f.dateISO).getTime() + offsetMs).toISOString()
    })
    fixtures = [...fixtures, ...secondLeg]
  }
  return fixtures
}

export function generateKnockout(
  teams: FixtureTeam[],
  startDate: Date,
  intervalDays: number
): Fixture[] {
  if (teams.length < 2) return []
  // Pad to next power of 2 with nulls (byes)
  const n = teams.length
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)))
  const padded: (FixtureTeam | null)[] = [...teams]
  while (padded.length < nextPow2) padded.push(null)

  const fixtures: Fixture[] = []
  let matchNo = 1
  let dayOffset = 0

  // Generate all rounds of the bracket
  const roundNames = getKnockoutRoundNames(nextPow2)
  let currentRound = padded
  let roundIdx = 0

  while (currentRound.length > 1) {
    const nextRound: (FixtureTeam | null)[] = []
    for (let i = 0; i < currentRound.length; i += 2) {
      const t1 = currentRound[i]
      const t2 = currentRound[i + 1]
      if (t1 && t2) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + dayOffset)
        fixtures.push({
          team1Id: t1.id,
          team2Id: t2.id,
          matchNo,
          round: roundIdx,
          dateISO: date.toISOString(),
          group: null,
          knockoutRound: roundNames[roundIdx] ?? `Round ${roundIdx + 1}`,
        })
        matchNo++
        dayOffset += intervalDays
        // Winner TBD — placeholder for next round
        nextRound.push(null)
      } else if (t1 && !t2) {
        // Bye — team advances automatically
        nextRound.push(t1)
      } else if (t2 && !t1) {
        nextRound.push(t2)
      } else {
        nextRound.push(null)
      }
    }
    currentRound = nextRound
    roundIdx++
  }
  return fixtures
}

export function generateGroupKnockout(
  teams: FixtureTeam[],
  groupCount: number,
  qualifiersPerGroup: number,
  startDate: Date,
  intervalDays: number
): Fixture[] {
  if (teams.length < 2 || groupCount < 1) return []

  // Distribute teams into groups (snake/seeded distribution for balance)
  const groups: FixtureTeam[][] = Array.from({ length: groupCount }, () => [])
  const shuffled = [...teams]
  // Simple round-robin distribution into groups
  for (let i = 0; i < shuffled.length; i++) {
    const groupIdx = i % groupCount
    groups[groupIdx].push(shuffled[i])
  }

  const groupNames = ["A", "B", "C", "D", "E", "F", "G", "H"]
  const fixtures: Fixture[] = []
  let matchNo = 1
  let dayOffset = 0

  // Round-robin within each group
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]
    if (group.length < 2) continue
    const pairings = singleRoundRobinPairings(group)
    for (let r = 0; r < pairings.length; r++) {
      const round = pairings[r]
      for (let i = 0; i < round.length; i += 2) {
        const t1 = round[i]
        const t2 = round[i + 1]
        if (!t1 || !t2) continue
        const date = new Date(startDate)
        date.setDate(date.getDate() + dayOffset)
        fixtures.push({
          team1Id: t1.id,
          team2Id: t2.id,
          matchNo,
          round: r,
          dateISO: date.toISOString(),
          group: `Group ${groupNames[g] ?? g + 1}`,
          knockoutRound: null,
        })
        matchNo++
        dayOffset += intervalDays
      }
    }
  }

  // Knockout stage — placeholder matches for qualifiers
  const totalQualifiers = groupCount * qualifiersPerGroup
  if (totalQualifiers >= 2) {
    const koStartDate = new Date(startDate)
    // Offset knockout to start after group stage
    koStartDate.setDate(koStartDate.getDate() + dayOffset)
    const roundNames = getKnockoutRoundNames(
      Math.pow(2, Math.ceil(Math.log2(totalQualifiers)))
    )
    // Generate placeholder knockout matches (TBD vs TBD)
    let koRound = totalQualifiers
    let koRoundIdx = 0
    while (koRound > 1) {
      const matchesInRound = koRound / 2
      for (let m = 0; m < matchesInRound; m++) {
        const date = new Date(koStartDate)
        date.setDate(date.getDate() + dayOffset)
        fixtures.push({
          team1Id: "TBD",
          team2Id: "TBD",
          matchNo,
          round: koRoundIdx,
          dateISO: date.toISOString(),
          group: null,
          knockoutRound: roundNames[koRoundIdx] ?? `Knockout Round ${koRoundIdx + 1}`,
        })
        matchNo++
        dayOffset += intervalDays
      }
      koRound = Math.floor(koRound / 2)
      koRoundIdx++
    }
  }

  return fixtures
}

/** Get human-readable round names for a knockout bracket (e.g., Final,
 *  Semi-Final, Quarter-Final, ...) indexed from the FINAL backwards. */
function getKnockoutRoundNames(teamCount: number): string[] {
  const names: string[] = []
  let n = teamCount
  let round = 1
  while (n > 1) {
    const matchesInRound = n / 2
    let name: string
    if (matchesInRound === 1) name = "Final"
    else if (matchesInRound === 2) name = "Semi-Final"
    else if (matchesInRound === 4) name = "Quarter-Final"
    else name = `Round of ${matchesInRound * 2}`
    // Index from the final (last round) backwards — so the first round
    // (largest) is at index 0.
    names.unshift(name)
    n = n / 2
    round++
  }
  return names
}
