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
}

export interface CommentaryEntry {
  id: string
  ballNo: number
  over: string
  text: string
  kind: "run" | "boundary" | "six" | "wicket" | "extra" | "over" | "info"
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

export type BallEvent =
  | { kind: "run"; runs: number }
  | { kind: "wide" }
  | { kind: "noball" }
  | { kind: "wicket"; dismissal: string }
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

export function addBatsman(state: LiveMatchState, id: string, name: string): LiveMatchState {
  const inn = state.innings[state.currentInnings]
  if (inn.batsmen.some((b) => b.id === id)) return state
  const batsman: ScorerBatsman = {
    id,
    name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
    dismissal: "",
  }
  const newInnings = [...state.innings]
  newInnings[state.currentInnings] = {
    ...inn,
    batsmen: [...inn.batsmen, batsman],
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
      if (r === 4) {
        striker.fours += 1
        eventText = `FOUR! ${striker.name} ${r}`
        eventKind = "boundary"
      } else if (r === 6) {
        striker.sixes += 1
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
      isLegal = false
      eventText = "No ball (+1)"
      eventKind = "extra"
      break
    }
    case "bye":
    case "legbye": {
      const r = event.runs
      runs += r
      striker.balls += 1
      // byes/legbyes: not credited to batsman runs or bowler runs
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
      striker.out = true
      striker.balls += 1
      striker.dismissal = event.dismissal
      wickets += 1
      bowler.wickets += 1
      bowler.overWickets += 1
      fallOfWickets = [
        ...fallOfWickets,
        {
          wktNo: wickets,
          score: runs,
          over: oversString(balls),
          batsman: striker.name,
        },
      ]
      strikerId = null // awaiting new batsman
      eventText = `WICKET! ${striker.name} ${event.dismissal}`
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
  const isFirst = state.currentInnings === 0
  const innings = [...state.innings]
  innings[state.currentInnings] = { ...inn }

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

  if (isFirst) {
    // Set up 2nd innings with chase target
    const target = inn.runs + 1
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
      target,
    }
    innings.push(newInnings)
    return {
      ...state,
      innings,
      currentInnings: 1,
      strikerId: null,
      nonStrikerId: null,
      bowlerId: null,
      note: `${inn.battingTeamShortName} set ${target} to win. ${inn.bowlingTeamShortName} to chase.`,
      commentary,
    }
  }
  // 2nd innings end → result
  const target = inn.target ?? 0
  let result = ""
  const chaser = inn.battingTeamShortName
  const setter = inn.bowlingTeamShortName
  if (inn.runs >= target) {
    const wktsLeft = 10 - inn.wickets
    result = `${chaser} won by ${wktsLeft} wicket${wktsLeft !== 1 ? "s" : ""}`
  } else if (inn.runs === target - 1) {
    result = "Match tied"
  } else {
    const margin = target - 1 - inn.runs
    result = `${setter} won by ${margin} run${margin !== 1 ? "s" : ""}`
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
        over: oversString(inn.balls),
        text: `Result: ${result}`,
        kind: "info",
      },
      ...commentary,
    ].slice(0, 120),
  }
}

/** Convert the live state to the public Scorecard format (read by ScorecardView). */
export function stateToScorecard(state: LiveMatchState): Scorecard {
  const innings: Innings[] = state.innings.map((inn) => {
    const batting: BattingLine[] = inn.batsmen.map((b) => ({
      name: b.name,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      strikeRate: b.balls > 0 ? Number(((b.runs / b.balls) * 100).toFixed(1)) : 0,
      dismissal: b.out ? b.dismissal : "not out",
      isBatting: !b.out && (b.id === state.strikerId || b.id === state.nonStrikerId),
    }))
    // order: striker first, non-striker second, then out batsmen in order
    batting.sort((a, b) => {
      const aLive = a.isBatting ? 0 : 1
      const bLive = b.isBatting ? 0 : 1
      return aLive - bLive
    })
    // add Extras line
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
      dismissal: `(b ${Math.floor(inn.balls / 6)}, lb ${0}, w ${0}, nb ${0})`,
      isBatting: false,
    })
    const bowling: BowlingLine[] = inn.bowlers.map((b) => ({
      name: b.name,
      overs: oversString(b.balls),
      maidens: b.maidens,
      runs: b.runsConceded,
      wickets: b.wickets,
      economy: b.balls > 0 ? Number(((b.runsConceded / b.balls) * 6).toFixed(2)) : 0,
      wides: b.wides || 0,
      noballs: b.noballs || 0,
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
    }
  })
  return { innings, note: state.note }
}

/** Quick summary line for the live strip, e.g. "IND 217/4 (42.4)". */
export function inningsSummaryLine(inn: ScorerInnings): string {
  return `${inn.battingTeamShortName} ${inn.runs}/${inn.wickets} (${oversString(inn.balls)})`
}
