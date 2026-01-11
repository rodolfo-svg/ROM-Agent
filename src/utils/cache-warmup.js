/**
 * CACHE WARMUP SERVICE (v1.0.0)
 *
 * Pre-loads critical data into cache on application startup:
 * - Microfichamento templates
 * - System configurations
 * - Frequently accessed legislation
 * - Common jurisprudence queries
 *
 * @module cache-warmup
 */

import { logger } from './logger.js';
import { getRedisCacheService } from './redis-cache-service.js';
import { getCache } from './multi-level-cache.js';
import { safeQuery } from '../config/database.js';

/**
 * Cache Warmup Service
 */
export class CacheWarmupService {
  constructor() {
    this.warmupTasks = [];
    this.completedTasks = [];
    this.failedTasks = [];
    this.isRunning = false;
    this.startTime = null;
    this.endTime = null;

    // Warmup configuration
    this.config = {
      // Maximum time for entire warmup process (5 minutes)
      maxDurationMs: 5 * 60 * 1000,
      // Delay between tasks to prevent resource exhaustion
      taskDelayMs: 100,
      // Retry failed tasks
      retryFailedTasks: true,
      maxRetries: 2
    };
  }

  /**
   * Register a warmup task
   * @param {string} name - Task name
   * @param {Function} task - Async function to execute
   * @param {Object} options - Task options
   */
  registerTask(name, task, options = {}) {
    this.warmupTasks.push({
      name,
      task,
      priority: options.priority || 0,
      critical: options.critical || false,
      timeout: options.timeout || 30000,
      retries: 0
    });

    // Sort by priority (higher first)
    this.warmupTasks.sort((a, b) => b.priority - a.priority);

    logger.debug('Warmup task registered', { name, priority: options.priority });
  }

  /**
   * Execute a single warmup task with timeout
   * @param {Object} task - Task to execute
   * @returns {Promise<{success: boolean, duration: number, error?: string}>}
   */
  async executeTask(task) {
    const taskStart = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), task.timeout);
      });

      // Race between task and timeout
      await Promise.race([task.task(), timeoutPromise]);

      const duration = Date.now() - taskStart;

      // Mark as complete in Redis if available
      const redisCache = getRedisCacheService();
      if (redisCache) {
        await redisCache.markWarmupComplete(task.name);
      }

      return { success: true, duration };
    } catch (error) {
      const duration = Date.now() - taskStart;
      return {
        success: false,
        duration,
        error: error.message
      };
    }
  }

  /**
   * Run all warmup tasks
   * @returns {Promise<Object>} Warmup results
   */
  async runWarmup() {
    if (this.isRunning) {
      logger.warn('Warmup already in progress');
      return { status: 'already_running' };
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.completedTasks = [];
    this.failedTasks = [];

    logger.info('Starting cache warmup', {
      taskCount: this.warmupTasks.length
    });

    // Create timeout for entire warmup
    const warmupTimeout = setTimeout(() => {
      logger.error('Warmup timeout exceeded');
      this.isRunning = false;
    }, this.config.maxDurationMs);

    try {
      for (const task of this.warmupTasks) {
        if (!this.isRunning) break;

        logger.debug('Executing warmup task', { name: task.name });

        const result = await this.executeTask(task);

        if (result.success) {
          this.completedTasks.push({
            name: task.name,
            duration: result.duration
          });
          logger.info('Warmup task completed', {
            name: task.name,
            duration: `${result.duration}ms`
          });
        } else {
          // Retry logic
          if (this.config.retryFailedTasks && task.retries < this.config.maxRetries) {
            task.retries++;
            logger.warn('Warmup task failed, retrying', {
              name: task.name,
              retry: task.retries,
              error: result.error
            });

            // Re-add to end of queue for retry
            this.warmupTasks.push(task);
          } else {
            this.failedTasks.push({
              name: task.name,
              duration: result.duration,
              error: result.error,
              critical: task.critical
            });

            logger.error('Warmup task failed', {
              name: task.name,
              error: result.error
            });

            // Stop if critical task fails
            if (task.critical) {
              logger.error('Critical warmup task failed, stopping warmup');
              break;
            }
          }
        }

        // Delay between tasks
        if (this.config.taskDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.taskDelayMs));
        }
      }
    } finally {
      clearTimeout(warmupTimeout);
      this.isRunning = false;
      this.endTime = Date.now();
    }

    const results = this.getResults();
    logger.info('Cache warmup completed', results.summary);

    return results;
  }

  /**
   * Get warmup results
   * @returns {Object} Warmup results
   */
  getResults() {
    const totalDuration = this.endTime
      ? this.endTime - this.startTime
      : Date.now() - this.startTime;

    return {
      summary: {
        totalTasks: this.warmupTasks.length,
        completed: this.completedTasks.length,
        failed: this.failedTasks.length,
        successRate: this.warmupTasks.length > 0
          ? `${((this.completedTasks.length / this.warmupTasks.length) * 100).toFixed(1)}%`
          : '0%',
        totalDuration: `${totalDuration}ms`
      },
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      isRunning: this.isRunning
    };
  }

  /**
   * Check if warmup is complete
   * @returns {boolean} True if warmup finished
   */
  isComplete() {
    return !this.isRunning && this.endTime !== null;
  }
}

