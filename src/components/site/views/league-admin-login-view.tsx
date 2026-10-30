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
import { Shield, ArrowLeft, Loader2, AlertCircle, RefreshCw, MailWarning } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LeagueAdminSession } from "@/lib/types"

export function LeagueAdminLoginView() {
  const navigate = useAppStore((s) => s.navigate)
  const exitLeagueAdminMode = useAppStore((s) => s.exitLeagueAdminMode)
  const setSession = useLeagueAdminSession((s) => s.setSession)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Email verification state: when login returns 403 with code=EMAIL_NOT_VERIFIED,
  // show a "Resend verification email" button inline. Backend returns the
  // admin's email so we don't have to ask the user for it again.
  const [needsVerification, setNeedsVerification] = useState<
    | { kind: "idle" }
    | { kind: "pending"; email: string }
    | { kind: "sending"; email: string }
    | { kind: "sent"; email: string }
    | { kind: "error"; email: string; message: string }
  >({ kind: "idle" })

  async function handleResendVerification() {
    if (needsVerification.kind !== "pending" && needsVerification.kind !== "error") return
    const email = needsVerification.email
    setNeedsVerification({ kind: "sending", email })
    try {
      const res = await fetch("/api/league-admin/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        setNeedsVerification({
          kind: "error",
          email,
          message: "Too many resend attempts — please wait an hour and try again.",
        })
        return
      }
      if (!res.ok) {
        setNeedsVerification({
          kind: "error",
          email,
          message: data?.error || "Failed to resend — please try again later.",
        })
        return
      }
      if (data?.alreadyVerified) {
        setNeedsVerification({
          kind: "error",
          email,
          message: "Your email is already verified — try signing in again.",
        })
        return
      }
      setNeedsVerification({ kind: "sent", email })
    } catch {
      setNeedsVerification({
        kind: "error",
        email,
        message: "Network error — please try again.",
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    if (!username.trim() || !password) {
      setError("Enter your username and password")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/league-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      if (res.status === 401) {
        setError("Invalid username or password")
        return
      }
      if (res.status === 403) {
        // Email not verified — backend returns { code: "EMAIL_NOT_VERIFIED", email }.
        // Show the resend verification UI inline instead of the generic error.
        const data = await res.json().catch(() => ({}))
        if (data?.code === "EMAIL_NOT_VERIFIED" && data?.email) {
          setError(null)
          setNeedsVerification({ kind: "pending", email: data.email })
          return
        }
        setError(data?.error || "Sign-in failed — account not active.")
        return
      }
      if (!res.ok) {
        setError(`Sign-in failed (${res.status})`)
        return
      }
      const data = (await res.json()) as LeagueAdminSession
      setSession(data)
      navigate("league-admin-home")
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

      <Card className="w-full max-w-sm">
        <CardHeader className="gap-1.5 space-y-0 text-center">
          <CardTitle className="text-xl tracking-tight">
            League Admin Sign In
          </CardTitle>
          <CardDescription className="text-xs">
            Sign in to manage your leagues, schedules and scorers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="la-username">Username</Label>
              <Input
                id="la-username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your.username"
                disabled={submitting}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="la-password">Password</Label>
              <Input
                id="la-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
              />
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

            {needsVerification.kind !== "idle" && (
              <div
                role="alert"
                className="space-y-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-xs dark:border-amber-900 dark:bg-amber-950/40"
              >
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                  <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Verify your email before signing in
                    </p>
                    <p className="font-normal">
                      We sent a verification link to{" "}
                      <span className="font-semibold">
                        {needsVerification.email}
                      </span>
                      . Click the link to activate your account, then try
                      signing in again.
                    </p>
                  </div>
                </div>

                {needsVerification.kind === "sent" && (
                  <div className="flex items-start gap-2 rounded border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <RefreshCw className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      Verification email resent to {needsVerification.email}.
                      Check your inbox + spam folder.
                    </span>
                  </div>
                )}
                {needsVerification.kind === "error" && (
                  <div className="flex items-start gap-2 rounded border border-red-300 bg-red-50 px-2 py-1.5 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{needsVerification.message}</span>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={needsVerification.kind === "sending"}
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                >
                  {needsVerification.kind === "sending" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Resend verification email
                    </>
                  )}
                </Button>
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
                  Signing in…
                </>
              ) : (
                "Sign in"
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
              onClick={() => navigate("league-admin-signup")}
              className="text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              New here? Sign up
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 max-w-sm text-center text-[11px] leading-relaxed text-muted-foreground">
        Don&apos;t have an account yet? Anyone can{" "}
        <button
          onClick={() => navigate("league-admin-signup")}
          className="font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
        >
          sign up to run a league
        </button>{" "}
        — no waiting on us.
      </p>
    </div>
  )
}
