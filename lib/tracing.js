/**
 * TRACING MANAGER - Rastreamento End-to-End
 *
 * Sistema de rastreamento distribuído para observabilidade completa
 * Implementação do BACKSPEC BETA - ETAPA 1
 *
 * Funcionalidades:
 * - trace_id universal para requisições
 * - layer_run_id para execução de layers
 * - Correlação de logs
 * - Auditoria completa
 * - Persistência em disco
 *
 * Dr. Rodolfo Otávio Mota, OAB/GO 21.841
 */

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

class TracingManager {
  constructor() {
    this.activeTraces = new Map();
    this.tracesPath = path.join(process.cwd(), 'logs', 'traces');
    this.ensureTracesDirectory();
  }

  /**
   * Garantir que diretório de traces existe
   */
  ensureTracesDirectory() {
    if (!fs.existsSync(this.tracesPath)) {
      fs.mkdirSync(this.tracesPath, { recursive: true });
      logger.info('📁 Diretório de traces criado:', this.tracesPath);
    }
  }

  /**
   * Iniciar novo trace
   * @param {string} userId - ID do usuário
   * @param {string} projectId - ID do projeto (opcional)
   * @param {string} casoId - ID do caso (opcional)
   * @param {object} metadata - Metadados adicionais
   * @returns {string} trace_id
   */
  startTrace(userId, projectId = null, casoId = null, metadata = {}) {
    const traceId = randomUUID();

    const trace = {
      traceId,
      userId,
      projectId,
      casoId,
      metadata,
      startTime: Date.now(),
      startedAt: new Date().toISOString(),
      layers: [],
      events: [],
      status: 'active',
      endTime: null,
      duration: null
    };

    this.activeTraces.set(traceId, trace);

    logger.info('🔍 Trace iniciado', {
      traceId,
      userId,
      projectId,
      casoId,
      ...metadata
    });

    return traceId;
  }

