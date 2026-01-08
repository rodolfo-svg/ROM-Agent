#!/bin/bash

# Terminal Monitor - Monitoramento em Streaming Tempo Real
# Recebe: $1 = LOGS_DIR

LOGS_DIR="$1"
LOG_FILE="$LOGS_DIR/executor.log"
STATUS_FILE="$LOGS_DIR/executor-status.txt"
PROGRESS_FILE="$LOGS_DIR/progress.json"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Função para desenhar barra de progresso
draw_progress_bar() {
  local percentage=$1
  local width=50
  local completed=$((width * percentage / 100))
  local remaining=$((width - completed))

  printf "["
  for ((i=0; i<completed; i++)); do printf "█"; done
  for ((i=0; i<remaining; i++)); do printf "░"; done
  printf "] %3d%%\n" "$percentage"
}

# Função para ler JSON (fallback se jq não disponível)
get_json_value() {
  local file="$1"
  local key="$2"

  if command -v jq &> /dev/null && [ -f "$file" ]; then
    jq -r ".$key" "$file" 2>/dev/null || echo "N/A"
  else
    echo "N/A"
  fi
}

# Aguardar criação dos arquivos de log
log_waiting() {
  echo -e "${YELLOW}Aguardando início da execução...${NC}"
  echo ""

  local dots=0
  while [ ! -f "$LOG_FILE" ] || [ ! -f "$STATUS_FILE" ]; do
    printf "\r${CYAN}Aguardando Terminal Executor"
    for ((i=0; i<dots; i++)); do printf "."; done
    printf "   ${NC}"

    dots=$((dots + 1))
    if [ $dots -gt 3 ]; then dots=0; fi

    sleep 1
  done

  printf "\r${GREEN}✓ Executor iniciado!                    ${NC}\n"
  echo ""
  sleep 1
}

# Banner inicial
clear
cat << "EOF"
╔══════════════════════════════════════════════════════════════════════╗
║                  TERMINAL MONITOR (STREAMING)                         ║
║              Monitoramento em Tempo Real                             ║
╚══════════════════════════════════════════════════════════════════════╝
EOF

echo ""
echo -e "${BLUE}📁 Logs:${NC} $LOGS_DIR"
echo ""

# Aguardar início
log_waiting

# Streaming em tempo real
echo -e "${GREEN}Streaming de Logs Iniciado${NC}"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# Função para atualizar dashboard
update_dashboard() {
  # Salvar posição do cursor
  tput sc

  # Ir para o topo
  tput cup 0 0

  # Limpar tela
  clear

  # Header
  cat << "EOF"
╔══════════════════════════════════════════════════════════════════════╗
║                  DASHBOARD DE MONITORAMENTO                           ║
╚══════════════════════════════════════════════════════════════════════╝
EOF

  echo ""

  # Status atual
  if [ -f "$STATUS_FILE" ]; then
    local status=$(cat "$STATUS_FILE" 2>/dev/null || echo "Aguardando...")
    echo -e "${WHITE}Status Atual:${NC} $status"
  else
    echo -e "${YELLOW}Aguardando início...${NC}"
  fi

  echo ""

  # Progresso
  if [ -f "$PROGRESS_FILE" ]; then
    local phase=$(get_json_value "$PROGRESS_FILE" "phase")
    local percentage=$(get_json_value "$PROGRESS_FILE" "percentage")

    echo -e "${WHITE}Fase Atual:${NC} ${CYAN}$phase${NC}"
    echo ""
    echo -n "Progresso: "
    draw_progress_bar "$percentage"
  else
    echo -e "${YELLOW}Aguardando progresso...${NC}"
  fi

  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo ""
  echo -e "${WHITE}Últimas 15 Linhas do Log:${NC}"
  echo ""

  # Últimas linhas do log (coloridas)
  if [ -f "$LOG_FILE" ]; then
    tail -15 "$LOG_FILE" | while IFS= read -r line; do
      # Colorir baseado no conteúdo
      if echo "$line" | grep -q "ERROR"; then
        echo -e "${RED}$line${NC}"
      elif echo "$line" | grep -q "✓"; then
        echo -e "${GREEN}$line${NC}"
      elif echo "$line" | grep -q "⚠️"; then
        echo -e "${YELLOW}$line${NC}"
      elif echo "$line" | grep -q "FASE"; then
        echo -e "${PURPLE}$line${NC}"
      elif echo "$line" | grep -q "═══"; then
        echo -e "${CYAN}$line${NC}"
      else
        echo "$line"
      fi
    done
  else
    echo -e "${YELLOW}Aguardando logs...${NC}"
  fi

  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo ""

  # Estatísticas
  if [ -f "$LOG_FILE" ]; then
    local total_lines=$(wc -l < "$LOG_FILE" 2>/dev/null || echo "0")
    local errors=$(grep -c "ERROR" "$LOG_FILE" 2>/dev/null || echo "0")
    local warnings=$(grep -c "⚠️" "$LOG_FILE" 2>/dev/null || echo "0")
    local success=$(grep -c "✓" "$LOG_FILE" 2>/dev/null || echo "0")

    echo -e "${WHITE}Estatísticas:${NC}"
    echo "  Total de linhas: $total_lines"
    echo -e "  ${RED}Erros: $errors${NC}"
    echo -e "  ${YELLOW}Avisos: $warnings${NC}"
    echo -e "  ${GREEN}Sucessos: $success${NC}"
  fi

  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo ""
  echo -e "${BLUE}Atualização automática a cada 2 segundos${NC}"
  echo -e "${YELLOW}Pressione Ctrl+C para sair${NC}"
  echo ""

  # Verificar se execução terminou
  if [ -f "$LOGS_DIR/executor-done.flag" ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}                    ✅ EXECUÇÃO CONCLUÍDA!                               ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${WHITE}Próximos passos automáticos:${NC}"
    echo "  1. ✅ Auditoria final"
    echo "  2. ✅ Commit automático"
    echo "  3. ✅ Deploy"
    echo ""
    echo "Aguardando finalização completa..."
    return 1
  fi

  # Verificar se houve erro
  if [ -f "$LOGS_DIR/error.flag" ]; then
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}                    ❌ ERRO DETECTADO!                                   ${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Verifique os logs para mais detalhes."
    echo ""
    return 1
  fi

  return 0
}

