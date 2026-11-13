"use client"

import { useAppStore } from "@/lib/store"
import { useScorerSession } from "@/lib/scorer-session"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Radio,
  Trophy,
  ArrowLeft,
  LogIn,
  Play,
  ListChecks,
  Activity,
  ChevronRight,
  Shield,
  Zap,
  FileText,
  Undo2,
  MessageSquare,
  Database,
} from "lucide-react"

const NAVY = "#1e2a5e"
const NAVY_DEEP = "#172145"
const AMBER = "#f59e0b"

export function ScorerLandingView() {
  const navigate = useAppStore((s) => s.navigate)
  const enterScorerLogin = useAppStore((s) => s.enterScorerLogin)
  const enterScorerMode = useAppStore((s) => s.enterScorerMode)
  const exitScorerMode = useAppStore((s) => s.exitScorerMode)
  const enterLeagueAdminLogin = useAppStore((s) => s.enterLeagueAdminLogin)
  const enterLeagueAdminMode = useAppStore((s) => s.enterLeagueAdminMode)
  const session = useScorerSession((s) => s.session)
  const leagueSession = useLeagueAdminSession((s) => s.session)

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${NAVY_DEEP} 0%, ${NAVY} 45%, ${NAVY_DEEP} 100%)`,
      }}
    >
      {/* Decorative radial amber glows for depth */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: AMBER }}
        />
        <div
          className="absolute top-1/3 -left-32 h-80 w-80 rounded-full opacity-10 blur-3xl"
          style={{ background: AMBER }}
        />
        <div
          className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full opacity-10 blur-3xl"
          style={{ background: AMBER }}
        />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Top bar */}
      <header className="relative z-20 flex h-14 items-center justify-between border-b border-white/10 bg-white/5 px-4 backdrop-blur-md sm:px-6">
        <button onClick={() => navigate("home")} className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-md"
            style={{ background: AMBER }}
          >
            <Radio className="h-4 w-4" style={{ color: NAVY }} />
          </span>
          <span className="font-extrabold text-sm tracking-tight text-white">
            usacricketers
          </span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={exitScorerMode}
          className="gap-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to site
        </Button>
      </header>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col">
        {session ? (
          /* Already signed in as scorer */
          <div className="flex flex-1 items-center justify-center px-4 py-16">
            <Card className="w-full max-w-md border-white/10 bg-white/[0.06] text-white backdrop-blur-md">
              <CardContent className="space-y-5 p-8 text-center">
                <div
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full"
                  style={{ background: AMBER }}
                >
                  <Radio className="h-7 w-7" style={{ color: NAVY }} />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    Welcome back, {session.scorer.name}
                  </h1>
                  <p className="mt-1 text-sm text-white/60">
                    You&apos;re signed in and ready to score.
                  </p>
                </div>
                <Button
                  onClick={() => enterScorerMode()}
                  className="w-full gap-2 hover:opacity-90"
                  style={{ background: AMBER, color: NAVY }}
                  size="lg"
                >
                  <Play className="h-4 w-4" />
                  Go to my matches
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Not signed in — landing page */
          <>
            {/* ===== Hero ===== */}
            <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:py-20">
              <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12">
                {/* Left column — copy + single CTA */}
                <div className="space-y-6">
                  {/* LIVE pulse badge */}
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5">
                    <span className="relative flex h-2 w-2">
                      <span
                        className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                        style={{ background: AMBER }}
                      />
                      <span
                        className="relative inline-flex h-2 w-2 rounded-full"
                        style={{ background: AMBER }}
                      />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Live scoring in progress
                    </span>
                  </div>

                  <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
                    Score every ball.
                    <br />
                    <span style={{ color: AMBER }}>Broadcast every moment.</span>
                  </h1>

                  <p className="max-w-lg text-base text-white/70 sm:text-lg">
                    The ball-by-ball scoring console built for match-day scorers.
                    Tap runs, wickets and extras — the live scorecard, commentary
                    and stats reach every viewer instantly, no app download needed.
                  </p>

                  {/* Single primary CTA (no redundant repeats) */}
                  <div className="space-y-3 pt-2">
                    <Button
                      onClick={() => enterScorerLogin()}
                      className="gap-2 text-base font-bold shadow-lg shadow-amber-500/20 hover:opacity-90"
                      style={{ background: AMBER, color: NAVY }}
                      size="lg"
                    >
                      <LogIn className="h-5 w-5" />
                      Sign in to score
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <p className="text-xs text-white/50">
                      No account? Ask your league admin to create your scorer
                      login.
                    </p>
                  </div>
                </div>

                {/* Right column — scoring widget mockup */}
                <div className="relative">
                  {/* Glow behind card */}
                  <div
                    className="absolute inset-0 rounded-2xl opacity-30 blur-2xl"
                    style={{ background: AMBER }}
                  />
                  <div className="relative rounded-2xl border border-white/10 bg-white p-5 shadow-2xl sm:p-6">
                    {/* Header row */}
                    <div
                      className="flex items-center justify-between border-b pb-3"
                      style={{ borderColor: `${NAVY}15` }}
                    >
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4" style={{ color: NAVY }} />
                        <span
                          className="text-xs font-bold uppercase tracking-wide"
                          style={{ color: NAVY }}
                        >
                          T20 · Match 14
                        </span>
                      </div>
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5"
                        style={{ background: `${AMBER}20` }}
                      >
                        <span className="relative flex h-1.5 w-1.5">
                          <span
                            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                            style={{ background: AMBER }}
                          />
                          <span
                            className="relative inline-flex h-1.5 w-1.5 rounded-full"
                            style={{ background: AMBER }}
                          />
                        </span>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: AMBER }}
                        >
                          LIVE
                        </span>
                      </div>
                    </div>

                    {/* Team score */}
                    <div className="py-4">
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Batting
                          </div>
                          <div
                            className="text-lg font-extrabold"
                            style={{ color: NAVY }}
                          >
                            Mumbai Tigers
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className="text-3xl font-extrabold leading-none"
                            style={{ color: NAVY }}
                          >
                            124
                            <span
                              className="text-lg"
                              style={{ color: NAVY }}
                            >
                              /3
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            14.2 overs · RR 8.68
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Batsmen + bowler */}
                    <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 text-xs">
                      {(
                        [
                          {
                            name: "R. Sharma",
                            r: 48,
                            b: 31,
                            fours: 4,
                            sixes: 2,
                            sr: "154.8",
                          },
                          {
                            name: "V. Kohli",
                            r: 26,
                            b: 19,
                            fours: 2,
                            sixes: 1,
                            sr: "136.8",
                          },
                        ] as const
                      ).map((b, i) => (
                        <div
                          key={b.name}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-1.5">
                            {i === 0 && (
                              <span
                                className="text-sm"
                                style={{ color: AMBER }}
                              >
                                *
                              </span>
                            )}
                            <span
                              className="font-semibold"
                              style={{ color: NAVY }}
                            >
                              {b.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-gray-600">
                            <span
                              className="font-bold"
                              style={{ color: NAVY }}
                            >
                              {b.r}
                            </span>
                            <span className="text-gray-400">({b.b})</span>
                            <span className="hidden text-gray-500 sm:inline">
                              4s {b.fours} · 6s {b.sixes}
                            </span>
                            <span className="text-gray-400">SR {b.sr}</span>
                          </div>
                        </div>
                      ))}
                      <div
                        className="flex items-center justify-between border-t pt-1.5 text-gray-500"
                        style={{ borderColor: `${NAVY}10` }}
                      >
                        <span>Bowler: J. Bumrah</span>
                        <span className="font-mono">2/24 (3.2)</span>
                      </div>
                    </div>

                    {/* This over */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        This over
                      </span>
                      <div className="flex gap-1">
                        {(
                          [
                            { v: "4", amber: true },
                            { v: "6", amber: true },
                            { v: "·", amber: false },
                            { v: "W", red: true },
                            { v: "1", amber: false },
                            { v: "2", amber: false },
                          ] as const
                        ).map((b, i) => (
                          <span
                            key={i}
                            className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold"
                            style={{
                              background: b.amber
                                ? AMBER
                                : b.red
                                  ? "#dc2626"
                                  : `${NAVY}15`,
                              color: b.amber || b.red ? "white" : NAVY,
                            }}
                          >
                            {b.v}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Tap-to-score palette */}
                    <div
                      className="mt-4 rounded-lg p-2.5"
                      style={{ background: `${NAVY}08` }}
                    >
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Tap to score
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                        {(
                          [
                            { l: "0", amber: false, red: false },
                            { l: "1", amber: false, red: false },
                            { l: "2", amber: false, red: false },
                            { l: "3", amber: false, red: false },
                            { l: "4", amber: true, red: false },
                            { l: "6", amber: true, red: false },
                            { l: "W", amber: false, red: true },
                            { l: "Wd", amber: false, red: false },
                          ] as const
                        ).map((b, i) => (
                          <div
                            key={i}
                            className="grid h-8 place-items-center rounded-md text-xs font-bold shadow-sm"
                            style={{
                              background: b.amber
                                ? AMBER
                                : b.red
                                  ? "#dc2626"
                                  : "white",
                              color: b.amber || b.red ? "white" : NAVY,
                              border: `1px solid ${NAVY}20`,
                            }}
                          >
                            {b.l}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ===== How it works ===== */}
            <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
              <div className="mb-8 text-center">
                <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <span className="h-px w-8" style={{ background: AMBER }} />
                  How it works
                  <span className="h-px w-8" style={{ background: AMBER }} />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  From sign-in to live scorecard in under a minute
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <HowItWorks
                  step={1}
                  icon={LogIn}
                  title="Sign in"
                  desc="Use the scorer username + password issued by your league admin."
                />
                <HowItWorks
                  step={2}
                  icon={ListChecks}
                  title="Pick your match"
                  desc="Choose a match from your assigned tournaments — live, upcoming or finished."
                />
                <HowItWorks
                  step={3}
                  icon={Activity}
                  title="Score ball-by-ball"
                  desc="Tap runs, extras or wickets. The scorecard updates live for everyone watching."
                />
              </div>
            </section>

            {/* ===== What you get ===== */}
            <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
              <div className="mb-8 text-center">
                <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <span className="h-px w-8" style={{ background: AMBER }} />
                  What you get
                  <span className="h-px w-8" style={{ background: AMBER }} />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  Everything a match-day scorer needs
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Feature
                  icon={Radio}
                  title="All formats"
                  desc="Ball-by-ball scoring for Test, ODI, T20I and T10 matches."
                />
                <Feature
                  icon={Zap}
                  title="Live broadcast"
                  desc="WebSocket push to every viewer — the scorecard updates in real time."
                />
                <Feature
                  icon={FileText}
                  title="Auto scorecard"
                  desc="Batting, bowling and fall-of-wickets generated automatically."
                />
                <Feature
                  icon={Undo2}
                  title="Undo anything"
                  desc="Undo last ball, start a new innings, pick next batsman or bowler."
                />
                <Feature
                  icon={MessageSquare}
                  title="Commentary feed"
                  desc="Every ball is logged into a live, shareable commentary stream."
                />
                <Feature
                  icon={Database}
                  title="Auto-persist"
                  desc="The match is saved to the database automatically when it completes."
                />
              </div>
            </section>

            {/* ===== League admin — subtle secondary option ===== */}
            <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-white/50" />
                    <p className="text-sm text-white/60">
                      Are you a league admin managing scorers and schedules?
                    </p>
                  </div>
                  {leagueSession ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/70">
                        Signed in as{" "}
                        <span className="font-semibold text-white">
                          {leagueSession.admin.name}
                        </span>
                      </span>
                      <Button
                        onClick={() => enterLeagueAdminMode()}
                        className="gap-2"
                        style={{ background: AMBER, color: NAVY }}
                        size="sm"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Go to my leagues
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => enterLeagueAdminLogin()}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300 underline-offset-4 hover:text-amber-200 hover:underline"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      League admin sign in
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t border-white/10 bg-white/5 px-4 py-5 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <span
              className="grid h-5 w-5 place-items-center rounded"
              style={{ background: AMBER }}
            >
              <Radio className="h-3 w-3" style={{ color: NAVY }} />
            </span>
            <span className="text-xs font-bold tracking-tight text-white">
              usacricketers
            </span>
          </div>
          <p className="text-xs text-white/40">
            Live ball-by-ball cricket scoring. Built for match-day scorers.
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ----------------------------- Helper blocks ----------------------------- */

function HowItWorks({
  step,
  icon: Icon,
  title,
  desc,
}: {
  step: number
  icon: React.ElementType
  title: string
  desc: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm transition-colors hover:border-amber-400/40 hover:bg-white/[0.07]">
      {/* Big faded step number in the corner */}
      <div className="pointer-events-none absolute right-4 top-2 text-6xl font-extrabold leading-none text-white/[0.06]">
        {step}
      </div>
      <div
        className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
        style={{ background: AMBER, color: NAVY }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
        Step {step}
      </div>
      <h3 className="mb-1.5 text-base font-bold text-white">{title}</h3>
      <p className="text-sm text-white/60">{desc}</p>
    </div>
  )
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType
  title: string
  desc: string
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm transition-colors hover:border-amber-400/40 hover:bg-white/[0.07]">
      <div
        className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl"
        style={{ background: `${AMBER}1A` }}
      >
        <Icon className="h-5 w-5" style={{ color: AMBER }} />
      </div>
      <h3 className="mb-1 text-base font-bold text-white">{title}</h3>
      <p className="text-sm text-white/60">{desc}</p>
    </div>
  )
}
