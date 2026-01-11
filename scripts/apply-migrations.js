#!/usr/bin/env node
/**
 * APPLY DATABASE MIGRATIONS
 * ROM-Agent Performance Optimization Migrations
 *
 * Applies migrations 005 and 006 for performance optimization:
 * - 005_performance_indexes.sql: Creates critical indexes
 * - 006_query_optimization.sql: Materialized views and functions
 *
 * Usage:
 *   node scripts/apply-migrations.js
 *   node scripts/apply-migrations.js --dry-run
 *   node scripts/apply-migrations.js --skip-concurrent
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load dotenv if available
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv not available
}

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(title) {
  console.log('');
  log('='.repeat(70), 'cyan');
  log(`  ${title}`, 'bold');
  log('='.repeat(70), 'cyan');
  console.log('');
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipConcurrent = args.includes('--skip-concurrent');
const verbose = args.includes('--verbose');

// Migrations to apply
const MIGRATIONS = [
  '005_performance_indexes.sql',
  '006_query_optimization.sql'
];

class MigrationRunner {
  constructor() {
    this.client = null;
    this.migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
  }

  async connect() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      return false;
    }

    const config = {
      connectionString,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      application_name: 'ROM-Agent-Migration'
    };

    this.client = new pg.Client(config);
    await this.client.connect();
    return true;
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async ensureMigrationTable() {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        success BOOLEAN DEFAULT true,
        duration_ms INTEGER
      )
    `);
  }

  async isMigrationApplied(version) {
    const result = await this.client.query(
      'SELECT version FROM schema_migrations WHERE version = $1 AND success = true',
      [version]
    );
    return result.rows.length > 0;
  }

  async recordMigration(version, durationMs) {
    await this.client.query(
      `INSERT INTO schema_migrations (version, executed_at, success, duration_ms)
       VALUES ($1, NOW(), true, $2)
       ON CONFLICT (version) DO UPDATE SET
         executed_at = NOW(),
         success = true,
         duration_ms = $2`,
      [version, durationMs]
    );
  }

  preprocessSql(sql) {
    let processed = sql;

    // If --skip-concurrent flag is set, remove CONCURRENTLY keyword
    // This is useful for running inside transactions or for initial setup
    if (skipConcurrent) {
      processed = processed.replace(/CONCURRENTLY\s+/gi, '');
    }

    return processed;
  }

  async applyMigration(filename) {
    const filepath = path.join(this.migrationsDir, filename);
    const version = filename.replace('.sql', '');

    if (!fs.existsSync(filepath)) {
      log(`  [SKIP] ${filename} - file not found`, 'yellow');
      return { status: 'not_found', filename };
    }

    // Check if already applied
    if (await this.isMigrationApplied(version)) {
      log(`  [SKIP] ${filename} - already applied`, 'cyan');
      return { status: 'skipped', filename };
    }

    // Read and preprocess SQL
    let sql = fs.readFileSync(filepath, 'utf8');
    sql = this.preprocessSql(sql);

    if (dryRun) {
      log(`  [DRY-RUN] ${filename} - would apply`, 'yellow');
      if (verbose) {
        console.log('    SQL Preview (first 500 chars):');
        console.log('    ' + sql.substring(0, 500).replace(/\n/g, '\n    '));
      }
      return { status: 'dry_run', filename };
    }

    // Apply migration
    log(`  [APPLYING] ${filename}...`, 'blue');
    const startTime = Date.now();

    try {
      // For migrations with CONCURRENTLY, we need to run outside transaction
      // Split by semicolons and run each statement
      const statements = sql
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.length > 0) {
          try {
            await this.client.query(statement);
          } catch (stmtError) {
            // Ignore "already exists" errors for indexes and views
            if (stmtError.code === '42P07' || // relation already exists
                stmtError.code === '42710' || // object already exists
                stmtError.message.includes('already exists')) {
              if (verbose) {
                log(`    [INFO] Object already exists, continuing...`, 'yellow');
              }
            } else {
              throw stmtError;
            }
          }
        }
      }

      const durationMs = Date.now() - startTime;
      await this.recordMigration(version, durationMs);
      log(`  [SUCCESS] ${filename} - completed in ${durationMs}ms`, 'green');
      return { status: 'applied', filename, durationMs };
    } catch (error) {
      log(`  [FAILED] ${filename} - ${error.message}`, 'red');
      if (verbose) {
        console.error('    Error details:', error);
      }
      return { status: 'failed', filename, error: error.message };
    }
  }

  async listIndexes() {
    const result = await this.client.query(`
      SELECT
        indexname,
        tablename,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `);
    return result.rows;
  }

  async listMaterializedViews() {
    const result = await this.client.query(`
      SELECT
        matviewname as name,
        definition
      FROM pg_matviews
      WHERE schemaname = 'public'
      ORDER BY matviewname
    `);
    return result.rows;
  }

  async listFunctions() {
    const result = await this.client.query(`
      SELECT
        proname as name,
        pg_get_function_arguments(oid) as arguments
      FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('refresh_conversation_stats', 'get_user_conversations', 'get_conversation_with_messages')
      ORDER BY proname
    `);
    return result.rows;
  }

  async verifyMigrations() {
    logHeader('VERIFICATION');

    log('Indexes created:', 'cyan');
    const indexes = await this.listIndexes();
    if (indexes.length === 0) {
      log('  No custom indexes found', 'yellow');
    } else {
      for (const idx of indexes) {
        log(`  [OK] ${idx.indexname} on ${idx.tablename}`, 'green');
      }
    }

    console.log('');
    log('Materialized Views:', 'cyan');
    const views = await this.listMaterializedViews();
    if (views.length === 0) {
      log('  No materialized views found', 'yellow');
    } else {
      for (const view of views) {
        log(`  [OK] ${view.name}`, 'green');
      }
    }

    console.log('');
    log('Functions:', 'cyan');
    const functions = await this.listFunctions();
    if (functions.length === 0) {
      log('  No optimization functions found', 'yellow');
    } else {
      for (const fn of functions) {
        log(`  [OK] ${fn.name}(${fn.arguments})`, 'green');
      }
    }

    return {
      indexes: indexes.length,
      views: views.length,
      functions: functions.length
    };
  }
}

async function main() {
  logHeader('DATABASE MIGRATIONS - ROM-Agent');

  if (dryRun) {
    log('Running in DRY-RUN mode - no changes will be made', 'yellow');
    console.log('');
  }

  if (skipConcurrent) {
    log('CONCURRENTLY keyword will be removed from CREATE INDEX statements', 'yellow');
    console.log('');
  }

  const runner = new MigrationRunner();

  // Check if migrations exist
  log('Checking migration files...', 'blue');
  for (const migration of MIGRATIONS) {
    const filepath = path.join(runner.migrationsDir, migration);
    if (fs.existsSync(filepath)) {
      log(`  [OK] ${migration}`, 'green');
    } else {
      log(`  [MISSING] ${migration}`, 'red');
    }
  }
  console.log('');

  // Try to connect
  log('Connecting to database...', 'blue');
  try {
    const connected = await runner.connect();

    if (!connected) {
      logHeader('DATABASE NOT CONFIGURED');
      log('DATABASE_URL environment variable is not set.', 'yellow');
      console.log('');
      log('To apply migrations manually:', 'cyan');
      console.log('');
      log('1. Set DATABASE_URL:', 'white');
      console.log('   export DATABASE_URL="postgresql://user:pass@host:5432/dbname"');
      console.log('');
      log('2. Run this script again:', 'white');
      console.log('   node scripts/apply-migrations.js');
      console.log('');
      log('3. Or apply manually with psql:', 'white');
      console.log('   psql $DATABASE_URL -f database/migrations/005_performance_indexes.sql');
      console.log('   psql $DATABASE_URL -f database/migrations/006_query_optimization.sql');
      console.log('');

      // Create documentation file
      const docPath = path.join(runner.migrationsDir, 'MANUAL_EXECUTION.md');
      const docContent = `# Manual Migration Execution

## Migrations to Apply
- 005_performance_indexes.sql - Creates performance indexes
- 006_query_optimization.sql - Materialized views and functions

## Using psql
\`\`\`bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
psql $DATABASE_URL -f database/migrations/005_performance_indexes.sql
psql $DATABASE_URL -f database/migrations/006_query_optimization.sql
\`\`\`

## Using this script
\`\`\`bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
node scripts/apply-migrations.js
\`\`\`

## Verification
After applying, verify with:
\`\`\`sql
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
SELECT matviewname FROM pg_matviews WHERE schemaname = 'public';
\`\`\`

## Notes
- Migration 005 uses CONCURRENTLY for indexes (requires no transaction)
- If running inside a transaction, use: node scripts/apply-migrations.js --skip-concurrent
- For dry-run mode: node scripts/apply-migrations.js --dry-run

Generated: ${new Date().toISOString()}
`;
      fs.writeFileSync(docPath, docContent);
      log(`Documentation written to: ${docPath}`, 'green');
      console.log('');

      process.exit(0);
    }

    log('  [OK] Connected to PostgreSQL', 'green');

    // Get version info
    const versionResult = await runner.client.query('SELECT version()');
    const version = versionResult.rows[0].version.split(' ').slice(0, 2).join(' ');
    log(`  [OK] ${version}`, 'cyan');
    console.log('');

    // Ensure migration tracking table exists
    await runner.ensureMigrationTable();
    log('Migration tracking table ready', 'green');
    console.log('');

    // Apply migrations
    logHeader('APPLYING MIGRATIONS');

    const results = [];
    for (const migration of MIGRATIONS) {
      const result = await runner.applyMigration(migration);
      results.push(result);
    }

    // Summary
    logHeader('SUMMARY');

    const applied = results.filter(r => r.status === 'applied').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const dryRunCount = results.filter(r => r.status === 'dry_run').length;

    log(`Applied: ${applied}`, applied > 0 ? 'green' : 'white');
    log(`Skipped: ${skipped}`, 'cyan');
    if (failed > 0) {
      log(`Failed: ${failed}`, 'red');
    }
    if (dryRunCount > 0) {
      log(`Dry-run: ${dryRunCount}`, 'yellow');
    }
    console.log('');

    // Verify if not dry-run
    if (!dryRun) {
      const verification = await runner.verifyMigrations();

      console.log('');
      logHeader('MIGRATION STATUS');

      if (verification.indexes > 0 || verification.views > 0) {
        log('SUCCESS - Performance optimizations applied', 'green');
        console.log('');
        log('Next steps:', 'cyan');
        console.log('  1. Run health check: node scripts/database-health-check.js');
        console.log('  2. Run performance tests: npm test -- tests/database-performance.test.js');
        console.log('  3. Monitor query performance in production');
      } else if (failed > 0) {
        log('PARTIAL FAILURE - Some migrations failed', 'red');
        console.log('');
        log('Check error messages above and retry', 'yellow');
      } else {
        log('NO CHANGES - All migrations already applied', 'cyan');
      }
    }

    await runner.disconnect();
    log('Connection closed', 'cyan');

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    log(`Connection failed: ${error.message}`, 'red');
    if (verbose) {
      console.error(error);
    }
    await runner.disconnect();
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
