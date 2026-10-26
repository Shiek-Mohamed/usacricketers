"use client"

import { useEffect } from "react"

interface SeoMetaProps {
  title?: string
  description?: string
  image?: string | null
  url?: string
  type?: "article" | "website"
  publishedTime?: string
  author?: string
  keywords?: string[]
}

/**
 * Client-side SEO meta tag injector. Works with SPA navigation (no SSR
 * metadata export needed). Sets document.title + Open Graph + Twitter
 * cards + schema.org JSON-LD on each navigation.
 *
 * Usage: <SeoMeta title={article.title} description={article.excerpt}
 *   image={article.imageUrl} type="article" publishedTime={article.publishedAt}
 *   author={article.author} />
 */
export function SeoMeta({
  title,
  description,
  image,
  url,
  type = "website",
  publishedTime,
  author,
  keywords,
}: SeoMetaProps) {
  useEffect(() => {
    if (title) document.title = `${title} — usacricketers`

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement("meta")
        const [tag, ...rest] = selector.replace(/[[].*[]]/, "").split(/[#.]/)
        document.head.appendChild(el)
      }
      el.setAttribute(attr, value)
    }

    const setProperty = (property: string, content: string) => {
      let el = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement("meta")
        el.setAttribute("property", property)
        document.head.appendChild(el)
      }
      el.setAttribute("content", content)
    }

    const setName = (name: string, content: string) => {
      let el = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement("meta")
        el.setAttribute("name", name)
        document.head.appendChild(el)
      }
      el.setAttribute("content", content)
    }

    const currentUrl = url || window.location.href

    if (description) {
      setName("description", description)
      setProperty("og:description", description)
      setName("twitter:description", description)
    }
    if (title) {
      setProperty("og:title", title)
      setName("twitter:title", title)
    }
    setProperty("og:type", type)
    setProperty("og:url", currentUrl)
    setProperty("og:site_name", "usacricketers")
    setName("twitter:card", image ? "summary_large_image" : "summary")
    setName("twitter:site", "@usacricketers")
    if (image) {
      setProperty("og:image", image)
      setName("twitter:image", image)
    }
    if (publishedTime) {
      setProperty("article:published_time", publishedTime)
    }
    if (author) {
      setProperty("article:author", author)
    }
    if (keywords && keywords.length > 0) {
      setName("keywords", keywords.join(", "))
    }

    // Schema.org JSON-LD
    const existingJsonLd = document.getElementById("seo-jsonld")
    if (existingJsonLd) existingJsonLd.remove()

    if (type === "article" && title) {
      const jsonLd = document.createElement("script")
      jsonLd.id = "seo-jsonld"
      jsonLd.type = "application/ld+json"
      jsonLd.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: title,
        description: description || "",
        image: image ? [image] : undefined,
        datePublished: publishedTime,
        author: author ? { "@type": "Person", name: author } : undefined,
        publisher: {
          "@type": "Organization",
          name: "usacricketers",
        },
        url: currentUrl,
      })
      document.head.appendChild(jsonLd)
    } else if (type === "website" && title) {
      const jsonLd = document.createElement("script")
      jsonLd.id = "seo-jsonld"
      jsonLd.type = "application/ld+json"
      jsonLd.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: title,
        description: description || "",
        url: currentUrl,
      })
      document.head.appendChild(jsonLd)
    }
  }, [title, description, image, url, type, publishedTime, author, keywords])

  return null
}
