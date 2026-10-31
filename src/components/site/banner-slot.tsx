"use client"

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Script from "next/script"
import { api } from "@/lib/api"
import type { Banner } from "@/lib/types"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Public component — <BannerSlot placement="..." />                          */
/*                                                                            */
/*  - ErrorBoundary: any render error inside isolates to this slot (the rest  */
/*    of the page keeps working).                                             */
/*  - Hydration-safe: SSR renders nothing, the client picks a banner after   */
/*    mount (avoids hydration mismatch from random rotation).                 */
/*  - Rotation: random weighted on mount. For placements other than          */
/*    "home-live-hero" (the AdSense slot) AND only when the current banner    */
/*    isn't an AdSense ad, time-rotates every 15s.                            */
/*  - AdSense: never time-rotates (Google TOS). Loader script deduped by      */
/*    Next.js, push call wrapped in try/catch.                                 */
/*  - Impression tracking: IntersectionObserver fire-and-forget POST.         */
/*  - Click tracking: image banners link to /api/banners/[id]/click (302      */
/*    redirect increments counter).                                            */
/* -------------------------------------------------------------------------- */

const ROTATE_INTERVAL_MS = 15_000 // 15s for non-AdSense banners
const ADSENSE_SLOT_PLACEMENT = "home-live-hero" // hardcode: this slot doesn't rotate

export function BannerSlot({
  placement,
  className,
}: {
  placement: string
  className?: string
}) {
  return (
    <BannerErrorBoundary placement={placement}>
      <BannerSlotInner placement={placement} className={className} />
    </BannerErrorBoundary>
  )
}

/* ---------------------------- Error boundary ---------------------------- */

