"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/lib/store"
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
import { Shield, Loader2, AlertCircle, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export function AdminLoginView() {
  const navigate = useAppStore((s) => s.navigate)
  const toggleMode = useAppStore((s) => s.toggleMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  // On mount, check if already authenticated (cookie session) → skip login.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/admin/me")
        if (active && res.ok) {
          // Already signed in — enter admin mode.
          toggleMode()
        }
      } catch {
        // ignore — show the login form
      } finally {
        if (active) setChecking(false)
      }
    })()
    return () => { active = false }
  }, [toggleMode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    if (!email.trim() || !password) {
      setError("Enter your email and password")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (res.status === 401) {
        setError("Invalid email or password")
        return
      }
      if (!res.ok) {
        setError(`Sign-in failed (${res.status})`)
        return
      }
      // Cookie is set automatically (httpOnly). Enter admin mode.
      toggleMode()
    } catch {
      setError("Network error — please try again")
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-[#1e2a5e] text-white">
          <Shield className="h-4 w-4" />
        </span>
        <span className="text-sm font-extrabold tracking-tight text-foreground">
          usacricketers
        </span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="gap-1.5 space-y-0 text-center">
          <CardTitle className="text-xl tracking-tight">Admin Sign In</CardTitle>
          <CardDescription className="text-xs">
            Site administrators only. Sign in to manage content, leagues and
            scorers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@usacricketers.com"
                disabled={submitting}
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
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
              className="w-full gap-2 bg-[#1e2a5e] text-white hover:bg-[#1e2a5e]/90"
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

          {/* Forgot password link */}
          <div className="mt-2 flex justify-center">
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => navigate("admin-reset-password")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Button>
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate("home")}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to site
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 max-w-sm text-center text-[11px] leading-relaxed text-muted-foreground">
        League admins and scorers have their own sign-in (via the header
        buttons). This page is for site administrators only.
      </p>
    </div>
  )
}
