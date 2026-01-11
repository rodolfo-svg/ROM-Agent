# Manual Migration Execution

## Migrations to Apply
- 005_performance_indexes.sql - Creates performance indexes
- 006_query_optimization.sql - Materialized views and functions

## Using psql
```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
psql $DATABASE_URL -f database/migrations/005_performance_indexes.sql
psql $DATABASE_URL -f database/migrations/006_query_optimization.sql
```

## Using this script
```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
node scripts/apply-migrations.js
```

## Verification
After applying, verify with:
```sql
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';
```

## Notes
- Migration 005 uses CONCURRENTLY for indexes (requires no transaction)
- If running inside a transaction, use: node scripts/apply-migrations.js --skip-concurrent
- For dry-run mode: node scripts/apply-migrations.js --dry-run

Generated: 2026-01-11T09:17:17.217Z
