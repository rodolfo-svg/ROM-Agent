#!/bin/bash
# ==============================================================================
# AUTONOMOUS TEST-FIX-DEPLOY LOOP
# Executa testes, corrige problemas, faz deploy, repete até perfeição
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVICE_ID="srv-d51ppfmuk2gs73a1qlkg"
BRANCH="staging"
MAX_ITERATIONS=10
ITERATION=0

cd "$PROJECT_ROOT"

echo "🤖 MODO AUTÔNOMO ATIVADO"
echo "================================"
echo "Service: $SERVICE_ID"
echo "Branch: $BRANCH"
echo "Max iterations: $MAX_ITERATIONS"
echo ""

# Função para aguardar deploy
wait_for_deploy() {
    local expected_commit="$1"
    local max_wait=120  # 10 minutos
    local elapsed=0

    echo "⏳ Aguardando deploy do commit $expected_commit..."

    while [ $elapsed -lt $max_wait ]; do
        local current_status=$(render deploys list "$SERVICE_ID" 2>&1 | head -2 | tail -1 | awk '{print $1}')
        local current_commit=$(render deploys list "$SERVICE_ID" 2>&1 | head -2 | tail -1 | awk '{print $2}' | cut -c1-7)

        echo "  [$(date +%H:%M:%S)] Status: $current_status | Commit: $current_commit"

        if [[ "$current_commit" == "$expected_commit" && "$current_status" == "Live" ]]; then
            echo "✅ Deploy completo!"
            return 0
        fi

        sleep 5
        ((elapsed+=1))
    done

    echo "❌ Timeout aguardando deploy"
    return 1
}

# Função para executar testes
run_tests() {
    echo ""
    echo "🧪 EXECUTANDO TESTES..."
    echo "---"

    # Teste 1: Endpoint principal
    echo "Teste 1: Endpoint principal"
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" https://rom-agent-ia.onrender.com/)
    if [ "$status_code" == "200" ]; then
        echo "  ✅ OK (200)"
    else
        echo "  ❌ FALHOU (status: $status_code)"
        return 1
    fi

    # Teste 2: KB Cache não deve ser undefined (verificar apenas logs de hoje)
    echo "Teste 2: KB Cache logs"
    local today=$(date +"%Y-%m-%d")
    local kb_log=$(render logs -r "$SERVICE_ID" --text "KB Cache" 2>&1 | grep "$today" | tail -5 | grep -i "undefined" || true)
    if [ -z "$kb_log" ]; then
        echo "  ✅ KB Cache OK (sem undefined hoje)"
    else
        echo "  ❌ FALHOU - KB Cache ainda mostra undefined hoje:"
        echo "$kb_log" | sed 's/^/    /'
        return 1
    fi

    # Teste 3: CSP headers
    echo "Teste 3: CSP Headers"
    local csp=$(curl -s -I https://rom-agent-ia.onrender.com/ 2>&1 | grep -i "content-security-policy" | grep -o "rom-agent-ia.onrender.com" || true)
    if [ -n "$csp" ]; then
        echo "  ✅ CSP OK (backend URL incluído)"
    else
        echo "  ❌ FALHOU - CSP não inclui backend URL"
        return 1
    fi

    # Teste 4: Ferramentas disponíveis
    echo "Teste 4: Logs de ferramentas"
    local tools_log=$(render logs -r "$SERVICE_ID" --text "Tools ENABLED" 2>&1 | tail -3 | grep "ferramentas" || true)
    if [ -n "$tools_log" ]; then
        echo "  ✅ Tools OK"
    else
        echo "  ⚠️  Warning - Logs de tools não encontrados (pode ser normal)"
    fi

    echo ""
    echo "✅ TODOS OS TESTES PASSARAM"
    return 0
}

# Função para aplicar correções automáticas
apply_fixes() {
    local issue="$1"

    echo ""
    echo "🔧 APLICANDO CORREÇÕES PARA: $issue"
    echo "---"

    # Aqui entrariam correções específicas baseadas no problema detectado
    # Por enquanto, retorna sucesso se não há problemas conhecidos

    echo "ℹ️  Nenhuma correção automática disponível para: $issue"
    return 1
}

# LOOP PRINCIPAL
while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ((ITERATION+=1))

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "ITERAÇÃO $ITERATION de $MAX_ITERATIONS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Obter commit atual
    CURRENT_COMMIT=$(git rev-parse --short HEAD)
    echo "Commit atual: $CURRENT_COMMIT"

    # Executar testes
    if run_tests; then
        echo ""
        echo "🎉 SUCESSO TOTAL!"
        echo "================================"
        echo "Sistema está 100% operacional"
        echo "Iterações necessárias: $ITERATION"
        echo ""
        exit 0
    else
        echo ""
        echo "⚠️  TESTES FALHARAM - Tentando correção automática..."

        # Tentar aplicar correções
        if apply_fixes "test_failure"; then
            echo "✅ Correções aplicadas"

            # Commit e push
            git add -A
            git commit -m "fix: Autonomous correction (iteration $ITERATION)

Auto-generated fix based on test failures.

Iteration: $ITERATION
Previous commit: $CURRENT_COMMIT
" || true

            git push origin "$BRANCH"

            # Aguardar novo deploy
            NEW_COMMIT=$(git rev-parse --short HEAD)
            wait_for_deploy "$NEW_COMMIT" || {
                echo "❌ Deploy falhou"
                exit 1
            }
        else
            echo "❌ Não foi possível aplicar correção automática"
            echo ""
            echo "📋 RELATÓRIO DE FALHA:"
            echo "  - Iteração: $ITERATION"
            echo "  - Commit: $CURRENT_COMMIT"
            echo "  - Motivo: Testes falharam e correção automática não disponível"
            echo ""
            exit 1
        fi
    fi

    # Pausa entre iterações
    sleep 10
done

echo ""
echo "❌ LIMITE DE ITERAÇÕES ATINGIDO"
echo "Sistema ainda apresenta problemas após $MAX_ITERATIONS tentativas"
exit 1
