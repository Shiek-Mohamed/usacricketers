import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // next/image optimization — allows the Next.js image optimizer to fetch
  // + transform images served from these origins. Without this, next/image
  // throws for any src that isn't a local /public path.
  //
  // The article scraper pulls hero images from usacricketers.com (the
  // legacy WordPress site). The local /api/uploads/... URLs don't need
  // to be listed here (same-origin). usacricketers.fly.dev is listed so
  // og:image + cross-page references resolve through the optimizer.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "usacricketers.com" },
      { protocol: "https", hostname: "www.usacricketers.com" },
      { protocol: "https", hostname: "usacricketers.fly.dev" },
      // ZAI image-search OSS host — used by article hero images assigned
      // by the fix-article-images script.
      { protocol: "https", hostname: "z-cdn.chatglm.cn" },
      { protocol: "https", hostname: "sfile.chatglm.cn" },
    ],
    // Modern formats — WebP for broad support, AVIF for browsers that
    // accept it (Chrome, Firefox 113+, Safari 16+).
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
