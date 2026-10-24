"use client"

import { useCallback, useEffect, useState } from "react"
import { api } from "./api"
import type { Article, Banner, Gallery, Match, PaginatedArticles, Player, Series, SidebarBlock, Team, Video } from "./types"

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [nonce, setNonce] = useState(0)
  const [doneNonce, setDoneNonce] = useState(-1)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  // loading is derived: a request is in-flight when its nonce hasn't completed yet
  const loading = nonce !== doneNonce

  const refetch = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    fn()
      .then((d) => {
        if (!active) return
        setData(d)
        setError(null)
        setDoneNonce(nonce)
      })
      .catch((e) => {
        if (!active) return
        setError(e?.message || "Failed to load")
        setDoneNonce(nonce)
      })
    return () => {
      active = false
    }
  }, [...deps, nonce])

  return { data, loading, error, refetch }
}

export const useTeams = () => useFetch<Team[]>(() => api.teams.list())
export const useTeam = (id: string | null) =>
  useFetch<Team>(() => (id ? api.teams.get(id) : Promise.reject()), [id])
export const usePlayers = (teamId?: string) =>
  useFetch<Player[]>(() => api.players.list(teamId), [teamId])
export const usePlayer = (id: string | null) =>
  useFetch<Player>(() => (id ? api.players.get(id) : Promise.reject()), [id])
export const useMatches = (status?: string) =>
  useFetch<Match[]>(() => api.matches.list(status), [status])
export const useMatch = (id: string | null) =>
  useFetch<Match>(() => (id ? api.matches.get(id) : Promise.reject()), [id])
export const useSeries = () => useFetch<Series[]>(() => api.series.list())
export const useSeriesItem = (id: string | null) =>
  useFetch<Series>(() => (id ? api.series.get(id) : Promise.reject()), [id])
export const useArticles = (params?: {
  category?: string
  featured?: boolean
  page?: number
  pageSize?: number
  q?: string
}) =>
  useFetch<PaginatedArticles>(() => api.articles.list(params), [
    params?.category,
    params?.featured,
    params?.page,
    params?.pageSize,
    params?.q,
  ])
export const useArticle = (id: string | null) =>
  useFetch<Article>(() => (id ? api.articles.get(id) : Promise.reject()), [id])
export const useSidebarBlocks = (placement?: string, drafts = false) =>
  useFetch<SidebarBlock[]>(
    () => api.sidebarBlocks.list(placement, drafts),
    [placement, drafts]
  )
export const useGalleries = () => useFetch<Gallery[]>(() => api.galleries.list())
export const useGallery = (id: string | null) =>
  useFetch<Gallery>(() => (id ? api.galleries.get(id) : Promise.reject()), [id])
export const useVideos = (params?: { category?: string; featured?: boolean; limit?: number; drafts?: boolean }) =>
  useFetch<Video[]>(() => api.videos.list(params), [params?.category, params?.featured, params?.limit, params?.drafts])
export const useVideo = (id: string | null) =>
  useFetch<Video>(() => (id ? api.videos.get(id) : Promise.reject()), [id])

// Combined: matches + teams + players for cross-entity stats dashboards
export function useAllData() {
  const matches = useMatches()
  const teams = useTeams()
  const players = usePlayers()
  const series = useSeries()
  const articles = useArticles()
  return { matches, teams, players, series, articles }
}

// Banners — admin view fetches ALL (drafts + expired), public slots fetch by
// placement (the BannerSlot component calls api.banners.list directly).
export const useBannersAll = () => useFetch<Banner[]>(() => api.banners.listAll())
