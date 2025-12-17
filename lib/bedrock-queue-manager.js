/**
 * BEDROCK QUEUE MANAGER - ANTI-429
 * Controle global de throughput para evitar "Too many requests"
 *
 * Funcionalidades:
 * - Fila global cluster-wide para requisições ao Bedrock
 * - Lock por project_id (1 execução pesada por projeto)
 * - Rate limiting configurável (req/s)
 * - Backoff exponencial + jitter para 429
 * - Métricas e rastreamento completo
 */

import { EventEmitter } from 'events';

class BedrockQueueManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuração
    this.maxConcurrent = options.maxConcurrent || 3; // Max chamadas simultâneas
    this.maxRequestsPerSecond = options.maxRequestsPerSecond || 5; // Max req/s
    this.projectConcurrency = options.projectConcurrency || 1; // Max por projeto

    // Filas
    this.globalQueue = []; // Fila global de requisições
    this.activeRequests = new Map(); // Requisições em execução
    this.projectLocks = new Map(); // Locks por project_id

    // Métricas
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      throttledRequests: 0, // 429s recebidos
      averageWaitTime: 0,
      averageRetries: 0,
      queueLength: 0
    };

    // Rate limiting
    this.requestTimestamps = []; // Últimos N segundos
    this.rateLimitWindow = 1000; // 1 segundo

    // Backoff configuration
    this.backoffConfig = {
      initialDelay: 1000, // 1s
      maxDelay: 60000, // 60s
      multiplier: 2,
      jitterFactor: 0.3 // 30% de variação aleatória
    };
  }

  /**
   * Enfileira requisição ao Bedrock
   * Retorna Promise que resolve quando a requisição for executada
   */
  async enqueue(request) {
    const {
      projectId,
      userId,
      traceId,
      layerRunId,
      priority = 5, // 0-10 (10 = mais alta)
      maxRetries = 5,
      fn, // Função a executar
      metadata = {}
    } = request;

    return new Promise((resolve, reject) => {
      const queueItem = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        userId,
        traceId,
        layerRunId,
        priority,
        maxRetries,
        currentRetry: 0,
        fn,
        metadata,
        enqueuedAt: Date.now(),
        resolve,
        reject,
        status: 'queued'
      };

      this.globalQueue.push(queueItem);
      this.metrics.totalRequests++;
      this.metrics.queueLength = this.globalQueue.length;

      console.info('📥 Requisição enfileirada', {
        requestId: queueItem.id,
        projectId,
        userId,
        traceId,
        queuePosition: this.globalQueue.length,
        priority
      });

      // Emitir evento
      this.emit('enqueued', queueItem);

      // Tentar processar fila
      this.processQueue();
    });
  }

  /**
   * Processa fila de requisições
   */
  async processQueue() {
    // Se já estamos processando, não fazer nada
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.globalQueue.length > 0) {
        // Verificar se podemos executar mais requisições
        if (!this.canExecuteMore()) {
          console.debug('⏸️  Fila pausada - aguardando capacidade', {
            activeRequests: this.activeRequests.size,
            maxConcurrent: this.maxConcurrent,
            queueLength: this.globalQueue.length
          });
          break;
        }

        // Verificar rate limit
        if (!this.checkRateLimit()) {
          console.debug('⏸️  Rate limit atingido - aguardando', {
            requestsLastSecond: this.requestTimestamps.length,
            maxRequestsPerSecond: this.maxRequestsPerSecond
          });
          await this.sleep(100); // Aguardar 100ms
          continue;
        }

        // Ordenar por prioridade (maior primeiro)
        this.globalQueue.sort((a, b) => b.priority - a.priority);

        // Pegar próxima requisição
        const request = this.globalQueue.shift();
        this.metrics.queueLength = this.globalQueue.length;

        // Verificar lock de projeto
        if (this.isProjectLocked(request.projectId)) {
          console.debug('🔒 Projeto locked - reenfileirando', {
            projectId: request.projectId,
            requestId: request.id
          });
          this.globalQueue.push(request); // Reenviar para fila
          continue;
        }

        // Executar requisição
        this.executeRequest(request);
      }
    } finally {
      this.processing = false;

      // Se ainda há itens na fila, processar novamente em breve
      if (this.globalQueue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  /**
   * Verifica se pode executar mais requisições
   */
  canExecuteMore() {
    return this.activeRequests.size < this.maxConcurrent;
  }

  /**
   * Verifica rate limit (req/s)
   */
  checkRateLimit() {
    const now = Date.now();

    // Limpar timestamps antigos
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => now - ts < this.rateLimitWindow
    );

    // Verificar se está abaixo do limite
    return this.requestTimestamps.length < this.maxRequestsPerSecond;
  }

  /**
   * Verifica se projeto está locked
   */
  isProjectLocked(projectId) {
    if (!projectId) return false;

    const activeConcurrency = this.projectLocks.get(projectId) || 0;
    return activeConcurrency >= this.projectConcurrency;
  }

  /**
   * Adquire lock de projeto
   */
  acquireProjectLock(projectId) {
    if (!projectId) return;

    const current = this.projectLocks.get(projectId) || 0;
    this.projectLocks.set(projectId, current + 1);
  }

  /**
   * Libera lock de projeto
   */
  releaseProjectLock(projectId) {
    if (!projectId) return;

    const current = this.projectLocks.get(projectId) || 0;
    if (current > 0) {
      this.projectLocks.set(projectId, current - 1);
    }
  }

  /**
   * Executa requisição com retry/backoff
   */
  async executeRequest(request) {
    const { id, projectId, fn, traceId } = request;

    // Marcar como ativo
    this.activeRequests.set(id, request);
    request.status = 'executing';
    request.startedAt = Date.now();

    // Adquirir lock de projeto
    this.acquireProjectLock(projectId);

    // Registrar timestamp para rate limit
    this.requestTimestamps.push(Date.now());

    console.info('▶️  Executando requisição', {
      requestId: id,
      projectId,
      traceId,
      waitTime: request.startedAt - request.enqueuedAt
    });

    this.emit('executing', request);

    try {
      // Executar função com retry/backoff
      const result = await this.executeWithRetry(request);

      // Sucesso
      const duration = Date.now() - request.startedAt;
      const waitTime = request.startedAt - request.enqueuedAt;

      this.metrics.successfulRequests++;
      this.updateAverageWaitTime(waitTime);
      this.updateAverageRetries(request.currentRetry);

      console.info('✅ Requisição concluída', {
        requestId: id,
        projectId,
        traceId,
        duration,
        waitTime,
        retries: request.currentRetry
      });

      this.emit('completed', { request, result, duration });
      request.resolve(result);

    } catch (error) {
      // Falha
      this.metrics.failedRequests++;

      console.error('❌ Requisição falhou', {
        requestId: id,
        projectId,
        traceId,
        retries: request.currentRetry,
        error: error.message
      });

      this.emit('failed', { request, error });
      request.reject(error);

    } finally {
      // Remover de ativos
      this.activeRequests.delete(id);
      this.releaseProjectLock(projectId);

      // Processar próximos itens
      this.processQueue();
    }
  }

  /**
   * Executa função com retry e backoff exponencial
   */
  async executeWithRetry(request) {
    const { fn, maxRetries, currentRetry, id, traceId } = request;

    try {
      // Executar função
      const result = await fn();
      return result;

    } catch (error) {
      // Se for 429 (throttling)
      const is429 = error.name === 'ThrottlingException' ||
                    error.statusCode === 429 ||
                    error.message?.includes('Too many requests');

      if (is429) {
        this.metrics.throttledRequests++;
        console.warn('⏱️  Throttling detectado (429)', {
          requestId: id,
          traceId,
          retry: currentRetry,
          maxRetries
        });
      }

      // Se ainda pode fazer retry
      if (currentRetry < maxRetries) {
        request.currentRetry++;

        // Calcular delay com backoff exponencial + jitter
        const delay = this.calculateBackoff(currentRetry, is429);

        console.info('🔄 Retry agendado', {
          requestId: id,
          traceId,
          retry: request.currentRetry,
          maxRetries,
          delay,
          reason: is429 ? '429 Throttling' : error.message
        });

        // Aguardar
        await this.sleep(delay);

        // Retry
        return this.executeWithRetry(request);

      } else {
        // Esgotou retries
        console.error('💥 Retries esgotados', {
          requestId: id,
          traceId,
          retries: currentRetry,
          lastError: error.message
        });

        throw new Error(`Requisição falhou após ${currentRetry} tentativas: ${error.message}`);
      }
    }
  }

  /**
   * Calcula delay de backoff exponencial com jitter
   */
  calculateBackoff(retryCount, is429 = false) {
    const { initialDelay, maxDelay, multiplier, jitterFactor } = this.backoffConfig;

    // Backoff exponencial
    let delay = initialDelay * Math.pow(multiplier, retryCount);

    // Se for 429, usar delay maior
    if (is429) {
      delay = delay * 2; // Dobrar delay para 429
    }

    // Limitar ao máximo
    delay = Math.min(delay, maxDelay);

    // Adicionar jitter (variação aleatória)
    const jitter = delay * jitterFactor * (Math.random() - 0.5) * 2;
    delay = delay + jitter;

    return Math.floor(delay);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Atualiza média de tempo de espera
   */
  updateAverageWaitTime(waitTime) {
    const { averageWaitTime, successfulRequests } = this.metrics;
    this.metrics.averageWaitTime =
      (averageWaitTime * (successfulRequests - 1) + waitTime) / successfulRequests;
  }

  /**
   * Atualiza média de retries
   */
  updateAverageRetries(retries) {
    const { averageRetries, successfulRequests } = this.metrics;
    this.metrics.averageRetries =
      (averageRetries * (successfulRequests - 1) + retries) / successfulRequests;
  }

  /**
   * Obtém métricas
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeRequests: this.activeRequests.size,
      queueLength: this.globalQueue.length,
      projectLocks: Object.fromEntries(this.projectLocks),
      requestsLastSecond: this.requestTimestamps.length
    };
  }

  /**
   * Obtém status da fila
   */
  getQueueStatus() {
    return {
      queueLength: this.globalQueue.length,
      activeRequests: this.activeRequests.size,
      maxConcurrent: this.maxConcurrent,
      utilizationRate: (this.activeRequests.size / this.maxConcurrent * 100).toFixed(1) + '%',
      queue: this.globalQueue.map(req => ({
        id: req.id,
        projectId: req.projectId,
        userId: req.userId,
        priority: req.priority,
        enqueuedAt: req.enqueuedAt,
        waitTime: Date.now() - req.enqueuedAt
      }))
    };
  }

  /**
   * Limpa requisições antigas da fila (timeout)
   */
  cleanupStaleRequests(maxAge = 300000) { // 5 minutos
    const now = Date.now();
    const stale = [];

    this.globalQueue = this.globalQueue.filter(req => {
      if (now - req.enqueuedAt > maxAge) {
        stale.push(req);
        req.reject(new Error('Request timeout - removido da fila após 5 minutos'));
        return false;
      }
      return true;
    });

    if (stale.length > 0) {
      console.warn('🧹 Requisições antigas removidas da fila', {
        count: stale.length
      });
    }

    this.metrics.queueLength = this.globalQueue.length;
  }
}

// Singleton
export const bedrockQueue = new BedrockQueueManager({
  maxConcurrent: 3, // Max 3 chamadas simultâneas ao Bedrock
  maxRequestsPerSecond: 5, // Max 5 req/s
  projectConcurrency: 1 // Max 1 execução pesada por projeto
});

// Cleanup periódico (a cada 1 minuto)
setInterval(() => {
  bedrockQueue.cleanupStaleRequests();
}, 60000);

export default bedrockQueue;
