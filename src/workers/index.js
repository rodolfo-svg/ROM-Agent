/**
 * Workers Module - Exportações centralizadas
 *
 * Este módulo exporta todas as funcionalidades de Worker Threads
 * para extração isolada de documentos.
 *
 * @version 1.0.0
 */

// Worker Pool
export {
  WorkerPool,
  PooledWorker,
  WorkerState,
  getWorkerPool,
  shutdownWorkerPool
} from './worker-pool.js';

// Extract Worker Wrapper
export {
  ExtractWorkerWrapper,
  ExtractionError,
  getExtractWrapper,
  extractFile,
  extractFiles,
  shutdownExtractWrapper
} from './extract-worker-wrapper.js';

// Configuração padrão para uso fácil
export const DEFAULT_WORKER_CONFIG = {
  // Pool de workers
  poolSize: 4,
  taskTimeout: 120000, // 2 minutos
  maxRetries: 3,
  healthCheckInterval: 30000,

  // Extração
  maxFileSizeMB: 100,
  useWorkers: true,
  useFallback: true,
  enableLogging: true,
  enableMetrics: true
};

/**
 * Inicializar sistema de workers com configuração padrão
 */
export async function initializeWorkers(config = {}) {
  const { getExtractWrapper } = await import('./extract-worker-wrapper.js');
  return getExtractWrapper({ ...DEFAULT_WORKER_CONFIG, ...config });
}

/**
 * Encerrar sistema de workers
 */
export async function shutdownWorkers() {
  const { shutdownExtractWrapper } = await import('./extract-worker-wrapper.js');
  const { shutdownWorkerPool } = await import('./worker-pool.js');

  await shutdownExtractWrapper();
  await shutdownWorkerPool();
}

export default {
  initializeWorkers,
  shutdownWorkers,
  DEFAULT_WORKER_CONFIG
};
