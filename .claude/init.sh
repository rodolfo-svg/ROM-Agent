#!/bin/bash
# ROM-Agent - Script de Inicialização Rápida
# Uso: source .claude/init.sh

echo "🚀 Inicializando ambiente ROM-Agent..."
echo ""

# 1. Verificar diretório
if [[ ! -f "package.json" ]]; then
    echo "❌ ERRO: Execute este script na raiz do projeto ROM-Agent"
    return 1
fi

echo "📁 Diretório: $(pwd)"
echo ""

# 2. Verificar GitHub
echo "🔍 Verificando GitHub..."
if gh auth status &>/dev/null; then
    GITHUB_USER=$(gh api user --jq '.login')
    echo "✅ GitHub: autenticado como $GITHUB_USER"
else
    echo "❌ GitHub: não autenticado (execute: gh auth login)"
fi
echo ""

# 3. Verificar Git
echo "🔍 Verificando Git..."
BRANCH=$(git branch --show-current 2>/dev/null)
if [[ -n "$BRANCH" ]]; then
    echo "✅ Branch atual: $BRANCH"
    LAST_COMMIT=$(git log -1 --oneline 2>/dev/null)
    echo "   Último commit: $LAST_COMMIT"

    # Status
    if git diff-index --quiet HEAD -- 2>/dev/null; then
        echo "   Status: limpo (sem alterações)"
    else
        echo "   Status: alterações não commitadas"
        git status -s
    fi
else
    echo "❌ Git: repositório não inicializado"
fi
echo ""

# 4. Verificar Render CLI
echo "🔍 Verificando Render..."
if command -v render &>/dev/null; then
    if render whoami &>/dev/null; then
        RENDER_USER=$(render whoami 2>/dev/null | grep "Email" | awk '{print $2}')
        echo "✅ Render: autenticado como $RENDER_USER"

        # Listar serviços
        echo "   Serviços:"
        render services list 2>/dev/null | grep -E "(Name|Status)" | head -4
    else
        echo "⚠️  Render: CLI instalado mas não autenticado (execute: render login)"
    fi
else
    echo "⚠️  Render: CLI não instalado (instale: npm install -g render-cli)"
fi
echo ""

# 5. Verificar site
echo "🔍 Verificando site iarom.com.br..."
if curl -s -I https://iarom.com.br | grep -q "HTTP.*200"; then
    echo "✅ Site: online (200 OK)"
else
    echo "❌ Site: offline ou inacessível"
fi
echo ""

# 6. Verificar ambiente Node
echo "🔍 Verificando ambiente Node..."
if [[ -d "node_modules" ]]; then
    MODULE_COUNT=$(ls node_modules/ | wc -l)
    echo "✅ node_modules: instalado ($MODULE_COUNT pacotes)"
else
    echo "❌ node_modules: não instalado (execute: npm install)"
fi

if [[ -f ".env" ]]; then
    echo "✅ .env: configurado"
    # Verificar variáveis críticas
    if grep -q "ANTHROPIC_API_KEY" .env; then
        echo "   ✓ ANTHROPIC_API_KEY configurado"
    else
        echo "   ✗ ANTHROPIC_API_KEY ausente"
    fi
    if grep -q "DATABASE_URL" .env; then
        echo "   ✓ DATABASE_URL configurado"
    else
        echo "   ✗ DATABASE_URL ausente"
    fi
else
    echo "❌ .env: não encontrado (copie de .env.example)"
fi
echo ""

# 7. Verificar versões
echo "🔍 Versões instaladas..."
echo "   Node: $(node --version 2>/dev/null || echo 'não instalado')"
echo "   npm: $(npm --version 2>/dev/null || echo 'não instalado')"
echo "   git: $(git --version 2>/dev/null | awk '{print $3}' || echo 'não instalado')"
echo "   gh: $(gh --version 2>/dev/null | head -1 | awk '{print $3}' || echo 'não instalado')"
echo "   claude: $(claude --version 2>/dev/null || echo 'não instalado')"
echo ""

# 8. Resumo final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMO DO STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

READY=true

if ! gh auth status &>/dev/null; then
    echo "⚠️  GitHub: configurar autenticação"
    READY=false
fi

if [[ ! -d "node_modules" ]]; then
    echo "⚠️  Node: executar npm install"
    READY=false
fi

if [[ ! -f ".env" ]]; then
    echo "⚠️  Ambiente: configurar .env"
    READY=false
fi

if $READY; then
    echo "✅ AMBIENTE PRONTO PARA TRABALHO!"
    echo ""
    echo "💡 Comandos úteis:"
    echo "   npm run dev      - Iniciar servidor de desenvolvimento"
    echo "   npm start        - Iniciar servidor de produção"
    echo "   npm test         - Executar testes"
    echo "   render logs -f   - Ver logs do Render em tempo real"
    echo "   gh pr create     - Criar Pull Request"
else
    echo "⚠️  Configure os itens acima antes de continuar"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
