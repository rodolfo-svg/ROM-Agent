#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://rom-agent-ia-onrender-com.onrender.com}"
REQS="${REQS:-60}"
PAR="${PAR:-12}"

echo "== validate-all =="
BASE_URL="$BASE_URL" REQS="$REQS" PAR="$PAR" bash scripts/validate-all.sh

echo
echo "== P0-1 admin checks =="
if [[ -z "${X_ADMIN_TOKEN:-}" ]]; then
  echo "WARN: X_ADMIN_TOKEN não definido; pulando /admin/*"
  exit 0
fi

echo "-- GET /admin/flags --"
curl -fsS -H "X-Admin-Token: $X_ADMIN_TOKEN" "$BASE_URL/admin/flags" | python3 -m json.tool

echo "-- POST /admin/reload-flags --"
curl -fsS -X POST -H "X-Admin-Token: $X_ADMIN_TOKEN" "$BASE_URL/admin/reload-flags" >/dev/null
echo "OK: admin endpoints"
