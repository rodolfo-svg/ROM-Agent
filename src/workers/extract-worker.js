/**
 * Extract Worker - Worker Thread Isolado para Extração de PDFs
 *
 * Este worker roda em uma thread isolada para evitar que PDFs corrompidos
 * ou processos pesados crashem o servidor principal.
 *
 * Recursos:
 * - Isolamento total de memória
 * - Comunicação via message passing
 * - Métricas de tempo e memória
 * - Logs detalhados
 * - Tratamento robusto de erros
 *
 * @version 1.0.0
 * @author ROM Agent
 */

import { parentPort, workerData, threadId } from 'worker_threads';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

// Importar extratores (estes podem crashar, mas não afetarão o processo principal)
let pdfParse;
let mammoth;

/**
 * Métricas do worker
 */
const metrics = {
  startTime: Date.now(),
  processedFiles: 0,
  failedFiles: 0,
  totalProcessingTime: 0,
  peakMemory: 0,
  errors: []
};

/**
 * Logger interno do worker
 */
const workerLogger = {
  info: (message, data = {}) => {
    sendToParent('log', { level: 'info', message, data, threadId, timestamp: new Date().toISOString() });
  },
  warn: (message, data = {}) => {
    sendToParent('log', { level: 'warn', message, data, threadId, timestamp: new Date().toISOString() });
  },
  error: (message, data = {}) => {
    sendToParent('log', { level: 'error', message, data, threadId, timestamp: new Date().toISOString() });
  },
  debug: (message, data = {}) => {
    if (workerData?.debug) {
      sendToParent('log', { level: 'debug', message, data, threadId, timestamp: new Date().toISOString() });
    }
  }
};

/**
 * Enviar mensagem para o processo pai
 */
function sendToParent(type, payload) {
  if (parentPort) {
    parentPort.postMessage({ type, payload, threadId });
  }
}

/**
 * Coletar métricas de memória
 */
function collectMemoryMetrics() {
  const memUsage = process.memoryUsage();
  const currentHeap = memUsage.heapUsed;

  if (currentHeap > metrics.peakMemory) {
    metrics.peakMemory = currentHeap;
  }

  return {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
    external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
    rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100
  };
}

/**
 * Carregar dependências dinamicamente (lazy loading)
 */
async function loadDependencies() {
  if (!pdfParse) {
    try {
      const pdfParseModule = await import('pdf-parse');
      pdfParse = pdfParseModule.default;
      workerLogger.debug('pdf-parse carregado com sucesso');
    } catch (error) {
      workerLogger.warn('pdf-parse não disponível', { error: error.message });
    }
  }

  if (!mammoth) {
    try {
      const mammothModule = await import('mammoth');
      mammoth = mammothModule.default;
      workerLogger.debug('mammoth carregado com sucesso');
    } catch (error) {
      workerLogger.warn('mammoth não disponível', { error: error.message });
    }
  }
}

/**
 * Extrair texto de PDF
 * Esta é a operação mais propensa a crashes com PDFs corrompidos
 */
