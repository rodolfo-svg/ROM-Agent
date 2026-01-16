/**
 * Worker Pool Manager - Gerenciador de Pool de Workers
 *
 * Gerencia um pool de Worker Threads para processamento paralelo
 * com balanceamento de carga, retry automático e health monitoring.
 *
 * Recursos:
 * - Pool dinâmico de workers
 * - Timeout configurável por tarefa
 * - Terminação forçada de workers travados
 * - Retry automático com backoff exponencial
 * - Health checks periódicos
 * - Métricas detalhadas
 * - Logs estruturados
 *
 * @version 1.0.0
 * @author ROM Agent
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuração padrão do pool
 */
const DEFAULT_CONFIG = {
  // Número de workers (padrão: metade dos CPUs, mínimo 2, máximo 8)
  poolSize: Math.min(Math.max(Math.floor(os.cpus().length / 2), 2), 8),

  // Timeout padrão para tarefas (ms)
  taskTimeout: 120000, // 2 minutos

  // Número máximo de retries
  maxRetries: 3,

  // Intervalo de health check (ms)
  healthCheckInterval: 30000, // 30 segundos

  // Tempo máximo para worker responder health check (ms)
  healthCheckTimeout: 5000,

  // Tempo para aguardar worker encerrar graciosamente (ms)
  gracefulShutdownTimeout: 5000,

  // Ativar logs de debug
  debug: false,

  // Tamanho máximo de fila de tarefas
  maxQueueSize: 1000,

  // Backoff exponencial para retries (base em ms)
  retryBackoffBase: 1000,

  // Multiplicador de backoff
  retryBackoffMultiplier: 2,

  // Número máximo de falhas consecutivas antes de reciclar worker
  maxConsecutiveFailures: 5
};

/**
 * Estados possíveis de um worker
 */
const WorkerState = {
  INITIALIZING: 'initializing',
  IDLE: 'idle',
  BUSY: 'busy',
  UNHEALTHY: 'unhealthy',
  TERMINATED: 'terminated'
};

/**
 * Classe que representa um worker individual no pool
 */
class PooledWorker {
  constructor(id, workerPath, options = {}) {
    this.id = id;
    this.workerPath = workerPath;
    this.options = options;
    this.worker = null;
    this.state = WorkerState.INITIALIZING;
    this.currentTask = null;
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;

    // Métricas
    this.metrics = {
      tasksCompleted: 0,
      tasksFailed: 0,
      consecutiveFailures: 0,
      totalProcessingTime: 0,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      restarts: 0
    };

    this.initialize();
  }

  /**
   * Inicializar worker
   */
  initialize() {
    this.state = WorkerState.INITIALIZING;

    this.worker = new Worker(this.workerPath, {
      workerData: {
        workerId: this.id,
        debug: this.options.debug
      }
    });

    this.setupListeners();
  }

  /**
   * Configurar listeners do worker
   */
  setupListeners() {
    this.worker.on('message', (message) => {
      this.handleMessage(message);
    });

    this.worker.on('error', (error) => {
      this.handleError(error);
    });

    this.worker.on('exit', (code) => {
      this.handleExit(code);
    });
  }

