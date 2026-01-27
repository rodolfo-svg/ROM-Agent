#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════
# 🔍 List Render Services
# ═══════════════════════════════════════════════════════════════════════════
#
# Este script lista todos os serviços da sua conta Render
# Use para descobrir o SERVICE_ID correto
#
# REQUISITOS:
#   RENDER_API_KEY - API key do Render
#
# USO:
#   export RENDER_API_KEY="rnd_xxxxx"
#   ./scripts/get-render-services.sh
#
# ═══════════════════════════════════════════════════════════════════════════

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Render API
API="https://api.render.com/v1"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔍 List Render Services${NC}"
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
echo ""

# Verificar jq
if ! command -v jq &> /dev/null; then
  echo -e "${RED}❌ jq não está instalado${NC}"
  echo "   macOS: brew install jq"
  exit 1
fi

# Listar serviços
echo -e "${BLUE}📋 Listando serviços...${NC}"
echo ""

SERVICES=$(curl -fsS "${API}/services?limit=100" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" 2>/dev/null || echo '[]')

if [[ "$SERVICES" == '[]' ]]; then
  echo -e "${RED}❌ Nenhum serviço encontrado ou erro na API${NC}"
  exit 1
fi

# Contar serviços
COUNT=$(echo "$SERVICES" | jq 'length')

if [[ "$COUNT" -eq 0 ]]; then
  echo -e "${YELLOW}⚠️  Nenhum serviço encontrado${NC}"
  exit 0
fi

echo -e "${GREEN}✅ Encontrados $COUNT serviço(s)${NC}"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Listar cada serviço
echo "$SERVICES" | jq -r '.[] | [
  .service.id,
  .service.name,
  .service.type,
  .service.autoDeploy,
  .service.repo
] | @tsv' | while IFS=$'\t' read -r ID NAME TYPE AUTODEPLOY REPO; do
  echo -e "${GREEN}📦 Serviço:${NC} $NAME"
  echo -e "   ${BLUE}ID:${NC} $ID"
  echo -e "   ${BLUE}Tipo:${NC} $TYPE"
  echo -e "   ${BLUE}Auto-deploy:${NC} $AUTODEPLOY"
  echo -e "   ${BLUE}Repositório:${NC} $REPO"
  echo -e "   ${BLUE}Dashboard:${NC} https://dashboard.render.com/web/$ID"
  echo ""
  echo -e "${YELLOW}   💡 Para usar este serviço:${NC}"
  echo -e "${YELLOW}      export RENDER_SERVICE_ID=\"$ID\"${NC}"
  echo ""
  echo -e "${BLUE}───────────────────────────────────────────────────────────${NC}"
  echo ""
done

echo ""
echo -e "${GREEN}✅ Listagem completa!${NC}"
echo ""
echo -e "${YELLOW}📝 Próximo passo:${NC}"
echo "   1. Copie o RENDER_SERVICE_ID do serviço desejado"
echo "   2. Execute: export RENDER_SERVICE_ID=\"srv-xxxxx\""
echo "   3. Execute: ./scripts/force-render-deploy.sh"
echo ""
