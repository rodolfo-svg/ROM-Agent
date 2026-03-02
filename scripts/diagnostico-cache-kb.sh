#!/bin/bash

# Script para diagnosticar problemas com cache do KB

EMAIL="$1"
PASSWORD="$2"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
    echo "Uso: bash scripts/diagnostico-cache-kb.sh <email> <password>"
    exit 1
fi

DOMAIN="https://iarom.com.br"
COOKIE_FILE="/tmp/rom_diag_session.txt"

echo "═══════════════════════════════════════════════"
echo "  DIAGNÓSTICO COMPLETO DO CACHE KB"
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

# 2. Listar TODOS os documentos
echo "2. Listando TODOS os documentos no KB..."
DOCS_RESPONSE=$(curl -s -b "$COOKIE_FILE" "${DOMAIN}/api/kb/documents")

TOTAL=$(echo "$DOCS_RESPONSE" | jq '.documents | length')
echo "   Total de documentos: $TOTAL"
echo ""

# 3. Últimos 20 documentos
echo "3. Últimos 20 documentos (mais recentes):"
echo "$DOCS_RESPONSE" | jq -r '.documents[-20:] | .[] | "\(.uploadedAt) - \(.name) - userId: \(.userId // "UNDEFINED") - size: \(.size) bytes"'
echo ""

# 4. Buscar arquivos de INTERDIÇÃO
echo "4. Documentos relacionados a INTERDIÇÃO:"
INTERDICAO_COUNT=$(echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | ascii_downcase | contains("interdição") or contains("interdicao")) | .name' | wc -l)
echo "   Total encontrado: $INTERDICAO_COUNT"
if [ "$INTERDICAO_COUNT" -gt 0 ]; then
    echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | ascii_downcase | contains("interdição") or contains("interdicao")) | "   ✅ \(.name) - \(.size) bytes - \(.uploadedAt)"'
else
    echo "   ❌ Nenhum documento de interdição encontrado!"
fi
echo ""

# 5. Buscar arquivos de EXECUÇÃO (antigos)
echo "5. Documentos relacionados a EXECUÇÃO (possíveis fantasmas):"
EXECUCAO_COUNT=$(echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | ascii_downcase | contains("execução") or contains("execucao") or contains("residencial")) | .name' | wc -l)
echo "   Total encontrado: $EXECUCAO_COUNT"
if [ "$EXECUCAO_COUNT" -gt 0 ]; then
    echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | ascii_downcase | contains("execução") or contains("execucao") or contains("residencial")) | "   ⚠️  \(.name) - \(.size) bytes - \(.uploadedAt)"'
fi
echo ""

# 6. Buscar 00_TEXTO_COMPLETO mais recente
echo "6. Arquivos 00_TEXTO_COMPLETO mais recentes:"
TXT_COUNT=$(echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | contains("00_TEXTO_COMPLETO")) | .name' | wc -l)
echo "   Total: $TXT_COUNT"
if [ "$TXT_COUNT" -gt 0 ]; then
    echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | contains("00_TEXTO_COMPLETO")) | "   \(.uploadedAt) - \(.name) - \(.size) bytes"' | tail -5
fi
echo ""

# 7. Buscar 05_RESUMO_EXECUTIVO mais recente
echo "7. Arquivos 05_RESUMO_EXECUTIVO mais recentes:"
RESUMO_COUNT=$(echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | contains("05_RESUMO_EXECUTIVO")) | .name' | wc -l)
echo "   Total: $RESUMO_COUNT"
if [ "$RESUMO_COUNT" -gt 0 ]; then
    echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.name | contains("05_RESUMO_EXECUTIVO")) | "   \(.uploadedAt) - \(.name) - \(.size) bytes - \(if .size > 40000 then "✅ TAMANHO OK" else "⚠️ PEQUENO" end)"' | tail -5
fi
echo ""

# 8. Documentos estruturados (fichamentos) mais recentes
echo "8. Fichamentos estruturados (últimos 10):"
STRUCT_COUNT=$(echo "$DOCS_RESPONSE" | jq '[.documents[] | select(.metadata.isStructuredDocument == true)] | length')
echo "   Total de fichamentos: $STRUCT_COUNT"
if [ "$STRUCT_COUNT" -gt 0 ]; then
    echo "$DOCS_RESPONSE" | jq -r '.documents[] | select(.metadata.isStructuredDocument == true) | "\(.uploadedAt) - \(.name)"' | tail -10
fi
echo ""

# 9. Forçar reload do cache
echo "9. Forçando reload do cache..."
RELOAD_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "${DOMAIN}/api/kb/cache/reload")
echo "$RELOAD_RESPONSE" | jq .
echo ""

# 10. Verificar novamente após reload
echo "10. Verificando total após reload..."
DOCS_AFTER=$(curl -s -b "$COOKIE_FILE" "${DOMAIN}/api/kb/documents")
TOTAL_AFTER=$(echo "$DOCS_AFTER" | jq '.documents | length')
echo "   Total após reload: $TOTAL_AFTER"
echo ""

# 11. Validar se há documentos "ghost" (no cache mas não no disco)
echo "11. Verificando documentos ghost (validação de arquivos)..."
VALIDATE_RESPONSE=$(curl -s -b "$COOKIE_FILE" "${DOMAIN}/api/kb/validate")
echo "$VALIDATE_RESPONSE" | jq .
echo ""

# Cleanup
rm -f "$COOKIE_FILE"

echo "═══════════════════════════════════════════════"
echo "  DIAGNÓSTICO CONCLUÍDO"
echo "═══════════════════════════════════════════════"
echo ""
echo "RESUMO:"
echo "  - Total de documentos: $TOTAL"
echo "  - Documentos de interdição: $INTERDICAO_COUNT"
echo "  - Documentos de execução (antigos): $EXECUCAO_COUNT"
echo "  - Texto completo: $TXT_COUNT"
echo "  - Resumo executivo: $RESUMO_COUNT"
echo "  - Fichamentos: $STRUCT_COUNT"
echo ""

if [ "$INTERDICAO_COUNT" -eq 0 ]; then
    echo "⚠️  ATENÇÃO: Nenhum documento de interdição encontrado!"
    echo "   Possível causa: Extração ainda não finalizada ou userId incorreto"
fi

if [ "$EXECUCAO_COUNT" -gt 3 ]; then
    echo "⚠️  ATENÇÃO: Muitos documentos antigos de execução no cache"
    echo "   Recomendação: Limpar documentos antigos"
fi
