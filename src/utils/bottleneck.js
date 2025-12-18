/**
 * ROM Agent - Bottleneck / Rate Limiter
 *
 * Controla concorrência e tamanho de fila para requisições ao Bedrock
 *
 * Features:
 * - Limita concorrência máxima (MAX_CONCURRENT)
 * - Limita tamanho da fila (MAX_QUEUE)
 * - Rejeita com erro 429/503 quando fila estourar
 * - Métricas Prometheus para observabilidade
 * - Feature flag: ENABLE_BOTTLENECK
 */

import structuredLogger from './structured-logger.js';
import metricsCollector from './metrics-collector.js';
import featureFlags from './feature-flags.js';

/**
 * Configuração padrão do bottleneck
 */
const DEFAULT_CONFIG = {
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '5', 10),
  maxQueue: parseInt(process.env.MAX_QUEUE || '20', 10),
  enabled: true
};

/**
 * Classe Bottleneck para controle de concorrência e fila
 */
export class Bottleneck {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Estado da fila
    this.running = 0;
    this.queue = [];
    this.rejected = 0;
    this.completed = 0;

    structuredLogger.info('Bottleneck initialized', {
      maxConcurrent: this.config.maxConcurrent,
      maxQueue: this.config.maxQueue,
      enabled: this.config.enabled
    });
  }

  /**
   * Wrapper para executar função com controle de concorrência
   *
   * @param {Function} fn - Função async a ser executada
   * @param {Object} context - Contexto para logging (conversationId, operation, etc)
   * @returns {Promise} Resultado da função ou erro de throttling
   */
  async schedule(fn, context = {}) {
    // Verificar se bottleneck está habilitado
    if (!featureFlags.get('ENABLE_BOTTLENECK')) {
      return fn();
    }

    const requestId = context.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operation = context.operation || 'unknown';

    structuredLogger.debug('Bottleneck: scheduling request', {
      requestId,
      operation,
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.config.maxConcurrent,
      maxQueue: this.config.maxQueue
    });

    // Verificar se pode executar imediatamente
    if (this.running < this.config.maxConcurrent) {
      return this._execute(fn, { requestId, operation });
    }

    // Verificar se fila está cheia
    if (this.queue.length >= this.config.maxQueue) {
      this.rejected++;

      // Incrementar métrica de rejeição
      metricsCollector.incrementBottleneckRejected(operation);

      structuredLogger.error('Bottleneck: queue full - rejecting request', {
        requestId,
        operation,
        queueDepth: this.queue.length,
        maxQueue: this.config.maxQueue,
        running: this.running,
        totalRejected: this.rejected
      });

      // Retornar erro 503 Service Unavailable
      const error = new Error(`Service temporarily unavailable: queue full (${this.queue.length}/${this.config.maxQueue})`);
      error.code = 'QUEUE_FULL';
      error.statusCode = 503;
      error.retryAfter = 5; // segundos
      throw error;
    }

    // Adicionar à fila
    return new Promise((resolve, reject) => {
      const queueEntry = {
        fn,
        resolve,
        reject,
        requestId,
        operation,
        queuedAt: Date.now()
      };

      this.queue.push(queueEntry);

      structuredLogger.debug('Bottleneck: request queued', {
        requestId,
        operation,
        queuePosition: this.queue.length,
        running: this.running
      });

      // Atualizar métrica de queue depth
      metricsCollector.setBottleneckQueueDepth(this.queue.length);
    });
  }

  /**
   * Executa função incrementando contador de running
   *
   * @private
   */
  async _execute(fn, context) {
    const { requestId, operation } = context;

    this.running++;
    const startTime = Date.now();

    structuredLogger.debug('Bottleneck: executing request', {
      requestId,
      operation,
      running: this.running,
      queued: this.queue.length
    });

    // Atualizar métricas
    metricsCollector.setBottleneckRunning(this.running);

    try {
      const result = await fn();

      this.completed++;
      const duration = Date.now() - startTime;

      structuredLogger.debug('Bottleneck: request completed', {
        requestId,
        operation,
        duration,
        running: this.running - 1,
        completed: this.completed
      });

      // Incrementar métrica de completado
      metricsCollector.incrementBottleneckCompleted(operation);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      structuredLogger.error('Bottleneck: request failed', {
        requestId,
        operation,
        duration,
        error: error.message,
        running: this.running - 1
      });

      // Incrementar métrica de falha
      metricsCollector.incrementBottleneckFailed(operation);

      throw error;
    } finally {
      this.running--;

      // Atualizar métrica de running
      metricsCollector.setBottleneckRunning(this.running);

      // Processar próximo item da fila
      this._processNext();
    }
  }

  /**
   * Processa próximo item da fila se houver
   *
   * @private
   */
  _processNext() {
    if (this.queue.length === 0) {
      return;
    }

    if (this.running >= this.config.maxConcurrent) {
      return;
    }

    const entry = this.queue.shift();

    if (!entry) {
      return;
    }

    const waitTime = Date.now() - entry.queuedAt;

    structuredLogger.debug('Bottleneck: processing queued request', {
      requestId: entry.requestId,
      operation: entry.operation,
      waitTime,
      queueRemaining: this.queue.length,
      running: this.running
    });

    // Atualizar métrica de queue depth
    metricsCollector.setBottleneckQueueDepth(this.queue.length);

    // Executar função e resolver/rejeitar promise original
    this._execute(entry.fn, {
      requestId: entry.requestId,
      operation: entry.operation
    })
      .then(entry.resolve)
      .catch(entry.reject);
  }

  /**
   * Obtém estatísticas atuais do bottleneck
   *
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      rejected: this.rejected,
      completed: this.completed,
      maxConcurrent: this.config.maxConcurrent,
      maxQueue: this.config.maxQueue,
      enabled: featureFlags.get('ENABLE_BOTTLENECK'),
      utilizationPct: (this.running / this.config.maxConcurrent) * 100,
      queueUtilizationPct: (this.queue.length / this.config.maxQueue) * 100
    };
  }

  /**
   * Reseta estatísticas (útil para testes)
   */
  resetStats() {
    this.rejected = 0;
    this.completed = 0;

    structuredLogger.debug('Bottleneck: stats reset', {
      running: this.running,
      queued: this.queue.length
    });
  }

  /**
   * Drena a fila (aguarda todas as requisições em execução/fila)
   * Útil para graceful shutdown
   *
   * @param {number} timeout - Timeout em ms (default: 30s)
   * @returns {Promise<boolean>} true se drenou, false se timeout
   */
  async drain(timeout = 30000) {
    const startTime = Date.now();

    structuredLogger.info('Bottleneck: draining queue', {
      running: this.running,
      queued: this.queue.length,
      timeout
    });

    return new Promise((resolve) => {
      const checkDrained = () => {
        const elapsed = Date.now() - startTime;

        if (this.running === 0 && this.queue.length === 0) {
          structuredLogger.info('Bottleneck: drained successfully', {
            elapsed,
            completed: this.completed,
            rejected: this.rejected
          });
          resolve(true);
          return;
        }

        if (elapsed >= timeout) {
          structuredLogger.warn('Bottleneck: drain timeout', {
            elapsed,
            running: this.running,
            queued: this.queue.length,
            completed: this.completed,
            rejected: this.rejected
          });
          resolve(false);
          return;
        }

        // Verificar novamente em 100ms
        setTimeout(checkDrained, 100);
      };

      checkDrained();
    });
  }
}

// Instância singleton global
export const bottleneck = new Bottleneck();

export default bottleneck;
