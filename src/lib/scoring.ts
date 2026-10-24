"use client"

import type { Scorecard, Innings, BattingLine, BowlingLine, Match } from "./types"

export interface ScorerBatsman {
  id: string
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  dismissal: string
  isCaptain?: boolean
  isKeeper?: boolean
}

export interface ScorerBowler {
  id: string
  name: string
  balls: number
  runsConceded: number
  wickets: number
  maidens: number
  wides: number
  noballs: number
  dots: number
  foursConceded: number
  sixesConceded: number
  // per-over tracking for maiden detection
  overRuns: number
  overWickets: number
  overBalls: number
}

export interface FallOfWicket {
  wktNo: number
  score: number
  over: string
  batsman: string
}

export interface ScorerInnings {
  battingTeamId: string
  battingTeamShortName: string
  bowlingTeamId: string
  bowlingTeamShortName: string
  runs: number
  wickets: number
  balls: number
  batsmen: ScorerBatsman[]
  bowlers: ScorerBowler[]
  fallOfWickets: FallOfWicket[]
  declared: boolean
  target: number | null
  // extras breakdown
  extrasByes: number
  extrasLegByes: number
  extrasWides: number
  extrasNoBalls: number
  // full squad for 'did not bat'
  squad: { id: string; name: string; isCaptain?: boolean; isKeeper?: boolean }[]
  /** True when the CURRENT ball (i.e. the one about to be bowled) is a free
   *  hit. Set after a no-ball in limited-overs matches (maxOvers > 0); on
   *  the next legal delivery it applies, then resets to false. Wides + no-
   *  balls during a free hit keep it pending. Bowler-credited dismissals
   *  (bowled/caught/lbw/stumped/hit-wkt) are NOT allowed on a free hit —
   *  only run-out and retired-out stand. */
  freeHit: boolean
}

export interface CommentaryEntry {
  id: string
  ballNo: number
  over: string
  text: string
  kind: "run" | "boundary" | "six" | "wicket" | "extra" | "over" | "info" | "dot"
}

export interface LiveMatchState {
  matchId: string
  format: string
  maxOvers: number // 0 = unlimited
  innings: ScorerInnings[]
  currentInnings: number
  strikerId: string | null
  nonStrikerId: string | null
  bowlerId: string | null
  status: string
  result: string
  note: string
  commentary: CommentaryEntry[]
  ballNo: number
}

export type WicketType =
  | "bowled"
  | "caught"
  | "lbw"
  | "runout"
  | "stumped"
  | "hitwkt"
  | "retired"

/** Dismissal types that credit the bowler with a wicket (everything except
 *  run-out and retired-out). Exported so the UI + tests can share. */
export const BOWLER_CREDITED_WICKETS: ReadonlySet<WicketType> = new Set([
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "hitwkt",
])

export type BallEvent =
  | { kind: "run"; runs: number }
  | { kind: "wide" }
  | { kind: "noball" }
  | {
      kind: "wicket"
      wicketType: WicketType
      /** Which batsman got out (must match state.strikerId or state.nonStrikerId). */
      outBatsmanId: string
      /** Fielding players involved in the dismissal (catcher / stumper / run-out
       *  fielder). Empty for bowled/lbw/hit-wkt/retired. UI is responsible for
       *  pre-building the human-readable dismissal string below. */
      fielderIds?: string[]
      /** Pre-built dismissal summary string, e.g. "c Smith b Cummins" or
       *  "run out (Carey)" — stored as-is in `batsmen[].dismissal` and shown
       *  in the public scorecard. */
      dismissal: string
    }
  | { kind: "bye"; runs: number }
  | { kind: "legbye"; runs: number }

const uid = () => Math.random().toString(36).slice(2, 10)

export function maxOversForFormat(format: string): number {
  if (format === "ODI") return 50
  if (format === "T20I" || format === "T20") return 20
  if (format === "T10") return 10
  return 0 // Test = unlimited
}

export function oversString(balls: number): string {
  const o = Math.floor(balls / 6)
  const b = balls % 6
  return b === 0 ? `${o}` : `${o}.${b}`
}

