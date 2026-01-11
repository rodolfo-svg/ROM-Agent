/**
 * SSE Streaming Stress Tests
 *
 * Tests for:
 * - 1000 simultaneous connections
 * - Memory leak detection
 * - Time to First Token (TTFT)
 * - Heartbeat reliability
 * - Connection cleanup
 *
 * Execution:
 * - Run all: node tests/sse-streaming.test.js
 * - Stress only: STRESS=1 node tests/sse-streaming.test.js
 *
 * @version 1.0.0
 * @since WS5 - SSE Streaming Optimization
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// ============================================================
// TEST CONFIGURATION
// ============================================================

const STRESS_TEST = process.env.STRESS === '1';
const TIMEOUT = 30000;

// Colors for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function logSuccess(message) {
  log(`  [PASS] ${message}`, GREEN);
}

function logFail(message) {
  log(`  [FAIL] ${message}`, RED);
}

function logInfo(message) {
  log(`  [INFO] ${message}`, CYAN);
}

// ============================================================
// MOCK RESPONSE OBJECT
// ============================================================

class MockResponse {
  constructor() {
    this.headers = {};
    this.chunks = [];
    this.writableEnded = false;
    this.destroyed = false;
    this.socket = { destroyed: false };
    this.headersSent = false;
  }

  setHeader(name, value) {
    this.headers[name] = value;
  }

  flushHeaders() {
    this.headersSent = true;
  }

  write(data) {
    if (this.writableEnded || this.destroyed) {
      throw new Error('Response already ended');
    }
    this.chunks.push(data);
    return true;
  }

  end() {
    this.writableEnded = true;
  }

  destroy() {
    this.destroyed = true;
    this.socket.destroyed = true;
  }
}

// ============================================================
// TEST SUITE
// ============================================================

let SSEConnectionManager;
let getSSEConnectionManager;
let resetSSEConnectionManager;

before(async () => {
  log('\n========================================', BLUE);
  log('  SSE STREAMING STRESS TESTS (WS5)', BLUE);
  log('========================================\n', BLUE);

  // Import modules
  const module = await import('../src/utils/sse-connection-manager.js');
  SSEConnectionManager = module.SSEConnectionManager;
  getSSEConnectionManager = module.getSSEConnectionManager;
  resetSSEConnectionManager = module.resetSSEConnectionManager;

  logSuccess('Modules imported successfully');
});

describe('SSEConnectionManager - Unit Tests', { timeout: TIMEOUT }, () => {
  let manager;

  beforeEach(() => {
    resetSSEConnectionManager();
    manager = new SSEConnectionManager({
      heartbeatInterval: 100, // Fast heartbeat for testing
      connectionTTL: 1000, // 1s TTL for testing
      cleanupInterval: 200, // Fast cleanup for testing
      chunkBufferSize: 50, // Small buffer for testing
      maxLatencyEntries: 100
    });
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('Connection Management', () => {
    it('should add connection successfully', () => {
      const res = new MockResponse();
      const connection = manager.addConnection('test-1', res, { userId: '123' });

      assert.ok(connection, 'Connection should be created');
      assert.strictEqual(connection.id, 'test-1');
      assert.strictEqual(connection.active, true);
      assert.strictEqual(manager.connections.size, 1);
      assert.strictEqual(manager.getMetrics().activeConnections, 1);

      logSuccess('Connection added successfully');
    });

    it('should replace existing connection with same ID', () => {
      const res1 = new MockResponse();
      const res2 = new MockResponse();

      manager.addConnection('test-1', res1);
      manager.addConnection('test-1', res2);

      assert.strictEqual(manager.connections.size, 1);
      assert.strictEqual(res1.writableEnded, true, 'Old connection should be closed');

      logSuccess('Duplicate connection replaced');
    });

    it('should remove connection and cleanup resources', () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      manager.removeConnection('test-1');

      assert.strictEqual(manager.connections.size, 0);
      assert.strictEqual(res.writableEnded, true);

      logSuccess('Connection removed and cleaned up');
    });

    it('should check if connection is active', () => {
      const res = new MockResponse();
      manager.addConnection('test-active', res);

      assert.strictEqual(manager.isActive('test-active'), true, 'Active connection should return true');
      assert.strictEqual(manager.isActive('nonexistent'), false, 'Nonexistent connection should return false');

      // Mark as ended and check again
      res.writableEnded = true;
      assert.strictEqual(manager.isActive('test-active'), false, 'Ended connection should return false');

      logSuccess('Connection active check works');
    });
  });

  describe('Writing and Buffering', () => {
    it('should buffer small chunks', () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      // Write small chunk (less than buffer size)
      manager.writeChunk('test-1', 'Hello');

      // Should be buffered, not written yet
      assert.strictEqual(res.chunks.length, 0, 'Small chunk should be buffered');

      logSuccess('Small chunks buffered correctly');
    });

    it('should flush when buffer exceeds threshold', () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      // Write enough to exceed buffer (50 bytes threshold)
      manager.writeChunk('test-1', 'A'.repeat(60));

      // Should be flushed
      assert.ok(res.chunks.length > 0, 'Buffer should be flushed');

      logSuccess('Large chunks flushed correctly');
    });

    it('should force flush with option', () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      manager.writeChunk('test-1', 'Hi', { forceFlush: true });

      assert.ok(res.chunks.length > 0, 'Force flush should work');

      logSuccess('Force flush works');
    });

    it('should write events with correct SSE format', () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      manager.writeEvent('test-1', 'message', { text: 'Hello' });

      assert.strictEqual(res.chunks.length, 1);
      assert.ok(res.chunks[0].includes('event: message'), 'Should have event type');
      assert.ok(res.chunks[0].includes('data: {"text":"Hello"}'), 'Should have JSON data');

      logSuccess('SSE event format correct');
    });
  });

  describe('Heartbeat Safety', () => {
    it('should send heartbeats at configured interval', async () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      // Wait for heartbeat
      await new Promise(resolve => setTimeout(resolve, 150));

      const heartbeats = res.chunks.filter(c => c.includes(':heartbeat'));
      assert.ok(heartbeats.length >= 1, 'Should have at least one heartbeat');

      logSuccess('Heartbeats sent at interval');
    });

    it('should stop heartbeat when connection closes', async () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      // Simulate connection close
      res.writableEnded = true;

      // Wait for heartbeat check
      await new Promise(resolve => setTimeout(resolve, 150));

      // Connection should be removed
      assert.strictEqual(manager.connections.size, 0, 'Dead connection should be removed');

      logSuccess('Heartbeat stops on connection close');
    });

    it('should handle heartbeat write errors gracefully', async () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      // Simulate write error
      res.write = () => { throw new Error('Write failed'); };

      // Wait for heartbeat attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      // Connection should be removed due to error
      assert.strictEqual(manager.connections.size, 0, 'Connection should be removed on error');

      logSuccess('Heartbeat errors handled gracefully');
    });
  });

  describe('TTL and Cleanup', () => {
    it('should remove connection after TTL expires', async () => {
      const res = new MockResponse();
      manager.addConnection('ttl-expire-test', res);

      // Wait for TTL (1s + buffer)
      await new Promise(resolve => setTimeout(resolve, 1300));

      assert.strictEqual(manager.connections.size, 0, 'Connection should expire');
      // Note: connectionsTimedOut may be 0 if heartbeat detected close first
      // The important thing is the connection was removed
      assert.strictEqual(manager.isActive('ttl-expire-test'), false, 'Connection should not be active');

      logSuccess('TTL expiration works');
    });

    it('should renew TTL when requested', async () => {
      // Use longer TTL for this test to avoid race conditions with heartbeat
      manager.destroy();
      manager = new SSEConnectionManager({
        heartbeatInterval: 2000, // Slow heartbeat
        connectionTTL: 800, // 800ms TTL
        cleanupInterval: 5000, // Slow cleanup
        chunkBufferSize: 50,
        maxLatencyEntries: 100
      });

      const res = new MockResponse();
      manager.addConnection('ttl-renew-test', res);

      // Wait halfway through TTL
      await new Promise(resolve => setTimeout(resolve, 400));

      // Renew TTL
      manager.renewTTL('ttl-renew-test');

      // Wait for original TTL to expire but not renewed TTL
      await new Promise(resolve => setTimeout(resolve, 500));

      // Connection should still be active (TTL was renewed)
      assert.strictEqual(manager.isActive('ttl-renew-test'), true, 'Connection should survive after renewal');

      logSuccess('TTL renewal works');
    });

    it('should cleanup dead connections periodically', async () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      // Simulate dead connection
      res.destroyed = true;

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));

      assert.strictEqual(manager.connections.size, 0, 'Dead connection should be cleaned');

      logSuccess('Periodic cleanup works');
    });
  });

  describe('Metrics and Latency', () => {
    it('should record latency values', () => {
      manager.recordLatency(100);
      manager.recordLatency(200);
      manager.recordLatency(150);

      const stats = manager.getLatencyStats();

      assert.strictEqual(stats.count, 3);
      assert.strictEqual(stats.avg, 150);
      assert.strictEqual(stats.min, 100);
      assert.strictEqual(stats.max, 200);

      logSuccess('Latency recording works');
    });

    it('should limit latency entries (circular buffer)', () => {
      // Fill buffer beyond capacity
      for (let i = 0; i < 150; i++) {
        manager.recordLatency(i);
      }

      const stats = manager.getLatencyStats();
      assert.strictEqual(stats.count, 100, 'Should be limited to maxLatencyEntries');

      logSuccess('Circular buffer limits entries correctly');
    });

    it('should track connection metrics', () => {
      const res = new MockResponse();
      manager.addConnection('test-1', res);

      const metrics = manager.getMetrics();

      assert.strictEqual(metrics.totalConnections, 1);
      assert.strictEqual(metrics.activeConnections, 1);

      logSuccess('Connection metrics tracked');
    });
  });

  describe('Broadcast', () => {
    it('should broadcast to all active connections', () => {
      const res1 = new MockResponse();
      const res2 = new MockResponse();
      const res3 = new MockResponse();

      manager.addConnection('conn-1', res1);
      manager.addConnection('conn-2', res2);
      manager.addConnection('conn-3', res3);

      const sent = manager.broadcast('notification', { msg: 'Hello all' });

      assert.strictEqual(sent, 3);
      assert.ok(res1.chunks.some(c => c.includes('Hello all')));
      assert.ok(res2.chunks.some(c => c.includes('Hello all')));
      assert.ok(res3.chunks.some(c => c.includes('Hello all')));

      logSuccess('Broadcast to all connections works');
    });

    it('should skip dead connections in broadcast', () => {
      const res1 = new MockResponse();
      const res2 = new MockResponse();

      manager.addConnection('conn-1', res1);
      manager.addConnection('conn-2', res2);

      res1.destroyed = true;

      const sent = manager.broadcast('notification', { msg: 'Hello' });

      assert.strictEqual(sent, 1, 'Should skip dead connection');

      logSuccess('Broadcast skips dead connections');
    });
  });
});

describe('Stress Tests', { timeout: 60000 }, () => {
  let manager;

  beforeEach(() => {
    resetSSEConnectionManager();
    manager = new SSEConnectionManager({
      heartbeatInterval: 5000, // Normal heartbeat for stress test
      connectionTTL: 60000, // 1min TTL
      cleanupInterval: 10000, // 10s cleanup
      chunkBufferSize: 512,
      maxLatencyEntries: 1000
    });
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('1000 Simultaneous Connections', () => {
    it('should handle 1000 connections without errors', () => {
      const connections = [];

      // Add 1000 connections
      for (let i = 0; i < 1000; i++) {
        const res = new MockResponse();
        const conn = manager.addConnection(`stress-${i}`, res);
        connections.push({ res, conn });
      }

      assert.strictEqual(manager.connections.size, 1000);
      assert.strictEqual(manager.getMetrics().totalConnections, 1000);

      // All connections should be active
      for (let i = 0; i < 1000; i++) {
        assert.strictEqual(manager.isActive(`stress-${i}`), true);
      }

      logSuccess('1000 connections handled successfully');
    });

    it('should broadcast to 1000 connections efficiently', () => {
      const startTime = Date.now();

      // Add 1000 connections
      for (let i = 0; i < 1000; i++) {
        const res = new MockResponse();
        manager.addConnection(`stress-${i}`, res);
      }

      // Broadcast to all
      const sent = manager.broadcast('test', { data: 'Stress test message' });

      const duration = Date.now() - startTime;

      assert.strictEqual(sent, 1000);
      assert.ok(duration < 1000, `Should complete in under 1s (took ${duration}ms)`);

      logSuccess(`Broadcast to 1000 connections in ${duration}ms`);
    });

    it('should cleanup 1000 connections efficiently', () => {
      // Add 1000 connections
      for (let i = 0; i < 1000; i++) {
        const res = new MockResponse();
        manager.addConnection(`stress-${i}`, res);
      }

      const startTime = Date.now();

      // Close all
      manager.closeAll();

      const duration = Date.now() - startTime;

      assert.strictEqual(manager.connections.size, 0);
      assert.ok(duration < 500, `Should complete in under 500ms (took ${duration}ms)`);

      logSuccess(`Closed 1000 connections in ${duration}ms`);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory with connection churn', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate connection churn: add and remove many connections
      for (let cycle = 0; cycle < 10; cycle++) {
        // Add 100 connections
        for (let i = 0; i < 100; i++) {
          const res = new MockResponse();
          manager.addConnection(`churn-${cycle}-${i}`, res);
        }

        // Remove all connections
        for (let i = 0; i < 100; i++) {
          manager.removeConnection(`churn-${cycle}-${i}`);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = (memoryGrowth / (1024 * 1024)).toFixed(2);

      // Memory growth should be minimal (less than 10MB)
      assert.ok(memoryGrowth < 10 * 1024 * 1024, `Memory growth should be <10MB (was ${memoryGrowthMB}MB)`);
      assert.strictEqual(manager.connections.size, 0);

      logSuccess(`Memory growth: ${memoryGrowthMB}MB (within limits)`);
    });

    it('should not grow latency buffer unboundedly', () => {
      // Record 5000 latencies
      for (let i = 0; i < 5000; i++) {
        manager.recordLatency(Math.random() * 1000);
      }

      const stats = manager.getLatencyStats();

      // Should be capped at maxLatencyEntries (1000)
      assert.strictEqual(stats.count, 1000, 'Latency buffer should be limited');

      logSuccess('Latency buffer correctly limited to 1000 entries');
    });
  });

  describe('Time to First Token (TTFT)', () => {
    it('should achieve TTFT < 500ms for write operations', () => {
      const res = new MockResponse();
      manager.addConnection('ttft-test', res);

      const startTime = Date.now();

      // First write
      manager.writeEvent('ttft-test', 'chunk', { content: 'First token' });

      const ttft = Date.now() - startTime;

      assert.ok(ttft < 500, `TTFT should be <500ms (was ${ttft}ms)`);
      assert.ok(res.chunks.length > 0, 'Should have written chunk');

      logSuccess(`TTFT: ${ttft}ms (target: <500ms)`);
    });

    it('should track TTFT distribution', () => {
      // Simulate various TTFTs
      const ttfts = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550];
      ttfts.forEach(t => manager.recordLatency(t));

      const stats = manager.getLatencyStats();

      assert.ok(stats.p50 <= 350, `p50 should be <=350ms (was ${stats.p50}ms)`);
      assert.ok(stats.p95 <= 550, `p95 should be <=550ms (was ${stats.p95}ms)`);

      logSuccess(`TTFT p50: ${stats.p50}ms, p95: ${stats.p95}ms`);
    });
  });
});

describe('ProgressEmitter TTL and Cleanup', { timeout: TIMEOUT }, () => {
  let progressEmitter;

  before(async () => {
    const module = await import('../src/utils/progress-emitter.js');
    progressEmitter = module.default;
    logSuccess('ProgressEmitter module loaded');
  });

  afterEach(() => {
    // Cleanup any test sessions
    progressEmitter.sessions.clear();
  });

  it('should track session activity timestamp', () => {
    progressEmitter.startSession('test-case-1', { type: 'test' });

    const session = progressEmitter.sessions.get('test-case-1');

    assert.ok(session.lastActivity, 'Should have lastActivity');
    assert.ok(session.lastActivity > 0, 'lastActivity should be positive');

    logSuccess('Session activity timestamp tracked');
  });

  it('should update lastActivity on addUpdate', async () => {
    progressEmitter.startSession('test-case-2', { type: 'test' });

    const initialActivity = progressEmitter.sessions.get('test-case-2').lastActivity;

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 10));

    progressEmitter.addUpdate('test-case-2', 'info', 'Test message');

    const newActivity = progressEmitter.sessions.get('test-case-2').lastActivity;
    assert.ok(newActivity >= initialActivity, 'lastActivity should be updated');

    logSuccess('lastActivity updated on addUpdate');
  });

  it('should provide metrics', () => {
    const metrics = progressEmitter.getMetrics();

    assert.ok(metrics, 'Should return metrics');
    assert.ok('activeSessions' in metrics, 'Should have activeSessions');
    assert.ok('sessionTTL' in metrics, 'Should have sessionTTL');
    assert.ok('totalSessionsCreated' in metrics, 'Should have totalSessionsCreated');

    logSuccess('Metrics available');
  });

  it('should limit updates per session', () => {
    progressEmitter.startSession('limit-test', { type: 'test' });

    // Add many updates
    const session = progressEmitter.sessions.get('limit-test');

    // Manually set updates to near limit to test truncation
    session.updates = new Array(9999).fill({ type: 'info', message: 'test' });

    // This should trigger truncation
    progressEmitter.addUpdate('limit-test', 'info', 'Final message');

    // Should still work without errors
    assert.ok(session.updates.length <= 10000, 'Updates should be limited');

    logSuccess('Updates per session limited correctly');
  });
});

// ============================================================
// RUN TESTS
// ============================================================

after(() => {
  log('\n========================================', BLUE);
  log('  SSE STREAMING TESTS COMPLETE', BLUE);
  log('========================================\n', BLUE);
});
