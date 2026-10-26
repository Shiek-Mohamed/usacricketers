"use client"

import { useEffect, useState } from "react"

interface EmbedData {
  match: {
    id: string
    format: string
    matchNo: string
    status: string
    result: string
    venue: string
    team1: { name: string; shortName: string; primaryColor: string } | null
    team2: { name: string; shortName: string; primaryColor: string } | null
    series: { name: string; shortName: string } | null
    currentScore: { batting: string; score: string; overs: string } | null
  }
  lastUpdated: string
}

/**
 * /embed/match/[id] — embeddable live-score widget.
 *
 * Partner sites embed this as an iframe:
 *   <iframe src="https://usacricketers.com/embed/match/abc123"
 *           width="320" height="160" frameborder="0"
 *           style="border-radius:8px; border:1px solid #e2e8f0;">
 *   </iframe>
 *
 * The widget polls the JSON API every 10 seconds for live matches (no
 * WebSocket needed — polling is fine for embed viewers). For completed
 * matches, it renders the final result and stops polling.
 */
export default function EmbedMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const [matchId, setMatchId] = useState<string>("")
  const [data, setData] = useState<EmbedData | null>(null)

  useEffect(() => {
    params.then((p) => setMatchId(p.id))
  }, [params])

  useEffect(() => {
    if (!matchId) return
    let active = true

    async function poll() {
      try {
        const res = await fetch(`/api/embed/match/${matchId}`)
        if (!res.ok) return
        const json = await res.json()
        if (active && json.match) setData(json)
      } catch { /* silent */ }
    }

    poll()
    // Poll every 10s for live matches, 60s for completed.
    const isLive = data?.match?.status === "live"
    const interval = setInterval(poll, isLive ? 10_000 : 60_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [matchId, data?.match?.status])

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1e2a5e] text-white">
        <div className="animate-pulse text-sm">Loading…</div>
      </div>
    )
  }

  const m = data.match
  const isLive = m.status === "live"
  const t1 = m.team1
  const t2 = m.team2

  return (
    <div className="flex h-screen flex-col justify-between bg-[#1e2a5e] p-3 text-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/60">
          {m.format} · {m.series?.shortName ?? ""}
        </span>
        {isLive ? (
          <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold uppercase">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        ) : m.status === "completed" ? (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase">
            Final
          </span>
        ) : (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase">
            {m.status}
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div className="flex flex-col gap-2 py-2">
        {t1 && (
          <TeamRow
            name={t1.shortName}
            color={t1.primaryColor}
            score={m.currentScore?.batting === t1.shortName ? m.currentScore.score : null}
            overs={m.currentScore?.batting === t1.shortName ? m.currentScore.overs : null}
          />
        )}
        {t2 && (
          <TeamRow
            name={t2.shortName}
            color={t2.primaryColor}
            score={m.currentScore?.batting === t2.shortName ? m.currentScore.score : null}
            overs={m.currentScore?.batting === t2.shortName ? m.currentScore.overs : null}
          />
        )}
      </div>

      {/* Footer */}
      <div className="text-center">
        {m.result ? (
          <p className="text-[11px] font-semibold text-emerald-400">{m.result}</p>
        ) : m.venue ? (
          <p className="text-[10px] text-white/50">{m.venue}</p>
        ) : null}
        <p className="mt-1 text-[8px] text-white/30">
          Powered by{" "}
          <a
            href={`/?view=match-detail&id=${m.id}`}
            target="_blank"
            rel="noopener"
            className="underline hover:text-white/60"
          >
            usacricketers.com
          </a>
        </p>
      </div>
    </div>
  )
}

function TeamRow({
  name,
  color,
  score,
  overs,
}: {
  name: string
  color: string
  score: string | null
  overs: string | null
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-1.5">
      <div className="flex items-center gap-2">
        <span
          className="grid h-6 w-6 place-items-center rounded text-[9px] font-bold text-white"
          style={{ background: color }}
        >
          {name.slice(0, 2)}
        </span>
        <span className="text-sm font-bold">{name}</span>
      </div>
      <div className="text-right">
        {score ? (
          <>
            <span className="text-lg font-extrabold tabular-nums">{score}</span>
            <span className="ml-1.5 text-[10px] text-white/60">({overs})</span>
          </>
        ) : (
          <span className="text-sm text-white/40">—</span>
        )}
      </div>
    </div>
  )
}