export function initState(match: Match, battingFirstTeamId: string): LiveMatchState {
  const battingTeam =
    match.team1Id === battingFirstTeamId ? match.team1 : match.team2
  const bowlingTeam =
    match.team1Id === battingFirstTeamId ? match.team2 : match.team1
  const innings: ScorerInnings = {
    battingTeamId: battingFirstTeamId,
    battingTeamShortName: battingTeam?.shortName ?? "BAT",
    bowlingTeamId: battingTeam === match.team1 ? match.team2Id : match.team1Id,
    bowlingTeamShortName: bowlingTeam?.shortName ?? "BWL",
    runs: 0,
    wickets: 0,
    balls: 0,
    batsmen: [],
    bowlers: [],
    fallOfWickets: [],
    declared: false,
    target: null,
    extrasByes: 0,
    extrasLegByes: 0,
    extrasWides: 0,
    extrasNoBalls: 0,
    squad: [],
    freeHit: false,
  }
  return {
    matchId: match.id,
    format: match.format,
    maxOvers: maxOversForFormat(match.format),
    innings: [innings],
    currentInnings: 0,
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    status: "live",
    result: "",
    note: "",
    commentary: [
      {
        id: uid(),
        ballNo: 0,
        over: "0.0",
        text: `${battingTeam?.shortName ?? "Batting team"} innings begins`,
        kind: "info",
      },
    ],
    ballNo: 0,
  }
}

export function addBatsman(
  state: LiveMatchState,
  id: string,
  name: string,
  opts?: { isCaptain?: boolean; isKeeper?: boolean }
): LiveMatchState {
  const inn = state.innings[state.currentInnings]
  const batsman: ScorerBatsman = {
    id,
    name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
    dismissal: "",
    isCaptain: opts?.isCaptain,
    isKeeper: opts?.isKeeper,
  }
  const newInnings = [...state.innings]
  // ensure batsman list (dedup by id) and squad list (dedup by id)
  const batsmen = inn.batsmen.some((b) => b.id === id)
    ? inn.batsmen
    : [...inn.batsmen, batsman]
  const squad = inn.squad.some((s) => s.id === id)
    ? inn.squad
    : [
        ...inn.squad,
        { id, name, isCaptain: opts?.isCaptain, isKeeper: opts?.isKeeper },
      ]
  newInnings[state.currentInnings] = { ...inn, batsmen, squad }
  return { ...state, innings: newInnings }
}

/** Pre-populate the squad with the full batting-team roster (so 'Did not bat'
 * works). Players already added as batsmen are skipped to preserve any
 * captain/keeper tags set on the batsman entry. */
export function addSquadMember(
  state: LiveMatchState,
  id: string,
  name: string,
  opts?: { isCaptain?: boolean; isKeeper?: boolean }
): LiveMatchState {
  const inn = state.innings[state.currentInnings]
  if (inn.squad.some((s) => s.id === id)) return state
  const newInnings = [...state.innings]
  newInnings[state.currentInnings] = {
    ...inn,
    squad: [
      ...inn.squad,
      { id, name, isCaptain: opts?.isCaptain, isKeeper: opts?.isKeeper },
    ],
  }
  return { ...state, innings: newInnings }
}

export function setBatsmen(
  state: LiveMatchState,
  strikerId: string,
  nonStrikerId: string
): LiveMatchState {
  return { ...state, strikerId, nonStrikerId }
}

export function setBowler(
  state: LiveMatchState,
  id: string,
  name: string
): LiveMatchState {
  const inn = state.innings[state.currentInnings]
  let bowlers = inn.bowlers
  if (!bowlers.some((b) => b.id === id)) {
    bowlers = [
      ...bowlers,
      {
        id,
        name,
        balls: 0,
        runsConceded: 0,
        wickets: 0,
        maidens: 0,
        wides: 0,
        noballs: 0,
        dots: 0,
        foursConceded: 0,
        sixesConceded: 0,
        overRuns: 0,
        overWickets: 0,
        overBalls: 0,
      },
    ]
  }
  const newInnings = [...state.innings]
  newInnings[state.currentInnings] = { ...inn, bowlers }
  return { ...state, innings: newInnings, bowlerId: id }
}

function swapStrike(state: LiveMatchState): LiveMatchState {
  return {
    ...state,
    strikerId: state.nonStrikerId,
    nonStrikerId: state.strikerId,
  }
}

