/**
 * ROM Agent - Circuit Breaker Pattern
 * Prevents cascading failures by monitoring error rates and temporarily blocking requests
 *
 * @module circuit-breaker
 * @version 1.0.0
 */

import { logger } from './logger.js';
import featureFlags from './feature-flags.js';
import metricsCollector from './metrics-collector.js';

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_CONFIG = {
  failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10), // 5 failures
  timeWindowMs: 60000, // 60 seconds
  openStateTimeoutMs: 30000, // 30 seconds
  halfOpenMaxAttempts: 1, // Test with 1 request
  enabled: true // Default ENABLED for production resilience (can be disabled via DISABLE_CIRCUIT_BREAKER flag)
};

// Circuit States
export const CircuitState = {
  CLOSED: 'CLOSED', // Normal operation
  OPEN: 'OPEN', // Blocking requests
  HALF_OPEN: 'HALF_OPEN' // Testing recovery
};

// ============================================================
// CIRCUIT BREAKER CLASS
// ============================================================

/**
 * Circuit Breaker implementation
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests blocked for cooldown period
 * - HALF_OPEN: Testing recovery, allows limited requests
 *
 * Transitions:
 * - CLOSED -> OPEN: When failure threshold exceeded in time window
 * - OPEN -> HALF_OPEN: After cooldown timeout
 * - HALF_OPEN -> CLOSED: If test request succeeds
 * - HALF_OPEN -> OPEN: If test request fails
 */
