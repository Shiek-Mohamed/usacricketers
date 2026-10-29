/**
 * SEO-friendly filename slugifier for uploaded image files.
 *
 * Why: Google Images reads the filename as a keyword signal.
 *   - "Babar Azam Century vs Sri Lanka 2025.jpg" → high SEO value
 *   - "a1b2c3d4.jpg" or "1730245678.jpg" → zero SEO value
 *
 * This helper converts the user's original filename into a URL-safe,
 * kebab-case slug that preserves the keyword signal:
 *   - lowercase
 *   - whitespace and underscores → hyphens
 *   - non-alphanumeric chars stripped (except hyphens and the dot before extension)
 *   - collapses multiple consecutive hyphens
 *   - preserves the original file extension
 *   - falls back to "untitled" if name is empty after slugification
 *
 * Uniqueness is handled separately by `ensureUniqueFilename` which appends
 * -2, -3, etc. on collision (NOT a random suffix — preserves the SEO value).
 */

const VALID_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "svg",
])

const MAX_NAME_LENGTH = 80 // chars, excluding extension — keeps filesystem-friendly

/**
 * Convert a user-provided filename into an SEO-friendly kebab-case slug
 * with the original extension preserved.
 *
 * Examples:
 *   slugifyFilename("Babar Azam Century.jpg")           → "babar-azam-century.jpg"
 *   slugifyFilename("IND vs AUS Final Trophy.PNG")      → "ind-vs-aus-final-trophy.png"
 *   slugifyFilename("  spACES  and  -_- dashes.jpg")    → "spaces-and-dashes.jpg"
 *   slugifyFilename("cover.jpg")                        → "cover.jpg"
 *   slugifyFilename("file with no extension")            → "file-with-no-extension"
 *   slugifyFilename(".hidden")                           → "hidden"  (leading dot stripped)
 *   slugifyFilename("")                                  → "untitled"
 *   slugifyFilename("file.tar.gz")                       → "file.tar-gz"  (non-image ext preserved in name)
 */
export function slugifyFilename(filename: string): string {
  const normalized = (filename || "")
    .toLowerCase()
    .trim()
    // Replace whitespace and underscores with single hyphens
    .replace(/[\s_]+/g, "-")
    // Strip non-alphanumeric chars (except hyphens and the dot separator)
    .replace(/[^a-z0-9.-]/g, "")
    // Collapse multiple consecutive hyphens
    .replace(/-+/g, "-")
    // Strip leading/trailing hyphens
    .replace(/^-+|-+$/g, "")
    // Strip leading dots (e.g. ".hidden" → "hidden", ".DS_Store.jpg" → "ds-store.jpg")
    // — prevents the saved file from being a Unix hidden file
    .replace(/^\.+/, "")

  // Split into name + extension at the LAST dot
  const lastDot = normalized.lastIndexOf(".")
  let name: string
  let ext: string
  if (lastDot > 0) {
    name = normalized.slice(0, lastDot)
    ext = normalized.slice(lastDot + 1)
  } else {
    name = normalized
    ext = ""
  }

  // If the extension isn't a recognized image format, drop it (the upload
  // route will re-add the correct extension based on the actual content-type).
  if (ext && !VALID_IMAGE_EXTENSIONS.has(ext)) {
    // Append it back to the name so we don't lose info (e.g. "file.tar.gz"
    // → name="file-tar", ext="" — better than "file" with no extension).
    name = name + (ext ? "-" + ext : "")
    ext = ""
  }

  // Fallback for empty names (e.g. user uploaded a file literally named ".jpg")
  if (!name) name = "untitled"

  // Truncate name to keep total filename reasonable (preserves extension)
  if (name.length > MAX_NAME_LENGTH) {
    name = name.slice(0, MAX_NAME_LENGTH).replace(/-+$/g, "")
  }

  return ext ? `${name}.${ext}` : name
}

/**
 * Ensure uniqueness of a filename within a directory.
 * If the desired name is taken, append -2, -3, -4... before the extension.
 *
 * IMPORTANT: We use sequential -2/-3 suffixes instead of a random hash
 * because the random suffix would destroy the SEO value of the slug.
 * (Google reads "babar-azam-century-2.jpg" as still containing the keyword
 * "babar-azam-century" — a random suffix would strip that signal.)
 *
 * @param desiredName the slugified filename (e.g. "babar-azam-century.jpg")
 * @param existsFn    async function returning true if the given name is taken
 * @returns           a unique filename (e.g. "babar-azam-century-2.jpg" if the base is taken)
 */
export async function ensureUniqueFilename(
  desiredName: string,
  existsFn: (name: string) => Promise<boolean>,
): Promise<string> {
  if (!(await existsFn(desiredName))) return desiredName

  // Split base + extension
  const lastDot = desiredName.lastIndexOf(".")
  let base: string
  let ext: string
  if (lastDot > 0) {
    base = desiredName.slice(0, lastDot)
    ext = "." + desiredName.slice(lastDot + 1)
  } else {
    base = desiredName
    ext = ""
  }

  // Try base-2, base-3, base-4...
  for (let n = 2; n <= 1000; n++) {
    const candidate = `${base}-${n}${ext}`
    if (!(await existsFn(candidate))) return candidate
  }

  // Safety valve (should never hit 1000 collisions in practice)
  return `${base}-${Date.now()}${ext}`
}
