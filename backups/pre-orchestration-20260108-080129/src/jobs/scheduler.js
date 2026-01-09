/**
 * ROM Agent - Scheduler de Jobs
 * Sistema de agendamento de tarefas usando node-cron
 */

import cron from 'node-cron';
import { deployJob } from './deploy-job.js';
import { logger } from '../utils/logger.js';
import oneDriveBackup from '../../lib/onedrive-backup.js';

class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Inicializa todos os jobs agendados
   */
  start() {
    if (this.isRunning) {
      logger.warn('Scheduler já está em execução');
      return;
    }

    logger.info('Iniciando scheduler de jobs...');

    // Deploy automático entre 02h-05h (horário de Brasília)
    // Executa deploy às 02h todos os dias
    this.scheduleJob('deploy-madrugada', '0 2 * * *', deployJob.execute.bind(deployJob), {
      timezone: 'America/Sao_Paulo',
      description: 'Deploy automático de madrugada (02h-05h)'
    });

    // Health check do scheduler - executa a cada hora
    this.scheduleJob('health-check', '0 * * * *', () => {
      logger.info('Scheduler health check - Todos os jobs ativos');
    }, {
      timezone: 'America/Sao_Paulo',
      description: 'Verificação de saúde do scheduler'
    });

    // Backup automático OneDrive - executa às 04h todos os dias
    this.scheduleJob('onedrive-backup', '0 4 * * *', async () => {
      logger.info('🔄 Iniciando backup automático para OneDrive...');
      try {
        const result = await oneDriveBackup.backup();
        logger.info(`✅ Backup OneDrive concluído: ${result.success.length} itens salvos`);
      } catch (error) {
        logger.error('❌ Erro no backup OneDrive:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo',
      description: 'Backup automático OneDrive às 04h'
    });

    this.isRunning = true;
    logger.info('Scheduler iniciado com sucesso');
    this.listJobs();
  }

  /**
   * Agenda um novo job
   */
  scheduleJob(name, cronExpression, callback, options = {}) {
    try {
      if (this.jobs.has(name)) {
        logger.warn(`Job '${name}' já existe. Substituindo...`);
        this.jobs.get(name).task.stop();
      }

      const task = cron.schedule(cronExpression, async () => {
        logger.info(`Executando job: ${name}`);
        try {
          await callback();
          logger.info(`Job '${name}' concluído com sucesso`);
        } catch (error) {
          logger.error(`Erro ao executar job '${name}':`, error);
        }
      }, {
        scheduled: true,
        timezone: options.timezone || 'America/Sao_Paulo'
      });

      this.jobs.set(name, {
        task,
        cronExpression,
        description: options.description || 'Sem descrição',
        timezone: options.timezone || 'America/Sao_Paulo',
        createdAt: new Date()
      });

      logger.info(`Job '${name}' agendado: ${cronExpression} (${options.timezone || 'America/Sao_Paulo'})`);
    } catch (error) {
      logger.error(`Erro ao agendar job '${name}':`, error);
      throw error;
    }
  }

  /**
   * Remove um job agendado
   */
  removeJob(name) {
    if (this.jobs.has(name)) {
      this.jobs.get(name).task.stop();
      this.jobs.delete(name);
      logger.info(`Job '${name}' removido`);
      return true;
    }
    logger.warn(`Job '${name}' não encontrado`);
    return false;
  }

  /**
   * Para todos os jobs
   */
  stop() {
    logger.info('Parando scheduler...');
    for (const [name, job] of this.jobs) {
      job.task.stop();
      logger.info(`Job '${name}' parado`);
    }
    this.isRunning = false;
    logger.info('Scheduler parado');
  }

  /**
   * Lista todos os jobs ativos
   */
  listJobs() {
    if (this.jobs.size === 0) {
      logger.info('Nenhum job agendado');
      return [];
    }

    const jobsList = [];
    logger.info('=== Jobs Agendados ===');
    for (const [name, job] of this.jobs) {
      const info = {
        name,
        cron: job.cronExpression,
        description: job.description,
        timezone: job.timezone,
        createdAt: job.createdAt.toISOString()
      };
      jobsList.push(info);
      logger.info(`  - ${name}: ${job.cronExpression} (${job.description})`);
    }
    logger.info('=====================');
    return jobsList;
  }

  /**
   * Executa um job manualmente
   */
  async runJob(name) {
    if (!this.jobs.has(name)) {
      throw new Error(`Job '${name}' não encontrado`);
    }

    logger.info(`Executando job '${name}' manualmente...`);

    // Para jobs de deploy, executamos a função diretamente
    if (name === 'deploy-madrugada') {
      await deployJob.execute();
    }
  }

  /**
   * Obtém status do scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      totalJobs: this.jobs.size,
      jobs: Array.from(this.jobs.entries()).map(([name, job]) => ({
        name,
        cron: job.cronExpression,
        description: job.description,
        timezone: job.timezone,
        createdAt: job.createdAt.toISOString()
      }))
    };
  }
}

// Singleton
export const scheduler = new JobScheduler();