export class CircuitBreaker {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // State management
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.halfOpenAttempts = 0;
    this.openStateTimeout = null;
    this.lastStateChange = Date.now();

    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      stateChanges: 0
    };

    logger.info('Circuit Breaker initialized', {
      state: this.state,
      failureThreshold: this.config.failureThreshold,
      timeWindowMs: this.config.timeWindowMs,
      openStateTimeoutMs: this.config.openStateTimeoutMs,
      enabled: this.config.enabled
    });
  }

  /**
   * Executes a function with circuit breaker protection
   *
   * @param {Function} fn - Async function to execute
   * @param {Object} context - Context for logging (modelId, operation, etc)
   * @returns {Promise<any>} Result of the function
   * @throws {Error} Circuit breaker error if circuit is open
   */
  async execute(fn, context = {}) {
    // Check if circuit breaker is enabled
    if (!featureFlags.isEnabled('ENABLE_CIRCUIT_BREAKER')) {
      // Bypass circuit breaker when disabled
      return await fn();
    }

    this.stats.totalRequests++;

    const operation = context.operation || 'unknown';
    const modelId = context.modelId || 'unknown';

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      this.stats.rejectedRequests++;
      metricsCollector.incrementCircuitBreakerRejection(operation);

      const timeInOpen = Date.now() - this.lastStateChange;
      const remainingTime = Math.max(0, this.config.openStateTimeoutMs - timeInOpen);

      logger.warn('Circuit Breaker: Request rejected (circuit OPEN)', {
        operation,
        modelId,
        state: this.state,
        remainingCooldownMs: remainingTime,
        recentFailures: this.failures.length
      });

      const error = new Error('Circuit breaker is OPEN - service temporarily unavailable');
      error.code = 'CIRCUIT_BREAKER_OPEN';
      error.state = this.state;
      error.retryAfter = Math.ceil(remainingTime / 1000); // seconds
      throw error;
    }

    // Execute request
    try {
      const result = await fn();

      // Success - record it
      this.onSuccess(context);

      return result;

    } catch (error) {
      // Failure - record it
      this.onFailure(error, context);

      throw error;
    }
  }

  /**
   * Records a successful request
   * @private
   */
  onSuccess(context = {}) {
    this.stats.successfulRequests++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Success in HALF_OPEN -> transition to CLOSED
      this.transitionTo(CircuitState.CLOSED, 'Test request succeeded');

      logger.info('Circuit Breaker: Recovery successful', {
        operation: context.operation,
        modelId: context.modelId,
        previousState: CircuitState.HALF_OPEN,
        newState: CircuitState.CLOSED
      });
    }

    metricsCollector.incrementCircuitBreakerSuccess(context.operation || 'unknown');
  }

  /**
   * Records a failed request
   * @private
   */
  onFailure(error, context = {}) {
    this.stats.failedRequests++;

    const now = Date.now();

    // Add failure to window
    this.failures.push({
      timestamp: now,
      error: error.message || 'Unknown error',
      operation: context.operation,
      modelId: context.modelId
    });

    // Clean old failures outside time window
    this.cleanOldFailures(now);

    logger.warn('Circuit Breaker: Request failed', {
      operation: context.operation,
      modelId: context.modelId,
      state: this.state,
      recentFailures: this.failures.length,
      threshold: this.config.failureThreshold,
      error: error.message
    });

    metricsCollector.incrementCircuitBreakerFailure(context.operation || 'unknown');

    // Check if we should trip the circuit
    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in HALF_OPEN -> back to OPEN
      this.transitionTo(CircuitState.OPEN, 'Test request failed');

      logger.error('Circuit Breaker: Recovery failed, re-opening circuit', {
        operation: context.operation,
        modelId: context.modelId
      });

    } else if (this.state === CircuitState.CLOSED) {
      // Check if threshold exceeded
      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN, `Failure threshold exceeded (${this.failures.length}/${this.config.failureThreshold})`);

        logger.error('Circuit Breaker: Circuit opened due to failures', {
          operation: context.operation,
          modelId: context.modelId,
          failures: this.failures.length,
          threshold: this.config.failureThreshold,
          cooldownMs: this.config.openStateTimeoutMs
        });
      }
    }
  }

  /**
   * Transitions circuit breaker to a new state
   * @private
   */
  transitionTo(newState, reason = '') {
    const previousState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    this.stats.stateChanges++;

    logger.info('Circuit Breaker: State transition', {
      previousState,
      newState,
      reason,
      timestamp: this.lastStateChange
    });

    metricsCollector.setCircuitBreakerState(newState);

    // Setup timeout for OPEN -> HALF_OPEN transition
    if (newState === CircuitState.OPEN) {
      // Clear any existing timeout
      if (this.openStateTimeout) {
        clearTimeout(this.openStateTimeout);
      }

      // Schedule transition to HALF_OPEN
      this.openStateTimeout = setTimeout(() => {
        this.transitionTo(CircuitState.HALF_OPEN, 'Cooldown period expired');
        this.halfOpenAttempts = 0;

        logger.info('Circuit Breaker: Entering HALF_OPEN for recovery test', {
          cooldownDuration: this.config.openStateTimeoutMs
        });
      }, this.config.openStateTimeoutMs);
    }

    // Clear failures when closing circuit
    if (newState === CircuitState.CLOSED) {
      this.failures = [];
      this.halfOpenAttempts = 0;

      if (this.openStateTimeout) {
        clearTimeout(this.openStateTimeout);
        this.openStateTimeout = null;
      }
    }
  }

  /**
   * Removes failures older than time window
   * @private
   */
  cleanOldFailures(now) {
    const cutoff = now - this.config.timeWindowMs;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  /**
   * Gets current circuit breaker statistics
   * @returns {Object} Statistics
   */
  getStats() {
    // Clean old failures before returning stats
    this.cleanOldFailures(Date.now());

    return {
      state: this.state,
      enabled: featureFlags.isEnabled('ENABLE_CIRCUIT_BREAKER'),
      recentFailures: this.failures.length,
      failureThreshold: this.config.failureThreshold,
      timeWindowMs: this.config.timeWindowMs,
      openStateTimeoutMs: this.config.openStateTimeoutMs,
      lastStateChange: this.lastStateChange,
      timeSinceLastChange: Date.now() - this.lastStateChange,
      ...this.stats
    };
  }

  /**
   * Manually resets circuit breaker to CLOSED state
   * Useful for testing or manual intervention
   */
  reset() {
    logger.info('Circuit Breaker: Manual reset', {
      previousState: this.state,
      failures: this.failures.length
    });

    this.transitionTo(CircuitState.CLOSED, 'Manual reset');
    this.failures = [];
    this.halfOpenAttempts = 0;

    if (this.openStateTimeout) {
      clearTimeout(this.openStateTimeout);
      this.openStateTimeout = null;
    }
  }

  /**
   * Manually forces circuit to OPEN state
   * Useful for testing or manual intervention
   */
  forceOpen(reason = 'Manually forced') {
    logger.warn('Circuit Breaker: Manually forced OPEN', { reason });
    this.transitionTo(CircuitState.OPEN, reason);
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

// Create singleton instance for Bedrock operations
export const bedrockCircuitBreaker = new CircuitBreaker({
  failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
  timeWindowMs: 60000, // 60 seconds
  openStateTimeoutMs: 30000 // 30 seconds
});

export default bedrockCircuitBreaker;
