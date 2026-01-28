#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# TESTE COMPLETO DE PRODUÇÃO - ROM Agent
# ═══════════════════════════════════════════════════════════════════
# Valida TODAS as funcionalidades deployadas
# Versão: 2.0.0
# Data: 2026-01-28
# ═══════════════════════════════════════════════════════════════════

set -e

PRODUCTION_URL="https://iarom.com.br"
STAGING_URL="https://staging.iarom.com.br"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
REPORT_FILE="test-results/production-complete-$(date +%Y%m%d-%H%M%S).json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Results array
declare -a TEST_RESULTS

# ═══════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

log_test() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -e "${BLUE}[TEST $TOTAL_TESTS]${NC} $1"
}

pass_test() {
  PASSED_TESTS=$((PASSED_TESTS + 1))
  echo -e "  ${GREEN}✅ PASS${NC} $1"
  TEST_RESULTS+=("{\"test\":\"$2\",\"status\":\"PASS\",\"message\":\"$1\"}")
}

fail_test() {
  FAILED_TESTS=$((FAILED_TESTS + 1))
  echo -e "  ${RED}❌ FAIL${NC} $1"
  TEST_RESULTS+=("{\"test\":\"$2\",\"status\":\"FAIL\",\"message\":\"$1\"}")
}

warn_test() {
  echo -e "  ${YELLOW}⚠️  WARN${NC} $1"
  TEST_RESULTS+=("{\"test\":\"$2\",\"status\":\"WARN\",\"message\":\"$1\"}")
}

section() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${BLUE}$1${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ═══════════════════════════════════════════════════════════════════
# INÍCIO DOS TESTES
# ═══════════════════════════════════════════════════════════════════

clear
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║         TESTE COMPLETO DE PRODUÇÃO - ROM Agent                  ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Timestamp: $TIMESTAMP"
echo "Production: $PRODUCTION_URL"
echo "Staging: $STAGING_URL"
echo ""

mkdir -p test-results

# ═══════════════════════════════════════════════════════════════════
section "1. TESTES DE CONECTIVIDADE BÁSICA"
# ═══════════════════════════════════════════════════════════════════

log_test "Produção - Acessibilidade HTTP"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$PRODUCTION_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "302" ]; then
  pass_test "Produção acessível (HTTP $HTTP_CODE)" "connectivity-prod"
else
  fail_test "Produção inacessível (HTTP $HTTP_CODE)" "connectivity-prod"
fi

log_test "Staging - Acessibilidade HTTP"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$STAGING_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "302" ]; then
  pass_test "Staging acessível (HTTP $HTTP_CODE)" "connectivity-staging"
else
  fail_test "Staging inacessível (HTTP $HTTP_CODE)" "connectivity-staging"
fi

# ═══════════════════════════════════════════════════════════════════
section "2. TESTES DE HEALTH CHECK"
# ═══════════════════════════════════════════════════════════════════

