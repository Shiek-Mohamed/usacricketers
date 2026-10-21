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
import { Shield, ArrowLeft, Loader2, AlertCircle } from "lucide-react"
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

          <div className="mt-4 flex justify-center">
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
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 max-w-sm text-center text-[11px] leading-relaxed text-muted-foreground">
        League admin accounts are created by a site administrator. If you
        can&apos;t sign in, contact the site team.
      </p>
    </div>
  )
}
