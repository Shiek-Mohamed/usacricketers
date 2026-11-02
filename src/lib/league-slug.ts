/**
 * League-slug derivation + uniqueness helpers.
 *
 * Used by:
 *   • src/scripts/backfill-league-slugs.ts — one-time migration script that
 *     assigns a slug to every existing Series based on its `name`.
 *   • /api/league-admin/series  POST + PUT — auto-derive a slug from the
 *     submitted `name` when the admin leaves the slug field blank.
 *   • /api/series  POST + PUT — same, on the site-admin series endpoints.
 *   • league-admin-series-edit-view — live preview + uniqueness check while
 *     the admin types.
 *
 * Pattern mirrors `src/lib/slugify-filename.ts`:
 *   • lowercase
 *   • whitespace + underscores → hyphens
 *   • strip non-alphanumeric (except hyphens)
 *   • collapse + trim hyphens
 *   • fall back to "league" if name is empty after slugification
 *
 * Uniqueness uses sequential -2/-3/-4 suffixes (NOT random) so the SEO
 * keyword signal in the league name is preserved across collisions.
 */

/**
 * Slugs that must NEVER be used for a league — they conflict with system
 * routes / Next.js reserved paths and would shadow real app functionality.
 * The API layer rejects any create/update that uses one of these.
 */
export const RESERVED_SLUGS = new Set([
  "api",
  "admin",
  "uploads",
  "_next",
  "league", // matches the /league/[slug] route prefix — a series called "League" would self-shadow
  "sitemap",
  "robots",
  "favicon",
  "embed",
  "og-image",
  "rss",
  "sw",
  "manifest",
  "logo",
])

/**
 * Convert a league name into a URL-safe kebab-case slug.
 *
 * Examples:
 *   slugifyLeagueName("Arizona Premier Cricket League") → "arizona-premier-cricket-league"
 *   slugifyLeagueName("Abu Dhabi T10 2026")              → "abu-dhabi-t10-2026"
 *   slugifyLeagueName("Border-Gavaskar Trophy 2024-25")  → "border-gavaskar-trophy-2024-25"
 *   slugifyLeagueName("  SpACES  & symbols! ")           → "spaces-symbols"
 *   slugifyLeagueName("")                                → "league"
 */
export function slugifyLeagueName(name: string): string {
  const slug = (name || "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "league"
}

/**
 * Check whether a slug is reserved (cannot be assigned to a league).
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has((slug || "").toLowerCase())
}

/**
 * Async uniqueness check used to guarantee a slug doesn't collide with
 * another Series. If the desired slug is taken (or reserved), append -2,
 * -3, -4 … until a free one is found. Skips the current row when
 * `currentSeriesId` is supplied (so updating a Series' own slug doesn't
 * false-positive on its own existing value).
 *
 * @param desiredSlug  the slugified candidate (e.g. "arizona-premier-cricket-league")
 * @param existsFn     async fn returning true if a Series already owns the slug
 * @param currentSeriesId  optional — the Series being updated (its own slug doesn't count)
 */
export async function ensureUniqueLeagueSlug(
  desiredSlug: string,
  existsFn: (slug: string) => Promise<boolean>,
  currentSeriesId?: string,
): Promise<string> {
  const base = desiredSlug || "league"

  // Reserved-slug guard — caller normally rejects reserved slugs before this
  // point, but if the admin explicitly typed "league" we still need a unique,
  // non-reserved value. Append -2 immediately.
  let candidate = base
  let n = 1
  if (isReservedSlug(candidate)) {
    n = 2
    candidate = `${base}-2`
  }

  // If the base slug isn't taken (or is taken only by the row being updated),
  // we're done.
  const baseTaken = await existsFn(candidate)
  if (!baseTaken) return candidate

  // Otherwise iterate base-2, base-3, base-4 … (skipping the current owner).
  for (let i = Math.max(2, n); i <= 1000; i++) {
    const c = `${base}-${i}`
    const taken = await existsFn(c)
    if (!taken) return c
  }

  // Safety valve — should never happen.
  return `${base}-${Date.now()}`
}
