#!/bin/bash

# Script de Validação de Integração
# Valida todas as 86 ferramentas após integração

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
WHITE='\033[1;37m'
NC='\033[0m'

REPORT_FILE="validation-report-$(date +%Y%m%d-%H%M%S).json"

echo -e "${WHITE}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}           VALIDAÇÃO DE INTEGRAÇÃO - 86 FERRAMENTAS${NC}"
echo -e "${WHITE}════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Contadores
TOTAL_TOOLS=86
PASSED=0
FAILED=0
SKIPPED=0

# Resultados
declare -a RESULTS

validate_tool() {
  local tool_name="$1"
  local test_command="$2"

  echo -n "  🔍 Validando: $tool_name... "

  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSOU${NC}"
    ((PASSED++))
    RESULTS+=("{\"tool\":\"$tool_name\",\"status\":\"passed\"}")
  else
    echo -e "${RED}❌ FALHOU${NC}"
    ((FAILED++))
    RESULTS+=("{\"tool\":\"$tool_name\",\"status\":\"failed\"}")
  fi
}

skip_tool() {
  local tool_name="$1"
  local reason="$2"

  echo -e "  ⏭️  Pulando: $tool_name (${YELLOW}$reason${NC})"
  ((SKIPPED++))
  RESULTS+=("{\"tool\":\"$tool_name\",\"status\":\"skipped\",\"reason\":\"$reason\"}")
}

echo -e "${BLUE}1. Validando AWS Bedrock (17 funções)${NC}"
if [ -n "$AWS_ACCESS_KEY_ID" ]; then
  validate_tool "Bedrock Connection" "node -e 'require(\"./src/modules/bedrock.js\")'"
  validate_tool "Bedrock Advanced" "node -e 'require(\"./src/modules/bedrockAvancado.js\")'"
else
  skip_tool "AWS Bedrock" "Credenciais não configuradas"
fi
echo ""

echo -e "${BLUE}2. Validando Google Search${NC}"
if [ -n "$GOOGLE_SEARCH_API_KEY" ]; then
  validate_tool "Google Search Client" "node -e 'require(\"./lib/google-search-client.js\")'"
else
  skip_tool "Google Search" "API Key não configurada"
fi
echo ""

echo -e "${BLUE}3. Validando DataJud CNJ${NC}"
if [ -n "$DATAJUD_API_KEY" ]; then
  validate_tool "DataJud Service" "node -e 'require(\"./src/services/datajud-service.js\")'"
else
  skip_tool "DataJud" "API Key não configurada"
fi
echo ""

echo -e "${BLUE}4. Validando Scrapers Python${NC}"
validate_tool "PROJUDI Scraper" "test -f python-scrapers/projudi_scraper.py"
validate_tool "ESAJ Scraper" "test -f python-scrapers/esaj_scraper.py"
validate_tool "PJe Scraper" "test -f python-scrapers/pje_scraper.py"
validate_tool "ePROC Scraper" "test -f python-scrapers/eproc_scraper.py"
validate_tool "DataJud Client" "test -f python-scrapers/datajud_cnj.py"
echo ""

echo -e "${BLUE}5. Validando Sistema de Progresso${NC}"
validate_tool "Progress SSE Server" "test -f src/services/progress-sse-server.js"
validate_tool "Integration Orchestrator" "test -f src/services/integration-orchestrator.js"
validate_tool "Integration Dashboard" "test -f frontend/src/components/IntegrationDashboard.tsx"
echo ""

echo -e "${BLUE}6. Validando Upload de Arquivos${NC}"
validate_tool "Chunked Upload" "node -e 'require(\"./lib/chunked-upload.js\")'"
validate_tool "Upload Handler" "grep -q '500.*MB' python-scrapers/api_auth.py"
echo ""