// ============================================================
// DEFAULT WARMUP TASKS
// ============================================================

/**
 * Warmup task: Load microfichamento templates
 */
async function warmupMicrofichamentoTemplates(cache) {
  const templates = {
    default: {
      sections: [
        'Dados do Processo',
        'Partes',
        'Objeto',
        'Pedidos',
        'Fundamentos Juridicos',
        'Documentos Anexos',
        'Observacoes'
      ],
      format: 'structured'
    },
    trabalhista: {
      sections: [
        'Reclamante',
        'Reclamada',
        'Verbas Rescissorias',
        'FGTS',
        'Ferias',
        'Horas Extras',
        'Danos Morais'
      ],
      format: 'detailed'
    },
    civel: {
      sections: [
        'Autor',
        'Reu',
        'Tipo de Acao',
        'Valor da Causa',
        'Pedidos',
        'Contestacao',
        'Provas'
      ],
      format: 'standard'
    }
  };

  const key = cache.generateKey('templates:microfichamento', 'templates');
  await cache.set(key, templates, 'templates');

  return { templatesLoaded: Object.keys(templates).length };
}

/**
 * Warmup task: Load system configurations
 */
async function warmupSystemConfig(cache) {
  const configs = {
    analysis: {
      maxTokens: 4000,
      temperature: 0.7,
      defaultModel: 'claude-3-sonnet'
    },
    jurisprudencia: {
      defaultTribunals: ['STF', 'STJ', 'TST', 'TRF'],
      maxResults: 50,
      cacheEnabled: true
    },
    ocr: {
      languages: ['por', 'eng'],
      dpi: 300,
      enhanceImages: true
    },
    session: {
      maxAge: 86400000,
      rolling: true
    }
  };

  const key = cache.generateKey('system:config', 'templates');
  await cache.set(key, configs, 'templates');

  return { configsLoaded: Object.keys(configs).length };
}

/**
 * Warmup task: Pre-cache common legislation references
 */
async function warmupLegislation(cache) {
  const commonLegislation = [
    { code: 'CF88', name: 'Constituicao Federal de 1988', type: 'constituicao' },
    { code: 'CC02', name: 'Codigo Civil de 2002', type: 'codigo' },
    { code: 'CPC15', name: 'Codigo de Processo Civil de 2015', type: 'codigo' },
    { code: 'CLT', name: 'Consolidacao das Leis do Trabalho', type: 'consolidacao' },
    { code: 'CDC', name: 'Codigo de Defesa do Consumidor', type: 'codigo' },
    { code: 'CP40', name: 'Codigo Penal', type: 'codigo' },
    { code: 'CPP41', name: 'Codigo de Processo Penal', type: 'codigo' }
  ];

  const key = cache.generateKey('legislation:common', 'legislation');
  await cache.set(key, commonLegislation, 'legislation');

  return { legislationLoaded: commonLegislation.length };
}

/**
 * Warmup task: Load active user sessions from database
 */
async function warmupActiveSessions(redisCache) {
  if (!redisCache || !redisCache.isAvailable()) {
    return { sessionsLoaded: 0, skipped: true };
  }

  try {
    // Query active sessions from PostgreSQL
    const result = await safeQuery(`
      SELECT sess FROM sessions
      WHERE expire > NOW()
      ORDER BY expire DESC
      LIMIT 100
    `);

    if (result.fallback || !result.rows) {
      return { sessionsLoaded: 0, noDatabase: true };
    }

    let loaded = 0;
    for (const row of result.rows) {
      if (row.sess && row.sess.userId) {
        await redisCache.setSession(row.sess.userId, row.sess);
        loaded++;
      }
    }

    return { sessionsLoaded: loaded };
  } catch (error) {
    logger.warn('Failed to warmup sessions', { error: error.message });
    return { sessionsLoaded: 0, error: error.message };
  }
}