function pushCommentary(
  state: LiveMatchState,
  text: string,
  kind: CommentaryEntry["kind"],
  over: string
): CommentaryEntry[] {
  const entry: CommentaryEntry = {
    id: uid(),
    ballNo: state.ballNo,
    over,
    text,
    kind,
  }
  return [entry, ...state.commentary].slice(0, 120)
}

export function applyBall(state: LiveMatchState, event: BallEvent): LiveMatchState {
  if (state.status !== "live") return state
  if (!state.strikerId || !state.nonStrikerId || !state.bowlerId) return state

  const inn = state.innings[state.currentInnings]
  const strikerIdx = inn.batsmen.findIndex((b) => b.id === state.strikerId)
  const bowlerIdx = inn.bowlers.findIndex((b) => b.id === state.bowlerId)
  if (strikerIdx < 0 || bowlerIdx < 0) return state

  let batsmen = inn.batsmen.map((b) => ({ ...b }))
  let bowlers = inn.bowlers.map((b) => ({ ...b }))
  let runs = inn.runs
  let wickets = inn.wickets
  let balls = inn.balls
  let extrasByes = inn.extrasByes
  let extrasLegByes = inn.extrasLegByes
  let extrasWides = inn.extrasWides
  let extrasNoBalls = inn.extrasNoBalls
  // Free-hit tracking. `isFreeHit` = the CURRENT ball is a free hit (only
  // applies in limited-overs matches — maxOvers > 0). `freeHit` is the value
  // that will be carried into the NEXT ball's state.
  const limitedOvers = state.maxOvers > 0
  const isFreeHit = limitedOvers && inn.freeHit
  let freeHit = inn.freeHit
  let fallOfWickets = inn.fallOfWickets
  let strikerId = state.strikerId
  let nonStrikerId = state.nonStrikerId
  let bowlerId = state.bowlerId
  let note = state.note
  let commentary = state.commentary

  const striker = batsmen[strikerIdx]
  const bowler = bowlers[bowlerIdx]
  let isLegal = true
  let eventText = ""
  let eventKind: CommentaryEntry["kind"] = "run"

  switch (event.kind) {
    case "run": {
      const r = event.runs
      runs += r
      striker.runs += r
      striker.balls += 1
      bowler.runsConceded += r
      bowler.overRuns += r
      if (r === 0) {
        bowler.dots += 1
        // Don't leave the commentary text blank for a dot ball — show a
        // visible "0 · dot ball" entry so the commentary feed reads
        // ball-by-ball without gaps.
        eventText = "0 · dot ball"
        eventKind = "dot"
      } else if (r === 4) {
        striker.fours += 1
        bowler.foursConceded += 1
        eventText = `FOUR! ${striker.name} ${r}`
        eventKind = "boundary"
      } else if (r === 6) {
        striker.sixes += 1
        bowler.sixesConceded += 1
        eventText = `SIX! ${striker.name} ${r}`
        eventKind = "six"
      } else {
        eventText = `${r} run${r !== 1 ? "s" : ""} — ${striker.name}`
        eventKind = "run"
      }
      if (r % 2 === 1) {
        const tmp = strikerId
        strikerId = nonStrikerId
        nonStrikerId = tmp
      }
      break
    }
    case "wide": {
      runs += 1
      bowler.runsConceded += 1
      bowler.overRuns += 1
      bowler.wides += 1
      extrasWides += 1
      isLegal = false
      eventText = "Wide (+1)"
      eventKind = "extra"
      break
    }
    case "noball": {
      runs += 1
      bowler.runsConceded += 1
      bowler.overRuns += 1
      bowler.noballs += 1
      extrasNoBalls += 1
      isLegal = false
      // Free-hit policy (limited-overs only): a no-ball makes the next
      // LEGAL delivery a free hit. Wides + no-balls that follow keep it
      // pending until a legal ball is bowled. See the post-switch block
      // for the carry-over logic.
      if (limitedOvers) {
        freeHit = true
        eventText = "No ball (+1) — FREE HIT next ball"
      } else {
        eventText = "No ball (+1)"
      }
      eventKind = "extra"
      break
    }
    case "bye":
    case "legbye": {
      const r = event.runs
      runs += r
      striker.balls += 1
      if (r === 0) bowler.dots += 1
      // byes/legbyes: not credited to batsman runs or bowler runs
      if (event.kind === "bye") {
        extrasByes += r
      } else {
        extrasLegByes += r
      }
      eventText = `${event.kind === "bye" ? "Bye" : "Leg bye"} ${r}`
      eventKind = "extra"
      if (r % 2 === 1) {
        const tmp = strikerId
        strikerId = nonStrikerId
        nonStrikerId = tmp
      }
      break
    }
    case "wicket": {
      // Resolve which batsman got out — must be the striker or the
      // non-striker (run-out can happen at the non-striker's end).
      const isStrikerOut = event.outBatsmanId === strikerId
      const isNonStrikerOut =
        event.outBatsmanId === nonStrikerId && event.outBatsmanId !== strikerId
      if (!isStrikerOut && !isNonStrikerOut) {
        // Unknown batsman id — bail out without changing state.
        return state
      }
      const outBatsman = batsmen.find((b) => b.id === event.outBatsmanId)
      if (!outBatsman) return state

      // Free-hit policy (limited-overs only): bowler-credited dismissals
      // (bowled / caught / lbw / stumped / hit-wkt) are NOT allowed on a
      // free hit — only run-out and retired-out stand. The striker still
      // faces the ball, the ball still counts, but the dismissal is void
      // and the batsman survives. Log a commentary line + a "dot"-styled
      // entry so the admin sees the rejection.
      if (
        isFreeHit &&
        BOWLER_CREDITED_WICKETS.has(event.wicketType) &&
        event.wicketType !== "retired"
      ) {
        // The striker faced this delivery — credit the ball.
        if (isStrikerOut) {
          outBatsman.balls += 1
        }
        // Consume the free hit — next ball is normal.
        freeHit = false
        eventText = `FREE HIT! ${outBatsman.name} survives (${event.wicketType} not allowed on free hit)`
        eventKind = "info"
        break
      }

      // Retired-out is a dismissal that doesn't bowl a delivery, so the ball
      // count for the over and the bowler's figures stay untouched.
      if (event.wicketType === "retired") {
        isLegal = false
      }

      outBatsman.out = true
      outBatsman.dismissal = event.dismissal
      // Only the striker has faced this delivery — the non-striker didn't
      // (and on a retired-out, no delivery was bowled at all).
      if (isStrikerOut && event.wicketType !== "retired") {
        outBatsman.balls += 1
      }

      wickets += 1

      // Credit the bowler only for these dismissal types.
      if (BOWLER_CREDITED_WICKETS.has(event.wicketType)) {
        bowler.wickets += 1
        bowler.overWickets += 1
      }

      fallOfWickets = [
        ...fallOfWickets,
        {
          wktNo: wickets,
          score: runs,
          over: oversString(balls),
          batsman: outBatsman.name,
        },
      ]

      // Set the right slot to null so the UI prompts for the replacement at
      // the correct end.
      if (isStrikerOut) {
        strikerId = null
      } else {
        nonStrikerId = null
      }
      eventText = `WICKET! ${outBatsman.name} ${event.dismissal}`
      eventKind = "wicket"
      break
    }
  }

  if (isLegal) {
    balls += 1
    bowler.balls += 1
    bowler.overBalls += 1
    state = { ...state, ballNo: state.ballNo + 1 }
  }

  // Free-hit consumption: a legal delivery (run/bye/legbye, or an allowed
  // non-retired wicket) consumes the free hit — the NEXT ball is normal
  // play. No-balls already set `freeHit = true` above (the next legal ball
  // will be a free hit too). Wides carry the prior status forward (the wide
  // case doesn't touch `freeHit`). Retired-out (no delivery) doesn't consume
  // the free hit either. The wicket-rejection branch already set
  // `freeHit = false` itself; the wicket-allowed branch needs the explicit
  // consume below.
  if (isLegal) {
    if (
      event.kind === "run" ||
      event.kind === "bye" ||
      event.kind === "legbye" ||
      (event.kind === "wicket" && event.wicketType !== "retired")
    ) {
      freeHit = false
    }
  }

  // Over complete?
  const ballsThisOver = balls % 6
  let overComplete = false
  if (isLegal && ballsThisOver === 0 && balls > 0) {
    overComplete = true
    // maiden detection for this bowler's just-finished over
    if (bowler.overRuns === 0 && bowler.overWickets === 0) {
      bowler.maidens += 1
    }
    bowler.overRuns = 0
    bowler.overWickets = 0
    bowler.overBalls = 0
    // end of over: swap ends
    const tmp = strikerId
    strikerId = nonStrikerId
    nonStrikerId = tmp
    bowlerId = null // awaiting new bowler
  }

  const newInnings: ScorerInnings = {
    ...inn,
    runs,
    wickets,
    balls,
    batsmen,
    bowlers,
    fallOfWickets,
    extrasByes,
    extrasLegByes,
    extrasWides,
    extrasNoBalls,
    freeHit,
  }
  const innings = [...state.innings]
  innings[state.currentInnings] = newInnings

  let status = state.status
  let result = state.result
  let target = inn.target
  let next: LiveMatchState = {
    ...state,
    innings,
    strikerId,
    nonStrikerId,
    bowlerId,
    note,
  }

  // Commentary
  const overLabel = oversString(balls)
  commentary = pushCommentary(next, eventText, eventKind, overLabel)
  if (overComplete) {
    commentary = [
      {
        id: uid(),
        ballNo: next.ballNo,
        over: oversString(balls),
        text: `End of over ${Math.floor(balls / 6)} — ${inn.battingTeamShortName} ${runs}/${wickets} (${oversString(balls)})`,
        kind: "over",
      },
      ...commentary,
    ].slice(0, 120)
  }
  next.commentary = commentary

  // Innings end checks
  const allOut = wickets >= 10
  const oversDone = next.maxOvers > 0 && balls >= next.maxOvers * 6
  const targetReached = target !== null && runs >= target

  if (allOut || oversDone || targetReached) {
    next = endInnings(next, allOut ? "all out" : oversDone ? "overs complete" : "target reached")
  }

  return next
}

