#!/bin/bash
# ==============================================================================
# PRE-COMMIT VALIDATION
# Valida código contra erros conhecidos antes de commit
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🔍 VALIDAÇÃO PRÉ-COMMIT"
echo "================================"
echo ""

ERRORS=0
WARNINGS=0

# ==============================================================================
# VALIDAÇÃO 1: Secrets não devem ser gerados dinamicamente
# ==============================================================================
echo "📋 [1/8] Validando secrets..."

# Procurar por padrões perigosos
DYNAMIC_SECRETS=$(grep -r "randomBytes.*toString" src lib --include="*.js" | grep -v "node_modules" | grep -i "secret" || true)

if [ -n "$DYNAMIC_SECRETS" ]; then
    echo "❌ ERRO: Secrets sendo gerados dinamicamente!"
    echo ""
    echo "Arquivos com problema:"
    echo "$DYNAMIC_SECRETS" | sed 's/^/  /'
    echo ""
    echo "SOLUÇÃO: Use process.env.SECRET_NAME ou variável de ambiente"
    echo "Ver: LESSONS-LEARNED.md #1"
    ((ERRORS++))
else
    echo "✅ OK - Nenhum secret dinâmico detectado"
fi

echo ""

# ==============================================================================
# VALIDAÇÃO 2: JSON.parse deve ter tratamento de erro
# ==============================================================================
echo "📋 [2/8] Validando JSON parsing..."

# Procurar por JSON.parse sem try-catch ou validação
UNSAFE_JSON=$(grep -rn "JSON\.parse" src lib --include="*.js" | grep -v "try\|catch\|Array\.isArray" | head -5 || true)

if [ -n "$UNSAFE_JSON" ]; then
    echo "⚠️  WARNING: JSON.parse sem validação detectado"
    echo ""
    echo "Arquivos com possível problema:"
    echo "$UNSAFE_JSON" | sed 's/^/  /'
    echo ""
    echo "RECOMENDAÇÃO: Validar formato após parse"
    echo "Ver: LESSONS-LEARNED.md #2"
    ((WARNINGS++))
else
    echo "✅ OK - JSON parsing parece seguro"
fi

echo ""

# ==============================================================================
# VALIDAÇÃO 3: Rotas /api/* devem retornar JSON
# ==============================================================================
echo "📋 [3/8] Validando API routes..."

# Procurar por res.redirect em auth.js
REDIRECT_IN_API=$(grep -n "res\.redirect" src/middleware/auth.js | grep -v "req\.path\.startsWith('/api/')" | head -3 || true)

# Verificar se há proteção para /api/*
API_PROTECTION=$(grep -A 5 "req\.path\.startsWith('/api/')" src/middleware/auth.js || true)

if [ -z "$API_PROTECTION" ]; then
    echo "⚠️  WARNING: Proteção de API routes pode estar ausente"
    echo ""
    echo "RECOMENDAÇÃO: Garantir que /api/* retorna JSON 401, não redirect"
    echo "Ver: LESSONS-LEARNED.md #3"
    ((WARNINGS++))
else
    echo "✅ OK - Proteção de API routes detectada"
fi

echo ""

# ==============================================================================
# VALIDAÇÃO 4: CSP deve incluir backend URL
# ==============================================================================
echo "📋 [4/8] Validando CSP headers..."

if [ -f "src/middleware/security-headers.js" ]; then
    BACKEND_IN_CSP=$(grep -i "rom-agent-ia.onrender.com" src/middleware/security-headers.js || true)

    if [ -z "$BACKEND_IN_CSP" ]; then
        echo "❌ ERRO: Backend URL não encontrado no CSP!"
        echo ""
        echo "Arquivo: src/middleware/security-headers.js"
        echo "SOLUÇÃO: Adicionar 'https://rom-agent-ia.onrender.com' ao connectSrc"
        echo "Ver: LESSONS-LEARNED.md #4"
        ((ERRORS++))
    else
        echo "✅ OK - Backend URL incluído no CSP"
    fi
else
    echo "⚠️  WARNING: security-headers.js não encontrado"
    ((WARNINGS++))
fi

echo ""

# ==============================================================================
# VALIDAÇÃO 5: Frontend dist/ deve ser limpo antes de build
# ==============================================================================
echo "📋 [5/8] Validando build scripts..."

