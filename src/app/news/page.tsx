import { redirect } from "next/navigation"

/**
 * /news — index route for news.
 *
 * For now this redirects to the SPA news listing (`/?view=news`). The SPA
 * news view handles filtering, search, and pagination; until that view is
 * also migrated to a server-rendered page, this redirect keeps the
 * existing UX intact.
 *
 * Article detail pages already live here at `/news/[slug]` (SSR).
 */
export default function NewsIndexPage() {
  redirect("/?view=news")
}
