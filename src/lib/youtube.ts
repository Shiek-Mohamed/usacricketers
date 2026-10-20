/**
 * Extract the 11-char YouTube video ID from any common YouTube URL form:
 *  - https://www.youtube.com/watch?v=ID
 *  - https://youtu.be/ID
 *  - https://www.youtube.com/embed/ID
 *  - https://www.youtube.com/shorts/ID
 *  - bare ID (11+ chars)
 * Returns "" if no ID could be extracted.
 */
export function extractYouTubeId(input: string): string {
  if (!input) return ""
  const s = input.trim()
  // bare ID
  if (/^[\w-]{11}$/.test(s)) return s
  // youtu.be/ID
  const m1 = s.match(/youtu\.be\/([\w-]{6,})/)
  if (m1) return m1[1].split(/[?&]/)[0]
  // youtube.com/embed/ID or /shorts/ID or /v/ID
  const m2 = s.match(/youtube\.com\/(?:embed|shorts|v|live)\/([\w-]{6,})/)
  if (m2) return m2[1].split(/[?&]/)[0]
  // youtube.com/watch?v=ID
  const m3 = s.match(/[?&]v=([\w-]{6,})/)
  if (m3) return m3[1].split(/[?&#]/)[0]
  return ""
}

/** Build the embed URL for a YouTube ID. */
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}`
}

/**
 * A public thumbnail for a YouTube video. hqdefault is always available;
 * maxresdefault is higher quality but missing for some videos.
 */
export function youTubeThumb(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}
