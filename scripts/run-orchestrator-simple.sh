#!/bin/bash

# ROM-Agent Orchestrator v2.0.0
# Sistema Simplificado com 2 Terminais: Execução + Monitoramento

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Diretório base
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Diretório de logs com timestamp
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
║                    Orquestrador 2 Terminais                         ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
EOF

echo ""
echo -e "${GREEN}Iniciando sistema de correção automatizada...${NC}"
echo ""
echo -e "${BLUE}📁 Diretório do projeto:${NC} $PROJECT_DIR"
echo -e "${BLUE}📝 Logs salvos em:${NC} $LOGS_DIR"
echo ""

# Criar arquivo de controle
cat > "$LOGS_DIR/control.json" << EOF
{
  "start_time": "$(date -Iseconds)",
  "status": "starting",
  "executor_pid": null,
  "monitor_pid": null,
  "phase": "initialization",
  "progress": 0,
  "total_phases": 5
}
EOF

# Verificar dependências
echo -e "${CYAN}Verificando dependências...${NC}"

if ! command -v node &> /dev/null; then
  echo "❌ Node.js não encontrado"
  exit 1
fi

if ! command -v python3 &> /dev/null; then
  echo "⚠️  Python3 não encontrado - scrapers Python não funcionarão"
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
echo -e "${GREEN}Iniciando Terminais...${NC}"
echo ""

# Aguardar 2 segundos para garantir que arquivos foram criados
sleep 2

# Terminal 1: EXECUTOR
echo -e "${CYAN}🚀 Iniciando Terminal 1: EXECUTOR${NC}"
osascript <<EOF
tell application "Terminal"
    set newTab to do script "cd '$PROJECT_DIR' && clear && echo '╔══════════════════════════════════════════════════╗' && echo '║         TERMINAL 1: EXECUTOR                     ║' && echo '╚══════════════════════════════════════════════════╝' && echo '' && ./scripts/terminal-executor.sh '$LOGS_DIR' '$BRANCH_NAME'"
    set custom title of newTab to "ROM-Agent: EXECUTOR"
end tell
EOF

sleep 2

# Terminal 2: MONITOR
echo -e "${CYAN}📊 Iniciando Terminal 2: MONITOR (Streaming)${NC}"
osascript <<EOF
tell application "Terminal"
    set newTab to do script "cd '$PROJECT_DIR' && clear && echo '╔══════════════════════════════════════════════════╗' && echo '║         TERMINAL 2: MONITOR (STREAMING)          ║' && echo '╚══════════════════════════════════════════════════╝' && echo '' && ./scripts/terminal-monitor.sh '$LOGS_DIR'"
    set custom title of newTab to "ROM-Agent: MONITOR"
end tell
EOF

echo ""
echo "✅ Terminais iniciados!"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Sistema em execução!${NC}"
echo ""
echo "📊 Terminal 1 (EXECUTOR): Executando correções"
echo "📺 Terminal 2 (MONITOR): Monitoramento em tempo real com streaming"
echo ""
echo "📁 Logs em tempo real: $LOGS_DIR"
echo ""
echo "⏳ Aguarde a conclusão (estimativa: 16-20 horas)"
echo ""
echo "Após conclusão:"
echo "  ✅ Auditoria final será executada"
echo "  ✅ Commit automático será criado"
echo "  ✅ Deploy será realizado"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Você pode fechar este terminal. Os outros 2 continuarão rodando."
echo ""
