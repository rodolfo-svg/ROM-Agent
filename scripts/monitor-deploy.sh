#!/bin/bash

# Monitor de Deploy - ROM Agent
# Acompanha deploy e valida funcionamento

API_URL="https://iarom.com.br/api/info"
CHECK_INTERVAL=10
MAX_CHECKS=30

echo "════════════════════════════════════════════════════════"
echo "🔍 MONITORANDO DEPLOY - ROM Agent"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Commits esperados:"
echo "  - ab72fff: Fix PromptsManager paths"
echo "  - faa9fdf: Integração hierárquica System Prompts v2.0"
echo ""
echo "Checando a cada ${CHECK_INTERVAL}s (máximo ${MAX_CHECKS} tentativas)..."
echo ""

LAST_UPTIME=""
DEPLOY_DETECTED=false

for i in $(seq 1 $MAX_CHECKS); do
    echo -n "[$(date +%H:%M:%S)] Check $i/$MAX_CHECKS ... "

    RESPONSE=$(curl -s -H "Accept: application/json" "$API_URL" 2>/dev/null)

    if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
        echo "❌ Servidor inacessível"
        sleep $CHECK_INTERVAL
        continue
    fi

    VERSION=$(echo "$RESPONSE" | python3 -c "import json, sys; data = json.load(sys.stdin); print(data.get('version', 'N/A'))" 2>/dev/null)
    UPTIME=$(echo "$RESPONSE" | python3 -c "import json, sys; data = json.load(sys.stdin); print(data.get('health', {}).get('uptime', 'N/A'))" 2>/dev/null)
    UPTIME_SEC=$(echo "$RESPONSE" | python3 -c "import json, sys; data = json.load(sys.stdin); print(data.get('health', {}).get('uptimeSeconds', 0))" 2>/dev/null)

    if [ -n "$LAST_UPTIME" ] && [ "$UPTIME_SEC" -lt 60 ]; then
        if [ "$DEPLOY_DETECTED" = false ]; then
            echo ""
            echo "🔄 DEPLOY DETECTADO! Servidor reiniciou (uptime: ${UPTIME})"
            DEPLOY_DETECTED=true
        fi
    fi

    LAST_UPTIME="$UPTIME_SEC"

    echo "v${VERSION} | uptime: ${UPTIME}"

    if [ "$DEPLOY_DETECTED" = true ] && [ "$UPTIME_SEC" -gt 30 ]; then
        echo ""
        echo "✅ Servidor estável após deploy!"
        break
    fi

    sleep $CHECK_INTERVAL
done

echo ""
echo "════════════════════════════════════════════════════════"
echo "🧪 TESTES DE VALIDAÇÃO"
echo "════════════════════════════════════════════════════════"
echo ""

echo "📊 [1/3] Testando /api/info..."
INFO_RESULT=$(curl -s -H "Accept: application/json" "$API_URL")
if echo "$INFO_RESULT" | python3 -c "import json, sys; json.load(sys.stdin)" 2>/dev/null; then
    echo "   ✅ Endpoint funcionando"
    echo "$INFO_RESULT" | python3 -m json.tool | grep -E "(version|uptime|status)" | head -5 | sed 's/^/   /'
else
    echo "   ❌ Endpoint com problemas"
fi
echo ""

echo "📋 [2/3] Testando /api/system-prompts..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Accept: application/json" "https://iarom.com.br/api/system-prompts")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "   ✅ Endpoint existe (HTTP $HTTP_CODE - autenticação necessária)"
elif [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Endpoint acessível"
else
    echo "   ⚠️  HTTP $HTTP_CODE"
fi
echo ""

echo "🔐 [3/3] Testando /api/csrf-token..."
CSRF_RESULT=$(curl -s -H "Accept: application/json" "https://iarom.com.br/api/csrf-token")
if echo "$CSRF_RESULT" | grep -q "csrfToken"; then
    echo "   ✅ CSRF token endpoint funcionando"
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://iarom.com.br/api/csrf-token")
    echo "   ⚠️  HTTP $HTTP_CODE"
fi
echo ""

echo "════════════════════════════════════════════════════════"
echo "📝 VALIDAÇÃO COMPLETA"
echo "════════════════════════════════════════════════════════"
