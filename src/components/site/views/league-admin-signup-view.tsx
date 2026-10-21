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
import { Shield, ArrowLeft, Loader2, AlertCircle, Trophy } from "lucide-react"
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
      // Success — store the session + go to the portal.
      setSession(data as LeagueAdminSession)
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

      <p className="mt-6 max-w-md text-center text-[11px] leading-relaxed text-muted-foreground">
        By signing up you agree to run leagues honestly. Accounts can be
        deactivated for abuse. Your league is yours — you manage teams,
        schedules, and scorers; other league admins can&apos;t see or edit it.
      </p>
    </div>
  )
}
