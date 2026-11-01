import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
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
  openGraph: {
    title: "usacricketers — Live Cricket Scores, News, Stats & Series",
    description:
      "The definitive home of USA cricket. Live scores, scorecards, news, player stats and records.",
    siteName: "usacricketers",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "usacricketers — Live Cricket Scores & News",
    description: "The definitive home of USA cricket.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
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
