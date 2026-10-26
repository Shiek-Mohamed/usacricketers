/**
 * Service Worker — USACricketers PWA
 *
 * Strategy:
 *   • App shell (HTML/CSS/JS/images) → cache-first (instant load offline).
 *   • API calls → network-first (always fresh when online, cache fallback
 *     when offline).
 *   • Static assets (logos, photos) → cache-first with background update.
 *
 * The SW only runs in production — layout.tsx skips registration in dev
 * mode to avoid HMR conflicts.
 */

const CACHE_VERSION = "usacric-v1"
const SHELL_CACHE = `${CACHE_VERSION}-shell`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`
const SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/logo.svg",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Don't intercept non-GET requests (POST/PUT/DELETE go straight to network).
  if (request.method !== "GET") return

  // Don't intercept WebSocket connections (socket.io for live scoring).
  if (request.headers.get("upgrade") === "websocket") return

  // API calls → network-first, fall back to cache when offline.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses for offline fallback.
          if (response.ok) {
            const clone = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response("Offline", { status: 503 })))
    )
    return
  }

  // Same-origin static assets → cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Return cached immediately + fetch fresh in background.
          fetch(request)
            .then((response) => {
              if (response.ok) {
                const clone = response.clone()
                caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone))
              }
            })
            .catch(() => {})
          return cached
        }
        // Not in cache → fetch from network, cache on success.
        return fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Cross-origin (CDN images, Google Fonts, etc.) → stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => cached)
      return cached || fetchPromise
    })
  )
})

// Push notification handler — when the score-service sends a push (e.g. a
// wicket fell), show a notification. The score-service needs the VAPID keys
// + push subscription endpoint (future enhancement — the subscription is
// captured client-side and sent to a /api/push/subscribe endpoint).
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "USACricketers", body: event.data?.text() || "" }
  }
  const title = data.title || "USACricketers"
  const options = {
    body: data.body || "",
    icon: "/logo.svg",
    badge: "/logo.svg",
    data: data.url ? { url: data.url } : {},
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click — open the URL if provided.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url
  if (url) {
    event.waitUntil(clients.openWindow(url))
  }
})
