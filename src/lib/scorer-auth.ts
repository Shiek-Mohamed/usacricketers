import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto"
import { db } from "./db"

/**
 * Per-scorer authentication for the live-scoring add-on.
 *
 * Scorers are scoped to one or more tournaments (Series). They never get admin
 * CMS access. A signed token (HMAC-SHA256) is issued at login containing the
 * scorer id, name and assigned tournament ids — the score-service validates it
 * with the same secret and checks the match's series is in the token's list.
 */

// Shared secret for token signing. MUST match score-service env SCORER_SECRET.
const SCORER_SECRET =
  process.env.SCORER_SECRET || "cric-cms-scorer-secret-change-me"

// Internal secret for the match->series lookup endpoint (score-service -> api).
const INTERNAL_SECRET =
  process.env.INTERNAL_SECRET || "cric-cms-internal-change-me"

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12 // 12 hours

export interface ScorerTokenPayload {
  scorerId: string
  name: string
  username: string
  tournamentIds: string[]
  exp: number
}

/* ----------------------------- password hashing ----------------------------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const computed = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, "hex")
  try {
    return computed.length === expected.length && timingSafeEqual(computed, expected)
  } catch {
    return false
  }
}

/* ------------------------------ token signing ------------------------------- */

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url")
}

function sign(payload: string): string {
  return createHmac("sha256", SCORER_SECRET).update(payload).digest("base64url")
}

export function issueScorerToken(p: {
  scorerId: string
  name: string
  username: string
  tournamentIds: string[]
}): string {
  const body: ScorerTokenPayload = {
    scorerId: p.scorerId,
    name: p.name,
    username: p.username,
    tournamentIds: p.tournamentIds,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const payload = b64url(JSON.stringify(body))
  return `${payload}.${sign(payload)}`
}

export function verifyScorerToken(token: string): ScorerTokenPayload | null {
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  const expected = sign(payload)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  let body: ScorerTokenPayload
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (!body || typeof body.exp !== "number" || body.exp < Date.now()) return null
  if (!body.scorerId || !Array.isArray(body.tournamentIds)) return null
  return body
}

/* --------------------------- internal endpoint guard ------------------------- */

export function checkInternalSecret(provided: string | null | undefined): boolean {
  if (!provided) return false
  try {
    const a = Buffer.from(String(provided))
    const b = Buffer.from(INTERNAL_SECRET)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/* ----------------------------- db-backed checks ----------------------------- */

/** Returns true if a scorer still has an assignment to the given series. */
export async function scorerHasSeries(
  scorerId: string,
  seriesId: string | null | undefined
): Promise<boolean> {
  if (!seriesId) return false
  const a = await db.scorerAssignment.findUnique({
    where: { scorerId_seriesId: { scorerId, seriesId } },
  })
  return !!a
}

/* --------------------------- league-admin tokens --------------------------- */

/**
 * Tier 3 — League administrator tokens. Same HMAC-SHA256 signing as scorer
 * tokens (reuses SCORER_SECRET) but the payload carries adminId +
 * managedSeriesIds and a `role: "leagueAdmin"` marker so the two token types
 * can never be confused. Only validated by the Next.js API routes (the
 * score-service never sees these).
 */
export interface LeagueAdminTokenPayload {
  role: "leagueAdmin"
  adminId: string
  name: string
  username: string
  managedSeriesIds: string[]
  exp: number
}

export function issueLeagueAdminToken(p: {
  adminId: string
  name: string
  username: string
  managedSeriesIds: string[]
}): string {
  const body: LeagueAdminTokenPayload = {
    role: "leagueAdmin",
    adminId: p.adminId,
    name: p.name,
    username: p.username,
    managedSeriesIds: p.managedSeriesIds,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const payload = b64url(JSON.stringify(body))
  return `${payload}.${sign(payload)}`
}

export function verifyLeagueAdminToken(
  token: string
): LeagueAdminTokenPayload | null {
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  const expected = sign(payload)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  let body: LeagueAdminTokenPayload
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (!body || body.role !== "leagueAdmin") return null
  if (typeof body.exp !== "number" || body.exp < Date.now()) return null
  if (!body.adminId || !Array.isArray(body.managedSeriesIds)) return null
  return body
}

/** Read a Bearer token from a Request's Authorization header. */
export function readBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const m = authHeader.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}
