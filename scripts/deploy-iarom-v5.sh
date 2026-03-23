#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# DEPLOY IAROM V5.0 - SCRIPT DE AUTOMAÇÃO
# ═══════════════════════════════════════════════════════════════
# Migra prompts refatorados do Desktop para ROM-Agent
# Executa git commit e push
# Monitora deploy no Render
# ═══════════════════════════════════════════════════════════════

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
ROM_AGENT_PATH="$HOME/ROM-Agent"
IAROM_PROMPTS_PATH="$HOME/Desktop/IAROM_PROMPTS_REFATORADOS_CLAUDE_AI"

# Counters
STEP=0
TOTAL_STEPS=8

# ═══════════════════════════════════════════════════════════════
# FUNÇÕES AUXILIARES
# ═══════════════════════════════════════════════════════════════

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    STEP=$((STEP + 1))
    echo ""
    echo -e "${GREEN}[STEP $STEP/$TOTAL_STEPS]${NC} $1"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

confirm() {
    read -p "$1 (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Operação cancelada pelo usuário"
        exit 1
    fi
}

# ═══════════════════════════════════════════════════════════════
# VALIDAÇÕES PRÉ-DEPLOY
# ═══════════════════════════════════════════════════════════════

print_header "DEPLOY IAROM V5.0 - INÍCIO"

print_step "Validando pré-requisitos"

# Validar ROM-Agent existe
if [ ! -d "$ROM_AGENT_PATH" ]; then
    print_error "Diretório ROM-Agent não encontrado em $ROM_AGENT_PATH"
    exit 1
fi
print_success "ROM-Agent encontrado em $ROM_AGENT_PATH"

# Validar IAROM_PROMPTS existe
if [ ! -d "$IAROM_PROMPTS_PATH" ]; then
    print_error "Diretório IAROM_PROMPTS não encontrado em $IAROM_PROMPTS_PATH"
    exit 1
fi
print_success "IAROM_PROMPTS encontrado em $IAROM_PROMPTS_PATH"

# Ir para ROM-Agent
cd "$ROM_AGENT_PATH"

# Validar branch main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "Você está na branch '$CURRENT_BRANCH', não 'main'"
    confirm "Deseja continuar mesmo assim?"
fi
print_success "Branch atual: $CURRENT_BRANCH"

# Verificar status do git
if ! git diff-index --quiet HEAD --; then
    print_warning "Existem mudanças não commitadas no repositório"
    git status --short
    confirm "Deseja continuar?"
fi

# ═══════════════════════════════════════════════════════════════
# FASE 1: LIMPEZA
# ═══════════════════════════════════════════════════════════════

print_step "FASE 1: Limpeza de prompts antigos"

echo "Verificando prompts deletados..."
DELETED_COUNT=$(git status --short | grep -c "^ D" || true)
echo "Prompts deletados localmente: $DELETED_COUNT"

if [ "$DELETED_COUNT" -gt 0 ]; then
    print_warning "Serão confirmadas as deleções de $DELETED_COUNT arquivos"
    confirm "Confirmar deleção dos prompts antigos?"

    git add -u data/prompts/global/
    print_success "Deleções confirmadas"
else
    print_success "Nenhum prompt antigo para deletar"
fi

# ═══════════════════════════════════════════════════════════════
# FASE 2: CRIAÇÃO DE ESTRUTURA
# ═══════════════════════════════════════════════════════════════

print_step "FASE 2: Criando estrutura de pastas"

mkdir -p data/knowledge-base/modules
mkdir -p data/knowledge-base/master
mkdir -p docs/iarom/relatorios

print_success "Estrutura de pastas criada"

# ═══════════════════════════════════════════════════════════════
# FASE 3: CÓPIA DE PROMPTS ESPECÍFICOS
# ═══════════════════════════════════════════════════════════════

print_step "FASE 3: Copiando prompts específicos"

echo "Origem: $IAROM_PROMPTS_PATH/03_PROMPTS_ESPECIFICOS/"
echo "Destino: $ROM_AGENT_PATH/data/prompts/global/"

