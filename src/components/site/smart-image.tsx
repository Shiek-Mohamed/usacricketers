"use client"

import { useState } from "react"
import Image, { type ImageProps } from "next/image"
import { cn } from "@/lib/utils"

/**
 * SmartImage — next/image wrapper with a graceful broken-image fallback.
 *
 * Why this exists:
 *   next/image throws (or renders nothing) when an external image URL is
 *   broken, returns a 404, or the optimizer can't fetch it. For content
 *   sites that scrape images from external sources (e.g. article hero
 *   images from a legacy WordPress site), this happens often enough that
 *   a raw next/image leaves empty boxes on the page.
 *
 *   SmartImage wraps next/image and, on error, calls `onFallback` so the
 *   parent can swap in an icon/placeholder. If no fallback is provided,
 *   it hides itself (the parent's bg-muted shows through).
 *
 *   For external URLs (http:// or https://), SmartImage renders a plain
 *   `<img>` tag instead of next/image. This bypasses Next.js's strict
 *   remotePatterns host validation, which would otherwise throw a
 *   render-time error ("Invalid src prop / next-image-unconfigured-host")
 *   and crash the surrounding section via the error boundary. Local
 *   uploads (paths starting with `/`) still go through next/image and
 *   benefit from optimization.
 *
 * Usage:
 *   <SmartImage
 *     src={article.imageUrl}
 *     alt={article.title}
 *     fill
 *     sizes="(max-width: 768px) 100vw, 33vw"
 *     className="object-cover group-hover:scale-105"
 *   />
 *   // on error → renders null, parent's bg-muted + icon shows
 */

type SmartImageProps = Omit<ImageProps, "onError" | "alt"> & {
  /** Required alt text — destructured explicitly so jsx-a11y/alt-text sees it. */
  alt: string
  /** Called when the image fails to load. Parent can swap in a fallback. */
  onFallback?: () => void
}

/** Returns true if the src is an absolute external URL. */
function isExternalSrc(src: ImageProps["src"]): boolean {
  if (typeof src !== "string") return false
  return src.startsWith("http://") || src.startsWith("https://")
}

export function SmartImage({
  className,
  onFallback,
  alt,
  src,
  fill,
  ...props
}: SmartImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) return null

  // External URLs bypass next/image's host validation — render as a plain
  // <img>. The fill/sizes/width/height props from next/image don't apply
  // here; the parent is expected to size the <img> via className.
  if (isExternalSrc(src)) {
    return (
      <img
        src={src as string}
        alt={alt}
        className={cn(fill ? "absolute inset-0 h-full w-full" : "", className)}
        style={fill ? { objectFit: "cover" } : undefined}
        onError={() => {
          setFailed(true)
          onFallback?.()
        }}
      />
    )
  }

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      fill={fill}
      className={cn(className)}
      onError={() => {
        setFailed(true)
        onFallback?.()
      }}
    />
  )
}
