#!/bin/bash
# scripts/predeploy.sh — verify critical files exist before deploying.
# Restores any missing files from git so the Docker build always has
# the complete codebase.
#
# Usage: bash scripts/predeploy.sh
# Or via package.json: bun run deploy

set -e
cd "$(dirname "$0")/.."

# Files that have gone missing in the past — check + restore from git.
CRITICAL_FILES=(
  "src/app/api/upload/route.ts"
  "src/app/api/uploads/[name]/route.ts"
  "src/app/api/upload-video/route.ts"
  "src/components/admin/markdown-editor.tsx"
  "src/components/admin/upload-button.tsx"
  "src/components/site/smart-image.tsx"
  "src/components/site/views/home-view.tsx"
  "src/components/site/views/news-view.tsx"
  "src/components/site/views/matches-view.tsx"
  "src/components/admin/views/admin-article-edit-view.tsx"
  "src/components/admin/views/articles-view.tsx"
  "src/components/cricket/mini-scorecard.tsx"
  "src/components/cricket/article-card.tsx"
  "src/components/site/footer.tsx"
  "src/components/site/header.tsx"
  "src/app/sitemap.ts"
  "src/app/rss.xml/route.ts"
  "src/app/og-image/route.tsx"
  "src/lib/store.ts"
  "src/lib/types.ts"
  "src/lib/db.ts"
  "src/lib/scorer-auth.ts"
  "src/lib/serialize.ts"
  "src/lib/scoring.ts"
  "src/lib/dls.ts"
  "next.config.ts"
  "Dockerfile"
  "fly.toml"
  "prisma/schema.prisma"
)

# Directories that should exist
CRITICAL_DIRS=(
  "src/app/api/upload"
  "src/app/api/uploads"
  "src/app/api/upload-video"
  "scripts"
  "mini-services"
  "prisma"
)

RESTORED=0

echo "Pre-deploy file verification..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check directories
for dir in "${CRITICAL_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "⚠️  Missing directory: $dir — restoring from git..."
    git checkout -- "$dir" 2>/dev/null || mkdir -p "$dir"
    RESTORED=$((RESTORED + 1))
  fi
done

# Check files
for file in "${CRITICAL_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  Missing file: $file — restoring from git..."
    git checkout -- "$file" 2>/dev/null || echo "  ✗ Could not restore (not in git or git error)"
    RESTORED=$((RESTORED + 1))
  fi
done

if [ "$RESTORED" -eq 0 ]; then
  echo "✓ All critical files present — ready to deploy."
else
  echo "✓ Restored $RESTORED missing file(s) from git."
fi

# Also verify the upload route specifically (most commonly lost)
if [ ! -f "src/app/api/upload/route.ts" ]; then
  echo "⚠️  Upload route still missing after git restore — recreating..."
  mkdir -p src/app/api/upload
  cat > src/app/api/upload/route.ts << 'ROUTE'
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
ROUTE
  echo "✓ Upload route recreated."
fi

echo ""
echo "Ready for deploy."
