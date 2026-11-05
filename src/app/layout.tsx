import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Oswald — a bold, condensed sports font used for scores, team names,
// and section headings. Gives the site a "sports broadcast" feel (ESPN
// Cricinfo style). Loaded alongside Geist (which stays for body text).
// To swap fonts later, only this import + the variable name need to change —
// components use the generic `font-display` Tailwind class.
const displayFont = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  // metadataBase tells Next.js the canonical origin to use when resolving
  // relative URLs in metadata (og:image, twitter:image, canonical, etc.).
  // Without it, Next.js falls back to the request's origin — which in dev
  // is http://localhost:3000, producing broken og:image URLs in production.
  // Falls back to the env var if set (for future domain changes), otherwise
  // the known production URL.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://usacricketers.fly.dev",
  ),
  title: "usacricketers — Live Cricket Scores, News, Stats & Series",
  description:
    "The definitive home of USA cricket. Live scores, match scorecards, news, series, team & player stats, schedules and records — all in one place.",
  keywords: [
    "cricket",
    "live cricket scores",
    "cricket news",
    "usacricketers",
    "ICC rankings",
    "cricket stats",
    "scorecard",
    "series",
  ],
  authors: [{ name: "USACricketers" }],
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  // Default social-share image. Every page now has an og:image — article
  // pages override this with their own hero image via generateMetadata.
  // Without this, links shared on Twitter/WhatsApp/iMessage showed a
  // text-only preview with no image (bad for click-through on a news site).
  openGraph: {
    title: "usacricketers — Live Cricket Scores, News, Stats & Series",
    description:
      "The definitive home of USA cricket. Live scores, scorecards, news, player stats and records.",
    siteName: "usacricketers",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1344,
        height: 768,
        alt: "usacricketers — USA cricket live scores, news and stats",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "usacricketers — Live Cricket Scores & News",
    description: "The definitive home of USA cricket.",
    images: ["/og-default.png"],
  },
};

// WebSite structured data — rendered server-side in the root layout so
// Google sees it on EVERY page (including the SPA homepage, which can't
// use generateMetadata because it's a client component). Tells Google
// this is a website with a search action, enabling sitelinks search box
// + richer homepage indexing.
const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "usacricketers",
  url: "https://usacricketers.fly.dev",
  description:
    "The definitive home of USA cricket. Live scores, match scorecards, news, series, team & player stats, schedules and records.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://usacricketers.fly.dev/?view=search",
    },
    "query-input": "required name=search_term_string",
  },
};

// Next.js 13+ moved themeColor + viewport to a dedicated `viewport` export.
// See: https://nextjs.org/docs/app/api-reference/functions/generateViewport
export const viewport: Viewport = {
  themeColor: "#1e2a5e",
  width: "device-width",
  initialScale: 1,
};

// Inline service-worker registration script. Defers to `window.load` so it
// never blocks first paint. The production-only gate is handled at React
// render time (see conditional `<Script>` below) — webpack inlines
// `process.env.NODE_ENV` for component code but NOT for inline-script
// strings, so the check must live in JSX, not in this template literal.
const SW_REGISTER_SCRIPT = `
(function () {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {/* WebSite JSON-LD — server-rendered so Google sees it on every
              page including the SPA homepage. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
          />
          {children}
          <Toaster />
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && (
          <Script
            id="sw-register"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: SW_REGISTER_SCRIPT }}
          />
        )}
      </body>
    </html>
  );
}
