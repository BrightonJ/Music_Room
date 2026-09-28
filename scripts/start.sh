#!/usr/bin/env bash
# Launches the full Music Room dev stack:
#   1. Starts PostgreSQL and (re)creates the schema
#   2. Opens the backend and frontend in two new terminal tabs
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "→ Starting PostgreSQL..."
make db-up

echo "→ Waiting for PostgreSQL to become healthy..."
for i in $(seq 1 30); do
  status=$(docker inspect -f '{{.State.Health.Status}}' music_room_db 2>/dev/null || echo unknown)
  if [ "$status" = "healthy" ]; then
    echo "   PostgreSQL is healthy."
    break
  fi
  sleep 1
done

echo "→ Creating schema..."
make db-init

echo "→ Launching backend and frontend..."
if command -v wt.exe >/dev/null 2>&1; then
  wt.exe new-tab --title "Music Room — backend"  wsl.exe -e bash -lic "cd '$ROOT_DIR' && make back"  \; \
          new-tab --title "Music Room — frontend" wsl.exe -e bash -lic "cd '$ROOT_DIR' && make front"
  echo ""
  echo "✅ Backend and frontend are starting in two new tabs."
  echo "   Close them (Ctrl+C) when you are done."
else
  echo "⚠️  wt.exe not found (not on Windows Terminal)."
  echo "   Starting both processes in the background instead."
  nohup make back  > /tmp/music-room-back.log  2>&1 &
  nohup make front > /tmp/music-room-front.log 2>&1 &
  echo ""
  echo "✅ Started in background:"
  echo "   Backend  → tail -f /tmp/music-room-back.log"
  echo "   Frontend → tail -f /tmp/music-room-front.log"
fi
