#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ROM AGENT - SMOKE TESTS DE PRODUCAO
# ═══════════════════════════════════════════════════════════════════════════════
# Script independente para validar o ambiente de producao
# Pode ser executado a qualquer momento apos o deploy
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Configuracoes
readonly PROD_URL="${PRODUCTION_URL:-https://iarom.com.br}"
readonly TIMEOUT=30
readonly VERBOSE="${VERBOSE:-false}"

# Cores
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Contadores
PASSED=0
FAILED=0
WARNINGS=0

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCOES
# ═══════════════════════════════════════════════════════════════════════════════

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  PASSED=$((PASSED + 1))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  FAILED=$((FAILED + 1))
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
  WARNINGS=$((WARNINGS + 1))
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

# Teste HTTP simples
test_http() {
  local name=$1
  local url=$2
  local expected_code=$3
  local allow_redirect=${4:-false}

  local actual_code=$(curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 10 \
    --max-time $TIMEOUT \
    -L "$url" 2>/dev/null || echo "000")

  if [[ "$actual_code" == "$expected_code" ]]; then
    log_pass "$name (HTTP $actual_code)"
    return 0
  elif [[ "$allow_redirect" == "true" && ("$actual_code" == "301" || "$actual_code" == "302") ]]; then
    log_pass "$name (HTTP $actual_code - Redirect OK)"
    return 0
  else
    log_fail "$name (esperado: $expected_code, recebido: $actual_code)"
    return 1
  fi
}

# Teste de conteudo
test_content() {
  local name=$1
  local url=$2
  local expected_content=$3

  local response=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null || echo "")

  if echo "$response" | grep -q "$expected_content" 2>/dev/null; then
    log_pass "$name (conteudo encontrado)"
    return 0
  else
    log_fail "$name (conteudo '$expected_content' nao encontrado)"
    if [[ "$VERBOSE" == "true" ]]; then
      echo "  Response: ${response:0:200}..."
    fi
    return 1
  fi
}

# Teste de latencia
test_latency() {
  local name=$1
  local url=$2
  local max_ms=$3

  local time_ms=$(curl -s -o /dev/null -w "%{time_total}" \
    --max-time $TIMEOUT \
    "$url" 2>/dev/null | awk '{print int($1 * 1000)}')

  if [[ "$time_ms" -lt "$max_ms" ]]; then
    log_pass "$name (${time_ms}ms < ${max_ms}ms)"
    return 0
  else
    log_warn "$name (${time_ms}ms >= ${max_ms}ms - lento)"
    return 1
  fi
}

