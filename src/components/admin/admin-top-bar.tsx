"use client"

import { useAppStore } from "@/lib/store"
import { ExternalLink, ShieldCheck } from "lucide-react"

/**
 * AdminTopBar — slim navy bar that replaces the public site Header for
 * admin views. Reclaims ~700px of vertical space (no marketing nav,
 * newsletter, or footer) and gives the CMS a distinct, branded context.
 */
export function AdminTopBar() {
  const navigate = useAppStore((s) => s.navigate)

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-white/10 bg-[#1e2a5e] text-white shadow-sm">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-3 px-4 sm:px-6">
        <button
          onClick={() => navigate("admin-dashboard")}
          className="flex items-center gap-2"
          aria-label="Admin dashboard"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-400 text-[#1e2a5e]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-base font-bold lowercase tracking-tight">
            usacricketers<span className="text-amber-400">.</span>
          </span>
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
            Admin
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => navigate("home")}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            View site <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  )
}
