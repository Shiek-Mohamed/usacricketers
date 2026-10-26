import { db } from "@/lib/db"
import { parseCategories } from "@/lib/types"

export const dynamic = "force-dynamic"

/**
 * /rss.xml — RSS 2.0 feed of the latest 25 published articles.
 * Readers can subscribe via RSS clients (Feedly, Inoreader, etc.).
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

  const articles = await db.article.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: 25,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      author: true,
      publishedAt: true,
      category: true,
    },
  })

  const items = articles
    .map((a) => {
      const cats = parseCategories(a.category)
      const url = `${baseUrl}/?view=article-detail&id=${a.id}`
      const pubDate = a.publishedAt
        ? new Date(a.publishedAt).toUTCString()
        : new Date().toUTCString()
      return `    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="false">${a.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[${a.author || "USACricketers"}]]></dc:creator>
      <description><![CDATA[${a.excerpt}]]></description>
${cats
  .map((c) => `      <category><![CDATA[${c}]]></category>`)
  .join("\n")}
    </item>`
    })
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>USACricketers — Latest Cricket News</title>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <description>The definitive home of USA cricket — live scores, news, stats and analysis.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>USACricketers CMS</generator>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
