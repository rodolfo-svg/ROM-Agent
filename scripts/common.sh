#!/bin/bash

# Funções compartilhadas entre todos os terminais

# Cores
export GREEN='\033[0;32m'
export RED='\033[0;31m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export PURPLE='\033[0;35m'
export CYAN='\033[0;36m'
export NC='\033[0m'

# Diretório de logs (passado como argumento)
export LOGS_DIR="${1:-./logs/orchestrator-default}"

# Funções de log
log() {
  local msg="$1"
  local timestamp=$(date +%H:%M:%S)
  echo -e "${GREEN}[${timestamp}]${NC} ${msg}"
}

error() {
  local msg="$1"
  local timestamp=$(date +%H:%M:%S)
  echo -e "${RED}[${timestamp}] ERROR:${NC} ${msg}"
}

warn() {
  local msg="$1"
  local timestamp=$(date +%H:%M:%S)
  echo -e "${YELLOW}[${timestamp}] WARN:${NC} ${msg}"
}

info() {
  local msg="$1"
  local timestamp=$(date +%H:%M:%S)
  echo -e "${BLUE}[${timestamp}] INFO:${NC} ${msg}"
}

success() {
  local msg="$1"
  local timestamp=$(date +%H:%M:%S)
  echo -e "${GREEN}[${timestamp}] ✓${NC} ${msg}"
}

# Função para verificar se comando existe
command_exists() {
  command -v "$1" &> /dev/null
}

# Função para executar comando com retry
execute_with_retry() {
  local command="$1"
  local max_attempts="${2:-3}"
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    info "Tentativa $attempt de $max_attempts: $command"

    if eval "$command"; then
      success "Comando executado com sucesso"
      return 0
    fi

    if [ $attempt -lt $max_attempts ]; then
      warn "Falhou, tentando novamente em 5 segundos..."
      sleep 5
    fi

    ((attempt++))
  done

  error "Comando falhou após $max_attempts tentativas"
  return 1
}

# Função para criar checkpoint
create_checkpoint() {
  local checkpoint_name="$1"
  local checkpoint_file="$LOGS_DIR/checkpoints/${checkpoint_name}.done"

  mkdir -p "$LOGS_DIR/checkpoints"
  touch "$checkpoint_file"
  log "✓ Checkpoint: $checkpoint_name"
}

# Função para verificar se checkpoint existe
checkpoint_exists() {
  local checkpoint_name="$1"
  local checkpoint_file="$LOGS_DIR/checkpoints/${checkpoint_name}.done"

  [ -f "$checkpoint_file" ]
}

# Função para fazer backup de arquivo
backup_file() {
  local file="$1"
  local backup_dir="$LOGS_DIR/backups"

  if [ -f "$file" ]; then
    mkdir -p "$backup_dir"
    cp "$file" "$backup_dir/$(basename "$file").$(date +%Y%m%d-%H%M%S).bak"
    log "Backup criado: $(basename "$file")"
  fi
}

# Função para verificar status de saída
check_exit_status() {
  local status=$?
  local command_name="$1"

  if [ $status -ne 0 ]; then
    error "$command_name falhou com código $status"
    return 1
  fi

  success "$command_name concluído"
  return 0
}

# Função para enviar notificação (se configurado)
notify() {
  local message="$1"
  local level="${2:-info}" # info, success, warning, error

  # Desktop notification (macOS)
  if command_exists osascript; then
    osascript -e "display notification \"$message\" with title \"ROM-Agent Orchestrator\" subtitle \"$level\""
  fi

  # TODO: Adicionar Slack webhook se configurado
  # TODO: Adicionar email se configurado
}

# Função para verificar se processo está rodando
is_process_running() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null
}

# Função para aguardar conclusão de arquivo
wait_for_file() {
  local file="$1"
  local timeout="${2:-300}" # 5 minutos default
  local elapsed=0

  while [ ! -f "$file" ] && [ $elapsed -lt $timeout ]; do
    sleep 1
    ((elapsed++))
  done

  if [ -f "$file" ]; then
    return 0
  else
    error "Timeout aguardando arquivo: $file"
    return 1
  fi
}

# Função para criar barra de progresso
progress_bar() {
  local current="$1"
  local total="$2"
  local width=50

  local percentage=$((current * 100 / total))
  local completed=$((width * current / total))

  printf "["
  for ((i=0; i<completed; i++)); do printf "█"; done
  for ((i=completed; i<width; i++)); do printf "░"; done
  printf "] %3d%% (%d/%d)\n" "$percentage" "$current" "$total"
}

# Exportar funções
export -f log error warn info success
export -f command_exists execute_with_retry
export -f create_checkpoint checkpoint_exists
export -f backup_file check_exit_status notify
export -f is_process_running wait_for_file progress_bar