/**
 * Warmup task: Pre-cache tribunal configurations
 */
async function warmupTribunalConfigs(cache) {
  const tribunals = {
    STF: {
      name: 'Supremo Tribunal Federal',
      apiEndpoint: 'https://portal.stf.jus.br/api',
      cacheHours: 24
    },
    STJ: {
      name: 'Superior Tribunal de Justica',
      apiEndpoint: 'https://www.stj.jus.br/api',
      cacheHours: 24
    },
    TST: {
      name: 'Tribunal Superior do Trabalho',
      apiEndpoint: 'https://www.tst.jus.br/api',
      cacheHours: 12
    },
    TRF1: {
      name: 'TRF da 1a Regiao',
      apiEndpoint: 'https://www.trf1.jus.br/api',
      cacheHours: 6
    },
    TRF2: {
      name: 'TRF da 2a Regiao',
      apiEndpoint: 'https://www.trf2.jus.br/api',
      cacheHours: 6
    },
    TRF3: {
      name: 'TRF da 3a Regiao',
      apiEndpoint: 'https://www.trf3.jus.br/api',
      cacheHours: 6
    }
  };

  const key = cache.generateKey('tribunals:config', 'templates');
  await cache.set(key, tribunals, 'templates');

  return { tribunalsLoaded: Object.keys(tribunals).length };
}

// ============================================================
// MAIN INITIALIZATION
// ============================================================

// Singleton instance
let warmupServiceInstance = null;

/**
 * Initialize and configure warmup service with default tasks
 * @returns {CacheWarmupService} Configured warmup service
 */
export function initCacheWarmup() {
  if (warmupServiceInstance) {
    return warmupServiceInstance;
  }

  warmupServiceInstance = new CacheWarmupService();
  const cache = getCache();
  const redisCache = getRedisCacheService();

  // Register default warmup tasks with priorities
  // Higher priority = executed first

  warmupServiceInstance.registerTask(
    'system-config',
    () => warmupSystemConfig(cache),
    { priority: 100, critical: false, timeout: 10000 }
  );

  warmupServiceInstance.registerTask(
    'microfichamento-templates',
    () => warmupMicrofichamentoTemplates(cache),
    { priority: 90, critical: false, timeout: 10000 }
  );

  warmupServiceInstance.registerTask(
    'tribunal-configs',
    () => warmupTribunalConfigs(cache),
    { priority: 80, critical: false, timeout: 10000 }
  );

  warmupServiceInstance.registerTask(
    'common-legislation',
    () => warmupLegislation(cache),
    { priority: 70, critical: false, timeout: 15000 }
  );

  // Only register session warmup if Redis is available
  if (redisCache) {
    warmupServiceInstance.registerTask(
      'active-sessions',
      () => warmupActiveSessions(redisCache),
      { priority: 50, critical: false, timeout: 30000 }
    );
  }

  logger.info('Cache warmup service initialized', {
    taskCount: warmupServiceInstance.warmupTasks.length
  });

  return warmupServiceInstance;
}

/**
 * Get warmup service instance
 * @returns {CacheWarmupService|null} Service instance or null
 */
export function getWarmupService() {
  return warmupServiceInstance;
}

/**
 * Run warmup immediately (convenience function)
 * @returns {Promise<Object>} Warmup results
 */
export async function runWarmup() {
  const service = initCacheWarmup();
  return await service.runWarmup();
}

/**
 * Schedule warmup to run after delay
 * @param {number} delayMs - Delay in milliseconds
 * @returns {Promise<Object>} Warmup results
 */
export async function scheduleWarmup(delayMs = 5000) {
  logger.info('Scheduling cache warmup', { delayMs });

  return new Promise((resolve) => {
    setTimeout(async () => {
      const results = await runWarmup();
      resolve(results);
    }, delayMs);
  });
}

export default {
  CacheWarmupService,
  initCacheWarmup,
  getWarmupService,
  runWarmup,
  scheduleWarmup
};
