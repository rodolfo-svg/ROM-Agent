#!/bin/bash

# Script para rodar a migração extraction_jobs em produção
# Uso: ./scripts/run-migration.sh

set -e

echo "🔧 ROM-Agent - Migração extraction_jobs"
echo "========================================="
echo ""

# Verificar se DATABASE_URL está definido
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erro: DATABASE_URL não está definido"
    echo "   Configure com: export DATABASE_URL='postgresql://...'"
    exit 1
fi

echo "✅ DATABASE_URL configurado"
echo ""

# Verificar se arquivo de migração existe
MIGRATION_FILE="db/migrations/005_create_extraction_jobs.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Erro: Arquivo de migração não encontrado: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Arquivo de migração encontrado"
echo ""

# Verificar se tabela já existe
echo "🔍 Verificando se tabela extraction_jobs já existe..."
if psql "$DATABASE_URL" -t -c "SELECT to_regclass('public.extraction_jobs');" 2>/dev/null | grep -q "extraction_jobs"; then
    echo "⚠️  Tabela extraction_jobs já existe!"
    echo ""
    read -p "Deseja recriar a tabela? (ATENÇÃO: Isso apagará todos os dados) [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Migração cancelada pelo usuário"
        exit 0
    fi

    echo "🗑️  Deletando tabela existente..."
    psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS extraction_jobs CASCADE;" || {
        echo "❌ Erro ao deletar tabela"
        exit 1
    }
    echo "✅ Tabela deletada"
    echo ""
fi

# Executar migração
echo "🚀 Executando migração..."
psql "$DATABASE_URL" < "$MIGRATION_FILE" || {
    echo "❌ Erro ao executar migração"
    exit 1
}

echo ""
echo "✅ Migração executada com sucesso!"
echo ""

# Verificar tabela criada
echo "🔍 Verificando tabela criada..."
psql "$DATABASE_URL" -c "\d extraction_jobs" || {
    echo "❌ Erro: Tabela não foi criada corretamente"
    exit 1
}

echo ""
echo "✅ Tabela extraction_jobs criada e verificada!"
echo ""

# Verificar índices
echo "📊 Verificando índices..."
psql "$DATABASE_URL" -c "
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'extraction_jobs'
    ORDER BY indexname;
" || {
    echo "⚠️  Aviso: Não foi possível verificar índices"
}

echo ""
echo "🎉 Migração concluída com sucesso!"
echo ""
echo "Próximos passos:"
echo "1. Reinicie o servidor: pm2 restart rom-agent"
echo "2. Verifique logs: pm2 logs rom-agent"
echo "3. Teste a API: curl https://iarom.com.br/api/extraction-jobs/active"
echo ""
