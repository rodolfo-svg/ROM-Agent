#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# 🔍 ROM Agent - Deploy Monitor
# ═══════════════════════════════════════════════════════════════════════════
#
# Monitora deploy em produção até completar
# Executa testes automaticamente quando detectar que está pronto
#
# ═══════════════════════════════════════════════════════════════════════════

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configurações
API_URL="https://iarom.com.br"
MAX_CHECKS=30  # 30 verificações = 15 minutos (30s cada)
CHECK_INTERVAL=30  # 30 segundos entre checks
CURRENT_CHECK=0

# Deploy IDs
DEPLOY_ID_1="dep-d5sh310gjchc73auecq0"  # 16:50:39
DEPLOY_ID_2="dep-d5shlvvgi27c73cb0920"  # 17:07:59

print_header() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

print_status() {
  echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"
}

print_success() {
  echo -e "${GREEN}  ✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}  ⚠️  $1${NC}"
}

print_fail() {
  echo -e "${RED}  ❌ $1${NC}"
}

# Verificar se endpoint está disponível
check_endpoint() {
  local url=$1
  local expected=$2

  RESPONSE=$(curl -s -m 5 "$url" 2>/dev/null || echo "")

  if echo "$RESPONSE" | grep -q "$expected"; then
    return 0  # Sucesso
  else
    return 1  # Falha
  fi
}

# Verificar status de um teste específico
check_test() {
  local test_name=$1
  local url=$2
  local expected=$3

  echo -n "    $test_name... "

  if check_endpoint "$url" "$expected"; then
    echo -e "${GREEN}✅${NC}"
    return 0
  else
    echo -e "${RED}❌${NC}"
    return 1
  fi
}

# Verificação completa
run_checks() {
  local checks_passed=0
  local checks_total=5

  print_status "Executando verificações..."

  # 1. Backend health
  if check_test "Backend health" "$API_URL/health" "healthy"; then
    checks_passed=$((checks_passed + 1))
  fi

  # 2. Chat stream
  if check_endpoint "$API_URL/api/chat/stream" "obrigatória"; then
    echo -e "    Chat stream... ${GREEN}✅${NC}"
    checks_passed=$((checks_passed + 1))
  else
    echo -e "    Chat stream... ${RED}❌${NC}"
  fi

  # 3. Documents formats (CRÍTICO)
  if check_test "Documents formats" "$API_URL/api/formats" "docx"; then
    checks_passed=$((checks_passed + 1))
  fi

  # 4. Documents convert (CRÍTICO)
  if check_endpoint "$API_URL/api/convert" "success\|error"; then
    echo -e "    Documents convert... ${GREEN}✅${NC}"
    checks_passed=$((checks_passed + 1))
  else
    echo -e "    Documents convert... ${RED}❌${NC}"
  fi

  # 5. Frontend bundle (CRÍTICO)
  BUNDLE_HTML=$(curl -s -m 5 "$API_URL/" 2>/dev/null || echo "")
  BUNDLE_URL=$(echo "$BUNDLE_HTML" | grep -o 'src="/assets/index-[^"]*\.js"' | head -1 | sed 's/src="//;s/"$//')

  if [ -n "$BUNDLE_URL" ]; then
    BUNDLE=$(curl -s -m 10 "${API_URL}${BUNDLE_URL}" 2>/dev/null || echo "")
    if echo "$BUNDLE" | grep -q "artifact_complete" && echo "$BUNDLE" | grep -q "outputFormat"; then
      echo -e "    Frontend bundle... ${GREEN}✅${NC}"
      checks_passed=$((checks_passed + 1))
    else
      echo -e "    Frontend bundle... ${RED}❌ (sem código novo)${NC}"
    fi
  else
    echo -e "    Frontend bundle... ${RED}❌ (não encontrado)${NC}"
  fi

  # Retornar número de checks que passaram
  return $checks_passed
}

