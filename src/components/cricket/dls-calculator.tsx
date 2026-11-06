"use client"

import { useState } from "react"
import { calculateDLS, type DLSResult } from "@/lib/dls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { CloudRain, Calculator, ArrowRight, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

export function DLSCalculator() {
  // Team 1 inputs
  const [t1Runs, setT1Runs] = useState("245")
  const [t1Overs, setT1Overs] = useState("50")
  const [t1Wickets, setT1Wickets] = useState("10")

  // Team 2 inputs
  const [t2Runs, setT2Runs] = useState("120")
  const [t2OversFaced, setT2OversFaced] = useState("25")
  const [t2Wickets, setT2Wickets] = useState("3")

  // Match format
  const [totalOvers, setTotalOvers] = useState("50")
  const [revisedOvers, setRevisedOvers] = useState("35")

  // Result
  const [result, setResult] = useState<DLSResult | null>(null)
  const [error, setError] = useState("")

  function handleCalculate() {
    setError("")
    try {
      const r = calculateDLS(
        Number(t1Runs), Number(t1Overs), Number(t1Wickets),
        Number(t2Runs), Number(t2OversFaced), Number(t2Wickets),
        Number(totalOvers), Number(revisedOvers),
      )
      setResult(r)
    } catch (e) {
      setError(String(e).slice(0, 100))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CloudRain className="h-6 w-6 text-sky-500" />
        <h1 className="font-display text-2xl font-black uppercase tracking-tight sm:text-3xl">
          DLS Calculator
        </h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Duckworth-Lewis-Stern method — recalculates targets when rain interrupts play.
        Enter the match situation below and click Calculate.
      </p>

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Team 1 (first innings) */}
        <Card className="p-4">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-[#1e2a5e]">
            Team 1 — First Innings
          </h3>
          <div className="space-y-2">
            <Field label="Runs scored" value={t1Runs} onChange={setT1Runs} placeholder="245" />
            <Field label="Overs faced" value={t1Overs} onChange={setT1Overs} placeholder="50" />
            <Field label="Wickets lost" value={t1Wickets} onChange={setT1Wickets} placeholder="10" />
          </div>
        </Card>

        {/* Team 2 (second innings, interrupted) */}
        <Card className="p-4">
          <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-[#1e2a5e]">
            Team 2 — Second Innings (at interruption)
          </h3>
          <div className="space-y-2">
            <Field label="Runs scored" value={t2Runs} onChange={setT2Runs} placeholder="120" />
            <Field label="Overs faced" value={t2OversFaced} onChange={setT2OversFaced} placeholder="25" />
            <Field label="Wickets lost" value={t2Wickets} onChange={setT2Wickets} placeholder="3" />
          </div>
        </Card>
      </div>

      {/* Match format + revised overs */}
      <Card className="p-4">
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-amber-600">
          <CloudRain className="mr-1 inline h-4 w-4" />
          Rain Interruption
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total overs per innings" value={totalOvers} onChange={setTotalOvers} placeholder="50" />
          <Field label="Revised overs (after rain)" value={revisedOvers} onChange={setRevisedOvers} placeholder="35" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          If the match was originally 50 overs but rain reduced it to 35, enter 35 here.
        </p>
      </Card>

      {/* Calculate button */}
      <Button
        onClick={handleCalculate}
        className="w-full gap-2 bg-[#1e2a5e] text-white hover:bg-[#283672]"
        size="lg"
      >
        <Calculator className="h-5 w-5" />
        Calculate DLS Target
      </Button>

      {error && <p className="text-center text-sm font-medium text-red-600">{error}</p>}

      {/* Result */}
      {result && (
        <Card className="overflow-hidden p-0">
          {/* Big target display */}
          <div className="bg-gradient-to-r from-[#1e2a5e] to-[#2d3b7a] px-6 py-5 text-center text-white">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-white/60">
              Revised Target (Team 2)
            </p>
            <p className="mt-1 font-display text-5xl font-black tabular-nums">
              {result.revisedTarget}
            </p>
            <p className="mt-1 text-sm text-white/60">
              from {revisedOvers} overs · original target was {result.originalTarget}
            </p>
          </div>

          {/* Detailed breakdown */}
          <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-4">
            <StatBox label="Team 1 Resources" value={`${result.team1Resources}%`} />
            <StatBox label="Team 2 Resources" value={`${result.team2Resources}%`} />
            <StatBox label="Resources Lost" value={`${result.resourcesLost}%`} highlight={result.resourcesLost > 0} />
            <StatBox label="Required RR" value={result.requiredRunRate.toFixed(2)} />
          </div>

          {/* Par score + explanation */}
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Par score at interruption:</span>
              <span className="font-display font-bold tabular-nums">{result.parScore}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Runs needed now:</span>
              <span className="font-display font-bold tabular-nums">
                {result.revisedTarget - Number(t2Runs)} from {Number(revisedOvers) - Number(t2OversFaced)} overs
              </span>
            </div>
            <div className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              {Number(t2Runs) > result.parScore
                ? `Team 2 is ${Number(t2Runs) - result.parScore} runs ahead of DLS par`
                : Number(t2Runs) < result.parScore
                  ? `Team 2 is ${result.parScore - Number(t2Runs)} runs behind DLS par`
                  : "Team 2 is exactly at DLS par score"}
            </div>
            <p className="border-t border-gray-100 pt-2 text-[11px] text-muted-foreground/70">
              Method: {result.method} · G50 = {result.g50}
            </p>
          </div>
        </Card>
      )}

      {/* Info note */}
      <p className="text-center text-xs text-muted-foreground">
        Uses the DLS Standard Edition (publicly available). For professional matches,
        an ICC-licensed Professional Edition may be required.
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-0.5 block font-display text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm tabular-nums"
      />
    </div>
  )
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={cn("bg-white px-3 py-2 text-center", highlight && "bg-amber-50/50")}>
      <div className="font-display text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn("font-display text-base font-black tabular-nums", highlight && "text-amber-600")}>
        {value}
      </div>
    </div>
  )
}
