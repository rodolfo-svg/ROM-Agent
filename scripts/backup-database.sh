#!/bin/bash
# ROM Agent - Backup Automatizado de Database

set -e

BACKUP_DIR="$HOME/ROM-Agent-Backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="${POSTGRES_DB:-rom_agent}"
DB_USER="${POSTGRES_USER:-postgres}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando backup do database..."

# Backup PostgreSQL
if command -v pg_dump &> /dev/null; then
  pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_DIR/postgres_${DATE}.sql.gz"
  echo "[$(date)] ✅ Backup PostgreSQL: $BACKUP_DIR/postgres_${DATE}.sql.gz"
else
  echo "[$(date)] ⚠️  pg_dump não encontrado, pulando backup PostgreSQL"
fi

# Limpar backups antigos (manter últimos 7 dias)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "[$(date)] ✅ Backups antigos limpos"

echo "[$(date)] ✅ Backup concluído com sucesso"
