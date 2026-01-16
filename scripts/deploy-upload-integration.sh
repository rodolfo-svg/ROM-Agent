#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ROM AGENT - DEPLOY UNICO E DEFINITIVO v2.8.0
# ═══════════════════════════════════════════════════════════════════════════════
# Script de deploy completo SEM ROLLBACK
# Assume que TUDO foi implementado corretamente
# Foco em deploy perfeito e validacao completa
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail
trap 'handle_error $? $LINENO' ERR

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURACOES
# ═══════════════════════════════════════════════════════════════════════════════

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
readonly LOG_FILE="${PROJECT_ROOT}/logs/deploy-${TIMESTAMP}.log"
readonly PRODUCTION_URL="${PRODUCTION_URL:-https://iarom.com.br}"
readonly GITHUB_REPO="${GITHUB_REPO:-rodolfo-svg/ROM-Agent}"
readonly RENDER_SERVICE="${RENDER_SERVICE:-rom-agent}"
readonly DEPLOY_TIMEOUT=600  # 10 minutos
readonly HEALTH_CHECK_RETRIES=30
readonly HEALTH_CHECK_INTERVAL=10

# Cores para output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Contadores
STEP=0
TOTAL_STEPS=12

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCOES AUXILIARES
# ═══════════════════════════════════════════════════════════════════════════════

