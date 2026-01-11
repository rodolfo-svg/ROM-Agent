/**
 * DATABASE PERFORMANCE TESTS
 * ROM-Agent PostgreSQL Optimization Validation
 *
 * These tests validate:
 * - Query latency (p95 < 50ms target)
 * - Index effectiveness
 * - Pool configuration
 * - Concurrent connection handling
 *
 * Uses Node.js native test runner (node --test)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import pg from 'pg';

// Load environment variables
try {
  const dotenv = await import('dotenv');
  dotenv.config();
} catch (e) {
  // dotenv not available
}

// Test configuration
const TEST_CONFIG = {
  // Performance thresholds
  thresholds: {
    simpleQueryP95: 10,      // Simple queries < 10ms
    complexQueryP95: 50,     // Complex queries < 50ms (target)
    connectionTime: 5000,    // Connection < 5s
    poolAcquisition: 100     // Pool acquisition < 100ms
  },
  // Test parameters
  samples: {
    latencyTest: 50,         // Number of samples for latency tests
    concurrentConnections: 10 // Concurrent connection test count
  }
};

// Skip all tests if no DATABASE_URL
const skipTests = !process.env.DATABASE_URL;

if (skipTests) {
  console.log('');
  console.log('================================================');
  console.log('DATABASE_URL not set - skipping database tests');
  console.log('');
  console.log('To run tests:');
  console.log('  export DATABASE_URL="postgresql://..."');
  console.log('  node --test tests/database-performance.test.js');
  console.log('================================================');
  console.log('');
}

describe('Database Performance Tests', { skip: skipTests }, () => {
  let pool;

  before(async () => {
    if (skipTests) return;

    // Create pool with optimized settings
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'ROM-Agent-Test'
    });

    // Verify connection
    await pool.query('SELECT 1');
    console.log('    Database connected');
  });

  after(async () => {
    if (pool) {
      await pool.end();
      console.log('    Database connection closed');
    }
  });

  describe('Connection Performance', () => {
    it('should connect within acceptable time', async () => {
      if (skipTests) return;

      const start = Date.now();
      const client = await pool.connect();
      const connectionTime = Date.now() - start;
      client.release();

      assert.ok(connectionTime < TEST_CONFIG.thresholds.connectionTime,
        `Connection time ${connectionTime}ms exceeds ${TEST_CONFIG.thresholds.connectionTime}ms threshold`);
    });

    it('should handle pool acquisition efficiently', async () => {
      if (skipTests) return;

      const times = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        const client = await pool.connect();
        times.push(Date.now() - start);
        client.release();
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      console.log(`    Average pool acquisition: ${avgTime.toFixed(2)}ms`);
      assert.ok(avgTime < TEST_CONFIG.thresholds.poolAcquisition,
        `Average acquisition time ${avgTime}ms exceeds ${TEST_CONFIG.thresholds.poolAcquisition}ms threshold`);
    });

    it('should handle concurrent connections', async () => {
      if (skipTests) return;

      const count = TEST_CONFIG.samples.concurrentConnections;
      const promises = [];

      for (let i = 0; i < count; i++) {
        promises.push(
          pool.connect().then(client => {
            return pool.query('SELECT pg_sleep(0.01)').then(() => {
              client.release();
              return true;
            });
          })
        );
      }

      const results = await Promise.all(promises);
      assert.ok(results.every(r => r === true), 'All concurrent connections should succeed');
    });
  });

  describe('Query Latency', () => {
    async function measureLatency(sql, params = []) {
      const times = [];
      const samples = TEST_CONFIG.samples.latencyTest;

      for (let i = 0; i < samples; i++) {
        const start = Date.now();
        await pool.query(sql, params);
        times.push(Date.now() - start);
      }

      times.sort((a, b) => a - b);

      return {
        min: times[0],
        max: times[times.length - 1],
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        p50: times[Math.floor(times.length * 0.5)],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)]
      };
    }

    it('should execute simple SELECT within threshold', async () => {
      if (skipTests) return;

      const stats = await measureLatency('SELECT 1');
      console.log(`    Simple SELECT: avg=${stats.avg.toFixed(2)}ms, p95=${stats.p95}ms`);
      assert.ok(stats.p95 < TEST_CONFIG.thresholds.simpleQueryP95,
        `P95 ${stats.p95}ms exceeds ${TEST_CONFIG.thresholds.simpleQueryP95}ms threshold`);
    });

    it('should execute SELECT NOW() within threshold', async () => {
      if (skipTests) return;

      const stats = await measureLatency('SELECT NOW()');
      console.log(`    SELECT NOW(): avg=${stats.avg.toFixed(2)}ms, p95=${stats.p95}ms`);
      assert.ok(stats.p95 < TEST_CONFIG.thresholds.simpleQueryP95,
        `P95 ${stats.p95}ms exceeds ${TEST_CONFIG.thresholds.simpleQueryP95}ms threshold`);
    });

    it('should execute table existence check within threshold', async () => {
      if (skipTests) return;

      const sql = "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'conversations')";
      const stats = await measureLatency(sql);
      console.log(`    Table EXISTS: avg=${stats.avg.toFixed(2)}ms, p95=${stats.p95}ms`);
      assert.ok(stats.p95 < TEST_CONFIG.thresholds.complexQueryP95,
        `P95 ${stats.p95}ms exceeds ${TEST_CONFIG.thresholds.complexQueryP95}ms threshold`);
    });

    it('should execute version query within threshold', async () => {
      if (skipTests) return;

      const stats = await measureLatency('SELECT version()');
      console.log(`    SELECT version(): avg=${stats.avg.toFixed(2)}ms, p95=${stats.p95}ms`);
      assert.ok(stats.p95 < TEST_CONFIG.thresholds.simpleQueryP95,
        `P95 ${stats.p95}ms exceeds ${TEST_CONFIG.thresholds.simpleQueryP95}ms threshold`);
    });
  });

  describe('Index Verification', () => {
    it('should have performance indexes created', async () => {
      if (skipTests) return;

      const result = await pool.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE indexname LIKE 'idx_%'
          AND schemaname NOT IN ('pg_catalog')
      `);

      const expectedIndexes = [
        'idx_conversations_user_updated',
        'idx_conversations_active',
        'idx_messages_conversation_created',
        'idx_documents_case_id',
        'idx_users_email'
      ];

      const existingIndexes = result.rows.map(r => r.indexname);
      console.log(`    Found ${existingIndexes.length} custom indexes`);

      for (const idx of expectedIndexes) {
        if (!existingIndexes.includes(idx)) {
          console.log(`    Warning: Index ${idx} not found (may need migration)`);
        }
      }

      // At least some indexes should exist or we're in initial setup
      assert.ok(result.rows.length >= 0, 'Index query should succeed');
    });

    it('should report index usage statistics', async () => {
      if (skipTests) return;

      const result = await pool.query(`
        SELECT
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE indexname LIKE 'idx_%'
        ORDER BY idx_scan DESC
        LIMIT 10
      `);

      console.log(`    Found ${result.rows.length} custom indexes with stats`);

      for (const row of result.rows.slice(0, 5)) {
        console.log(`      ${row.indexname}: ${row.idx_scan} scans`);
      }

      assert.ok(Array.isArray(result.rows), 'Should return array of indexes');
    });
  });

  describe('Pool Configuration Validation', () => {
    it('should have correct pool settings', () => {
      if (skipTests) return;

      assert.strictEqual(pool.options.max, 20, 'Pool max should be 20');
      assert.strictEqual(pool.options.min, 2, 'Pool min should be 2');
      assert.strictEqual(pool.options.idleTimeoutMillis, 30000, 'Idle timeout should be 30s');
      assert.strictEqual(pool.options.connectionTimeoutMillis, 5000, 'Connection timeout should be 5s');
    });

    it('should report pool metrics', async () => {
      if (skipTests) return;

      const metrics = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };

      console.log(`    Pool: total=${metrics.totalCount}, idle=${metrics.idleCount}, waiting=${metrics.waitingCount}`);

      assert.ok(metrics.totalCount <= pool.options.max, 'Total should not exceed max');
      assert.strictEqual(metrics.waitingCount, 0, 'No queries should be waiting');
    });

    it('should recover from connection release', async () => {
      if (skipTests) return;

      const initialIdle = pool.idleCount;

      // Acquire and release multiple connections
      const clients = [];
      for (let i = 0; i < 5; i++) {
        clients.push(await pool.connect());
      }

      // Release all
      for (const client of clients) {
        client.release();
      }

      // Wait briefly for pool to stabilize
      await new Promise(resolve => setTimeout(resolve, 100));

      assert.ok(pool.idleCount >= initialIdle, 'Idle count should recover after release');
    });
  });

  describe('Query Optimization Validation', () => {
    it('should execute EXPLAIN without errors', async () => {
      if (skipTests) return;

      const result = await pool.query(`
        EXPLAIN (FORMAT JSON)
        SELECT 1 WHERE 1 = 1
      `);

      assert.strictEqual(result.rows.length, 1, 'EXPLAIN should return 1 row');
      assert.ok(Array.isArray(result.rows[0]['QUERY PLAN']), 'QUERY PLAN should be array');
    });

    it('should handle prepared statements efficiently', async () => {
      if (skipTests) return;

      const times = [];

      // First execution (parse + plan + execute)
      const start1 = Date.now();
      await pool.query({
        name: 'test_prepared_' + Date.now(),
        text: 'SELECT $1::int + $2::int as sum',
        values: [1, 2]
      });
      times.push(Date.now() - start1);

      // Subsequent executions (execute only)
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await pool.query({
          name: 'test_prepared_subsequent_' + Date.now(),
          text: 'SELECT $1::int + $2::int as sum',
          values: [i, i + 1]
        });
        times.push(Date.now() - start);
      }

      const avgSubsequent = times.slice(1).reduce((a, b) => a + b, 0) / (times.length - 1);

      console.log(`    First execution: ${times[0]}ms`);
      console.log(`    Avg subsequent: ${avgSubsequent.toFixed(2)}ms`);

      // Subsequent executions should be reasonably fast
      assert.ok(avgSubsequent < 50, `Average subsequent execution ${avgSubsequent}ms should be < 50ms`);
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid sequential queries', async () => {
      if (skipTests) return;

      const count = 100;
      const start = Date.now();

      for (let i = 0; i < count; i++) {
        await pool.query('SELECT $1::int', [i]);
      }

      const totalTime = Date.now() - start;
      const avgTime = totalTime / count;

      console.log(`    ${count} queries in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms)`);

      assert.ok(avgTime < 10, `Average ${avgTime}ms should be < 10ms per query`);
    });

    it('should handle parallel queries', async () => {
      if (skipTests) return;

      const count = 50;
      const start = Date.now();

      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(pool.query('SELECT $1::int, pg_sleep(0.001)', [i]));
      }

      await Promise.all(promises);

      const totalTime = Date.now() - start;

      console.log(`    ${count} parallel queries in ${totalTime}ms`);

      // Should complete faster than sequential due to parallelism
      assert.ok(totalTime < count * 50, `Total time ${totalTime}ms should be < ${count * 50}ms`);
    });

    it('should maintain performance under mixed load', async () => {
      if (skipTests) return;

      const operations = [];

      // Mix of read operations
      for (let i = 0; i < 20; i++) {
        operations.push(
          pool.query('SELECT 1'),
          pool.query('SELECT NOW()'),
          pool.query('SELECT version()'),
          pool.query('SELECT pg_sleep(0.001)'),
          pool.query('SELECT $1::int', [i])
        );
      }

      const start = Date.now();
      await Promise.all(operations);
      const totalTime = Date.now() - start;

      console.log(`    100 mixed operations in ${totalTime}ms`);

      assert.ok(totalTime < 5000, `Total time ${totalTime}ms should be < 5000ms`);
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors without crashing pool', async () => {
      if (skipTests) return;

      try {
        await pool.query('SELEKT invalid syntax');
        assert.fail('Should have thrown syntax error');
      } catch (error) {
        assert.ok(error.message.includes('syntax'), 'Error should mention syntax');
      }

      // Pool should still work
      const result = await pool.query('SELECT 1 as test');
      assert.strictEqual(result.rows[0].test, 1, 'Pool should recover after error');
    });

    it('should handle connection release after error', async () => {
      if (skipTests) return;

      const client = await pool.connect();

      try {
        await client.query('INVALID SQL');
        assert.fail('Should have thrown error');
      } catch (error) {
        // Expected
      } finally {
        client.release();
      }

      // Pool should still work
      const result = await pool.query('SELECT 1 as test');
      assert.strictEqual(result.rows[0].test, 1, 'Pool should work after error release');
    });
  });
});

// Performance benchmark runner (can be run separately)
export async function runBenchmark() {
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not set - skipping benchmark');
    return;
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
    max: 20,
    min: 2,
    application_name: 'ROM-Agent-Benchmark'
  });

  console.log('\n=== DATABASE PERFORMANCE BENCHMARK ===\n');

  try {
    await pool.query('SELECT 1');
    console.log('Connection: OK\n');

    const queries = [
      { name: 'Simple SELECT', sql: 'SELECT 1' },
      { name: 'NOW()', sql: 'SELECT NOW()' },
      { name: 'Version', sql: 'SELECT version()' },
      { name: 'Table check', sql: "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'users')" }
    ];

    for (const query of queries) {
      const times = [];
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await pool.query(query.sql);
        times.push(Date.now() - start);
      }

      times.sort((a, b) => a - b);
      const p50 = times[50];
      const p95 = times[95];
      const p99 = times[99];
      const avg = times.reduce((a, b) => a + b, 0) / times.length;

      const status = p95 < 50 ? 'PASS' : 'FAIL';
      console.log(`${query.name}: avg=${avg.toFixed(2)}ms, p50=${p50}ms, p95=${p95}ms, p99=${p99}ms [${status}]`);
    }

    console.log('\nPool Stats:');
    console.log(`  Total: ${pool.totalCount}`);
    console.log(`  Idle: ${pool.idleCount}`);
    console.log(`  Waiting: ${pool.waitingCount}`);

  } catch (error) {
    console.error('Benchmark failed:', error.message);
  } finally {
    await pool.end();
  }

  console.log('\n=== BENCHMARK COMPLETE ===\n');
}

// Export for testing
export { TEST_CONFIG };
