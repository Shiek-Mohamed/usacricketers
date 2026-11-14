#!/usr/bin/env bash
# Watchdog: keeps the Next.js dev server alive on port 3000.
# Checks every 8s; restarts if the port stops listening.
# Logs to /tmp/dev.log (overwritten on each restart).
set -u

PORT=3000
LOG=/tmp/dev.log
PIDFILE=/tmp/dev-server.pid

is_listening() {
  ss -tlnp 2>/dev/null | grep -q ":${PORT} "
}

start_server() {
  # Fully detach so it survives this shell exiting
  setsid bash -c "exec /usr/local/bin/bun next dev -p ${PORT} > ${LOG} 2>&1" \
    < /dev/null > /dev/null 2>&1 &
  local pid=$!
  echo "$pid" > "$PIDFILE"
  echo "[$(date +%H:%M:%S)] Started dev server (pid $pid)" >> /tmp/watchdog.log
}

# Main loop
while true; do
  if ! is_listening; then
    # Kill any zombie next processes first
    pkill -9 -f "next-server" 2>/dev/null
    pkill -9 -f "bun next dev" 2>/dev/null
    sleep 2
    start_server
    # Give it time to bind
    sleep 12
  fi
  sleep 8
done
