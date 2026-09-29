#!/usr/bin/env bash
# REST load test with ApacheBench (package apache2-utils).
#   N=5000 C=100 ./bench/rest-ab.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f sessions.json ]; then
  echo "Run 'npm run bench:seed' first." >&2
  exit 1
fi
command -v ab >/dev/null || { echo "ab not found: install apache2-utils" >&2; exit 1; }

API=$(node -e "console.log(require('./sessions.json').api)")
# ab (macOS) resolves "localhost" to IPv6 ::1 and fails ("Invalid argument"): force IPv4
API=${API/localhost/127.0.0.1}
TOKEN=$(node -e "console.log(require('./sessions.json').sessions[0].token)")
EVENT=$(node -e "console.log(require('./sessions.json').eventId)")
N=${N:-5000}
C=${C:-100}

for path in "/api/health" "/api/events" "/api/events/$EVENT" "/api/profile"; do
  echo "================ GET $path  (n=$N, c=$C)"
  ab -q -n "$N" -c "$C" -H "Authorization: Bearer $TOKEN" -H "X-Platform: bench" -H "X-Device: ab" "$API$path" \
    | grep -E "Requests per second|Time per request|Failed requests|Non-2xx|50%|95%|99%|100%"
done
