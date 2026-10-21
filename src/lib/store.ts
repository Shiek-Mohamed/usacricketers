"use client"

import { create } from "zustand"
import type { ViewKey } from "./types"

type Mode = "public" | "admin" | "scorer" | "leagueAdmin"

interface AppState {
  view: ViewKey
  id: string | null
  mode: Mode
  setView: (view: ViewKey, id?: string | null) => void
  navigate: (view: ViewKey, id?: string | null) => void
  toggleMode: () => void
  setMode: (mode: Mode) => void
  enterScorerMode: () => void
  enterScorerLogin: () => void
  exitScorerMode: () => void
  enterLeagueAdminLogin: () => void
  enterLeagueAdminMode: () => void
  exitLeagueAdminMode: () => void
}

export const useAppStore = create<AppState>((set) => ({
  view: "home",
  id: null,
  mode: "public",
  setView: (view, id = null) => set({ view, id }),
  navigate: (view, id = null) => {
    set({ view, id })
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  },
  toggleMode: () =>
    set((s) => {
      const mode = s.mode === "public" ? "admin" : "public"
      const view = mode === "public" ? "home" : "admin-dashboard"
      return { mode, view, id: null }
    }),
  setMode: (mode) =>
    set({ mode, view: mode === "public" ? "home" : mode === "admin" ? "admin-dashboard" : mode === "scorer" ? "scorer-home" : "league-admin-home", id: null }),
  enterScorerMode: () => set({ mode: "scorer", view: "scorer-home", id: null }),
  enterScorerLogin: () => set({ mode: "scorer", view: "scorer-login", id: null }),
  exitScorerMode: () => set({ mode: "public", view: "home", id: null }),
  enterLeagueAdminLogin: () => set({ mode: "leagueAdmin", view: "league-admin-login", id: null }),
  enterLeagueAdminMode: () => set({ mode: "leagueAdmin", view: "league-admin-home", id: null }),
  exitLeagueAdminMode: () => set({ mode: "public", view: "home", id: null }),
}))
