"use client"

import type { Article, Banner, Gallery, Match, PaginatedArticles, Player, Series, SidebarBlock, Team, Video } from "./types"

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

/** Read the CSRF token from the non-httpOnly cookie and attach it as
 *  `X-CSRF-Token` header. Required for all POST/PUT/DELETE calls to
 *  admin-guarded routes. No-op if no CSRF cookie is set (e.g. public
 *  endpoints or pre-login state). */
function withCSRF(init: RequestInit): RequestInit {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|; )csrf-token=([^;]+)/)
    if (match) {
      const headers = new Headers(init.headers)
      headers.set("X-CSRF-Token", match[1])
      return { ...init, headers }
    }
  }
  return init
}

/** POST/PUT/DELETE helper — wraps fetch with the CSRF header + JSON
 *  content-type. Usage: `postJSON("/api/teams", data)` or
 *  `putJSON("/api/teams/123", data)` or `delJSON("/api/teams/123")`. */
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  return jsonOrThrow<T>(fetch(url, withCSRF({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })))
}
async function putJSON<T>(url: string, body: unknown): Promise<T> {
  return jsonOrThrow<T>(fetch(url, withCSRF({
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })))
}
async function delJSON<T>(url: string): Promise<T> {
  return jsonOrThrow<T>(fetch(url, withCSRF({ method: "DELETE" })))
}