  /**
   * Processar mensagem do worker
   */
  handleMessage(message) {
    const { type, payload, threadId } = message;

    this.metrics.lastActivity = Date.now();

    switch (type) {
      case 'ready':
        this.state = WorkerState.IDLE;
        this.capabilities = payload.capabilities;
        if (this.options.onReady) {
          this.options.onReady(this.id, payload);
        }
        break;

      case 'response':
        const { id, success, data, error } = payload;
        const pending = this.pendingRequests.get(id);

        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(id);

          if (success) {
            this.metrics.tasksCompleted++;
            this.metrics.consecutiveFailures = 0;
            pending.resolve(data);
          } else {
            this.metrics.tasksFailed++;
            this.metrics.consecutiveFailures++;
            pending.reject(new Error(error?.message || 'Erro desconhecido'));
          }

          this.state = WorkerState.IDLE;
          this.currentTask = null;
        }
        break;

      case 'log':
        if (this.options.onLog) {
          this.options.onLog(this.id, payload);
        }
        break;

      case 'error':
        if (this.options.onWorkerError) {
          this.options.onWorkerError(this.id, payload);
        }
        break;
    }
  }

  /**
   * Processar erro do worker
   */
  handleError(error) {
    this.state = WorkerState.UNHEALTHY;
    this.metrics.consecutiveFailures++;

    // Rejeitar todas as requisições pendentes
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Worker error: ${error.message}`));
    }
    this.pendingRequests.clear();

    if (this.options.onWorkerError) {
      this.options.onWorkerError(this.id, { type: 'workerError', error: error.message, stack: error.stack });
    }
  }

  /**
   * Processar saída do worker
   */
  handleExit(code) {
    const wasHealthy = this.state !== WorkerState.TERMINATED;
    this.state = WorkerState.TERMINATED;

    // Rejeitar todas as requisições pendentes
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Worker exited with code ${code}`));
    }
    this.pendingRequests.clear();

    if (this.options.onExit) {
      this.options.onExit(this.id, code, wasHealthy);
    }
  }

  /**
   * Enviar tarefa para o worker
   */
  async execute(action, payload, timeout = 60000) {
    if (this.state === WorkerState.TERMINATED) {
      throw new Error('Worker está terminado');
    }

    if (this.state === WorkerState.BUSY) {
      throw new Error('Worker está ocupado');
    }

    const startTime = performance.now();
    const requestId = ++this.requestIdCounter;

    this.state = WorkerState.BUSY;
    this.currentTask = { action, startTime, requestId };

    return new Promise((resolve, reject) => {
      // Configurar timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.metrics.tasksFailed++;
        this.metrics.consecutiveFailures++;
        this.state = WorkerState.UNHEALTHY;
        reject(new Error(`Timeout: tarefa não completou em ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: (data) => {
          const processingTime = performance.now() - startTime;
          this.metrics.totalProcessingTime += processingTime;
          resolve({ ...data, _workerMetrics: { processingTime, workerId: this.id } });
        },
        reject,
        timeout: timeoutId,
        startTime
      });

      // Enviar mensagem para o worker
      this.worker.postMessage({
        id: requestId,
        action,
        payload
      });
    });
  }

  /**
   * Health check do worker
   */
  async healthCheck(timeout = 5000) {
    if (this.state === WorkerState.TERMINATED) {
      return { healthy: false, reason: 'Worker terminado' };
    }

    try {
      const result = await this.execute('healthCheck', {}, timeout);
      return { healthy: true, data: result };
    } catch (error) {
      return { healthy: false, reason: error.message };
    }
  }

  /**
   * Terminar worker graciosamente
   */
  async terminate(timeout = 5000) {
    if (this.state === WorkerState.TERMINATED) {
      return;
    }

    try {
      // Tentar shutdown gracioso
      const shutdownPromise = this.execute('shutdown', {}, timeout);
      await Promise.race([
        shutdownPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown timeout')), timeout))
      ]);
    } catch (error) {
      // Forçar terminação se shutdown gracioso falhar
    }

    this.state = WorkerState.TERMINATED;
    await this.worker.terminate();
  }

  /**
   * Forçar terminação imediata
   */
  async forceTerminate() {
    this.state = WorkerState.TERMINATED;

    // Rejeitar todas as requisições pendentes
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker terminado forçadamente'));
    }
    this.pendingRequests.clear();

    await this.worker.terminate();
  }

  /**
   * Reiniciar worker
   */
  async restart() {
    await this.forceTerminate();
    this.metrics.restarts++;
    this.initialize();
  }

  /**
   * Verificar se worker está disponível
   */
  isAvailable() {
    return this.state === WorkerState.IDLE;
  }

  /**
   * Verificar se worker está saudável
   */
  isHealthy() {
    return this.state !== WorkerState.UNHEALTHY && this.state !== WorkerState.TERMINATED;
  }

  /**
   * Obter métricas do worker
   */
  getMetrics() {
    return {
      id: this.id,
      state: this.state,
      ...this.metrics,
      uptime: Date.now() - this.metrics.createdAt,
      averageProcessingTime: this.metrics.tasksCompleted > 0
        ? this.metrics.totalProcessingTime / this.metrics.tasksCompleted
        : 0
    };
  }
}

/**
 * Worker Pool Manager
 */
class WorkerPool extends EventEmitter {
  constructor(workerPath, config = {}) {
    super();

    this.workerPath = workerPath || path.join(__dirname, 'extract-worker.js');
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.workers = new Map();
    this.taskQueue = [];
    this.isShuttingDown = false;
    this.healthCheckTimer = null;

    // Métricas globais
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      retriedTasks: 0,
      queuedTasks: 0,
      startTime: Date.now()
    };

    this.logger = this.createLogger();
  }

  /**
   * Criar logger interno
   */
  createLogger() {
    return {
      info: (message, data = {}) => {
        this.emit('log', { level: 'info', message, data, timestamp: new Date().toISOString() });
        if (this.config.debug) console.log(`[WorkerPool INFO] ${message}`, data);
      },
      warn: (message, data = {}) => {
        this.emit('log', { level: 'warn', message, data, timestamp: new Date().toISOString() });
        console.warn(`[WorkerPool WARN] ${message}`, data);
      },
      error: (message, data = {}) => {
        this.emit('log', { level: 'error', message, data, timestamp: new Date().toISOString() });
        console.error(`[WorkerPool ERROR] ${message}`, data);
      },
      debug: (message, data = {}) => {
        if (this.config.debug) {
          this.emit('log', { level: 'debug', message, data, timestamp: new Date().toISOString() });
          console.log(`[WorkerPool DEBUG] ${message}`, data);
        }
      }
    };
  }

  /**
   * Inicializar pool de workers
   */
  async initialize() {
    this.logger.info('Inicializando Worker Pool', {
      poolSize: this.config.poolSize,
      workerPath: this.workerPath
    });

    const initPromises = [];

    for (let i = 0; i < this.config.poolSize; i++) {
      initPromises.push(this.addWorker());
    }

    await Promise.all(initPromises);

    // Iniciar health checks periódicos
    this.startHealthChecks();

    this.logger.info('Worker Pool inicializado', {
      workersAtivos: this.workers.size
    });

    return this;
  }

  /**
   * Adicionar novo worker ao pool
   */
  async addWorker() {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const worker = new PooledWorker(workerId, this.workerPath, {
      debug: this.config.debug,
      onReady: (id, payload) => {
        this.logger.info('Worker pronto', { workerId: id, capabilities: payload.capabilities });
        this.emit('workerReady', { workerId: id, capabilities: payload.capabilities });
        this.processQueue();
      },
      onLog: (id, payload) => {
        this.emit('workerLog', { workerId: id, ...payload });
      },
      onWorkerError: (id, payload) => {
        this.logger.error('Erro no worker', { workerId: id, ...payload });
        this.emit('workerError', { workerId: id, ...payload });
      },
      onExit: async (id, code, wasHealthy) => {
        this.logger.warn('Worker encerrado', { workerId: id, code, wasHealthy });
        this.emit('workerExit', { workerId: id, code, wasHealthy });

        // Reiniciar worker se não estamos em shutdown
        if (!this.isShuttingDown && wasHealthy) {
          this.workers.delete(id);
          await this.addWorker();
        }
      }
    });

    this.workers.set(workerId, worker);

    // Aguardar worker ficar pronto
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout aguardando worker inicializar'));
      }, 30000);

      const checkReady = setInterval(() => {
        if (worker.state === WorkerState.IDLE) {
          clearInterval(checkReady);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });

    return workerId;
  }

  /**
   * Obter worker disponível
   */
  getAvailableWorker() {
    for (const [id, worker] of this.workers) {
      if (worker.isAvailable()) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Executar tarefa com retry automático
   */
  async execute(action, payload, options = {}) {
    if (this.isShuttingDown) {
      throw new Error('Pool está em processo de shutdown');
    }

    const taskOptions = {
      timeout: options.timeout || this.config.taskTimeout,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      retryDelay: options.retryDelay || this.config.retryBackoffBase
    };

    this.metrics.totalTasks++;

    return this.executeWithRetry(action, payload, taskOptions, 0);
  }

  /**
   * Executar tarefa com retry
   */
  async executeWithRetry(action, payload, options, attempt) {
    const worker = this.getAvailableWorker();

    if (!worker) {
      // Adicionar à fila se não houver worker disponível
      if (this.taskQueue.length >= this.config.maxQueueSize) {
        throw new Error('Fila de tarefas cheia');
      }

      return new Promise((resolve, reject) => {
        this.taskQueue.push({
          action,
          payload,
          options,
          attempt,
          resolve,
          reject,
          addedAt: Date.now()
        });
        this.metrics.queuedTasks++;
        this.logger.debug('Tarefa adicionada à fila', { queueSize: this.taskQueue.length });
      });
    }

    try {
      const result = await worker.execute(action, payload, options.timeout);
      this.metrics.completedTasks++;
      return result;

    } catch (error) {
      // Verificar se deve fazer retry
      if (attempt < options.maxRetries) {
        this.metrics.retriedTasks++;

        // Backoff exponencial
        const delay = options.retryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt);

        this.logger.warn('Retry de tarefa', {
          action,
          attempt: attempt + 1,
          maxRetries: options.maxRetries,
          delay,
          error: error.message
        });

        // Verificar se worker precisa ser reiniciado
        if (worker.metrics.consecutiveFailures >= this.config.maxConsecutiveFailures) {
          this.logger.warn('Reiniciando worker devido a falhas consecutivas', {
            workerId: worker.id,
            failures: worker.metrics.consecutiveFailures
          });
          await worker.restart();
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(action, payload, options, attempt + 1);
      }

      this.metrics.failedTasks++;
      throw error;
    }
  }

  /**
   * Processar fila de tarefas
   */
  processQueue() {
    while (this.taskQueue.length > 0) {
      const worker = this.getAvailableWorker();
      if (!worker) break;

      const task = this.taskQueue.shift();
      this.metrics.queuedTasks--;

      this.executeWithRetry(task.action, task.payload, task.options, task.attempt)
        .then(task.resolve)
        .catch(task.reject);
    }
  }

  /**
   * Executar extração de PDF
   */
  async extractPDF(filePath, options = {}) {
    return this.execute('extractPDF', { filePath, options }, options);
  }

  /**
   * Executar extração de DOCX
   */
  async extractDOCX(filePath, options = {}) {
    return this.execute('extractDOCX', { filePath, options }, options);
  }

  /**
   * Executar extração de texto
   */
  async extractText(filePath, options = {}) {
    return this.execute('extractText', { filePath, options }, options);
  }

  /**
   * Processar batch de arquivos
   */
  async processBatch(files, options = {}) {
    return this.execute('processBatch', { files, options }, {
      ...options,
      timeout: options.timeout || files.length * 60000 // 1 min por arquivo
    });
  }

  /**
   * Iniciar health checks periódicos
   */
  startHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Executar health check em todos os workers
   */
  async performHealthCheck() {
    this.logger.debug('Executando health check');

    const results = [];

    for (const [id, worker] of this.workers) {
      const result = await worker.healthCheck(this.config.healthCheckTimeout);
      results.push({ workerId: id, ...result });

      if (!result.healthy) {
        this.logger.warn('Worker não saudável', { workerId: id, reason: result.reason });

        // Reiniciar worker não saudável
        if (!this.isShuttingDown) {
          this.logger.info('Reiniciando worker não saudável', { workerId: id });
          await worker.restart();
        }
      }
    }

    this.emit('healthCheck', results);
    return results;
  }

  /**
   * Obter métricas do pool
   */
  getMetrics() {
    const workerMetrics = [];
    let totalProcessingTime = 0;
    let totalTasksCompleted = 0;

    for (const [id, worker] of this.workers) {
      const wMetrics = worker.getMetrics();
      workerMetrics.push(wMetrics);
      totalProcessingTime += wMetrics.totalProcessingTime;
      totalTasksCompleted += wMetrics.tasksCompleted;
    }

    return {
      pool: {
        ...this.metrics,
        uptime: Date.now() - this.metrics.startTime,
        activeWorkers: this.workers.size,
        availableWorkers: Array.from(this.workers.values()).filter(w => w.isAvailable()).length,
        queueSize: this.taskQueue.length,
        averageProcessingTime: totalTasksCompleted > 0
          ? totalProcessingTime / totalTasksCompleted
          : 0
      },
      workers: workerMetrics
    };
  }

  /**
   * Shutdown gracioso do pool
   */
  async shutdown(timeout = 10000) {
    this.logger.info('Iniciando shutdown do Worker Pool');
    this.isShuttingDown = true;

    // Parar health checks
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Rejeitar tarefas na fila
    for (const task of this.taskQueue) {
      task.reject(new Error('Pool está encerrando'));
    }
    this.taskQueue = [];

    // Encerrar workers graciosamente
    const shutdownPromises = [];
    for (const [id, worker] of this.workers) {
      shutdownPromises.push(
        worker.terminate(this.config.gracefulShutdownTimeout)
          .catch(error => {
            this.logger.warn('Erro ao encerrar worker graciosamente', { workerId: id, error: error.message });
            return worker.forceTerminate();
          })
      );
    }

    await Promise.race([
      Promise.all(shutdownPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown timeout')), timeout))
    ]).catch(async () => {
      // Forçar terminação de todos os workers
      this.logger.warn('Forçando terminação de workers');
      for (const [id, worker] of this.workers) {
        await worker.forceTerminate().catch(() => {});
      }
    });

    this.workers.clear();
    this.logger.info('Worker Pool encerrado');
  }

  /**
   * Resize do pool (adicionar ou remover workers)
   */
  async resize(newSize) {
    const currentSize = this.workers.size;

    if (newSize === currentSize) return;

    this.logger.info('Redimensionando pool', { currentSize, newSize });

    if (newSize > currentSize) {
      // Adicionar workers
      const addPromises = [];
      for (let i = 0; i < newSize - currentSize; i++) {
        addPromises.push(this.addWorker());
      }
      await Promise.all(addPromises);

    } else {
      // Remover workers (preferir workers inativos)
      const workersToRemove = newSize - currentSize;
      let removed = 0;

      for (const [id, worker] of this.workers) {
        if (removed >= Math.abs(workersToRemove)) break;

        if (worker.isAvailable()) {
          await worker.terminate(this.config.gracefulShutdownTimeout);
          this.workers.delete(id);
          removed++;
        }
      }
    }

    this.config.poolSize = newSize;
    this.logger.info('Pool redimensionado', { newSize: this.workers.size });
  }
}

/**
 * Singleton do pool para uso global
 */
let poolInstance = null;

/**
 * Obter instância do pool (singleton)
 */
export async function getWorkerPool(config = {}) {
  if (!poolInstance) {
    poolInstance = new WorkerPool(null, config);
    await poolInstance.initialize();
  }
  return poolInstance;
}

/**
 * Encerrar pool singleton
 */
export async function shutdownWorkerPool() {
  if (poolInstance) {
    await poolInstance.shutdown();
    poolInstance = null;
  }
}

export { WorkerPool, PooledWorker, WorkerState };
export default WorkerPool;