# Main monitoring loop
main() {
  print_header "🔍 Monitor de Deploy - ROM Agent"

  echo -e "${CYAN}Deploy IDs sendo monitorados:${NC}"
  echo "  • $DEPLOY_ID_1 (16:50:39)"
  echo "  • $DEPLOY_ID_2 (17:07:59)"
  echo ""
  echo -e "${CYAN}Verificações:${NC} A cada $CHECK_INTERVAL segundos"
  echo -e "${CYAN}Máximo:${NC} $MAX_CHECKS verificações (~$((MAX_CHECKS * CHECK_INTERVAL / 60)) minutos)"
  echo ""

  while [ $CURRENT_CHECK -lt $MAX_CHECKS ]; do
    CURRENT_CHECK=$((CURRENT_CHECK + 1))

    print_header "Verificação #$CURRENT_CHECK de $MAX_CHECKS"

    # Executar checks
    set +e  # Permitir falhas temporariamente
    run_checks
    CHECKS_PASSED=$?
    set -e

    echo ""
    echo -e "${CYAN}Resultado:${NC} $CHECKS_PASSED/5 testes passando"

    # Se 5/5 testes passando = SUCESSO!
    if [ $CHECKS_PASSED -eq 5 ]; then
      print_header "🎉 DEPLOY COMPLETADO COM SUCESSO!"

      echo -e "${GREEN}✅ Todos os testes passaram!${NC}"
      echo ""
      echo -e "${CYAN}Próximo passo:${NC}"
      echo "  Execute testes completos:"
      echo "  $ ./scripts/test-production.sh"
      echo ""
      echo -e "${CYAN}Ou teste na interface:${NC}"
      echo "  $ open https://iarom.com.br"
      echo ""

      exit 0
    fi

    # Se 4/5 = QUASE LÁ
    if [ $CHECKS_PASSED -eq 4 ]; then
      print_warning "Quase lá! 4/5 testes passando"
      echo "  Aguardando último componente..."
    fi

    # Se 3/5 ou menos = AINDA DEPLOYANDO
    if [ $CHECKS_PASSED -le 3 ]; then
      print_warning "Deploy ainda em progresso ($CHECKS_PASSED/5)"
    fi

    # Se não for a última verificação, aguardar
    if [ $CURRENT_CHECK -lt $MAX_CHECKS ]; then
      echo ""
      print_status "Aguardando ${CHECK_INTERVAL}s para próxima verificação..."
      echo -e "${CYAN}  Progresso: [$CURRENT_CHECK/$MAX_CHECKS] $((CURRENT_CHECK * 100 / MAX_CHECKS))%${NC}"
      sleep $CHECK_INTERVAL
    fi
  done

  # Se chegou aqui, excedeu máximo de tentativas
  print_header "⏱️ TIMEOUT - Deploy Ainda em Progresso"

  echo -e "${YELLOW}Após $((MAX_CHECKS * CHECK_INTERVAL / 60)) minutos de monitoramento:${NC}"
  echo ""
  echo -e "${CYAN}Status:${NC} $CHECKS_PASSED/5 testes passando"
  echo ""

  if [ $CHECKS_PASSED -ge 4 ]; then
    echo -e "${YELLOW}⚠️  Quase completo, mas algum componente ainda está pendente${NC}"
    echo ""
    echo -e "${CYAN}Recomendação:${NC}"
    echo "  1. Aguardar mais 5-10 minutos"
    echo "  2. Verificar Dashboard: https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00"
    echo "  3. Executar novamente: ./scripts/monitor-deploy.sh"
  elif [ $CHECKS_PASSED -ge 3 ]; then
    echo -e "${YELLOW}⚠️  Deploy provavelmente ainda em progresso${NC}"
    echo ""
    echo -e "${CYAN}Recomendação:${NC}"
    echo "  1. Verificar Dashboard do Render"
    echo "  2. Ver logs de deploy"
    echo "  3. Se deploy mostra 'Live', pode haver outro problema"
  else
    echo -e "${RED}❌ Muitos componentes ainda falhando${NC}"
    echo ""
    echo -e "${CYAN}Recomendação URGENTE:${NC}"
    echo "  1. Acessar Dashboard: https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00"
    echo "  2. Verificar se deploy falhou"
    echo "  3. Ler logs de erro"
    echo "  4. Deploy manual com 'Clear build cache'"
  fi

  echo ""
  echo -e "${CYAN}Para continuar monitorando:${NC}"
  echo "  $ ./scripts/monitor-deploy.sh"
  echo ""

  exit 1
}

# Verificar dependências
if ! command -v curl &> /dev/null; then
  echo -e "${RED}❌ curl não está instalado${NC}"
  exit 1
fi

# Trap para cleanup
trap 'echo ""; echo "Monitoramento interrompido pelo usuário"; exit 130' INT TERM

# Executar
main