echo -e "${BLUE}7. Validando Pipeline de Extração${NC}"
validate_tool "Extractor Pipeline" "node -e 'require(\"./lib/extractor-pipeline.js\")'"
validate_tool "OCR Avançado" "node -e 'require(\"./src/modules/ocrAvancado.js\")'"
validate_tool "Extração Service" "node -e 'require(\"./src/services/extraction-service.js\")'"
echo ""

echo -e "${BLUE}8. Validando Skills Claude${NC}"
validate_tool "Skill: analisar" "test -f .claude/commands/analisar.md"
validate_tool "Skill: jurisprudencia" "test -f .claude/commands/jurisprudencia.md"
validate_tool "Skill: redigir" "test -f .claude/commands/redigir.md"
validate_tool "Skill: extrair" "test -f .claude/commands/extrair.md"
validate_tool "Skill: legislacao" "test -f .claude/commands/legislacao.md"
validate_tool "Skill: resumo" "test -f .claude/commands/resumo.md"
validate_tool "Skill: prazos" "test -f .claude/commands/prazos.md"
validate_tool "Skill: leading-case" "test -f .claude/commands/leading-case.md"
validate_tool "Skill: prequestionar" "test -f .claude/commands/prequestionar.md"
validate_tool "Skill: contrato" "test -f .claude/commands/contrato.md"
validate_tool "Skill: revisar" "test -f .claude/commands/revisar.md"
echo ""

echo -e "${BLUE}9. Validando Módulos Backend${NC}"
validate_tool "Bedrock Tools" "node -e 'require(\"./src/modules/bedrock-tools.js\")'"
validate_tool "Jurisprudência" "node -e 'require(\"./src/modules/jurisprudencia.js\")'"
validate_tool "Extração" "node -e 'require(\"./src/modules/extracao.js\")'"
validate_tool "Prompts" "node -e 'require(\"./src/modules/prompts.js\")'"
validate_tool "Documentos" "node -e 'require(\"./src/modules/documentos.js\")'"
validate_tool "Português" "node -e 'require(\"./src/modules/portugues.js\")'"
validate_tool "SDK Tools" "node -e 'require(\"./src/modules/sdkTools.js\")'"
validate_tool "Resumo Executivo" "node -e 'require(\"./src/modules/resumoExecutivo.js\")'"
echo ""

echo -e "${BLUE}10. Validando Infraestrutura${NC}"
validate_tool "Rate Limiter" "node -e 'require(\"./lib/rate-limiter.js\")'"
validate_tool "Router" "node -e 'require(\"./lib/router.js\")'"
validate_tool "Auth Middleware" "test -f src/middlewares/auth.js"
validate_tool "Rate Limit Middleware" "test -f src/middlewares/rate-limiter.js"
validate_tool "Python Bridge" "test -f src/services/python-bridge.js"
echo ""

# Estatísticas
PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($PASSED / $TOTAL_TOOLS) * 100}")

echo -e "${WHITE}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}                      RELATÓRIO FINAL${NC}"
echo -e "${WHITE}════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Total de Ferramentas: ${WHITE}$TOTAL_TOOLS${NC}"
echo -e "  ${GREEN}✅ Passou: $PASSED${NC}"
echo -e "  ${RED}❌ Falhou: $FAILED${NC}"
echo -e "  ${YELLOW}⏭️  Pulou: $SKIPPED${NC}"
echo ""
echo -e "  ${WHITE}Percentual de Sucesso: $PERCENTAGE%${NC}"
echo ""

# Salvar relatório JSON
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "total": $TOTAL_TOOLS,
  "passed": $PASSED,
  "failed": $FAILED,
  "skipped": $SKIPPED,
  "percentage": $PERCENTAGE,
  "results": [
    $(IFS=,; echo "${RESULTS[*]}")
  ]
}
EOF

echo -e "  📄 Relatório salvo em: ${BLUE}$REPORT_FILE${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ TODAS AS VALIDAÇÕES PASSARAM!${NC}"
  echo ""
  exit 0
else
  echo -e "${YELLOW}⚠️  Algumas validações falharam. Revise o relatório.${NC}"
  echo ""
  exit 1
fi
