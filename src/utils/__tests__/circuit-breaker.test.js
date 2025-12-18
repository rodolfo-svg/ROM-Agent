/**
 * ROM Agent - Circuit Breaker Tests
 * Comprehensive test suite for circuit breaker pattern
 */

import { describe, it, beforeEach, mock, before } from 'node:test';
import assert from 'node:assert';

// Set environment variables BEFORE importing modules
process.env.ENABLE_CIRCUIT_BREAKER = 'true';
process.env.CIRCUIT_BREAKER_THRESHOLD = '3'; // Lower threshold for faster tests

import { CircuitBreaker, CircuitState } from '../circuit-breaker.js';
import { executeWithFallback, FALLBACK_CHAIN } from '../model-fallback.js';
import featureFlags from '../feature-flags.js';

describe('Circuit Breaker', () => {
  let circuitBreaker;

  // Force reload flags after setting env vars
  before(() => {
    featureFlags.reload();
  });

  beforeEach(() => {
    // Create fresh instance for each test with shorter timeouts
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeWindowMs: 1000, // 1 second window
      openStateTimeoutMs: 100 // 100ms cooldown for faster tests
    });
  });

  describe('States and Transitions', () => {
    it('should initialize in CLOSED state', () => {
      const stats = circuitBreaker.getStats();
      assert.strictEqual(stats.state, CircuitState.CLOSED);
      assert.strictEqual(stats.recentFailures, 0);
    });

    it('should transition to OPEN after threshold failures', async () => {
      const failFn = mock.fn(() => Promise.reject(new Error('Service error')));

      // Trigger 3 failures (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failFn, { operation: 'test' });
        } catch (e) { /* expected */ }
      }

      const stats = circuitBreaker.getStats();
      assert.strictEqual(stats.state, CircuitState.OPEN);
      assert.strictEqual(stats.recentFailures, 3);
    });

    it('should block requests when OPEN', async () => {
      // Force circuit to OPEN state
      circuitBreaker.forceOpen('Test');

      const mockFn = mock.fn(() => Promise.resolve('success'));

      await assert.rejects(
        () => circuitBreaker.execute(mockFn, { operation: 'test' }),
        (error) => {
          assert.strictEqual(error.code, 'CIRCUIT_BREAKER_OPEN');
          assert.strictEqual(error.state, CircuitState.OPEN);
          assert.ok(error.message.includes('Circuit breaker is OPEN'));
          return true;
        }
      );

      // Function should not have been called
      assert.strictEqual(mockFn.mock.calls.length, 0);
    });

    it('should transition to HALF_OPEN after cooldown', async () => {
      // Force circuit OPEN
      circuitBreaker.forceOpen('Test');

      assert.strictEqual(circuitBreaker.state, CircuitState.OPEN);

      // Wait for cooldown (100ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 120));

      assert.strictEqual(circuitBreaker.state, CircuitState.HALF_OPEN);
    });

    it('should transition to CLOSED on successful test in HALF_OPEN', async () => {
      // Force OPEN then wait for HALF_OPEN
      circuitBreaker.forceOpen('Test');
      await new Promise(resolve => setTimeout(resolve, 120));

      assert.strictEqual(circuitBreaker.state, CircuitState.HALF_OPEN);

      // Execute successful request
      const successFn = mock.fn(() => Promise.resolve('success'));
      const result = await circuitBreaker.execute(successFn, { operation: 'test' });

      assert.strictEqual(result, 'success');
      assert.strictEqual(circuitBreaker.state, CircuitState.CLOSED);
    });

    it('should transition back to OPEN on failed test in HALF_OPEN', async () => {
      // Force OPEN then wait for HALF_OPEN
      circuitBreaker.forceOpen('Test');
      await new Promise(resolve => setTimeout(resolve, 120));

      assert.strictEqual(circuitBreaker.state, CircuitState.HALF_OPEN);

      // Execute failing request
      const failFn = mock.fn(() => Promise.reject(new Error('Still failing')));

      try {
        await circuitBreaker.execute(failFn, { operation: 'test' });
      } catch (e) { /* expected */ }

      assert.strictEqual(circuitBreaker.state, CircuitState.OPEN);
    });
  });

  describe('Failure Tracking', () => {
    it('should track failures within time window', async () => {
      const failFn = mock.fn(() => Promise.reject(new Error('Error')));

      // Add 2 failures
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failFn, { operation: 'test' });
        } catch (e) { /* expected */ }
      }

      const stats = circuitBreaker.getStats();
      assert.strictEqual(stats.recentFailures, 2);
      assert.strictEqual(stats.state, CircuitState.CLOSED);
    });

    it('should clean old failures outside time window', async () => {
      const failFn = mock.fn(() => Promise.reject(new Error('Error')));

      // Add 2 failures
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failFn, { operation: 'test' });
        } catch (e) { /* expected */ }
      }

      // Wait for time window to expire (1000ms + buffer)
      await new Promise(resolve => setTimeout(resolve, 1100));

      const stats = circuitBreaker.getStats();
      // Failures should be cleaned
      assert.strictEqual(stats.recentFailures, 0);
    });

    it('should count only recent failures for threshold', async () => {
      const failFn = mock.fn(() => Promise.reject(new Error('Error')));

      // Add 2 failures
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failFn, { operation: 'test' });
        } catch (e) { /* expected */ }
      }

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Add 2 more failures (after window reset)
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failFn, { operation: 'test' });
        } catch (e) { /* expected */ }
      }

      // Should still be CLOSED (only 2 recent failures, threshold is 3)
      const stats = circuitBreaker.getStats();
      assert.strictEqual(stats.state, CircuitState.CLOSED);
      assert.strictEqual(stats.recentFailures, 2);
    });
  });

  describe('Statistics', () => {
    it('should track total requests', async () => {
      const successFn = mock.fn(() => Promise.resolve('ok'));

      await circuitBreaker.execute(successFn, { operation: 'test' });
      await circuitBreaker.execute(successFn, { operation: 'test' });

      const stats = circuitBreaker.getStats();
      assert.strictEqual(stats.totalRequests, 2);
      assert.strictEqual(stats.successfulRequests, 2);
    });

    it('should track successful vs failed requests', async () => {
      const successFn = mock.fn(() => Promise.resolve('ok'));
      const failFn = mock.fn(() => Promise.reject(new Error('Error')));

      await circuitBreaker.execute(successFn, { operation: 'test' });

      try {
        await circuitBreaker.execute(failFn, { operation: 'test' });
      } catch (e) { /* expected */ }

      const stats = circuitBreaker.getStats();
      assert.strictEqual(stats.successfulRequests, 1);
      assert.strictEqual(stats.failedRequests, 1);
    });

    it('should track rejected requests when OPEN', async () => {
      circuitBreaker.forceOpen('Test');

      const mockFn = mock.fn(() => Promise.resolve('ok'));

      // Try 3 requests while OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn, { operation: 'test' });
        } catch (e) { /* expected */ }
      }

      const stats = circuitBreaker.getStats();
      assert.strictEqual(stats.rejectedRequests, 3);
    });
  });

  describe('Manual Controls', () => {
    it('should allow manual reset to CLOSED', async () => {
      circuitBreaker.forceOpen('Test');
      assert.strictEqual(circuitBreaker.state, CircuitState.OPEN);

      circuitBreaker.reset();

      assert.strictEqual(circuitBreaker.state, CircuitState.CLOSED);
      const stats = circuitBreaker.getStats();
      assert.strictEqual(stats.recentFailures, 0);
    });

    it('should allow forcing OPEN state', () => {
      assert.strictEqual(circuitBreaker.state, CircuitState.CLOSED);

      circuitBreaker.forceOpen('Manual intervention');

      assert.strictEqual(circuitBreaker.state, CircuitState.OPEN);
    });
  });

  describe('Feature Flag Integration', () => {
    it('should bypass circuit breaker when flag is disabled', async () => {
      // Temporarily disable
      const originalEnabled = process.env.ENABLE_CIRCUIT_BREAKER;
      process.env.ENABLE_CIRCUIT_BREAKER = 'false';
      featureFlags.reload();

      circuitBreaker.forceOpen('Test');

      const mockFn = mock.fn(() => Promise.resolve('success'));

      // Should execute even though circuit is OPEN
      const result = await circuitBreaker.execute(mockFn, { operation: 'test' });

      assert.strictEqual(result, 'success');
      assert.strictEqual(mockFn.mock.calls.length, 1);

      // Restore
      process.env.ENABLE_CIRCUIT_BREAKER = originalEnabled;
      featureFlags.reload();
    });
  });
});

