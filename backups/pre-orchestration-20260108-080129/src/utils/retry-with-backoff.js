/**
 * ROM Agent - Retry with Exponential Backoff
 * Implements retry logic with exponential backoff and jitter for AWS Bedrock calls
 *
 * @module retry-with-backoff
 * @version 1.0.0
 */

import { logger } from './logger.js';
import featureFlags from './feature-flags.js';

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,        // 1 second
  maxDelayMs: 4000,         // 4 seconds
  jitterPercent: 20,        // ±20%
  retryableStatusCodes: [429, 500, 502, 503, 504],
  retryableErrors: [
    'ThrottlingException',
    'ServiceUnavailableException',
    'InternalServerException',
    'RequestTimeout',
    'TimeoutError',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND'
  ]
};

// ============================================================
// ERROR CLASSIFICATION
// ============================================================

/**
 * Determines if an error is retryable
 * @param {Error|object} error - Error object
 * @returns {boolean} True if error is retryable
 */
export function isRetryableError(error) {
  if (!error) return false;

  // Check HTTP status codes
  if (error.statusCode || error.$metadata?.httpStatusCode) {
    const statusCode = error.statusCode || error.$metadata?.httpStatusCode;
    if (DEFAULT_CONFIG.retryableStatusCodes.includes(statusCode)) {
      return true;
    }
    // Don't retry 4xx errors (except 429)
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }
  }

  // Check error names and types
  const errorName = error.name || error.code || '';
  if (DEFAULT_CONFIG.retryableErrors.some(e => errorName.includes(e))) {
    return true;
  }

  // Check error messages for timeout indicators
  const errorMessage = (error.message || '').toLowerCase();
  if (errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorMessage.includes('deadline exceeded')) {
    return true;
  }

  // 5xx errors are retryable by default
  if (error.statusCode >= 500) {
    return true;
  }

  return false;
}

/**
 * Extracts meaningful error information for logging
 * @param {Error|object} error - Error object
 * @returns {object} Structured error info
 */
function getErrorInfo(error) {
  return {
    name: error.name || 'Unknown',
    code: error.code || error.name || 'UNKNOWN',
    statusCode: error.statusCode || error.$metadata?.httpStatusCode,
    message: error.message || 'No error message',
    retryable: isRetryableError(error)
  };
}

// ============================================================
// BACKOFF CALCULATION
// ============================================================

/**
 * Calculates delay with exponential backoff and jitter
 * Formula: baseDelay * (2 ^ attempt) + jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {object} config - Configuration options
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoffDelay(attempt, config = DEFAULT_CONFIG) {
  // Exponential backoff: 1s, 2s, 4s
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter: ±20% randomness
  const jitterAmount = cappedDelay * (config.jitterPercent / 100);
  const jitter = (Math.random() * 2 - 1) * jitterAmount; // Random between -jitterAmount and +jitterAmount

  const finalDelay = Math.max(0, cappedDelay + jitter);

  return Math.round(finalDelay);
}

/**
 * Sleeps for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// RETRY LOGIC
// ============================================================

/**
 * Executes a function with retry logic and exponential backoff
 *
 * @param {Function} fn - Async function to execute
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelayMs - Base delay in ms (default: 1000)
 * @param {number} options.maxDelayMs - Max delay in ms (default: 4000)
 * @param {number} options.jitterPercent - Jitter percentage (default: 20)
 * @param {string} options.operation - Operation name for logging
 * @param {object} options.context - Additional context for logging
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Last error if all retries fail
 */
export async function retryWithBackoff(fn, options = {}) {
  // Check if retry is DISABLED via feature flag (enabled by default for resilience)
  const retryDisabled = featureFlags.isEnabled('DISABLE_RETRY') ||
                        featureFlags.isEnabled('RETRY_DISABLED');

  if (retryDisabled) {
    // If retry is explicitly disabled, just execute once
    return await fn();
  }

  const config = {
    ...DEFAULT_CONFIG,
    ...options
  };

  const { maxRetries, operation = 'operation', context = {} } = config;

  let lastError;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Attempt the operation
      const result = await fn();

      // Success - log if this was a retry
      if (attempt > 0) {
        logger.info('Retry succeeded', {
          operation,
          attempt,
          totalAttempts: attempt + 1,
          ...context
        });
      }

      return result;

    } catch (error) {
      lastError = error;
      const errorInfo = getErrorInfo(error);

      // Check if error is retryable
      if (!isRetryableError(error)) {
        logger.warn('Non-retryable error encountered', {
          operation,
          attempt,
          ...errorInfo,
          ...context
        });
        throw error;
      }

      // Check if we have retries left
      if (attempt >= maxRetries) {
        logger.error('All retry attempts exhausted', {
          operation,
          totalAttempts: attempt + 1,
          maxRetries,
          ...errorInfo,
          ...context
        });
        throw error;
      }

      // Calculate backoff delay
      const delayMs = calculateBackoffDelay(attempt, config);

      logger.warn('Retryable error, will retry', {
        operation,
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        nextAttempt: attempt + 2,
        ...errorInfo,
        ...context
      });

      // Wait before retrying
      await sleep(delayMs);

      attempt++;
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

// ============================================================
// CONVENIENCE WRAPPERS
// ============================================================

/**
 * Wraps a Bedrock API call with retry logic
 * @param {Function} bedrockFn - Async Bedrock function to execute
 * @param {object} context - Context for logging (modelId, operation, etc)
 * @returns {Promise<any>} Result of the Bedrock call
 */
export async function retryBedrockCall(bedrockFn, context = {}) {
  return retryWithBackoff(bedrockFn, {
    operation: 'bedrock_call',
    context: {
      modelId: context.modelId || 'unknown',
      operation: context.operation || 'invoke',
      ...context
    }
  });
}

/**
 * Wraps an AWS SDK command execution with retry logic
 * @param {object} client - AWS SDK client
 * @param {object} command - AWS SDK command
 * @param {object} context - Context for logging
 * @returns {Promise<any>} Result of the command
 */
export async function retryAwsCommand(client, command, context = {}) {
  return retryWithBackoff(
    () => client.send(command),
    {
      operation: 'aws_command',
      context: {
        commandName: command.constructor.name,
        ...context
      }
    }
  );
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  retryWithBackoff,
  retryBedrockCall,
  retryAwsCommand,
  isRetryableError,
  calculateBackoffDelay
};
