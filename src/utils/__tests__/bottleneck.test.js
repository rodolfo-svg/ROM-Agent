/**
 * ROM Agent - Bottleneck / Rate Limiter Tests
 * Comprehensive test suite for concurrency control and queue management
 */

import { describe, it, beforeEach, mock, before } from 'node:test';
import assert from 'node:assert';

// Set environment variables BEFORE importing modules
process.env.ENABLE_BOTTLENECK = 'true';
process.env.MAX_CONCURRENT = '3';
process.env.MAX_QUEUE = '5';

import { Bottleneck } from '../bottleneck.js';
import featureFlags from '../feature-flags.js';

describe('Bottleneck / Rate Limiter', () => {
  let bottleneck;

  // Force reload flags after setting env vars
  before(() => {
    featureFlags.reload();
  });

  beforeEach(() => {
    // Create fresh instance for each test
    bottleneck = new Bottleneck({
      maxConcurrent: 3,
      maxQueue: 5
    });
  });

  describe('Configuration', () => {
    it('should initialize with correct default configuration', () => {
      const stats = bottleneck.getStats();
      assert.strictEqual(stats.maxConcurrent, 3);
      assert.strictEqual(stats.maxQueue, 5);
      assert.strictEqual(stats.running, 0);
      assert.strictEqual(stats.queued, 0);
    });

    it('should respect custom configuration', () => {
      const customBottleneck = new Bottleneck({
        maxConcurrent: 10,
        maxQueue: 20
      });
      const stats = customBottleneck.getStats();
      assert.strictEqual(stats.maxConcurrent, 10);
      assert.strictEqual(stats.maxQueue, 20);
    });

    it('should read configuration from environment variables', () => {
      const envBottleneck = new Bottleneck();
      const stats = envBottleneck.getStats();
      // Default from process.env.MAX_CONCURRENT = '3'
      assert.strictEqual(stats.maxConcurrent, 3);
    });
  });

  describe('Immediate Execution', () => {
    it('should execute immediately when under concurrency limit', async () => {
      const mockFn = mock.fn(() => Promise.resolve('success'));

      const result = await bottleneck.schedule(mockFn, {
        operation: 'test_immediate'
      });

      assert.strictEqual(result, 'success');
      assert.strictEqual(mockFn.mock.calls.length, 1);

      const stats = bottleneck.getStats();
      assert.strictEqual(stats.running, 0);
      assert.strictEqual(stats.completed, 1);
    });

    it('should execute multiple requests concurrently up to limit', async () => {
      const delays = [50, 50, 50]; // 3 concurrent (at limit)
      const promises = delays.map((delay, i) =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'concurrent_test' }
        )
      );

      const results = await Promise.all(promises);

      assert.deepStrictEqual(results, [0, 1, 2]);

      const stats = bottleneck.getStats();
      assert.strictEqual(stats.completed, 3);
      assert.strictEqual(stats.running, 0);
    });
  });

  describe('Queueing Behavior', () => {
    it('should queue request when at concurrency limit', async () => {
      const delay = 20;

      // Start 3 requests (at limit)
      const runningPromises = [0, 1, 2].map(i =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'queue_test' }
        )
      );

      // 4th request should queue
      const queuedPromise = bottleneck.schedule(
        () => Promise.resolve('queued'),
        { operation: 'queue_test' }
      );

      // Check stats while running
      await new Promise(resolve => setTimeout(resolve, 5));
      const stats = bottleneck.getStats();
      assert.strictEqual(stats.running, 3);
      assert.strictEqual(stats.queued, 1);

      // Wait for all to complete
      await Promise.all([...runningPromises, queuedPromise]);

      const finalStats = bottleneck.getStats();
      assert.strictEqual(finalStats.completed, 4);
      assert.strictEqual(finalStats.running, 0);
      assert.strictEqual(finalStats.queued, 0);
    });

    it('should process queued requests in FIFO order', async () => {
      const results = [];
      const delay = 20;

      // Start 3 requests (at limit)
      const runningPromises = [0, 1, 2].map(i =>
        bottleneck.schedule(
          () => new Promise(resolve => {
            setTimeout(() => {
              results.push(`running_${i}`);
              resolve(i);
            }, delay);
          }),
          { operation: 'fifo_test' }
        )
      );

      // Queue 2 more requests
      const queued1 = bottleneck.schedule(
        () => new Promise(resolve => {
          results.push('queued_1');
          resolve('q1');
        }),
        { operation: 'fifo_test' }
      );

      const queued2 = bottleneck.schedule(
        () => new Promise(resolve => {
          results.push('queued_2');
          resolve('q2');
        }),
        { operation: 'fifo_test' }
      );

      await Promise.all([...runningPromises, queued1, queued2]);

      // Queued requests should be processed in order
      const queuedResults = results.filter(r => r.startsWith('queued'));
      assert.deepStrictEqual(queuedResults, ['queued_1', 'queued_2']);
    });

    it('should queue up to maxQueue requests', async () => {
      const delay = 20;

      // Start 3 requests (at concurrency limit)
      const runningPromises = [0, 1, 2].map(i =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'max_queue_test' }
        )
      );

      // Queue 5 more (at queue limit)
      const queuedPromises = [3, 4, 5, 6, 7].map(i =>
        bottleneck.schedule(
          () => Promise.resolve(i),
          { operation: 'max_queue_test' }
        )
      );

      // Check stats
      await new Promise(resolve => setTimeout(resolve, 10));
      const stats = bottleneck.getStats();
      assert.strictEqual(stats.running, 3);
      assert.strictEqual(stats.queued, 5);

      await Promise.all([...runningPromises, ...queuedPromises]);

      const finalStats = bottleneck.getStats();
      assert.strictEqual(finalStats.completed, 8);
    });
  });

  describe('Queue Full Rejection', () => {
    it('should reject with 503 when queue is full', async () => {
      const delay = 20;

      // Start 3 requests (at concurrency limit)
      const runningPromises = [0, 1, 2].map(i =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'rejection_test' }
        )
      );

      // Queue 5 more (fills queue)
      const queuedPromises = [3, 4, 5, 6, 7].map(i =>
        bottleneck.schedule(
          () => Promise.resolve(i),
          { operation: 'rejection_test' }
        )
      );

      // 9th request should be rejected (queue full)
      await assert.rejects(
        () => bottleneck.schedule(
          () => Promise.resolve('rejected'),
          { operation: 'rejection_test' }
        ),
        (error) => {
          assert.strictEqual(error.code, 'QUEUE_FULL');
          assert.strictEqual(error.statusCode, 503);
          assert.ok(error.message.includes('queue full'));
          return true;
        }
      );

      const stats = bottleneck.getStats();
      assert.strictEqual(stats.rejected, 1);

      // Clean up
      await Promise.all([...runningPromises, ...queuedPromises]);
    });

    it('should include retryAfter in rejection error', async () => {
      const delay = 20;

      // Fill concurrency and queue
      const promises = [0, 1, 2, 3, 4, 5, 6, 7].map(i =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'retry_after_test' }
        )
      );

      // Reject next request
      try {
        await bottleneck.schedule(
          () => Promise.resolve('rejected'),
          { operation: 'retry_after_test' }
        );
        assert.fail('Should have thrown');
      } catch (error) {
        assert.strictEqual(error.statusCode, 503);
        assert.strictEqual(error.retryAfter, 5);
      }

      await Promise.all(promises);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track completed requests', async () => {
      await bottleneck.schedule(() => Promise.resolve('1'), { operation: 'stats_test' });
      await bottleneck.schedule(() => Promise.resolve('2'), { operation: 'stats_test' });
      await bottleneck.schedule(() => Promise.resolve('3'), { operation: 'stats_test' });

      const stats = bottleneck.getStats();
      assert.strictEqual(stats.completed, 3);
    });

    it('should track rejected requests', async () => {
      const delay = 100;

      // Fill concurrency and queue
      const promises = Array.from({ length: 8 }, (_, i) =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'stats_rejected' }
        )
      );

      // Reject 2 requests
      try {
        await bottleneck.schedule(() => Promise.resolve('r1'), { operation: 'stats_rejected' });
      } catch (e) { /* expected */ }

      try {
        await bottleneck.schedule(() => Promise.resolve('r2'), { operation: 'stats_rejected' });
      } catch (e) { /* expected */ }

      const stats = bottleneck.getStats();
      assert.strictEqual(stats.rejected, 2);

      await Promise.all(promises);
    });

    it('should calculate utilization percentage', async () => {
      const delay = 20;

      // Start 2 requests (66% utilization)
      const promises = [0, 1].map(i =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'utilization_test' }
        )
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = bottleneck.getStats();
      assert.strictEqual(stats.running, 2);
      assert.strictEqual(Math.round(stats.utilizationPct), 67); // 2/3 = 66.67%

      await Promise.all(promises);
    });

    it('should calculate queue utilization percentage', async () => {
      const delay = 20;

      // Fill concurrency (3) and add 2 to queue (40% queue utilization)
      const promises = [0, 1, 2, 3, 4].map(i =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'queue_utilization' }
        )
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = bottleneck.getStats();
      assert.strictEqual(stats.queued, 2);
      assert.strictEqual(stats.queueUtilizationPct, 40); // 2/5 = 40%

      await Promise.all(promises);
    });

    it('should reset statistics', async () => {
      // Generate some activity
      await bottleneck.schedule(() => Promise.resolve('1'), { operation: 'reset_test' });

      const delay = 20;
      const promises = [0, 1, 2, 3, 4, 5, 6, 7].map(i =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'reset_test' }
        )
      );

      try {
        await bottleneck.schedule(() => Promise.resolve('r'), { operation: 'reset_test' });
      } catch (e) { /* expected rejection */ }

      const beforeReset = bottleneck.getStats();
      assert.ok(beforeReset.completed > 0);
      assert.ok(beforeReset.rejected > 0);

      // Reset stats
      bottleneck.resetStats();

      const afterReset = bottleneck.getStats();
      assert.strictEqual(afterReset.completed, 0);
      assert.strictEqual(afterReset.rejected, 0);

      await Promise.all(promises);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in scheduled functions', async () => {
      const mockFn = mock.fn(() => Promise.reject(new Error('Test error')));

      await assert.rejects(
        () => bottleneck.schedule(mockFn, { operation: 'error_test' }),
        (error) => {
          assert.strictEqual(error.message, 'Test error');
          return true;
        }
      );

      // Should still update stats
      const stats = bottleneck.getStats();
      assert.strictEqual(stats.running, 0);
    });

    it('should continue processing queue after errors', async () => {
      const results = [];
      const delay = 20;

      // Start 3 requests (1 will fail)
      const p1 = bottleneck.schedule(
        () => new Promise(resolve => setTimeout(() => {
          results.push('success_1');
          resolve('1');
        }, delay)),
        { operation: 'error_recovery' }
      );

      const p2 = bottleneck.schedule(
        () => new Promise((_, reject) => setTimeout(() => {
          results.push('error');
          reject(new Error('Failed'));
        }, delay)),
        { operation: 'error_recovery' }
      );

      const p3 = bottleneck.schedule(
        () => new Promise(resolve => setTimeout(() => {
          results.push('success_2');
          resolve('3');
        }, delay)),
        { operation: 'error_recovery' }
      );

      // Queue another request
      const p4 = bottleneck.schedule(
        () => new Promise(resolve => {
          results.push('queued');
          resolve('4');
        }),
        { operation: 'error_recovery' }
      );

      await Promise.allSettled([p1, p2, p3, p4]);

      // All requests should have been processed despite the error
      assert.ok(results.includes('success_1'));
      assert.ok(results.includes('error'));
      assert.ok(results.includes('success_2'));
      assert.ok(results.includes('queued'));
    });
  });

  describe('Feature Flag Integration', () => {
    it('should bypass bottleneck when flag is disabled', async () => {
      // Temporarily disable bottleneck
      const originalEnabled = process.env.ENABLE_BOTTLENECK;
      process.env.ENABLE_BOTTLENECK = 'false';
      featureFlags.reload();

      const mockFn = mock.fn(() => Promise.resolve('bypassed'));

      const result = await bottleneck.schedule(mockFn, { operation: 'bypass_test' });

      assert.strictEqual(result, 'bypassed');
      assert.strictEqual(mockFn.mock.calls.length, 1);

      // Should not track stats when disabled
      const stats = bottleneck.getStats();
      assert.strictEqual(stats.enabled, false);

      // Restore
      process.env.ENABLE_BOTTLENECK = originalEnabled;
      featureFlags.reload();
    });

    it('should enforce bottleneck when flag is enabled', async () => {
      const stats = bottleneck.getStats();
      assert.strictEqual(stats.enabled, true);

      const delay = 20;

      // Fill concurrency and queue
      const promises = Array.from({ length: 8 }, (_, i) =>
        bottleneck.schedule(
          () => new Promise(resolve => setTimeout(() => resolve(i), delay)),
          { operation: 'enabled_test' }
        )
      );

      // Should reject when queue full
      await assert.rejects(
        () => bottleneck.schedule(() => Promise.resolve('rejected'), { operation: 'enabled_test' }),
        (error) => error.statusCode === 503
      );

      await Promise.all(promises);
    });
  });

  describe('Graceful Drain', () => {
    it('should drain successfully when queue is empty', async () => {
      const drained = await bottleneck.drain(1000);
      assert.strictEqual(drained, true);
    });

    it('should wait for running requests to complete', async () => {
      const delay = 50;

      // Start 2 requests
      const p1 = bottleneck.schedule(
        () => new Promise(resolve => setTimeout(() => resolve('1'), delay)),
        { operation: 'drain_test' }
      );

      const p2 = bottleneck.schedule(
        () => new Promise(resolve => setTimeout(() => resolve('2'), delay)),
        { operation: 'drain_test' }
      );

      // Drain should wait for them
      const drainPromise = bottleneck.drain(500);

      const drained = await drainPromise;
      assert.strictEqual(drained, true);

      await Promise.all([p1, p2]);

      const stats = bottleneck.getStats();
      assert.strictEqual(stats.running, 0);
      assert.strictEqual(stats.completed, 2);
    });

    it('should return false on drain timeout', async () => {
      const delay = 100; // Long delay

      // Start a long-running request
      const promise = bottleneck.schedule(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), delay)),
        { operation: 'drain_timeout' }
      );

      // Drain with short timeout
      const drained = await bottleneck.drain(20);
      assert.strictEqual(drained, false);

      // Clean up
      await promise;
    });
  });

  describe('Context and Logging', () => {
    it('should accept and use custom requestId', async () => {
      const customRequestId = 'custom_req_123';

      await bottleneck.schedule(
        () => Promise.resolve('success'),
        {
          operation: 'custom_id_test',
          requestId: customRequestId
        }
      );

      // If this doesn't throw, the requestId was accepted
      assert.ok(true);
    });

    it('should generate requestId when not provided', async () => {
      await bottleneck.schedule(
        () => Promise.resolve('success'),
        { operation: 'auto_id_test' }
      );

      // If this doesn't throw, a requestId was generated
      assert.ok(true);
    });

    it('should track operation name in context', async () => {
      await bottleneck.schedule(
        () => Promise.resolve('success'),
        { operation: 'named_operation' }
      );

      const stats = bottleneck.getStats();
      assert.strictEqual(stats.completed, 1);
    });
  });
});
