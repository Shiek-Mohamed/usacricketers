#!/bin/bash
# scripts/cron-refresh.sh — runs all CricAPI data refresh scripts.
# Called by the cron daemon every 3 hours on the Fly VM.
#
# Keeps match data fresh: live scores update, upcoming matches appear,
# completed matches get scorecards, stale statuses get cleaned up.
#
# CricAPI free tier: 100 requests/day. This script uses ~2-3 per run.
# At 8 runs/day (every 3 hours) = ~24 requests/day — well within limit.

set -e
cd /app

LOG="/tmp/cron-refresh.log"
echo "========================================" > "$LOG"
echo "Cron refresh: $(date -u '+%Y-%m-%d %H:%M:%S UTC')" >> "$LOG"
echo "========================================" >> "$LOG"

# 1. Scrape live + recent matches (1 API call to /currentMatches)
echo "" >> "$LOG"
echo "→ Scraping current matches..." >> "$LOG"
/usr/local/bin/bun run scripts/scrape-cricapi.ts --save --no-scorecard >> "$LOG" 2>&1 || true

# 2. Fetch upcoming fixtures (1 API call to /matches)
echo "" >> "$LOG"
echo "→ Fetching upcoming matches..." >> "$LOG"
/usr/local/bin/bun run scripts/fetch-upcoming-matches.ts >> "$LOG" 2>&1 || true

# 3. Cleanup stale statuses (no API calls)
echo "" >> "$LOG"
echo "→ Cleaning up stale match statuses..." >> "$LOG"
/usr/local/bin/bun run scripts/cleanup-stale-matches.ts >> "$LOG" 2>&1 || true

# 4. Fetch scorecards for matches that don't have them yet (1 API call per match)
# Only run if we have API budget — check the current hit count first
echo "" >> "$LOG"
echo "→ Fetching missing scorecards..." >> "$LOG"
/usr/local/bin/bun run scripts/fetch-scorecards.ts >> "$LOG" 2>&1 || true

# 5. Backfill player stats from any new scorecards (no API calls)
echo "" >> "$LOG"
echo "→ Backfilling player stats..." >> "$LOG"
/usr/local/bin/bun run scripts/backfill-player-stats.ts >> "$LOG" 2>&1 || true

echo "" >> "$LOG"
echo "✓ Cron refresh complete: $(date -u '+%Y-%m-%d %H:%M:%S UTC')" >> "$LOG"

# Check upload volume usage (volume limit: 1024MB = 1GB)
UPLOAD_SIZE=$(du -sm /app/db/uploads/ 2>/dev/null | cut -f1)
if [ -n "$UPLOAD_SIZE" ]; then
  echo "" >> "$LOG"
  echo "📦 Upload directory: ${UPLOAD_SIZE}MB / 1024MB" >> "$LOG"
  if [ "$UPLOAD_SIZE" -gt 800 ]; then
    echo "⚠️  WARNING: Upload directory is over 800MB — consider cleaning up" >> "$LOG"
    echo "  Run: bun run scripts/check-uploads.ts --cleanup" >> "$LOG"
  fi
fi