describe('Model Fallback', () => {
  describe('Fallback Chain', () => {
    it('should have correct fallback chain configuration', () => {
      assert.strictEqual(FALLBACK_CHAIN.length, 3);
      assert.strictEqual(FALLBACK_CHAIN[0].tier, 'primary');
      assert.strictEqual(FALLBACK_CHAIN[1].tier, 'fallback');
      assert.strictEqual(FALLBACK_CHAIN[2].tier, 'emergency');
    });

    it('should use primary model first', async () => {
      const mockFn = mock.fn((modelId) => {
        assert.strictEqual(modelId, FALLBACK_CHAIN[0].modelId);
        return Promise.resolve('success');
      });

      const result = await executeWithFallback(
        mockFn,
        FALLBACK_CHAIN[0].modelId,
        { operation: 'test' }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.usedFallback, false);
      assert.strictEqual(mockFn.mock.calls.length, 1);
    });

    it('should fallback to next model on failure', async () => {
      let callCount = 0;
      const mockFn = mock.fn((modelId) => {
        callCount++;
        if (callCount === 1) {
          // Primary fails
          assert.strictEqual(modelId, FALLBACK_CHAIN[0].modelId);
          return Promise.reject(new Error('Primary failed'));
        }
        // Fallback succeeds
        assert.strictEqual(modelId, FALLBACK_CHAIN[1].modelId);
        return Promise.resolve('success');
      });

      const result = await executeWithFallback(
        mockFn,
        FALLBACK_CHAIN[0].modelId,
        { operation: 'test' }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.usedFallback, true);
      assert.strictEqual(result.modelId, FALLBACK_CHAIN[1].modelId);
      assert.strictEqual(mockFn.mock.calls.length, 2);
    });

    it('should try all models in chain', async () => {
      let callCount = 0;
      const mockFn = mock.fn((modelId) => {
        callCount++;
        if (callCount < 3) {
          // First 2 models fail
          return Promise.reject(new Error(`Model ${callCount} failed`));
        }
        // Last model succeeds
        assert.strictEqual(modelId, FALLBACK_CHAIN[2].modelId);
        return Promise.resolve('success');
      });

      const result = await executeWithFallback(
        mockFn,
        FALLBACK_CHAIN[0].modelId,
        { operation: 'test' }
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.usedFallback, true);
      assert.strictEqual(result.modelId, FALLBACK_CHAIN[2].modelId);
      assert.strictEqual(result.failedModels.length, 2);
      assert.strictEqual(mockFn.mock.calls.length, 3);
    });

    it('should fail when all models fail', async () => {
      const mockFn = mock.fn(() => Promise.reject(new Error('All models failed')));

      await assert.rejects(
        () => executeWithFallback(mockFn, FALLBACK_CHAIN[0].modelId, { operation: 'test' }),
        (error) => {
          assert.strictEqual(error.code, 'FALLBACK_CHAIN_EXHAUSTED');
          assert.strictEqual(error.errors.length, 3);
          assert.ok(error.message.includes('All models in fallback chain failed'));
          return true;
        }
      );

      assert.strictEqual(mockFn.mock.calls.length, 3);
    });
  });
});