export function endInnings(state: LiveMatchState, reason: string): LiveMatchState {
  const inn = state.innings[state.currentInnings]
  const inningsCount = state.innings.length
  const innings = [...state.innings]
  // Mark the current innings as ended (and `declared` if the captain declared).
  innings[state.currentInnings] = {
    ...inn,
    declared: reason === "declared" ? true : inn.declared,
  }

  let commentary = state.commentary
  commentary = [
    {
      id: uid(),
      ballNo: state.ballNo,
      over: oversString(inn.balls),
      text: `Innings end — ${inn.battingTeamShortName} ${inn.runs}/${inn.wickets} (${reason})`,
      kind: "info",
    },
    ...commentary,
  ].slice(0, 120)

  // Test matches (maxOvers === 0) play up to 4 innings; limited-overs matches
  // (maxOvers > 0) play 2 innings.
  const isTest = state.maxOvers === 0
  const maxInnings = isTest ? 4 : 2

  // If this was the final innings of the match, compute the result.
  if (inningsCount >= maxInnings) {
    return computeMatchResult(state, innings, commentary)
  }

  // Otherwise, set up the next innings. Swap batting/bowling sides — in a
  // 4-innings Test the same team bats in innings 0 + 2 (and the other in
  // 1 + 3), which is exactly what swapping from the previous innings gives:
  //   innings 0: A bats, B bowls   →  innings 1: B bats, A bowls
  //   innings 1: B bats, A bowls   →  innings 2: A bats, B bowls
  //   innings 2: A bats, B bowls  →  innings 3: B bats, A bowls
  const newInnings: ScorerInnings = {
    battingTeamId: inn.bowlingTeamId,
    battingTeamShortName: inn.bowlingTeamShortName,
    bowlingTeamId: inn.battingTeamId,
    bowlingTeamShortName: inn.battingTeamShortName,
    runs: 0,
    wickets: 0,
    balls: 0,
    batsmen: [],
    bowlers: [],
    fallOfWickets: [],
    declared: false,
    target: null,
    extrasByes: 0,
    extrasLegByes: 0,
    extrasWides: 0,
    extrasNoBalls: 0,
    squad: [],
    freeHit: false,
  }

  // Chase target: only set on the FINAL innings of the match (the team
  // batting last needs to know how many to win).
  //   • Limited-overs (2 innings): innings 1 target = innings[0].runs + 1
  //   • Test (4 innings): innings 3 target =
  //     (innings[0].runs + innings[2].runs) - innings[1].runs + 1
  //     (Team A's two innings totals, minus Team B's first innings, plus 1 to win)
  let targetNote = ""
  if (!isTest && inningsCount === 1) {
    // Limited-overs 2nd innings chase.
    newInnings.target = innings[0].runs + 1
    targetNote = `${inn.battingTeamShortName} set ${newInnings.target} to win. ${inn.bowlingTeamShortName} to chase.`
  } else if (isTest && inningsCount === 3) {
    // Test 4th innings chase.
    // innings[0] = Team A 1st innings
    // innings[1] = Team B 1st innings
    // innings[2] = Team A 2nd innings (just ended — A's total)
    // innings[3] = Team B 2nd innings (about to start — chasing)
    const teamATotal = innings[0].runs + innings[2].runs
    const teamBFirstInnings = innings[1].runs
    const target = teamATotal - teamBFirstInnings + 1
    newInnings.target = target
    targetNote = `${inn.battingTeamShortName} declared at ${inn.runs}/${inn.wickets}. ${inn.bowlingTeamShortName} needs ${target} runs to win.`
  } else {
    targetNote = `${inn.battingTeamShortName} innings ended (${reason}). ${inn.bowlingTeamShortName} to bat next.`
  }

  innings.push(newInnings)
  return {
    ...state,
    innings,
    currentInnings: inningsCount,
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    note: targetNote,
    commentary,
  }
}

