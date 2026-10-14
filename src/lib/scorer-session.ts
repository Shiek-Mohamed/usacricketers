"use client"

import { create } from "zustand"
import type { ScorerSession } from "./types"

interface ScorerSessionState {
  session: ScorerSession | null
  setSession: (s: ScorerSession | null) => void
  clear: () => void
  hydrated: boolean
  setHydrated: (v: boolean) => void
}

const KEY = "scorer-session-v1"

export const useScorerSession = create<ScorerSessionState>((set) => ({
  session: null,
  hydrated: false,
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
  setHydrated: (v) => set({ hydrated: v }),
}))

// Hydrate from localStorage on module load (client only)
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) useScorerSession.setState({ session: JSON.parse(raw) })
  } catch {
    // ignore malformed storage
  }
  useScorerSession.setState({ hydrated: true })
}
