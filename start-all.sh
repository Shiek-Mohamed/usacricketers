#!/bin/bash
# start-all.sh — entrypoint that runs Caddy gateway + Next.js app (port 3000)
# + the score-service mini-service (port 3003) concurrently. Used by the
# Docker container's CMD.

set -e

# Write the z-ai-web-dev-sdk config from the ZAI_CONFIG Fly secret. The SDK
# reads process.cwd()/.z-ai-config (= /app/.z-ai-config) at runtime — without
# it, /api/ai-commentary fails with "Configuration file not found" and NO AI
# commentary (text OR audio) is generated on prod. The config is gitignored +
# never baked into the image; it's injected as a runtime secret instead.
if [ -n "$ZAI_CONFIG" ]; then
  printf '%s' "$ZAI_CONFIG" > /app/.z-ai-config
  chmod 600 /app/.z-ai-config
  echo "🤖 z-ai config written (AI commentary + TTS enabled)"
else
  echo "⚠️ ZAI_CONFIG secret not set — AI commentary + TTS will be unavailable"
fi

# Push the Prisma schema to PostgreSQL (creates tables if they don't exist).
# Idempotent — safe to run on every boot. Non-fatal (app can start even
# if this fails, e.g. during a temporary DB outage).
echo "📦 Pushing Prisma schema to PostgreSQL..."
cd /app
# Invoke the prisma CLI directly (not via npx) — npx can fail to resolve the
# local prisma binary on boot and silently no-op, leaving new tables uncreated.
node /app/node_modules/prisma/build/index.js db push --accept-data-loss 2>&1 || echo "⚠️ prisma db push failed (exit $?) — continuing with existing schema"
echo "📦 Ensuring required tables exist (raw-SQL fallback)..."
node /app/ensure-schema.js 2>&1 || echo "⚠️ ensure-schema failed — continuing"

# Migrate data from SQLite (runs only if the database is empty — idempotent)
echo "📦 Running data migration (SQLite → PostgreSQL)..."
node migrate-to-postgres.js 2>&1 || echo "⚠️ migration script failed — app will start with current data"

# Start the score-service in the background (port 3003)
echo "🏏 Starting score-service on port 3003..."
cd /app/mini-services/score-service
bun install --frozen-lockfile 2>/dev/null || bun install
bun index.ts &
SCORE_PID=$!

# Start the Next.js app (port 3000)
echo "🚀 Starting Next.js on port 3000..."
cd /app
node server.js &
NEXT_PID=$!

# Start Caddy gateway (port 8080) — routes ?XTransformPort=3003 to the
# score-service (WebSocket) and everything else to Next.js.
echo "🌐 Starting Caddy gateway on port 8080..."
caddy run --config /app/Caddyfile --adapter caddyfile &
CADDY_PID=$!

# Wait for any to exit
wait -n $SCORE_PID $NEXT_PID $CADDY_PID
EXIT_CODE=$?

# Kill the others
kill $SCORE_PID $NEXT_PID $CADDY_PID 2>/dev/null || true
exit $EXIT_CODE
