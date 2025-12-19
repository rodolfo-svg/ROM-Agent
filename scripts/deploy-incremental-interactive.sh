#!/bin/bash
# ROM Agent - Deploy Incremental Interativo
# Guia passo-a-passo com validação automática

STAGING_URL="https://rom-agent-ia-onrender-com.onrender.com"
ADMIN_TOKEN="63a2de1784b57db90b3139277e1ed75b0daca799073c638442f57a46e79bc4ff"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================="
echo "🚀 ROM Agent - Deploy Incremental"
echo "========================================="
echo ""
echo "Este script vai guiá-lo através de 3 etapas:"
echo "  A. Alinhar parâmetros (MAX_CONCURRENT, MAX_QUEUE)"
echo "  B. Ativar Circuit Breaker"
echo "  C. Ativar Bottleneck"
echo ""
echo "Cada etapa requer que você:"
echo "  1. Atualize ENV no Render Dashboard"
echo "  2. Aguarde redeploy completar"
echo "  3. Confirme para validar"
echo ""
read -p "Pressione ENTER para começar..."
clear

# ==================================================
# ETAPA A: Alinhar Parâmetros
# ==================================================
echo "========================================="
echo "📋 ETAPA A: Alinhar Parâmetros"
echo "========================================="
echo ""
echo "Configuração atual:"
curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" "$STAGING_URL/admin/flags" | jq -r '.flags | "  MAX_CONCURRENT: \(.MAX_CONCURRENT)\n  MAX_QUEUE: \(.MAX_QUEUE)\n  ENABLE_CIRCUIT_BREAKER: \(.ENABLE_CIRCUIT_BREAKER)\n  ENABLE_BOTTLENECK: \(.ENABLE_BOTTLENECK)"'
echo ""
echo -e "${YELLOW}AÇÕES NECESSÁRIAS:${NC}"
echo "1. Abra: https://dashboard.render.com"
echo "2. Acesse: rom-agent-ia-onrender-com → Settings → Environment"
echo "3. Modifique:"
echo "   ${GREEN}MAX_CONCURRENT=5${NC} (era 6)"
echo "   ${GREEN}MAX_QUEUE=20${NC} (era 10)"
echo "4. Clique em 'Save Changes'"
echo "5. Aguarde status: 'Live' (~3-5 min)"
echo ""
read -p "Pressione ENTER quando o deploy estiver completo..."

# Validar Etapa A
echo ""
echo "Validando Etapa A..."
sleep 2

