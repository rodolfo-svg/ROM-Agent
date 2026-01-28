/**
 * ROM Agent - Retry Logic with Exponential Backoff
 * Handles transient failures with intelligent retry strategy
 *
 * @module retry
 * @version 1.0.0
 */

import featureFlags from './feature-flags.js';
import { logger } from './logger.js';

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_CONFIG = {
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2, // Double each time
  jitterFactor: 0.1, // 10% random jitter to avoid thundering herd
};

// ============================================================
// RETRY STRATEGIES
// ============================================================

/**
 * Calculate exponential backoff delay
 *
 * Formula: min(initialDelay * (multiplier ^ attempt), maxDelay) + jitter
 *
 * Example with defaults:
 * - Attempt 1: 1000ms + jitter
 * - Attempt 2: 2000ms + jitter
 * - Attempt 3: 4000ms + jitter
 * - Attempt 4: 8000ms + jitter
 *
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {Object} config - Configuration options
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt, config = DEFAULT_CONFIG) {
  const baseDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs
  );

  // Add random jitter to prevent thundering herd
  const jitter = baseDelay * config.jitterFactor * (Math.random() - 0.5);
  const delay = Math.round(baseDelay + jitter);

  return Math.max(0, delay);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// ERROR CLASSIFICATION
// ============================================================

/**
 * Determines if an error is retryable
 *
 * Retryable errors:
 * - Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED)
 * - HTTP 429 (Rate Limit)
 * - HTTP 500-504 (Server Errors)
 * - Timeout errors
 * - Circuit breaker open (temporary)
 *
 * Non-retryable errors:
 * - HTTP 400-403 (Client Errors - bad request, auth)
 * - HTTP 404 (Not Found)
 * - Validation errors
 *
 * @param {Error} error - The error to classify
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error) {
  // Network errors
  const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'ENETUNREACH'];
  if (error.code && networkErrors.includes(error.code)) {
    return true;
  }

  // HTTP status codes
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;

    // Rate limit - definitely retry
    if (status === 429) return true;

    // Server errors - retry
    if (status >= 500 && status <= 504) return true;

    // Client errors - don't retry (except 408 Request Timeout)
    if (status >= 400 && status < 500) {
      return status === 408;
    }
  }

  // Timeout errors
  if (error.message && (
    error.message.includes('timeout') ||
    error.message.includes('timed out') ||
    error.message.includes('ETIMEDOUT')
  )) {
    return true;
  }

  // Circuit breaker open - temporary, can retry
  if (error.code === 'CIRCUIT_BREAKER_OPEN') {
    return true;
  }

  // Default: don't retry unknown errors
  return false;
}

// ============================================================
// RETRY FUNCTION
// ============================================================

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts
 * @param {number} options.initialDelayMs - Initial delay before first retry
 * @param {number} options.maxDelayMs - Maximum delay between retries
 * @param {number} options.backoffMultiplier - Backoff multiplier
 * @param {Function} options.shouldRetry - Custom function to determine if error is retryable
 * @param {Function} options.onRetry - Callback before each retry
 * @param {Object} options.context - Context for logging (operation, modelId, etc)
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Last error if all retries exhausted
 */
