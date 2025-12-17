/**
 * EXHAUSTIVE JOB MANAGER
 * Gerencia jobs de análise exaustiva
 * Detecta pedidos "exaustivos" e dispara jobs assíncronos automaticamente
 */

import { EventEmitter } from 'events';
import ExhaustiveAnalysisJob from './exhaustive-analysis-job.js';

class ExhaustiveJobManager extends EventEmitter {
  constructor() {
    super();

    // Jobs ativos
    this.activeJobs = new Map();
    this.completedJobs = new Map();

    // Palavras-chave que ativam modo exaustivo
    this.exhaustiveKeywords = [
      'exaustivamente',
      'exaustivo',
      'integralidade',
      'todos os arquivos',
      'processo completo',
      'analisando todos',
      'análise completa',
      'análise total',
      'em sua totalidade',
      'na íntegra',
      'integralmente'
    ];
  }

  /**
   * Detecta se uma solicitação é "exaustiva"
   */
  isExhaustiveRequest(text) {
    if (!text) return false;

    const lowerText = text.toLowerCase();

    return this.exhaustiveKeywords.some(keyword =>
      lowerText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Cria e executa job de análise exaustiva
   */
  async createJob(config) {
    const {
      projectId,
      userId,
      traceId,
      request,
      metadata = {}
    } = config;

    // Gerar job ID
    const jobId = `exhaustive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Criar job
    const job = new ExhaustiveAnalysisJob({
      jobId,
      projectId,
      userId,
      traceId,
      request,
      metadata
    });

    // Registrar job
    this.activeJobs.set(jobId, job);

    console.info('🚀 Job de análise exaustiva criado', {
      jobId,
      projectId,
      userId,
      traceId
    });

    // Listeners de eventos
    job.on('progress', (data) => {
      this.emit('job-progress', data);
      console.info(`📊 Job ${jobId}: ${data.progress.message} (${data.progress.percentage}%)`);
    });

    job.on('document-summarized', (data) => {
      this.emit('job-document-summarized', data);
    });

    job.on('completed', (data) => {
      // Mover para completed
      this.activeJobs.delete(jobId);
      this.completedJobs.set(jobId, job);

      this.emit('job-completed', data);
      console.info('✅ Job concluído', data);
    });

    job.on('failed', (data) => {
      // Manter em active com status failed
      this.emit('job-failed', data);
      console.error('❌ Job falhou', data);
    });

    // Executar job em background (não await aqui)
    this.executeJobInBackground(job);

    return {
      jobId,
      status: 'queued',
      message: 'Análise exaustiva iniciada. Você será notificado quando concluir.',
      estimatedTime: '5-15 minutos',
      trackingUrl: `/api/jobs/${jobId}/status`
    };
  }

  /**
   * Executa job em background
   */
  async executeJobInBackground(job) {
    try {
      await job.execute();
    } catch (error) {
      console.error('Erro ao executar job em background', {
        jobId: job.jobId,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Obtém status de um job
   */
  getJobStatus(jobId) {
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return activeJob.getStatus();
    }

    const completedJob = this.completedJobs.get(jobId);
    if (completedJob) {
      return completedJob.getStatus();
    }

    return null;
  }

  /**
   * Obtém resultados de um job completo
   */
  getJobResults(jobId) {
    const job = this.completedJobs.get(jobId);
    if (!job || job.status !== 'completed') {
      return null;
    }

    return job.results;
  }

  /**
   * Lista todos os jobs de um projeto
   */
  getProjectJobs(projectId) {
    const jobs = [];

    // Active jobs
    for (const [jobId, job] of this.activeJobs) {
      if (job.projectId === projectId) {
        jobs.push(job.getStatus());
      }
    }

    // Completed jobs
    for (const [jobId, job] of this.completedJobs) {
      if (job.projectId === projectId) {
        jobs.push(job.getStatus());
      }
    }

    return jobs.sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Lista todos os jobs de um usuário
   */
  getUserJobs(userId) {
    const jobs = [];

    // Active jobs
    for (const [jobId, job] of this.activeJobs) {
      if (job.userId === userId) {
        jobs.push(job.getStatus());
      }
    }

    // Completed jobs
    for (const [jobId, job] of this.completedJobs) {
      if (job.userId === userId) {
        jobs.push(job.getStatus());
      }
    }

    return jobs.sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Cancela um job
   */
  cancelJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return false;
    }

    job.status = 'cancelled';
    job.completedAt = Date.now();

    this.activeJobs.delete(jobId);

    console.info('🛑 Job cancelado', { jobId });

    this.emit('job-cancelled', { jobId });

    return true;
  }

  /**
   * Limpa jobs antigos (mantém últimos 50 completed)
   */
  cleanupOldJobs() {
    const maxCompleted = 50;

    if (this.completedJobs.size > maxCompleted) {
      // Ordenar por data
      const sorted = Array.from(this.completedJobs.entries())
        .sort((a, b) => b[1].completedAt - a[1].completedAt);

      // Manter apenas os últimos N
      const toDelete = sorted.slice(maxCompleted);

      for (const [jobId, job] of toDelete) {
        this.completedJobs.delete(jobId);
      }

      console.info('🧹 Jobs antigos removidos', {
        removed: toDelete.length
      });
    }
  }

  /**
   * Obtém estatísticas
   */
  getStats() {
    return {
      activeJobs: this.activeJobs.size,
      completedJobs: this.completedJobs.size,
      totalJobs: this.activeJobs.size + this.completedJobs.size
    };
  }
}

// Singleton
export const exhaustiveJobManager = new ExhaustiveJobManager();

// Cleanup periódico (a cada 1 hora)
setInterval(() => {
  exhaustiveJobManager.cleanupOldJobs();
}, 3600000);

export default exhaustiveJobManager;