  /**
   * Adicionar evento ao trace
   * @param {string} traceId - ID do trace
   * @param {string} eventType - Tipo do evento
   * @param {object} eventData - Dados do evento
   */
  addEvent(traceId, eventType, eventData = {}) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn('⚠️ Trace não encontrado para evento:', traceId);
      return;
    }

    const event = {
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      type: eventType,
      data: eventData
    };

    trace.events.push(event);

    logger.debug('📌 Evento adicionado ao trace', {
      traceId,
      eventType,
      ...eventData
    });
  }

  /**
   * Iniciar execução de layer
   * @param {string} traceId - ID do trace
   * @param {number} layerNumber - Número da layer (1-5)
   * @param {string} layerName - Nome da layer
   * @param {object} layerMetadata - Metadados da layer
   * @returns {string} layer_run_id
   */
  startLayer(traceId, layerNumber, layerName, layerMetadata = {}) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn('⚠️ Trace não encontrado para layer:', traceId);
      return null;
    }

    const layerRunId = randomUUID();

    const layer = {
      layerRunId,
      layerNumber,
      layerName,
      metadata: layerMetadata,
      startTime: Date.now(),
      startedAt: new Date().toISOString(),
      steps: [],
      status: 'running',
      endTime: null,
      duration: null,
      error: null
    };

    trace.layers.push(layer);

    logger.info(`🎯 Layer ${layerNumber} iniciada`, {
      traceId,
      layerRunId,
      layerName,
      ...layerMetadata
    });

    return layerRunId;
  }

  /**
   * Adicionar step à layer
   * @param {string} traceId - ID do trace
   * @param {string} layerRunId - ID da execução da layer
   * @param {string} message - Mensagem do step
   * @param {string} status - Status: 'info'|'success'|'warning'|'error'
   * @param {object} stepData - Dados adicionais do step
   */
  addStep(traceId, layerRunId, message, status = 'info', stepData = {}) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn('⚠️ Trace não encontrado para step:', traceId);
      return;
    }

    const layer = trace.layers.find(l => l.layerRunId === layerRunId);
    if (!layer) {
      logger.warn('⚠️ Layer não encontrada para step:', layerRunId);
      return;
    }

    const step = {
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      message,
      status,
      data: stepData
    };

    layer.steps.push(step);

    // Log apropriado baseado no status
    const logLevel = status === 'error' ? 'error' : status === 'warning' ? 'warn' : 'info';
    logger[logLevel](`   ${message}`, {
      traceId,
      layerRunId,
      ...stepData
    });
  }

  /**
   * Finalizar layer
   * @param {string} traceId - ID do trace
   * @param {string} layerRunId - ID da execução da layer
   * @param {object} result - Resultado da layer
   */
  endLayer(traceId, layerRunId, result = {}) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn('⚠️ Trace não encontrado ao finalizar layer:', traceId);
      return;
    }

    const layer = trace.layers.find(l => l.layerRunId === layerRunId);
    if (!layer) {
      logger.warn('⚠️ Layer não encontrada ao finalizar:', layerRunId);
      return;
    }

    layer.endTime = Date.now();
    layer.duration = layer.endTime - layer.startTime;
    layer.status = 'completed';
    layer.result = result;

    logger.info(`✅ Layer ${layer.layerNumber} concluída`, {
      traceId,
      layerRunId,
      layerName: layer.layerName,
      duration: `${layer.duration}ms`,
      steps: layer.steps.length
    });
  }

  /**
   * Finalizar layer com erro
   * @param {string} traceId - ID do trace
   * @param {string} layerRunId - ID da execução da layer
   * @param {Error} error - Erro ocorrido
   */
  failLayer(traceId, layerRunId, error) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn('⚠️ Trace não encontrado ao falhar layer:', traceId);
      return;
    }

    const layer = trace.layers.find(l => l.layerRunId === layerRunId);
    if (!layer) {
      logger.warn('⚠️ Layer não encontrada ao falhar:', layerRunId);
      return;
    }

    layer.endTime = Date.now();
    layer.duration = layer.endTime - layer.startTime;
    layer.status = 'failed';
    layer.error = {
      message: error.message,
      stack: error.stack,
      name: error.name
    };

    logger.error(`❌ Layer ${layer.layerNumber} falhou`, {
      traceId,
      layerRunId,
      layerName: layer.layerName,
      duration: `${layer.duration}ms`,
      error: error.message
    });
  }

  /**
   * Finalizar trace
   * @param {string} traceId - ID do trace
   * @param {object} finalResult - Resultado final
   * @returns {object} Trace completo
   */
  endTrace(traceId, finalResult = {}) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn('⚠️ Trace não encontrado ao finalizar:', traceId);
      return null;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.endedAt = new Date().toISOString();
    trace.status = 'completed';
    trace.result = finalResult;

    // Estatísticas do trace
    trace.stats = {
      totalLayers: trace.layers.length,
      totalSteps: trace.layers.reduce((sum, l) => sum + l.steps.length, 0),
      totalEvents: trace.events.length,
      layersDuration: trace.layers.reduce((sum, l) => sum + (l.duration || 0), 0),
      successfulLayers: trace.layers.filter(l => l.status === 'completed').length,
      failedLayers: trace.layers.filter(l => l.status === 'failed').length
    };

    // Salvar trace em disco para auditoria
    this.persistTrace(trace);

    // Remover de memória
    this.activeTraces.delete(traceId);

    logger.info('✅ Trace finalizado', {
      traceId,
      duration: `${trace.duration}ms`,
      layers: trace.stats.totalLayers,
      steps: trace.stats.totalSteps,
      events: trace.stats.totalEvents
    });

    return trace;
  }

  /**
   * Finalizar trace com erro
   * @param {string} traceId - ID do trace
   * @param {Error} error - Erro ocorrido
   * @returns {object} Trace completo
   */
  failTrace(traceId, error) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn('⚠️ Trace não encontrado ao falhar:', traceId);
      return null;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.endedAt = new Date().toISOString();
    trace.status = 'failed';
    trace.error = {
      message: error.message,
      stack: error.stack,
      name: error.name
    };

    // Estatísticas do trace
    trace.stats = {
      totalLayers: trace.layers.length,
      totalSteps: trace.layers.reduce((sum, l) => sum + l.steps.length, 0),
      totalEvents: trace.events.length,
      layersDuration: trace.layers.reduce((sum, l) => sum + (l.duration || 0), 0),
      successfulLayers: trace.layers.filter(l => l.status === 'completed').length,
      failedLayers: trace.layers.filter(l => l.status === 'failed').length
    };

    // Salvar trace em disco para auditoria
    this.persistTrace(trace);

    // Remover de memória
    this.activeTraces.delete(traceId);

    logger.error('❌ Trace falhou', {
      traceId,
      duration: `${trace.duration}ms`,
      error: error.message,
      layers: trace.stats.totalLayers
    });

    return trace;
  }

  /**
   * Persistir trace em disco
   * @param {object} trace - Trace completo
   */
  persistTrace(trace) {
    try {
      const filename = `${trace.traceId}.json`;
      const filepath = path.join(this.tracesPath, filename);

      fs.writeFileSync(filepath, JSON.stringify(trace, null, 2));

      logger.debug('💾 Trace persistido', {
        traceId: trace.traceId,
        filepath
      });
    } catch (error) {
      logger.error('❌ Erro ao persistir trace:', error);
    }
  }

  /**
   * Obter trace ativo
   * @param {string} traceId - ID do trace
   * @returns {object} Trace
   */
  getTrace(traceId) {
    return this.activeTraces.get(traceId);
  }

  /**
   * Obter todos os traces ativos
   * @returns {Array} Array de traces
   */
  getActiveTraces() {
    return Array.from(this.activeTraces.values());
  }

  /**
   * Carregar trace do disco
   * @param {string} traceId - ID do trace
   * @returns {object} Trace
   */
  loadTrace(traceId) {
    try {
      const filepath = path.join(this.tracesPath, `${traceId}.json`);

      if (!fs.existsSync(filepath)) {
        logger.warn('⚠️ Trace não encontrado no disco:', traceId);
        return null;
      }

      const trace = JSON.parse(fs.readFileSync(filepath, 'utf8'));

      logger.debug('📂 Trace carregado do disco', { traceId });

      return trace;
    } catch (error) {
      logger.error('❌ Erro ao carregar trace:', error);
      return null;
    }
  }

  /**
   * Listar traces salvos
   * @param {object} filters - Filtros (userId, projectId, casoId, dateFrom, dateTo, status)
   * @param {number} limit - Limite de resultados
   * @returns {Array} Array de traces
   */
  listTraces(filters = {}, limit = 100) {
    try {
      const files = fs.readdirSync(this.tracesPath);
      const traces = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filepath = path.join(this.tracesPath, file);
        const trace = JSON.parse(fs.readFileSync(filepath, 'utf8'));

        // Aplicar filtros
        if (filters.userId && trace.userId !== filters.userId) continue;
        if (filters.projectId && trace.projectId !== filters.projectId) continue;
        if (filters.casoId && trace.casoId !== filters.casoId) continue;
        if (filters.status && trace.status !== filters.status) continue;

        if (filters.dateFrom) {
          const traceDate = new Date(trace.startedAt);
          const filterDate = new Date(filters.dateFrom);
          if (traceDate < filterDate) continue;
        }

        if (filters.dateTo) {
          const traceDate = new Date(trace.startedAt);
          const filterDate = new Date(filters.dateTo);
          if (traceDate > filterDate) continue;
        }

        traces.push(trace);

        if (traces.length >= limit) break;
      }

      // Ordenar por data (mais recente primeiro)
      traces.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

      logger.debug(`📋 Listados ${traces.length} traces`, filters);

      return traces;
    } catch (error) {
      logger.error('❌ Erro ao listar traces:', error);
      return [];
    }
  }

  /**
   * Limpar traces antigos
   * @param {number} daysOld - Dias de idade
   * @returns {number} Número de traces removidos
   */
  cleanOldTraces(daysOld = 30) {
    try {
      const files = fs.readdirSync(this.tracesPath);
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - (daysOld * 24 * 60 * 60 * 1000));
      let removed = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filepath = path.join(this.tracesPath, file);
        const trace = JSON.parse(fs.readFileSync(filepath, 'utf8'));

        const traceDate = new Date(trace.startedAt);
        if (traceDate < cutoffDate) {
          fs.unlinkSync(filepath);
          removed++;
        }
      }

      logger.info(`🧹 Traces antigos removidos: ${removed}`, { daysOld });

      return removed;
    } catch (error) {
      logger.error('❌ Erro ao limpar traces antigos:', error);
      return 0;
    }
  }

  /**
   * Obter estatísticas de tracing
   * @returns {object} Estatísticas
   */
  getStats() {
    try {
      const activeTraces = this.getActiveTraces();
      const files = fs.readdirSync(this.tracesPath);
      const totalTraces = files.filter(f => f.endsWith('.json')).length;

      return {
        activeTraces: activeTraces.length,
        totalTracesSaved: totalTraces,
        tracesPath: this.tracesPath,
        activeDetails: activeTraces.map(t => ({
          traceId: t.traceId,
          userId: t.userId,
          projectId: t.projectId,
          casoId: t.casoId,
          startedAt: t.startedAt,
          layersCompleted: t.layers.filter(l => l.status === 'completed').length,
          layersTotal: t.layers.length
        }))
      };
    } catch (error) {
      logger.error('❌ Erro ao obter estatísticas de tracing:', error);
      return {
        activeTraces: 0,
        totalTracesSaved: 0,
        error: error.message
      };
    }
  }
}

