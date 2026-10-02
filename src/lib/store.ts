"use client"

import { create } from "zustand"
import type { ViewKey } from "./types"

interface AppState {
  view: ViewKey
  id: string | null
  mode: "public" | "admin"
  setView: (view: ViewKey, id?: string | null) => void
  navigate: (view: ViewKey, id?: string | null) => void
  toggleMode: () => void
  setMode: (mode: "public" | "admin") => void
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
    set({ mode, view: mode === "public" ? "home" : "admin-dashboard", id: null }),
}))
