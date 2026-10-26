#!/bin/bash
# start-all.sh — entrypoint that runs both the Next.js app (port 3000) and
# the score-service mini-service (port 3003) concurrently. Used by the
# Docker container's CMD.

set -e

# Push the Prisma schema to the DB on every container start (idempotent —
# only applies changes, doesn't drop data).
echo "📦 Pushing Prisma schema to DB..."
bunx prisma db push --skip-generate || true

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

# Wait for either to exit
wait -n $SCORE_PID $NEXT_PID
EXIT_CODE=$?

# Kill the other process
kill $SCORE_PID $NEXT_PID 2>/dev/null || true
exit $EXIT_CODE
