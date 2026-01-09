/**
 * ROM Agent - Loop Guardrails
 *
 * Previne loops infinitos em tool-use do Claude Bedrock
 *
 * Features:
 * - Soft limit (12 loops): warning log
 * - Hard limit (25 loops): força parada com fallback
 * - Detecção de repetição: 3 mesmas tools seguidas = stop
 * - Integração com feature flags
 * - Métricas Prometheus
 */

import structuredLogger from './structured-logger.js';
import metricsCollector from './metrics-collector.js';
import featureFlags from './feature-flags.js';

/**
 * Estado do guardrail para cada conversação
 */
const conversationState = new Map();

/**
 * Configuração padrão
 */
const DEFAULT_CONFIG = {
  softLimit: 12,
  hardLimit: 25,
  repetitionThreshold: 3,
  enabled: true
};

/**
 * Classe LoopGuardrails
 */
export class LoopGuardrails {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Inicializa tracking para uma conversação
   */
  initConversation(conversationId) {
    conversationState.set(conversationId, {
      loopCount: 0,
      toolHistory: [],
      warnings: [],
      stopped: false,
      startTime: Date.now()
    });

    structuredLogger.debug('Guardrail iniciado', {
      conversationId,
      config: this.config
    });
  }

  /**
   * Registra uso de tool e verifica limites
   */
  trackToolUse(conversationId, toolName) {
    // Verificar se guardrails estão habilitados
    if (!featureFlags.get('ENABLE_GUARDRAILS')) {
      return { allowed: true, reason: 'guardrails_disabled' };
    }

    // Obter ou criar estado
    let state = conversationState.get(conversationId);
    if (!state) {
      this.initConversation(conversationId);
      state = conversationState.get(conversationId);
    }

    // Incrementar contador
    state.loopCount++;
    state.toolHistory.push({
      tool: toolName,
      timestamp: Date.now(),
      loopNumber: state.loopCount
    });

    // Verificar hard limit
    if (state.loopCount >= this.config.hardLimit) {
      state.stopped = true;

      structuredLogger.error('Guardrail HARD LIMIT atingido - forçando parada', {
        conversationId,
        loopCount: state.loopCount,
        hardLimit: this.config.hardLimit,
        toolHistory: state.toolHistory.slice(-5)
      });

      // Métrica de violação
      metricsCollector.incrementGuardrailsTriggered('hard_limit');

      return {
        allowed: false,
        reason: 'hard_limit',
        message: `Loop infinito detectado: ${state.loopCount} iterações excederam o limite de ${this.config.hardLimit}. Operação abortada por segurança.`,
        loopCount: state.loopCount
      };
    }

    // Verificar soft limit (warning)
    if (state.loopCount >= this.config.softLimit && !state.warnings.includes('soft_limit')) {
      state.warnings.push('soft_limit');

      structuredLogger.warn('Guardrail SOFT LIMIT atingido - monitorando', {
        conversationId,
        loopCount: state.loopCount,
        softLimit: this.config.softLimit,
        toolHistory: state.toolHistory.slice(-5)
      });

      // Métrica de warning
      metricsCollector.incrementGuardrailsTriggered('soft_limit_warning');
    }

    // Verificar repetição de tools
    const repetition = this.detectRepetition(state.toolHistory, toolName);
    if (repetition.detected) {
      state.stopped = true;

      structuredLogger.error('Guardrail REPETIÇÃO detectada - forçando parada', {
        conversationId,
        toolName,
        repetitionCount: repetition.count,
        threshold: this.config.repetitionThreshold,
        recentHistory: state.toolHistory.slice(-10)
      });

      // Métrica de repetição
      metricsCollector.incrementGuardrailsTriggered('repetition');

      return {
        allowed: false,
        reason: 'repetition',
        message: `Comportamento repetitivo detectado: tool "${toolName}" usada ${repetition.count} vezes seguidas. Operação abortada para prevenir loop.`,
        loopCount: state.loopCount,
        repetitionCount: repetition.count
      };
    }

    // Tudo OK, permitir
    return {
      allowed: true,
      reason: 'within_limits',
      loopCount: state.loopCount,
      warningActive: state.loopCount >= this.config.softLimit
    };
  }

  /**
   * Detecta repetição de tools
   */
  detectRepetition(toolHistory, currentTool) {
    if (toolHistory.length < this.config.repetitionThreshold) {
      return { detected: false, count: 0 };
    }

    // Obter últimas N tools
    const recent = toolHistory.slice(-this.config.repetitionThreshold);

    // Verificar se todas são iguais
    const allSame = recent.every(entry => entry.tool === currentTool);

    if (allSame) {
      return {
        detected: true,
        count: this.config.repetitionThreshold,
        tool: currentTool
      };
    }

    return { detected: false, count: 0 };
  }

  /**
   * Obtém estatísticas de uma conversação
   */
  getStats(conversationId) {
    const state = conversationState.get(conversationId);

    if (!state) {
      return {
        found: false,
        conversationId
      };
    }

    return {
      found: true,
      conversationId,
      loopCount: state.loopCount,
      stopped: state.stopped,
      warnings: state.warnings,
      duration: Date.now() - state.startTime,
      toolHistory: state.toolHistory,
      status: state.stopped ? 'stopped' :
              state.loopCount >= this.config.softLimit ? 'warning' :
              'normal'
    };
  }

  /**
   * Limpa estado de uma conversação
   */
  cleanupConversation(conversationId) {
    const deleted = conversationState.delete(conversationId);

    if (deleted) {
      structuredLogger.debug('Guardrail cleanup', { conversationId });
    }

    return deleted;
  }

  /**
   * Obtém estatísticas globais
   */
  getGlobalStats() {
    const stats = {
      totalConversations: conversationState.size,
      activeConversations: 0,
      stoppedConversations: 0,
      warningConversations: 0,
      avgLoopCount: 0,
      maxLoopCount: 0
    };

    let totalLoops = 0;

    for (const [id, state] of conversationState.entries()) {
      if (state.stopped) {
        stats.stoppedConversations++;
      } else if (state.loopCount >= this.config.softLimit) {
        stats.warningConversations++;
      } else {
        stats.activeConversations++;
      }

      totalLoops += state.loopCount;
      stats.maxLoopCount = Math.max(stats.maxLoopCount, state.loopCount);
    }

    if (conversationState.size > 0) {
      stats.avgLoopCount = Math.round(totalLoops / conversationState.size);
    }

    return stats;
  }

  /**
   * Cleanup periódico (remover conversações antigas)
   */
  periodicCleanup(maxAge = 3600000) { // 1 hora padrão
    const now = Date.now();
    const removed = [];

    for (const [id, state] of conversationState.entries()) {
      const age = now - state.startTime;

      if (age > maxAge) {
        conversationState.delete(id);
        removed.push(id);
      }
    }

    if (removed.length > 0) {
      structuredLogger.info('Guardrail periodic cleanup', {
        removed: removed.length,
        maxAge,
        remaining: conversationState.size
      });
    }

    return {
      removed: removed.length,
      remaining: conversationState.size
    };
  }
}

// Instância singleton
export const loopGuardrails = new LoopGuardrails();

// Cleanup periódico a cada 30 minutos
setInterval(() => {
  loopGuardrails.periodicCleanup();
}, 30 * 60 * 1000);

export default loopGuardrails;