# Loop de monitoramento
while true; do
  if ! update_dashboard; then
    # Execução terminou ou erro
    break
  fi

  sleep 2
done

# Aguardar deploy
if [ -f "$LOGS_DIR/executor-done.flag" ] && [ ! -f "$LOGS_DIR/error.flag" ]; then
  echo ""
  echo "Aguardando conclusão do deploy..."
  echo ""

  # Aguardar flag de deploy
  while [ ! -f "$LOGS_DIR/deploy-done.flag" ] && [ ! -f "$LOGS_DIR/deploy-error.flag" ]; do
    sleep 2

    # Mostrar últimas linhas do log de deploy se existir
    if [ -f "$LOGS_DIR/deploy.log" ]; then
      clear
      echo "╔══════════════════════════════════════════════════════════════════════╗"
      echo "║                    DEPLOY EM ANDAMENTO                                ║"
      echo "╚══════════════════════════════════════════════════════════════════════╝"
      echo ""
      tail -20 "$LOGS_DIR/deploy.log"
      echo ""
    fi
  done

  # Resultado final
  clear
  cat << "EOF"
╔══════════════════════════════════════════════════════════════════════╗
║                     RESULTADO FINAL                                   ║
╚══════════════════════════════════════════════════════════════════════╝
EOF

  echo ""

  if [ -f "$LOGS_DIR/deploy-done.flag" ]; then
    echo -e "${GREEN}✅ TODAS AS OPERAÇÕES CONCLUÍDAS COM SUCESSO!${NC}"
    echo ""
    echo "✓ Correções aplicadas"
    echo "✓ Auditoria final realizada"
    echo "✓ Commit criado"
    echo "✓ Deploy realizado"
    echo ""
    echo "────────────────────────────────────────────────────────────────────"
    echo ""

    # Mostrar informações do commit
    if [ -f "$LOGS_DIR/commit-info.txt" ]; then
      echo -e "${WHITE}Informações do Commit:${NC}"
      echo ""
      cat "$LOGS_DIR/commit-info.txt"
      echo ""
    fi

    # Mostrar informações do deploy
    if [ -f "$LOGS_DIR/deploy-info.txt" ]; then
      echo -e "${WHITE}Informações do Deploy:${NC}"
      echo ""
      cat "$LOGS_DIR/deploy-info.txt"
      echo ""
    fi

    echo "────────────────────────────────────────────────────────────────────"
    echo ""
    echo -e "${CYAN}📁 Logs completos em:${NC} $LOGS_DIR"
    echo ""

  else
    echo -e "${RED}❌ HOUVE ERROS DURANTE O PROCESSO${NC}"
    echo ""
    echo "Verifique os logs para mais detalhes:"
    echo "  - Executor: $LOGS_DIR/executor.log"
    echo "  - Deploy: $LOGS_DIR/deploy.log"
    echo ""
  fi
fi

echo ""
echo "Pressione qualquer tecla para fechar este terminal..."
read -n 1
