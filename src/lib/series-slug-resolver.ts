/**
 * Server-side slug resolution helper for Series create/update API routes.
 *
 * Used by:
 *   • /api/series             POST + PUT  (site-admin)
 *   • /api/league-admin/series POST + PUT (league-admin)
 *
 * Behaviour:
 *   1. If the caller passed an explicit `slug` in the body, slugify it and
 *      validate it isn't reserved. We do NOT auto-resolve collisions here
 *      for explicit slugs — instead we throw a 400-style error so the admin
 *      sees "that slug is already in use" and picks another.
 *   2. If the caller left `slug` blank, auto-derive it from the league name
 *      in kebab-case and append -2/-3/... if necessary to ensure uniqueness.
 *   3. Reject reserved slugs (api, admin, uploads, _next, league, sitemap,
 *      robots, favicon, …) with a thrown error the caller maps to HTTP 400.
 *
 * The current row's own slug is excluded from the uniqueness check during
 * updates so an admin can save a Series without false-positive collisions
 * against itself.
 */

import { db } from "./db"
import {
  slugifyLeagueName,
  isReservedSlug,
  ensureUniqueLeagueSlug,
} from "./league-slug"

export class SlugError extends Error {
  constructor(message: string, public code: "reserved" | "taken" | "empty") {
    super(message)
    this.name = "SlugError"
  }
}

/**
 * Resolve the slug for a Series create/update operation.
 *
 * @param bodySlug   the `slug` field from the request body (may be empty/undefined)
 * @param bodyName   the `name` field from the request body (used to auto-derive)
 * @param currentSeriesId  the id of the Series being updated (undefined on create)
 *
 * @returns the final slug string to write to the DB.
 * @throws SlugError on reserved or already-taken explicit slugs.
 */
export async function resolveSeriesSlug(
  bodySlug: unknown,
  bodyName: string,
  currentSeriesId?: string,
): Promise<string> {
  const explicitRaw = typeof bodySlug === "string" ? bodySlug.trim() : ""
  const explicit = explicitRaw ? slugifyLeagueName(explicitRaw) : ""

  // Caller asked for a specific slug — validate it.
  if (explicit) {
    if (isReservedSlug(explicit)) {
      throw new SlugError(
        `Slug "${explicit}" is reserved and cannot be used for a league.`,
        "reserved",
      )
    }
    const clash = await db.series.findUnique({
      where: { slug: explicit },
      select: { id: true },
    })
    if (clash && clash.id !== currentSeriesId) {
      throw new SlugError(
        `Slug "${explicit}" is already in use by another league.`,
        "taken",
      )
    }
    return explicit
  }

  // No explicit slug — auto-derive from name + uniqueness-check.
  if (!bodyName || !bodyName.trim()) {
    throw new SlugError(
      "Cannot derive slug: league name is required.",
      "empty",
    )
  }
  const base = slugifyLeagueName(bodyName)

  const existsFn = async (slug: string) => {
    const clash = await db.series.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!clash) return false
    return clash.id !== currentSeriesId
  }

  return ensureUniqueLeagueSlug(base, existsFn, currentSeriesId)
}