// Singleton
const tracingManager = new TracingManager();

export default tracingManager;

/**
 * EXEMPLO DE USO:
 *
 * import tracing from './lib/tracing.js';
 *
 * // Iniciar trace
 * const traceId = tracing.startTrace(userId, projectId, casoId, {
 *   requestType: 'case-processor',
 *   model: 'claude-sonnet-4'
 * });
 *
 * // Adicionar evento
 * tracing.addEvent(traceId, 'document-uploaded', {
 *   documentId: 'doc-123',
 *   filename: 'processo.pdf'
 * });
 *
 * // Iniciar layer
 * const layerRunId = tracing.startLayer(traceId, 1, 'Extração', {
 *   documentCount: 3
 * });
 *
 * // Adicionar steps
 * tracing.addStep(traceId, layerRunId, 'Iniciando extração...', 'info');
 * tracing.addStep(traceId, layerRunId, 'Documento 1 extraído', 'success', {
 *   pages: 10
 * });
 *
 * // Finalizar layer
 * tracing.endLayer(traceId, layerRunId, {
 *   documentsExtracted: 3,
 *   totalPages: 30
 * });
 *
 * // Finalizar trace
 * tracing.endTrace(traceId, {
 *   success: true,
 *   outputPath: '/path/to/output'
 * });
 *
 * // Listar traces
 * const traces = tracing.listTraces({ userId: 'user-123' }, 10);
 *
 * // Estatísticas
 * const stats = tracing.getStats();
 */
