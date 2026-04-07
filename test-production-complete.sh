#!/bin/bash

# Script de Teste Completo em Produção - ROM Agent
# Data: 06/04/2026 23:15
# URL: https://rom-agent-ia.onrender.com

BASE_URL="https://rom-agent-ia.onrender.com"
EMAIL="rodolfo@rom.adv.br"
PASSWORD="Rodolfo@2026!"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "======================================================================"
echo "🧪 TESTE COMPLETO EM PRODUÇÃO - ROM Agent"
echo "======================================================================"
echo "URL Base: $BASE_URL"
echo "Usuário: $EMAIL"
echo "Data: $(date)"
echo "======================================================================"
echo ""

# Variável para armazenar token de sessão
SESSION_TOKEN=""

# Função para imprimir resultado
print_result() {
    local test_name=$1
    local status=$2
    local details=$3

    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $test_name"
    elif [ "$status" == "FAIL" ]; then
        echo -e "${RED}❌ FAIL${NC} - $test_name"
    else
        echo -e "${YELLOW}⚠️  WARN${NC} - $test_name"
    fi

    if [ -n "$details" ]; then
        echo "   └─ $details"
    fi
    echo ""
}

# Função para esperar um pouco entre requests
wait_between_tests() {
    sleep 1
}

echo "======================================================================"
echo "TESTE #1: Health Check / Status da Aplicação"
echo "======================================================================"

response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")
http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" == "200" ]; then
    print_result "Health Check" "PASS" "Status: $http_code"
    echo "Response: $body"
else
    print_result "Health Check" "FAIL" "Status: $http_code"
fi

wait_between_tests

echo "======================================================================"
echo "TESTE #2: Login com Credenciais Corretas"
echo "======================================================================"

login_payload=$(cat <<EOF
{"email":"$EMAIL","password":"$PASSWORD"}
EOF
)

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$login_payload" 2>/dev/null || echo "000")

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" == "200" ]; then
    success=$(echo "$body" | grep -o '"success":true' || echo "")
    if [ -n "$success" ]; then
        print_result "Login (credenciais válidas)" "PASS" "Status: $http_code"
        echo "Response: $body"

        # Extrair informações do usuário
        user_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        user_role=$(echo "$body" | grep -o '"role":"[^"]*"' | cut -d'"' -f4)
        echo "   User ID: $user_id"
        echo "   Role: $user_role"
    else
        print_result "Login (credenciais válidas)" "FAIL" "success:false no response"
    fi
else
    print_result "Login (credenciais válidas)" "FAIL" "Status: $http_code - $body"
fi

wait_between_tests

echo "======================================================================"
echo "TESTE #3: Login com Credenciais Incorretas (Brute Force Protection)"
echo "======================================================================"

wrong_payload=$(cat <<EOF
{"email":"$EMAIL","password":"SenhaErrada123"}
EOF
)

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$wrong_payload" 2>/dev/null || echo "000")

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" == "401" ]; then
    attempts=$(echo "$body" | grep -o '"attemptsRemaining":[0-9]*' | cut -d':' -f2)
    print_result "Login (credenciais inválidas)" "PASS" "Status: 401 (esperado)"
    echo "Response: $body"
    echo "   Tentativas restantes: $attempts"
else
    print_result "Login (credenciais inválidas)" "FAIL" "Status: $http_code (esperado 401)"
fi

wait_between_tests

echo "======================================================================"
echo "TESTE #4: Login com Usuário Inexistente"
echo "======================================================================"

nonexistent_payload=$(cat <<EOF
{"email":"usuario-nao-existe@example.com","password":"qualquersenha"}
EOF
)

response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$nonexistent_payload" 2>/dev/null || echo "000")

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" == "401" ]; then
    print_result "Login (usuário inexistente)" "PASS" "Status: 401 (não revela se usuário existe)"
    echo "Response: $body"
else
    print_result "Login (usuário inexistente)" "FAIL" "Status: $http_code"
fi

wait_between_tests

echo "======================================================================"
echo "TESTE #5: Verificar Endpoints Protegidos (sem autenticação)"
echo "======================================================================"

# Testar endpoints que devem exigir autenticação
protected_endpoints=(
    "/api/documents"
    "/api/chat/conversations"
    "/api/users/profile"
)

for endpoint in "${protected_endpoints[@]}"; do
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" == "401" ] || [ "$http_code" == "302" ]; then
        print_result "Proteção de endpoint: $endpoint" "PASS" "Status: $http_code (requer auth)"
    else
        print_result "Proteção de endpoint: $endpoint" "WARN" "Status: $http_code (esperado 401/302)"
    fi
    wait_between_tests
done

echo "======================================================================"
echo "TESTE #6: Upload de Documento (simulação)"
echo "======================================================================"

# Criar um PDF de teste
test_pdf="/tmp/test-document.pdf"
echo "%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Teste PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000317 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
410
%%EOF" > "$test_pdf"

echo "⚠️  Teste de upload requer autenticação - necessário cookie/session"
echo "   PDF de teste criado em: $test_pdf"

wait_between_tests

echo "======================================================================"
echo "TESTE #7: Verificar Assets Estáticos"
echo "======================================================================"

static_assets=(
    "/favicon.ico"
    "/"
)

for asset in "${static_assets[@]}"; do
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$asset" 2>/dev/null || echo "000")
    http_code=$(echo "$response" | tail -1)

    if [ "$http_code" == "200" ] || [ "$http_code" == "304" ]; then
        print_result "Asset estático: $asset" "PASS" "Status: $http_code"
    else
        print_result "Asset estático: $asset" "WARN" "Status: $http_code"
    fi
    wait_between_tests
done

echo "======================================================================"
echo "TESTE #8: Tempo de Resposta (Performance)"
echo "======================================================================"

# Medir tempo de resposta do login
start_time=$(date +%s%N)
curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$login_payload" > /dev/null
end_time=$(date +%s%N)

elapsed_ms=$(( (end_time - start_time) / 1000000 ))
elapsed_sec=$(echo "scale=2; $elapsed_ms / 1000" | bc)

if [ "$elapsed_ms" -lt 2000 ]; then
    print_result "Tempo de resposta (login)" "PASS" "${elapsed_sec}s (< 2s)"
elif [ "$elapsed_ms" -lt 5000 ]; then
    print_result "Tempo de resposta (login)" "WARN" "${elapsed_sec}s (< 5s mas > 2s)"
else
    print_result "Tempo de resposta (login)" "FAIL" "${elapsed_sec}s (> 5s - muito lento)"
fi

wait_between_tests

echo "======================================================================"
echo "TESTE #9: CORS Headers"
echo "======================================================================"

response=$(curl -s -I -X OPTIONS "$BASE_URL/api/auth/login" \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST" 2>/dev/null)

if echo "$response" | grep -q "Access-Control-Allow"; then
    print_result "CORS Headers" "PASS" "Headers configurados"
    echo "$response" | grep "Access-Control"
else
    print_result "CORS Headers" "WARN" "Headers não encontrados"
fi

echo ""
echo "======================================================================"
echo "📊 RESUMO DOS TESTES"
echo "======================================================================"
echo "Testes executados: 9 grupos de testes"
echo "URL: $BASE_URL"
echo "Data: $(date)"
echo "======================================================================"
echo ""
echo "✅ Para ver logs detalhados, use:"
echo "   render logs srv-d51ppfmuk2gs73a1qlkg --tail"
echo ""
echo "✅ Para verificar deploy atual:"
echo "   render deploys list srv-d51ppfmuk2gs73a1qlkg | head -5"
echo ""
echo "======================================================================"
