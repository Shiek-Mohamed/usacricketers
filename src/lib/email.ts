import { Resend } from "resend"

/**
 * Email helper built on Resend (https://resend.com — free tier = 100 emails/day).
 *
 * Set RESEND_API_KEY in .env to enable real email delivery. If the env var
 * is missing (e.g. in dev without a key configured), emails are logged to
 * the console as a "would-send" preview — the verification flow can still
 * be tested because the verification URL gets printed to the server log.
 *
 * From address: defaults to a noreply@usacricketers.com address; override
 * via FROM_EMAIL env var. (When deploying for real, set up a verified
 * sending domain in Resend's dashboard — otherwise Resend limits you to
 * sending from onboarding@resend.dev which is the test-only sandbox.)
 *
 * Base URL: used to build absolute links in email bodies. Set
 * NEXT_PUBLIC_BASE_URL in production (e.g. https://usacricketers.com).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || ""
const FROM_EMAIL =
  process.env.FROM_EMAIL || "USACricketers <onboarding@resend.dev>"
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

// Lazy-init the client so the module doesn't crash on import when the
// API key is missing (dev mode without Resend configured).
let _client: Resend | null = null
function client(): Resend | null {
  if (!RESEND_API_KEY) return null
  if (!_client) _client = new Resend(RESEND_API_KEY)
  return _client
}

export interface SendEmailResult {
  ok: boolean
  error?: string
  /** True when the email was logged to console instead of actually sent
   * (i.e. RESEND_API_KEY not configured). Useful for dev-mode UX. */
  devMode?: boolean
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html?: string
  text?: string
}): Promise<SendEmailResult> {
  const c = client()
  if (!c) {
    // Dev mode — log to console so the verification URL can be picked up
    // from the dev.log during local testing.
    console.log(
      `[email:dev-mode] ────────────────────────────────────────────`
    )
    console.log(`[email:dev-mode] To:      ${to}`)
    console.log(`[email:dev-mode] Subject: ${subject}`)
    console.log(`[email:dev-mode] Text:    ${text ?? "(no text body)"}`)
    if (html) {
      console.log(
        `[email:dev-mode] HTML:    ${html.slice(0, 300)}${html.length > 300 ? "..." : ""}`
      )
    }
    console.log(`[email:dev-mode] ────────────────────────────────────────────`)
    return { ok: true, devMode: true }
  }

  try {
    const { error } = await c.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    })
    if (error) {
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) }
  }
}

/**
 * Send a league-admin email verification email.
 *
 * The `verifyUrl` should be a fully-qualified URL pointing at the
 * /api/league-admin/verify-email?token=XXX endpoint — the caller builds it.
 */
export async function sendVerificationEmail({
  to,
  name,
  verifyUrl,
}: {
  to: string
  name: string
  verifyUrl: string
}): Promise<SendEmailResult> {
  const subject = "Verify your USACricketers league admin account"
  const text = `Hi ${name},

Please verify your email address by clicking the link below:

${verifyUrl}

This link expires in 24 hours. If you didn't sign up for a USACricketers league admin account, you can safely ignore this email.

— USACricketers`
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.5;">
  <h1 style="color: #b91c1c; font-size: 22px; margin: 0 0 16px 0;">Verify your email</h1>
  <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(name)},</p>
  <p style="margin: 0 0 24px 0;">Please verify your email address to activate your USACricketers league admin account.</p>
  <p style="margin: 24px 0;">
    <a href="${escapeAttr(verifyUrl)}" style="background: #b91c1c; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600;">Verify email</a>
  </p>
  <p style="font-size: 13px; color: #64748b; margin: 16px 0 0 0;">
    Or paste this link into your browser:<br>
    <a href="${escapeAttr(verifyUrl)}" style="color: #b91c1c; word-break: break-all;">${escapeHtml(verifyUrl)}</a>
  </p>
  <p style="font-size: 13px; color: #64748b; margin: 16px 0 0 0;">This link expires in 24 hours.</p>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
  <p style="font-size: 12px; color: #94a3b8; margin: 0 0 4px 0;">If you didn't sign up for a USACricketers league admin account, you can safely ignore this email.</p>
  <p style="font-size: 12px; color: #94a3b8; margin: 0;">— USACricketers</p>
</body>
</html>`
  return sendEmail({ to, subject, html, text })
}

/** Helper: HTML-escape user-supplied strings before injecting into email HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Helper: HTML-attribute-escape (for href values). */
function escapeAttr(s: string): string {
  return escapeHtml(s)
}

/** Exposed so callers can build absolute URLs for email bodies. */
export function getBaseUrl(): string {
  return BASE_URL
}
