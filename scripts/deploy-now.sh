#!/bin/bash
# ROM Agent - Deploy Agora para Produção
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

HEROKU_APP="iarom"
APP_URL="https://${HEROKU_APP}.herokuapp.com"

echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}${BOLD}  ROM AGENT - DEPLOY PARA PRODUÇÃO${NC}"
echo -e "${BLUE}${BOLD}══════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Verificar Heroku CLI
echo -e "${CYAN}[1/6] Verificando Heroku CLI...${NC}"
if ! command -v heroku &> /dev/null; then
    echo -e "${RED}✗ Heroku CLI não encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Heroku CLI instalado${NC}"

# Step 2: Login
echo -e "${CYAN}[2/6] Verificando autenticação...${NC}"
if heroku auth:whoami &> /dev/null; then
    echo -e "${GREEN}✓ Autenticado${NC}"
else
    echo -e "${YELLOW}⚠ Execute: heroku login${NC}"
    exit 1
fi

# Step 3: Remote
echo -e "${CYAN}[3/6] Configurando remote...${NC}"
if ! git remote | grep -q "^heroku$"; then
    heroku git:remote -a "$HEROKU_APP"
fi
echo -e "${GREEN}✓ Remote configurado${NC}"

# Step 4: Deploy
echo -e "${CYAN}[4/6] Fazendo deploy (2-5 min)...${NC}"
git push heroku main

# Step 5: Validação
echo -e "${CYAN}[5/6] Validando...${NC}"
sleep 10

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/health")
echo "Health: $HEALTH"

# Step 6: Resultado
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}${BOLD}✓ DEPLOY BEM-SUCEDIDO!${NC}"
    echo "URL: $APP_URL"
else
    echo -e "${RED}⚠ Verificar logs: heroku logs --tail${NC}"
fi
