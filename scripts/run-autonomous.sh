#!/bin/bash

# Execução Autônoma do Sistema de Correção
# Executa tudo em um único processo, sem abrir novos terminais

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Diretório de logs
export LOGS_DIR="$PROJECT_DIR/logs/orchestrator-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGS_DIR"

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
║           SISTEMA DE CORREÇÃO AUTOMATIZADA v2.0.0                   ║
║                    Execução Autônoma                                ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
EOF

echo ""
echo -e "${GREEN}Iniciando execução autônoma...${NC}"
echo ""
echo -e "${BLUE}📁 Diretório do projeto:${NC} $PROJECT_DIR"
echo -e "${BLUE}📝 Logs salvos em:${NC} $LOGS_DIR"
echo ""

# Verificar dependências
echo -e "${CYAN}Verificando dependências...${NC}"

if ! command -v node &> /dev/null; then
  echo "❌ Node.js não encontrado"
  exit 1
fi

echo "✅ Dependências verificadas"
echo ""

# Criar backup
echo -e "${CYAN}Criando backup do código atual...${NC}"
BACKUP_DIR="$PROJECT_DIR/backups/pre-orchestration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r src lib package*.json .env* "$BACKUP_DIR/" 2>/dev/null
echo "✅ Backup criado: $BACKUP_DIR"
echo ""

# Criar branch Git
echo -e "${CYAN}Criando branch Git para correções...${NC}"
BRANCH_NAME="orchestration/auto-fix-$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BRANCH_NAME" 2>/dev/null || echo "Branch já existe ou Git não disponível"
echo ""

echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Iniciando Execução...${NC}"
echo ""

# Executar terminal-executor diretamente
echo -e "${CYAN}🚀 Executando correções automatizadas...${NC}"
echo ""

if [ -f "./scripts/terminal-executor.sh" ]; then
  # Executar em foreground para ver o output
  ./scripts/terminal-executor.sh "$LOGS_DIR" "$BRANCH_NAME"

  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Execução concluída com sucesso!${NC}"
    echo ""
  else
    echo ""
    echo -e "${RED}❌ Execução falhou com código $EXIT_CODE${NC}"
    echo ""
    exit $EXIT_CODE
  fi
else
  echo "❌ Script terminal-executor.sh não encontrado"
  exit 1
fi

echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${WHITE}Relatórios e Logs:${NC}"
echo "  📁 Diretório: $LOGS_DIR"
echo "  📝 Log principal: $LOGS_DIR/executor.log"
echo "  📊 Resumo: $LOGS_DIR/RESUMO_EXECUCAO.md"
echo "  🔍 Verificação: $LOGS_DIR/verification-report.txt"
echo ""

if [ -f "$LOGS_DIR/deploy-done.flag" ]; then
  echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"

  if [ -f "$LOGS_DIR/commit-info.txt" ]; then
    echo ""
    cat "$LOGS_DIR/commit-info.txt"
  fi

  if [ -f "$LOGS_DIR/deploy-info.txt" ]; then
    echo ""
    cat "$LOGS_DIR/deploy-info.txt"
  fi
fi

echo ""
echo -e "${CYAN}Execução autônoma finalizada.${NC}"
echo ""