export const api = {
  teams: {
    list: () => fetch("/api/teams").then(jsonOrThrow<Team[]>),
    get: (id: string) => fetch(`/api/teams/${id}`).then(jsonOrThrow<Team>),
    create: (data: Partial<Team>) =>
      postJSON<Team>("/api/teams", data),
    update: (id: string, data: Partial<Team>) =>
      putJSON<Team>(`/api/teams/${id}`, data),
    remove: (id: string) =>
      delJSON(`/api/teams/${id}`),
  },
  players: {
    list: (teamId?: string) =>
      fetch(`/api/players${teamId ? `?teamId=${teamId}` : ""}`).then(
        jsonOrThrow<Player[]>
      ),
    get: (id: string) => fetch(`/api/players/${id}`).then(jsonOrThrow<Player>),
    create: (data: Partial<Player> & { teamId: string }) =>
      postJSON<Player>("/api/players", data),
    update: (id: string, data: Partial<Player>) =>
      putJSON<Player>(`/api/players/${id}`, data),
    remove: (id: string) =>
      delJSON(`/api/players/${id}`),
    bulkCreate: async (
      teamId: string,
      players: Array<{
        name: string
        role?: string
        isCaptain?: boolean
        isKeeper?: boolean
        battingStyle?: string
        bowlingStyle?: string
        bio?: string
        imageUrl?: string
      }>
    ): Promise<{
      created: number
      skipped: number
      skippedNames: string[]
      players: Player[]
    }> => {
      return postJSON("/api/players/bulk", { teamId, players })
    },
  },
  matches: {
    list: (status?: string) =>
      fetch(`/api/matches${status ? `?status=${status}` : ""}`).then(
        jsonOrThrow<Match[]>
      ),
    get: (id: string) => fetch(`/api/matches/${id}`).then(jsonOrThrow<Match>),
    create: (data: Partial<Match>) =>
      postJSON<Match>("/api/matches", data),
    update: (id: string, data: Partial<Match>) =>
      putJSON<Match>(`/api/matches/${id}`, data),
    remove: (id: string) =>
      delJSON(`/api/matches/${id}`),
    bulkCreate: async (
      matches: Array<{
        team1Name: string
        team2Name: string
        format?: string
        matchNo?: string
        venue?: string
        city?: string
        startDate: string
      }>,
      seriesId?: string
    ): Promise<{
      created: number
      skipped: number
      skippedRows: string[]
      matches: Match[]
    }> => {
      return postJSON("/api/matches/bulk", { matches, seriesId })
    },
    /** Generate a match-preview article draft from match data. */
    generatePreview: (matchId: string) =>
      postJSON<{ id: string; title: string; slug: string; message: string }>(
        `/api/matches/${matchId}/preview`,
        {}
      ),
  },
  series: {
    list: () => fetch("/api/series").then(jsonOrThrow<Series[]>),
    get: (id: string) => fetch(`/api/series/${id}`).then(jsonOrThrow<Series>),
    create: (data: Partial<Series>) =>
      postJSON<Series>("/api/series", data),
    update: (id: string, data: Partial<Series>) =>
      putJSON<Series>(`/api/series/${id}`, data),
    remove: (id: string) =>
      delJSON(`/api/series/${id}`),
    addTeam: (seriesId: string, data: { teamId?: string; name?: string; shortName?: string; country?: string; primaryColor?: string; accentColor?: string }) =>
      postJSON<Team>(`/api/series/${seriesId}/teams`, data),
    removeTeam: (seriesId: string, teamId: string) =>
      delJSON(`/api/series/${seriesId}/teams/${teamId}`),
  },
  articles: {
    list: (params?: {
      category?: string
      featured?: boolean
      page?: number
      pageSize?: number
      q?: string
    }) => {
      const qs = new URLSearchParams()
      if (params?.category) qs.set("category", params.category)
      if (params?.featured) qs.set("featured", "true")
      if (params?.page) qs.set("page", String(params.page))
      if (params?.pageSize) qs.set("pageSize", String(params.pageSize))
      if (params?.q) qs.set("q", params.q)
      const q = qs.toString()
      return fetch(`/api/articles${q ? `?${q}` : ""}`).then(
        jsonOrThrow<PaginatedArticles>
      )
    },
    get: (id: string) => fetch(`/api/articles/${id}`).then(jsonOrThrow<Article>),
    create: (data: Partial<Article>) =>
      postJSON<Article>("/api/articles", data),
    update: (id: string, data: Partial<Article>) =>
      putJSON<Article>(`/api/articles/${id}`, data),
    remove: (id: string) =>
      delJSON(`/api/articles/${id}`),
  },
  sidebarBlocks: {
    list: (placement?: string, drafts = false) =>
      fetch(
        `/api/sidebar-blocks?${placement ? `placement=${placement}` : ""}${drafts ? `${placement ? "&" : ""}drafts=true` : ""}`
      ).then(jsonOrThrow<SidebarBlock[]>),
    get: (id: string) =>
      fetch(`/api/sidebar-blocks/${id}`).then(jsonOrThrow<SidebarBlock>),
    create: (data: Partial<SidebarBlock>) =>
      postJSON<SidebarBlock>("/api/sidebar-blocks", data),
    update: (id: string, data: Partial<SidebarBlock>) =>
      putJSON<SidebarBlock>(`/api/sidebar-blocks/${id}`, data),
    remove: (id: string) =>
      delJSON(`/api/sidebar-blocks/${id}`),
  },
  galleries: {
    list: () => fetch("/api/galleries").then(jsonOrThrow<Gallery[]>),
    get: (id: string) => fetch(`/api/galleries/${id}`).then(jsonOrThrow<Gallery>),
    create: (data: Partial<Gallery>) =>
      postJSON<Gallery>("/api/galleries", data),
    update: (id: string, data: Partial<Gallery>) =>
      putJSON<Gallery>(`/api/galleries/${id}`, data),
    remove: (id: string) =>
      delJSON(`/api/galleries/${id}`),
  },
  videos: {
    list: (params?: { category?: string; featured?: boolean; limit?: number; drafts?: boolean }) => {
      const qs = new URLSearchParams()
      if (params?.category) qs.set("category", params.category)
      if (params?.featured) qs.set("featured", "true")
      if (params?.limit) qs.set("limit", String(params.limit))
      if (params?.drafts) qs.set("drafts", "true")
      const q = qs.toString()
      return fetch(`/api/videos${q ? `?${q}` : ""}`).then(jsonOrThrow<Video[]>)
    },
    get: (id: string) => fetch(`/api/videos/${id}`).then(jsonOrThrow<Video>),
    create: (data: Partial<Video>) =>
      postJSON<Video>("/api/videos", data),
    update: (id: string, data: Partial<Video>) =>
      putJSON<Video>(`/api/videos/${id}`, data),
    remove: (id: string) =>
      delJSON(`/api/videos/${id}`),
  },
  banners: {
    /** Fetch all active banners for a given placement slot. Public endpoint,
     *  CDN-cached. Returns ALL active banners (filtered by date+published);
     *  the client picks one + rotates as needed. */
    list: (placement: string) =>
      fetch(`/api/banners?placement=${encodeURIComponent(placement)}`).then(
        jsonOrThrow<Banner[]>
      ),
    /** Admin-only: fetch all banners (including drafts + expired) for the
     *  admin table view. */
    listAll: () => fetch("/api/banners?all=1").then(jsonOrThrow<Banner[]>),
    get: (id: string) => fetch(`/api/banners/${id}`).then(jsonOrThrow<Banner>),
    create: (data: Partial<Banner>) =>
      postJSON<Banner>("/api/banners", data),
    update: (id: string, data: Partial<Banner>) =>
      putJSON<Banner>(`/api/banners/${id}`, data),
    remove: (id: string) =>
      delJSON(`/api/banners/${id}`),
    /** Fire-and-forget impression ping — called from the client when a banner
     *  scrolls into view. */
    trackImpression: (id: string) =>
      fetch(`/api/banners/${id}/impression`, withCSRF({ method: "POST" })).catch(() => {}),
    /** Banner click-through URL — image/html banners link here, the endpoint
     *  increments the click counter then 302-redirects to banner.linkUrl.
     *  Direct navigation (no fetch). */
    clickUrl: (id: string) => `/api/banners/${id}/click`,
  },
}
