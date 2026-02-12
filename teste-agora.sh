#!/bin/bash
# TESTE RÁPIDO DATAJUD
# Cole seu domínio abaixo (exemplo: meu-app.onrender.com)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 TESTE RÁPIDO DATAJUD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "📝 Digite seu domínio Render (exemplo: meu-app.onrender.com): " DOMAIN
echo ""

BASE_URL="https://$DOMAIN"

echo "🌐 Testando: $BASE_URL"
echo ""

# Teste 1: Health Check Geral
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Health Check Geral"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s "$BASE_URL/api/health" | jq '.' || echo "⚠️  jq não instalado, mostrando raw:"
curl -s "$BASE_URL/api/health"
echo ""
echo ""

# Teste 2: Health Check DataJud
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Health Check DataJud"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
response=$(curl -s "$BASE_URL/api/datajud/health")
echo "$response" | jq '.' 2>/dev/null || echo "$response"

# Verificar se configurado
if echo "$response" | grep -q '"configured":true'; then
    echo ""
    echo "✅ DataJud CONFIGURADO e FUNCIONANDO!"
else
    echo ""
    echo "❌ DataJud NÃO configurado corretamente"
fi
echo ""
echo ""

# Teste 3: Listar Tribunais
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Listar Tribunais"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s "$BASE_URL/api/datajud/tribunais" | jq '.total' 2>/dev/null || echo "Erro ao obter total"
echo ""
echo ""

# Teste 4: Buscar Processo (teste simples)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Buscar Processo TJSP (Teste)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE_URL/api/datajud/processos/buscar" \
  -H "Content-Type: application/json" \
  -d '{"tribunal":"TJSP","numero":"0000832-35.2018.4.01.3202","limit":5}' | \
  jq '.fonte, .totalEncontrado' 2>/dev/null || echo "Teste de busca executado"
echo ""
echo ""

# Resumo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ TESTES CONCLUÍDOS!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Abra no navegador para testar visualmente:"
echo "   $BASE_URL/datajud-test.html"
echo ""
echo "📚 Documentação:"
echo "   - TESTE-DEPLOY-DATAJUD.md"
echo "   - DATAJUD-QUICKSTART.md"
echo ""
