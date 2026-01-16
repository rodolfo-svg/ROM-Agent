/**
 * Extract Worker Wrapper - Interface de Alto Nível para Extração Isolada
 *
 * Wrapper simplificado para uso em server-enhanced.js que abstrai
 * a complexidade do Worker Pool e fornece uma API simples e robusta.
 *
 * Recursos:
 * - API simples e intuitiva
 * - Fallback para extração síncrona se workers falharem
 * - Métricas e logs integrados
 * - Cache de resultados (opcional)
 * - Validação de entrada
 *
 * @version 1.0.0
 * @author ROM Agent
 */

import { getWorkerPool, shutdownWorkerPool } from './worker-pool.js';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';

/**
 * Configuração padrão do wrapper
 */
const DEFAULT_CONFIG = {
  // Usar workers isolados
  useWorkers: true,

  // Timeout padrão para extração (ms)
  extractionTimeout: 120000, // 2 minutos

  // Número máximo de retries
  maxRetries: 3,

  // Tamanho máximo de arquivo (MB)
  maxFileSizeMB: 100,

  // Usar fallback síncrono se workers falharem
  useFallback: true,

  // Logar operações
  enableLogging: true,

  // Coletar métricas
  enableMetrics: true,

  // Pool config
  poolConfig: {
    poolSize: 4,
    taskTimeout: 120000,
    maxRetries: 3,
    debug: false
  }
};

/**
 * Erros customizados
 */
class ExtractionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Wrapper para extração isolada
 */
