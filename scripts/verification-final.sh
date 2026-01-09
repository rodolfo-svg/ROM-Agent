#!/bin/bash

# Verification Final Script
# Verificação completa antes de commit e deploy
# Retorna 0 se tudo OK, 1 se houver problemas críticos

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Contadores
ERRORS=0
WARNINGS=0
CHECKS_PASSED=0
TOTAL_CHECKS=0

# Arquivo de relatório
REPORT_FILE="${1:-./verification-report.txt}"
echo "RELATÓRIO DE VERIFICAÇÃO FINAL - $(date)" > "$REPORT_FILE"
echo "═══════════════════════════════════════════════════════════" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Função de log
log() {
  local msg="$1"
  echo -e "${BLUE}[CHECK]${NC} $msg"
  echo "[CHECK] $msg" >> "$REPORT_FILE"
}

success() {
  local msg="$1"
  echo -e "${GREEN}✓${NC} $msg"
  echo "✓ $msg" >> "$REPORT_FILE"
  ((CHECKS_PASSED++))
}

error() {
  local msg="$1"
  echo -e "${RED}✗${NC} $msg"
  echo "✗ ERROR: $msg" >> "$REPORT_FILE"
  ((ERRORS++))
}

warn() {
  local msg="$1"
  echo -e "${YELLOW}⚠${NC} $msg"
  echo "⚠ WARNING: $msg" >> "$REPORT_FILE"
  ((WARNINGS++))
}

info() {
  local msg="$1"
  echo -e "${CYAN}ℹ${NC} $msg"
  echo "ℹ INFO: $msg" >> "$REPORT_FILE"
}

# Função para executar check
run_check() {
  local name="$1"
  local command="$2"

  ((TOTAL_CHECKS++))
  log "$name"

  if eval "$command" >> "$REPORT_FILE" 2>&1; then
    success "$name"
    return 0
  else
    error "$name"
    return 1
  fi
}

# Banner
clear
cat << "EOF"
╔══════════════════════════════════════════════════════════════════════╗
║                   VERIFICAÇÃO FINAL PRÉ-DEPLOY                        ║
║              Validação Completa do Sistema                           ║
╚══════════════════════════════════════════════════════════════════════╝
EOF

echo ""
info "Iniciando verificação completa do sistema..."
info "Relatório será salvo em: $REPORT_FILE"
echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 1: ESTRUTURA DO PROJETO
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 1: ESTRUTURA DO PROJETO ═══${NC}"
echo ""
echo "═══ CATEGORIA 1: ESTRUTURA DO PROJETO ═══" >> "$REPORT_FILE"

((TOTAL_CHECKS++))
log "Verificando arquivos essenciais..."
missing_files=()
for file in package.json src/server-enhanced.js index.js .env.example; do
  if [ ! -f "$file" ]; then
    missing_files+=("$file")
  fi
done

