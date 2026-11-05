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

export function SmartImage({
  className,
  onFallback,
  alt,
  ...props
}: SmartImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) return null

  return (
    <Image
      {...props}
      alt={alt}
      className={cn(className)}
      onError={() => {
        setFailed(true)
        onFallback?.()
      }}
    />
  )
}