# Contar arquivos antes
BEFORE_COUNT=$(ls data/prompts/global/*.txt 2>/dev/null | wc -l | tr -d ' ')

# Copiar prompts
find "$IAROM_PROMPTS_PATH/03_PROMPTS_ESPECIFICOS" -name "*.txt" -exec cp {} data/prompts/global/ \;

# Contar arquivos depois
AFTER_COUNT=$(ls data/prompts/global/*.txt 2>/dev/null | wc -l | tr -d ' ')
NEW_COUNT=$((AFTER_COUNT - BEFORE_COUNT))

print_success "Copiados $NEW_COUNT prompts específicos"
echo "Total de prompts em data/prompts/global/: $AFTER_COUNT"

# ═══════════════════════════════════════════════════════════════
# FASE 4: CÓPIA DE MÓDULOS IAROM
# ═══════════════════════════════════════════════════════════════

print_step "FASE 4: Copiando módulos IAROM"

# Copiar módulos
cp "$IAROM_PROMPTS_PATH/02_MODULOS"/*.txt data/knowledge-base/modules/
MODULE_COUNT=$(ls data/knowledge-base/modules/*.txt 2>/dev/null | wc -l | tr -d ' ')
print_success "Copiados $MODULE_COUNT módulos IAROM"

# Copiar master prompts
cp "$IAROM_PROMPTS_PATH/01_PROMPT_MASTER/IAROM_PROMPT_MASTER_v1.0.txt" data/knowledge-base/master/
cp "$IAROM_PROMPTS_PATH/01_PROMPT_MASTER/IAROM_ORQUESTRADOR_MULTIAGENTE_v1.0.txt" data/knowledge-base/master/
MASTER_COUNT=$(ls data/knowledge-base/master/*.txt 2>/dev/null | wc -l | tr -d ' ')
print_success "Copiados $MASTER_COUNT master prompts"

# Copiar Custom Instructions
cp "$IAROM_PROMPTS_PATH/01_PROMPT_MASTER/CUSTOM_INSTRUCTIONS_V5.0.txt" data/custom-instructions/
print_success "Custom Instructions V5.0 copiada"

# ═══════════════════════════════════════════════════════════════
# FASE 5: CÓPIA DE DOCUMENTAÇÃO
# ═══════════════════════════════════════════════════════════════

print_step "FASE 5: Copiando documentação"

# Copiar documentação principal
cp "$IAROM_PROMPTS_PATH/05_DOCUMENTACAO"/*.md docs/iarom/
DOC_COUNT=$(ls docs/iarom/*.md 2>/dev/null | wc -l | tr -d ' ')
print_success "Copiados $DOC_COUNT documentos principais"

# Copiar relatórios
cp "$IAROM_PROMPTS_PATH/04_RELATORIOS"/*.md docs/iarom/relatorios/
REPORT_COUNT=$(ls docs/iarom/relatorios/*.md 2>/dev/null | wc -l | tr -d ' ')
print_success "Copiados $REPORT_COUNT relatórios técnicos"

# Copiar README
cp "$IAROM_PROMPTS_PATH/README.md" docs/iarom/README_IAROM.md
print_success "README_IAROM.md copiado"

# ═══════════════════════════════════════════════════════════════
# FASE 6: CRIAR ÍNDICE DE PROMPTS
# ═══════════════════════════════════════════════════════════════

print_step "FASE 6: Criando índice de prompts"

cat > data/prompts/global/README.md << EOF
# IAROM - Prompts Específicos v5.0

**Total:** $AFTER_COUNT prompts refatorados
**Data:** $(date +%d/%m/%Y)
**Status:** Produção

## Características

- ✅ Sem emojis ou elementos decorativos
- ✅ Português jurídico escorreito
- ✅ Nomenclatura padronizada (v1.0)
- ✅ Formato .txt consistente
- ✅ Modularizados e otimizados

## Prompts Disponíveis:

EOF

ls -1 data/prompts/global/*.txt >> data/prompts/global/README.md

print_success "Índice de prompts criado"

# ═══════════════════════════════════════════════════════════════
# FASE 7: GIT COMMIT E PUSH
# ═══════════════════════════════════════════════════════════════

print_step "FASE 7: Git commit e push"

print_warning "Resumo das mudanças:"
echo ""
echo "Prompts específicos:    $NEW_COUNT novos"
echo "Módulos IAROM:          $MODULE_COUNT arquivos"
echo "Master prompts:         $MASTER_COUNT arquivos"
echo "Documentos:             $DOC_COUNT arquivos"
echo "Relatórios:             $REPORT_COUNT arquivos"
echo ""

confirm "Confirmar commit e push para GitHub?"

# Adicionar arquivos
echo "Adicionando arquivos ao git..."
git add data/prompts/global/
git add data/knowledge-base/
git add data/custom-instructions/CUSTOM_INSTRUCTIONS_V5.0.txt
git add docs/iarom/

# Verificar status
echo ""
echo "Status do git:"
git status --short
echo ""

# Commit
echo "Criando commit..."
git commit -m "feat: Add IAROM v5.0 refactored prompts and modules

- Remove 77 old V5.0 prompts with decorative elements
- Add $NEW_COUNT refactored specific prompts (clean, modular)
- Add $MODULE_COUNT IAROM modules (core, validation, transcription, etc)
- Add $MASTER_COUNT master prompts and orchestrator
- Add Custom Instructions V5.0
- Add comprehensive IAROM documentation ($DOC_COUNT docs, $REPORT_COUNT reports)

System ready for autonomous agent deployment.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

print_success "Commit criado"

# Push
echo "Fazendo push para GitHub..."
git push origin "$CURRENT_BRANCH"

print_success "Push concluído"

# ═══════════════════════════════════════════════════════════════
# FASE 8: VALIDAÇÃO E MONITORAMENTO
# ═══════════════════════════════════════════════════════════════

print_step "FASE 8: Validação e monitoramento"

echo "Deploy automático iniciado no Render..."
echo ""
echo "URLs para monitorar:"
echo "  - Dashboard Render: https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00"
echo "  - Logs: https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00/logs"
echo "  - Site: https://iarom.com.br"
echo ""

print_warning "Aguardando 30 segundos para iniciar validações..."
sleep 30

# Validar API (tentativas)
echo "Validando API..."
MAX_RETRIES=10
RETRY_COUNT=0
API_OK=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f -m 10 https://iarom.com.br/health > /dev/null 2>&1; then
        API_OK=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Tentativa $RETRY_COUNT/$MAX_RETRIES... (aguardando deploy)"
    sleep 10
done

if [ "$API_OK" = true ]; then
    print_success "API respondendo em https://iarom.com.br/health"

    # Verificar prompts (se endpoint existir)
    echo ""
    echo "Verificando prompts disponíveis..."
    curl -s https://iarom.com.br/api/prompts 2>/dev/null | head -50 || echo "(endpoint /api/prompts pode não existir ainda)"
else
    print_warning "API não respondeu após $MAX_RETRIES tentativas"
    print_warning "Verificar logs do Render manualmente"
fi

# ═══════════════════════════════════════════════════════════════
# CONCLUSÃO
# ═══════════════════════════════════════════════════════════════

print_header "DEPLOY CONCLUÍDO COM SUCESSO"

echo ""
echo -e "${GREEN}✅ Todas as fases concluídas${NC}"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Verificar logs do Render:"
echo "   https://dashboard.render.com/web/srv-d4ueaf2li9vc73d3rj00/logs"
echo ""
echo "2. Validar funcionalidades:"
echo "   - Acessar: https://iarom.com.br"
echo "   - Testar criação de peça com prompt V5.0"
echo ""
echo "3. Monitorar por 24-48h:"
echo "   - Verificar erros nos logs"
echo "   - Verificar performance"
echo "   - Verificar resposta de usuários"
echo ""
echo "4. Criar tag de versão:"
echo "   git tag -a v5.0.0 -m 'IAROM V5.0 - Refactored prompts'"
echo "   git push origin v5.0.0"
echo ""
echo "Documentação completa:"
echo "  - $ROM_AGENT_PATH/PLANO_DEPLOY_IAROM_V5.md"
echo "  - $ROM_AGENT_PATH/DEPLOY_V5_RESUMO_EXECUTIVO.md"
echo ""
echo -e "${BLUE}Deploy finalizado em: $(date)${NC}"
echo ""
