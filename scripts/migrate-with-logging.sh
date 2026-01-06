#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# MIGRATION WRAPPER - Garante logs visíveis e não bloqueia startup
# ═══════════════════════════════════════════════════════════════

set -e

echo ""
echo "═════════════════════════════════════════════════════════════"
echo "🗄️  INICIANDO PROCESSO DE MIGRATIONS"
echo "═════════════════════════════════════════════════════════════"
echo ""

# Verificar se DATABASE_URL existe
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL não está configurado!"
  echo "   Verifique as variáveis de ambiente no Render Dashboard"
  echo "   As migrations NÃO serão executadas"
  echo ""
  echo "⚠️  SERVIDOR CONTINUARÁ SEM BANCO DE DADOS"
  echo ""
  exit 0  # Exit com sucesso para não bloquear o servidor
fi

echo "✅ DATABASE_URL encontrado"
echo "   Host: $(echo $DATABASE_URL | sed -E 's/.*@([^:\/]+).*/\1/')"
echo ""

# Executar migrations
echo "🔨 Executando: node scripts/run-migrations.js"
echo ""

if node scripts/run-migrations.js; then
  echo ""
  echo "═════════════════════════════════════════════════════════════"
  echo "✅ MIGRATIONS CONCLUÍDAS COM SUCESSO"
  echo "═════════════════════════════════════════════════════════════"
  echo ""
  exit 0
else
  EXIT_CODE=$?
  echo ""
  echo "═════════════════════════════════════════════════════════════"
  echo "❌ ERRO AO EXECUTAR MIGRATIONS (Exit code: $EXIT_CODE)"
  echo "═════════════════════════════════════════════════════════════"
  echo ""
  echo "Possíveis causas:"
  echo "  1. DATABASE_URL inválido"
  echo "  2. PostgreSQL não acessível"
  echo "  3. Erro de sintaxe SQL"
  echo "  4. Falta de permissões"
  echo ""
  echo "⚠️  SERVIDOR CONTINUARÁ (modo degradado)"
  echo ""
  exit 0  # Exit com sucesso para não bloquear o servidor
fi
