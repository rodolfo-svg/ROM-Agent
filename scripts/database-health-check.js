#!/usr/bin/env node

/**
 * DATABASE HEALTH CHECK SERVICE
 * ROM-Agent PostgreSQL Performance Monitor
 *
 * Features:
 * - Connection pool metrics
 * - Query latency measurement
 * - Index usage statistics
 * - Table size and bloat analysis
 * - Slow query detection
 *
 * Usage:
 *   node scripts/database-health-check.js
 *   node scripts/database-health-check.js --json
 *   node scripts/database-health-check.js --continuous
 */

import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  // Thresholds for health status
  thresholds: {
    latency: {
      excellent: 10,   // < 10ms
      good: 25,        // < 25ms
      warning: 50,     // < 50ms (p95 target)
      critical: 100    // > 100ms
    },
    poolUsage: {
      warning: 0.7,    // 70% pool utilization
      critical: 0.9    // 90% pool utilization
    },
    connections: {
      warning: 15,
      critical: 18
    }
  },
  // Sample query for latency testing
  testQueries: [
    { name: 'simple_select', sql: 'SELECT 1' },
    { name: 'now', sql: 'SELECT NOW()' },
    { name: 'table_exists', sql: "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'conversations')" }
  ]
};

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function getStatusColor(status) {
  switch (status) {
    case 'excellent': return 'green';
    case 'good': return 'cyan';
    case 'warning': return 'yellow';
    case 'critical': return 'red';
    default: return 'white';
  }
}

function getLatencyStatus(ms) {
  if (ms < CONFIG.thresholds.latency.excellent) return 'excellent';
  if (ms < CONFIG.thresholds.latency.good) return 'good';
  if (ms < CONFIG.thresholds.latency.warning) return 'warning';
  return 'critical';
}

/**
 * Database Health Checker
 */
class DatabaseHealthChecker {
  constructor() {
    this.pool = null;
    this.metrics = {
      timestamp: new Date().toISOString(),
      connection: null,
      pool: null,
      latency: null,
      indexes: null,
      tables: null,
      slowQueries: null,
      overall: null
    };
  }

