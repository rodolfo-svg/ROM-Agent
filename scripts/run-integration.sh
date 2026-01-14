#!/bin/bash

# Script de Integração Completa - 86 Ferramentas
# Executa 8 agentes paralelos com modelo Opus
# Streaming SSE em tempo real

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
WHITE='\033[1;37m'
NC='\033[0m'

# Configurações padrão
MODEL="opus"
AGENTS="all"
STREAMING="true"
PARALLEL="true"
LOGS_DIR="$PROJECT_DIR/logs/integration-$(date +%Y%m%d-%H%M%S)"

# Parse argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    --agents=*)
      AGENTS="${1#*=}"
      shift
      ;;
    --model=*)
      MODEL="${1#*=}"
      shift
      ;;
    --streaming=*)
      STREAMING="${1#*=}"
      shift
      ;;
    --parallel=*)
      PARALLEL="${1#*=}"
      shift
      ;;
    *)
      echo "Argumento desconhecido: $1"
      exit 1
      ;;
  esac
done

# Banner
clear
cat << "EOF"
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║         ██████╗  ██████╗ ███╗   ███╗     █████╗  ██████╗ ███████╗   ║
║         ██╔══██╗██╔═══██╗████╗ ████║    ██╔══██╗██╔════╝ ██╔════╝   ║
║         ██████╔╝██║   ██║██╔████╔██║    ███████║██║  ███╗█████╗     ║
║         ██╔══██╗██║   ██║██║╚██╔╝██║    ██╔══██║██║   ██║██╔══╝     ║
║         ██║  ██║╚██████╔╝██║ ╚═╝ ██║    ██║  ██║╚██████╔╝███████╗   ║
║         ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ║
║                                                                      ║
║           INTEGRAÇÃO COMPLETA DE 86 FERRAMENTAS                     ║
║              Sistema Multi-Agente Autônomo                          ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
EOF

echo ""
echo -e "${GREEN}Iniciando integração completa...${NC}"
echo ""
echo -e "${BLUE}📊 Configurações:${NC}"
echo -e "  Modelo IA: ${CYAN}$MODEL${NC}"
echo -e "  Agentes: ${CYAN}$AGENTS${NC}"
echo -e "  Execução Paralela: ${CYAN}$PARALLEL${NC}"
echo -e "  Streaming SSE: ${CYAN}$STREAMING${NC}"
echo -e "  Logs: ${CYAN}$LOGS_DIR${NC}"
echo ""

# Criar diretório de logs
mkdir -p "$LOGS_DIR"

# Verificar dependências
echo -e "${CYAN}Verificando dependências...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js não encontrado${NC}"
  exit 1
fi

if ! command -v python3 &> /dev/null; then
  echo -e "${RED}❌ Python3 não encontrado${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Dependências verificadas${NC}"
echo ""

# Verificar variáveis de ambiente críticas
echo -e "${CYAN}Verificando variáveis de ambiente...${NC}"

MISSING_VARS=()

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
  MISSING_VARS+=("AWS_ACCESS_KEY_ID")
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  MISSING_VARS+=("AWS_SECRET_ACCESS_KEY")
fi

if [ -z "$GOOGLE_SEARCH_API_KEY" ]; then
  MISSING_VARS+=("GOOGLE_SEARCH_API_KEY")
fi

if [ -z "$GOOGLE_SEARCH_CX" ]; then
  MISSING_VARS+=("GOOGLE_SEARCH_CX")
fi

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Variáveis faltando (algumas ferramentas podem não funcionar):${NC}"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo -e "${YELLOW}Deseja continuar mesmo assim? (y/n)${NC}"
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Abortado."
    exit 1
  fi
else
  echo -e "${GREEN}✅ Todas as variáveis configuradas${NC}"
fi

echo ""

# Criar backup
echo -e "${CYAN}Criando backup antes da integração...${NC}"
BACKUP_DIR="$PROJECT_DIR/backups/pre-integration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r src lib python-scrapers package*.json .env* "$BACKUP_DIR/" 2>/dev/null || true
echo -e "${GREEN}✅ Backup criado: $BACKUP_DIR${NC}"
echo ""

# Iniciar servidor SSE de progresso (se streaming habilitado)
if [ "$STREAMING" = "true" ]; then
  echo -e "${CYAN}Iniciando servidor SSE de progresso...${NC}"
  node src/services/progress-sse-server.js > "$LOGS_DIR/sse-server.log" 2>&1 &
  SSE_PID=$!
  echo -e "${GREEN}✅ Servidor SSE iniciado (PID: $SSE_PID)${NC}"
  echo ""

  # Aguardar servidor iniciar
  sleep 2

  echo -e "${CYAN}Dashboard disponível em:${NC}"
  echo -e "  ${BLUE}http://localhost:3000/integration${NC}"
  echo ""
fi

# Executar orquestrador
echo -e "${WHITE}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Iniciando Orquestrador de Integração${NC}"
echo -e "${WHITE}════════════════════════════════════════════════════════════════════════${NC}"
echo ""

node src/services/integration-orchestrator.js \
  --agents="$AGENTS" \
  --model="$MODEL" \
  --parallel="$PARALLEL" \
  --logs-dir="$LOGS_DIR" \
  2>&1 | tee "$LOGS_DIR/orchestrator.log"

EXIT_CODE=$?

echo ""
echo -e "${WHITE}════════════════════════════════════════════════════════════════════════${NC}"

if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ INTEGRAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
  echo ""
  echo -e "${WHITE}Relatórios gerados:${NC}"
  echo "  📄 Log do orquestrador: $LOGS_DIR/orchestrator.log"
  echo "  📄 Relatório final: $LOGS_DIR/RELATORIO_FINAL.md"
  echo "  📄 Status de ferramentas: $LOGS_DIR/tools-status.json"
  echo ""

  # Mostrar estatísticas
  if [ -f "$LOGS_DIR/tools-status.json" ]; then
    echo -e "${WHITE}Estatísticas:${NC}"
    node -e "
      const fs = require('fs');
      const data = JSON.parse(fs.readFileSync('$LOGS_DIR/tools-status.json'));
      const total = data.tools.length;
      const operational = data.tools.filter(t => t.status === 'operational').length;
      const percentage = (operational / total * 100).toFixed(1);
      console.log(\`  ✅ Ferramentas operacionais: \${operational}/\${total} (\${percentage}%)\`);
      console.log(\`  ⏱️  Tempo total: \${data.totalTime}\`);
      console.log(\`  🤖 Agentes utilizados: \${data.agentsUsed}\`);
    "
  fi

  echo ""
  echo -e "${CYAN}Próximos passos:${NC}"
  echo "  1. Revisar relatório em $LOGS_DIR/RELATORIO_FINAL.md"
  echo "  2. Validar ferramentas com: ./scripts/validate-integration.sh"
  echo "  3. Deploy em produção"
  echo ""
else
  echo -e "${RED}❌ INTEGRAÇÃO FALHOU (código: $EXIT_CODE)${NC}"
  echo ""
  echo -e "${YELLOW}Verifique os logs em:${NC}"
  echo "  $LOGS_DIR/orchestrator.log"
  echo ""
  echo -e "${YELLOW}Para fazer rollback:${NC}"
  echo "  cp -r $BACKUP_DIR/* ./"
  echo ""
fi

# Parar servidor SSE
if [ -n "$SSE_PID" ]; then
  kill $SSE_PID 2>/dev/null || true
fi

echo -e "${WHITE}════════════════════════════════════════════════════════════════════════${NC}"
echo ""

exit $EXIT_CODE
