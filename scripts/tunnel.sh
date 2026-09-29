#!/usr/bin/env bash
# Starts a cloudflared quick tunnel to http://localhost:3000, captures the
# public URL, and propagates it to frontend/.env and frontend/eas.json.
# Keeps the tunnel in the foreground — Ctrl+C stops it and cleans up.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

CLOUDFLARED="$ROOT_DIR/backend/node_modules/.bin/cloudflared"
if [ ! -x "$CLOUDFLARED" ]; then
  echo "cloudflared not found at $CLOUDFLARED"
  echo "Run 'make install' first."
  exit 1
fi

LOG=$(mktemp)
TUNNEL_PID=""
cleanup() {
  echo ""
  echo "Stopping tunnel..."
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  [ -n "$TUNNEL_PID" ] && wait "$TUNNEL_PID" 2>/dev/null || true
  rm -f "$LOG"
}
trap cleanup EXIT INT TERM

echo "Starting cloudflared tunnel to http://localhost:3000..."
"$CLOUDFLARED" tunnel --url http://localhost:3000 > "$LOG" 2>&1 &
TUNNEL_PID=$!

URL=""
for _ in $(seq 1 30); do
  URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Timed out waiting for the tunnel URL. Last logs:"
  tail -20 "$LOG"
  exit 1
fi

echo ""
echo "Tunnel URL: $URL"
echo ""

# --- Update frontend/.env ---
if [ -f frontend/.env ]; then
  sed -i.bak "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=$URL|" frontend/.env
  rm -f frontend/.env.bak
  echo "  -> frontend/.env updated"
fi

# --- Update frontend/eas.json ---
TUNNEL_URL="$URL" python3 - <<'PYEOF'
import json, os
url = os.environ['TUNNEL_URL']
with open('frontend/eas.json') as f:
    data = json.load(f)
env = data['build']['preview'].setdefault('env', {})
env['EXPO_PUBLIC_API_URL'] = url
# Keep the two public OAuth IDs in sync with app.json extra
with open('frontend/app.json') as f:
    app = json.load(f)
extra = app.get('expo', {}).get('extra', {})
if extra.get('googleWebClientId'):
    env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'] = extra['googleWebClientId']
if extra.get('facebookAppId'):
    env['EXPO_PUBLIC_FACEBOOK_APP_ID'] = extra['facebookAppId']
with open('frontend/eas.json', 'w') as f:
    json.dump(data, f, indent=2)
print('  -> frontend/eas.json updated')
PYEOF

echo ""
echo "Tunnel running. Press Ctrl+C to stop."
echo "Rebuild the APK with: make build-android"
echo ""

wait "$TUNNEL_PID"
