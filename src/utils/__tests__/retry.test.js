/**
 * ROM Agent - Retry with Backoff Tests
 * Comprehensive test suite for retry logic
 */

import { describe, it, beforeEach, mock, before } from 'node:test';
import assert from 'node:assert';

// Set environment variables BEFORE importing modules
process.env.RETRY_ENABLED = 'true';
process.env.ENABLE_RETRY = 'true';

import {
  retryWithBackoff,
  retryBedrockCall,
  retryAwsCommand,
  isRetryableError,
  calculateBackoffDelay
} from '../retry-with-backoff.js';
import featureFlags from '../feature-flags.js';

describe('Retry with Backoff', () => {
  // Force reload flags after setting env vars
  before(() => {
    featureFlags.reload();
  });

  describe('isRetryableError', () => {
    it('should identify 429 as retryable', () => {
      const error = { statusCode: 429, message: 'Too Many Requests' };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should identify 500 as retryable', () => {
      const error = { statusCode: 500, message: 'Internal Server Error' };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should identify 502 as retryable', () => {
      const error = { statusCode: 502 };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should identify 503 as retryable', () => {
      const error = { statusCode: 503 };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should identify 504 as retryable', () => {
      const error = { statusCode: 504 };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should NOT retry 400 errors', () => {
      const error = { statusCode: 400, message: 'Bad Request' };
      assert.strictEqual(isRetryableError(error), false);
    });

    it('should NOT retry 404 errors', () => {
      const error = { statusCode: 404, message: 'Not Found' };
      assert.strictEqual(isRetryableError(error), false);
    });

    it('should NOT retry 401 errors', () => {
      const error = { statusCode: 401, message: 'Unauthorized' };
      assert.strictEqual(isRetryableError(error), false);
    });

    it('should identify ThrottlingException as retryable', () => {
      const error = { name: 'ThrottlingException', message: 'Rate exceeded' };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should identify ServiceUnavailableException as retryable', () => {
      const error = { name: 'ServiceUnavailableException' };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should identify timeout errors as retryable', () => {
      const error = { name: 'TimeoutError', message: 'Request timed out' };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should identify ETIMEDOUT as retryable', () => {
      const error = { code: 'ETIMEDOUT', message: 'Connection timed out' };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should identify ECONNRESET as retryable', () => {
      const error = { code: 'ECONNRESET' };
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should handle AWS SDK error format with $metadata', () => {
      const error = {
        name: 'InternalServerException',
        $metadata: { httpStatusCode: 500 }
      };
      assert.strictEqual(isRetryableError(error), true);
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate correct delay for attempt 0', () => {
      const delay = calculateBackoffDelay(0);
      // Should be ~1000ms ±20% = 800-1200ms
      assert.ok(delay >= 800, `delay ${delay} should be >= 800`);
      assert.ok(delay <= 1200, `delay ${delay} should be <= 1200`);
    });

    it('should calculate correct delay for attempt 1', () => {
      const delay = calculateBackoffDelay(1);
      // Should be ~2000ms ±20% = 1600-2400ms
      assert.ok(delay >= 1600);
      assert.ok(delay <= 2400);
    });

    it('should calculate correct delay for attempt 2', () => {
      const delay = calculateBackoffDelay(2);
      // Should be ~4000ms ±20% = 3200-4800ms, but capped at 4000
      assert.ok(delay >= 3200);
      assert.ok(delay <= 4800);
    });

    it('should not exceed maxDelayMs', () => {
      const delay = calculateBackoffDelay(10); // Very high attempt
      // Should be capped at 4000ms + jitter
      assert.ok(delay <= 4800); // 4000 + 20%
    });

    it('should apply jitter to create variance', () => {
      const delays = Array.from({ length: 10 }, () => calculateBackoffDelay(0));
      const uniqueDelays = new Set(delays);
      // With jitter, should get different values
      assert.ok(uniqueDelays.size > 1, 'Jitter should create variance');
    });
  });

  describe('retryWithBackoff - Success Cases', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = mock.fn(() => Promise.resolve('success'));

      const result = await retryWithBackoff(mockFn, {
        operation: 'test_operation'
      });

      assert.strictEqual(result, 'success');
      assert.strictEqual(mockFn.mock.calls.length, 1);
    });

    it('should succeed after 1 retry', async () => {
      let callCount = 0;
      const mockFn = mock.fn(() => {
        if (callCount++ === 0) {
          return Promise.reject({ statusCode: 429, message: 'Rate limit' });
        }
        return Promise.resolve('success');
      });

      const result = await retryWithBackoff(mockFn, {
        operation: 'test_retry_once',
        maxRetries: 3,
        baseDelayMs: 10
      });

      assert.strictEqual(result, 'success');
      assert.strictEqual(mockFn.mock.calls.length, 2);
    });

    it('should succeed after 2 retries', async () => {
      let callCount = 0;
      const mockFn = mock.fn(() => {
        if (callCount === 0) {
          callCount++;
          return Promise.reject({ statusCode: 503 });
        }
        if (callCount === 1) {
          callCount++;
          return Promise.reject({ statusCode: 502 });
        }
        return Promise.resolve('success');
      });

      const result = await retryWithBackoff(mockFn, {
        operation: 'test_retry_twice',
        maxRetries: 3,
        baseDelayMs: 10
      });

      assert.strictEqual(result, 'success');
      assert.strictEqual(mockFn.mock.calls.length, 3);
    });
  });

  describe('retryWithBackoff - Failure Cases', () => {
    it('should fail immediately on non-retryable error (400)', async () => {
      const mockFn = mock.fn(() =>
        Promise.reject({ statusCode: 400, message: 'Bad Request' })
      );

      await assert.rejects(
        () => retryWithBackoff(mockFn, { maxRetries: 3, baseDelayMs: 10 }),
        (error) => {
          assert.strictEqual(error.statusCode, 400);
          return true;
        }
      );

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });

    it('should fail immediately on non-retryable error (404)', async () => {
      const mockFn = mock.fn(() =>
        Promise.reject({ statusCode: 404, message: 'Not Found' })
      );

      await assert.rejects(
        () => retryWithBackoff(mockFn, { maxRetries: 3, baseDelayMs: 10 }),
        (error) => {
          assert.strictEqual(error.statusCode, 404);
          return true;
        }
      );

      assert.strictEqual(mockFn.mock.calls.length, 1);
    });

    it('should exhaust retries and fail', async () => {
      const mockFn = mock.fn(() =>
        Promise.reject({ statusCode: 503, message: 'Service Unavailable' })
      );

      await assert.rejects(
        () => retryWithBackoff(mockFn, { maxRetries: 3, baseDelayMs: 10 }),
        (error) => {
          assert.strictEqual(error.statusCode, 503);
          return true;
        }
      );

      assert.strictEqual(mockFn.mock.calls.length, 4); // Initial + 3 retries
    });

    it('should respect maxRetries configuration', async () => {
      const mockFn = mock.fn(() => Promise.reject({ statusCode: 500 }));

      await assert.rejects(
        () => retryWithBackoff(mockFn, { maxRetries: 2, baseDelayMs: 10 }),
        (error) => {
          assert.strictEqual(error.statusCode, 500);
          return true;
        }
      );

      assert.strictEqual(mockFn.mock.calls.length, 3); // Initial + 2 retries
    });
  });

  describe('retryBedrockCall', () => {
    it('should wrap Bedrock call with retry logic', async () => {
      const mockBedrockFn = mock.fn(() => Promise.resolve({ output: 'result' }));

      const result = await retryBedrockCall(mockBedrockFn, {
        modelId: 'claude-sonnet-4.5',
        operation: 'converse'
      });

      assert.deepStrictEqual(result, { output: 'result' });
      assert.strictEqual(mockBedrockFn.mock.calls.length, 1);
    });

    it('should retry Bedrock call on 429', async () => {
      let callCount = 0;
      const mockBedrockFn = mock.fn(() => {
        if (callCount++ === 0) {
          return Promise.reject({
            name: 'ThrottlingException',
            $metadata: { httpStatusCode: 429 }
          });
        }
        return Promise.resolve({ output: 'result' });
      });

      const result = await retryBedrockCall(mockBedrockFn, {
        modelId: 'claude-sonnet-4.5'
      });

      assert.deepStrictEqual(result, { output: 'result' });
      assert.strictEqual(mockBedrockFn.mock.calls.length, 2);
    });
  });

  describe('retryAwsCommand', () => {
    it('should wrap AWS command with retry logic', async () => {
      const mockClient = {
        send: mock.fn(() => Promise.resolve({ data: 'success' }))
      };
      const mockCommand = { constructor: { name: 'TestCommand' } };

      const result = await retryAwsCommand(mockClient, mockCommand, {
        operation: 'test_command'
      });

      assert.deepStrictEqual(result, { data: 'success' });
      assert.strictEqual(mockClient.send.mock.calls.length, 1);
    });

    it('should retry AWS command on service error', async () => {
      let callCount = 0;
      const mockClient = {
        send: mock.fn(() => {
          if (callCount++ === 0) {
            return Promise.reject({
              name: 'ServiceUnavailableException',
              $metadata: { httpStatusCode: 503 }
            });
          }
          return Promise.resolve({ data: 'success' });
        })
      };
      const mockCommand = { constructor: { name: 'InvokeModelCommand' } };

      const result = await retryAwsCommand(mockClient, mockCommand);

      assert.deepStrictEqual(result, { data: 'success' });
      assert.strictEqual(mockClient.send.mock.calls.length, 2);
    });
  });

  describe('Backoff Timing', () => {
    it('should apply exponential backoff delays', async () => {
      let callCount = 0;
      const mockFn = mock.fn(() => {
        if (callCount < 2) {
          callCount++;
          return Promise.reject({ statusCode: 500 });
        }
        return Promise.resolve('success');
      });

      const startTime = Date.now();

      await retryWithBackoff(mockFn, {
        maxRetries: 3,
        baseDelayMs: 100,
        jitterPercent: 0 // Disable jitter for predictable timing
      });

      const duration = Date.now() - startTime;

      // Should wait: 100ms (1st retry) + 200ms (2nd retry) = ~300ms
      assert.ok(duration >= 280, `Duration ${duration}ms should be >= 280ms`);
      assert.ok(duration < 500, `Duration ${duration}ms should be < 500ms`);
    });
  });
});
