import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { requireSiteAdmin } from "@/lib/scorer-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads")
const MAX_IMAGE = 10 * 1024 * 1024
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]

function randomName(ext: string): string {
  return Buffer.from(Math.random().toString(36).slice(2) + Date.now().toString(36)).toString("hex").slice(0, 16) + "." + ext
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png": return "png"
    case "image/jpeg": return "jpg"
    case "image/webp": return "webp"
    case "image/gif": return "gif"
    default: return "jpg"
  }
}

export async function POST(req: NextRequest) {
  const admin = requireSiteAdmin(req)
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File) || !file.size)
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (file.size > MAX_IMAGE)
      return NextResponse.json({ error: `File too large (max ${MAX_IMAGE / 1024 / 1024}MB)` }, { status: 413 })
    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 415 })
    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true })
    const ext = getExtension(file.type)
    const filename = randomName(ext)
    const filepath = path.join(UPLOAD_DIR, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filepath, buffer)
    return NextResponse.json({ url: `/api/uploads/${filename}`, filename })
  } catch (e: any) {
    console.error("[upload] Error:", e)
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 })
  }
}