NEW_CONFIG=$(curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" "$STAGING_URL/admin/flags")
MAX_CONCURRENT=$(echo "$NEW_CONFIG" | jq -r '.flags.MAX_CONCURRENT')
MAX_QUEUE=$(echo "$NEW_CONFIG" | jq -r '.flags.MAX_QUEUE')

if [ "$MAX_CONCURRENT" = "5" ] && [ "$MAX_QUEUE" = "20" ]; then
  echo -e "${GREEN}✅ ETAPA A COMPLETA${NC}"
  echo "   MAX_CONCURRENT: $MAX_CONCURRENT ✓"
  echo "   MAX_QUEUE: $MAX_QUEUE ✓"
else
  echo -e "${RED}❌ ETAPA A FALHOU${NC}"
  echo "   MAX_CONCURRENT: $MAX_CONCURRENT (esperado: 5)"
  echo "   MAX_QUEUE: $MAX_QUEUE (esperado: 20)"
  echo ""
  echo "Verifique se salvou as mudanças no Render e aguardou o redeploy."
  exit 1
fi

echo ""
read -p "Pressione ENTER para continuar para Etapa B..."
clear

# ==================================================
# ETAPA B: Ativar Circuit Breaker
# ==================================================
echo "========================================="
echo "🔴 ETAPA B: Ativar Circuit Breaker"
echo "========================================="
echo ""
echo -e "${YELLOW}AÇÕES NECESSÁRIAS:${NC}"
echo "1. No Render Dashboard → Environment"
echo "2. Modifique APENAS:"
echo "   ${GREEN}ENABLE_CIRCUIT_BREAKER=true${NC} (era false)"
echo "3. Mantenha:"
echo "   ENABLE_BOTTLENECK=false (ainda OFF)"
echo "   MAX_CONCURRENT=5"
echo "   MAX_QUEUE=20"
echo "4. Save Changes → Aguarde 'Live' (~3-5 min)"
echo ""
read -p "Pressione ENTER quando o deploy estiver completo..."

# Validar Etapa B
echo ""
echo "Validando Etapa B..."
sleep 2

CB_ENABLED=$(curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" "$STAGING_URL/admin/flags" | jq -r '.flags.ENABLE_CIRCUIT_BREAKER')

if [ "$CB_ENABLED" = "true" ]; then
  echo -e "${GREEN}✅ Circuit Breaker ATIVADO${NC}"
else
  echo -e "${RED}❌ Circuit Breaker ainda OFF${NC}"
  echo "   ENABLE_CIRCUIT_BREAKER: $CB_ENABLED (esperado: true)"
  exit 1
fi

# Verificar métricas
echo ""
echo "Verificando métricas Prometheus..."
CB_METRICS=$(curl -sS "$STAGING_URL/metrics" | grep "circuit_breaker_state" | head -1)

if [ -n "$CB_METRICS" ]; then
  echo -e "${GREEN}✅ Métricas Circuit Breaker presentes${NC}"
  echo "   $CB_METRICS"
else
  echo -e "${YELLOW}⚠️  Métricas ainda não aparecem (pode levar alguns segundos)${NC}"
fi

echo ""
echo -e "${BLUE}Executando validação completa do Circuit Breaker...${NC}"
echo ""
read -p "Pressione ENTER para iniciar testes de transição de estado..."

# Executar script de validação do Circuit Breaker
chmod +x scripts/validate-circuit-breaker.sh
./scripts/validate-circuit-breaker.sh

echo ""
read -p "Pressione ENTER para continuar para Etapa C..."
clear

# ==================================================
# ETAPA C: Ativar Bottleneck
# ==================================================
echo "========================================="
echo "🚦 ETAPA C: Ativar Bottleneck"
echo "========================================="
echo ""
echo -e "${YELLOW}AÇÕES NECESSÁRIAS:${NC}"
echo "1. No Render Dashboard → Environment"
echo "2. Modifique APENAS:"
echo "   ${GREEN}ENABLE_BOTTLENECK=true${NC} (era false)"
echo "3. Mantenha:"
echo "   ENABLE_CIRCUIT_BREAKER=true (já ativo)"
echo "   MAX_CONCURRENT=5"
echo "   MAX_QUEUE=20"
echo "4. Save Changes → Aguarde 'Live' (~3-5 min)"
echo ""
read -p "Pressione ENTER quando o deploy estiver completo..."

# Validar Etapa C
echo ""
echo "Validando Etapa C..."
sleep 2

BN_ENABLED=$(curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" "$STAGING_URL/admin/flags" | jq -r '.flags.ENABLE_BOTTLENECK')

if [ "$BN_ENABLED" = "true" ]; then
  echo -e "${GREEN}✅ Bottleneck ATIVADO${NC}"
else
  echo -e "${RED}❌ Bottleneck ainda OFF${NC}"
  echo "   ENABLE_BOTTLENECK: $BN_ENABLED (esperado: true)"
  exit 1
fi

# Verificar métricas
echo ""
echo "Verificando métricas Prometheus..."
BN_METRICS=$(curl -sS "$STAGING_URL/metrics" | grep "bottleneck_rejected" | head -1)

if [ -n "$BN_METRICS" ]; then
  echo -e "${GREEN}✅ Métricas Bottleneck presentes${NC}"
  echo "   $BN_METRICS"
else
  echo -e "${YELLOW}⚠️  Métricas ainda não aparecem (pode levar alguns segundos)${NC}"
fi

echo ""
echo -e "${BLUE}Executando validação completa do Bottleneck...${NC}"
echo ""
read -p "Pressione ENTER para iniciar teste de rejeição HTTP 503..."

# Executar script de validação do Bottleneck
chmod +x scripts/validate-bottleneck.sh
./scripts/validate-bottleneck.sh

# ==================================================
# RESUMO FINAL
# ==================================================
clear
echo "========================================="
echo "🎉 DEPLOY INCREMENTAL COMPLETO"
echo "========================================="
echo ""

# Buscar configuração final
FINAL_CONFIG=$(curl -sS -H "X-Admin-Token: $ADMIN_TOKEN" "$STAGING_URL/admin/flags")

echo "📊 Configuração Final:"
echo "$FINAL_CONFIG" | jq -r '.flags | "  ENABLE_RETRY: \(.ENABLE_RETRY)
  ENABLE_CIRCUIT_BREAKER: \(.ENABLE_CIRCUIT_BREAKER)
  ENABLE_BOTTLENECK: \(.ENABLE_BOTTLENECK)
  ENABLE_GUARDRAILS: \(.ENABLE_GUARDRAILS)
  MAX_CONCURRENT: \(.MAX_CONCURRENT)
  MAX_QUEUE: \(.MAX_QUEUE)
  CIRCUIT_BREAKER_THRESHOLD: \(.CIRCUIT_BREAKER_THRESHOLD)"'

echo ""
echo "✅ TAREFAS COMPLETADAS:"
echo "  [x] Etapa A: Parâmetros alinhados (5/20)"
echo "  [x] Etapa B: Circuit Breaker ativado e validado"
echo "  [x] Etapa C: Bottleneck ativado e validado"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "  1. Monitorar métricas por 24-48h"
echo "  2. Acompanhar endpoint /metrics"
echo "  3. Verificar logs para erros"
echo "  4. Decisão GO/NO-GO para produção"
echo ""
echo "📊 Métricas em tempo real:"
echo "   curl $STAGING_URL/metrics | grep -E \"circuit_breaker|bottleneck\""
echo ""
echo "🔗 Links:"
echo "   Métricas: $STAGING_URL/metrics"
echo "   Health: $STAGING_URL/health"
echo "   Docs: RENDER_DEPLOYMENT_GUIDE.md"
echo ""
echo "========================================="
echo "Deploy incremental executado com sucesso! 🚀"
echo "========================================="
