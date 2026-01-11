# Database Migrations Execution Report

## WS6: DATABASE MIGRATIONS EXECUTION

**Date:** 2026-01-11
**Status:** READY FOR EXECUTION (Database not configured locally)

---

## Summary

The database performance migrations have been prepared and validated. Since DATABASE_URL is not configured in the local environment, the migrations are documented for manual execution when the database is available.

---

## Migrations Created

### 005_performance_indexes.sql
Creates critical indexes for query optimization:
- `idx_conversations_user_updated` - Composite index for user conversation listing
- `idx_conversations_active` - Partial index for non-archived conversations
- `idx_messages_conversation_created` - Index for message ordering
- `idx_messages_role` - Index for message role filtering
- `idx_documents_case_id` - Index for document lookups
- `idx_documents_type` - Index for document type filtering
- `idx_users_email` - Index for user email lookups
- `idx_users_created_at` - Index for user listing by date

### 006_query_optimization.sql
Advanced query optimization:
- `mv_conversation_stats` - Materialized view for conversation statistics
- `refresh_conversation_stats()` - Function to refresh materialized view
- `get_user_conversations()` - Optimized function for paginated conversation retrieval
- `get_conversation_with_messages()` - Function to get conversation with messages

---

## Scripts Created

### scripts/apply-migrations.js
New migration runner with features:
- Automatic DATABASE_URL detection
- Dry-run mode (`--dry-run`)
- Skip CONCURRENTLY mode (`--skip-concurrent`)
- Migration tracking in `schema_migrations` table
- Verification of created objects
- Documentation generation when DB not available

### scripts/database-health-check.js
Health check service with:
- Connection pool metrics
- Query latency measurement (p95 target: <50ms)
- Index usage statistics
- Table size and bloat analysis
- Slow query detection
- JSON output mode (`--json`)
- Continuous monitoring mode (`--continuous`)

### tests/database-performance.test.js
Performance test suite using Node.js native test runner:
- Connection performance tests
- Query latency measurements
- Index verification
- Pool configuration validation
- Query optimization validation
- Stress tests
- Error handling tests
- Automatic skip when DATABASE_URL not set

---

## How to Execute Migrations

### Option 1: Using apply-migrations.js (Recommended)
```bash
# Set database URL
export DATABASE_URL="postgresql://user:password@host:5432/database"

# Dry run first
node scripts/apply-migrations.js --dry-run

# Apply migrations
node scripts/apply-migrations.js

# Apply without CONCURRENTLY (for transaction contexts)
node scripts/apply-migrations.js --skip-concurrent
```

### Option 2: Using psql directly
```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
psql $DATABASE_URL -f database/migrations/005_performance_indexes.sql
psql $DATABASE_URL -f database/migrations/006_query_optimization.sql
```

### Option 3: Using existing run-migrations.js
The existing migration runner at `scripts/run-migrations.js` can also be used but reads from `/migrations/` directory.

---

## Verification Queries

### List created indexes
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

### Check materialized views
```sql
SELECT matviewname, definition
FROM pg_matviews
WHERE schemaname = 'public';
```

### Check functions
```sql
SELECT proname, pg_get_function_arguments(oid)
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('refresh_conversation_stats', 'get_user_conversations', 'get_conversation_with_messages');
```

### Test index usage with EXPLAIN ANALYZE
```sql
EXPLAIN ANALYZE
SELECT * FROM conversations
WHERE user_id = 'some-uuid'
  AND archived_at IS NULL
ORDER BY updated_at DESC
LIMIT 20;
```

---

## How to Run Health Check

```bash
# Set database URL
export DATABASE_URL="postgresql://..."

# Run health check
node scripts/database-health-check.js

# JSON output
node scripts/database-health-check.js --json

# Continuous monitoring (every 30s)
node scripts/database-health-check.js --continuous --interval=30
```

---

## How to Run Performance Tests

```bash
# Set database URL
export DATABASE_URL="postgresql://..."

# Run tests
node --test tests/database-performance.test.js
```

---

## Execution Results (Local Environment)

Since DATABASE_URL is not configured locally:

1. **apply-migrations.js**: Ran successfully, generated documentation
2. **database-health-check.js**: Exits with error "DATABASE_URL not set"
3. **database-performance.test.js**: All tests skipped with message

---

## Success Criteria Status

| Criteria | Status |
|----------|--------|
| Migrations aplicadas OU documentadas | DOCUMENTED |
| Health check rodando | READY (needs DATABASE_URL) |
| Performance tests criados | COMPLETED |
| Documentacao de execucao | COMPLETED |

---

## Files Modified/Created

### Created
- `/scripts/apply-migrations.js` - New migration runner
- `/database/migrations/MANUAL_EXECUTION.md` - Quick reference
- `/database/migrations/MIGRATION_EXECUTION_REPORT.md` - This report

### Modified
- `/tests/database-performance.test.js` - Converted to Node.js native test runner

### Existing (No changes needed)
- `/database/migrations/005_performance_indexes.sql`
- `/database/migrations/006_query_optimization.sql`
- `/scripts/database-health-check.js`

---

## Next Steps for Production

1. Configure `DATABASE_URL` environment variable
2. Run `node scripts/apply-migrations.js --dry-run` to verify
3. Run `node scripts/apply-migrations.js` to apply migrations
4. Run `node scripts/database-health-check.js` to verify health
5. Run `node --test tests/database-performance.test.js` to validate performance
6. Monitor p95 latency target (<50ms)

---

## Notes

- Migration 005 uses `CREATE INDEX CONCURRENTLY` which cannot run inside a transaction block
- If applying in a transaction context (e.g., some migration frameworks), use `--skip-concurrent` flag
- The materialized view `mv_conversation_stats` should be refreshed periodically via `refresh_conversation_stats()`
- Consider setting up a cron job or application trigger to refresh the materialized view

---

*Generated by WS6 Database Migrations Execution workflow*
