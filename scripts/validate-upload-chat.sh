#!/bin/bash
# ==============================================================================
# SCRIPT DIAGNÓSTICO: Upload → KB → Chat Flow Validation
# ==============================================================================
# Testa exaustivamente o fluxo completo de Upload até Chat poder ler documentos
# Baseado em: MEMORIA-COMPLETA-UPLOAD-CHAT-KB.md
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SERVICE_ID="srv-d51ppfmuk2gs73a1qlkg"
BASE_URL="https://rom-agent-ia.onrender.com"

echo "════════════════════════════════════════════════════════════════════════"
echo "🔬 DIAGNÓSTICO COMPLETO: Upload → KB → Chat"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "🎯 Objetivo: Validar que documentos extraídos são acessíveis pelo chat"
echo "📋 Baseado em: MEMORIA-COMPLETA-UPLOAD-CHAT-KB.md"
echo ""
echo "Service ID: $SERVICE_ID"
echo "Base URL: $BASE_URL"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# ==============================================================================
# TESTE 1: Validar KB Cache inicialização sem "undefined"
# ==============================================================================
echo "📋 [1/10] Testando KB Cache inicialização..."
echo ""

KB_CACHE_LOGS=$(render logs -r "$SERVICE_ID" --limit 200 | grep "KB Cache" | grep "documentos carregados" | tail -1 || echo "")

if echo "$KB_CACHE_LOGS" | grep -q "undefined documentos"; then
    echo "❌ FALHOU - KB Cache mostrando 'undefined documentos'"
    echo "Log encontrado:"
    echo "$KB_CACHE_LOGS" | sed 's/^/  /'
    echo ""
    echo "CAUSA: Bug do commit 58cfadd não está funcionando"
    echo "AÇÃO: Verificar lib/kb-cache.js linhas 66-79"
    ((FAILED++))
elif [ -z "$KB_CACHE_LOGS" ]; then
    echo "⚠️  WARNING - Nenhum log de KB Cache encontrado"
    echo "POSSÍVEL CAUSA: Servidor não reiniciou recentemente"
    ((WARNINGS++))
else
    echo "✅ PASSOU - KB Cache inicializado corretamente"
    echo "Log encontrado:"
    echo "$KB_CACHE_LOGS" | sed 's/^/  /'
    ((PASSED++))
fi

echo ""

# ==============================================================================
# TESTE 2: Verificar formato de kb-documents.json
# ==============================================================================
echo "📋 [2/10] Testando formato de kb-documents.json..."
echo ""

FORMAT_CONVERSION=$(render logs -r "$SERVICE_ID" --limit 200 | grep "formato legado" || echo "")

if [ -n "$FORMAT_CONVERSION" ]; then
    echo "⚠️  WARNING - Formato legado detectado (ainda funciona)"
    echo "Log encontrado:"
    echo "$FORMAT_CONVERSION" | sed 's/^/  /'
    echo ""
    echo "RECOMENDAÇÃO: Migrar kb-documents.json para formato [] ao invés de {documents:[]}"
    ((WARNINGS++))
else
    echo "✅ PASSOU - Formato moderno [] detectado ou nenhuma conversão necessária"
    ((PASSED++))
fi

echo ""

# ==============================================================================
# TESTE 3: Validar contagem de documentos no KB
# ==============================================================================
echo "📋 [3/10] Testando contagem de documentos..."
echo ""

DOC_COUNT=$(render logs -r "$SERVICE_ID" --limit 200 | grep "KB Cache" | grep "documentos carregados" | tail -1 | grep -oE "[0-9]+ documentos" | grep -oE "[0-9]+" || echo "0")

echo "📊 Documentos no KB Cache: $DOC_COUNT"
echo ""

if [ "$DOC_COUNT" -eq 0 ]; then
    echo "ℹ️  INFO - Zero documentos no cache (normal se nenhum upload foi feito)"
    echo ""
    echo "AÇÃO: Fazer upload de documento de teste via interface web"
    ((WARNINGS++))
else
    echo "✅ PASSOU - KB Cache contém $DOC_COUNT documento(s)"
    ((PASSED++))
fi

echo ""

# ==============================================================================
# TESTE 4: Verificar upload recente (últimas 24h)
# ==============================================================================
echo "📋 [4/10] Testando uploads recentes..."
echo ""

