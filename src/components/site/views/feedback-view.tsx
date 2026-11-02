"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { InnerPageLayout } from "@/components/site/inner-layout"
import { NewsletterWidget } from "@/components/site/sidebar-widgets"
import { CustomSidebarBlocks } from "@/components/site/custom-sidebar-blocks"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, MessageSquare, CheckCircle2, Send } from "lucide-react"
import { toast } from "sonner"

const NAVY = "#1e2a5e"

const CATEGORIES = [
  "General",
  "Bug Report",
  "Feature Request",
  "Content Correction",
  "Other",
] as const

export function FeedbackView() {
  const navigate = useAppStore((s) => s.navigate)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [category, setCategory] = useState<string>("General")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = message.trim()
    if (!trimmed) {
      const msg = "Please enter a message"
      setError(msg)
      toast.error(msg)
      return
    }
    if (trimmed.length < 10) {
      const msg = "Message must be at least 10 characters"
      setError(msg)
      toast.error(msg)
      return
    }

    setBusy(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          category,
          message: trimmed,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setDone(true)
        toast.success("Thank you! Your feedback has been received.")
      } else {
        const msg = data?.error || "Something went wrong. Please try again."
        setError(msg)
        toast.error(msg)
      }
    } catch {
      const msg = "Network error. Please try again."
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <InnerPageLayout
      header={
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("home")}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Button>
          <div className="flex items-center gap-3">
            <div
              className="grid h-11 w-11 place-items-center rounded-lg"
              style={{ background: NAVY }}
            >
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Feedback
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Help us improve USACricketers. Share your thoughts, report
                issues, or suggest features.
              </p>
            </div>
          </div>
        </div>
      }
      sidebar={
        <>
          <NewsletterWidget />
          <CustomSidebarBlocks placement="feedback" />
        </>
      }
    >
      {done ? (
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-extrabold">Thank you!</h2>
            <p className="text-sm text-muted-foreground">
              Your feedback has been received. We appreciate you taking the
              time to help us improve USACricketers.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDone(false)
                  setName("")
                  setEmail("")
                  setCategory("General")
                  setMessage("")
                  setError(null)
                }}
              >
                Send another
              </Button>
              <Button
                size="sm"
                onClick={() => navigate("home")}
                className="gap-1.5 text-white"
                style={{ background: NAVY }}
              >
                Back to home
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Name (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="feedback-name">
                    Name{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="feedback-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    maxLength={120}
                    autoComplete="name"
                  />
                </div>

                {/* Email (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="feedback-email">
                    Email{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    maxLength={200}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label htmlFor="feedback-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="feedback-category" className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Message (required) */}
              <div className="space-y-1.5">
                <Label htmlFor="feedback-message">
                  Message{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (required, min 10 characters)
                  </span>
                </Label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  rows={6}
                  required
                  minLength={10}
                  className="min-h-32"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {message.trim().length}/10 characters minimum
                  </span>
                  {message.length > 0 && message.trim().length < 10 && (
                    <span className="text-amber-600">
                      A few more characters...
                    </span>
                  )}
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  We read every submission. Thanks for your input!
                </p>
                <Button
                  type="submit"
                  disabled={busy}
                  className="gap-1.5 text-white"
                  style={{ background: NAVY }}
                >
                  {busy ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Feedback
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </InnerPageLayout>
  )
}
