import { NextResponse } from "next/server"
import { SITE_ADMIN_COOKIE } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"

/** POST /api/admin/logout — clears the site-admin session cookie. */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SITE_ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return res
}