  async connect() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    this.pool = new pg.Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      application_name: 'ROM-Agent-HealthCheck'
    });

    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async checkConnection() {
    const start = Date.now();
    try {
      const result = await this.pool.query('SELECT version()');
      const latency = Date.now() - start;

      this.metrics.connection = {
        status: 'connected',
        latency: latency,
        version: result.rows[0].version.split(' ').slice(0, 2).join(' ')
      };
    } catch (error) {
      this.metrics.connection = {
        status: 'failed',
        error: error.message
      };
    }
  }

  async checkPoolMetrics() {
    try {
      const poolStats = {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      };

      const activeConnections = poolStats.totalCount - poolStats.idleCount;
      const utilization = poolStats.totalCount > 0
        ? activeConnections / this.pool.options.max
        : 0;

      let status = 'healthy';
      if (utilization >= CONFIG.thresholds.poolUsage.critical) {
        status = 'critical';
      } else if (utilization >= CONFIG.thresholds.poolUsage.warning) {
        status = 'warning';
      }

      this.metrics.pool = {
        status,
        total: poolStats.totalCount,
        idle: poolStats.idleCount,
        active: activeConnections,
        waiting: poolStats.waitingCount,
        max: this.pool.options.max,
        utilization: (utilization * 100).toFixed(1) + '%'
      };
    } catch (error) {
      this.metrics.pool = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkLatency() {
    const results = [];
    const samples = 5;

    for (const query of CONFIG.testQueries) {
      const latencies = [];

      for (let i = 0; i < samples; i++) {
        const start = Date.now();
        await this.pool.query(query.sql);
        latencies.push(Date.now() - start);
      }

      // Calculate statistics
      latencies.sort((a, b) => a - b);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const min = latencies[0];
      const max = latencies[latencies.length - 1];
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];

      results.push({
        query: query.name,
        samples,
        min,
        max,
        avg: parseFloat(avg.toFixed(2)),
        p50,
        p95,
        status: getLatencyStatus(p95)
      });
    }

    // Overall latency assessment
    const worstP95 = Math.max(...results.map(r => r.p95));

    this.metrics.latency = {
      status: getLatencyStatus(worstP95),
      worstP95,
      meetsTarget: worstP95 < CONFIG.thresholds.latency.warning,
      queries: results
    };
  }

  async checkIndexUsage() {
    try {
      const result = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          pg_size_pretty(pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(indexname))) as size
        FROM pg_stat_user_indexes
        WHERE indexname LIKE 'idx_%'
        ORDER BY idx_scan DESC
        LIMIT 20
      `);

      // Check for unused indexes
      const unusedResult = await this.pool.query(`
        SELECT
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(indexname))) as size
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
          AND indexname NOT LIKE '%_pkey'
          AND indexname NOT LIKE '%_unique'
        ORDER BY pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(indexname)) DESC
        LIMIT 10
      `);

      this.metrics.indexes = {
        status: unusedResult.rows.length > 5 ? 'warning' : 'healthy',
        active: result.rows,
        unused: unusedResult.rows,
        unusedCount: unusedResult.rows.length
      };
    } catch (error) {
      this.metrics.indexes = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkTableStats() {
    try {
      const result = await this.pool.query(`
        SELECT
          schemaname,
          relname as table_name,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze,
          pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))) as total_size,
          CASE
            WHEN n_live_tup > 0 THEN ROUND((n_dead_tup::float / n_live_tup) * 100, 2)
            ELSE 0
          END as dead_tuple_ratio
        FROM pg_stat_user_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) DESC
        LIMIT 20
      `);

      // Check for tables needing vacuum
      const needsVacuum = result.rows.filter(r => r.dead_tuple_ratio > 10);

      this.metrics.tables = {
        status: needsVacuum.length > 3 ? 'warning' : 'healthy',
        stats: result.rows,
        needsVacuum: needsVacuum.length
      };
    } catch (error) {
      this.metrics.tables = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkSlowQueries() {
    try {
      // Check if pg_stat_statements extension is available
      const extResult = await this.pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) as exists
      `);

      if (!extResult.rows[0].exists) {
        this.metrics.slowQueries = {
          status: 'unavailable',
          message: 'pg_stat_statements extension not installed'
        };
        return;
      }

      const result = await this.pool.query(`
        SELECT
          substring(query, 1, 100) as query_preview,
          calls,
          ROUND(mean_exec_time::numeric, 2) as mean_time_ms,
          ROUND(max_exec_time::numeric, 2) as max_time_ms,
          ROUND(total_exec_time::numeric, 2) as total_time_ms,
          rows
        FROM pg_stat_statements
        WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
          AND mean_exec_time > 10
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);

      const slowCount = result.rows.filter(r => r.mean_time_ms > 50).length;

      this.metrics.slowQueries = {
        status: slowCount > 5 ? 'warning' : 'healthy',
        queries: result.rows,
        slowCount
      };
    } catch (error) {
      this.metrics.slowQueries = {
        status: 'error',
        error: error.message
      };
    }
  }

  calculateOverallHealth() {
    const statuses = [
      this.metrics.connection?.status === 'connected' ? 'excellent' : 'critical',
      this.metrics.pool?.status || 'critical',
      this.metrics.latency?.status || 'critical',
      this.metrics.indexes?.status || 'warning',
      this.metrics.tables?.status || 'warning'
    ];

    const statusPriority = { critical: 0, warning: 1, healthy: 2, good: 3, excellent: 4 };
    const worstStatus = statuses.reduce((worst, current) => {
      const currentNormalized = current === 'healthy' ? 'good' : current;
      const worstNormalized = worst === 'healthy' ? 'good' : worst;
      return (statusPriority[currentNormalized] || 0) < (statusPriority[worstNormalized] || 0)
        ? currentNormalized
        : worstNormalized;
    }, 'excellent');

    this.metrics.overall = {
      status: worstStatus,
      meetsP95Target: this.metrics.latency?.meetsTarget || false,
      timestamp: this.metrics.timestamp
    };
  }

  async runAllChecks() {
    await this.checkConnection();
    await this.checkPoolMetrics();
    await this.checkLatency();
    await this.checkIndexUsage();
    await this.checkTableStats();
    await this.checkSlowQueries();
    this.calculateOverallHealth();
  }

  printReport() {
    console.log('\n' + colorize('═'.repeat(70), 'cyan'));
    console.log(colorize('  DATABASE HEALTH CHECK REPORT', 'bold'));
    console.log(colorize('  ROM-Agent PostgreSQL Performance Monitor', 'cyan'));
    console.log(colorize('═'.repeat(70), 'cyan'));

    // Overall Status
    const overallColor = getStatusColor(this.metrics.overall.status);
    console.log('\n' + colorize('OVERALL STATUS: ', 'bold') +
      colorize(this.metrics.overall.status.toUpperCase(), overallColor));
    console.log(`P95 Target (< 50ms): ${this.metrics.overall.meetsP95Target ? colorize('PASS', 'green') : colorize('FAIL', 'red')}`);

    // Connection Info
    console.log('\n' + colorize('── CONNECTION ──', 'magenta'));
    if (this.metrics.connection.status === 'connected') {
      console.log(`Status: ${colorize('Connected', 'green')}`);
      console.log(`Latency: ${this.metrics.connection.latency}ms`);
      console.log(`Version: ${this.metrics.connection.version}`);
    } else {
      console.log(`Status: ${colorize('FAILED', 'red')}`);
      console.log(`Error: ${this.metrics.connection.error}`);
    }

    // Pool Metrics
    console.log('\n' + colorize('── POOL METRICS ──', 'magenta'));
    const pool = this.metrics.pool;
    console.log(`Status: ${colorize(pool.status.toUpperCase(), getStatusColor(pool.status))}`);
    console.log(`Connections: ${pool.active}/${pool.max} active (${pool.utilization} utilization)`);
    console.log(`Idle: ${pool.idle} | Waiting: ${pool.waiting}`);

    // Latency Report
    console.log('\n' + colorize('── QUERY LATENCY ──', 'magenta'));
    console.log(`Status: ${colorize(this.metrics.latency.status.toUpperCase(), getStatusColor(this.metrics.latency.status))}`);
    console.log(`Worst P95: ${this.metrics.latency.worstP95}ms`);
    console.log('\nQuery Latencies:');
    for (const q of this.metrics.latency.queries) {
      const statusIcon = q.status === 'excellent' ? '+' : q.status === 'good' ? '+' : q.status === 'warning' ? '!' : 'X';
      console.log(`  [${statusIcon}] ${q.query}: avg=${q.avg}ms, p50=${q.p50}ms, p95=${q.p95}ms`);
    }

    // Index Stats
    console.log('\n' + colorize('── INDEX USAGE ──', 'magenta'));
    console.log(`Status: ${colorize(this.metrics.indexes.status.toUpperCase(), getStatusColor(this.metrics.indexes.status))}`);
    console.log(`Unused indexes: ${this.metrics.indexes.unusedCount}`);
    if (this.metrics.indexes.active.length > 0) {
      console.log('\nTop Active Indexes:');
      for (const idx of this.metrics.indexes.active.slice(0, 5)) {
        console.log(`  ${idx.indexname}: ${idx.scans} scans, ${idx.size}`);
      }
    }

    // Table Stats
    console.log('\n' + colorize('── TABLE STATS ──', 'magenta'));
    console.log(`Status: ${colorize(this.metrics.tables.status.toUpperCase(), getStatusColor(this.metrics.tables.status))}`);
    console.log(`Tables needing vacuum: ${this.metrics.tables.needsVacuum}`);
    if (this.metrics.tables.stats.length > 0) {
      console.log('\nLargest Tables:');
      for (const tbl of this.metrics.tables.stats.slice(0, 5)) {
        console.log(`  ${tbl.table_name}: ${tbl.total_size} (${tbl.live_tuples} rows, ${tbl.dead_tuple_ratio}% dead)`);
      }
    }

    // Slow Queries
    console.log('\n' + colorize('── SLOW QUERIES ──', 'magenta'));
    if (this.metrics.slowQueries.status === 'unavailable') {
      console.log(`Status: ${colorize('UNAVAILABLE', 'yellow')} - ${this.metrics.slowQueries.message}`);
    } else if (this.metrics.slowQueries.status === 'error') {
      console.log(`Status: ${colorize('ERROR', 'red')} - ${this.metrics.slowQueries.error}`);
    } else {
      console.log(`Status: ${colorize(this.metrics.slowQueries.status.toUpperCase(), getStatusColor(this.metrics.slowQueries.status))}`);
      console.log(`Slow queries (> 50ms avg): ${this.metrics.slowQueries.slowCount}`);
    }

    console.log('\n' + colorize('═'.repeat(70), 'cyan'));
    console.log(`Report generated at: ${this.metrics.timestamp}`);
    console.log(colorize('═'.repeat(70), 'cyan') + '\n');
  }

  getJsonReport() {
    return JSON.stringify(this.metrics, null, 2);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const continuous = args.includes('--continuous');
  const interval = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '30') * 1000;

  // Load environment variables if dotenv is available
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: join(__dirname, '..', '.env') });
  } catch (e) {
    // dotenv not available, continue
  }

  const checker = new DatabaseHealthChecker();

  try {
    await checker.connect();

    const runCheck = async () => {
      await checker.runAllChecks();

      if (jsonOutput) {
        console.log(checker.getJsonReport());
      } else {
        checker.printReport();
      }

      return checker.metrics.overall.status !== 'critical';
    };

    if (continuous) {
      console.log(`Starting continuous health monitoring (interval: ${interval / 1000}s)`);
      console.log('Press Ctrl+C to stop\n');

      while (true) {
        await runCheck();
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } else {
      const healthy = await runCheck();
      await checker.disconnect();
      process.exit(healthy ? 0 : 1);
    }
  } catch (error) {
    console.error(colorize('ERROR: ' + error.message, 'red'));
    await checker.disconnect();
    process.exit(1);
  }
}

main().catch(console.error);

export default DatabaseHealthChecker;
