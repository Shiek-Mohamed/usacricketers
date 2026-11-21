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
  /** True when this batter retired hurt and is AVAILABLE TO RETURN to the
   *  crease (not out, not currently batting). Set when a `retiredHurt`
   *  wicket event is processed; cleared when the batter is brought back in
   *  via the UI's bringInBatsman flow. The batter's `out` flag stays false
   *  throughout — retired-hurt is NOT a dismissal. */
  retiredHurt?: boolean
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
  /** Completed partnerships — recorded when a wicket falls. Each entry
   *  has the wicket number, runs scored, balls faced, and both batsmen's
   *  names. The opening partnership is wicket 1. */
  partnerships: {
    wicket: number
    runs: number
    balls: number
    batsman1: string
    batsman2: string
  }[]
  /** Runs on the board when the current partnership started. Used to
   *  compute the partnership runs when the next wicket falls. */
  partnershipStartRuns: number
  /** Balls bowled when the current partnership started. */
  partnershipStartBalls: number
  /** True if this innings was played as a follow-on (Team B bats again
   *  immediately after their 1st innings in a Test match, because Team A
   *  enforced the follow-on with a 200+ run lead). */
  followOn: boolean
  /** True if this innings is a super-over (1-over tiebreaker). */
  isSuperOver: boolean
}

export interface CommentaryEntry {
  id: string
  ballNo: number
  over: string
  text: string
  kind:
    | "run"
    | "boundary"
    | "six"
    | "wicket"
    | "extra"
    | "over"
    | "info"
    | "dot"
    | "manual"
    | "milestone"
    | "ai"
  /** Who scored this ball — the scorer's ID from their session token.
   *  Closes scoring data gap #10 (scorer identity per ball). */
  scorerId?: string
  /** When this ball was scored — ISO timestamp.
   *  Closes scoring data gap #11 (timestamp per ball). */
  timestamp?: string
  /** TTS audio URL for AI-generated commentary entries. Set when the
   *  /api/ai-commentary route successfully synthesizes speech for the prose;
   *  null/undefined means text-only (TTS unavailable or disabled). Renders
   *  an inline audio player below the prose on the public match feed. */
  audioUrl?: string
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
  // DLS — set when the scorer applies a DLS target after a rain interruption
  dlsTarget?: number | null
  dlsRevisedOvers?: number | null
  /** The scorer's ID — set when scoring starts. Propagated to every
   *  commentary entry via pushCommentary. Closes scoring data gap #10. */
  scorerId?: string | null
}

export type WicketType =
  | "bowled"
  | "caught"
  | "lbw"
  | "runout"
  | "stumped"
  | "hitwkt"
  | "retiredHurt"
  | "retiredOut"

/** Dismissal types that credit the bowler with a wicket (everything except
 *  run-out, retired-hurt, and retired-out). Exported so the UI + tests
 *  share the same source of truth for "does this dismissal credit the
 *  bowler?" */
export const BOWLER_CREDITED_WICKETS: ReadonlySet<WicketType> = new Set([
  "bowled",
  "caught",
  "lbw",
  "stumped",
  "hitwkt",
])

/** Dismissal types that DON'T count as a wicket for the team's tally or
 *  the batsman's dismissal — retired hurt means the batsman left the
 *  field injured and may return. They're not out. */
export const NOT_OUT_DISMISSALS: ReadonlySet<WicketType> = new Set([
  "retiredHurt",
])

