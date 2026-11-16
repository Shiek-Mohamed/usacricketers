"use client"

import { useAppStore } from "@/lib/store"
import { useScorerSession } from "@/lib/scorer-session"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { Button } from "@/components/ui/button"
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

/*
 * Scorer landing — redesigned to feel like a premium sports product
 * (ESPNcricinfo / The Athletic) rather than a generic AI SaaS landing.
 *
 * Design changes vs. the previous version:
 *  - Real stadium photography as the hero background (dark overlay) instead
 *    of navy gradient + amber blur blobs (the classic AI-generated tell).
 *  - Barlow Condensed display type for headlines + score numbers — punchy,
 *    athletic, editorial. Body copy stays in Raleway for readability.
 *  - Asymmetric hero (60/40) — copy + dual CTAs on the left over the photo,
 *    scoring widget mockup on the right on a near-black panel.
 *  - Sharp edges (rounded-sm / rounded-none) instead of rounded-2xl
 *    glassmorphism. Thin 1px dividers, not blurred translucent cards.
 *  - Accent restraint — amber is used ONLY for the live pulse + primary CTA.
 *    Secondary surfaces are near-black (#0b0f1a) so sections have rhythm.
 *  - Sample data uses real US-flavored cricket names (United Tigers batting,
 *    S. Taylor / A. Jones at the crease, A. Khan bowling) — no more "Mumbai
 *    Tigers / R. Sharma / V. Kohli / J. Bumrah" stock IPL mockup.
 *  - League-admin CTA moved NEXT TO "Sign in to score" in the hero (was a
 *    separate section at the bottom). One place for both entry points.
 */

