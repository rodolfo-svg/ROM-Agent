#!/bin/bash

# Script para forçar reload do cache via API

EMAIL="$1"
PASSWORD="$2"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
    echo "Uso: bash scripts/forcar-reload-cache.sh <email> <password>"
    exit 1
fi

DOMAIN="https://iarom.com.br"
COOKIE_FILE="/tmp/rom_reload_session.txt"

echo "═══════════════════════════════════════════════"
echo "  FORÇAR RELOAD DO CACHE"
echo "═══════════════════════════════════════════════"
echo ""

# 1. Login
echo "1. Fazendo login..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "${DOMAIN}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

SUCCESS=$(echo "$LOGIN_RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" != "true" ]; then
    echo "❌ Falha no login"
    echo "$LOGIN_RESPONSE" | jq .
    exit 1
fi

echo "✅ Login realizado"
echo ""

# 2. Forçar reload do cache
echo "2. Forçando reload do cache..."
RELOAD_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "${DOMAIN}/api/kb/cache/reload")

echo "$RELOAD_RESPONSE" | jq .
echo ""

# 3. Listar documentos após reload
echo "3. Listando documentos após reload..."
DOCS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "${DOMAIN}/api/kb/documents")

TOTAL=$(echo "$DOCS_RESPONSE" | jq '.documents | length')
echo "Total de documentos: $TOTAL"
echo ""

# 4. Mostrar últimos 10 documentos
echo "4. Últimos 10 documentos:"
echo "$DOCS_RESPONSE" | jq -r '.documents[-10:] | .[] | "\(.uploadedAt) - \(.name) - \(.size) bytes - userId: \(.userId)"'
echo ""

# 5. Procurar por TEXTO_COMPLETO e RESUMO_EXECUTIVO
echo "5. Procurando arquivos específicos:"
HAS_TXT=$(echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | contains("00_TEXTO_COMPLETO")) | .name' | wc -l)
HAS_RESUMO=$(echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | contains("05_RESUMO_EXECUTIVO")) | .name' | wc -l)

echo "   00_TEXTO_COMPLETO: $HAS_TXT arquivo(s)"
echo "   05_RESUMO_EXECUTIVO: $HAS_RESUMO arquivo(s)"

if [ "$HAS_TXT" -gt 0 ]; then
    echo ""
    echo "✅ Arquivos 00_TEXTO_COMPLETO encontrados:"
    echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | contains("00_TEXTO_COMPLETO")) | "   \(.name) - \(.size) bytes"'
fi

if [ "$HAS_RESUMO" -gt 0 ]; then
    echo ""
    echo "✅ Arquivos 05_RESUMO_EXECUTIVO encontrados:"
    echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | contains("05_RESUMO_EXECUTIVO")) | "   \(.name) - \(.size) bytes - \(if .size > 40000 then "✅ TAMANHO OK" else "⚠️ TAMANHO PEQUENO" end)"'
fi

# Cleanup
rm -f "$COOKIE_FILE"

echo ""
echo "═══════════════════════════════════════════════"
echo "  CONCLUÍDO"
echo "═══════════════════════════════════════════════"