async function extractPDF(filePath, options = {}) {
  const startTime = performance.now();
  const result = {
    success: false,
    text: '',
    pages: 0,
    info: null,
    metadata: {},
    processingTime: 0,
    memoryUsage: null,
    warnings: [],
    errors: []
  };

  try {
    workerLogger.info('Iniciando extração de PDF', { filePath });

    // Verificar se arquivo existe
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    // Verificar tamanho do arquivo
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / 1024 / 1024;

    if (fileSizeMB > (options.maxFileSizeMB || 100)) {
      throw new Error(`Arquivo muito grande: ${fileSizeMB.toFixed(2)}MB (máximo: ${options.maxFileSizeMB || 100}MB)`);
    }

    result.metadata.fileSize = stats.size;
    result.metadata.fileSizeMB = fileSizeMB;

    // Ler o buffer do arquivo
    const dataBuffer = await fs.readFile(filePath);

    // Verificar se é realmente um PDF (magic bytes)
    const pdfMagicBytes = dataBuffer.slice(0, 4).toString();
    if (!pdfMagicBytes.startsWith('%PDF')) {
      throw new Error('Arquivo não é um PDF válido (magic bytes incorretos)');
    }

    // Carregar pdf-parse se não carregado
    await loadDependencies();

    if (!pdfParse) {
      throw new Error('Biblioteca pdf-parse não disponível');
    }

    // Configurações de extração
    const parseOptions = {
      max: options.maxPages || 0, // 0 = todas as páginas
      version: 'v2.0.550'
    };

    // Timeout interno para operação de parsing
    // ✅ AUMENTADO: 5 minutos para PDFs grandes (100MB+ ou 1000+ páginas)
    const parseTimeout = options.parseTimeout || 300000; // 300s (5 minutos) - aumentado de 60s

    const parsePromise = pdfParse(dataBuffer, parseOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout de parsing: ${parseTimeout}ms`)), parseTimeout);
    });

    const data = await Promise.race([parsePromise, timeoutPromise]);

    result.text = data.text || '';
    result.pages = data.numpages || 0;
    result.info = data.info || null;
    result.success = true;

    // Avisos sobre texto vazio ou pequeno
    if (!result.text || result.text.trim().length === 0) {
      result.warnings.push('PDF não contém texto selecionável (pode precisar de OCR)');
    } else if (result.text.trim().length < 100) {
      result.warnings.push('PDF contém pouco texto (pode ser escaneado)');
    }

    workerLogger.info('PDF extraído com sucesso', {
      pages: result.pages,
      textLength: result.text.length,
      warnings: result.warnings
    });

  } catch (error) {
    result.success = false;
    result.errors.push({
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    metrics.failedFiles++;
    metrics.errors.push({ file: filePath, error: error.message, timestamp: new Date().toISOString() });

    workerLogger.error('Erro ao extrair PDF', {
      filePath,
      error: error.message,
      stack: error.stack
    });
  }

  result.processingTime = Math.round(performance.now() - startTime);
  result.memoryUsage = collectMemoryMetrics();

  metrics.processedFiles++;
  metrics.totalProcessingTime += result.processingTime;

  return result;
}

/**
 * Extrair texto de DOCX
 */
async function extractDOCX(filePath, options = {}) {
  const startTime = performance.now();
  const result = {
    success: false,
    text: '',
    html: '',
    messages: [],
    processingTime: 0,
    memoryUsage: null,
    warnings: [],
    errors: []
  };

  try {
    workerLogger.info('Iniciando extração de DOCX', { filePath });

    // Verificar se arquivo existe
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    await loadDependencies();

    if (!mammoth) {
      throw new Error('Biblioteca mammoth não disponível');
    }

    const buffer = await fs.readFile(filePath);

    // Extrair texto
    const textResult = await mammoth.extractRawText({ buffer });
    result.text = textResult.value || '';
    result.messages = textResult.messages || [];

    // Extrair HTML (opcional)
    if (options.includeHtml) {
      const htmlResult = await mammoth.convertToHtml({ buffer });
      result.html = htmlResult.value || '';
    }

    result.success = true;

    workerLogger.info('DOCX extraído com sucesso', {
      textLength: result.text.length,
      messagesCount: result.messages.length
    });

  } catch (error) {
    result.success = false;
    result.errors.push({
      message: error.message,
      stack: error.stack
    });

    metrics.failedFiles++;
    metrics.errors.push({ file: filePath, error: error.message, timestamp: new Date().toISOString() });

    workerLogger.error('Erro ao extrair DOCX', {
      filePath,
      error: error.message
    });
  }

  result.processingTime = Math.round(performance.now() - startTime);
  result.memoryUsage = collectMemoryMetrics();

  metrics.processedFiles++;
  metrics.totalProcessingTime += result.processingTime;

  return result;
}

/**
 * Extrair texto de arquivo de texto puro
 */
async function extractText(filePath, options = {}) {
  const startTime = performance.now();
  const result = {
    success: false,
    text: '',
    lines: 0,
    words: 0,
    processingTime: 0,
    memoryUsage: null,
    warnings: [],
    errors: []
  };

  try {
    workerLogger.info('Iniciando extração de texto', { filePath });

    const encoding = options.encoding || 'utf-8';
    const content = await fs.readFile(filePath, encoding);

    result.text = content;
    result.lines = content.split('\n').length;
    result.words = content.split(/\s+/).filter(w => w.length > 0).length;
    result.success = true;

    workerLogger.info('Texto extraído com sucesso', {
      lines: result.lines,
      words: result.words
    });

  } catch (error) {
    result.success = false;
    result.errors.push({
      message: error.message,
      stack: error.stack
    });

    metrics.failedFiles++;

    workerLogger.error('Erro ao extrair texto', {
      filePath,
      error: error.message
    });
  }

  result.processingTime = Math.round(performance.now() - startTime);
  result.memoryUsage = collectMemoryMetrics();

  metrics.processedFiles++;
  metrics.totalProcessingTime += result.processingTime;

  return result;
}

/**
 * Processar múltiplos arquivos em batch
 */
async function processBatch(files, options = {}) {
  const results = [];

  for (const file of files) {
    const fileExt = path.extname(file).toLowerCase();
    let result;

    switch (fileExt) {
      case '.pdf':
        result = await extractPDF(file, options);
        break;
      case '.docx':
      case '.doc':
        result = await extractDOCX(file, options);
        break;
      case '.txt':
      case '.md':
      case '.json':
        result = await extractText(file, options);
        break;
      default:
        result = {
          success: false,
          errors: [{ message: `Tipo de arquivo não suportado: ${fileExt}` }]
        };
    }

    results.push({ file, ...result });
  }

  return results;
}

/**
 * Handler de mensagens do processo pai
 */
function setupMessageHandler() {
  if (!parentPort) {
    console.error('Este arquivo deve ser executado como Worker Thread');
    process.exit(1);
  }

  parentPort.on('message', async (message) => {
    const { id, action, payload } = message;

    workerLogger.debug('Mensagem recebida', { id, action });

    try {
      let result;

      switch (action) {
        case 'extractPDF':
          result = await extractPDF(payload.filePath, payload.options);
          break;

        case 'extractDOCX':
          result = await extractDOCX(payload.filePath, payload.options);
          break;

        case 'extractText':
          result = await extractText(payload.filePath, payload.options);
          break;

        case 'processBatch':
          result = await processBatch(payload.files, payload.options);
          break;

        case 'getMetrics':
          result = {
            ...metrics,
            uptime: Date.now() - metrics.startTime,
            currentMemory: collectMemoryMetrics(),
            threadId
          };
          break;

        case 'healthCheck':
          result = {
            status: 'healthy',
            threadId,
            uptime: Date.now() - metrics.startTime,
            memory: collectMemoryMetrics(),
            processedFiles: metrics.processedFiles,
            failedFiles: metrics.failedFiles
          };
          break;

        case 'shutdown':
          workerLogger.info('Recebido comando de shutdown');
          sendToParent('response', { id, success: true, data: { message: 'Shutting down' } });
          process.exit(0);
          break;

        default:
          throw new Error(`Ação desconhecida: ${action}`);
      }

      sendToParent('response', { id, success: true, data: result });

    } catch (error) {
      workerLogger.error('Erro ao processar mensagem', {
        action,
        error: error.message,
        stack: error.stack
      });

      sendToParent('response', {
        id,
        success: false,
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code
        }
      });
    }
  });

  // Handler de erros não capturados
  process.on('uncaughtException', (error) => {
    workerLogger.error('Uncaught Exception no Worker', {
      error: error.message,
      stack: error.stack
    });

    sendToParent('error', {
      type: 'uncaughtException',
      message: error.message,
      stack: error.stack
    });

    // Dar tempo para a mensagem ser enviada antes de sair
    setTimeout(() => process.exit(1), 100);
  });

  process.on('unhandledRejection', (reason, promise) => {
    workerLogger.error('Unhandled Rejection no Worker', {
      reason: reason?.message || String(reason),
      stack: reason?.stack
    });

    sendToParent('error', {
      type: 'unhandledRejection',
      message: reason?.message || String(reason),
      stack: reason?.stack
    });
  });
}

/**
 * Inicialização do Worker
 */
async function initialize() {
  workerLogger.info('Worker Thread inicializado', {
    threadId,
    nodeVersion: process.version,
    workerData
  });

  // Pré-carregar dependências
  await loadDependencies();

  // Configurar handler de mensagens
  setupMessageHandler();

  // Enviar sinal de ready
  sendToParent('ready', {
    threadId,
    timestamp: new Date().toISOString(),
    capabilities: {
      pdf: !!pdfParse,
      docx: !!mammoth
    }
  });
}

// Iniciar worker
initialize().catch((error) => {
  console.error('Erro ao inicializar Worker:', error);
  process.exit(1);
});
