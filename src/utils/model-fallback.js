/**
 * ROM Agent - Model Fallback Chain
 * Provides automatic fallback to alternative models when primary fails
 *
 * @module model-fallback
 * @version 1.0.0
 */

import { logger } from './logger.js';
import metricsCollector from './metrics-collector.js';

// ============================================================
// FALLBACK CONFIGURATION
// ============================================================

/**
 * Model fallback chain
 * Primary -> Fallback1 -> Fallback2
 *
 * Quality tiers:
 * - Tier 1 (Primary): Claude Sonnet 4.5 - Best quality, latest model
 * - Tier 2 (Fallback): Claude Sonnet 3.7 - High quality, stable
 * - Tier 3 (Emergency): Claude Sonnet 3.5 - Reliable fallback
 */
export const FALLBACK_CHAIN = [
  {
    modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    tier: 'primary',
    quality: 'highest',
    description: 'Claude Sonnet 4.5 - Latest model (Inference Profile)'
  },
  {
    modelId: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    tier: 'fallback',
    quality: 'high',
    description: 'Claude Sonnet 3.7 - Stable fallback'
  },
  {
    modelId: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    tier: 'emergency',
    quality: 'reliable',
    description: 'Claude Sonnet 3.5 - Emergency fallback'
  }
];

/**
 * Gets the fallback model for a given model ID
 *
 * @param {string} currentModelId - Current model that failed
 * @returns {Object|null} Next model in chain or null if no fallback available
 */
export function getFallbackModel(currentModelId) {
  const currentIndex = FALLBACK_CHAIN.findIndex(m => m.modelId === currentModelId);

  // If not found or last in chain, no fallback available
  if (currentIndex === -1 || currentIndex === FALLBACK_CHAIN.length - 1) {
    return null;
  }

  const fallbackModel = FALLBACK_CHAIN[currentIndex + 1];

  logger.info('Model fallback selected', {
    currentModel: currentModelId,
    fallbackModel: fallbackModel.modelId,
    tier: fallbackModel.tier,
    quality: fallbackModel.quality
  });

  metricsCollector.incrementModelFallback(currentModelId, fallbackModel.modelId);

  return fallbackModel;
}

/**
 * Gets the primary (default) model
 *
 * @returns {Object} Primary model configuration
 */
export function getPrimaryModel() {
  return FALLBACK_CHAIN[0];
}

/**
 * Checks if a model ID is in the fallback chain
 *
 * @param {string} modelId - Model ID to check
 * @returns {boolean} True if model is in chain
 */
export function isValidModel(modelId) {
  return FALLBACK_CHAIN.some(m => m.modelId === modelId);
}

/**
 * Gets model information by ID
 *
 * @param {string} modelId - Model ID
 * @returns {Object|null} Model configuration or null if not found
 */
export function getModelInfo(modelId) {
  return FALLBACK_CHAIN.find(m => m.modelId === modelId) || null;
}

/**
 * Executes a function with automatic model fallback
 *
 * @param {Function} fn - Async function to execute (receives modelId as parameter)
 * @param {string} initialModelId - Initial model to try
 * @param {Object} context - Context for logging
 * @returns {Promise<Object>} Result with model used and response
 * @throws {Error} If all models in chain fail
 */
export async function executeWithFallback(fn, initialModelId, context = {}) {
  let currentModelId = initialModelId;
  const errors = [];

  while (currentModelId) {
    try {
      logger.debug('Attempting request with model', {
        modelId: currentModelId,
        operation: context.operation,
        attempt: errors.length + 1
      });

      // Execute function with current model
      const result = await fn(currentModelId);

      // Success - return result with model used
      if (errors.length > 0) {
        logger.info('Request succeeded with fallback model', {
          finalModel: currentModelId,
          failedModels: errors.map(e => e.model),
          operation: context.operation
        });

        metricsCollector.incrementModelFallbackSuccess(currentModelId);
      }

      return {
        success: true,
        modelId: currentModelId,
        usedFallback: errors.length > 0,
        failedModels: errors.map(e => e.model),
        result
      };

    } catch (error) {
      // Record failure
      errors.push({
        model: currentModelId,
        error: error.message || 'Unknown error',
        code: error.code
      });

      logger.warn('Request failed with model, trying fallback', {
        failedModel: currentModelId,
        error: error.message,
        operation: context.operation,
        attemptsRemaining: FALLBACK_CHAIN.length - errors.length
      });

      metricsCollector.incrementModelFallbackAttempt(currentModelId);

      // Get next model in chain
      const fallbackModel = getFallbackModel(currentModelId);

      if (!fallbackModel) {
        // No more fallbacks available
        logger.error('All models in fallback chain failed', {
          errors: errors.map(e => ({
            model: e.model,
            error: e.error
          })),
          operation: context.operation
        });

        metricsCollector.incrementModelFallbackExhausted();

        // Throw error with full context
        const chainError = new Error(`All models in fallback chain failed (${errors.length} attempts)`);
        chainError.code = 'FALLBACK_CHAIN_EXHAUSTED';
        chainError.errors = errors;
        chainError.lastError = errors[errors.length - 1];
        throw chainError;
      }

      // Try next model
      currentModelId = fallbackModel.modelId;
    }
  }

  // Should never reach here
  throw new Error('Model fallback logic error');
}

/**
 * Gets statistics about model fallback usage
 *
 * @returns {Object} Fallback statistics
 */
export function getFallbackStats() {
  return {
    chain: FALLBACK_CHAIN.map(m => ({
      modelId: m.modelId,
      tier: m.tier,
      quality: m.quality
    })),
    primaryModel: FALLBACK_CHAIN[0].modelId,
    fallbackLevels: FALLBACK_CHAIN.length - 1
  };
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  FALLBACK_CHAIN,
  getFallbackModel,
  getPrimaryModel,
  isValidModel,
  getModelInfo,
  executeWithFallback,
  getFallbackStats
};