/**
 * Compute the final match result from the completed innings.
 *
 * Limited-overs (2 innings): the chasing team won / tied / lost based on
 * whether they reached the target.
 *
 * Test (4 innings): compare Team A's total (innings 0 + 2) vs Team B's total
 * (innings 1 + 3). If the chasing team (B in innings 3) reached the target,
 * they won by wickets. If they were bowled out short, Team A won by runs.
 * If time ran out (innings 3 ended without all-out or target reached), draw.
 */
function computeMatchResult(
  state: LiveMatchState,
  innings: ScorerInnings[],
  commentary: CommentaryEntry[]
): LiveMatchState {
  const isTest = state.maxOvers === 0

  let result = ""
  let note = ""

  if (!isTest) {
    // Limited-overs: innings[1] is the chase.
    const chase = innings[1]
    const target = chase.target ?? 0
    const chaser = chase.battingTeamShortName
    const setter = chase.bowlingTeamShortName
    if (chase.runs >= target) {
      const wktsLeft = 10 - chase.wickets
      result = `${chaser} won by ${wktsLeft} wicket${wktsLeft !== 1 ? "s" : ""}`
    } else if (chase.runs === target - 1) {
      result = "Match tied"
    } else {
      const margin = target - 1 - chase.runs
      result = `${setter} won by ${margin} run${margin !== 1 ? "s" : ""}`
    }
    note = result
  } else {
    // Test: compare Team A (innings 0 + 2) vs Team B (innings 1 + 3).
    const teamA = innings[0].battingTeamShortName
    const teamB = innings[1].battingTeamShortName
    const teamATotal = innings[0].runs + innings[2].runs
    const teamBTotal = innings[1].runs + innings[3].runs
    const chase = innings[3]
    const target = chase.target ?? Infinity
    if (chase.runs >= target) {
      // Team B chased it down — won by wickets.
      const wktsLeft = 10 - chase.wickets
      result = `${teamB} won by ${wktsLeft} wicket${wktsLeft !== 1 ? "s" : ""}`
    } else if (chase.wickets >= 10) {
      // Team B all out short — Team A won by runs (margin = A's total - B's total).
      const margin = teamATotal - teamBTotal
      result = `${teamA} won by ${Math.abs(margin)} run${Math.abs(margin) !== 1 ? "s" : ""}`
    } else {
      // Innings ended (declaration or time) without a result — Test draw.
      result = "Match drawn"
    }
    note = result
  }

  return {
    ...state,
    innings,
    status: "completed",
    result,
    note,
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    commentary: [
      {
        id: uid(),
        ballNo: state.ballNo,
        over: oversString(innings[innings.length - 1].balls),
        text: `Result: ${result}`,
        kind: "info",
      },
      ...commentary,
    ].slice(0, 120),
  }
}

/**
 * Captain declares the current innings closed. Only valid for Test matches
 * (limited-overs matches don't have declarations). Sets `declared: true`
 * on the current innings, then triggers the standard endInnings flow with
 * reason "declared" so the next innings is set up correctly.
 *
 * The declaration can happen at any point — the captain doesn't need to be
 * all out or out of overs. Common reasons: setting a chase target for the
 * opposition, time preservation, etc.
 */
export function declareInnings(state: LiveMatchState): LiveMatchState {
  if (state.maxOvers > 0) {
    // Limited-overs — declarations aren't allowed.
    return state
  }
  // Add a commentary note before calling endInnings so the declaration is
  // visible in the feed.
  const inn = state.innings[state.currentInnings]
  const declaredCommentary = [
    {
      id: uid(),
      ballNo: state.ballNo,
      over: oversString(inn.balls),
      text: `${inn.battingTeamShortName} declared at ${inn.runs}/${inn.wickets}`,
      kind: "info" as const,
    },
    ...state.commentary,
  ].slice(0, 120)
  return endInnings(
    { ...state, commentary: declaredCommentary },
    "declared"
  )
}

/** Convert the live state to the public Scorecard format (read by ScorecardView). */
export function stateToScorecard(state: LiveMatchState): Scorecard {
  const innings: Innings[] = state.innings.map((inn) => {
    const batting: BattingLine[] = inn.batsmen.map((b) => ({
      name: b.name,
      playerId: b.id,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      strikeRate: b.balls > 0 ? Number(((b.runs / b.balls) * 100).toFixed(1)) : 0,
      dismissal: b.out ? b.dismissal : "not out",
      isBatting: !b.out && (b.id === state.strikerId || b.id === state.nonStrikerId),
      isCaptain: b.isCaptain,
      isKeeper: b.isKeeper,
    }))
    // order: striker first, non-striker second, then out batsmen in order
    batting.sort((a, b) => {
      const aLive = a.isBatting ? 0 : 1
      const bLive = b.isBatting ? 0 : 1
      return aLive - bLive
    })
    // add Extras line with breakdown
    const extrasRuns = Math.max(
      0,
      inn.runs - inn.batsmen.reduce((s, b) => s + b.runs, 0)
    )
    batting.push({
      name: "Extras",
      runs: extrasRuns,
      balls: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      dismissal: `(b ${inn.extrasByes || 0}, lb ${inn.extrasLegByes || 0}, w ${inn.extrasWides || 0}, nb ${inn.extrasNoBalls || 0})`,
      isBatting: false,
    })
    const bowling: BowlingLine[] = inn.bowlers.map((b) => ({
      name: b.name,
      playerId: b.id,
      overs: oversString(b.balls),
      maidens: b.maidens,
      runs: b.runsConceded,
      wickets: b.wickets,
      economy: b.balls > 0 ? Number(((b.runsConceded / b.balls) * 6).toFixed(2)) : 0,
      wides: b.wides || 0,
      noballs: b.noballs || 0,
      dots: b.dots || 0,
      foursConceded: b.foursConceded || 0,
      sixesConceded: b.sixesConceded || 0,
      isBowling: b.id === state.bowlerId,
    }))
    return {
      teamId: inn.battingTeamId,
      teamShortName: inn.battingTeamShortName,
      total: `${inn.runs}/${inn.wickets}`,
      totalRuns: inn.runs,
      totalWickets: inn.wickets,
      totalOvers: oversString(inn.balls),
      batting,
      bowling,
      fallOfWickets: inn.fallOfWickets.map(
        (f) => `${f.score}-${f.wktNo} (${f.batsman}, ${f.over} ov)`
      ),
      declared: inn.declared,
      extrasBreakdown: {
        byes: inn.extrasByes || 0,
        legByes: inn.extrasLegByes || 0,
        wides: inn.extrasWides || 0,
        noBalls: inn.extrasNoBalls || 0,
      },
      didNotBat: (inn.squad || []).
        filter((s) => !inn.batsmen.some((b) => b.id === s.id))
        .map((s) => ({ name: s.name, isCaptain: s.isCaptain, isKeeper: s.isKeeper })),
    }
  })
  return {
    innings,
    note: state.note,
    commentary: state.commentary.map((c) => ({
      id: c.id,
      over: c.over,
      text: c.text,
      kind: c.kind,
    })),
  }
}

/** Quick summary line for the live strip, e.g. "IND 217/4 (42.4)". */
export function inningsSummaryLine(inn: ScorerInnings): string {
  return `${inn.battingTeamShortName} ${inn.runs}/${inn.wickets} (${oversString(inn.balls)})`
}
