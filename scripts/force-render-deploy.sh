#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# 🚀 Force Render Deploy Script
# ═══════════════════════════════════════════════════════════════════════════
#
# Este script força um novo deploy no Render via API
#
# REQUISITOS:
#   1. RENDER_API_KEY - API key do Render
#   2. RENDER_SERVICE_ID - ID do serviço (srv-xxxxx)
#
# COMO OBTER:
#   1. API Key:
#      - Acesse: https://dashboard.render.com/u/settings
#      - Clique em "API Keys" → "Create API Key"
#      - Copie a key e: export RENDER_API_KEY="rnd_xxxxx"
#
#   2. Service ID:
#      - Acesse: https://dashboard.render.com
#      - Clique no seu serviço
#      - URL será: https://dashboard.render.com/web/srv-XXXXXX
#      - Copie o "srv-XXXXXX" e: export RENDER_SERVICE_ID="srv-xxxxx"
#
# USO:
#   export RENDER_API_KEY="rnd_xxxxx"
#   export RENDER_SERVICE_ID="srv-xxxxx"
#   ./scripts/force-render-deploy.sh
#
#   OU com opções inline:
#   RENDER_API_KEY="rnd_xxx" RENDER_SERVICE_ID="srv-xxx" ./scripts/force-render-deploy.sh
#
#   OU com clear cache:
#   ./scripts/force-render-deploy.sh --clear-cache
#
# ═══════════════════════════════════════════════════════════════════════════

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Render API
API="https://api.render.com/v1"

# Parse arguments
CLEAR_CACHE=false
if [[ "${1:-}" == "--clear-cache" ]]; then
  CLEAR_CACHE=true
fi

# ═══════════════════════════════════════════════════════════════════════════
# 1. VERIFICAR REQUISITOS
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🚀 Force Render Deploy${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar RENDER_API_KEY
if [[ -z "${RENDER_API_KEY:-}" ]]; then
  echo -e "${RED}❌ RENDER_API_KEY não configurada${NC}"
  echo ""
  echo "📝 Como obter:"
  echo "   1. Acesse: https://dashboard.render.com/u/settings"
  echo "   2. Clique em 'API Keys' → 'Create API Key'"
  echo "   3. Copie a key e execute:"
  echo ""
  echo -e "${YELLOW}      export RENDER_API_KEY=\"rnd_xxxxx\"${NC}"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ RENDER_API_KEY configurada${NC}"

# Verificar RENDER_SERVICE_ID
if [[ -z "${RENDER_SERVICE_ID:-}" ]]; then
  echo -e "${RED}❌ RENDER_SERVICE_ID não configurada${NC}"
  echo ""
  echo "📝 Como obter:"
  echo "   1. Acesse: https://dashboard.render.com"
  echo "   2. Clique no seu serviço 'ROM-Agent'"
  echo "   3. A URL será: https://dashboard.render.com/web/srv-XXXXXX"
  echo "   4. Copie o 'srv-XXXXXX' e execute:"
  echo ""
  echo -e "${YELLOW}      export RENDER_SERVICE_ID=\"srv-xxxxx\"${NC}"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ RENDER_SERVICE_ID: ${RENDER_SERVICE_ID}${NC}"
echo ""

# Verificar jq instalado
if ! command -v jq &> /dev/null; then
  echo -e "${RED}❌ jq não está instalado${NC}"
  echo ""
  echo "📝 Instale com:"
  echo "   macOS: brew install jq"
  echo "   Ubuntu: sudo apt install jq"
  echo ""
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# 2. OBTER INFORMAÇÕES DO SERVIÇO
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}📊 Obtendo informações do serviço...${NC}"

SERVICE_INFO=$(curl -fsS "${API}/services/${RENDER_SERVICE_ID}" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" 2>/dev/null || echo "{}")

if [[ "$SERVICE_INFO" == "{}" ]]; then
  echo -e "${RED}❌ Falha ao obter informações do serviço${NC}"
  echo "   Verifique se o SERVICE_ID está correto"
  exit 1
fi

SERVICE_NAME=$(echo "$SERVICE_INFO" | jq -r '.service.name // "Unknown"')
SERVICE_TYPE=$(echo "$SERVICE_INFO" | jq -r '.service.type // "Unknown"')
SERVICE_BRANCH=$(echo "$SERVICE_INFO" | jq -r '.service.autoDeploy // "Unknown"')

echo -e "${GREEN}✅ Serviço encontrado:${NC}"
echo "   Nome: $SERVICE_NAME"
echo "   Tipo: $SERVICE_TYPE"
echo "   Auto-deploy: $SERVICE_BRANCH"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# 3. FORÇAR DEPLOY
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}🚀 Iniciando deploy forçado...${NC}"
echo ""