TODAY=$(date +%Y-%m-%d)
UPLOAD_LOGS=$(render logs -r "$SERVICE_ID" | grep "$TODAY" | grep -iE "upload.*success|kb.*registered|extraction.*complete" | tail -5 || echo "")

if [ -z "$UPLOAD_LOGS" ]; then
    echo "ℹ️  INFO - Nenhum upload detectado hoje ($TODAY)"
    echo ""
    echo "AÇÃO: Fazer upload de documento de teste para validar fluxo completo"
    ((WARNINGS++))
else
    echo "✅ PASSOU - Uploads recentes detectados"
    echo "Logs encontrados:"
    echo "$UPLOAD_LOGS" | sed 's/^/  /'
    ((PASSED++))
fi

echo ""

# ==============================================================================
# TESTE 5: Verificar userId em uploads (BUG CRÍTICO)
# ==============================================================================
echo "📋 [5/10] Testando userId nos uploads..."
echo ""

USER_ID_LOGS=$(render logs -r "$SERVICE_ID" | grep "$TODAY" | grep -E "userId.*web-upload|userId.*anonymous" | tail -3 || echo "")

if echo "$USER_ID_LOGS" | grep -q "web-upload"; then
    echo "⚠️  WARNING - Uploads com userId='web-upload' detectados"
    echo "Logs encontrados:"
    echo "$USER_ID_LOGS" | sed 's/^/  /'
    echo ""
    echo "PROBLEMA: Se chat usar userId='anonymous', não encontrará estes docs"
    echo "CAUSA: BUG #1 em MEMORIA-COMPLETA-UPLOAD-CHAT-KB.md"
    echo "ARQUIVO: src/server-enhanced.js linha 3858"
    ((WARNINGS++))
elif [ -z "$USER_ID_LOGS" ]; then
    echo "ℹ️  INFO - Nenhum log de userId encontrado (normal se sem uploads)"
    ((WARNINGS++))
else
    echo "✅ PASSOU - userId nos uploads parece consistente"
    echo "Logs encontrados:"
    echo "$USER_ID_LOGS" | sed 's/^/  /'
    ((PASSED++))
fi

echo ""

# ==============================================================================
# TESTE 6: Verificar chat consultando KB (últimas 24h)
# ==============================================================================
echo "📋 [6/10] Testando consultas do chat ao KB..."
echo ""

CHAT_KB_LOGS=$(render logs -r "$SERVICE_ID" | grep "$TODAY" | grep -iE "KB DEBUG|consultar_kb|Total docs.*do usuário" | tail -5 || echo "")

if [ -z "$CHAT_KB_LOGS" ]; then
    echo "ℹ️  INFO - Nenhuma consulta de chat ao KB hoje ($TODAY)"
    echo ""
    echo "AÇÃO: Fazer pergunta no chat relacionada aos documentos"
    ((WARNINGS++))
else
    echo "✅ PASSOU - Chat consultou KB recentemente"
    echo "Logs encontrados:"
    echo "$CHAT_KB_LOGS" | sed 's/^/  /'

    # Verificar se encontrou documentos
    if echo "$CHAT_KB_LOGS" | grep -q "do usuário.*: 0"; then
        echo ""
        echo "⚠️  WARNING - Chat consultou KB mas encontrou 0 documentos!"
        echo ""
        echo "POSSÍVEL CAUSA: BUG #1 - userId divergente entre upload e chat"
        echo "Ver: MEMORIA-COMPLETA-UPLOAD-CHAT-KB.md"
        ((WARNINGS++))
    fi

    ((PASSED++))
fi

echo ""

# ==============================================================================
# TESTE 7: Verificar context.userId no chat
# ==============================================================================
echo "📋 [7/10] Testando context.userId no chat..."
echo ""

CONTEXT_USERID=$(render logs -r "$SERVICE_ID" | grep "$TODAY" | grep "context.userId" | tail -3 || echo "")

if [ -z "$CONTEXT_USERID" ]; then
    echo "ℹ️  INFO - Nenhum log de context.userId (normal se chat não foi usado)"
    ((WARNINGS++))