const INK = "#0b0f1a" // near-black panel
const INK_2 = "#11172a" // slightly lifted panel
const AMBER = "#f59e0b" // accent — used sparingly
const BORDER = "rgba(255,255,255,0.10)"
const CONDENSED = "var(--font-condensed)" as const

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
      style={{ background: INK }}
    >
      {/* Top bar — sharp, no blur */}
      <header
        className="relative z-20 flex h-14 items-center justify-between border-b px-4 sm:px-6"
        style={{ borderColor: BORDER, background: INK }}
      >
        <button
          onClick={() => navigate("home")}
          className="flex items-center gap-2"
        >
          <span
            className="grid h-7 w-7 place-items-center rounded-sm"
            style={{ background: AMBER }}
          >
            <Radio className="h-4 w-4" style={{ color: INK }} />
          </span>
          <span
            className="text-sm font-extrabold uppercase tracking-wider text-white"
            style={{ fontFamily: CONDENSED, letterSpacing: "0.05em" }}
          >
            usacricketers
          </span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={exitScorerMode}
          className="gap-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white"
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
            <div
              className="w-full max-w-md border p-8 text-center"
              style={{ background: INK_2, borderColor: BORDER }}
            >
              <div
                className="mx-auto grid h-16 w-16 place-items-center rounded-sm"
                style={{ background: AMBER }}
              >
                <Radio className="h-7 w-7" style={{ color: INK }} />
              </div>
              <h1
                className="mt-6 text-3xl font-extrabold uppercase tracking-tight text-white"
                style={{ fontFamily: CONDENSED }}
              >
                Welcome back, {session.scorer.name.split(" ")[0]}
              </h1>
              <p className="mt-1 text-sm text-white/55">
                You&apos;re signed in and ready to score.
              </p>
              <Button
                onClick={() => enterScorerMode()}
                className="mt-6 w-full gap-2"
                style={{ background: AMBER, color: INK }}
                size="lg"
              >
                <Play className="h-4 w-4" />
                Go to my matches
              </Button>
            </div>
          </div>
        ) : (
          /* Not signed in — landing page */
          <>
            {/* ===== Hero — photo background + asymmetric 60/40 ===== */}
            <section className="relative w-full overflow-hidden">
              {/* Stadium photo background */}
              <div
                className="absolute inset-0 z-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(/scorer-hero.png)`,
                }}
                aria-hidden
              />
              {/* Dark gradient overlay: heavier on the left for text legibility */}
              <div
                className="absolute inset-0 z-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(11,15,26,0.94) 0%, rgba(11,15,26,0.78) 45%, rgba(11,15,26,0.55) 100%)",
                }}
                aria-hidden
              />

              <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-0 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:py-16">
                {/* LEFT (60%) — copy + dual CTAs */}
                <div className="flex flex-col py-6 lg:pr-10 lg:py-10">
                  {/* LIVE pulse badge */}
                  <div
                    className="inline-flex w-fit items-center gap-2 border px-3 py-1.5"
                    style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: AMBER }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: AMBER }} />
                    </span>
                    <span
                      className="text-xs font-bold uppercase"
                      style={{ color: AMBER, fontFamily: CONDENSED, letterSpacing: "0.1em" }}
                    >
                      Live scoring in progress
                    </span>
                  </div>

                  {/* Headline — condensed, athletic, sharp. Second line is
                      slightly smaller + nowrap so "Broadcast every moment."
                      doesn't break awkwardly mid-phrase. */}
                  <h1
                    className="mt-5 font-extrabold uppercase leading-[0.92] tracking-tight text-white"
                    style={{ fontFamily: CONDENSED }}
                  >
                    <span className="block text-5xl sm:text-6xl lg:text-7xl">
                      Score every ball.
                    </span>
                    <span
                      className="mt-1 block whitespace-nowrap text-4xl sm:text-5xl lg:text-6xl"
                      style={{ color: AMBER }}
                    >
                      Broadcast every moment.
                    </span>
                  </h1>

                  <p className="mt-5 max-w-lg text-base text-white/70 sm:text-lg">
                    The ball-by-ball scoring console built for match-day scorers.
                    Tap runs, wickets and extras — the live scorecard, commentary
                    and stats reach every viewer instantly, no app download needed.
                  </p>

                  {/* Dual CTAs — primary scorer + secondary league admin */}
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    {/* Primary — Sign in to score */}
                    <Button
                      onClick={() => enterScorerLogin()}
                      className="h-12 gap-2 px-6 text-base font-bold"
                      style={{ background: AMBER, color: INK }}
                      size="lg"
                    >
                      <LogIn className="h-5 w-5" />
                      Sign in to score
                      <ChevronRight className="h-4 w-4" />
                    </Button>

                    {/* Secondary — League admin (sign in OR go to leagues).
                      Subtle dark fill so the white outline stays legible
                      against the photo background. */}
                    {leagueSession ? (
                      <button
                        onClick={() => enterLeagueAdminMode()}
                        className="group flex h-12 items-center gap-2.5 border px-4 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                        style={{ borderColor: BORDER, background: "rgba(11,15,26,0.45)" }}
                      >
                        <Shield className="h-4 w-4 text-white/70" />
                        <span className="text-left leading-tight">
                          <span className="block text-[10px] font-normal uppercase tracking-wider text-white/55" style={{ fontFamily: CONDENSED }}>
                            Signed in as
                          </span>
                          <span className="block">{leagueSession.admin.name}</span>
                        </span>
                        <ChevronRight className="ml-1 h-4 w-4 text-white/70 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => enterLeagueAdminLogin()}
                        className="group flex h-12 items-center gap-2 border px-4 text-sm font-semibold text-white/90 transition-colors hover:bg-white/15 hover:text-white"
                        style={{ borderColor: BORDER, background: "rgba(11,15,26,0.45)" }}
                      >
                        <Shield className="h-4 w-4 text-white/65" />
                        League admin sign in
                        <ChevronRight className="h-4 w-4 text-white/65 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    )}
                  </div>

                  <p
                    className="mt-3 w-fit rounded-sm px-1.5 py-0.5 text-xs text-white/65"
                    style={{ background: "rgba(11,15,26,0.35)" }}
                  >
                    No scorer account? Ask your league admin to create your login.
                  </p>
                </div>

                {/* RIGHT (40%) — scoring widget mockup on near-black panel */}
                <div className="relative flex items-center py-6 lg:py-10">
                  <ScorecardMock />
                </div>
              </div>
            </section>

            {/* ===== How it works — sharp cards, big ghost numerals ===== */}
            <section
              className="border-t"
              style={{ borderColor: BORDER, background: INK_2 }}
            >
              <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
                <div className="mb-8">
                  <div
                    className="mb-2 text-xs font-bold uppercase text-white/45"
                    style={{ fontFamily: CONDENSED, letterSpacing: "0.15em" }}
                  >
                    — How it works
                  </div>
                  <h2
                    className="text-3xl font-extrabold uppercase leading-none tracking-tight text-white sm:text-4xl"
                    style={{ fontFamily: CONDENSED }}
                  >
                    From sign-in to live scorecard in under a minute
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-px sm:grid-cols-3" style={{ background: BORDER }}>
                  <HowItWorks step={1} icon={LogIn} title="Sign in" desc="Use the scorer username + password issued by your league admin." />
                  <HowItWorks step={2} icon={ListChecks} title="Pick your match" desc="Choose a match from your assigned tournaments — live, upcoming or finished." />
                  <HowItWorks step={3} icon={Activity} title="Score ball-by-ball" desc="Tap runs, extras or wickets. The scorecard updates live for everyone watching." />
                </div>
              </div>
            </section>

            {/* ===== What you get — asymmetric: lead feature 2× wide ===== */}
            <section className="border-t" style={{ borderColor: BORDER, background: INK }}>
              <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
                <div className="mb-8">
                  <div
                    className="mb-2 text-xs font-bold uppercase text-white/45"
                    style={{ fontFamily: CONDENSED, letterSpacing: "0.15em" }}
                  >
                    — What you get
                  </div>
                  <h2
                    className="text-3xl font-extrabold uppercase leading-none tracking-tight text-white sm:text-4xl"
                    style={{ fontFamily: CONDENSED }}
                  >
                    Everything a match-day scorer needs
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3" style={{ background: BORDER }}>
                  {/* Lead feature — spans 2 columns on lg */}
                  <div className="sm:col-span-2 lg:col-span-2" style={{ background: INK_2 }}>
                    <FeatureLarge
                      icon={Zap}
                      title="Live broadcast"
                      desc="WebSocket push to every viewer — the scorecard updates in real time, ball-by-ball, with no refresh. The moment you tap a run, every phone, laptop and tablet following the match sees it."
                    />
                  </div>
                  <div style={{ background: INK_2 }}>
                    <Feature icon={Radio} title="All formats" desc="Test, ODI, T20I and T10." />
                  </div>
                  <div style={{ background: INK_2 }}>
                    <Feature icon={FileText} title="Auto scorecard" desc="Batting, bowling and fall-of-wickets generated automatically." />
                  </div>
                  <div style={{ background: INK_2 }}>
                    <Feature icon={Undo2} title="Undo anything" desc="Undo last ball, start a new innings, pick next batsman or bowler." />
                  </div>
                  <div style={{ background: INK_2 }}>
                    <Feature icon={MessageSquare} title="Commentary feed" desc="Every ball logged into a live, shareable commentary stream." />
                  </div>
                  <div style={{ background: INK_2 }}>
                    <Feature icon={Database} title="Auto-persist" desc="Match saved to the database automatically when it completes." />
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Footer — sharp */}
      <footer
        className="mt-auto border-t px-4 py-5 sm:px-6"
        style={{ borderColor: BORDER, background: INK }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-sm" style={{ background: AMBER }}>
              <Radio className="h-3 w-3" style={{ color: INK }} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-white" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em" }}>
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

