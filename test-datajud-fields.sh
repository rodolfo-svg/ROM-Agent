#!/bin/bash

# Script para testar campos disponíveis na API DataJud CNJ
# Data: 2026-02-12

echo "============================================"
echo "TESTE DataJud CNJ - Campos Disponíveis"
echo "============================================"
echo ""

# Verificar se API Key está configurada
if [ -z "$DATAJUD_API_KEY" ]; then
    echo "⚠️  DATAJUD_API_KEY não configurada"
    echo "Configure: export DATAJUD_API_KEY=sua_chave"
    exit 1
fi

echo "✅ API Key configurada"
echo ""

# Teste 1: Match All (pegar qualquer resultado)
echo "📋 TESTE 1: Match All (1 resultado qualquer)"
echo "Endpoint: api_publica_stj/_search"
echo ""

curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey $DATAJUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {"match_all": {}},
    "size": 1
  }' 2>/dev/null | jq '.' > /tmp/datajud_test1.json

if [ $? -eq 0 ]; then
    echo "✅ Resposta recebida"
    echo ""
    echo "📄 Estrutura da resposta:"
    cat /tmp/datajud_test1.json | jq '.hits.hits[0]._source | keys' 2>/dev/null
    echo ""
    echo "📄 Campos de primeiro nível:"
    cat /tmp/datajud_test1.json | jq '.hits.hits[0]._source | keys[]' 2>/dev/null
    echo ""

    # Verificar campos específicos
    echo "🔍 Verificando campos específicos:"

    # ementa
    if cat /tmp/datajud_test1.json | jq -e '.hits.hits[0]._source | has("ementa")' >/dev/null 2>&1; then
        echo "  ✅ Campo 'ementa' EXISTE"
        echo "     Tipo: $(cat /tmp/datajud_test1.json | jq -r '.hits.hits[0]._source.ementa | type')"
    else
        echo "  ❌ Campo 'ementa' NÃO EXISTE"
    fi

    # textoIntegral
    if cat /tmp/datajud_test1.json | jq -e '.hits.hits[0]._source | has("textoIntegral")' >/dev/null 2>&1; then
        echo "  ✅ Campo 'textoIntegral' EXISTE"
        echo "     Tipo: $(cat /tmp/datajud_test1.json | jq -r '.hits.hits[0]._source.textoIntegral | type')"
    else
        echo "  ❌ Campo 'textoIntegral' NÃO EXISTE"
    fi

    # palavrasChave
    if cat /tmp/datajud_test1.json | jq -e '.hits.hits[0]._source | has("palavrasChave")' >/dev/null 2>&1; then
        echo "  ✅ Campo 'palavrasChave' EXISTE"
        echo "     Tipo: $(cat /tmp/datajud_test1.json | jq -r '.hits.hits[0]._source.palavrasChave | type')"
    else
        echo "  ❌ Campo 'palavrasChave' NÃO EXISTE"
    fi

    # movimentos (e verificar se tem documentos)
    if cat /tmp/datajud_test1.json | jq -e '.hits.hits[0]._source | has("movimentos")' >/dev/null 2>&1; then
        echo "  ✅ Campo 'movimentos' EXISTE"
        echo "     Tipo: $(cat /tmp/datajud_test1.json | jq -r '.hits.hits[0]._source.movimentos | type')"

        # Ver se movimentos tem documentos
        if cat /tmp/datajud_test1.json | jq -e '.hits.hits[0]._source.movimentos[0] | has("documento")' >/dev/null 2>&1; then
            echo "     ✅ Movimentos têm 'documento'"
            echo "        Campos: $(cat /tmp/datajud_test1.json | jq -r '.hits.hits[0]._source.movimentos[0].documento | keys[]' 2>/dev/null | head -5)"
        fi
    else
        echo "  ❌ Campo 'movimentos' NÃO EXISTE"
    fi

    echo ""
    echo "📄 Resposta completa salva em: /tmp/datajud_test1.json"
    echo "   Ver com: cat /tmp/datajud_test1.json | jq '.'"
else
    echo "❌ Erro na requisição"
    echo "Verifique:"
    echo "  1. API Key válida"
    echo "  2. Conectividade com api-publica.datajud.cnj.jus.br"
    echo "  3. Endpoint correto"
fi

echo ""
echo "============================================"
echo ""

# Teste 2: Buscar por termo específico
echo "📋 TESTE 2: Buscar por 'dano moral'"
echo ""

curl -X POST "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search" \
  -H "Authorization: APIKey $DATAJUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "multi_match": {
        "query": "dano moral",
        "fields": ["assunto.nome", "classe.nome"]
      }
    },
    "size": 2
  }' 2>/dev/null | jq '.' > /tmp/datajud_test2.json

if [ $? -eq 0 ]; then
    echo "✅ Resposta recebida"
    total=$(cat /tmp/datajud_test2.json | jq -r '.hits.total.value // .hits.total // 0')
    echo "   Total de resultados: $total"
    echo ""
    echo "📄 Resposta salva em: /tmp/datajud_test2.json"
else
    echo "❌ Erro na busca por termo"
fi

echo ""
echo "============================================"
echo "FIM DOS TESTES"
echo "============================================"
