#!/usr/bin/env bash
# Builds a preview APK for Android via EAS.
# eas-cli is fetched on the fly with npx so it stays out of package.json.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/frontend"

exec npx --yes eas-cli@latest build \
  --platform android \
  --profile preview \
  "$@"