# Teste de headers de seguranca
test_security_headers() {
  local name=$1
  local url=$2

  local headers=$(curl -sI --max-time $TIMEOUT "$url" 2>/dev/null || echo "")
  local missing=0

  # Verificar headers importantes
  if ! echo "$headers" | grep -qi "X-Frame-Options"; then
    missing=$((missing + 1))
  fi

  if ! echo "$headers" | grep -qi "X-Content-Type-Options"; then
    missing=$((missing + 1))
  fi

  if [[ $missing -eq 0 ]]; then
    log_pass "$name (headers de seguranca presentes)"
    return 0
  else
    log_warn "$name ($missing headers de seguranca ausentes)"
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# SUITE DE TESTES
# ═══════════════════════════════════════════════════════════════════════════════

run_smoke_tests() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo -e "${BLUE}ROM AGENT - SMOKE TESTS DE PRODUCAO${NC}"
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo "URL de Producao: ${PROD_URL}"
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo ""

  # ─────────────────────────────────────────────────────────────────────────────
  # GRUPO 1: DISPONIBILIDADE BASICA
  # ─────────────────────────────────────────────────────────────────────────────
  echo -e "${BLUE}[GRUPO 1] Disponibilidade Basica${NC}"
  echo "─────────────────────────────────────────────────────────────────────────────"

  test_http "Homepage" "${PROD_URL}/" "200"
  test_http "Health Check" "${PROD_URL}/api/health" "200"
  test_http "API Info" "${PROD_URL}/api/info" "200" "true"

  echo ""

  # ─────────────────────────────────────────────────────────────────────────────
  # GRUPO 2: AUTENTICACAO
  # ─────────────────────────────────────────────────────────────────────────────
  echo -e "${BLUE}[GRUPO 2] Autenticacao${NC}"
  echo "─────────────────────────────────────────────────────────────────────────────"

  test_http "Login Page" "${PROD_URL}/login" "200" "true"
  test_http "API Chat (sem auth)" "${PROD_URL}/api/chat" "401" "true"
  test_http "API Protegida" "${PROD_URL}/api/conversations" "401" "true"

  echo ""

  # ─────────────────────────────────────────────────────────────────────────────
  # GRUPO 3: STATIC ASSETS
  # ─────────────────────────────────────────────────────────────────────────────
  echo -e "${BLUE}[GRUPO 3] Static Assets${NC}"
  echo "─────────────────────────────────────────────────────────────────────────────"

  test_http "Assets Directory" "${PROD_URL}/assets/" "200" "true"
  test_content "HTML Structure" "${PROD_URL}/" "<html"
  test_content "React App" "${PROD_URL}/" "root\|app"

  echo ""

  # ─────────────────────────────────────────────────────────────────────────────
  # GRUPO 4: PERFORMANCE
  # ─────────────────────────────────────────────────────────────────────────────
  echo -e "${BLUE}[GRUPO 4] Performance${NC}"
  echo "─────────────────────────────────────────────────────────────────────────────"

  test_latency "Homepage Latencia" "${PROD_URL}/" 2000
  test_latency "Health Latencia" "${PROD_URL}/api/health" 500
  test_latency "API Info Latencia" "${PROD_URL}/api/info" 1000

  echo ""

  # ─────────────────────────────────────────────────────────────────────────────
  # GRUPO 5: SEGURANCA
  # ─────────────────────────────────────────────────────────────────────────────
  echo -e "${BLUE}[GRUPO 5] Seguranca${NC}"
  echo "─────────────────────────────────────────────────────────────────────────────"

  # SSL/HTTPS
  if [[ "$PROD_URL" == https* ]]; then
    log_pass "HTTPS habilitado"
  else
    log_fail "HTTPS nao habilitado"
  fi

  test_security_headers "Security Headers" "${PROD_URL}/"

  # HTTP/2
  local http_version=$(curl -sI --http2 "${PROD_URL}/" 2>/dev/null | head -1)
  if echo "$http_version" | grep -q "HTTP/2"; then
    log_pass "HTTP/2 suportado"
  else
    log_warn "HTTP/2 nao detectado"
  fi

  echo ""

  # ─────────────────────────────────────────────────────────────────────────────
  # GRUPO 6: APIs ESPECIFICAS
  # ─────────────────────────────────────────────────────────────────────────────
  echo -e "${BLUE}[GRUPO 6] APIs Especificas${NC}"
  echo "─────────────────────────────────────────────────────────────────────────────"

  # Metrics (opcional)
  local metrics_code=$(curl -s -o /dev/null -w "%{http_code}" "${PROD_URL}/metrics" 2>/dev/null)
  if [[ "$metrics_code" == "200" ]]; then
    log_pass "Metrics endpoint disponivel"
  else
    log_info "Metrics endpoint nao habilitado (HTTP $metrics_code)"
  fi

  # Robots.txt
  test_http "Robots.txt" "${PROD_URL}/robots.txt" "200" "true"

  # Favicon
  test_http "Favicon" "${PROD_URL}/favicon.ico" "200" "true"

  echo ""

  # ─────────────────────────────────────────────────────────────────────────────
  # GRUPO 7: HEALTH CHECK DETALHADO
  # ─────────────────────────────────────────────────────────────────────────────
  echo -e "${BLUE}[GRUPO 7] Health Check Detalhado${NC}"
  echo "─────────────────────────────────────────────────────────────────────────────"

  local health_response=$(curl -s --max-time 10 "${PROD_URL}/api/health" 2>/dev/null)

  if [[ -n "$health_response" ]]; then
    log_info "Health Response:"
    echo "$health_response" | head -10

    if echo "$health_response" | grep -qi "healthy\|ok\|true"; then
      log_pass "Sistema reportando saudavel"
    else
      log_warn "Status de saude inconclusivo"
    fi
  else
    log_fail "Sem resposta do health endpoint"
  fi

  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# RELATORIO FINAL
# ═══════════════════════════════════════════════════════════════════════════════

print_summary() {
  local total=$((PASSED + FAILED))
  local success_rate=0

  if [[ $total -gt 0 ]]; then
    success_rate=$((PASSED * 100 / total))
  fi

  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo -e "${BLUE}RESUMO DOS TESTES${NC}"
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo -e "  ${GREEN}Passaram:${NC}  $PASSED"
  echo -e "  ${RED}Falharam:${NC}  $FAILED"
  echo -e "  ${YELLOW}Avisos:${NC}    $WARNINGS"
  echo ""
  echo "  Taxa de Sucesso: ${success_rate}%"
  echo ""

  if [[ $FAILED -eq 0 ]]; then
    echo -e "═══════════════════════════════════════════════════════════════════════════════"
    echo -e "${GREEN}                    TODOS OS TESTES PASSARAM!                              ${NC}"
    echo -e "═══════════════════════════════════════════════════════════════════════════════"
    exit 0
  else
    echo -e "═══════════════════════════════════════════════════════════════════════════════"
    echo -e "${RED}                    ALGUNS TESTES FALHARAM!                                ${NC}"
    echo -e "═══════════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "Acoes recomendadas:"
    echo "  1. Verificar logs no Render Dashboard"
    echo "  2. Verificar conectividade do banco de dados"
    echo "  3. Verificar variaveis de ambiente"
    echo ""
    exit 1
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

main() {
  # Verificar curl
  if ! command -v curl &> /dev/null; then
    echo "Erro: curl nao encontrado"
    exit 1
  fi

  run_smoke_tests
  print_summary
}

# Executar
main "$@"
