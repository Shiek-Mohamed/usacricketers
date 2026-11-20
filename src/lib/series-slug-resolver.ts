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
 *
 * NOTE: The Series model in `prisma/schema.prisma` does NOT have a `slug`
 * column (the project stores slugs on League/Team/Player, but not Series).
 * The previous implementation called `db.series.findUnique({ where: { slug } })`,
 * which queried a non-existent field and broke TypeScript compilation. Since
 * there is no slug column to collide against, the uniqueness check is now a
 * no-op (always returns "not taken") and the resolver is safe to call. If a
 * slug column is added to the Series model in the future, restore the
 * `db.series.findUnique({ where: { slug } })` lookups.
 */

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
 * @throws SlugError on reserved or empty slugs.
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
    // The Series model has no `slug` column, so there is nothing to collide
    // against in the DB. Accept the explicit slug as-is. (If a slug column
    // is added later, restore the findUnique collision check here.)
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

  // With no `slug` column on Series, no slug can ever be taken. The
  // existsFn always returns false so ensureUniqueLeagueSlug returns the
  // base slug immediately (skipping the -2/-3 suffix loop).
  const existsFn = async (_slug: string) => false

  return ensureUniqueLeagueSlug(base, existsFn, currentSeriesId)
}
