#!/bin/bash

# ============================================================================
# Script: Deploy Automatizado no Render
# Uso: ./scripts/deploy/deploy-render.sh
# ============================================================================

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

echo ""
echo "============================================"
echo "  ROM Agent - Deploy para Render"
echo "============================================"
echo ""

# 1. Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    print_error "Execute este script na raiz do projeto ROM-Agent"
    exit 1
fi

print_success "Diretório correto detectado"

# 2. Verificar arquivos necessários
echo ""
print_info "Verificando arquivos necessários..."

required_files=("package.json" "render.yaml" "src/server-enhanced.js" ".gitignore")
all_files_ok=true

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file encontrado"
    else
        print_error "$file NÃO encontrado"
        all_files_ok=false
    fi
done

if [ "$all_files_ok" = false ]; then
    print_error "Alguns arquivos estão faltando!"
    exit 1
fi

# 3. Verificar .env
echo ""
print_info "Verificando variáveis de ambiente..."

if [ -f ".env" ]; then
    if grep -q "ANTHROPIC_API_KEY" .env; then
        print_success "ANTHROPIC_API_KEY encontrada no .env"
    else
        print_warning ".env existe mas ANTHROPIC_API_KEY não configurada"
    fi
else
    print_warning ".env não encontrado (normal, use variáveis do Render)"
fi

# 4. Verificar Git
echo ""
print_info "Verificando repositório Git..."

if [ -d ".git" ]; then
    print_success "Repositório Git inicializado"

    # Verificar se tem remote
    if git remote -v | grep -q "origin"; then
        REMOTE_URL=$(git remote get-url origin)
        print_success "Remote configurado: $REMOTE_URL"
    else
        print_error "Remote 'origin' não configurado"
        print_info "Configure com: git remote add origin https://github.com/seu-usuario/ROM-Agent.git"
        exit 1
    fi

    # Verificar status
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "Há mudanças não commitadas"
        echo ""
        git status --short
        echo ""
        read -p "Deseja commitar agora? (s/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            git add .
            read -p "Mensagem do commit: " commit_msg
            git commit -m "$commit_msg"
            print_success "Commit realizado"
        fi
    else
        print_success "Repositório limpo (tudo commitado)"
    fi
else
    print_error "Git não inicializado"
    print_info "Inicialize com: git init"
    exit 1
fi

# 5. Push para GitHub
echo ""
read -p "Fazer push para GitHub? (s/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_info "Fazendo push..."

    CURRENT_BRANCH=$(git branch --show-current)
    git push -u origin $CURRENT_BRANCH

    if [ $? -eq 0 ]; then
        print_success "Push realizado com sucesso!"
    else
        print_error "Erro no push"
        exit 1
    fi
fi

# 6. Informações para Render
echo ""
echo "============================================"
echo "  PRÓXIMOS PASSOS NO RENDER"
echo "============================================"
echo ""
print_info "1. Acesse: https://render.com"
print_info "2. Login e clique em '+ New' → 'Web Service'"
print_info "3. Conecte seu repositório GitHub"
print_info "4. Configure:"
echo ""
echo "   Name: rom-agent"
echo "   Build Command: npm install"
echo "   Start Command: npm run web:enhanced"
echo ""
print_info "5. Adicione variáveis de ambiente:"
echo ""
echo "   ANTHROPIC_API_KEY = sua_chave_aqui"
echo "   NODE_ENV = production"
echo "   SESSION_SECRET = [Generate]"
echo "   PORT = 10000"
echo ""
print_info "6. Escolha plano FREE e clique em 'Create Web Service'"
print_info "7. Aguarde deploy (~3-5 minutos)"
echo ""

# 7. Checklist final
echo "============================================"
echo "  CHECKLIST PRÉ-DEPLOY"
echo "============================================"
echo ""

checklist=(
    "Código commitado no Git"
    "Push para GitHub realizado"
    "Conta no Render criada"
    "ANTHROPIC_API_KEY em mãos"
)

for item in "${checklist[@]}"; do
    echo "  [ ] $item"
done

echo ""
print_success "Preparação concluída! Siga os próximos passos no Render."
echo ""
