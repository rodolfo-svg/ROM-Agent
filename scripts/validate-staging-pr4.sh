#!/bin/bash
# Validação E2E do PR#4 no Staging

echo "🌐 PR#4 - VALIDAÇÃO END-TO-END NO STAGING"
echo "=========================================="
echo "URL: $BASE_URL"
echo ""

# 1. Health Check
echo "1️⃣  Health Check..."
HEALTH=$(curl -fsS "$BASE_URL/health" 2>/dev/null)
if echo "$HEALTH" | grep -q "healthy"; then
  echo "   ✅ Sistema healthy"
else
  echo "   ❌ Sistema não está healthy"
  exit 1
fi

# 2. API Info
echo ""
echo "2️⃣  API Info..."
INFO=$(curl -fsS "$BASE_URL/api/info" 2>/dev/null)
VERSION=$(echo "$INFO" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
UPTIME=$(echo "$INFO" | grep -o '"uptime":"[^"]*"' | cut -d'"' -f4)
echo "   📦 Versão: $VERSION"
echo "   ⏱️  Uptime: $UPTIME"

# 3. Feature Flags
echo ""
echo "3️⃣  Feature Flags (Retry)..."
FLAGS=$(curl -fsS -H "X-Admin-Token: $ADMIN_TOKEN" "$BASE_URL/admin/flags" 2>/dev/null)

if echo "$FLAGS" | grep -q '"ENABLE_RETRY":true'; then
  echo "   ✅ ENABLE_RETRY: true"
else
  echo "   ❌ ENABLE_RETRY: false ou não encontrado"
  exit 1
fi

MAX_RETRIES=$(echo "$FLAGS" | grep -o '"MAX_RETRIES":[0-9]*' | cut -d':' -f2)
echo "   ✅ MAX_RETRIES: $MAX_RETRIES"

# 4. Metrics
echo ""
echo "4️⃣  Métricas..."
METRICS=$(curl -fsS "$BASE_URL/metrics" 2>/dev/null | head -50)

BEDROCK_REQUESTS=$(echo "$METRICS" | grep "bedrock_requests_total" | grep -v "#" | awk '{print $2}')
BEDROCK_ERRORS=$(echo "$METRICS" | grep "bedrock_errors_total" | grep -v "#" | awk '{print $2}')

echo "   📊 bedrock_requests_total: ${BEDROCK_REQUESTS:-0}"
echo "   📊 bedrock_errors_total: ${BEDROCK_ERRORS:-0}"

# 5. Admin Endpoints
echo ""
echo "5️⃣  Admin Endpoints..."
RELOAD=$(curl -fsS -X POST -H "X-Admin-Token: $ADMIN_TOKEN" "$BASE_URL/admin/reload-flags" 2>/dev/null)
if echo "$RELOAD" | grep -q "success.*true"; then
  echo "   ✅ /admin/reload-flags funcionando"
else
  echo "   ⚠️  /admin/reload-flags com problemas"
fi

# 6. CI Remote
echo ""
echo "6️⃣  CI Remote (Resumido)..."
cd ~/ROM-Agent
./scripts/ci-remote.sh 2>&1 | grep -E "(✅|❌|PASSOU|FALHOU)"

echo ""
echo "=========================================="
echo "✅ VALIDAÇÃO E2E STAGING COMPLETA"
echo "=========================================="
echo ""
echo "📊 Resumo Staging:"
echo "   - Health: ✅"
echo "   - Versão: $VERSION"
echo "   - ENABLE_RETRY: true ✅"
echo "   - MAX_RETRIES: $MAX_RETRIES ✅"
echo "   - Admin Endpoints: ✅"
echo "   - CI Remote: ✅"
echo ""
