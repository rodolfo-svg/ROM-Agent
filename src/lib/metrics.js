/**
 * ROM Agent - Metrics Module
 *
 * Sistema de metricas para monitoramento de performance do streaming SSE
 * e loops de ferramentas.
 *
 * @version 2.9.0
 */

/**
 * Armazenamento de metricas em memoria
 */
const metricsStore = {
  toolLoops: [],
  sseStreamingTime: [],
  toolExecutionTime: [],
  forcedPresentations: 0,
  totalRequests: 0,
  lastReset: Date.now()
};

/**
 * Configuracoes de metricas
 */
const METRICS_CONFIG = {
  maxSamples: 1000,       // Maximo de amostras antes de rotacionar
  aggregationInterval: 60000,  // Intervalo de agregacao em ms (1 min)
  maxToolLoops: 2         // v2.9.0: MAX_TOOL_LOOPS configurado
};

/**
 * Classe de metricas
 */
class Metrics {
  constructor() {
    this.store = metricsStore;
    this.config = METRICS_CONFIG;
  }

  /**
   * Observa o numero de loops de ferramentas
   * @param {number} loopCount - Numero de loops executados
   */
  observeToolLoops(loopCount) {
    this._addSample('toolLoops', loopCount);

    // Log se exceder MAX_TOOL_LOOPS esperado
    if (loopCount >= this.config.maxToolLoops) {
      console.log(`[Metrics] Loop count ${loopCount} atingiu/excedeu MAX_TOOL_LOOPS (${this.config.maxToolLoops})`);
    }
  }

  /**
   * Observa tempo de streaming SSE
   * @param {number} timeMs - Tempo em milissegundos
   */
  observeSseStreamingTime(timeMs) {
    this._addSample('sseStreamingTime', timeMs);

    // Log performance status
    if (timeMs < 6000) {
      console.log(`[Metrics] SSE streaming EXCELENTE: ${timeMs}ms`);
    } else if (timeMs < 10000) {
      console.log(`[Metrics] SSE streaming BOM: ${timeMs}ms`);
    } else {
      console.warn(`[Metrics] SSE streaming LENTO: ${timeMs}ms (target: <10s)`);
    }
  }

  /**
   * Observa tempo de execucao de ferramenta
   * @param {string} toolName - Nome da ferramenta
   * @param {number} timeMs - Tempo em milissegundos
   */
  observeToolExecutionTime(toolName, timeMs) {
    this._addSample('toolExecutionTime', {
      tool: toolName,
      time: timeMs,
      timestamp: Date.now()
    });
  }

  /**
   * Incrementa contador de apresentacoes forcadas
   */
  incrementForcedPresentations() {
    this.store.forcedPresentations++;
    console.log(`[Metrics] Forced presentation #${this.store.forcedPresentations}`);
  }

  /**
   * Incrementa total de requests
   */
  incrementTotalRequests() {
    this.store.totalRequests++;
  }

  /**
   * Obtem estatisticas agregadas
   * @returns {object} Estatisticas
   */
  getStats() {
    const toolLoops = this.store.toolLoops;
    const sseTime = this.store.sseStreamingTime;

    return {
      toolLoops: {
        count: toolLoops.length,
        avg: this._average(toolLoops),
        min: Math.min(...toolLoops) || 0,
        max: Math.max(...toolLoops) || 0,
        maxConfigured: this.config.maxToolLoops
      },
      sseStreamingTime: {
        count: sseTime.length,
        avgMs: this._average(sseTime),
        minMs: Math.min(...sseTime) || 0,
        maxMs: Math.max(...sseTime) || 0,
        targetMs: 10000,
        belowTarget: sseTime.filter(t => t < 10000).length,
        aboveTarget: sseTime.filter(t => t >= 10000).length
      },
      forcedPresentations: this.store.forcedPresentations,
      totalRequests: this.store.totalRequests,
      uptimeMs: Date.now() - this.store.lastReset
    };
  }

  /**
   * Obtem metricas para Prometheus/Grafana (formato texto)
   * @returns {string} Metricas em formato Prometheus
   */
  toPrometheus() {
    const stats = this.getStats();

    return `
# HELP rom_tool_loops_total Total de loops de ferramentas
# TYPE rom_tool_loops_total counter
rom_tool_loops_total ${stats.toolLoops.count}

# HELP rom_tool_loops_avg Media de loops por request
# TYPE rom_tool_loops_avg gauge
rom_tool_loops_avg ${stats.toolLoops.avg.toFixed(2)}

# HELP rom_sse_streaming_time_ms Tempo de streaming SSE em ms
# TYPE rom_sse_streaming_time_ms histogram
rom_sse_streaming_time_ms_avg ${stats.sseStreamingTime.avgMs.toFixed(0)}
rom_sse_streaming_time_ms_min ${stats.sseStreamingTime.minMs}
rom_sse_streaming_time_ms_max ${stats.sseStreamingTime.maxMs}

# HELP rom_forced_presentations_total Apresentacoes forcadas por MAX_TOOL_LOOPS
# TYPE rom_forced_presentations_total counter
rom_forced_presentations_total ${stats.forcedPresentations}

# HELP rom_total_requests_total Total de requests processados
# TYPE rom_total_requests_total counter
rom_total_requests_total ${stats.totalRequests}

# HELP rom_max_tool_loops Configuracao MAX_TOOL_LOOPS
# TYPE rom_max_tool_loops gauge
rom_max_tool_loops ${this.config.maxToolLoops}

# HELP rom_sse_below_target_total SSE requests abaixo do target (10s)
# TYPE rom_sse_below_target_total counter
rom_sse_below_target_total ${stats.sseStreamingTime.belowTarget}

# HELP rom_sse_above_target_total SSE requests acima do target (10s)
# TYPE rom_sse_above_target_total counter
rom_sse_above_target_total ${stats.sseStreamingTime.aboveTarget}
`.trim();
  }

  /**
   * Reseta metricas
   */
  reset() {
    this.store.toolLoops = [];
    this.store.sseStreamingTime = [];
    this.store.toolExecutionTime = [];
    this.store.forcedPresentations = 0;
    this.store.totalRequests = 0;
    this.store.lastReset = Date.now();
    console.log('[Metrics] Reset complete');
  }

  /**
   * Helper para adicionar amostra com rotacao
   */
  _addSample(key, value) {
    if (!this.store[key]) {
      this.store[key] = [];
    }

    this.store[key].push(value);

    // Rotacionar se exceder maxSamples
    if (this.store[key].length > this.config.maxSamples) {
      this.store[key] = this.store[key].slice(-Math.floor(this.config.maxSamples / 2));
    }
  }

  /**
   * Helper para calcular media
   */
  _average(arr) {
    if (!arr || arr.length === 0) return 0;

    // Se for array de numeros simples
    if (typeof arr[0] === 'number') {
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    // Se for array de objetos com campo 'time'
    if (arr[0] && typeof arr[0].time === 'number') {
      return arr.reduce((a, b) => a + b.time, 0) / arr.length;
    }

    return 0;
  }
}

// Singleton instance
const metrics = new Metrics();

/**
 * Exports
 */
export default metrics;

export {
  Metrics,
  metricsStore,
  METRICS_CONFIG
};
