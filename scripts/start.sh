#!/usr/bin/env bash
# Launches the full Music Room dev stack:
#   1. Starts PostgreSQL and (re)creates the schema
#   2. Opens the backend and the cloudflared tunnel in two new terminal tabs
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

echo "→ Launching backend and tunnel..."
if command -v wt.exe >/dev/null 2>&1; then
  wt.exe new-tab --title "Music Room — backend" wsl.exe -e bash -lic "cd '$ROOT_DIR' && make back"  \; \
          new-tab --title "Music Room — tunnel"  wsl.exe -e bash -lic "cd '$ROOT_DIR' && make tunnel"
  echo ""
  echo "✅ Backend and tunnel started in two new tabs."
  echo ""
  echo "Next steps:"
  echo "  - To test the APK: install it on your phone, done."
  echo "  - To develop in Expo Go: run 'make front' in another terminal."
  echo ""
  echo "  Tunnel URL is auto-synced to frontend/.env and frontend/eas.json."
  echo "  Rebuild the APK with: make build-android"
else
  echo "⚠️  wt.exe not found, starting processes in the background."
  nohup make back   > /tmp/music-room-back.log  2>&1 &
  nohup make tunnel > /tmp/music-room-tunnel.log 2>&1 &
  echo "✅ Started. Logs:"
  echo "   Backend → tail -f /tmp/music-room-back.log"
  echo "   Tunnel  → tail -f /tmp/music-room-tunnel.log"
fi
