#!/bin/bash

# Script para limpar documentos antigos/fantasmas do KB

EMAIL="$1"
PASSWORD="$2"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
    echo "Uso: bash scripts/limpar-cache-antigos.sh <email> <password>"
    exit 1
fi

DOMAIN="https://iarom.com.br"
COOKIE_FILE="/tmp/rom_clean_session.txt"

echo "═══════════════════════════════════════════════"
echo "  LIMPEZA DE CACHE - DOCUMENTOS ANTIGOS"
echo "═══════════════════════════════════════════════"
echo ""
echo "⚠️  ATENÇÃO: Este script irá DELETAR documentos antigos!"
echo "   Pressione CTRL+C para cancelar ou ENTER para continuar..."
read

# 1. Login
echo ""
echo "1. Fazendo login..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "${DOMAIN}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

SUCCESS=$(echo "$LOGIN_RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" != "true" ]; then
    echo "❌ Falha no login"
    exit 1
fi

echo "✅ Login realizado"
echo ""

# 2. Listar documentos
echo "2. Listando documentos..."
DOCS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "${DOMAIN}/api/kb/documents")

# 3. Identificar documentos de EXECUÇÃO (antigos)
echo "3. Identificando documentos ANTIGOS para deletar..."
OLD_DOCS=$(echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | ascii_downcase | contains("execução") or contains("execucao") or contains("residencial") or contains("5583889")) | .id')

OLD_COUNT=$(echo "$OLD_DOCS" | wc -l)
echo "   Encontrados: $OLD_COUNT documentos antigos"
echo ""

if [ "$OLD_COUNT" -eq 0 ]; then
    echo "✅ Nenhum documento antigo encontrado. Cache limpo!"
    rm -f "$COOKIE_FILE"
    exit 0
fi

echo "   Documentos que serão deletados:"
echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | ascii_downcase | contains("execução") or contains("execucao") or contains("residencial") or contains("5583889")) | "      - \(.name) (\(.uploadedAt))"'
echo ""

echo "⚠️  Confirmar deleção de $OLD_COUNT documentos? (y/N)"
read CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "❌ Operação cancelada pelo usuário"
    rm -f "$COOKIE_FILE"
    exit 0
fi

# 4. Deletar documentos
echo ""
echo "4. Deletando documentos antigos..."
DELETED=0
while IFS= read -r DOC_ID; do
    if [ -n "$DOC_ID" ]; then
        echo "   🗑️  Deletando: $DOC_ID"
        DELETE_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X DELETE "${DOMAIN}/api/kb/documents/${DOC_ID}")

        SUCCESS=$(echo "$DELETE_RESPONSE" | jq -r '.success // false')
        if [ "$SUCCESS" == "true" ]; then
            DELETED=$((DELETED + 1))
            echo "      ✅ Deletado"
        else
            echo "      ❌ Erro: $(echo "$DELETE_RESPONSE" | jq -r '.error // "unknown"')"
        fi
    fi
done <<< "$OLD_DOCS"

echo ""
echo "5. Forçando reload do cache..."
curl -s -b "$COOKIE_FILE" -X POST "${DOMAIN}/api/kb/cache/reload" > /dev/null

echo ""
echo "═══════════════════════════════════════════════"
echo "  LIMPEZA CONCLUÍDA"
echo "═══════════════════════════════════════════════"
echo ""
echo "Documentos deletados: $DELETED de $OLD_COUNT"
echo ""

# Cleanup
rm -f "$COOKIE_FILE"
