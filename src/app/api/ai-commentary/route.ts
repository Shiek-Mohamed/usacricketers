import { NextRequest, NextResponse } from "next/server"
import ZAI from "z-ai-web-dev-sdk"
import { verifyScorerToken, readBearerToken } from "@/lib/scorer-auth"
import { rateLimit } from "@/lib/rate-limit"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { randomUUID } from "node:crypto"

/**
 * POST /api/ai-commentary
 *
 * Generates a single short prose commentary line for a key match event
 * (wicket / boundary / six / milestone / over-end) using the LLM skill
 * (z-ai-web-dev-sdk). The prose is returned to the scorer's browser, which
 * inserts it into `LiveMatchState.commentary` as a `kind: "ai"` entry and
 * re-broadcasts the state through the normal score-service pipeline.
 *
 * Design (see audit):
 *   • AUGMENTS the templated feed — does NOT replace the structured ball
 *     entries (those power jump-to-ball, badges, charts). AI prose is a
 *     parallel narrative line.
 *   • Gated to KEY EVENTS only — not every delivery. Keeps cost/latency
 *     bounded (~20-30 calls/match instead of ~250) and matches real
 *     commentary cadence (nobody narrates a dot ball with florid prose).
 *   • z-ai-web-dev-sdk is server-side only — never imported on the client.
 *
 * Auth: a valid signed scorer Bearer token (covers both real scorers and
 * site-admins, who mint themselves a god-mode scorer token via
 * /api/admin/scorer-token). No CSRF needed (Bearer, not cookie). Rate-
 * limited per IP so a leaked token can't burn LLM quota.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// LLM (~1-2s) + TTS synthesis (~0.5-1s) + file write can approach 5s on a
// cold instance. 30s gives comfortable headroom on fly.io.
export const maxDuration = 30

// Generous cap — key events fire at most a few per over. 30/min/IP is well
// above the realistic ~6/min peak (an over with a wicket + boundary + six +
// over-end = 4 calls) while still bounding abuse.
const RATE_LIMIT = { limit: 30, windowMs: 60_000 }

// Hard cap on prose length so a runaway model response can't bloat the
// commentary array (capped at 120 entries) or the broadcast payload.
const MAX_PROSE_LEN = 240

interface AiCommentaryRequest {
  matchId?: string
  format?: string
  // Innings context — the "scene" the commentator is describing.
  innings?: {
    battingTeam?: string
    bowlingTeam?: string
    runs?: number
    wickets?: number
    overs?: string
    inningsNo?: number
    target?: number | null
  }
  // The striker / non-striker / bowler on this delivery.
  striker?: string
  nonStriker?: string
  bowler?: string
  // The triggering event — exactly one of these describes what just happened.
  event?: {
    kind: "wicket" | "boundary" | "six" | "milestone" | "over"
    runs?: number
    over?: string
    ballNo?: number
    // wicket-only
    dismissal?: string
    outBatsman?: string
    newBatsman?: string
    // milestone / over — the templated commentary text from the scoring
    // engine, passed through as freeform context so the model can phrase
    // around the actual landmark / over summary (e.g. "FIFTY! Smith reaches
    // his half-century" or "End of over 12. 8 runs, 1 wkt").
    description?: string
  }
}

function buildUserMessage(req: AiCommentaryRequest): string {
  const inn = req.innings ?? {}
  const ev = req.event ?? {}
  const parts: string[] = []

  // Scene
  const sceneBits: string[] = []
  if (inn.battingTeam) sceneBits.push(`${inn.battingTeam} batting`)
  if (inn.bowlingTeam) sceneBits.push(`${inn.bowlingTeam} bowling`)
  if (typeof inn.runs === "number" && typeof inn.wickets === "number") {
    sceneBits.push(`score ${inn.runs}/${inn.wickets}`)
  }
  if (inn.overs) sceneBits.push(`at ${inn.overs} overs`)
  if (inn.inningsNo) sceneBits.push(`(innings ${inn.inningsNo})`)
  if (inn.target) sceneBits.push(`target ${inn.target}`)
  if (sceneBits.length) parts.push(`Context: ${sceneBits.join(", ")}.`)

  // Actors
  const actors: string[] = []
  if (req.striker) actors.push(`striker ${req.striker}`)
  if (req.nonStriker) actors.push(`non-striker ${req.nonStriker}`)
  if (req.bowler) actors.push(`bowler ${req.bowler}`)
  if (actors.length) parts.push(`At the crease: ${actors.join(", ")}.`)

  // Event
  const evLabel = ev.over ? `${ev.over}` : `ball ${ev.ballNo ?? "?"}`
  switch (ev.kind) {
    case "wicket":
      parts.push(
        `WICKET on ${evLabel}: ${ev.outBatsman ?? "the batsman"} ${ev.dismissal ?? "dismissed"}.` +
          (ev.newBatsman ? ` New batsman: ${ev.newBatsman}.` : "")
      )
      break
    case "boundary":
      parts.push(`FOUR on ${evLabel}${ev.runs ? ` (${ev.runs} runs)` : ""}.`)
      break
    case "six":
      parts.push(`SIX on ${evLabel}.`)
      break
    case "milestone":
      parts.push(`MILESTONE on ${evLabel}: ${ev.description ?? "landmark reached"}.`)
      break
    case "over":
      parts.push(`Over ${evLabel} complete — ${ev.description ?? "over complete"}.`)
      break
  }

  parts.push("Write ONE short commentary sentence (max ~25 words) for this event.")
  return parts.join(" ")
}

const SYSTEM_PROMPT = `You are a vivid cricket commentator writing for a live ball-by-ball feed (ESPNcricinfo style). Rules:
- Write exactly ONE short sentence, max ~25 words.
- Be energetic, specific, and varied — never reuse the same phrase.
- Avoid clichés ("textbook", "picture-perfect", "cream of the crop").
- Reference the player and the shot/dismissal concretely when possible.
- Do NOT add quotes, labels, prefixes, or explanations.
- Output ONLY the commentary sentence.`

export async function POST(req: NextRequest) {
  // Auth — scorer Bearer token (covers scorers + god-mode site admins).
  const bearer = readBearerToken(req.headers.get("authorization"))
  const scorer = verifyScorerToken(bearer)
  if (!scorer) {
    return NextResponse.json(
      { error: "Unauthorized: valid scorer token required" },
      { status: 401 }
    )
  }

  // Rate limit — bounds LLM cost even if a token leaks.
  const limited = rateLimit(req, RATE_LIMIT)
  if (limited) return limited

  // Parse + lightly validate the body.
  let body: AiCommentaryRequest
  try {
    body = (await req.json()) as AiCommentaryRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!body || !body.event || !body.event.kind) {
    return NextResponse.json({ error: "Missing event.kind" }, { status: 400 })
  }
  const kind = body.event.kind
  if (
    kind !== "wicket" &&
    kind !== "boundary" &&
    kind !== "six" &&
    kind !== "milestone" &&
    kind !== "over"
  ) {
    return NextResponse.json(
      { error: `Event kind '${kind}' is not a key event — AI commentary is gated to wicket/boundary/six/milestone/over` },
      { status: 400 }
    )
  }

  const userMessage = buildUserMessage(body)

  try {
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      thinking: { type: "disabled" },
    })
    const raw = completion.choices[0]?.message?.content ?? ""
    // Trim + collapse internal whitespace + cap length. Strip a leading/trailing
    // quote if the model wrapped the sentence despite the instruction.
    const prose = raw
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
      .slice(0, MAX_PROSE_LEN)

    if (!prose) {
      // Empty model response — return null so the client skips insertion
      // rather than showing a blank line in the feed.
      return NextResponse.json({ prose: null, audioUrl: null })
    }

    // TTS — synthesize spoken audio for the prose so viewers HEAR the AI
    // commentary, not just read it. Voice "jam" (English-gentleman accent)
    // fits the cricket-commentator register. Graceful degradation: if TTS
    // fails, return the prose alone (text-only AI entry) — the client renders
    // the line without an audio player. Audio is saved to the persistent
    // db/uploads volume (survives fly.io restarts) and served by
    // /api/uploads/[name] which already handles .mp3 → audio/mpeg.
    let audioUrl: string | null = null
    try {
      const ttsRes = await zai.audio.tts.create({
        input: prose, // already <= 240 chars, well under the 1024 TTS cap
        voice: "jam",
        speed: 1.0,
        // wav — the TTS API rejects response_format "mp3" (400: unsupported
        // value), despite the skill docs listing it. wav is the default +
        // browser-playable via <audio>. Files are ~150-200KB for a short
        // sentence at 24kHz — fine for the db/uploads volume.
        response_format: "wav",
        stream: false,
      })
      const arrayBuffer = await ttsRes.arrayBuffer()
      const audioBuffer = Buffer.from(new Uint8Array(arrayBuffer))
      const dir = path.join(process.cwd(), "db", "uploads")
      if (!existsSync(dir)) await mkdir(dir, { recursive: true })
      const filename = `ai-tts-${randomUUID()}.wav`
      await writeFile(path.join(dir, filename), audioBuffer)
      audioUrl = `/api/uploads/${filename}`
    } catch (ttsErr) {
      // Non-fatal — prose is still useful without audio. Log + continue.
      const ttsMsg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr).slice(0, 200)
      console.warn("[ai-commentary] TTS failed (returning prose without audio):", ttsMsg)
    }

    return NextResponse.json({ prose, audioUrl })
  } catch (err) {
    // Never 500 the scorer — a failed LLM call should just mean no AI line
    // for this ball, not a disrupted scoring flow. Log + return null.
    const msg = err instanceof Error ? err.message : String(err).slice(0, 200)
    console.warn("[ai-commentary] LLM call failed:", msg)
    return NextResponse.json({ prose: null, audioUrl: null, error: "LLM unavailable" })
  }
}
