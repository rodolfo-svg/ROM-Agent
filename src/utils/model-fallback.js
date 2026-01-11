/**
 * ROM Agent - Model Fallback Chain
 * Provides automatic fallback to alternative models when primary fails
 *
 * @module model-fallback
 * @version 1.0.0
 */

import { logger } from './logger.js';
import metricsCollector from './metrics-collector-v2.js';

function classifyFallbackReason(err) {
  const name = (err && err.name) ? String(err.name) : "Error";
  const code = err && err.$metadata && err.$metadata.httpStatusCode ? err.$metadata.httpStatusCode : undefined;
  const msg  = (err && err.message) ? String(err.message) : "";
  const s = (name + " " + code + " " + msg).toLowerCase();
  if (s.includes("thrott") || code === 429) return "throttle";
  if (s.includes("accessdenied") || s.includes("unauthorized") || code === 403) return "access_denied";
  if (s.includes("validation") || code === 400) return "validation";
  if (s.includes("timeout") || s.includes("abort") || s.includes("etimedout")) return "timeout";
  return "other";
}

function debugFallbackLog(payload) {
  if (process.env.ROM_FALLBACK_DEBUG !== "1") return;
  try {
    console.error(JSON.stringify({ lvl: "warn", event: "model_fallback", ...payload }));
  } catch (_) {}
}


// ============================================================
// FALLBACK CONFIGURATION
// ============================================================

/**
 * Model fallback chain - Optimized for Quality + Cost + Speed
 * Premium -> Primary -> Fast -> Economical -> Stable -> Emergency
 *
 * Strategy:
 * - Tier 0: Claude Opus 4.5 (maximum quality, most powerful)
 * - Tier 1: Claude Sonnet 4.5 (best cost-benefit, excellent quality)
 * - Tier 2: Claude Haiku 4.5 (fast, economical, high quality)
 * - Tier 3: Amazon Nova Pro (70% cheaper, good quality)
 * - Tier 4: Claude 3.7 (proven stability)
 * - Tier 5: Amazon Nova Lite (ultra-economical emergency)
 */
export const FALLBACK_CHAIN = [
  {
    modelId: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    tier: 'premium',
    quality: 'maximum',
    speed: 'slow',
    cost: 'high',
    description: 'Claude Opus 4.5 - Most powerful, maximum quality'
  },
  {
    modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    tier: 'primary',
    quality: 'highest',
    speed: 'medium',
    cost: 'medium',
    description: 'Claude Sonnet 4.5 - Best cost-benefit ratio'
  },
  {
    modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    tier: 'fallback-fast',
    quality: 'high',
    speed: 'fastest',
    cost: 'low',
    description: 'Claude Haiku 4.5 - Fast & economical with high quality'
  },
  {
    modelId: 'us.amazon.nova-pro-v1:0',
    tier: 'fallback-economical',
    quality: 'high',
    speed: 'medium',
    cost: 'very-low',
    description: 'Amazon Nova Pro - 70% cheaper, comparable quality'
  },
  {
    modelId: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
    tier: 'fallback-stable',
    quality: 'high',
    speed: 'medium',
    cost: 'medium',
    description: 'Claude Sonnet 3.7 - Proven stability'
  },
  {
    modelId: 'us.amazon.nova-lite-v1:0',
    tier: 'emergency',
    quality: 'reliable',
    speed: 'fast',
    cost: 'minimal',
    description: 'Amazon Nova Lite - Ultra-economical emergency fallback'
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

      // Get next model in chain (MUST be before using fallbackModel)
      const fallbackModel = getFallbackModel(currentModelId);

      const reason = classifyFallbackReason(error);
      debugFallbackLog({ from: currentModelId, to: fallbackModel?.modelId, reason, error: error?.message });
      metricsCollector.incrementModelFallbackAttempt('converse', currentModelId, fallbackModel?.modelId || 'none', reason);

      if (!fallbackModel) {
        // No more fallbacks available
        logger.error('All models in fallback chain failed', {
          errors: errors.map(e => ({
            model: e.model,
            error: e.error
          })),
          operation: context.operation
        });

        debugFallbackLog({ exhausted: true, errors: errors.map(e => ({ model: e.model, error: e.error })) });
        metricsCollector.incrementModelFallbackExhausted('converse');

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
