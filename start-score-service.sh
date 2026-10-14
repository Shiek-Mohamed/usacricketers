#!/bin/bash
cd /home/z/my-project/mini-services/score-service
while true; do
  bun index.ts >> /home/z/my-project/score-service.log 2>&1
  echo "[wrapper] score-service exited, restarting in 1s..." >> /home/z/my-project/score-service.log 2>&1
  sleep 1
done
