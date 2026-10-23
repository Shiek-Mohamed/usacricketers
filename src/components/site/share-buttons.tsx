"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Twitter, Facebook, MessageCircle, Link2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Social share buttons — Twitter/X, Facebook, WhatsApp, copy-link.
 * Drop into any detail page. Uses window.location.href if no URL is provided.
 */
export function ShareButtons({
  title,
  url,
  className,
}: {
  title: string
  url?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "")
  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedTitle = encodeURIComponent(title)

  const links = {
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
  }

  const openShare = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=500")
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">
        Share
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => openShare(links.twitter)}
        className="h-7 w-7"
        aria-label="Share on X"
        title="Share on X"
      >
        <Twitter className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => openShare(links.facebook)}
        className="h-7 w-7"
        aria-label="Share on Facebook"
        title="Share on Facebook"
      >
        <Facebook className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => openShare(links.whatsapp)}
        className="h-7 w-7"
        aria-label="Share on WhatsApp"
        title="Share on WhatsApp"
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={copyLink}
        className="h-7 w-7"
        aria-label="Copy link"
        title="Copy link"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
      </Button>
    </div>
  )
}
