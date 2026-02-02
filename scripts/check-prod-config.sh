#!/bin/bash
# Script de diagnóstico: verificar configuração de pesquisas em produção

echo "=========================================="
echo "🔍 DIAGNÓSTICO: Configuração de Pesquisas"
echo "=========================================="
echo ""

# Verificar se produção está acessível
echo "1️⃣ Testando conectividade com produção..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://iarom.com.br/api/info 2>/dev/null)

if [ "$RESPONSE" != "200" ]; then
  echo "❌ Erro: Servidor não acessível (HTTP $RESPONSE)"
  exit 1
fi

echo "✅ Servidor acessível"
echo ""

# Verificar configuração via API info
echo "2️⃣ Verificando configuração de pesquisas..."
CONFIG=$(curl -s https://iarom.com.br/api/info 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)

    # Verificar se bedrock está configurado
    bedrock = data.get('bedrock', {})
    region = bedrock.get('region', 'N/A')

    # Tools disponíveis
    tools = data.get('tools', [])

    print('Bedrock Region:', region)
    print('Tools disponíveis:', len(tools))

    # Verificar se tem pesquisa de jurisprudência
    has_juris = any('jurisprudencia' in str(t).lower() for t in tools)
    print('Pesquisa jurisprudência:', '✅ SIM' if has_juris else '❌ NÃO')

except Exception as e:
    print('❌ Erro ao parsear:', str(e))
")

echo "$CONFIG"
echo ""

# Testar Google Search via endpoint de teste
echo "3️⃣ Testando Google Search API..."
GOOGLE_TEST=$(curl -s -X POST https://iarom.com.br/api/test/google-search \
  -H "Content-Type: application/json" \
  -d '{"query":"STF prisão preventiva","limit":3}' 2>/dev/null)

if echo "$GOOGLE_TEST" | grep -q "success.*true"; then
  echo "✅ Google Search: FUNCIONANDO"
elif echo "$GOOGLE_TEST" | grep -q "não configurad"; then
  echo "❌ Google Search: NÃO CONFIGURADO"
  echo "   Configure GOOGLE_SEARCH_API_KEY e GOOGLE_SEARCH_CX no Render"
else
  echo "⚠️ Google Search: ERRO"
  echo "$GOOGLE_TEST" | head -n 5
fi
echo ""

# Testar DataJud
echo "4️⃣ Testando DataJud API..."
DATAJUD_TEST=$(curl -s -X POST https://iarom.com.br/api/test/datajud \
  -H "Content-Type: application/json" \
  -d '{"query":"habeas corpus","limit":3}' 2>/dev/null)

if echo "$DATAJUD_TEST" | grep -q "success.*true"; then
  echo "✅ DataJud: FUNCIONANDO"
elif echo "$DATAJUD_TEST" | grep -q "não configurad"; then
  echo "❌ DataJud: NÃO CONFIGURADO"
  echo "   Configure DATAJUD_API_KEY e DATAJUD_ENABLED=true no Render"
else
  echo "⚠️ DataJud: ERRO"
  echo "$DATAJUD_TEST" | head -n 5
fi
echo ""

# Testar KB
echo "5️⃣ Testando KB (Knowledge Base)..."
KB_STATUS=$(curl -s https://iarom.com.br/api/kb/status 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    total = data.get('totalDocuments', 0)
    size = data.get('totalSizeFormatted', '0')
    last = data.get('lastUpdate', 'N/A')

    print(f'Total documentos: {total}')
    print(f'Tamanho total: {size}')
    print(f'Última atualização: {last}')
except Exception as e:
    print('❌ Erro:', str(e))
")

echo "$KB_STATUS"
echo ""

echo "=========================================="
echo "📊 RESUMO"
echo "=========================================="
echo ""
echo "Para corrigir problemas de configuração:"
echo ""
echo "1. Acesse: https://dashboard.render.com/"
echo "2. Vá em: ROM Agent > Environment"
echo "3. Adicione as variáveis:"
echo ""
echo "   GOOGLE_SEARCH_API_KEY=AIzaSy..."
echo "   GOOGLE_SEARCH_CX=f14c0d..."
echo "   GOOGLE_SEARCH_ENABLED=true"
echo ""
echo "   DATAJUD_API_KEY=cDZHYz..."
echo "   DATAJUD_ENABLED=true"
echo "   DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br"
echo ""
echo "4. Salve e aguarde redeploy (~2-3 min)"
echo ""

