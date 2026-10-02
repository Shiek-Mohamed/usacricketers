"use client"

import type { Article, Match, Player, Series, Team } from "./types"

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return (await res.json()) as T
}

export const api = {
  teams: {
    list: () => fetch("/api/teams").then(jsonOrThrow<Team[]>),
    get: (id: string) => fetch(`/api/teams/${id}`).then(jsonOrThrow<Team>),
    create: (data: Partial<Team>) =>
      fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Team>),
    update: (id: string, data: Partial<Team>) =>
      fetch(`/api/teams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Team>),
    remove: (id: string) =>
      fetch(`/api/teams/${id}`, { method: "DELETE" }).then(jsonOrThrow),
  },
  players: {
    list: (teamId?: string) =>
      fetch(`/api/players${teamId ? `?teamId=${teamId}` : ""}`).then(
        jsonOrThrow<Player[]>
      ),
    get: (id: string) => fetch(`/api/players/${id}`).then(jsonOrThrow<Player>),
    create: (data: Partial<Player> & { teamId: string }) =>
      fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Player>),
    update: (id: string, data: Partial<Player>) =>
      fetch(`/api/players/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Player>),
    remove: (id: string) =>
      fetch(`/api/players/${id}`, { method: "DELETE" }).then(jsonOrThrow),
  },
  matches: {
    list: (status?: string) =>
      fetch(`/api/matches${status ? `?status=${status}` : ""}`).then(
        jsonOrThrow<Match[]>
      ),
    get: (id: string) => fetch(`/api/matches/${id}`).then(jsonOrThrow<Match>),
    create: (data: Partial<Match>) =>
      fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Match>),
    update: (id: string, data: Partial<Match>) =>
      fetch(`/api/matches/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Match>),
    remove: (id: string) =>
      fetch(`/api/matches/${id}`, { method: "DELETE" }).then(jsonOrThrow),
  },
  series: {
    list: () => fetch("/api/series").then(jsonOrThrow<Series[]>),
    get: (id: string) => fetch(`/api/series/${id}`).then(jsonOrThrow<Series>),
    create: (data: Partial<Series>) =>
      fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Series>),
    update: (id: string, data: Partial<Series>) =>
      fetch(`/api/series/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Series>),
    remove: (id: string) =>
      fetch(`/api/series/${id}`, { method: "DELETE" }).then(jsonOrThrow),
  },
  articles: {
    list: (params?: { category?: string; featured?: boolean }) => {
      const qs = new URLSearchParams()
      if (params?.category) qs.set("category", params.category)
      if (params?.featured) qs.set("featured", "true")
      const q = qs.toString()
      return fetch(`/api/articles${q ? `?${q}` : ""}`).then(
        jsonOrThrow<Article[]>
      )
    },
    get: (id: string) => fetch(`/api/articles/${id}`).then(jsonOrThrow<Article>),
    create: (data: Partial<Article>) =>
      fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Article>),
    update: (id: string, data: Partial<Article>) =>
      fetch(`/api/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(jsonOrThrow<Article>),
    remove: (id: string) =>
      fetch(`/api/articles/${id}`, { method: "DELETE" }).then(jsonOrThrow),
  },
}