/* ----------------------------- Scorecard mockup ----------------------------- */

/**
 * The scoring widget shown in the hero right column. Uses real US-flavored
 * cricket names (United Tigers batting, S. Taylor / A. Jones at the crease,
 * A. Khan bowling) — no more stock IPL mockup data.
 */
function ScorecardMock() {
  return (
    <div className="relative w-full">
      <div
        className="border p-5 shadow-2xl sm:p-6"
        style={{ background: "#fff", borderColor: "rgba(0,0,0,0.08)" }}
      >
        {/* Header row */}
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: "rgba(11,15,26,0.10)" }}
        >
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: INK }} />
            <span
              className="text-xs font-bold uppercase"
              style={{ color: INK, fontFamily: CONDENSED, letterSpacing: "0.08em" }}
            >
              T20 · Match 14
            </span>
          </div>
          <div
            className="inline-flex items-center gap-1.5 px-2 py-0.5"
            style={{ background: "rgba(245,158,11,0.12)" }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: AMBER }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
            </span>
            <span className="text-[10px] font-bold uppercase" style={{ color: AMBER, fontFamily: CONDENSED, letterSpacing: "0.1em" }}>
              LIVE
            </span>
          </div>
        </div>

        {/* Team score — big condensed number */}
        <div className="py-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500" style={{ fontFamily: CONDENSED, letterSpacing: "0.1em" }}>
                Batting
              </div>
              <div className="text-lg font-extrabold" style={{ color: INK, fontFamily: CONDENSED }}>
                United Tigers
              </div>
            </div>
            <div className="text-right">
              <div
                className="text-4xl font-extrabold leading-none"
                style={{ color: INK, fontFamily: CONDENSED }}
              >
                124<span className="text-xl">/3</span>
              </div>
              <div className="text-xs text-gray-500" style={{ fontFamily: CONDENSED }}>
                14.2 OV · CRR 8.68
              </div>
            </div>
          </div>
        </div>

        {/* Batsmen + bowler — real US cricketer names */}
        <div className="space-y-1.5 p-3 text-xs" style={{ background: "#f6f7f9" }}>
          {(
            [
              { name: "S. Taylor", r: 48, b: 31, fours: 4, sixes: 2, sr: "154.8" },
              { name: "A. Jones", r: 26, b: 19, fours: 2, sixes: 1, sr: "136.8" },
            ] as const
          ).map((b, i) => (
            <div key={b.name} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {i === 0 && <span className="text-sm" style={{ color: AMBER }}>*</span>}
                <span className="font-semibold" style={{ color: INK }}>{b.name}</span>
              </div>
              <div className="flex items-center gap-3 font-mono text-gray-600">
                <span className="font-bold" style={{ color: INK }}>{b.r}</span>
                <span className="text-gray-400">({b.b})</span>
                <span className="hidden text-gray-500 sm:inline">4s {b.fours} · 6s {b.sixes}</span>
                <span className="text-gray-400">SR {b.sr}</span>
              </div>
            </div>
          ))}
          <div
            className="flex items-center justify-between border-t pt-1.5 text-gray-500"
            style={{ borderColor: "rgba(11,15,26,0.08)" }}
          >
            <span>Bowler: A. Khan</span>
            <span className="font-mono">2/24 (3.2)</span>
          </div>
        </div>

        {/* This over */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400" style={{ fontFamily: CONDENSED, letterSpacing: "0.1em" }}>
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
                  background: b.amber ? AMBER : b.red ? "#dc2626" : "rgba(11,15,26,0.08)",
                  color: b.amber || b.red ? "white" : INK,
                }}
              >
                {b.v}
              </span>
            ))}
          </div>
        </div>

        {/* Tap-to-score palette — sharp edges */}
        <div className="mt-4 p-2.5" style={{ background: "rgba(11,15,26,0.04)" }}>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500" style={{ fontFamily: CONDENSED, letterSpacing: "0.1em" }}>
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
                className="grid h-8 place-items-center text-xs font-bold"
                style={{
                  background: b.amber ? AMBER : b.red ? "#dc2626" : "white",
                  color: b.amber || b.red ? "white" : INK,
                  border: "1px solid rgba(11,15,26,0.12)",
                }}
              >
                {b.l}
              </div>
            ))}
          </div>
        </div>
      </div>
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
    <div
      className="group relative overflow-hidden p-6 transition-colors hover:bg-white/[0.02]"
      style={{ background: INK_2 }}
    >
      {/* Big faded step number — condensed, athletic */}
      <div
        className="pointer-events-none absolute -right-1 -top-3 text-7xl font-extrabold leading-none text-white/[0.05]"
        style={{ fontFamily: CONDENSED }}
      >
        {step}
      </div>
      <div
        className="mb-4 grid h-10 w-10 place-items-center"
        style={{ background: "rgba(245,158,11,0.12)" }}
      >
        <Icon className="h-5 w-5" style={{ color: AMBER }} />
      </div>
      <div
        className="mb-1 text-[10px] font-bold uppercase text-white/40"
        style={{ fontFamily: CONDENSED, letterSpacing: "0.15em" }}
      >
        Step {step}
      </div>
      <h3
        className="mb-1.5 text-xl font-bold uppercase tracking-tight text-white"
        style={{ fontFamily: CONDENSED }}
      >
        {title}
      </h3>
      <p className="text-sm text-white/55">{desc}</p>
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
    <div className="group h-full p-6 transition-colors hover:bg-white/[0.02]">
      <Icon className="h-5 w-5" style={{ color: AMBER }} />
      <h3
        className="mt-3 text-lg font-bold uppercase tracking-tight text-white"
        style={{ fontFamily: CONDENSED }}
      >
        {title}
      </h3>
      <p className="mt-1 text-sm text-white/55">{desc}</p>
    </div>
  )
}

function FeatureLarge({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType
  title: string
  desc: string
}) {
  return (
    <div className="group flex h-full flex-col p-8 transition-colors hover:bg-white/[0.02]">
      <Icon className="h-7 w-7" style={{ color: AMBER }} />
      <h3
        className="mt-4 text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl"
        style={{ fontFamily: CONDENSED }}
      >
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm text-white/60 sm:text-base">{desc}</p>
    </div>
  )
}
