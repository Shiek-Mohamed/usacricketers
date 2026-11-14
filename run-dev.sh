#!/usr/bin/env bash
# Self-restarting dev server wrapper.
# Runs next dev in the foreground; when it exits (crash/OOM), restarts
# immediately after a 3s cooldown. Designed to be launched via setsid so
# it survives the parent shell exiting.
exec </dev/null
cd /home/z/my-project

while true; do
  echo "[$(date +%H:%M:%S)] Starting next dev (webpack)..." >> /tmp/watchdog.log
  /usr/local/bin/bun next dev -p 3000 --webpack >> /tmp/dev.log 2>&1
  EXIT_CODE=$?
  echo "[$(date +%H:%M:%S)] next dev exited (code $EXIT_CODE). Restarting in 3s..." >> /tmp/watchdog.log
  # Kill any zombie next-server processes before restarting
  pkill -9 -f "next-server" 2>/dev/null
  pkill -9 -f "next dev" 2>/dev/null
  sleep 3
done
