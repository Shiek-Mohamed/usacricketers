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
      // Push the view to the browser URL + history so the back/forward
      // buttons work. Uses ?view=X&id=Y query params (the app already
      // supports this format for deep links like reset-password).
      const url = new URL(window.location.href)
      if (view === "home" && !id) {
        url.searchParams.delete("view")
        url.searchParams.delete("id")
      } else {
        url.searchParams.set("view", view)
        if (id) url.searchParams.set("id", id)
        else url.searchParams.delete("id")
      }
      window.history.pushState({ view, id }, "", url)
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
  enterScorerLanding: () => set({ mode: "scorer", view: "scorer-landing", id: null }),
  exitScorerMode: () => set({ mode: "public", view: "home", id: null }),
  enterLeagueAdminLogin: () => set({ mode: "leagueAdmin", view: "league-admin-login", id: null }),
  enterLeagueAdminMode: () => set({ mode: "leagueAdmin", view: "league-admin-home", id: null }),
  exitLeagueAdminMode: () => set({ mode: "public", view: "home", id: null }),
}))

/* ----------------------- Browser history sync ----------------------- *
 * navigate() pushes a history entry with the view+id. When the user
 * presses back/forward, popstate fires and we restore the view from the
 * history state (falling back to the URL query params). Uses setState
 * directly (not navigate) so we don't push a new entry on every back press.
 * --------------------------------------------------------------------- */
if (typeof window !== "undefined") {
  window.addEventListener("popstate", (e) => {
    const state = e.state as { view?: ViewKey; id?: string | null } | null
    if (state?.view) {
      useAppStore.setState({ view: state.view, id: state.id ?? null })
    } else {
      const p = new URLSearchParams(window.location.search)
      const v = (p.get("view") || "home") as ViewKey
      const i = p.get("id")
      useAppStore.setState({ view: v, id: i })
    }
  })
}
