#!/bin/bash
# Script para rodar migração extraction_jobs

set -e

echo "🔧 Executando migração extraction_jobs..."

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL não definido"
    exit 1
fi

psql "$DATABASE_URL" < db/migrations/005_create_extraction_jobs.sql

echo "✅ Migração concluída!"