if [ ${#missing_files[@]} -eq 0 ]; then
  success "Todos os arquivos essenciais presentes"
else
  error "Arquivos ausentes: ${missing_files[*]}"
fi

((TOTAL_CHECKS++))
log "Verificando diretórios necessários..."
missing_dirs=()
for dir in src lib scripts config; do
  if [ ! -d "$dir" ]; then
    missing_dirs+=("$dir")
  fi
done

if [ ${#missing_dirs[@]} -eq 0 ]; then
  success "Todos os diretórios necessários presentes"
else
  error "Diretórios ausentes: ${missing_dirs[*]}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 2: SEGURANÇA
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 2: SEGURANÇA ═══${NC}"
echo ""
echo "═══ CATEGORIA 2: SEGURANÇA ═══" >> "$REPORT_FILE"

((TOTAL_CHECKS++))
log "Verificando middleware de autenticação..."
if [ -f "src/middlewares/auth.js" ]; then
  if grep -q "requireAuth" "src/middlewares/auth.js" && \
     grep -q "requireAdmin" "src/middlewares/auth.js"; then
    success "Middleware de autenticação implementado"
  else
    error "Middleware de autenticação incompleto"
  fi
else
  error "Middleware de autenticação não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando rate limiting..."
if [ -f "src/middlewares/rate-limiter.js" ]; then
  if grep -q "loginLimiter" "src/middlewares/rate-limiter.js" && \
     grep -q "apiLimiter" "src/middlewares/rate-limiter.js"; then
    success "Rate limiting implementado"
  else
    error "Rate limiting incompleto"
  fi
else
  error "Rate limiting não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando variáveis de ambiente sensíveis..."
if [ -f ".env" ]; then
  missing_vars=()
  for var in SESSION_SECRET ADMIN_TOKEN ANTHROPIC_API_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
    if ! grep -q "^${var}=" .env; then
      missing_vars+=("$var")
    fi
  done

  if [ ${#missing_vars[@]} -eq 0 ]; then
    success "Todas as variáveis de ambiente críticas configuradas"
  else
    warn "Variáveis faltando: ${missing_vars[*]}"
  fi
else
  warn "Arquivo .env não encontrado (pode estar no Render)"
fi

((TOTAL_CHECKS++))
log "Verificando se secrets não estão hardcoded..."
if grep -r "AIzaSy" src/ lib/ --include="*.js" 2>/dev/null | grep -v "process.env" > /dev/null; then
  error "Possíveis API keys hardcoded encontradas"
else
  success "Nenhum secret hardcoded detectado"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 3: DEPENDÊNCIAS
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 3: DEPENDÊNCIAS ═══${NC}"
echo ""
echo "═══ CATEGORIA 3: DEPENDÊNCIAS ═══" >> "$REPORT_FILE"

((TOTAL_CHECKS++))
log "Verificando node_modules..."
if [ -d "node_modules" ]; then
  success "node_modules presente"
else
  warn "node_modules não encontrado - execute 'npm install'"
fi

((TOTAL_CHECKS++))
log "Verificando package-lock.json..."
if [ -f "package-lock.json" ]; then
  success "package-lock.json presente"
else
  warn "package-lock.json não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando vulnerabilidades conhecidas..."
if command -v npm &> /dev/null; then
  vuln_output=$(npm audit --json 2>/dev/null || echo '{}')
  critical=$(echo "$vuln_output" | grep -o '"critical":[0-9]*' | cut -d':' -f2 || echo "0")
  high=$(echo "$vuln_output" | grep -o '"high":[0-9]*' | cut -d':' -f2 || echo "0")

  if [ "$critical" -gt 0 ] || [ "$high" -gt 0 ]; then
    error "Vulnerabilidades encontradas: $critical críticas, $high altas"
  else
    success "Nenhuma vulnerabilidade crítica ou alta"
  fi
else
  warn "npm não disponível - não foi possível verificar vulnerabilidades"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 4: CÓDIGO E SINTAXE
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 4: CÓDIGO E SINTAXE ═══${NC}"
echo ""
echo "═══ CATEGORIA 4: CÓDIGO E SINTAXE ═══" >> "$REPORT_FILE"

((TOTAL_CHECKS++))
log "Verificando sintaxe JavaScript..."
syntax_errors=0
for file in $(find src lib -name "*.js" 2>/dev/null | head -20); do
  if ! node -c "$file" 2>/dev/null; then
    ((syntax_errors++))
  fi
done

if [ $syntax_errors -eq 0 ]; then
  success "Sintaxe JavaScript válida"
else
  error "Erros de sintaxe em $syntax_errors arquivos"
fi

((TOTAL_CHECKS++))
log "Verificando imports de segurança em server-enhanced.js..."
if [ -f "src/server-enhanced.js" ]; then
  if grep -q "require.*middlewares/auth" "src/server-enhanced.js" && \
     grep -q "require.*middlewares/rate-limiter" "src/server-enhanced.js"; then
    success "Imports de segurança presentes"
  else
    warn "Imports de segurança não encontrados - podem precisar ser adicionados"
  fi
else
  error "server-enhanced.js não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando código duplicado crítico..."
duplicate_count=$(find src lib -name "*.js" -exec basename {} \; 2>/dev/null | sort | uniq -d | wc -l)
if [ "$duplicate_count" -gt 5 ]; then
  warn "$duplicate_count arquivos com nomes duplicados encontrados"
else
  success "Sem duplicação crítica de arquivos"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 5: SCRAPERS E INTEGRAÇÕES
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 5: SCRAPERS E INTEGRAÇÕES ═══${NC}"
echo ""
echo "═══ CATEGORIA 5: SCRAPERS E INTEGRAÇÕES ═══" >> "$REPORT_FILE"

((TOTAL_CHECKS++))
log "Verificando scrapers Python..."
if [ -d "python-scrapers" ]; then
  scraper_count=$(ls python-scrapers/*.py 2>/dev/null | wc -l)
  if [ "$scraper_count" -gt 0 ]; then
    success "$scraper_count scrapers Python encontrados"
  else
    warn "Diretório python-scrapers existe mas está vazio"
  fi
else
  warn "Diretório python-scrapers não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando Python bridge..."
if [ -f "src/services/python-bridge.js" ]; then
  if grep -q "executeScraper" "src/services/python-bridge.js"; then
    success "Python bridge implementado"
  else
    error "Python bridge incompleto"
  fi
else
  warn "Python bridge não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando Python3..."
if command -v python3 &> /dev/null; then
  python_version=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
  success "Python3 disponível (versão $python_version)"
else
  warn "Python3 não encontrado - scrapers Python não funcionarão"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 6: TESTES
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 6: TESTES ═══${NC}"
echo ""
echo "═══ CATEGORIA 6: TESTES ═══" >> "$REPORT_FILE"

((TOTAL_CHECKS++))
log "Executando testes automatizados..."
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  if npm test >> "$REPORT_FILE" 2>&1; then
    success "Todos os testes passaram"
  else
    error "Alguns testes falharam"
  fi
else
  warn "Nenhum teste configurado em package.json"
fi

((TOTAL_CHECKS++))
log "Verificando linter..."
if [ -f "package.json" ] && grep -q '"lint"' package.json; then
  if npm run lint >> "$REPORT_FILE" 2>&1; then
    success "Linter passou sem erros"
  else
    warn "Linter encontrou problemas"
  fi
else
  info "Linter não configurado"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 7: BUILD E FRONTEND
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 7: BUILD E FRONTEND ═══${NC}"
echo ""
echo "═══ CATEGORIA 7: BUILD E FRONTEND ═══" >> "$REPORT_FILE"

if [ -d "frontend" ]; then
  ((TOTAL_CHECKS++))
  log "Verificando build do frontend..."

  if [ -d "frontend/node_modules" ]; then
    cd frontend
    if npm run build >> "$REPORT_FILE" 2>&1; then
      success "Frontend buildou com sucesso"
    else
      error "Build do frontend falhou"
    fi
    cd ..
  else
    warn "Dependências do frontend não instaladas"
  fi
else
  info "Diretório frontend não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando arquivos estáticos públicos..."
if [ -d "public" ]; then
  static_count=$(find public -type f | wc -l)
  success "$static_count arquivos estáticos encontrados"
else
  warn "Diretório public não encontrado"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 8: GIT E VERSIONAMENTO
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 8: GIT E VERSIONAMENTO ═══${NC}"
echo ""
echo "═══ CATEGORIA 8: GIT E VERSIONAMENTO ═══" >> "$REPORT_FILE"

((TOTAL_CHECKS++))
log "Verificando repositório Git..."
if [ -d ".git" ]; then
  success "Repositório Git inicializado"
else
  error "Não é um repositório Git"
fi

((TOTAL_CHECKS++))
log "Verificando branch atual..."
if git rev-parse --abbrev-ref HEAD > /dev/null 2>&1; then
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  success "Branch atual: $current_branch"
else
  error "Erro ao obter branch atual"
fi

((TOTAL_CHECKS++))
log "Verificando arquivos não comitados..."
untracked=$(git ls-files --others --exclude-standard | wc -l)
if [ "$untracked" -gt 0 ]; then
  info "$untracked arquivos não rastreados"
else
  success "Nenhum arquivo não rastreado"
fi

((TOTAL_CHECKS++))
log "Verificando remote..."
if git remote get-url origin > /dev/null 2>&1; then
  remote_url=$(git remote get-url origin)
  success "Remote configurado: $remote_url"
else
  warn "Remote origin não configurado"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 9: DOCUMENTAÇÃO
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 9: DOCUMENTAÇÃO ═══${NC}"
echo ""
echo "═══ CATEGORIA 9: DOCUMENTAÇÃO ═══" >> "$REPORT_FILE"

((TOTAL_CHECKS++))
log "Verificando documentação de auditoria..."
if [ -f "AUDITORIA_FORENSE_COMPLETA_2026-01-08.md" ]; then
  success "Auditoria forense documentada"
else
  warn "Documentação de auditoria não encontrada"
fi

((TOTAL_CHECKS++))
log "Verificando plano de correção..."
if [ -f "PLANO_GLOBAL_CORRECAO_2026-01-08.md" ]; then
  success "Plano de correção documentado"
else
  warn "Plano de correção não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando README..."
if [ -f "README.md" ]; then
  readme_size=$(wc -c < "README.md")
  if [ "$readme_size" -gt 1000 ]; then
    success "README presente e completo"
  else
    warn "README muito curto"
  fi
else
  warn "README.md não encontrado"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# CATEGORIA 10: CONFIGURAÇÃO DE PRODUÇÃO
# ════════════════════════════════════════════════════════════════════

echo -e "${WHITE}═══ CATEGORIA 10: CONFIGURAÇÃO DE PRODUÇÃO ═══${NC}"
echo ""
echo "═══ CATEGORIA 10: CONFIGURAÇÃO DE PRODUÇÃO ═══" >> "$REPORT_FILE"

((TOTAL_CHECKS++))
log "Verificando .env.example..."
if [ -f ".env.example" ]; then
  success ".env.example presente"
else
  warn ".env.example não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando .gitignore..."
if [ -f ".gitignore" ]; then
  if grep -q "node_modules" ".gitignore" && \
     grep -q ".env" ".gitignore"; then
    success ".gitignore configurado corretamente"
  else
    warn ".gitignore incompleto"
  fi
else
  error ".gitignore não encontrado"
fi

((TOTAL_CHECKS++))
log "Verificando scripts de deploy..."
if [ -f "scripts/commit-and-deploy.sh" ]; then
  success "Scripts de deploy presentes"
else
  warn "Scripts de deploy não encontrados"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
# RESUMO FINAL
# ════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo -e "${WHITE}RESUMO DA VERIFICAÇÃO${NC}"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

percentage=$((CHECKS_PASSED * 100 / TOTAL_CHECKS))

echo "Total de verificações: $TOTAL_CHECKS"
echo -e "${GREEN}Passou: $CHECKS_PASSED${NC}"
echo -e "${RED}Erros: $ERRORS${NC}"
echo -e "${YELLOW}Avisos: $WARNINGS${NC}"
echo ""
echo -n "Taxa de sucesso: "

if [ $percentage -ge 90 ]; then
  echo -e "${GREEN}${percentage}%${NC} ✓"
elif [ $percentage -ge 70 ]; then
  echo -e "${YELLOW}${percentage}%${NC} ⚠"
else
  echo -e "${RED}${percentage}%${NC} ✗"
fi

echo ""

# Salvar resumo no relatório
echo "═══════════════════════════════════════════════════════════════════════" >> "$REPORT_FILE"
echo "RESUMO DA VERIFICAÇÃO" >> "$REPORT_FILE"
echo "═══════════════════════════════════════════════════════════════════════" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Total de verificações: $TOTAL_CHECKS" >> "$REPORT_FILE"
echo "Passou: $CHECKS_PASSED" >> "$REPORT_FILE"
echo "Erros: $ERRORS" >> "$REPORT_FILE"
echo "Avisos: $WARNINGS" >> "$REPORT_FILE"
echo "Taxa de sucesso: ${percentage}%" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Recomendações
echo "─────────────────────────────────────────────────────────────────────"
echo -e "${WHITE}RECOMENDAÇÕES${NC}"
echo "─────────────────────────────────────────────────────────────────────"
echo ""
echo "RECOMENDAÇÕES" >> "$REPORT_FILE"
echo "─────────────────────────────────────────────────────────────────────" >> "$REPORT_FILE"

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ Sistema pronto para commit e deploy!${NC}"
  echo "✓ Sistema pronto para commit e deploy!" >> "$REPORT_FILE"
elif [ $ERRORS -le 3 ]; then
  echo -e "${YELLOW}⚠ Corrija os $ERRORS erros antes de fazer deploy${NC}"
  echo "⚠ Corrija os $ERRORS erros antes de fazer deploy" >> "$REPORT_FILE"
else
  echo -e "${RED}✗ Sistema tem problemas críticos - NÃO fazer deploy${NC}"
  echo "✗ Sistema tem problemas críticos - NÃO fazer deploy" >> "$REPORT_FILE"
fi

if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠ Revise os $WARNINGS avisos (não bloqueiam deploy)${NC}"
  echo "⚠ Revise os $WARNINGS avisos (não bloqueiam deploy)" >> "$REPORT_FILE"
fi

echo ""
echo "Relatório completo salvo em: $REPORT_FILE"
echo ""

# Retornar código apropriado
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}               ✅ VERIFICAÇÃO PASSOU - OK PARA DEPLOY                    ${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════${NC}"
  exit 0
else
  echo -e "${RED}═══════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}          ❌ VERIFICAÇÃO FALHOU - CORRIJA OS ERROS PRIMEIRO              ${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════════════════════════${NC}"
  exit 1
fi
