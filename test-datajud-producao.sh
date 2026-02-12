#!/bin/bash
# ══════════════════════════════════════════════════════════════
# TESTE DATAJUD EM PRODUÇÃO
# Execute: bash test-datajud-producao.sh SEU_DOMINIO
# Exemplo: bash test-datajud-producao.sh rom-agent.onrender.com
# ══════════════════════════════════════════════════════════════

if [ -z "$1" ]; then
    echo "❌ Erro: Forneça o domínio"
    echo "Uso: bash test-datajud-producao.sh SEU_DOMINIO"
    echo "Exemplo: bash test-datajud-producao.sh rom-agent.onrender.com"
    exit 1
fi

DOMAIN=$1
BASE_URL="https://$DOMAIN"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "🧪 TESTANDO DATAJUD EM PRODUÇÃO"
echo "══════════════════════════════════════════════════════════════"
echo "🌐 Domínio: $DOMAIN"
echo "🔗 Base URL: $BASE_URL"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para testar endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4

    echo "──────────────────────────────────────────────────────────────"
    echo -e "${BLUE}📋 TESTE: $name${NC}"
    echo "   Endpoint: $method $endpoint"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi

    # Separar body e status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        echo -e "   Status: ${GREEN}✅ $http_code OK${NC}"
        echo "   Resposta: $(echo $body | jq -C '.' 2>/dev/null || echo $body | head -c 200)"
    else
        echo -e "   Status: ${RED}❌ $http_code ERRO${NC}"
        echo "   Resposta: $body"
    fi
    echo ""
}

# ══════════════════════════════════════════════════════════════
# TESTES
# ══════════════════════════════════════════════════════════════

echo "🚀 Iniciando testes..."
echo ""

# 1. Health Check DataJud
test_endpoint \
    "1. Health Check DataJud" \
    "GET" \
    "/api/datajud/health" \
    ""

# 2. Listar Tribunais
test_endpoint \
    "2. Listar Todos os Tribunais" \
    "GET" \
    "/api/datajud/tribunais" \
    ""

# 3. Buscar Processo TJSP
test_endpoint \
    "3. Buscar Processo no TJSP" \
    "POST" \
    "/api/datajud/processos/buscar" \
    '{"tribunal":"TJSP","numero":"0000832-35.2018.4.01.3202","limit":10}'

# 4. Buscar em Múltiplos Tribunais
test_endpoint \
    "4. Buscar em Múltiplos Tribunais" \
    "POST" \
    "/api/datajud/processos/buscar-todos" \
    '{"tribunais":["TJSP","TJRJ","TJMG"],"numero":"0000832-35.2018.4.01.3202","limit":5}'

# 5. Buscar Decisões STJ
test_endpoint \
    "5. Buscar Decisões no STJ" \
    "POST" \
    "/api/datajud/decisoes/buscar" \
    '{"tribunal":"STJ","termo":"responsabilidade civil","limit":10}'

# 6. Validar Número de Processo
test_endpoint \
    "6. Validar Número CNJ" \
    "POST" \
    "/api/datajud/validar-processo" \
    '{"numero":"0000832-35.2018.4.01.3202"}'

# 7. Listar Classes Processuais
test_endpoint \
    "7. Listar Classes Processuais" \
    "GET" \
    "/api/datajud/classes" \
    ""

# 8. Listar Assuntos
test_endpoint \
    "8. Listar Assuntos (Cível)" \
    "GET" \
    "/api/datajud/assuntos?area=civel" \
    ""

# 9. Cache Stats
test_endpoint \
    "9. Estatísticas do Cache" \
    "GET" \
    "/api/datajud/cache/stats" \
    ""

# ══════════════════════════════════════════════════════════════
# RESUMO
# ══════════════════════════════════════════════════════════════

echo "══════════════════════════════════════════════════════════════"
echo "✅ TESTES CONCLUÍDOS!"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "📊 URLs Úteis:"
echo "   - Health Check: $BASE_URL/api/datajud/health"
echo "   - Interface Teste: $BASE_URL/datajud-test.html"
echo "   - Documentação: $BASE_URL/api/datajud/docs"
echo ""
echo "📚 Documentação Completa:"
echo "   - Guia Rápido: DATAJUD-QUICKSTART.md"
echo "   - Docs Completa: docs/DATAJUD-INTEGRACAO-COMPLETA.md"
echo ""
echo "══════════════════════════════════════════════════════════════"
