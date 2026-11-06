/**
 * dls.ts — Duckworth-Lewis-Stern (DLS) method for rain-affected matches.
 *
 * Recalculates target scores when play is interrupted (rain, bad light, etc.).
 * Uses the Standard Edition resource table (publicly available, accurate for
 * amateur/club cricket). The Professional Edition is ICC-licensed.
 *
 * The DLS method works by comparing the "resources" available to each team.
 * Resources = function of (overs remaining, wickets lost). When rain reduces
 * Team 2's overs, their resources decrease, so their target is adjusted down.
 */

/** G50 — the average score in 50 overs. Used when Team 2 has MORE resources
 *  than Team 1 (rare — happens when Team 1 was bowled out early). */
const DEFAULT_G50 = 245

/** Standard Edition DLS resource table.
 *  Rows = overs remaining (0-50, in 5-over increments)
 *  Cols = wickets lost (0-9, 10 wickets = 0% resources)
 *  Values = percentage of total resources remaining. */
const RESOURCE_TABLE: number[][] = [
  // 0wk   1wk   2wk   3wk   4wk   5wk   6wk   7wk   8wk   9wk
  [100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9,  4.7], // 50 overs
  [ 95.0, 88.8, 81.0, 71.4, 59.8, 46.8, 33.4, 21.1, 11.4,  4.5], // 45
  [ 89.3, 83.4, 76.0, 67.0, 56.1, 43.8, 31.2, 19.7, 10.6,  4.2], // 40
  [ 82.7, 77.1, 70.2, 61.8, 51.8, 40.4, 28.7, 18.1,  9.8,  3.9], // 35
  [ 75.1, 69.8, 63.4, 55.8, 46.7, 36.4, 25.8, 16.3,  8.8,  3.5], // 30
  [ 66.5, 61.5, 55.7, 49.0, 41.1, 32.1, 22.8, 14.4,  7.8,  3.1], // 25
  [ 56.6, 52.0, 47.0, 41.5, 35.0, 27.4, 19.5, 12.3,  6.7,  2.7], // 20
  [ 45.0, 41.0, 37.0, 32.7, 27.5, 21.6, 15.4,  9.7,  5.3,  2.1], // 15
  [ 32.0, 29.0, 26.0, 23.0, 19.0, 15.0, 10.7,  6.7,  3.6,  1.5], // 10
  [ 17.5, 16.0, 14.0, 12.0, 10.0,  7.8,  5.5,  3.5,  1.8,  0.8], // 5
  [  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0], // 0
]

const OVERS_TABLE = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0]

/** Look up the resource percentage for a given overs remaining + wickets lost.
 *  Uses bilinear interpolation for non-standard over values (e.g., 42.3 overs). */
function getResourcePercentage(oversRemaining: number, wicketsLost: number): number {
  // Clamp inputs
  const overs = Math.max(0, Math.min(50, oversRemaining))
  const wickets = Math.max(0, Math.min(10, wicketsLost))

  // 10 wickets = 0% resources
  if (wickets >= 10) return 0
  // 0 overs = 0% resources
  if (overs <= 0) return 0

  // Find the bracket in the overs table
  let lowerIdx = 0
  for (let i = 0; i < OVERS_TABLE.length - 1; i++) {
    if (overs <= OVERS_TABLE[i] && overs >= OVERS_TABLE[i + 1]) {
      lowerIdx = i
      break
    }
  }

  const upperOvers = OVERS_TABLE[lowerIdx]
  const lowerOvers = OVERS_TABLE[lowerIdx + 1]
  const upperVal = RESOURCE_TABLE[lowerIdx][wickets]
  const lowerVal = RESOURCE_TABLE[lowerIdx + 1][wickets]

  // Linear interpolation between the two over brackets
  if (upperOvers === lowerOvers) return upperVal
  const fraction = (overs - lowerOvers) / (upperOvers - lowerOvers)
  const result = lowerVal + fraction * (upperVal - lowerVal)

  return Math.round(result * 10) / 10 // round to 1 decimal
}