class BannerErrorBoundary extends Component<
  { children: ReactNode; placement: string },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err: unknown) {
    // Don't crash the page — log + isolate. The slot renders nothing, the
    // rest of the homepage keeps working.
    console.error(`[BannerSlot:${this.props.placement}] render failed — isolated:`, err)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

/* ------------------------------- Inner slot ------------------------------ */

function BannerSlotInner({
  placement,
  className,
}: {
  placement: string
  className?: string
}) {
  const [banners, setBanners] = useState<Banner[] | null>(null)

  // Fetch the (CDN-cached) active banners for this placement.
  useEffect(() => {
    let cancelled = false
    api.banners
      .list(placement)
      .then((bs) => {
        if (!cancelled) setBanners(bs)
      })
      .catch(() => {
        // Network/CDN failure — render nothing (silent).
        if (!cancelled) setBanners([])
      })
    return () => {
      cancelled = true
    }
  }, [placement])

  // Loading state (SSR + before fetch resolves) or no banners configured —
  // render NOTHING (not even an empty placeholder div). This prevents the
  // min-h-[90px] empty box that created a large gap between sections when
  // no banner was configured for the placement.
  if (!banners) return null
  if (banners.length === 0) return null

  const isAdSenseSlot = placement === ADSENSE_SLOT_PLACEMENT

  return (
    <div
      className={cn("mx-auto w-full max-w-[970px] overflow-hidden", className)}
      data-banner-placement={placement}
    >
      <BannerRotator
        banners={banners}
        rotate={isAdSenseSlot ? false : true}
      />
    </div>
  )
}

/* ----------------------------- Rotation logic --------------------------- */

function pickWeightedRandom(banners: Banner[]): Banner {
  const totalWeight = banners.reduce((s, b) => s + Math.max(b.weight, 1), 0)
  let r = Math.random() * totalWeight
  for (const b of banners) {
    r -= Math.max(b.weight, 1)
    if (r <= 0) return b
  }
  return banners[banners.length - 1]
}

function BannerRotator({
  banners,
  rotate,
}: {
  banners: Banner[]
  rotate: boolean
}) {
  // Hydration-safe: SSR renders nothing; client picks after mount. The
  // parent (BannerSlotInner) only renders <BannerRotator> after the fetch
  // resolves (i.e. post-mount by definition), so we don't need a separate
  // mounted flag here.
  const [idx, setIdx] = useState<number>(() =>
    banners.length > 0 ? banners.indexOf(pickWeightedRandom(banners)) : -1
  )

  // Derived state: clamp idx into [0, banners.length-1]. When the banners
  // array changes (e.g. cache refetch), the prior idx may be out of range —
  // fall back to 0. Avoids setState-in-effect.
  const effectiveIdx =
    idx >= 0 && idx < banners.length
      ? idx
      : banners.length > 0
        ? 0
        : -1

  // Time-rotation: every N seconds, advance to the next banner — but ONLY
  // when the current banner is not AdSense (Google TOS: no aggressive ad
  // refreshing). Also gated on `rotate` prop (false for the AdSense slot).
  // The setState here is inside a setInterval callback, not the effect body
  // — the lint rule's "set-state-in-effect" check only fires on synchronous
  // setState in the effect body itself.
  useEffect(() => {
    if (!rotate || banners.length <= 1) return
    const current = banners[effectiveIdx]
    if (!current || current.type === "adsense") return
    const interval = setInterval(() => {
      setIdx((prev) => {
        const safe = prev >= 0 && prev < banners.length ? prev : 0
        return (safe + 1) % banners.length
      })
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [rotate, banners, effectiveIdx])

  if (effectiveIdx < 0) return null
  const banner = banners[effectiveIdx]
  if (!banner) return null

  // The `key={banner.id}` is critical — it forces React to unmount the old
  // banner and mount a fresh one when rotating. For AdSense specifically this
  // ensures the `(adsbygoogle = window.adsbygoogle || []).push({})` call
  // re-fires for the new <ins> element.
  return <BannerRenderer key={banner.id} banner={banner} />
}

/* ------------------------------ The renderer ---------------------------- */

function BannerRenderer({ banner }: { banner: Banner }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const impressionFiredRef = useRef(false)

  // Impression tracking: fire a single ping when the banner scrolls into
  // view (IntersectionObserver). Fire-and-forget — never blocks rendering.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !impressionFiredRef.current) {
            impressionFiredRef.current = true
            api.banners.trackImpression(banner.id)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [banner.id])

  if (!banner.published) return null

  return (
    <div ref={containerRef} className="w-full">
      <BannerContent banner={banner} />
    </div>
  )
}

function BannerContent({ banner }: { banner: Banner }) {
  switch (banner.type) {
    case "image":
      return <ImageBanner banner={banner} />
    case "adsense":
      return <AdSenseBanner banner={banner} />
    case "html":
      return <HtmlBanner banner={banner} />
    default:
      // Unknown type — bail instead of crash.
      return null
  }
}

/* ----------------------------- Banner types ----------------------------- */

function ImageBanner({ banner }: { banner: Banner }) {
  if (!banner.imageUrl) return null
  const clickUrl = api.banners.clickUrl(banner.id)
  const img = (
    // biome-ignore lint: next/image requires width/height config; for ad
    // banners of varying IAB sizes, a plain <img loading="lazy"> is simpler.
    //
    // Display the image at its natural aspect ratio, capped by the container
    // width (max-w-full) — NOT letterboxed into a fixed-height box. Banner
    // ads come in standard IAB sizes (970×90 leaderboard, 728×90 banner,
    // 300×250 medium-rectangle, etc.) and the admin should upload one sized
    // for the slot. A 970×90 banner will display at 970×90; a 300×250 will
    // display at 300×250 (smaller than the container, centered). Portrait
    // photos uploaded by mistake will render large but that's the admin's
    // responsibility — point them at the dimension hint in the admin UI.
    <img
      src={banner.imageUrl}
      alt={banner.altText || banner.title || "advertisement"}
      loading="lazy"
      className="block mx-auto h-auto max-w-full"
    />
  )
  // Open in new tab for external links; rel="sponsored noopener" tells
  // search engines this is a paid placement (good SEO practice).
  if (banner.linkUrl) {
    return (
      <a
        href={clickUrl}
        target="_blank"
        rel="sponsored noopener"
        aria-label={banner.altText || banner.title}
        className="block w-full"
      >
        {img}
      </a>
    )
  }
  return img
}

function AdSenseBanner({ banner }: { banner: Banner }) {
  // Defensive: don't render without both required fields.
  if (!banner.adsenseClient || !banner.adsenseSlot) return null

  return (
    <>
      {/* Loader script — Next.js <Script> dedupes, so multiple AdSense
          banners on a page only fetch the loader once. */}
      <Script
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${banner.adsenseClient}`}
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <AdSenseIns
        client={banner.adsenseClient}
        slot={banner.adsenseSlot}
        format={banner.adsenseFormat || "auto"}
        responsive={banner.responsive}
      />
    </>
  )
}

function AdSenseIns({
  client,
  slot,
  format,
  responsive,
}: {
  client: string
  slot: string
  format: string
  responsive: boolean
}) {
  const insRef = useRef<HTMLModElement>(null)

  // Hydration-safe + try/catch: adblock blocks the loader, the slot may
  // not be filled yet, the script may load after the <ins> mounts, etc.
  // All of these are non-fatal — the <ins> just stays empty, no crash.
  useEffect(() => {
    try {
      // The standard AdSense push pattern. Window typing on purpose — the
      // adsbygoogle global is added by the loader script.
      ;(window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle =
        (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle || []
      ;(
        (window as unknown as { adsbygoogle: Array<Record<string, unknown>> })
          .adsbygoogle
      ).push({})
    } catch (e) {
      // Don't crash — likely adblock or bad slot ID.
      console.error("[AdSense] push failed (likely adblock):", e)
    }
  }, [client, slot, format, responsive])

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  )
}

function HtmlBanner({ banner }: { banner: Banner }) {
  if (!banner.htmlContent) return null
  // NOTE: dangerouslySetInnerHTML is intentional — the admin uses this for
  // trusted partner snippets (AdSense, affiliate iframes, custom ad tags).
  // Site admins are auth-gated and the field shows a warning in the admin
  // UI. Add DOMPurify sanitization later if you don't trust your admins.
  return (
    <div
      className="w-full"
      // biome-ignore lint/security: documented intentional use for trusted admin-pasted HTML
      dangerouslySetInnerHTML={{ __html: banner.htmlContent }}
    />
  )
}

/* ---------------------------- Helper exports ---------------------------- */

/** Convenience hook for tests / other components that want to fetch the
 *  rotation pool for a placement. Returns null while loading. */
export function useBannersForPlacement(placement: string): Banner[] | null {
  const [banners, setBanners] = useState<Banner[] | null>(null)
  useEffect(() => {
    let cancelled = false
    api.banners
      .list(placement)
      .then((bs) => !cancelled && setBanners(bs))
      .catch(() => !cancelled && setBanners([]))
    return () => {
      cancelled = true
    }
  }, [placement])
  const stable = useMemo(() => banners, [banners])
  return stable
}
