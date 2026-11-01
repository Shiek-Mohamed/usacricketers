"use client"

import { cn } from "@/lib/utils"
import type { Team } from "@/lib/types"

export function TeamBadge({
  team,
  size = "md",
  className,
}: {
  team: Pick<Team, "shortName" | "primaryColor" | "accentColor">
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  const sizes = {
    sm: "w-6 h-6 text-[9px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
    xl: "w-20 h-20 text-xl",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-extrabold text-white shrink-0 shadow-sm ring-2",
        sizes[size],
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${team.primaryColor} 0%, ${team.primaryColor}cc 100%)`,
        // @ts-expect-error css var
        "--tw-ring-color": team.accentColor,
      }}
    >
      {team.shortName.slice(0, 3)}
    </span>
  )
}

export function TeamBadgeByName({
  shortName,
  primaryColor = "#1e3a8a",
  accentColor = "#f59e0b",
  size = "md",
  className,
}: {
  shortName: string
  primaryColor?: string
  accentColor?: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  return (
    <TeamBadge
      team={{ shortName, primaryColor, accentColor }}
      size={size}
      className={className}
    />
  )
}

export function PlayerAvatar({
  name,
  team,
  imageUrl,
  size = "md",
  className,
}: {
  name: string
  team?: Pick<Team, "shortName" | "primaryColor" | "accentColor">
  imageUrl?: string | null
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  const sizes = {
    sm: "w-9 h-9 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-base",
    xl: "w-24 h-24 text-2xl",
  }
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-bold text-white shrink-0 overflow-hidden",
        sizes[size],
        className
      )}
      style={{
        background: team
          ? `linear-gradient(135deg, ${team.primaryColor}, ${team.accentColor})`
          : "linear-gradient(135deg, #475569, #94a3b8)",
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        initials
      )}
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    live: "bg-red-100 text-red-700 border-red-300",
    upcoming: "bg-amber-100 text-amber-700 border-amber-300",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
    ongoing: "bg-emerald-100 text-emerald-700 border-emerald-300",
    abandoned: "bg-zinc-100 text-zinc-600 border-zinc-300",
  }
  const label =
    status === "live" ? "LIVE" : status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide",
        map[status] || "bg-zinc-100 text-zinc-600 border-zinc-300"
      )}
    >
      {status === "live" && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
      )}
      {label}
    </span>
  )
}

export function FormatPill({ format }: { format: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary text-primary-foreground">
      {format}
    </span>
  )
}

export function timeAgo(iso: string) {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Absolute date for archives/research: "Mar 10, 2025" */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatMatchDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatMatchTime(iso: string) {
  const date = new Date(iso)
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}
