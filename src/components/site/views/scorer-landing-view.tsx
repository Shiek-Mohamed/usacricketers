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
} from "lucide-react"

const NAVY = "#1e2a5e"

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
    <div className="relative min-h-screen">
      {/* Background image + navy overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="/cricket/inline-stadium-crowd.png"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e2a5e]/92 via-[#1e2a5e]/88 to-[#1e2a5e]/95" />
      </div>

      {/* Content on top of background */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="flex h-12 items-center justify-between border-b border-white/10 bg-[#1e2a5e]/60 px-4 text-white backdrop-blur-sm">
          <button
            onClick={() => navigate("home")}
            className="flex items-center gap-2"
          >
            <Radio className="h-4 w-4 text-blue-300" />
            <span className="font-extrabold text-sm tracking-tight">usacricketers</span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exitScorerMode}
            className="gap-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to site
          </Button>
        </header>

        {/* Content */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <div className="w-full max-w-2xl space-y-8">
            {session ? (
              // Already signed in as scorer
              <Card className="text-center">
                <CardContent className="space-y-5 p-8">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: NAVY }}>
                    <Radio className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">
                      Welcome back, {session.scorer.name}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You&apos;re signed in and ready to score.
                    </p>
                  </div>
                  <Button
                    onClick={() => enterScorerMode()}
                    className="w-full gap-2 text-white hover:opacity-90"
                    style={{ background: NAVY }}
                    size="lg"
                  >
                    <Play className="h-4 w-4" />
                    Go to my matches
                  </Button>
                </CardContent>
              </Card>
            ) : (
              // Not signed in — show the landing page
              <>
                {/* Hero title + description (white text on dark bg) */}
                <div className="text-center">
                  <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-white/15">
                    <Radio className="h-7 w-7 text-blue-300" />
                  </div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                    Live Cricket Scoring
                  </h1>
                  <p className="mt-3 text-sm text-white/70 sm:text-base">
                    Score your matches ball-by-ball in real time. Every ball,
                    wicket, four and six is broadcast live to viewers instantly —
                    no app download needed, just sign in and start scoring.
                  </p>
                </div>

                {/* League Admin card — white card on dark bg */}
                <div className="rounded-xl border bg-white p-5 text-center shadow-lg">
                  <div className="flex items-center justify-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-md text-white" style={{ background: NAVY }}>
                      <Trophy className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: NAVY }}>League Admin</h2>
                      <p className="text-xs text-muted-foreground">
                        Manage your leagues, schedules and scorers
                      </p>
                    </div>
                  </div>
                  {leagueSession ? (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        Signed in as <span className="font-semibold">{leagueSession.admin.name}</span>
                      </p>
                      <Button
                        onClick={() => enterLeagueAdminMode()}
                        className="mt-2 gap-2 text-white hover:opacity-90"
                        style={{ background: NAVY }}
                        size="sm"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Go to my leagues
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => enterLeagueAdminLogin()}
                      variant="outline"
                      className="mt-3 gap-2"
                      style={{ borderColor: NAVY, color: NAVY }}
                      size="sm"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      Sign in as League Admin
                    </Button>
                  )}
                </div>

                {/* Sign in to score — white button pops on dark bg */}
                <div className="text-center">
                  <Button
                    onClick={() => enterScorerLogin()}
                    className="gap-2 bg-white text-[#1e2a5e] hover:bg-white/90"
                    size="lg"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign in to score
                  </Button>
                  <p className="mt-3 text-xs text-white/50">
                    Don&apos;t have an account? Ask your league admin to create one for you.
                  </p>
                </div>

                {/* How it works — white cards on dark bg */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <HowItWorks
                    step={1}
                    icon={LogIn}
                    title="Sign in"
                    desc="Use your scorer username and password provided by your league admin."
                  />
                  <HowItWorks
                    step={2}
                    icon={ListChecks}
                    title="Pick your match"
                    desc="Select a match from your assigned tournaments — live, upcoming or recently completed."
                  />
                  <HowItWorks
                    step={3}
                    icon={Activity}
                    title="Score ball-by-ball"
                    desc="Tap runs, extras or wickets. The scorecard updates live for everyone watching."
                  />
                </div>

                {/* Features — white card on dark bg */}
                <div className="rounded-xl border bg-white p-5 shadow-lg">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
                    <span className="h-4 w-1 rounded-full" style={{ background: NAVY }} />
                    What you get
                  </h2>
                  <div className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
                    <Feature text="Ball-by-ball scoring for Test, ODI, T20I and T10" />
                    <Feature text="Live broadcast to viewers via WebSocket" />
                    <Feature text="Auto-generated scorecard with batting, bowling + FOW" />
                    <Feature text="Undo last ball, start new innings, pick next batsman/bowler" />
                    <Feature text="Commentary feed with every ball logged" />
                    <Feature text="Auto-persist to the database when the match completes" />
                  </div>
                </div>

                {/* CTA at the bottom */}
                <div className="text-center">
                  <Button
                    onClick={() => enterScorerLogin()}
                    variant="outline"
                    className="gap-2 border-white/30 text-white hover:bg-white/10 hover:text-white"
                    size="lg"
                  >
                    Get started
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

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
    <Card className="text-center shadow-lg">
      <CardContent className="space-y-2 p-4">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: NAVY }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
          Step {step}
        </div>
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  )
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: NAVY }} />
      <span className="text-muted-foreground">{text}</span>
    </div>
  )
}