if [ -f "package.json" ]; then
    PREBUILD_CLEAN=$(grep -A 2 '"prebuild"' package.json | grep "rm -rf.*dist" || true)

    if [ -z "$PREBUILD_CLEAN" ]; then
        echo "⚠️  WARNING: package.json não limpa dist/ automaticamente"
        echo ""
        echo "RECOMENDAÇÃO: Adicionar 'prebuild' script:"
        echo '  "prebuild": "rm -rf frontend/dist"'
        echo "Ver: LESSONS-LEARNED.md - Armadilha #1"
        ((WARNINGS++))
    else
        echo "✅ OK - dist/ é limpo antes de build"
    fi
else
    echo "⚠️  WARNING: package.json não encontrado"
fi

echo ""

# ==============================================================================
# VALIDAÇÃO 6: Commit message deve ter Co-Authored-By
# ==============================================================================
echo "📋 [6/8] Validando commit message..."

# Se estiver rodando como git hook, validar commit message
if [ -f ".git/COMMIT_EDITMSG" ]; then
    CO_AUTHOR=$(grep "Co-Authored-By: Claude Sonnet 4.5" .git/COMMIT_EDITMSG || true)

    if [ -z "$CO_AUTHOR" ]; then
        echo "⚠️  WARNING: Commit message não tem Co-Authored-By"
        echo ""
        echo "RECOMENDAÇÃO: Adicionar ao final do commit message:"
        echo "  Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
        ((WARNINGS++))
    else
        echo "✅ OK - Co-Authored-By presente"
    fi
else
    echo "ℹ️  INFO - Não rodando como git hook, pulando validação de commit message"
fi

echo ""

# ==============================================================================
# VALIDAÇÃO 7: Arquivos críticos não foram deletados
# ==============================================================================
echo "📋 [7/8] Validando integridade de arquivos críticos..."

CRITICAL_FILES=(
    "lib/kb-cache.js"
    "src/middleware/auth.js"
    "src/middleware/security-headers.js"
    "frontend/src/components/extraction/ExtractionProgressBar.tsx"
)

MISSING_FILES=()
for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "❌ ERRO: Arquivos críticos faltando!"
    echo ""
    for file in "${MISSING_FILES[@]}"; do
        echo "  - $file"
    done
    ((ERRORS++))
else
    echo "✅ OK - Todos arquivos críticos presentes"
fi

echo ""

# ==============================================================================
# VALIDAÇÃO 8: Verificar se consultou LESSONS-LEARNED.md
# ==============================================================================
echo "📋 [8/8] Verificando consulta à documentação..."

if [ -f "LESSONS-LEARNED.md" ]; then
    LAST_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" LESSONS-LEARNED.md 2>/dev/null || stat -c "%y" LESSONS-LEARNED.md 2>/dev/null || echo "desconhecido")
    echo "ℹ️  INFO - LESSONS-LEARNED.md última modificação: $LAST_MODIFIED"
    echo ""
    echo "⚠️  ATENÇÃO: Você consultou LESSONS-LEARNED.md antes deste commit?"
    echo ""
    echo "Se NÃO consultou, PARE AGORA e leia:"
    echo "  cat LESSONS-LEARNED.md"
    echo ""
    ((WARNINGS++))
else
    echo "❌ ERRO: LESSONS-LEARNED.md não encontrado!"
    echo ""
    echo "Este arquivo é CRÍTICO para evitar regressões!"
    ((ERRORS++))
fi

echo ""

# ==============================================================================
# RESUMO
# ==============================================================================
echo "================================"
echo "📊 RESUMO DA VALIDAÇÃO"
echo "================================"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo "❌ FALHOU - $ERRORS erro(s) crítico(s) detectado(s)"
    echo "⚠️  $WARNINGS warning(s)"
    echo ""
    echo "CORRIJA OS ERROS ANTES DE FAZER COMMIT!"
    echo ""
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo "⚠️  PASSOU COM WARNINGS - $WARNINGS aviso(s)"
    echo ""
    echo "Revise os warnings antes de prosseguir."
    echo "Deseja continuar mesmo assim? (recomendado: corrigir warnings)"
    echo ""

    # Se rodando como git hook interativo
    if [ -t 0 ]; then
        read -p "Continuar? [s/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Ss]$ ]]; then
            echo "❌ Commit cancelado pelo usuário"
            exit 1
        fi
    fi

    echo "✅ Prosseguindo com warnings..."
    exit 0
else
    echo "✅ SUCESSO - Nenhum problema detectado!"
    echo ""
    echo "Código passou em todas as validações."
    echo ""
    exit 0
fi