if [[ "$CLEAR_CACHE" == true ]]; then
  echo -e "${YELLOW}⚠️  Deploy com CLEAR CACHE (build mais lento)${NC}"
  CLEAR_CACHE_PARAM="?clearCache=true"
else
  echo -e "${GREEN}✅ Deploy normal (usa cache)${NC}"
  CLEAR_CACHE_PARAM=""
fi

echo ""

# Trigger deploy
DEPLOY_RESPONSE=$(curl -fsS -X POST \
  "${API}/services/${RENDER_SERVICE_ID}/deploys${CLEAR_CACHE_PARAM}" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" 2>/dev/null || echo "{}")

if [[ "$DEPLOY_RESPONSE" == "{}" ]]; then
  echo -e "${RED}❌ Falha ao iniciar deploy${NC}"
  exit 1
fi

DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | jq -r '.id // "Unknown"')
DEPLOY_STATUS=$(echo "$DEPLOY_RESPONSE" | jq -r '.status // "Unknown"')

if [[ "$DEPLOY_ID" == "Unknown" ]]; then
  echo -e "${RED}❌ Deploy não retornou ID${NC}"
  echo "Resposta: $DEPLOY_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Deploy iniciado!${NC}"
echo "   ID: $DEPLOY_ID"
echo "   Status: $DEPLOY_STATUS"
echo ""
echo -e "${BLUE}🔗 Acompanhe em:${NC}"
echo "   https://dashboard.render.com/web/${RENDER_SERVICE_ID}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# 4. MONITORAR STATUS DO DEPLOY
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}⏳ Monitorando deploy (Ctrl+C para sair)...${NC}"
echo ""

LAST_STATUS=""
MAX_ATTEMPTS=60  # 10 minutos (10s cada)
ATTEMPT=0

while [[ $ATTEMPT -lt $MAX_ATTEMPTS ]]; do
  sleep 10
  ATTEMPT=$((ATTEMPT + 1))

  # Get deploy status
  DEPLOY_INFO=$(curl -fsS "${API}/services/${RENDER_SERVICE_ID}/deploys/${DEPLOY_ID}" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" 2>/dev/null || echo "{}")

  CURRENT_STATUS=$(echo "$DEPLOY_INFO" | jq -r '.status // "Unknown"')
  CREATED_AT=$(echo "$DEPLOY_INFO" | jq -r '.createdAt // "Unknown"')
  FINISHED_AT=$(echo "$DEPLOY_INFO" | jq -r '.finishedAt // "null"')

  # Mostrar apenas se status mudou
  if [[ "$CURRENT_STATUS" != "$LAST_STATUS" ]]; then
    TIMESTAMP=$(date '+%H:%M:%S')

    case "$CURRENT_STATUS" in
      "created")
        echo -e "${YELLOW}[$TIMESTAMP] 📦 Deploy criado, aguardando início...${NC}"
        ;;
      "build_in_progress")
        echo -e "${BLUE}[$TIMESTAMP] 🔨 Build em progresso...${NC}"
        ;;
      "update_in_progress")
        echo -e "${BLUE}[$TIMESTAMP] 🚀 Deploy em progresso...${NC}"
        ;;
      "live")
        echo -e "${GREEN}[$TIMESTAMP] ✅ Deploy COMPLETO! Serviço está LIVE!${NC}"
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  🎉 SUCESSO!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "🔗 Acesse: https://iarom.com.br"
        echo ""
        exit 0
        ;;
      "build_failed"|"deactivated")
        echo -e "${RED}[$TIMESTAMP] ❌ Deploy FALHOU!${NC}"
        echo ""
        echo "📋 Logs completos:"
        echo "   https://dashboard.render.com/web/${RENDER_SERVICE_ID}/deploys/${DEPLOY_ID}"
        echo ""
        exit 1
        ;;
      *)
        echo -e "${YELLOW}[$TIMESTAMP] ⏳ Status: $CURRENT_STATUS${NC}"
        ;;
    esac

    LAST_STATUS="$CURRENT_STATUS"
  fi
done

# Timeout
echo -e "${YELLOW}⚠️  Timeout após 10 minutos${NC}"
echo "   Deploy ainda pode estar em progresso"
echo "   Verifique: https://dashboard.render.com/web/${RENDER_SERVICE_ID}"
echo ""

exit 0
