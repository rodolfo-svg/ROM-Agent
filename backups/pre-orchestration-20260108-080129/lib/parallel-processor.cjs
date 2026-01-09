/**
 * Sistema de Processamento Paralelo - ROM Agent
 *
 * Otimizado para 8 processadores:
 * - Worker Threads para processamento paralelo
 * - Fila de tarefas com prioridade
 * - Load balancing automático
 * - Máximo throughput
 */

const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

class ParallelProcessor extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuração
    this.numWorkers = options.numWorkers || Math.min(8, os.cpus().length);
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.workerScript = options.workerScript || path.join(__dirname, './worker.cjs');

    // Estado
    this.workers = [];
    this.taskQueue = [];
    this.activeTasks = new Map();
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.totalProcessingTime = 0;

    // Estatísticas
    this.stats = {
      tasksProcessed: 0,
      tasksInQueue: 0,
      averageProcessingTime: 0,
      throughput: 0, // tarefas por segundo
      workersUtilization: []
    };

    this.initialized = false;
  }

  /**
   * Inicializar pool de workers
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️ ParallelProcessor já inicializado');
      return;
    }

    console.log(`🚀 Inicializando ${this.numWorkers} workers para processamento paralelo...`);

    for (let i = 0; i < this.numWorkers; i++) {
      await this.createWorker(i);
    }

    this.initialized = true;
    this.startStatsMonitor();

    console.log(`✅ ParallelProcessor inicializado com ${this.numWorkers} workers`);
  }

  /**
   * Criar worker
   * @param {number} workerId
   */
  async createWorker(workerId) {
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker(this.workerScript, {
          workerData: { workerId }
        });

        const workerInfo = {
          id: workerId,
          worker,
          busy: false,
          tasksCompleted: 0,
          currentTask: null,
          totalProcessingTime: 0
        };

        // Mensagens do worker
        worker.on('message', (message) => {
          this.handleWorkerMessage(workerInfo, message);
        });

        // Erro no worker
        worker.on('error', (error) => {
          console.error(`❌ Erro no Worker ${workerId}:`, error);
          workerInfo.busy = false;
          this.processNextTask();
        });

        // Worker encerrado
        worker.on('exit', (code) => {
          if (code !== 0) {
            console.error(`❌ Worker ${workerId} encerrou com código ${code}`);
          }
          // Recriar worker se necessário
          if (this.initialized) {
            setTimeout(() => this.createWorker(workerId), 1000);
          }
        });

        this.workers.push(workerInfo);
        resolve(workerInfo);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Processar mensagem do worker
   * @param {Object} workerInfo
   * @param {Object} message
   */
  handleWorkerMessage(workerInfo, message) {
    const { type, taskId, result, error, processingTime } = message;

    if (type === 'ready') {
      workerInfo.busy = false;
      this.processNextTask();
      return;
    }

    if (type === 'result') {
      workerInfo.busy = false;
      workerInfo.tasksCompleted++;
      workerInfo.totalProcessingTime += processingTime;

      const task = this.activeTasks.get(taskId);
      if (task) {
        this.completedTasks++;
        this.totalProcessingTime += processingTime;

        if (error) {
          this.failedTasks++;
          task.reject(new Error(error));
        } else {
          task.resolve(result);
        }

        this.activeTasks.delete(taskId);
        this.emit('taskCompleted', { taskId, result, processingTime });
      }

      // Processar próxima tarefa
      this.processNextTask();
    }
  }

  /**
   * Adicionar tarefa à fila
   * @param {Object} task - Tarefa a processar
   * @param {number} priority - Prioridade (maior = mais prioritário)
   * @returns {Promise} Resultado da tarefa
   */
  async addTask(task, priority = 0) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.taskQueue.length >= this.maxQueueSize) {
      throw new Error('Fila de tarefas cheia. Aguarde processamento.');
    }

    return new Promise((resolve, reject) => {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const taskWrapper = {
        id: taskId,
        data: task,
        priority,
        resolve,
        reject,
        createdAt: Date.now()
      };

      // Inserir na fila mantendo ordem de prioridade
      const insertIndex = this.taskQueue.findIndex(t => t.priority < priority);
      if (insertIndex === -1) {
        this.taskQueue.push(taskWrapper);
      } else {
        this.taskQueue.splice(insertIndex, 0, taskWrapper);
      }

      this.emit('taskQueued', { taskId, priority });
      this.processNextTask();
    });
  }

  /**
   * Processar próxima tarefa da fila
   */
  processNextTask() {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Encontrar worker disponível
    const availableWorker = this.workers.find(w => !w.busy);
    if (!availableWorker) {
      return; // Todos os workers estão ocupados
    }

    // Pegar próxima tarefa (maior prioridade)
    const task = this.taskQueue.shift();
    if (!task) return;

    // Marcar worker como ocupado
    availableWorker.busy = true;
    availableWorker.currentTask = task.id;

    // Adicionar às tarefas ativas
    this.activeTasks.set(task.id, task);

    // Enviar tarefa para worker
    availableWorker.worker.postMessage({
      type: 'task',
      taskId: task.id,
      data: task.data
    });

    this.emit('taskStarted', { taskId: task.id, workerId: availableWorker.id });
  }

  /**
   * Processar lote de tarefas em paralelo
   * @param {Array} tasks - Array de tarefas
   * @param {Object} options - Opções
   * @returns {Promise<Array>} Resultados
   */
  async processBatch(tasks, options = {}) {
    const { priority = 0, progressCallback } = options;

    console.log(`📦 Processando lote de ${tasks.length} tarefas em paralelo...`);

    const promises = tasks.map((task, index) => {
      return this.addTask(task, priority).then(result => {
        if (progressCallback) {
          progressCallback(index + 1, tasks.length);
        }
        return result;
      });
    });

    const results = await Promise.all(promises);

    console.log(`✅ Lote processado: ${results.length} tarefas concluídas`);

    return results;
  }

  /**
   * Obter estatísticas
   * @returns {Object} Estatísticas
   */
  getStatistics() {
    const busyWorkers = this.workers.filter(w => w.busy).length;
    const utilization = (busyWorkers / this.numWorkers * 100).toFixed(1);

    const avgProcessingTime = this.completedTasks > 0
      ? (this.totalProcessingTime / this.completedTasks).toFixed(2)
      : 0;

    // Calcular throughput (tarefas por segundo)
    const uptime = process.uptime();
    const throughput = (this.completedTasks / uptime).toFixed(2);

    return {
      workers: {
        total: this.numWorkers,
        busy: busyWorkers,
        idle: this.numWorkers - busyWorkers,
        utilization: `${utilization}%`
      },
      tasks: {
        completed: this.completedTasks,
        failed: this.failedTasks,
        inQueue: this.taskQueue.length,
        active: this.activeTasks.size,
        successRate: this.completedTasks > 0
          ? ((this.completedTasks / (this.completedTasks + this.failedTasks)) * 100).toFixed(1) + '%'
          : 'N/A'
      },
      performance: {
        avgProcessingTime: `${avgProcessingTime}ms`,
        totalProcessingTime: `${(this.totalProcessingTime / 1000).toFixed(2)}s`,
        throughput: `${throughput} tarefas/s`
      },
      workerDetails: this.workers.map(w => ({
        id: w.id,
        busy: w.busy,
        tasksCompleted: w.tasksCompleted,
        avgProcessingTime: w.tasksCompleted > 0
          ? (w.totalProcessingTime / w.tasksCompleted).toFixed(2) + 'ms'
          : 'N/A'
      }))
    };
  }

  /**
   * Iniciar monitor de estatísticas
   */
  startStatsMonitor() {
    setInterval(() => {
      const stats = this.getStatistics();
      this.emit('stats', stats);

      // Log de utilização se estiver alta
      if (parseInt(stats.workers.utilization) > 90) {
        console.log(`⚠️ Alta utilização de workers: ${stats.workers.utilization}`);
      }
    }, 5000); // A cada 5 segundos
  }

  /**
   * Limpar fila de tarefas
   */
  clearQueue() {
    const queueSize = this.taskQueue.length;
    this.taskQueue.forEach(task => {
      task.reject(new Error('Fila limpa'));
    });
    this.taskQueue = [];
    console.log(`🧹 Fila limpa: ${queueSize} tarefas removidas`);
  }

  /**
   * Aguardar conclusão de todas as tarefas ativas
   */
  async waitForCompletion(timeout = 60000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        if (this.activeTasks.size === 0 && this.taskQueue.length === 0) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout aguardando conclusão das tarefas'));
        } else {
          setTimeout(checkCompletion, 100);
        }
      };

      checkCompletion();
    });
  }

  /**
   * Encerrar todos os workers
   */
  async shutdown() {
    console.log('🛑 Encerrando ParallelProcessor...');

    this.initialized = false;

    // Aguardar tarefas ativas (máx 30s)
    try {
      await this.waitForCompletion(30000);
    } catch (error) {
      console.warn('⚠️ Timeout aguardando tarefas. Forçando encerramento.');
    }

    // Encerrar workers
    const terminationPromises = this.workers.map(workerInfo => {
      return workerInfo.worker.terminate();
    });

    await Promise.all(terminationPromises);

    this.workers = [];

    console.log('✅ ParallelProcessor encerrado');
  }
}

/**
 * Exemplo de uso:
 *
 * const processor = new ParallelProcessor({ numWorkers: 8 });
 * await processor.initialize();
 *
 * // Processar tarefa única
 * const result = await processor.addTask({
 *   type: 'extract_pdf',
 *   file: 'path/to/file.pdf'
 * });
 *
 * // Processar lote
 * const results = await processor.processBatch([
 *   { type: 'extract_pdf', file: 'file1.pdf' },
 *   { type: 'extract_pdf', file: 'file2.pdf' },
 *   { type: 'extract_pdf', file: 'file3.pdf' }
 * ], {
 *   progressCallback: (current, total) => {
 *     console.log(`Progresso: ${current}/${total}`);
 *   }
 * });
 */

module.exports = ParallelProcessor;
