"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { useLeagueAdminSession } from "@/lib/league-admin-session"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Shield, ArrowLeft, Loader2, AlertCircle, Trophy, MailCheck, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LeagueAdminSession } from "@/lib/types"

const FORMATS = ["T20", "ODI", "Test", "T10"] as const

export function LeagueAdminSignupView() {
  const navigate = useAppStore((s) => s.navigate)
  const exitLeagueAdminMode = useAppStore((s) => s.exitLeagueAdminMode)
  const setSession = useLeagueAdminSession((s) => s.setSession)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [leagueName, setLeagueName] = useState("")
  const [leagueFormat, setLeagueFormat] = useState<string>("T20")
  const [leagueSeason, setLeagueSeason] = useState(
    String(new Date().getFullYear())
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Success state: shown after signup returns needsEmailVerification=true.
  // Replaces the old behavior of auto-logging in (which was a security gap —
  // see Task 10 worklog entry).
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [resendStatus, setResendStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >({ kind: "idle" })

  async function handleResendEmail() {
    if (!submittedEmail || resendStatus.kind === "sending") return
    setResendStatus({ kind: "sending" })
    try {
      const res = await fetch("/api/league-admin/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submittedEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        setResendStatus({
          kind: "error",
          message: "Too many resend attempts — please wait an hour and try again.",
        })
        return
      }
      if (!res.ok) {
        setResendStatus({
          kind: "error",
          message: data?.error || "Failed to resend — please try again later.",
        })
        return
      }
      if (data?.alreadyVerified) {
        setResendStatus({
          kind: "error",
          message: "Your email is already verified — you can sign in.",
        })
        return
      }
      setResendStatus({ kind: "sent" })
    } catch {
      setResendStatus({
        kind: "error",
        message: "Network error — please try again.",
      })
    }
  }

  function handleResetSignup() {
    setSubmittedEmail(null)
    setResendStatus({ kind: "idle" })
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    if (!email.trim()) {
      setError("Email is required")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/league-admin/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          username: username.trim(),
          password,
          leagueName: leagueName.trim(),
          leagueFormat,
          leagueSeason: leagueSeason.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        setError(
          "Too many sign-ups from this network — please try again later."
        )
        return
      }
      if (res.status === 409) {
        setError(data?.error || "That username or email is already taken")
        return
      }
      if (!res.ok) {
        setError(data?.error || `Sign-up failed (${res.status})`)
        return
      }
      // Success — backend returns { needsEmailVerification: true, emailSent: bool,
      // admin: { email }, message }. Don't auto-login (Task 10 changed this —
      // login is blocked until the email is verified). Show the "Check your
      // email" success state instead.
      const adminEmail = data?.admin?.email || email.trim()
      if (data?.needsEmailVerification) {
        setSubmittedEmail(adminEmail)
        if (!data?.emailSent) {
          // Email send failed — surface that so the user knows to use resend.
          setResendStatus({
            kind: "error",
            message:
              data?.message ||
              "Account created but the verification email failed to send. Use the resend button below.",
          })
        } else {
          setResendStatus({ kind: "idle" })
        }
      } else {
        // Legacy path: no email verification required (shouldn't happen after
        // Task 10, but handle gracefully — auto-login as before).
        setSession(data as LeagueAdminSession)
        navigate("league-admin-home")
      }
    } catch {
      setError("Network error — please try again")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      {/* Wordmark */}
      <div className="mb-6 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-[#1e2a5e] text-white">
          <Shield className="h-4 w-4 text-emerald-400" />
        </span>
        <span className="text-sm font-extrabold tracking-tight text-foreground">
          usacricketers
        </span>
      </div>

      {submittedEmail ? (
        <Card className="w-full max-w-md">
          <CardHeader className="gap-1.5 space-y-0 text-center">
            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <MailCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl tracking-tight">
              Check your email
            </CardTitle>
            <CardDescription className="text-xs">
              We sent a verification link to{" "}
              <span className="font-semibold text-foreground">
                {submittedEmail}
              </span>
              . Click the link to activate your league-admin account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-semibold">Next steps:</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Open the email + click the verification link.</li>
                <li>The link expires in 24 hours.</li>
                <li>After verifying, come back here + sign in.</li>
              </ol>
            </div>

            {resendStatus.kind === "sent" && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                <MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Verification email resent to {submittedEmail}. Check your
                  inbox + spam folder.
                </span>
              </div>
            )}
            {resendStatus.kind === "error" && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{resendStatus.message}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={handleResendEmail}
                disabled={resendStatus.kind === "sending"}
                variant="outline"
                className="w-full gap-2"
              >
                {resendStatus.kind === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Resend verification email
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => navigate("league-admin-login")}
                variant="default"
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              >
                I&apos;ve verified — sign in
              </Button>
              <Button
                type="button"
                onClick={handleResetSignup}
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
      <Card className="w-full max-w-md">
        <CardHeader className="gap-1.5 space-y-0 text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl tracking-tight">
            <Trophy className="h-4 w-4 text-emerald-600" />
            Run your league
          </CardTitle>
          <CardDescription className="text-xs">
            Create a free league-admin account + your first league. You&apos;ll
            be able to add teams, schedule matches, and assign scorers
            straight away — no waiting on us.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="su-name">Your name</Label>
              <Input
                id="su-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                disabled={submitting}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="su-email">
                Email{" "}
                <span className="font-normal text-red-600">*</span>
              </Label>
              <Input
                id="su-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@league.org"
                disabled={submitting}
                autoComplete="email"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="su-username">Username</Label>
                <Input
                  id="su-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="alexm"
                  disabled={submitting}
                  autoComplete="username"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="su-password">Password</Label>
                <Input
                  id="su-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min 6 chars"
                  disabled={submitting}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="my-2 flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Your first league
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="su-league">League name</Label>
              <Input
                id="su-league"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                placeholder="e.g. Arizona Premier Cricket League"
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="su-format">Format</Label>
                <Select
                  value={leagueFormat}
                  onValueChange={setLeagueFormat}
                  disabled={submitting}
                >
                  <SelectTrigger id="su-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="su-season">Season</Label>
                <Input
                  id="su-season"
                  value={leagueSeason}
                  onChange={(e) => setLeagueSeason(e.target.value)}
                  placeholder="2026"
                  disabled={submitting}
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className={cn(
                  "flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                )}
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating your league…
                </>
              ) : (
                "Create account & league"
              )}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={exitLeagueAdminMode}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to site
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("league-admin-login")}
              className="text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              Already have an account? Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      <p className="mt-6 max-w-md text-center text-[11px] leading-relaxed text-muted-foreground">
        By signing up you agree to run leagues honestly. Accounts can be
        deactivated for abuse. Your league is yours — you manage teams,
        schedules, and scorers; other league admins can&apos;t see or edit it.
      </p>
    </div>
  )
}