class ExtractWorkerWrapper extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pool = null;
    this.isInitialized = false;

    // Métricas
    this.metrics = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      fallbackUsed: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      errors: []
    };

    // Cache simples (opcional)
    this.cache = new Map();
    this.cacheMaxSize = 100;
    this.cacheTTL = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Inicializar wrapper e pool de workers
   */
  async initialize() {
    if (this.isInitialized) {
      return this;
    }

    this.log('info', 'Inicializando ExtractWorkerWrapper');

    try {
      if (this.config.useWorkers) {
        this.pool = await getWorkerPool(this.config.poolConfig);

        // Configurar listeners do pool
        this.pool.on('log', (logData) => {
          this.emit('poolLog', logData);
        });

        this.pool.on('workerError', (errorData) => {
          this.log('warn', 'Erro no worker do pool', errorData);
          this.emit('workerError', errorData);
        });

        this.pool.on('workerExit', (exitData) => {
          this.log('warn', 'Worker encerrado', exitData);
          this.emit('workerExit', exitData);
        });

        this.pool.on('healthCheck', (results) => {
          this.emit('healthCheck', results);
        });
      }

      this.isInitialized = true;
      this.log('info', 'ExtractWorkerWrapper inicializado com sucesso');

      return this;

    } catch (error) {
      this.log('error', 'Erro ao inicializar wrapper', { error: error.message });

      if (this.config.useFallback) {
        this.log('warn', 'Workers indisponíveis, usando fallback síncrono');
        this.config.useWorkers = false;
        this.isInitialized = true;
        return this;
      }

      throw error;
    }
  }

  /**
   * Validar arquivo antes da extração
   */
  async validateFile(filePath) {
    // Verificar se arquivo existe
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new ExtractionError(
        `Arquivo não encontrado: ${filePath}`,
        'FILE_NOT_FOUND',
        { filePath }
      );
    }

    // Verificar tamanho
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / 1024 / 1024;

    if (fileSizeMB > this.config.maxFileSizeMB) {
      throw new ExtractionError(
        `Arquivo muito grande: ${fileSizeMB.toFixed(2)}MB (máximo: ${this.config.maxFileSizeMB}MB)`,
        'FILE_TOO_LARGE',
        { filePath, size: stats.size, sizeMB: fileSizeMB, maxMB: this.config.maxFileSizeMB }
      );
    }

    // Determinar tipo de arquivo
    const ext = path.extname(filePath).toLowerCase();
    const supportedTypes = ['.pdf', '.docx', '.doc', '.txt', '.md', '.json'];

    if (!supportedTypes.includes(ext)) {
      throw new ExtractionError(
        `Tipo de arquivo não suportado: ${ext}`,
        'UNSUPPORTED_TYPE',
        { filePath, extension: ext, supported: supportedTypes }
      );
    }

    return {
      valid: true,
      extension: ext,
      size: stats.size,
      sizeMB: fileSizeMB
    };
  }

  /**
   * Extrair conteúdo de arquivo (método principal)
   */
  async extract(filePath, options = {}) {
    const startTime = performance.now();

    if (!this.isInitialized) {
      await this.initialize();
    }

    this.metrics.totalExtractions++;

    try {
      // Validar arquivo
      const validation = await this.validateFile(filePath);
      this.log('info', 'Arquivo validado', { filePath, ...validation });

      // Verificar cache
      const cacheKey = `${filePath}:${JSON.stringify(options)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.log('debug', 'Resultado obtido do cache', { filePath });
        return { ...cached, fromCache: true };
      }

      let result;

      // Usar workers ou fallback
      if (this.config.useWorkers && this.pool) {
        result = await this.extractWithWorkers(filePath, validation.extension, options);
      } else {
        result = await this.extractWithFallback(filePath, validation.extension, options);
        this.metrics.fallbackUsed++;
      }

      // Calcular tempo de processamento
      const processingTime = performance.now() - startTime;
      result.processingTime = Math.round(processingTime);

      // Atualizar métricas
      this.metrics.successfulExtractions++;
      this.metrics.totalProcessingTime += processingTime;
      this.metrics.averageProcessingTime =
        this.metrics.totalProcessingTime / this.metrics.successfulExtractions;

      // Adicionar ao cache
      this.addToCache(cacheKey, result);

      this.log('info', 'Extração concluída com sucesso', {
        filePath,
        textLength: result.text?.length || 0,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      const processingTime = performance.now() - startTime;

      this.metrics.failedExtractions++;
      this.metrics.errors.push({
        file: filePath,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      });

      // Manter apenas últimos 100 erros
      if (this.metrics.errors.length > 100) {
        this.metrics.errors.shift();
      }

      this.log('error', 'Erro na extração', {
        filePath,
        error: error.message,
        code: error.code,
        processingTime: Math.round(processingTime)
      });

      throw error;
    }
  }

  /**
   * Extrair usando Worker Pool
   */
  async extractWithWorkers(filePath, extension, options) {
    const extractionOptions = {
      timeout: options.timeout || this.config.extractionTimeout,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      ...options
    };

    try {
      switch (extension) {
        case '.pdf':
          return await this.pool.extractPDF(filePath, extractionOptions);

        case '.docx':
        case '.doc':
          return await this.pool.extractDOCX(filePath, extractionOptions);

        case '.txt':
        case '.md':
        case '.json':
          return await this.pool.extractText(filePath, extractionOptions);

        default:
          throw new ExtractionError(
            `Tipo de arquivo não suportado: ${extension}`,
            'UNSUPPORTED_TYPE'
          );
      }

    } catch (error) {
      // Se workers falharem e fallback estiver habilitado
      if (this.config.useFallback) {
        this.log('warn', 'Workers falharam, usando fallback', {
          filePath,
          error: error.message
        });
        this.metrics.fallbackUsed++;
        return this.extractWithFallback(filePath, extension, options);
      }

      throw error;
    }
  }

  /**
   * Extração síncrona (fallback)
   */
  async extractWithFallback(filePath, extension, options) {
    this.log('debug', 'Usando extração síncrona (fallback)', { filePath });

    const result = {
      success: false,
      text: '',
      pages: 0,
      warnings: ['Extração realizada em modo fallback (síncrono)'],
      errors: [],
      usedFallback: true
    };

    try {
      switch (extension) {
        case '.pdf':
          result.text = await this.extractPDFSync(filePath, options);
          break;

        case '.docx':
        case '.doc':
          result.text = await this.extractDOCXSync(filePath, options);
          break;

        case '.txt':
        case '.md':
        case '.json':
          result.text = await fs.readFile(filePath, 'utf-8');
          break;

        default:
          throw new ExtractionError(
            `Tipo de arquivo não suportado: ${extension}`,
            'UNSUPPORTED_TYPE'
          );
      }

      result.success = true;

    } catch (error) {
      result.errors.push({
        message: error.message,
        stack: error.stack
      });
      throw error;
    }

    return result;
  }

  /**
   * Extração síncrona de PDF
   */
  async extractPDFSync(filePath, options) {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer, { max: options.maxPages || 0 });
      return data.text || '';
    } catch (error) {
      throw new ExtractionError(
        `Erro ao extrair PDF: ${error.message}`,
        'PDF_EXTRACTION_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * Extração síncrona de DOCX
   */
  async extractDOCXSync(filePath, options) {
    try {
      const mammoth = (await import('mammoth')).default;
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (error) {
      throw new ExtractionError(
        `Erro ao extrair DOCX: ${error.message}`,
        'DOCX_EXTRACTION_ERROR',
        { originalError: error.message }
      );
    }
  }

  /**
   * Extrair múltiplos arquivos
   */
  async extractBatch(files, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const results = [];
    const concurrency = options.concurrency || 4;

    // Processar em batches paralelos
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(file => this.extract(file, options))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        results.push({
          file: batch[j],
          success: result.status === 'fulfilled',
          result: result.status === 'fulfilled' ? result.value : null,
          error: result.status === 'rejected' ? result.reason?.message : null
        });
      }
    }

    return {
      total: files.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Gerenciamento de cache
   */
  addToCache(key, value) {
    if (this.cache.size >= this.cacheMaxSize) {
      // Remover entrada mais antiga
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Verificar TTL
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  clearCache() {
    this.cache.clear();
    this.log('info', 'Cache limpo');
  }

  /**
   * Health check do wrapper
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      initialized: this.isInitialized,
      useWorkers: this.config.useWorkers,
      pool: null,
      metrics: this.getMetrics(),
      cache: {
        size: this.cache.size,
        maxSize: this.cacheMaxSize
      }
    };

    if (this.pool) {
      try {
        const poolMetrics = this.pool.getMetrics();
        health.pool = {
          activeWorkers: poolMetrics.pool.activeWorkers,
          availableWorkers: poolMetrics.pool.availableWorkers,
          queueSize: poolMetrics.pool.queueSize,
          completedTasks: poolMetrics.pool.completedTasks
        };
      } catch (error) {
        health.status = 'degraded';
        health.pool = { error: error.message };
      }
    }

    return health;
  }

  /**
   * Obter métricas
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalExtractions > 0
        ? (this.metrics.successfulExtractions / this.metrics.totalExtractions * 100).toFixed(2) + '%'
        : '0%',
      averageProcessingTimeMs: Math.round(this.metrics.averageProcessingTime),
      recentErrors: this.metrics.errors.slice(-10)
    };
  }

  /**
   * Logging interno
   */
  log(level, message, data = {}) {
    if (!this.config.enableLogging) return;

    const logEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      component: 'ExtractWorkerWrapper'
    };

    this.emit('log', logEntry);

    // Console logging (pode ser substituído por logger externo)
    const logMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[logMethod](`[ExtractWorkerWrapper ${level.toUpperCase()}] ${message}`, data);
  }

  /**
   * Shutdown gracioso
   */
  async shutdown() {
    this.log('info', 'Encerrando ExtractWorkerWrapper');

    if (this.pool) {
      await shutdownWorkerPool();
      this.pool = null;
    }

    this.clearCache();
    this.isInitialized = false;

    this.log('info', 'ExtractWorkerWrapper encerrado');
  }
}

/**
 * Instância singleton para uso global
 */
let wrapperInstance = null;

/**
 * Obter instância do wrapper (singleton)
 */
export async function getExtractWrapper(config = {}) {
  if (!wrapperInstance) {
    wrapperInstance = new ExtractWorkerWrapper(config);
    await wrapperInstance.initialize();
  }
  return wrapperInstance;
}

/**
 * Função de conveniência para extração rápida
 */
export async function extractFile(filePath, options = {}) {
  const wrapper = await getExtractWrapper(options.wrapperConfig);
  return wrapper.extract(filePath, options);
}

/**
 * Função de conveniência para extração em batch
 */
export async function extractFiles(files, options = {}) {
  const wrapper = await getExtractWrapper(options.wrapperConfig);
  return wrapper.extractBatch(files, options);
}

/**
 * Encerrar wrapper singleton
 */
export async function shutdownExtractWrapper() {
  if (wrapperInstance) {
    await wrapperInstance.shutdown();
    wrapperInstance = null;
  }
}

export { ExtractWorkerWrapper, ExtractionError };
export default ExtractWorkerWrapper;
