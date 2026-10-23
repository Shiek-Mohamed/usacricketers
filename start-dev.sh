#!/bin/bash
cd /home/z/my-project
while true; do
  ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1
  echo "[wrapper] next dev exited, restarting in 2s..." >> dev.log 2>&1
  sleep 2
done