export type BallEvent =
  | { kind: "run"; runs: number }
  | { kind: "wide" }
  | {
      kind: "noball"
      /** Runs scored off the bat on the no-ball (e.g. a four hit off a
       *  no-ball = 4). Default 0 — the common case is just the +1 penalty.
       *  Runs off the bat DO count against the bowler and DO count as a
       *  ball faced by the striker. */
      runsOffBat?: number
      /** Byes scored off the no-ball (rare). Added to innings total +
       *  extras breakdown, but NOT against the bowler and NOT a ball
       *  faced. Default 0. */
      byes?: number
      /** Leg-byes scored off the no-ball (rare). Same accounting as byes. */
      legByes?: number
    }
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
  if (format === "T25") return 25
  if (format === "T30") return 30
  if (format === "T35") return 35
  // Custom formats: parse "T8" → 8, "T15" → 15, "T40" → 40, etc.
  const customMatch = format.match(/^T(\d+)$/i)
  if (customMatch) return parseInt(customMatch[1], 10)
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
    partnerships: [],
    partnershipStartRuns: 0,
    partnershipStartBalls: 0,
    followOn: false,
    isSuperOver: false,
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
  over: string,
): CommentaryEntry[] {
  const entry: CommentaryEntry = {
    id: uid(),
    ballNo: state.ballNo,
    over,
    text,
    kind,
    scorerId: state.scorerId ?? undefined,
    timestamp: new Date().toISOString(),
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
  // Partnership tracking — start runs/balls for the current partnership.
  let partnerships = inn.partnerships ?? []
  let partnershipStartRuns = inn.partnershipStartRuns ?? 0
  let partnershipStartBalls = inn.partnershipStartBalls ?? 0
  // Free-hit tracking. `isFreeHit` = the CURRENT ball is a free hit (only
  // applies in limited-overs matches — maxOvers > 0). `freeHit` is the value
  // that will be carried into the NEXT ball's state.
  const limitedOvers = state.maxOvers > 0
  const isFreeHit = limitedOvers && inn.freeHit
  let freeHit = inn.freeHit
  let fallOfWickets = inn.fallOfWickets
  // Annotated as `string | null` because the early-return guard above
  // narrows state.strikerId / nonStrikerId / bowlerId to `string`, but the
  // wicket / retired-hurt / over-end branches below reassign them to `null`
  // (to clear the slot for a replacement). Without the explicit annotation
  // TS infers `string` from the narrowed source and the null reassignments
  // fail strictNullChecks.
  let strikerId: string | null = state.strikerId
  let nonStrikerId: string | null = state.nonStrikerId
  let bowlerId: string | null = state.bowlerId
  let note = state.note
  let commentary = state.commentary

  const striker = batsmen[strikerIdx]
  const bowler = bowlers[bowlerIdx]
  // Capture the striker's runs BEFORE this ball is processed so we can
  // detect strike-rate milestone crossings (50 / 100 / 150) after the
  // switch mutates `striker.runs`. Only the striker who faces the delivery
  // can cross a threshold — byes / leg-byes / wides don't add bat runs, and
  // a wicket doesn't increase the striker's tally.
  const strikerRunsBefore = striker.runs
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
      // Cricket accounting for a no-ball:
      //   • +1 no-ball penalty → extras (no-balls), against the bowler, and
      //     breaks a maiden. Counts towards the innings total.
      //   • runsOffBat (e.g. a four hit off a no-ball) → striker's runs +
      //     balls faced + fours/sixes; ALSO against the bowler (runs off the
      //     bat on a no-ball DO count against the bowler).
      //   • byes / legByes (rare on a no-ball) → innings total + extras
      //     breakdown, but NOT against the bowler and NOT a ball faced
      //     (matches the existing bye/legbye convention).
      //   • A no-ball counts as a ball faced by the striker.
      //   • Strike rotates only if (runsOffBat + byes + legByes) is odd —
      //     the +1 penalty itself doesn't rotate the strike.
      //   • A no-ball is NOT one of the six legal balls in the over
      //     (isLegal = false) — it's re-bowled.
      //   • Limited-overs: the next LEGAL delivery is a free hit.
      const runsOffBat = event.runsOffBat ?? 0
      const byes = event.byes ?? 0
      const legByes = event.legByes ?? 0
      // +1 no-ball penalty
      runs += 1
      bowler.runsConceded += 1
      bowler.overRuns += 1
      bowler.noballs += 1
      extrasNoBalls += 1
      // Runs off the bat → striker + bowler (counts as a ball faced below)
      if (runsOffBat > 0) {
        runs += runsOffBat
        striker.runs += runsOffBat
        bowler.runsConceded += runsOffBat
        bowler.overRuns += runsOffBat
        if (runsOffBat === 4) {
          striker.fours += 1
          bowler.foursConceded += 1
        } else if (runsOffBat === 6) {
          striker.sixes += 1
          bowler.sixesConceded += 1
        }
      }
      // A no-ball counts as a ball faced by the striker.
      striker.balls += 1
      // Byes / leg-byes → innings + extras, NOT striker, NOT bowler.
      if (byes > 0) {
        runs += byes
        extrasByes += byes
      }
      if (legByes > 0) {
        runs += legByes
        extrasLegByes += legByes
      }
      isLegal = false
      // Free-hit policy (limited-overs only): a no-ball makes the next
      // LEGAL delivery a free hit. Wides + no-balls that follow keep it
      // pending until a legal ball is bowled. See the post-switch block
      // for the carry-over logic.
      if (limitedOvers) {
        freeHit = true
      }
      // Build the commentary text — show the breakdown so the feed reads
      // correctly even when runs were scored off the no-ball.
      const parts: string[] = ["No ball (+1)"]
      if (runsOffBat === 4) {
        parts.push(`FOUR! ${striker.name} ${runsOffBat}`)
      } else if (runsOffBat === 6) {
        parts.push(`SIX! ${striker.name} ${runsOffBat}`)
      } else if (runsOffBat > 0) {
        parts.push(`${runsOffBat} run${runsOffBat !== 1 ? "s" : ""} — ${striker.name}`)
      }
      if (byes > 0) parts.push(`+${byes} bye${byes !== 1 ? "s" : ""}`)
      if (legByes > 0) parts.push(`+${legByes} leg bye${legByes !== 1 ? "s" : ""}`)
      if (limitedOvers) parts.push("FREE HIT next ball")
      eventText = parts.join(" ")
      if (runsOffBat === 4) {
        eventKind = "boundary"
      } else if (runsOffBat === 6) {
        eventKind = "six"
      } else {
        eventKind = "extra"
      }
      // Strike rotation — swap if (runsOffBat + byes + legByes) is odd.
      // The +1 penalty itself doesn't rotate the strike.
      if ((runsOffBat + byes + legByes) % 2 === 1) {
        const tmp = strikerId
        strikerId = nonStrikerId
        nonStrikerId = tmp
      }
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
      // free hit — only run-out, retired-hurt, and retired-out stand.
      // The striker still faces the ball, the ball still counts, but the
      // dismissal is void and the batsman survives. Log a commentary line
      // + an "info"-styled entry so the admin sees the rejection.
      if (
        isFreeHit &&
        BOWLER_CREDITED_WICKETS.has(event.wicketType)
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

      // Retired-hurt: NOT a dismissal. The batsman left the field injured
      // and may return. Doesn't bowl a delivery, doesn't count as a wicket,
      // doesn't credit the bowler, doesn't add to fall-of-wickets. The
      // batsman's `out` flag stays false. Only the slot is cleared so a
      // replacement batsman can come in (the original can return later
      // via the standard bringInBatsman flow). The `retiredHurt` flag on
      // the batsman entry marks them as AVAILABLE TO RETURN — the UI uses
      // it to include them in the new-batsman picker (batters already in
      // inn.batsmen are normally excluded, but retired-hurt ones are
      // re-selectable until they return).
      if (event.wicketType === "retiredHurt") {
        isLegal = false  // no delivery was bowled
        outBatsman.dismissal = event.dismissal  // "retired hurt" — stored but `out` stays false
        outBatsman.retiredHurt = true  // available to return via bringInBatsman
        // Clear the slot so the picker re-shows for the replacement batsman.
        if (isStrikerOut) {
          strikerId = null
        } else {
          nonStrikerId = null
        }
        eventText = `RETIRED HURT — ${outBatsman.name} left the field (may return)`
        eventKind = "info"
        break
      }

      // Retired-out: a dismissal that doesn't bowl a delivery, so the
      // ball count for the over and the bowler's figures stay untouched.
      // Unlike retired-hurt, this counts as a wicket — the batsman is
      // permanently out and cannot return.
      if (event.wicketType === "retiredOut") {
        isLegal = false
      }

      outBatsman.out = true
      outBatsman.dismissal = event.dismissal
      // Ball-faced credit on a wicket delivery:
      //   • retired-out: no delivery was bowled → no ball faced by anyone.
      //   • striker dismissed (bowled/caught/lbw/runout/stumped/hit-wkt):
      //     the striker faced this ball → outBatsman.balls += 1.
      //   • NON-striker run out: the STRIKER still faced this delivery, so
      //     the striker's balls-faced must be incremented (not the
      //     non-striker's). Previously this branch only credited
      //     outBatsman when isStrikerOut, which left the striker's balls
      //     frozen on a non-striker run-out and distorted strike rates.
      if (event.wicketType !== "retiredOut") {
        if (isStrikerOut) {
          outBatsman.balls += 1
        } else if (isNonStrikerOut) {
          // The striker (not the dismissed non-striker) faced this ball.
          striker.balls += 1
        }
      }

      wickets += 1

      // Credit the bowler only for these dismissal types (not retired-out
      // or retired-hurt — but retired-hurt already broke above).
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

      // Record the completed partnership (runs + balls since the last
      // wicket / innings start). The other batsman is the one NOT out.
      const otherBatsman = batsmen.find(
        (b) => b.id === (isStrikerOut ? nonStrikerId : strikerId)
      )
      partnerships = [
        ...partnerships,
        {
          wicket: wickets,
          runs: runs - partnershipStartRuns,
          balls: balls - partnershipStartBalls,
          batsman1: outBatsman.name,
          batsman2: otherBatsman?.name ?? "?",
        },
      ]
      // Reset the start for the next partnership.
      partnershipStartRuns = runs
      partnershipStartBalls = balls

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
      (event.kind === "wicket" &&
        event.wicketType !== "retiredOut" &&
        event.wicketType !== "retiredHurt")
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
    partnerships,
    partnershipStartRuns,
    partnershipStartBalls,
    followOn: inn.followOn ?? false,
    isSuperOver: inn.isSuperOver ?? false,
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
        kind: "over" as const,
      },
      ...commentary,
    ].slice(0, 120)
  }
  next.commentary = commentary

  // Strike-rate milestone detection (50 / 100 / 150). Fires ONLY on the
  // crossing ball — the striker's runs went from below the threshold to >=
  // it on this delivery. The milestone entry is prepended to the commentary
  // so it surfaces as the newest (most prominent) entry. Only the highest
  // crossed threshold fires per ball (a 49→101 boundary triggers HUNDRED,
  // not FIFTY). The trophy emoji in the text + the `milestone` kind lets
  // the commentary feed render a distinct gold/trophy treatment.
  {
    const strikerAfter = batsmen[strikerIdx]
    if (strikerAfter) {
      const rAfter = strikerAfter.runs
      for (const threshold of [150, 100, 50] as const) {
        if (strikerRunsBefore < threshold && rAfter >= threshold) {
          const milestoneText =
            threshold >= 150
              ? `🏆 ${strikerAfter.name} reaches 150!`
              : threshold >= 100
                ? `🏆 ${strikerAfter.name} brings up his HUNDRED!`
                : `🏆 ${strikerAfter.name} reaches his FIFTY!`
          const milestoneEntry: CommentaryEntry = {
            id: uid(),
            ballNo: next.ballNo,
            over: oversString(balls),
            text: milestoneText,
            kind: "milestone",
            scorerId: state.scorerId ?? undefined,
            timestamp: new Date().toISOString(),
          }
          next = {
            ...next,
            commentary: [milestoneEntry, ...next.commentary].slice(0, 120),
          }
          break
        }
      }
    }
  }

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
      kind: "info" as const,
    },
    ...commentary,
  ].slice(0, 120)

  // Test matches (maxOvers === 0) play up to 4 innings; limited-overs matches
  // (maxOvers > 0) play 2 innings.
  const isTest = state.maxOvers === 0
  const maxInnings = isTest ? 4 : 2

  // Super-over special case: if the current innings was a super-over, the
  // normal maxInnings check doesn't apply (we already had 2 innings before
  // the super-over started). Instead, count super-over innings: if this is
  // the 1st, create the 2nd (chase target); if this is the 2nd, compute
  // the super-over result.
  if (inn.isSuperOver) {
    const soInnings = innings.filter((i) => i.isSuperOver)
    if (soInnings.length < 2) {
      // This was the 1st super-over innings → create the 2nd with chase.
      const target = inn.runs + 1
      const newSO: ScorerInnings = {
        battingTeamId: inn.bowlingTeamId,
        battingTeamShortName: inn.bowlingTeamShortName,
        bowlingTeamId: inn.battingTeamId,
        bowlingTeamShortName: inn.battingTeamShortName,
        runs: 0, wickets: 0, balls: 0,
        batsmen: [], bowlers: [], fallOfWickets: [],
        declared: false, target,
        extrasByes: 0, extrasLegByes: 0, extrasWides: 0, extrasNoBalls: 0,
        squad: [], freeHit: false,
        partnerships: [], partnershipStartRuns: 0, partnershipStartBalls: 0,
        followOn: false,
        isSuperOver: true,
      }
      innings.push(newSO)
      return {
        ...state,
        innings,
        currentInnings: inningsCount,
        strikerId: null, nonStrikerId: null, bowlerId: null,
        note: `Super Over: ${inn.battingTeamShortName} scored ${inn.runs}. ${inn.bowlingTeamShortName} needs ${target} to win.`,
        commentary: [
          {
            id: uid(),
            ballNo: state.ballNo,
            over: "0",
            text: `Super Over: ${inn.battingTeamShortName} ${inn.runs}/${inn.wickets}. ${inn.bowlingTeamShortName} needs ${target}.`,
            kind: "info" as const,
          },
          ...commentary,
        ].slice(0, 120),
      }
    }
    // Both super-over innings done → compute the result.
    return computeSuperOverResult(state, innings, commentary)
  }

  // Follow-on special case: if the current innings was a follow-on (Team B
  // batting again in a Test), and Team B's overall total is still less than
  // Team A's 1st innings total, Team A wins by an innings + runs (no need
  // for Team A's 2nd innings). Otherwise, Team A bats their 2nd innings
  // (innings 3) chasing Team B's overall total + 1.
  if (inn.followOn) {
    const teamATotal = innings[0].runs
    const teamBOverall = innings[1].runs + innings[2].runs
    if (teamBOverall < teamATotal) {
      // Team A wins by an innings + runs. Match ends.
      const margin = teamATotal - teamBOverall
      const result = `${innings[0].battingTeamShortName} won by an innings and ${margin} run${margin !== 1 ? "s" : ""}`
      return {
        ...state,
        innings,
        status: "completed",
        result,
        note: result,
        strikerId: null, nonStrikerId: null, bowlerId: null,
        commentary: [
          {
            id: uid(),
            ballNo: state.ballNo,
            over: oversString(inn.balls),
            text: `Result: ${result}`,
            kind: "info" as const,
          },
          ...commentary,
        ].slice(0, 120),
      }
    }
    // Team B surpassed Team A → Team A bats innings 3, chasing.
    const target = teamBOverall - teamATotal + 1
    const newInnings: ScorerInnings = {
      battingTeamId: innings[0].battingTeamId,
      battingTeamShortName: innings[0].battingTeamShortName,
      bowlingTeamId: innings[1].battingTeamId,
      bowlingTeamShortName: innings[1].battingTeamShortName,
      runs: 0, wickets: 0, balls: 0,
      batsmen: [], bowlers: [], fallOfWickets: [],
      declared: false, target,
      extrasByes: 0, extrasLegByes: 0, extrasWides: 0, extrasNoBalls: 0,
      squad: [], freeHit: false,
      partnerships: [], partnershipStartRuns: 0, partnershipStartBalls: 0,
      followOn: false,
      isSuperOver: false,
    }
    innings.push(newInnings)
    return {
      ...state,
      innings,
      currentInnings: inningsCount,
      strikerId: null, nonStrikerId: null, bowlerId: null,
      note: `Team A needs ${target} runs to win.`,
      commentary,
    }
  }

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
    partnerships: [],
    partnershipStartRuns: 0,
    partnershipStartBalls: 0,
    followOn: false,
    isSuperOver: false,
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
        kind: "info" as const,
      },
      ...commentary,
    ].slice(0, 120),
  }
}