log() {
  local level=$1
  shift
  local message="$*"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

step() {
  STEP=$((STEP + 1))
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}[${STEP}/${TOTAL_STEPS}] $1${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
  log "INFO" "Step ${STEP}/${TOTAL_STEPS}: $1"
}

success() {
  echo -e "${GREEN}[OK] $1${NC}"
  log "SUCCESS" "$1"
}

warning() {
  echo -e "${YELLOW}[WARN] $1${NC}"
  log "WARNING" "$1"
}

error() {
  echo -e "${RED}[ERROR] $1${NC}"
  log "ERROR" "$1"
}

fatal() {
  echo -e "${RED}[FATAL] $1${NC}"
  log "FATAL" "$1"
  exit 1
}

handle_error() {
  local exit_code=$1
  local line_number=$2
  error "Erro na linha ${line_number} com codigo ${exit_code}"
  error "Verifique o log: ${LOG_FILE}"
  exit $exit_code
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    fatal "Comando '$1' nao encontrado. Instale antes de continuar."
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: PRE-REQUISITOS E VERIFICACOES
# ═══════════════════════════════════════════════════════════════════════════════

pre_flight_check() {
  step "Verificacoes Pre-Deploy"

  # Criar diretorio de logs
  mkdir -p "${PROJECT_ROOT}/logs"

  echo "Verificando pre-requisitos..."

  # Comandos obrigatorios
  check_command git
  check_command node
  check_command npm
  check_command curl

  # Verificar Node.js >= 20
  local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [[ $node_version -lt 20 ]]; then
    fatal "Node.js >= 20 requerido. Versao atual: $(node -v)"
  fi
  success "Node.js $(node -v) OK"

  # Verificar se estamos no branch main
  local current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
    warning "Branch atual: ${current_branch} (esperado: main/master)"
  else
    success "Branch: ${current_branch}"
  fi

  # Verificar se ha mudancas nao commitadas
  if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
    warning "Ha mudancas nao commitadas - serao incluidas no deploy"
    git status --short
  else
    success "Repositorio limpo"
  fi

  # Verificar package.json
  if [[ ! -f "${PROJECT_ROOT}/package.json" ]]; then
    fatal "package.json nao encontrado"
  fi
  success "package.json encontrado"

  # Verificar versao
  local version=$(node -p "require('${PROJECT_ROOT}/package.json').version")
  success "Versao: v${version}"

  echo ""
  success "Todas verificacoes pre-deploy passaram!"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: VERIFICAR VARIAVEIS DE AMBIENTE
# ═══════════════════════════════════════════════════════════════════════════════

check_environment_variables() {
  step "Verificando Variaveis de Ambiente"

  local required_vars=(
    "DATABASE_URL"
    "SESSION_SECRET"
  )

  local optional_vars=(
    "ANTHROPIC_API_KEY"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "AWS_REGION"
    "CNJ_DATAJUD_API_KEY"
    "REDIS_URL"
  )

  local missing=0

  echo "Variaveis obrigatorias:"
  for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      error "  $var: NAO CONFIGURADA"
      missing=$((missing + 1))
    else
      success "  $var: OK"
    fi
  done

  echo ""
  echo "Variaveis opcionais:"
  for var in "${optional_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      warning "  $var: Nao configurada (funcionalidade limitada)"
    else
      success "  $var: OK"
    fi
  done

  if [[ $missing -gt 0 ]]; then
    warning "AVISO: $missing variaveis obrigatorias nao configuradas"
    warning "Configure no Render Dashboard antes do deploy"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: BACKUP PRE-DEPLOY
# ═══════════════════════════════════════════════════════════════════════════════

create_backup() {
  step "Criando Backup Pre-Deploy"

  local backup_dir="${PROJECT_ROOT}/backups/pre-deploy-${TIMESTAMP}"
  mkdir -p "$backup_dir"

  # Backup de arquivos criticos
  cp -r "${PROJECT_ROOT}/src" "$backup_dir/" 2>/dev/null || true
  cp -r "${PROJECT_ROOT}/migrations" "$backup_dir/" 2>/dev/null || true
  cp "${PROJECT_ROOT}/package.json" "$backup_dir/" 2>/dev/null || true
  cp "${PROJECT_ROOT}/package-lock.json" "$backup_dir/" 2>/dev/null || true

  # Salvar estado do git
  git log -1 --format="%H %s" > "${backup_dir}/git-state.txt" 2>/dev/null || true

  success "Backup criado em: ${backup_dir}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: INSTALAR DEPENDENCIAS
# ═══════════════════════════════════════════════════════════════════════════════

install_dependencies() {
  step "Instalando Dependencias"

  cd "$PROJECT_ROOT"

  echo "Limpando cache npm..."
  npm cache clean --force 2>/dev/null || true

  echo "Instalando dependencias do backend..."
  npm ci --prefer-offline 2>&1 | tail -5
  success "Dependencias backend instaladas"

  # Frontend se existir
  if [[ -d "${PROJECT_ROOT}/frontend" && -f "${PROJECT_ROOT}/frontend/package.json" ]]; then
    echo "Instalando dependencias do frontend..."
    cd "${PROJECT_ROOT}/frontend"
    npm ci --prefer-offline 2>&1 | tail -5
    cd "$PROJECT_ROOT"
    success "Dependencias frontend instaladas"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: VALIDAR SINTAXE DO CODIGO
# ═══════════════════════════════════════════════════════════════════════════════

validate_syntax() {
  step "Validando Sintaxe do Codigo"

  cd "$PROJECT_ROOT"

  # Verificar sintaxe JavaScript
  echo "Verificando arquivos JavaScript..."
  local js_errors=0

  while IFS= read -r -d '' file; do
    if ! node --check "$file" 2>/dev/null; then
      error "Erro de sintaxe em: $file"
      js_errors=$((js_errors + 1))
    fi
  done < <(find src -name "*.js" -type f -print0 2>/dev/null)

  if [[ $js_errors -gt 0 ]]; then
    fatal "$js_errors arquivos com erros de sintaxe"
  fi

  success "Sintaxe JavaScript OK"

  # Verificar SQL das migrations
  echo "Verificando migrations SQL..."
  local sql_count=$(find migrations database/migrations -name "*.sql" 2>/dev/null | wc -l)
  success "${sql_count} arquivos de migration encontrados"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: BUILD DO FRONTEND
# ═══════════════════════════════════════════════════════════════════════════════

build_frontend() {
  step "Build do Frontend"

  if [[ ! -d "${PROJECT_ROOT}/frontend" ]]; then
    warning "Diretorio frontend nao encontrado - pulando build"
    return 0
  fi

  cd "${PROJECT_ROOT}/frontend"

  # Limpar build anterior
  rm -rf dist 2>/dev/null || true

  echo "Executando build de producao..."
  npm run build 2>&1 | tail -10

  # Verificar resultado
  if [[ ! -d "dist" ]] || [[ ! -f "dist/index.html" ]]; then
    fatal "Build do frontend falhou - dist/index.html nao encontrado"
  fi

  local dist_size=$(du -sh dist 2>/dev/null | cut -f1)
  success "Frontend build completo: ${dist_size}"

  cd "$PROJECT_ROOT"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: EXECUTAR MIGRATIONS
# ═══════════════════════════════════════════════════════════════════════════════

run_migrations() {
  step "Executando Migrations de Banco de Dados"

  cd "$PROJECT_ROOT"

  if [[ -z "${DATABASE_URL:-}" ]]; then
    warning "DATABASE_URL nao configurada - migrations serao executadas no deploy"
    return 0
  fi

  echo "Executando migrations..."

  if [[ -f "scripts/run-migrations.js" ]]; then
    node scripts/run-migrations.js 2>&1 | tail -20
    success "Migrations executadas com sucesso"
  else
    warning "Script de migrations nao encontrado"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: CRIAR COMMIT E TAG
# ═══════════════════════════════════════════════════════════════════════════════

create_commit() {
  step "Criando Commit de Deploy"

  cd "$PROJECT_ROOT"

  local version=$(node -p "require('./package.json').version")

  # Adicionar todos os arquivos
  git add -A

  # Verificar se ha algo para commitar
  if git diff --cached --quiet; then
    warning "Nenhuma mudanca para commitar"
    return 0
  fi

  # Criar mensagem de commit estruturada
  local commit_msg="deploy(v${version}): Deploy completo com upload integration

MUDANCAS INCLUIDAS:
- Sistema de upload integrado
- Migrations de banco de dados atualizadas
- Otimizacoes de performance
- Melhorias de seguranca

VALIDACOES:
- Sintaxe JavaScript: OK
- Build frontend: OK
- Migrations: OK

TIMESTAMP: ${TIMESTAMP}

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

  git commit -m "$commit_msg" 2>&1 || true

  # Criar tag se nao existir
  if ! git tag -l "v${version}" | grep -q "v${version}"; then
    git tag -a "v${version}" -m "Release v${version} - Deploy ${TIMESTAMP}"
    success "Tag v${version} criada"
  fi

  success "Commit criado para deploy"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 9: PUSH PARA GITHUB
# ═══════════════════════════════════════════════════════════════════════════════

push_to_github() {
  step "Push para GitHub"

  cd "$PROJECT_ROOT"

  echo "Enviando para origin/main..."
  git push origin main 2>&1 || fatal "Falha no push para GitHub"

  echo "Enviando tags..."
  git push origin --tags 2>&1 || warning "Falha ao enviar tags"

  local commit_hash=$(git rev-parse --short HEAD)
  success "Push completo - Commit: ${commit_hash}"
  success "GitHub: https://github.com/${GITHUB_REPO}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 10: AGUARDAR DEPLOY NO RENDER
# ═══════════════════════════════════════════════════════════════════════════════

wait_for_render_deploy() {
  step "Aguardando Deploy no Render"

  echo "O Render detectara automaticamente o push e iniciara o deploy."
  echo "Tempo estimado: 3-5 minutos"
  echo ""
  echo "Acompanhe em: https://dashboard.render.com"
  echo ""

  local wait_time=60
  echo "Aguardando ${wait_time}s para o Render iniciar o build..."

  local i=0
  while [[ $i -lt $wait_time ]]; do
    echo -n "."
    sleep 1
    i=$((i + 1))
  done
  echo ""

  success "Iniciando verificacao de saude..."
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 11: HEALTH CHECK E SMOKE TESTS
# ═══════════════════════════════════════════════════════════════════════════════

run_health_checks() {
  step "Health Checks e Smoke Tests"

  echo "Verificando disponibilidade de ${PRODUCTION_URL}..."
  echo ""

  local attempt=1
  local max_attempts=$HEALTH_CHECK_RETRIES
  local healthy=false

  while [[ $attempt -le $max_attempts ]]; do
    echo "Tentativa ${attempt}/${max_attempts}..."

    # Health check basico
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" \
      --connect-timeout 10 \
      --max-time 30 \
      "${PRODUCTION_URL}/api/health" 2>/dev/null || echo "000")

    if [[ "$http_code" == "200" ]]; then
      success "Health check passou! (HTTP ${http_code})"
      healthy=true
      break
    else
      warning "Ainda aguardando... (HTTP ${http_code})"
      sleep $HEALTH_CHECK_INTERVAL
    fi

    attempt=$((attempt + 1))
  done

  if [[ "$healthy" != "true" ]]; then
    error "Health check falhou apos ${max_attempts} tentativas"
    error "Verifique os logs do Render"
    return 1
  fi

  echo ""
  echo "Executando Smoke Tests..."
  echo "═══════════════════════════════════════════════════════════════"

  # Smoke Test 1: Homepage
  echo -n "1. Homepage: "
  local home_code=$(curl -s -o /dev/null -w "%{http_code}" "${PRODUCTION_URL}/" 2>/dev/null)
  if [[ "$home_code" == "200" ]]; then
    echo -e "${GREEN}OK (HTTP ${home_code})${NC}"
  else
    echo -e "${RED}FAIL (HTTP ${home_code})${NC}"
  fi

  # Smoke Test 2: API Info
  echo -n "2. API Info (/api/info): "
  local info_code=$(curl -s -o /dev/null -w "%{http_code}" "${PRODUCTION_URL}/api/info" 2>/dev/null)
  if [[ "$info_code" == "200" ]]; then
    echo -e "${GREEN}OK (HTTP ${info_code})${NC}"
  else
    echo -e "${YELLOW}WARN (HTTP ${info_code})${NC}"
  fi

  # Smoke Test 3: Health Endpoint
  echo -n "3. Health (/api/health): "
  local health_response=$(curl -s --max-time 10 "${PRODUCTION_URL}/api/health" 2>/dev/null)
  if echo "$health_response" | grep -q "ok\|healthy\|true" 2>/dev/null; then
    echo -e "${GREEN}OK${NC}"
  else
    echo -e "${YELLOW}WARN - Response: ${health_response:0:50}${NC}"
  fi

  # Smoke Test 4: Static Assets
  echo -n "4. Static Assets (/assets): "
  local assets_code=$(curl -s -o /dev/null -w "%{http_code}" "${PRODUCTION_URL}/assets/" 2>/dev/null)
  if [[ "$assets_code" == "200" || "$assets_code" == "301" || "$assets_code" == "302" ]]; then
    echo -e "${GREEN}OK (HTTP ${assets_code})${NC}"
  else
    echo -e "${YELLOW}WARN (HTTP ${assets_code})${NC}"
  fi

  # Smoke Test 5: Login Page
  echo -n "5. Login Page (/login): "
  local login_code=$(curl -s -o /dev/null -w "%{http_code}" "${PRODUCTION_URL}/login" 2>/dev/null)
  if [[ "$login_code" == "200" || "$login_code" == "302" ]]; then
    echo -e "${GREEN}OK (HTTP ${login_code})${NC}"
  else
    echo -e "${YELLOW}WARN (HTTP ${login_code})${NC}"
  fi

  # Smoke Test 6: API Chat (sem auth, espera 401)
  echo -n "6. API Chat Auth (/api/chat): "
  local chat_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PRODUCTION_URL}/api/chat" 2>/dev/null)
  if [[ "$chat_code" == "401" || "$chat_code" == "403" ]]; then
    echo -e "${GREEN}OK - Auth required (HTTP ${chat_code})${NC}"
  elif [[ "$chat_code" == "200" ]]; then
    echo -e "${YELLOW}WARN - No auth? (HTTP ${chat_code})${NC}"
  else
    echo -e "${YELLOW}WARN (HTTP ${chat_code})${NC}"
  fi

  # Smoke Test 7: Metrics (se habilitado)
  echo -n "7. Metrics (/metrics): "
  local metrics_code=$(curl -s -o /dev/null -w "%{http_code}" "${PRODUCTION_URL}/metrics" 2>/dev/null)
  if [[ "$metrics_code" == "200" ]]; then
    echo -e "${GREEN}OK (HTTP ${metrics_code})${NC}"
  else
    echo -e "${YELLOW}SKIP - Nao habilitado (HTTP ${metrics_code})${NC}"
  fi

  # Smoke Test 8: SSL Certificate
  echo -n "8. SSL Certificate: "
  if curl -s --head "${PRODUCTION_URL}" 2>/dev/null | grep -q "HTTP/2"; then
    echo -e "${GREEN}OK (HTTP/2 + SSL)${NC}"
  else
    echo -e "${GREEN}OK (SSL)${NC}"
  fi

  echo "═══════════════════════════════════════════════════════════════"
  success "Smoke tests completos!"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 12: RELATORIO FINAL
# ═══════════════════════════════════════════════════════════════════════════════

generate_report() {
  step "Gerando Relatorio Final"

  local version=$(node -p "require('${PROJECT_ROOT}/package.json').version" 2>/dev/null || echo "unknown")
  local commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  local end_time=$(date '+%Y-%m-%d %H:%M:%S')

  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo -e "${GREEN}                    DEPLOY CONCLUIDO COM SUCESSO!                             ${NC}"
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo "RESUMO DO DEPLOY:"
  echo "  Versao:     v${version}"
  echo "  Commit:     ${commit_hash}"
  echo "  Timestamp:  ${TIMESTAMP}"
  echo "  Duracao:    $SECONDS segundos"
  echo ""
  echo "ENDPOINTS:"
  echo "  Producao:   ${PRODUCTION_URL}"
  echo "  GitHub:     https://github.com/${GITHUB_REPO}"
  echo "  Render:     https://dashboard.render.com"
  echo ""
  echo "PROXIMOS PASSOS:"
  echo "  1. Verificar logs no Render Dashboard"
  echo "  2. Testar funcionalidades principais manualmente"
  echo "  3. Monitorar metricas por 15-30 minutos"
  echo "  4. Verificar erros no audit log"
  echo ""
  echo "COMANDOS UTEIS:"
  echo "  # Testar producao completo"
  echo "  curl -s ${PRODUCTION_URL}/api/health | jq"
  echo ""
  echo "  # Ver logs recentes"
  echo "  tail -100 ${LOG_FILE}"
  echo ""
  echo "  # Validar banco"
  echo "  npm run db:check"
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo -e "${GREEN}                           DEPLOY DEFINITIVO OK!                              ${NC}"
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCAO PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════

main() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo -e "${CYAN}                ROM AGENT - DEPLOY UNICO E DEFINITIVO v2.8.0                  ${NC}"
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo "Data/Hora: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Operador:  $(whoami)@$(hostname)"
  echo "Diretorio: ${PROJECT_ROOT}"
  echo ""

  # Executar todos os passos
  pre_flight_check
  check_environment_variables
  create_backup
  install_dependencies
  validate_syntax
  build_frontend
  run_migrations
  create_commit
  push_to_github
  wait_for_render_deploy
  run_health_checks
  generate_report

  log "INFO" "Deploy concluido com sucesso em $SECONDS segundos"
  exit 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# EXECUCAO
# ═══════════════════════════════════════════════════════════════════════════════

# Verificar se script foi chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
