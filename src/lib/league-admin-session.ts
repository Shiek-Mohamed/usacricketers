"use client"
import { create } from "zustand"
import type { LeagueAdminSession } from "./types"

interface LeagueAdminSessionState {
  session: LeagueAdminSession | null
  setSession: (s: LeagueAdminSession | null) => void
  clear: () => void
}

const KEY = "league-admin-session-v1"

export const useLeagueAdminSession = create<LeagueAdminSessionState>((set) => ({
  session: null,
  setSession: (s) => {
    set({ session: s })
    if (typeof window !== "undefined") {
      if (s) localStorage.setItem(KEY, JSON.stringify(s))
      else localStorage.removeItem(KEY)
    }
  },
  clear: () => {
    set({ session: null })
    if (typeof window !== "undefined") localStorage.removeItem(KEY)
  },
}))

// Hydrate from localStorage on module load (client only)
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) useLeagueAdminSession.setState({ session: JSON.parse(raw) })
  } catch {}
}