/** DLS calculation result. */
export interface DLSResult {
  revisedTarget: number
  originalTarget: number
  team1Resources: number
  team2Resources: number
  resourcesLost: number
  requiredRunRate: number
  parScore: number
  method: string
  g50: number
}

/**
 * Calculate the DLS revised target for Team 2.
 *
 * @param team1Runs       Team 1's total score (completed innings)
 * @param team1Overs      Overs Team 1 faced (e.g., 50 for full ODI, 20 for T20)
 * @param team1Wickets     Wickets Team 1 lost (10 = all out)
 * @param team2Runs       Team 2's current score (0 if hasn't started)
 * @param team2OversFaced Overs Team 2 has faced so far
 * @param team2Wickets    Wickets Team 2 has lost so far
 * @param totalOvers      Total overs per innings (e.g., 50 for ODI, 20 for T20)
 * @param revisedOvers    Overs Team 2 will have AFTER the interruption (reduced)
 * @param g50             Average score in 50 overs (default 245)
 */
export function calculateDLS(
  team1Runs: number,
  team1Overs: number,
  team1Wickets: number,
  team2Runs: number,
  team2OversFaced: number,
  team2Wickets: number,
  totalOvers: number,
  revisedOvers: number,
  g50: number = DEFAULT_G50,
): DLSResult {
  // Team 1's resources
  const team1OversRemaining = totalOvers - team1Overs
  const team1Resources = 100 - getResourcePercentage(team1OversRemaining, team1Wickets)

  // Team 2's resources BEFORE interruption (what they already had)
  const team2OversBeforeInterruption = totalOvers - team2OversFaced
  const team2ResourcesBefore = getResourcePercentage(team2OversBeforeInterruption, team2Wickets)

  // Team 2's resources AFTER interruption (what they'll have remaining)
  const team2OversAfterInterruption = revisedOvers - team2OversFaced
  const team2ResourcesAfter = getResourcePercentage(team2OversAfterInterruption, team2Wickets)

  // Total Team 2 resources = resources used before + resources remaining after
  const team2Resources = (100 - team2ResourcesBefore) + team2ResourcesAfter

  // Resources lost due to interruption
  const resourcesLost = team2ResourcesBefore - team2ResourcesAfter

  const originalTarget = team1Runs + 1

  let revisedTarget: number

  if (team2Resources < team1Resources) {
    // Team 2 has FEWER resources → target reduced proportionally
    revisedTarget = Math.round((team1Runs * team2Resources) / team1Resources) + 1
  } else if (team2Resources > team1Resources) {
    // Team 2 has MORE resources → target increased (rare, happens when
    // Team 1 was bowled out early)
    revisedTarget = Math.round(team1Runs + ((team2Resources - team1Resources) * g50) / 100) + 1
  } else {
    // Equal resources → same target
    revisedTarget = originalTarget
  }

  // Par score at current position (the score Team 2 needs to be "level")
  const parScore = Math.round((team1Runs * (100 - team2ResourcesBefore)) / team1Resources) - 1

  // Required run rate (runs per over — runs needed / overs remaining)
  const oversRemaining = revisedOvers - team2OversFaced
  const runsNeeded = revisedTarget - team2Runs
  const requiredRunRate = oversRemaining > 0 ? runsNeeded / oversRemaining : 0

  return {
    revisedTarget,
    originalTarget,
    team1Resources: Math.round(team1Resources * 10) / 10,
    team2Resources: Math.round(team2Resources * 10) / 10,
    resourcesLost: Math.round(resourcesLost * 10) / 10,
    requiredRunRate: Math.round(requiredRunRate * 100) / 100,
    parScore: Math.max(0, parScore),
    method: "DLS Standard Edition (S Edition)",
    g50,
  }
}
