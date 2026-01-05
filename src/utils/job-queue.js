/**
 * Simple Job Queue System (v2.7.1)
 *
 * Processa jobs longos de forma assíncrona para evitar timeout de requisições HTTP
 * - Baseado em eventos nativos do Node.js
 * - Não bloqueia requisições HTTP
 * - Suporta callbacks/webhooks para notificar conclusão
 *
 * @module job-queue
 */

import EventEmitter from 'events';
import { logger } from './logger.js';
import crypto from 'crypto';

class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
    this.processing = new Map();
    this.completed = new Map();
    this.failed = new Map();

    this.maxConcurrent = parseInt(process.env.JOB_QUEUE_CONCURRENCY || '5', 10);
    this.maxRetries = 3;
    this.retentionTime = 24 * 60 * 60 * 1000; // 24h

    // Limpar jobs antigos a cada hora
    setInterval(() => this.cleanupOldJobs(), 60 * 60 * 1000);

    logger.info(`✅ Job Queue inicializado (max concurrent: ${this.maxConcurrent})`);
  }

  /**
   * Adiciona job à fila
   */
  async addJob(type, data, options = {}) {
    const jobId = options.jobId || `job_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    const job = {
      id: jobId,
      type,
      data,
      status: 'pending',
      createdAt: Date.now(),
      attempts: 0,
      maxRetries: options.maxRetries || this.maxRetries,
      priority: options.priority || 0,
      callback: options.callback,
      webhookUrl: options.webhookUrl
    };

    this.jobs.set(jobId, job);

    logger.info(`📥 Job adicionado: ${jobId} (type: ${type})`);

    // Processar imediatamente se houver capacidade
    setImmediate(() => this.processNext());

    return {
      jobId,
      status: 'pending',
      message: 'Job adicionado à fila'
    };
  }

  /**
   * Processa próximo job da fila
   */
  async processNext() {
    // Verificar se já atingiu limite de concorrência
    if (this.processing.size >= this.maxConcurrent) {
      return;
    }

    // Buscar job pendente com maior prioridade
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending')
      .sort((a, b) => b.priority - a.priority);

    if (pendingJobs.length === 0) {
      return;
    }

    const job = pendingJobs[0];
    await this.processJob(job);
  }

  /**
   * Processa um job específico
   */
  async processJob(job) {
    job.status = 'processing';
    job.startedAt = Date.now();
    job.attempts++;

    this.processing.set(job.id, job);
    this.jobs.delete(job.id);

    logger.info(`⚙️  Processando job: ${job.id} (tentativa ${job.attempts}/${job.maxRetries})`);

    try {
      // Emitir evento para processar job
      const result = await this.executeJob(job);

      // Job concluído com sucesso
      job.status = 'completed';
      job.completedAt = Date.now();
      job.duration = job.completedAt - job.startedAt;
      job.result = result;

      this.processing.delete(job.id);
      this.completed.set(job.id, job);

      logger.info(`✅ Job concluído: ${job.id} (${job.duration}ms)`);

      // Notificar callback/webhook
      if (job.callback) {
        try {
          await job.callback(null, result);
        } catch (err) {
          logger.error('Erro ao executar callback:', err);
        }
      }

      this.emit('job:completed', job);

    } catch (error) {
      logger.error(`❌ Erro no job ${job.id}:`, error);

      // Retry se não atingiu máximo de tentativas
      if (job.attempts < job.maxRetries) {
        job.status = 'pending';
        this.processing.delete(job.id);
        this.jobs.set(job.id, job);

        logger.warn(`🔄 Reprocessando job: ${job.id} (tentativa ${job.attempts + 1}/${job.maxRetries})`);
      } else {
        // Job falhou definitivamente
        job.status = 'failed';
        job.completedAt = Date.now();
        job.duration = job.completedAt - job.startedAt;
        job.error = error.message;

        this.processing.delete(job.id);
        this.failed.set(job.id, job);

        logger.error(`💥 Job falhou definitivamente: ${job.id}`);

        // Notificar callback/webhook
        if (job.callback) {
          try {
            await job.callback(error, null);
          } catch (err) {
            logger.error('Erro ao executar callback de erro:', err);
          }
        }

        this.emit('job:failed', job);
      }
    } finally {
      // Processar próximo job
      setImmediate(() => this.processNext());
    }
  }

  /**
   * Executa o job (emite evento para handlers)
   */
  async executeJob(job) {
    return new Promise((resolve, reject) => {
      // Timeout de 5 minutos
      const timeout = setTimeout(() => {
        reject(new Error('Job timeout (5 minutos)'));
      }, 5 * 60 * 1000);

      // Emitir evento para handlers registrados
      const eventName = `job:${job.type}`;

      if (this.listenerCount(eventName) === 0) {
        clearTimeout(timeout);
        reject(new Error(`Nenhum handler registrado para job type: ${job.type}`));
        return;
      }

      this.emit(eventName, job.data, (error, result) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Obter status de um job
   */
  getJobStatus(jobId) {
    if (this.processing.has(jobId)) {
      return { ...this.processing.get(jobId), status: 'processing' };
    }
    if (this.completed.has(jobId)) {
      return { ...this.completed.get(jobId), status: 'completed' };
    }
    if (this.failed.has(jobId)) {
      return { ...this.failed.get(jobId), status: 'failed' };
    }
    if (this.jobs.has(jobId)) {
      return { ...this.jobs.get(jobId), status: 'pending' };
    }
    return null;
  }

  /**
   * Limpar jobs antigos
   */
  cleanupOldJobs() {
    const cutoff = Date.now() - this.retentionTime;
    let cleaned = 0;

    for (const [jobId, job] of this.completed.entries()) {
      if (job.completedAt < cutoff) {
        this.completed.delete(jobId);
        cleaned++;
      }
    }

    for (const [jobId, job] of this.failed.entries()) {
      if (job.completedAt < cutoff) {
        this.failed.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`🧹 Limpeza de jobs: ${cleaned} jobs antigos removidos`);
    }
  }

  /**
   * Estatísticas da fila
   */
  getStats() {
    return {
      pending: this.jobs.size,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// Singleton
const jobQueue = new JobQueue();

export default jobQueue;
export { jobQueue };
