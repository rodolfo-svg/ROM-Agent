#!/bin/bash
# CI Remote - Smoke tests em staging/produção
set -e

BASE_URL="${BASE_URL:-https://staging.iarom.com.br}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

echo "🌐 CI Remote - ROM Agent"
echo "URL: $BASE_URL"
echo "===================================="
echo ""

# Health check
echo "🔍 Testing /health endpoint..."
curl -f -s "$BASE_URL/health" -o /dev/null || {
  echo "❌ Health check failed"
  exit 1
}
echo "✅ Health check passed"
echo ""

# Metrics endpoint
echo "🔍 Testing /metrics endpoint..."
curl -f -s "$BASE_URL/metrics" -o /dev/null || {
  echo "❌ Metrics endpoint failed"
  exit 1
}
echo "✅ Metrics endpoint passed"
echo ""

# Admin endpoints (if ADMIN_TOKEN provided)
if [[ -n "$ADMIN_TOKEN" ]]; then
  echo "🔍 Testing /admin/flags endpoint..."
  flags_response=$(curl -s -w "\n%{http_code}" \
    -H "X-Admin-Token: $ADMIN_TOKEN" \
    "$BASE_URL/admin/flags" || echo "000")

  flags_code=$(echo "$flags_response" | tail -n1)
  if [[ "$flags_code" == "200" ]]; then
    echo "✅ Admin flags endpoint passed"
  else
    echo "❌ Admin flags endpoint failed (HTTP $flags_code)"
    exit 1
  fi
  echo ""

  echo "🔍 Testing /admin/reload-flags endpoint..."
  reload_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "X-Admin-Token: $ADMIN_TOKEN" \
    "$BASE_URL/admin/reload-flags" || echo "000")

  reload_code=$(echo "$reload_response" | tail -n1)
  if [[ "$reload_code" == "200" ]]; then
    echo "✅ Admin reload-flags endpoint passed"
  else
    echo "❌ Admin reload-flags endpoint failed (HTTP $reload_code)"
    exit 1
  fi
  echo ""
else
  echo "⚠️  ADMIN_TOKEN not provided, skipping admin endpoints"
  echo ""
fi

# API basic test (if available)
echo "🔍 Testing /api/chat endpoint (basic)..."
response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"teste", "conversationId":"ci-test"}' || echo "000")

http_code=$(echo "$response" | tail -n1)
if [[ "$http_code" == "200" ]] || [[ "$http_code" == "400" ]] || [[ "$http_code" == "401" ]]; then
  echo "✅ API endpoint responding (HTTP $http_code)"
else
  echo "⚠️  API endpoint returned HTTP $http_code (may need auth)"
fi
echo ""

echo "===================================="
echo "✅ CI REMOTE PASSOU"
echo "===================================="
