/**
 * SLO (Service Level Objectives) Configuration
 *
 * Define timeouts, retry policies e limites de performance
 * para todas as operações críticas do sistema.
 *
 * Referências:
 * - Google SRE Book: https://sre.google/sre-book/service-level-objectives/
 * - AWS Best Practices: https://docs.aws.amazon.com/wellarchitected/
 */

export const SLO_CONFIG = {
  /**
   * HTTP ROUTES - Timeouts por tipo de operação
   */
  http: {
    // Rotas rápidas (health checks, info)
    fast: {
      timeout: 5_000,        // 5s
      description: 'Health checks, /api/info, /metrics'
    },

    // Rotas síncronas (CRUD, queries)
    sync: {
      timeout: 30_000,       // 30s
      description: 'CRUD operations, DB queries, simple API calls'
    },

    // Rotas assíncronas (chat, geração de peças)
    async: {
      timeout: 120_000,      // 2min
      description: 'AI chat, document generation'
    },

    // Rotas longas (processamento batch, uploads)
    long: {
      timeout: 300_000,      // 5min
      description: 'Batch processing, large file uploads'
    }
  },

  /**
   * EXTERNAL SERVICES - Timeouts para APIs externas
   */
  external: {
    // AWS Bedrock
    bedrock: {
      timeout: 60_000,       // 1min
      retries: 3,
      retryDelay: 1_000,     // 1s entre retries
      description: 'AWS Bedrock API calls (Claude, Nova)'
    },

    // DataJud
    datajud: {
      timeout: 30_000,       // 30s
      retries: 2,
      retryDelay: 2_000,     // 2s entre retries
      description: 'DataJud jurisprudence search'
    },

    // JusBrasil
    jusbrasil: {
      timeout: 20_000,       // 20s
      retries: 2,
      retryDelay: 1_000,
      description: 'JusBrasil authentication and search'
    },

    // S3
    s3: {
      timeout: 45_000,       // 45s
      retries: 3,
      retryDelay: 500,       // 500ms entre retries
      description: 'AWS S3 upload/download'
    }
  },

  /**
   * BACKGROUND JOBS - Timeouts para jobs assíncronos
   */
  jobs: {
    // Backup
    backup: {
      timeout: 600_000,      // 10min
      description: 'OneDrive backup job'
    },

    // KB Reindex
    kbReindex: {
      timeout: 180_000,      // 3min
      description: 'Knowledge Base reindexing'
    },

    // Metrics collection
    metricsCollection: {
      timeout: 10_000,       // 10s
      description: 'Prometheus metrics collection'
    }
  },

  /**
   * DATABASE - Timeouts para queries
   */
  database: {
    // Query rápida
    query: {
      timeout: 5_000,        // 5s
      description: 'Single SELECT, INSERT, UPDATE'
    },

    // Query complexa
    complexQuery: {
      timeout: 15_000,       // 15s
      description: 'JOINs, aggregations, full-text search'
    },

    // Transaction
    transaction: {
      timeout: 10_000,       // 10s
      description: 'Database transactions'
    }
  },

  /**
   * CIRCUIT BREAKER - Configurações
   */
  circuitBreaker: {
    // Threshold para abrir circuito
    failureThreshold: 5,              // 5 falhas consecutivas

    // Tempo de cooldown (circuito aberto)
    cooldownPeriod: 60_000,           // 1min

    // Tempo de half-open (teste)
    halfOpenTimeout: 30_000,          // 30s

    description: 'Circuit breaker global settings'
  },

  /**
   * RATE LIMITING - Limites de taxa
   */
  rateLimit: {
    // Por IP
    perIp: {
      windowMs: 60_000,                // 1min
      maxRequests: 100,                // 100 req/min
      description: 'Rate limit per IP address'
    },

    // Por API key
    perApiKey: {
      windowMs: 60_000,                // 1min
      maxRequests: 500,                // 500 req/min
      description: 'Rate limit per API key (authenticated)'
    },

    // Endpoints críticos
    criticalEndpoints: {
      windowMs: 60_000,                // 1min
      maxRequests: 20,                 // 20 req/min
      description: 'Rate limit for /api/chat, /api/generate'
    }
  },

  /**
   * MONITORING - SLIs (Service Level Indicators)
   */
  sli: {
    // Latência p95 (95% dos requests)
    latencyP95: {
      target: 2_000,                   // 2s
      description: '95th percentile latency target'
    },

    // Latência p99 (99% dos requests)
    latencyP99: {
      target: 5_000,                   // 5s
      description: '99th percentile latency target'
    },

    // Availability (uptime)
    availability: {
      target: 99.9,                    // 99.9%
      description: 'Service availability target (three nines)'
    },

    // Error rate
    errorRate: {
      target: 1.0,                     // 1%
      description: 'Maximum acceptable error rate'
    }
  }
};

/**
 * Helper: Obter timeout para operação específica
 */
export function getTimeout(category, operation) {
  const config = SLO_CONFIG[category]?.[operation];
  if (!config) {
    console.warn(`[SLO] Unknown operation: ${category}.${operation}, using default 30s`);
    return 30_000;
  }
  return config.timeout;
}

/**
 * Helper: Criar AbortSignal com timeout
 */
export function createTimeoutSignal(category, operation) {
  const timeout = getTimeout(category, operation);
  return AbortSignal.timeout(timeout);
}

/**
 * Helper: Validar se latência está dentro do SLO
 */
export function isWithinSLO(latencyMs, percentile = 95) {
  const target = percentile === 99
    ? SLO_CONFIG.sli.latencyP99.target
    : SLO_CONFIG.sli.latencyP95.target;

  return latencyMs <= target;
}

/**
 * Export default
 */
export default SLO_CONFIG;
