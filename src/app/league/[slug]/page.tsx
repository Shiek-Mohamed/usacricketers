import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/**
 * /league/<slug> → redirects to /<slug> (root-level)
 *
 * The league page now lives at the root level (e.g., /arizona-premier-cricket-league)
 * to match the CricClubs URL pattern (cricclubs.com/LeagueName).
 *
 * This route is kept for backwards compat — any existing links to /league/<slug>
 * will 301 redirect to the new root-level URL.
 */
export default async function LeagueRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/${slug}`)
}
