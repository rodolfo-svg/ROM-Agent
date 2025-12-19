/**
 * ROM Agent - Resilient Bedrock Invocation
 * Unified wrapper combining Circuit Breaker, Model Fallback, Retry, and Bottleneck
 *
 * @module resilient-invoke
 * @version 1.0.0
 */

import { logger } from './logger.js';
import bedrockCircuitBreaker from './circuit-breaker.js';
import { executeWithFallback, getPrimaryModel } from './model-fallback.js';
import { retryAwsCommand } from './retry-with-backoff.js';
import bottleneck from './bottleneck.js';

/**
 * Execution order (from outer to inner):
 * 1. Bottleneck (rate limiting / concurrency control)
 * 2. Model Fallback (try primary, then fallbacks)
 * 3. Circuit Breaker (prevent cascading failures)
 * 4. Retry (exponential backoff for transient errors)
 * 5. Bedrock API Call (actual AWS SDK call)
 */

/**
 * Clona o Command preservando a classe do AWS SDK v3
 * @param {Object} command - Instância de Command (ConverseCommand, InvokeModelCommand, etc)
 * @param {Object} overrides - Propriedades para sobrescrever no input
 * @returns {Object} Nova instância do mesmo tipo de Command
 */
function cloneCommandWithOverrides(command, overrides = {}) {
  const Ctor = command?.constructor;

  // Se não é um Command válido, melhor falhar cedo (fica MUITO mais diagnosticável)
  if (!command || typeof command.resolveMiddleware !== "function" || typeof Ctor !== "function") {
    throw new Error(
      `INVALID_COMMAND_TO_SEND: ${command?.constructor?.name || typeof command}`
    );
  }

  const input = command.input || {};
  return new Ctor({ ...input, ...overrides });
}

/**
 * Invokes Bedrock with full resilience stack
 *
 * @param {Object} client - BedrockRuntimeClient instance
 * @param {Object} command - Bedrock command to execute
 * @param {Object} options - Configuration options
 * @param {string} [options.modelId] - Model ID to use (optional, uses primary if not specified)
 * @param {string} [options.operation] - Operation name for metrics/logging
 * @param {string} [options.requestId] - Request ID for tracing
 * @param {boolean} [options.enableFallback=true] - Enable model fallback
 * @param {boolean} [options.enableCircuitBreaker=true] - Enable circuit breaker
 * @param {number} [options.loopIteration] - Current loop iteration for tool use
 * @returns {Promise<Object>} Bedrock response with metadata
 */
export async function resilientInvoke(client, command, options = {}) {
  const {
    modelId: requestedModelId,
    operation = 'bedrock_invoke',
    requestId = `req_${Date.now()}`,
    enableFallback = true,
    enableCircuitBreaker = true,
    loopIteration
  } = options;

  // Determine initial model (use requested or fallback to primary)
  const initialModelId = requestedModelId || getPrimaryModel().modelId;

  logger.debug('Resilient invoke starting', {
    operation,
    requestId,
    initialModelId,
    enableFallback,
    enableCircuitBreaker,
    loopIteration
  });

  // Layer 1: Bottleneck (rate limiting)
  const result = await bottleneck.schedule(
    async () => {
      // Layer 2: Model Fallback (if enabled)
      if (enableFallback) {
        return await executeWithFallback(
          async (currentModelId) => {
            // Update command with current model using proper cloning
            const commandWithModel = cloneCommandWithOverrides(command, {
              modelId: currentModelId
            });

            // Layer 3: Circuit Breaker (if enabled)
            if (enableCircuitBreaker) {
              return await bedrockCircuitBreaker.execute(
                // Layer 4: Retry with exponential backoff
                () => retryAwsCommand(client, commandWithModel, {
                  modelId: currentModelId,
                  operation,
                  loopIteration
                }),
                {
                  modelId: currentModelId,
                  operation,
                  requestId
                }
              );
            } else {
              // Skip circuit breaker, just retry
              return await retryAwsCommand(client, commandWithModel, {
                modelId: currentModelId,
                operation,
                loopIteration
              });
            }
          },
          initialModelId,
          {
            operation,
            requestId
          }
        );
      } else {
        // No fallback - use single model
        const commandWithModel = {
          ...command,
          input: {
            ...command.input,
            modelId: initialModelId
          }
        };

        if (enableCircuitBreaker) {
          return await bedrockCircuitBreaker.execute(
            () => retryAwsCommand(client, commandWithModel, {
              modelId: initialModelId,
              operation,
              loopIteration
            }),
            {
              modelId: initialModelId,
              operation,
              requestId
            }
          );
        } else {
          return await retryAwsCommand(client, commandWithModel, {
            modelId: initialModelId,
            operation,
            loopIteration
          });
        }
      }
    },
    {
      operation,
      requestId
    }
  );

  // Add metadata to response
  if (result && typeof result === 'object') {
    // Fallback metadata
    if (result.success !== undefined) {
      logger.info('Resilient invoke completed with fallback', {
        operation,
        requestId,
        usedFallback: result.usedFallback,
        finalModel: result.modelId,
        failedModels: result.failedModels
      });

      // Return the actual Bedrock response (unwrap from fallback wrapper)
      return {
        ...result.result,
        _metadata: {
          modelId: result.modelId,
          usedFallback: result.usedFallback,
          failedModels: result.failedModels,
          requestId
        }
      };
    }

    // No fallback - simple response
    logger.debug('Resilient invoke completed', {
      operation,
      requestId,
      modelId: initialModelId
    });

    return {
      ...result,
      _metadata: {
        modelId: initialModelId,
        usedFallback: false,
        failedModels: [],
        requestId
      }
    };
  }

  return result;
}

/**
 * Gets resilience status (circuit breaker state, bottleneck stats, etc.)
 *
 * @returns {Object} Status information
 */
export function getResilienceStatus() {
  return {
    circuitBreaker: bedrockCircuitBreaker.getStats(),
    bottleneck: bottleneck.getStats(),
    timestamp: Date.now()
  };
}

export default {
  resilientInvoke,
  getResilienceStatus
};
