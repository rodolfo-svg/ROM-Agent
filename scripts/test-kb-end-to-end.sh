#!/bin/bash
# ==============================================================================
# TESTE END-TO-END DO KB
# Valida que documentos uploaded ficam acessíveis ao chat
# ==============================================================================

set -e

SERVICE_ID="srv-d51ppfmuk2gs73a1qlkg"
BASE_URL="https://rom-agent-ia.onrender.com"

echo "🧪 TESTE END-TO-END DO KB"
echo "================================"
echo ""

# Função para colorir output
green() { echo -e "\033[0;32m$1\033[0m"; }
red() { echo -e "\033[0;31m$1\033[0m"; }
yellow() { echo -e "\033[0;33m$1\033[0m"; }

# ==============================================================================
# TESTE 1: Verificar KB Cache atual
# ==============================================================================
echo "📊 TESTE 1: Verificar KB Cache"
echo "---"

KB_LOGS=$(render logs -r "$SERVICE_ID" --text "KB Cache" 2>&1 | grep "$(date +%Y-%m-%d)" | tail -5)
echo "Últimos logs do KB:"
echo "$KB_LOGS" | sed 's/^/  /'
echo ""

if echo "$KB_LOGS" | grep -q "undefined documentos"; then
    red "❌ FALHOU - KB Cache mostra undefined"
    exit 1
else
    green "✅ KB Cache OK - sem undefined"
fi

echo ""

# ==============================================================================
# TESTE 2: Verificar formato do kb-documents.json
# ==============================================================================
echo "📄 TESTE 2: Verificar formato kb-documents.json"
echo "---"

# Buscar logs que mostram o formato detectado
FORMAT_LOGS=$(render logs -r "$SERVICE_ID" --text "Convertendo formato legado" 2>&1 | tail -5 || true)

if [ -n "$FORMAT_LOGS" ]; then
    yellow "⚠️  Formato legado detectado (foi convertido):"
    echo "$FORMAT_LOGS" | sed 's/^/  /'
    echo ""
    yellow "→ Recomendação: migrar kb-documents.json para formato []"
else
    green "✅ Formato correto ou sem documentos"
fi

echo ""

# ==============================================================================
# TESTE 3: Contar documentos no KB
# ==============================================================================
echo "📚 TESTE 3: Contar documentos no KB"
echo "---"

DOC_COUNT=$(echo "$KB_LOGS" | grep "documentos carregados" | tail -1 | grep -oE '[0-9]+ documentos' | grep -oE '[0-9]+' || echo "0")

echo "Documentos no KB: $DOC_COUNT"

if [ "$DOC_COUNT" -eq 0 ]; then
    yellow "⚠️  Nenhum documento encontrado no KB"
    echo ""
    echo "Para testar completamente, faça:"
    echo "  1. Acesse: $BASE_URL"
    echo "  2. Faça login"
    echo "  3. Vá em 'Upload & KB'"
    echo "  4. Faça upload de um PDF pequeno"
    echo "  5. Execute este script novamente"
    echo ""
    exit 0
else
    green "✅ $DOC_COUNT documentos encontrados"
fi

echo ""

# ==============================================================================
# TESTE 4: Verificar logs de busca do chat
# ==============================================================================
echo "💬 TESTE 4: Verificar busca do chat ao KB"
echo "---"

# Buscar logs recentes de consulta ao KB
CHAT_KB_LOGS=$(render logs -r "$SERVICE_ID" --text "KB DEBUG" 2>&1 | grep "$(date +%Y-%m-%d)" | tail -20 || true)

if [ -z "$CHAT_KB_LOGS" ]; then
    yellow "⚠️  Nenhuma consulta ao KB detectada hoje"
    echo ""
    echo "Para testar o chat:"
    echo "  1. Acesse: $BASE_URL"
    echo "  2. Abra o chat"
    echo "  3. Pergunte algo relacionado aos seus documentos"
    echo "  4. Verifique se a resposta usa o KB"
    echo ""
else
    green "✅ Chat consultou o KB:"
    echo "$CHAT_KB_LOGS" | sed 's/^/  /'
    echo ""

    # Verificar se encontrou documentos
    if echo "$CHAT_KB_LOGS" | grep -q "docs no cache"; then
        green "✅ Chat conseguiu acessar documentos do KB"
    else
        yellow "⚠️  Verifique se o chat está encontrando os documentos corretos"
    fi
fi

echo ""

# ==============================================================================
# TESTE 5: Verificar persistência após logout
# ==============================================================================
echo "🔐 TESTE 5: Persistência após logout (MANUAL)"
echo "---"

echo "Este teste requer validação manual:"
echo ""
echo "  1. Faça login em: $BASE_URL"
echo "  2. Vá em 'Upload & KB' e confirme que vê seus documentos"
echo "  3. Faça LOGOUT"
echo "  4. Faça LOGIN novamente"
echo "  5. Vá em 'Upload & KB' e confirme que AINDA vê seus documentos"
echo "  6. Abra o chat e pergunte algo relacionado aos documentos"
echo "  7. Confirme que o chat encontra e usa os documentos"
echo ""

if [ "$DOC_COUNT" -gt 0 ]; then
    yellow "⚠️  Por favor, execute o teste manual de persistência acima"
else
    yellow "⚠️  Primeiro faça upload de documentos, depois teste persistência"
fi

echo ""
echo "================================"
echo "📋 RESUMO DOS TESTES"
echo "================================"
echo ""
green "✅ KB Cache: sem undefined"
echo "📊 Documentos no KB: $DOC_COUNT"

if [ "$DOC_COUNT" -eq 0 ]; then
    yellow "⚠️  PRÓXIMOS PASSOS:"
    echo "  1. Faça upload de documentos via 'Upload & KB'"
    echo "  2. Execute este script novamente"
    echo "  3. Teste o chat"
    echo "  4. Teste persistência (logout/login)"
else
    green "✅ Sistema pronto para testes de chat e persistência"
fi

echo ""
