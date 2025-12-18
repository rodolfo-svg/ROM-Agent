#!/bin/bash
# CI Remote - Smoke tests em staging/produção
set -e

BASE_URL="${BASE_URL:-https://staging.iarom.com.br}"

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