export async function withRetry(fn, options = {}) {
  // Check if retry is enabled
  if (!featureFlags.isEnabled('ENABLE_RETRY_BACKOFF')) {
    // Bypass retry when disabled - execute once
    return await fn();
  }

  const config = { ...DEFAULT_CONFIG, ...options };
  const shouldRetry = options.shouldRetry || isRetryableError;
  const context = options.context || {};
  const operation = context.operation || 'unknown';

  let lastError;
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    try {
      // Execute function
      const result = await fn();

      // Success
      if (attempt > 0) {
        logger.info('Retry: Success after retries', {
          operation,
          attempt,
          totalAttempts: attempt + 1,
          ...context
        });
      }

      return result;

    } catch (error) {
      lastError = error;

      // Check if we should retry
      const canRetry = attempt < config.maxRetries && shouldRetry(error);

      if (!canRetry) {
        // No more retries or non-retryable error
        logger.error('Retry: Failed (not retrying)', {
          operation,
          attempt,
          maxRetries: config.maxRetries,
          retryable: shouldRetry(error),
          error: error.message,
          ...context
        });
        throw error;
      }

      // Calculate backoff delay
      const delay = calculateBackoff(attempt, config);

      logger.warn('Retry: Attempt failed, retrying...', {
        operation,
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        nextRetryIn: `${delay}ms`,
        error: error.message,
        errorCode: error.code,
        errorStatus: error.status || error.statusCode,
        ...context
      });

      // Call onRetry callback if provided
      if (options.onRetry) {
        await options.onRetry(error, attempt, delay);
      }

      // Wait before retry
      await sleep(delay);

      attempt++;
    }
  }

  // All retries exhausted
  logger.error('Retry: All attempts exhausted', {
    operation,
    totalAttempts: attempt,
    maxRetries: config.maxRetries,
    lastError: lastError?.message,
    ...context
  });

  throw lastError;
}

/**
 * Execute multiple functions with retry, return first successful result
 * Useful for fallback chains (try STJ, then DataJud, then Google)
 *
 * @param {Array<Function>} fns - Array of async functions to try
 * @param {Object} options - Retry options (applied to each function)
 * @returns {Promise<any>} Result from first successful function
 * @throws {Error} Last error if all functions fail
 */
export async function withFallback(fns, options = {}) {
  if (!Array.isArray(fns) || fns.length === 0) {
    throw new Error('withFallback requires non-empty array of functions');
  }

  const context = options.context || {};
  const operation = context.operation || 'fallback';

  let lastError;

  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    const attemptName = `${operation}_attempt_${i + 1}`;

    try {
      logger.info('Fallback: Trying alternative', {
        operation,
        attempt: i + 1,
        totalAlternatives: fns.length,
        ...context
      });

      // Try this function with retry
      const result = await withRetry(fn, {
        ...options,
        context: { ...context, fallbackAttempt: i + 1 }
      });

      // Success
      if (i > 0) {
        logger.info('Fallback: Success with alternative', {
          operation,
          successfulAttempt: i + 1,
          totalAlternatives: fns.length,
          ...context
        });
      }

      return result;

    } catch (error) {
      lastError = error;

      logger.warn('Fallback: Alternative failed', {
        operation,
        failedAttempt: i + 1,
        totalAlternatives: fns.length,
        remainingAlternatives: fns.length - i - 1,
        error: error.message,
        ...context
      });

      // Continue to next alternative
    }
  }

  // All alternatives exhausted
  logger.error('Fallback: All alternatives exhausted', {
    operation,
    totalAlternatives: fns.length,
    lastError: lastError?.message,
    ...context
  });

  throw lastError;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get retry statistics
 * @returns {Object} Statistics
 */
export function getRetryStats() {
  return {
    enabled: featureFlags.isEnabled('ENABLE_RETRY_BACKOFF'),
    maxRetries: DEFAULT_CONFIG.maxRetries,
    initialDelayMs: DEFAULT_CONFIG.initialDelayMs,
    maxDelayMs: DEFAULT_CONFIG.maxDelayMs,
    backoffMultiplier: DEFAULT_CONFIG.backoffMultiplier,
  };
}

/**
 * Simulate backoff delays for testing/preview
 * @param {number} maxRetries - Number of retries to simulate
 * @returns {Array<number>} Array of delays in milliseconds
 */
export function previewBackoffSchedule(maxRetries = 5) {
  const delays = [];
  for (let i = 0; i < maxRetries; i++) {
    delays.push(calculateBackoff(i));
  }
  return delays;
}

// Default export
export default {
  withRetry,
  withFallback,
  getRetryStats,
  previewBackoffSchedule,
  isRetryableError,
};
