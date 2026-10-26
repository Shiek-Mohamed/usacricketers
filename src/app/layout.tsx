import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
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
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}

/** Client component that registers the service worker for PWA offline
 *  support. Only runs in production (dev mode skips SW registration because
 *  the dev server's HMR conflicts with the SW cache). */
function ServiceWorkerRegister() {
  if (typeof window === "undefined") return null;
  if (process.env.NODE_ENV !== "production") return null;
  if (!("serviceWorker" in navigator)) return null;
  // Defer registration to after page load so it doesn't compete with
  // critical rendering.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => { /* silent — PWA is a progressive enhancement */ })
  })
  return null
}