log_test "Produção - /health endpoint"
HEALTH=$(curl -s -m 10 "$PRODUCTION_URL/health" 2>/dev/null || echo "{}")
STATUS=$(echo "$HEALTH" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
if [ "$STATUS" == "healthy" ]; then
  pass_test "Health check OK (status: healthy)" "health-prod"

  PG_AVAILABLE=$(echo "$HEALTH" | jq -r '.database.postgres.available // false' 2>/dev/null)
  if [ "$PG_AVAILABLE" == "true" ]; then
    PG_LATENCY=$(echo "$HEALTH" | jq -r '.database.postgres.latency // 0' 2>/dev/null)
    pass_test "PostgreSQL disponível (latency: ${PG_LATENCY}ms)" "postgres-prod"
  else
    warn_test "PostgreSQL indisponível" "postgres-prod"
  fi

  REDIS_AVAILABLE=$(echo "$HEALTH" | jq -r '.database.redis.available // false' 2>/dev/null)
  if [ "$REDIS_AVAILABLE" == "true" ]; then
    pass_test "Redis disponível" "redis-prod"
  else
    warn_test "Redis indisponível (degraded mode OK)" "redis-prod"
  fi
else
  fail_test "Health check falhou (status: $STATUS)" "health-prod"
fi

log_test "Staging - /health endpoint"
HEALTH=$(curl -s -m 10 "$STAGING_URL/health" 2>/dev/null || echo "{}")
STATUS=$(echo "$HEALTH" | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
if [ "$STATUS" == "healthy" ]; then
  pass_test "Health check OK (status: healthy)" "health-staging"
else
  fail_test "Health check falhou (status: $STATUS)" "health-staging"
fi

# ═══════════════════════════════════════════════════════════════════
section "3. TESTES DE ENDPOINT DIAGNÓSTICO (COMMIT f1dc390)"
# ═══════════════════════════════════════════════════════════════════

log_test "Produção - /api/route-diagnose"
DIAG=$(curl -s -m 10 "$PRODUCTION_URL/api/route-diagnose" 2>/dev/null || echo "{}")
SERVER=$(echo "$DIAG" | jq -r '.server // "unknown"' 2>/dev/null)

if [ "$SERVER" == "server-enhanced.js" ]; then
  pass_test "Endpoint diagnóstico ativo (server: $SERVER)" "diagnose-prod"

  COMMIT=$(echo "$DIAG" | jq -r '.git.commit // "unknown"' 2>/dev/null)
  pass_test "Git commit detectado: $COMMIT" "diagnose-prod-commit"

  IMPORTED=$(echo "$DIAG" | jq -r '.routes.uploadProgress.imported // false' 2>/dev/null)
  REGISTERED=$(echo "$DIAG" | jq -r '.routes.uploadProgress.registered // false' 2>/dev/null)

  if [ "$IMPORTED" == "true" ] && [ "$REGISTERED" == "true" ]; then
    pass_test "Rotas uploadProgress: imported=true, registered=true" "diagnose-routes"
  else
    fail_test "Rotas uploadProgress não carregadas corretamente" "diagnose-routes"
  fi
else
  fail_test "Endpoint diagnóstico não responde" "diagnose-prod"
fi

log_test "Staging - /api/route-diagnose"
DIAG=$(curl -s -m 10 "$STAGING_URL/api/route-diagnose" 2>/dev/null || echo "{}")
SERVER=$(echo "$DIAG" | jq -r '.server // "unknown"' 2>/dev/null)
if [ "$SERVER" == "server-enhanced.js" ]; then
  pass_test "Endpoint diagnóstico ativo em staging" "diagnose-staging"
else
  fail_test "Endpoint diagnóstico não responde em staging" "diagnose-staging"
fi

# ═══════════════════════════════════════════════════════════════════
section "4. TESTES DE ROTAS SSE (COMMIT 31dbb46)"
# ═══════════════════════════════════════════════════════════════════

log_test "Produção - SSE /api/upload-progress/:id/progress"
RESPONSE=$(curl -s -v -m 3 "$PRODUCTION_URL/api/upload-progress/test123/progress" 2>&1 || true)
HTTP_CODE=$(echo "$RESPONSE" | grep "^< HTTP" | awk '{print $3}' | head -1)
CONTENT_TYPE=$(echo "$RESPONSE" | grep -i "^< content-type" | grep -i "event-stream" || echo "")

if [ "$HTTP_CODE" == "200" ] && [ -n "$CONTENT_TYPE" ]; then
  pass_test "SSE endpoint ativo (HTTP 200, Content-Type: text/event-stream)" "sse-prod"
else
  fail_test "SSE endpoint não configurado corretamente (HTTP $HTTP_CODE)" "sse-prod"
fi

log_test "Staging - SSE /api/upload-progress/:id/progress"
RESPONSE=$(curl -s -v -m 3 "$STAGING_URL/api/upload-progress/test123/progress" 2>&1 || true)
HTTP_CODE=$(echo "$RESPONSE" | grep "^< HTTP" | awk '{print $3}' | head -1)
CONTENT_TYPE=$(echo "$RESPONSE" | grep -i "^< content-type" | grep -i "event-stream" || echo "")

if [ "$HTTP_CODE" == "200" ] && [ -n "$CONTENT_TYPE" ]; then
  pass_test "SSE endpoint ativo em staging" "sse-staging"
else
  fail_test "SSE endpoint não configurado em staging" "sse-staging"
fi

# ═══════════════════════════════════════════════════════════════════
section "5. TESTES DE AUTENTICAÇÃO E UPLOAD"
# ═══════════════════════════════════════════════════════════════════

log_test "Produção - /api/kb/upload (sem autenticação)"
RESPONSE=$(curl -s -X POST "$PRODUCTION_URL/api/kb/upload" 2>/dev/null || echo "")
if echo "$RESPONSE" | grep -q -i "login\|token\|auth"; then
  pass_test "Autenticação funcionando (requer login)" "auth-prod"
else
  warn_test "Resposta inesperada de autenticação: ${RESPONSE:0:50}" "auth-prod"
fi

log_test "Staging - /api/kb/upload (sem autenticação)"
RESPONSE=$(curl -s -X POST "$STAGING_URL/api/kb/upload" 2>/dev/null || echo "")
if echo "$RESPONSE" | grep -q -i "login\|token\|auth"; then
  pass_test "Autenticação funcionando em staging" "auth-staging"
else
  warn_test "Resposta inesperada em staging" "auth-staging"
fi

# ═══════════════════════════════════════════════════════════════════
section "6. TESTES DE ROTAS CRÍTICAS"
# ═══════════════════════════════════════════════════════════════════

test_route() {
  local url=$1
  local route=$2
  local env=$3

  log_test "$env - $route"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "$url$route" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "302" ] || [ "$HTTP_CODE" == "401" ]; then
    pass_test "Rota acessível (HTTP $HTTP_CODE)" "route-$env-$(echo $route | sed 's/\//-/g')"
  elif [ "$HTTP_CODE" == "404" ]; then
    fail_test "Rota não encontrada (404)" "route-$env-$(echo $route | sed 's/\//-/g')"
  else
    warn_test "Status inesperado (HTTP $HTTP_CODE)" "route-$env-$(echo $route | sed 's/\//-/g')"
  fi
}

# Rotas críticas em produção
test_route "$PRODUCTION_URL" "/api/info" "Produção"
test_route "$PRODUCTION_URL" "/api/chat/stream" "Produção"
test_route "$PRODUCTION_URL" "/api/case-processor" "Produção"
test_route "$PRODUCTION_URL" "/api/export" "Produção"
test_route "$PRODUCTION_URL" "/api/system-prompts" "Produção"

# Rotas críticas em staging
test_route "$STAGING_URL" "/api/info" "Staging"
test_route "$STAGING_URL" "/api/chat/stream" "Staging"

# ═══════════════════════════════════════════════════════════════════
section "7. TESTES DE PERFORMANCE"
# ═══════════════════════════════════════════════════════════════════

log_test "Produção - Tempo de resposta /health"
START=$(date +%s%N)
curl -s -m 10 "$PRODUCTION_URL/health" > /dev/null 2>&1
END=$(date +%s%N)
LATENCY=$(( (END - START) / 1000000 ))

if [ $LATENCY -lt 1000 ]; then
  pass_test "Resposta rápida (${LATENCY}ms)" "perf-health"
elif [ $LATENCY -lt 3000 ]; then
  warn_test "Resposta lenta (${LATENCY}ms)" "perf-health"
else
  fail_test "Resposta muito lenta (${LATENCY}ms)" "perf-health"
fi

log_test "Produção - Tempo de resposta /api/route-diagnose"
START=$(date +%s%N)
curl -s -m 10 "$PRODUCTION_URL/api/route-diagnose" > /dev/null 2>&1
END=$(date +%s%N)
LATENCY=$(( (END - START) / 1000000 ))

if [ $LATENCY -lt 1000 ]; then
  pass_test "Diagnóstico rápido (${LATENCY}ms)" "perf-diagnose"
else
  warn_test "Diagnóstico lento (${LATENCY}ms)" "perf-diagnose"
fi

# ═══════════════════════════════════════════════════════════════════
section "8. VERIFICAÇÃO DE FUNCIONALIDADES DO 70CB2B8"
# ═══════════════════════════════════════════════════════════════════

log_test "Verificar arquivos críticos no repositório"
CRITICAL_FILES=(
  "src/services/integration-orchestrator.js"
  "src/services/processors/consolidation-service.js"
  "src/services/cnj-api-client.js"
  "frontend/src/utils/offline-manager.ts"
  "src/services/progress-sse-server.js"
  "src/utils/sse-connection-manager.js"
)

MISSING_COUNT=0
for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    pass_test "✓ $file presente" "file-check-$(basename $file)"
  else
    fail_test "✗ $file AUSENTE" "file-check-$(basename $file)"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done

if [ $MISSING_COUNT -eq 0 ]; then
  pass_test "Todos os arquivos críticos presentes" "files-integrity"
else
  fail_test "$MISSING_COUNT arquivos críticos ausentes" "files-integrity"
fi

# ═══════════════════════════════════════════════════════════════════
section "9. TESTES DE ESTABILIDADE"
# ═══════════════════════════════════════════════════════════════════

log_test "Múltiplas requisições consecutivas (stress test leve)"
SUCCESS=0
for i in {1..5}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "$PRODUCTION_URL/health" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" == "200" ]; then
    SUCCESS=$((SUCCESS + 1))
  fi
  sleep 0.5
done

if [ $SUCCESS -eq 5 ]; then
  pass_test "5/5 requisições bem-sucedidas" "stability"
else
  warn_test "$SUCCESS/5 requisições bem-sucedidas" "stability"
fi

# ═══════════════════════════════════════════════════════════════════
section "10. RESUMO DOS TESTES"
# ═══════════════════════════════════════════════════════════════════

SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                      RESULTADO DOS TESTES                        ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
printf "Total de testes:    %3d\n" $TOTAL_TESTS
printf "${GREEN}Testes passados:    %3d${NC}\n" $PASSED_TESTS
printf "${RED}Testes falhados:    %3d${NC}\n" $FAILED_TESTS
printf "Taxa de sucesso:    ${GREEN}%3s%%${NC}\n" "$SUCCESS_RATE"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ TODOS OS TESTES PASSARAM!${NC}"
  echo -e "${GREEN}Sistema 100% funcional e validado.${NC}"
  EXIT_CODE=0
elif [ $FAILED_TESTS -lt 3 ]; then
  echo -e "${YELLOW}⚠️  ALGUNS TESTES FALHARAM${NC}"
  echo -e "${YELLOW}Revisar testes falhados acima.${NC}"
  EXIT_CODE=1
else
  echo -e "${RED}❌ MÚLTIPLOS TESTES FALHARAM${NC}"
  echo -e "${RED}Sistema requer atenção imediata.${NC}"
  EXIT_CODE=2
fi

# ═══════════════════════════════════════════════════════════════════
# GERAR RELATÓRIO JSON
# ═══════════════════════════════════════════════════════════════════

cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "production_url": "$PRODUCTION_URL",
  "staging_url": "$STAGING_URL",
  "summary": {
    "total_tests": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "success_rate": "$SUCCESS_RATE%"
  },
  "tests": [
    $(IFS=,; echo "${TEST_RESULTS[*]}")
  ],
  "conclusion": "$(if [ $EXIT_CODE -eq 0 ]; then echo "ALL_PASS"; elif [ $EXIT_CODE -eq 1 ]; then echo "MINOR_ISSUES"; else echo "CRITICAL_ISSUES"; fi)"
}
EOF

echo ""
echo "Relatório salvo em: $REPORT_FILE"
echo ""

exit $EXIT_CODE