else
    echo "✅ PASSOU - context.userId sendo logado corretamente"
    echo "Logs encontrados:"
    echo "$CONTEXT_USERID" | sed 's/^/  /'

    # Verificar divergência
    if echo "$CONTEXT_USERID" | grep -q "anonymous"; then
        echo ""
        echo "⚠️  WARNING - context.userId = 'anonymous' detectado"
        echo ""
        echo "VERIFICAR: Se há uploads com userId='web-upload', chat não encontrará"
        ((WARNINGS++))
    fi

    ((PASSED++))
fi

echo ""

# ==============================================================================
# TESTE 8: Endpoint /api/kb/documents acessível
# ==============================================================================
echo "📋 [8/10] Testando endpoint /api/kb/documents..."
echo ""

KB_ENDPOINT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/kb/documents" || echo "000")

if [ "$KB_ENDPOINT_STATUS" = "200" ]; then
    echo "✅ PASSOU - Endpoint retornou 200 OK"
    ((PASSED++))
elif [ "$KB_ENDPOINT_STATUS" = "401" ]; then
    echo "✅ PASSOU - Endpoint retornou 401 (correto, requer login)"
    echo ""
    echo "ℹ️  INFO - Para testar com autenticação, usar cookie de sessão"
    ((PASSED++))
else
    echo "❌ FALHOU - Endpoint retornou $KB_ENDPOINT_STATUS"
    echo ""
    echo "ESPERADO: 200 ou 401"
    echo "RECEBIDO: $KB_ENDPOINT_STATUS"
    ((FAILED++))
fi

echo ""

# ==============================================================================
# TESTE 9: Verificar erros de "undefined" hoje
# ==============================================================================
echo "📋 [9/10] Testando ausência de erros 'undefined'..."
echo ""

UNDEFINED_ERRORS=$(render logs -r "$SERVICE_ID" | grep "$TODAY" | grep -i "undefined" | grep -vE "failedModels|KB Cache.*Convertendo" | wc -l | tr -d ' ')

if [ "$UNDEFINED_ERRORS" -eq 0 ]; then
    echo "✅ PASSOU - Zero erros 'undefined' problemáticos hoje"
    ((PASSED++))
else
    echo "⚠️  WARNING - $UNDEFINED_ERRORS ocorrência(s) de 'undefined' detectadas"
    echo ""
    echo "Primeiras 3 ocorrências:"
    render logs -r "$SERVICE_ID" | grep "$TODAY" | grep -i "undefined" | grep -vE "failedModels|KB Cache.*Convertendo" | head -3 | sed 's/^/  /'
    echo ""
    echo "AÇÃO: Investigar se são erros reais ou apenas logs informativos"
    ((WARNINGS++))
fi

echo ""

# ==============================================================================
# TESTE 10: Validar persistência de kb-documents.json
# ==============================================================================
echo "📋 [10/10] Testando persistência de kb-documents.json..."
echo ""

PERSISTENCE_LOGS=$(render logs -r "$SERVICE_ID" --limit 200 | grep -E "KB Cache.*save|persist|shutdown" | tail -3 || echo "")

if [ -n "$PERSISTENCE_LOGS" ]; then
    echo "✅ PASSOU - Logs de persistência encontrados"
    echo "Logs encontrados:"
    echo "$PERSISTENCE_LOGS" | sed 's/^/  /'
    ((PASSED++))
else
    echo "ℹ️  INFO - Nenhum log de persistência recente"
    echo ""
    echo "NOTA: Persistência ocorre ao salvar documentos e no shutdown"
    echo "Para testar: Fazer upload → Aguardar 1min → Verificar logs"
    ((WARNINGS++))
fi

echo ""

# ==============================================================================
# RESUMO FINAL
# ==============================================================================
echo "════════════════════════════════════════════════════════════════════════"
echo "📊 RESUMO DO DIAGNÓSTICO"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

TOTAL=$((PASSED + FAILED + WARNINGS))
echo "Total de Testes:     $TOTAL"
echo "✅ Testes Aprovados:  $PASSED"
echo "⚠️  Avisos (Info):     $WARNINGS"
echo "❌ Testes Falhados:   $FAILED"
echo ""

# Calcular taxa de sucesso (considerando warnings como não-críticos)
if [ $((PASSED + WARNINGS)) -gt 0 ]; then
    SUCCESS_RATE=$((100 * PASSED / (PASSED + FAILED)))
    echo "Taxa de Sucesso Crítico: $SUCCESS_RATE% ($PASSED/$((PASSED + FAILED)) testes críticos)"
fi

echo ""

