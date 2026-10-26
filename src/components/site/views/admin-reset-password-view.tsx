"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, KeyRound, Mail, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

const NAVY = "#1e2a5e"

export function AdminResetPasswordView() {
  const navigate = useAppStore((s) => s.navigate)
  const initialToken = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token") || ""
    : ""
  const [mode] = useState<"request" | "reset">(
    initialToken ? "reset" : "request"
  )
  const [email, setEmail] = useState("")
  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [requested, setRequested] = useState(false)
  const [done, setDone] = useState(false)

  async function handleRequest() {
    if (!email.trim()) {
      toast.error("Enter your email address")
      return
    }
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/reset-password?request=1&email=${encodeURIComponent(email.trim())}`,
        { method: "GET" }
      )
      const data = await res.json()
      setRequested(true)
      if (data.resetUrl) {
        toast.success("Reset link generated (dev mode)", {
          description: "Check the console or use the link below.",
        })
      } else {
        toast.success("If an account exists, a reset link has been sent.")
      }
    } catch {
      toast.error("Request failed")
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    if (!token.trim()) {
      toast.error("Reset token is missing")
      return
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }
    if (password !== confirm) {
      toast.error("Passwords don't match")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      })
      const data = await res.json()
      if (res.ok) {
        setDone(true)
        toast.success("Password updated — sign in with your new password")
      } else {
        toast.error(data.error || "Reset failed")
      }
    } catch {
      toast.error("Reset failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#1e2a5e]">
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("admin-login")}
            className="gap-1 text-white/70 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Button>

          {done ? (
            <Card className="text-center">
              <CardContent className="space-y-4 p-8">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h1 className="text-xl font-extrabold">Password Updated</h1>
                <p className="text-sm text-muted-foreground">
                  Your password has been changed. Sign in with your new password.
                </p>
                <Button
                  onClick={() => navigate("admin-login")}
                  className="w-full gap-2 text-white"
                  style={{ background: NAVY }}
                >
                  <KeyRound className="h-4 w-4" /> Sign in
                </Button>
              </CardContent>
            </Card>
          ) : mode === "reset" ? (
            <Card>
              <CardContent className="space-y-5 p-8">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: NAVY }}>
                  <KeyRound className="h-7 w-7 text-white" />
                </div>
                <div className="text-center">
                  <h1 className="text-2xl font-extrabold tracking-tight">Set New Password</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your new password below.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your new password"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleReset}
                  disabled={busy}
                  className="w-full gap-2 text-white"
                  style={{ background: NAVY }}
                >
                  {busy ? "Updating…" : "Update password"}
                </Button>
              </CardContent>
            </Card>
          ) : requested ? (
            <Card>
              <CardContent className="space-y-4 p-8 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: NAVY }}>
                  <Mail className="h-7 w-7 text-white" />
                </div>
                <h1 className="text-xl font-extrabold">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  If an account exists for <strong>{email}</strong>, a password reset
                  link has been generated.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("admin-login")}
                >
                  Back to sign in
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-5 p-8">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: NAVY }}>
                  <KeyRound className="h-7 w-7 text-white" />
                </div>
                <div className="text-center">
                  <h1 className="text-2xl font-extrabold tracking-tight">Forgot Password?</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your email and we&apos;ll send a reset link.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    onKeyDown={(e) => e.key === "Enter" && handleRequest()}
                  />
                </div>
                <Button
                  onClick={handleRequest}
                  disabled={busy}
                  className="w-full gap-2 text-white"
                  style={{ background: NAVY }}
                >
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