/**
 * Compute the super-over result. The team with more runs in their super-over
 * innings wins. If equal, it's a tie (no further super-overs in our MVP —
 * the admin can manually start another one via the Super Over button if
 * the match is still tied).
 */
function computeSuperOverResult(
  state: LiveMatchState,
  innings: ScorerInnings[],
  commentary: CommentaryEntry[]
): LiveMatchState {
  const soInnings = innings.filter((i) => i.isSuperOver)
  const teamA = soInnings[0]
  const teamB = soInnings[1]
  let result = ""
  if (teamA.runs > teamB.runs) {
    result = `${teamA.battingTeamShortName} won the Super Over`
  } else if (teamB.runs > teamA.runs) {
    result = `${teamB.battingTeamShortName} won the Super Over`
  } else {
    result = "Super Over tied"
  }
  return {
    ...state,
    innings,
    status: "completed",
    result,
    note: result,
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    commentary: [
      {
        id: uid(),
        ballNo: state.ballNo,
        over: "0",
        text: `Super Over Result: ${result}`,
        kind: "info" as const,
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

/**
 * Enforce the follow-on in a Test match. Only valid when:
 *   • It's a Test (maxOvers === 0)
 *   • We're at the end of innings 1 (Team B's first innings just finished)
 *   • Team A's lead (innings[0].runs - innings[1].runs) is >= 200 runs
 *
 * When enforced, Team B bats again immediately (their 2nd innings becomes
 * innings 2, and if Team B is bowled out short of Team A's total, Team A
 * wins by an innings + runs — no need for Team A's 2nd innings at all).
 *
 * Without the follow-on, the standard endInnings flow would create innings
 * 2 with Team A batting (their 2nd innings). With the follow-on, we create
 * innings 2 with Team B batting again (same batting/bowling sides as
 * innings 1, not swapped).
 */
export function enforceFollowOn(state: LiveMatchState): LiveMatchState {
  if (state.maxOvers > 0) return state  // Tests only
  if (state.innings.length !== 2) return state  // must be after innings 1 (0-indexed)
  const lead = state.innings[0].runs - state.innings[1].runs
  if (lead < 200) return state  // need 200+ run lead

  const inn = state.innings[1]  // Team B's 1st innings (just ended)
  // Create Team B's 2nd innings — same batting side, same bowling side
  // (no swap — that's the whole point of the follow-on).
  const newInnings: ScorerInnings = {
    battingTeamId: inn.battingTeamId,
    battingTeamShortName: inn.battingTeamShortName,
    bowlingTeamId: inn.bowlingTeamId,
    bowlingTeamShortName: inn.bowlingTeamShortName,
    runs: 0, wickets: 0, balls: 0,
    batsmen: [], bowlers: [], fallOfWickets: [],
    declared: false, target: null,
    extrasByes: 0, extrasLegByes: 0, extrasWides: 0, extrasNoBalls: 0,
    squad: [], freeHit: false,
    partnerships: [], partnershipStartRuns: 0, partnershipStartBalls: 0,
    followOn: true,
    isSuperOver: false,
  }
  const innings = [...state.innings, newInnings]
  const commentary = [
    {
      id: uid(),
      ballNo: state.ballNo,
      over: "0",
      text: `${inn.battingTeamShortName} follow-on enforced — they bat again (lead was ${lead} runs)`,
      kind: "info" as const,
    },
    ...state.commentary,
  ].slice(0, 120)
  return {
    ...state,
    innings,
    currentInnings: 2,
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    note: `Follow-on enforced. ${inn.battingTeamShortName} bats again.`,
    commentary,
  }
}

/**
 * Start a super-over after a tied limited-overs match. Creates 2 new
 * innings (1 over each):
 *   • innings N:   Team 1 bats (1 over, no target)
 *   • innings N+1: Team 2 bats (1 over, target = Team 1's super-over score + 1)
 *
 * Only valid for limited-overs matches (maxOvers > 0) where the match
 * result is "Match tied". The super-over has its own maxOvers = 1.
 */
export function startSuperOver(state: LiveMatchState): LiveMatchState {
  if (state.maxOvers <= 0) return state  // limited-overs only
  if (state.status !== "completed") return state
  if (state.result !== "Match tied") return state

  const inn1 = state.innings[0]  // Team A's innings
  // Super-over innings 1: Team A bats again (same batting side)
  const so1: ScorerInnings = {
    battingTeamId: inn1.battingTeamId,
    battingTeamShortName: inn1.battingTeamShortName,
    bowlingTeamId: inn1.bowlingTeamId,
    bowlingTeamShortName: inn1.bowlingTeamShortName,
    runs: 0, wickets: 0, balls: 0,
    batsmen: [], bowlers: [], fallOfWickets: [],
    declared: false, target: null,
    extrasByes: 0, extrasLegByes: 0, extrasWides: 0, extrasNoBalls: 0,
    squad: [], freeHit: false,
    partnerships: [], partnershipStartRuns: 0, partnershipStartBalls: 0,
    followOn: false,
    isSuperOver: true,
  }
  const innings = [...state.innings, so1]
  const commentary = [
    {
      id: uid(),
      ballNo: state.ballNo,
      over: "0",
      text: `SUPER OVER — ${inn1.battingTeamShortName} to bat first`,
      kind: "info" as const,
    },
    ...state.commentary,
  ].slice(0, 120)
  return {
    ...state,
    innings,
    currentInnings: innings.length - 1,
    maxOvers: 1,  // super-over = 1 over per side
    status: "live",
    result: "",
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    note: `Super Over — ${inn1.battingTeamShortName} bats first (1 over)`,
    commentary,
  }
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
      partnerships: (inn.partnerships ?? []).map((p) =>
        `${p.wicket}-${p.runs} (${p.batsman1} & ${p.batsman2}, ${oversString(p.balls)} balls)`
      ),
      isFollowOn: inn.followOn ?? false,
      isSuperOver: inn.isSuperOver ?? false,
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
      audioUrl: c.audioUrl,
    })),
  }
}

/** Quick summary line for the live strip, e.g. "IND 217/4 (42.4)". */
export function inningsSummaryLine(inn: ScorerInnings): string {
  return `${inn.battingTeamShortName} ${inn.runs}/${inn.wickets} (${oversString(inn.balls)})`
}