# ==============================================================================
# ANÁLISE E RECOMENDAÇÕES
# ==============================================================================
echo "════════════════════════════════════════════════════════════════════════"
echo "🔍 ANÁLISE E RECOMENDAÇÕES"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 PERFEITO - Sistema está 100% operacional!"
    echo ""
    echo "✅ KB Cache funcionando corretamente"
    echo "✅ Uploads salvando documentos"
    echo "✅ Chat acessando KB"
    echo "✅ Nenhum bug crítico detectado"
    echo ""

elif [ $FAILED -eq 0 ]; then
    echo "⚠️  SISTEMA FUNCIONAL COM AVISOS"
    echo ""
    echo "O sistema está operacional, mas há pontos de atenção:"
    echo ""

    # Listar avisos principais
    if render logs -r "$SERVICE_ID" | grep "$TODAY" | grep -q "web-upload"; then
        echo "1. ⚠️  BUG POTENCIAL: userId divergente (web-upload vs anonymous)"
        echo "   Localização: src/server-enhanced.js:3858 + chat-stream.js:129"
        echo "   Solução: Ver MEMORIA-COMPLETA-UPLOAD-CHAT-KB.md - Soluções A/B/C"
        echo ""
    fi

    if [ "$DOC_COUNT" -eq 0 ]; then
        echo "2. ℹ️  Nenhum documento no KB - fazer teste manual:"
        echo "   a) Login no sistema"
        echo "   b) Upload de PDF pequeno"
        echo "   c) Aguardar extração completar"
        echo "   d) Fazer pergunta no chat sobre o documento"
        echo ""
    fi

    echo "PRÓXIMOS PASSOS:"
    echo "1. Realizar teste manual completo (ver checklist abaixo)"
    echo "2. Decidir implementação de fix para userId divergente"
    echo "3. Validar persistência após logout/login"
    echo ""

else
    echo "❌ FALHAS CRÍTICAS DETECTADAS"
    echo ""
    echo "O sistema tem problemas que impedem funcionamento correto:"
    echo ""

    if render logs -r "$SERVICE_ID" --limit 200 | grep "KB Cache" | grep -q "undefined documentos"; then
        echo "1. ❌ KB Cache mostrando 'undefined documentos'"
        echo "   Solução: Verificar commit 58cfadd em lib/kb-cache.js"
        echo ""
    fi

    echo "AÇÃO URGENTE: Corrigir falhas antes de uso em produção"
    echo ""
fi

echo "════════════════════════════════════════════════════════════════════════"
echo "📋 CHECKLIST DE TESTE MANUAL"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Para validação completa, execute manualmente:"
echo ""
echo "□ CENÁRIO 1: Upload COM login → Chat COM login"
echo "  1. Fazer login no sistema"
echo "  2. Upload de PDF pequeno (ex: 1-2 páginas)"
echo "  3. Aguardar extração completar"
echo "  4. Abrir chat"
echo "  5. Fazer pergunta: 'O que diz o documento que acabei de enviar?'"
echo "  6. Verificar: Chat deve encontrar e usar o documento"
echo ""
echo "□ CENÁRIO 2: Persistência após logout"
echo "  1. Após CENÁRIO 1, fazer logout"
echo "  2. Fazer login novamente"
echo "  3. Abrir chat"
echo "  4. Fazer mesma pergunta"
echo "  5. Verificar: Chat deve ainda encontrar o documento"
echo ""
echo "□ CENÁRIO 3: Upload SEM login → Chat SEM login"
echo "  1. Abrir navegador anônimo (ou limpar cookies)"
echo "  2. Acessar sistema SEM fazer login"
echo "  3. Upload de PDF"
echo "  4. Abrir chat SEM fazer login"
echo "  5. Fazer pergunta sobre o documento"
echo "  6. Verificar: Chat deve encontrar documento (ou mostrar erro claro)"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "📚 DOCUMENTAÇÃO RELACIONADA"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "• MEMORIA-COMPLETA-UPLOAD-CHAT-KB.md - Mapeamento completo do fluxo"
echo "• LESSONS-LEARNED.md - Histórico de erros e soluções"
echo "• TESTE-COMPLETO-CLI-API-RESULTADO.md - Resultado de testes anteriores"
echo "• scripts/README.md - Guia de scripts de automação"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# Exit code baseado em falhas
if [ $FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi
