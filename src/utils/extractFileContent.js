/**
 * ============================================================================
 * ROM Agent - FUNCAO DEFINITIVA DE EXTRACAO DE CONTEUDO DE ARQUIVOS
 * ============================================================================
 *
 * Servico production-ready para extracao de conteudo de multiplos formatos:
 * - PDF (texto direto + OCR fallback)
 * - DOCX (Microsoft Word)
 * - TXT (texto puro)
 * - ODT (OpenDocument Text)
 * - RTF (Rich Text Format)
 * - HTML (paginas web)
 *
 * Funcionalidades:
 * - Worker threads para isolamento (nao crashar servidor)
 * - Timeout configuravel
 * - Limite dinamico baseado em contexto disponivel
 * - Logs detalhados com progress callback
 * - Graceful degradation
 * - Extracao assincrona com progresso
 *
 * @version 2.0.0
 * @author ROM Legal AI
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// CONFIGURACOES
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuracoes padrao de extracao
 */
const DEFAULT_CONFIG = {
  // Timeout padrao: 5 minutos
  timeoutMs: 5 * 60 * 1000,

  // Limites de tokens por modelo (importado de context-manager.js)
  modelLimits: {
    'anthropic.claude-sonnet-4-5-20250929-v1:0': 200000,
    'anthropic.claude-opus-4-5-20251101-v1:0': 200000,
    'amazon.nova-pro-v1:0': 300000,
    'default': 200000
  },

  // Fator de conversao: ~3.5 caracteres por token
  charsPerToken: 3.5,

  // Reservar 30% para resposta do modelo
  contextReserveRatio: 0.7,

  // Tamanho maximo de arquivo em bytes (100MB)
  maxFileSizeBytes: 100 * 1024 * 1024,

  // Formatos suportados
  supportedFormats: ['.pdf', '.docx', '.txt', '.odt', '.rtf', '.html', '.htm'],

  // OCR: confianca minima aceitavel
  ocrMinConfidence: 60,

  // Numero de workers para OCR paralelo
  ocrWorkerCount: 4
};

/**
 * Niveis de log
 */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// ============================================================================
// LOGGER INTERNO
// ============================================================================

class ExtractionLogger {
  constructor(options = {}) {
    this.level = options.logLevel ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '[ExtractFileContent]';
    this.onLog = options.onLog ?? null;
  }

  _log(level, levelName, message, data = null) {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: levelName,
      message,
      data
    };

    // Console output
    const colors = {
      DEBUG: '\x1b[90m',
      INFO: '\x1b[36m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m'
    };
    const reset = '\x1b[0m';
    console.log(`${colors[levelName]}${this.prefix} [${timestamp}] [${levelName}] ${message}${reset}`);
    if (data) {
      console.log(`${colors[levelName]}  Data: ${JSON.stringify(data, null, 2)}${reset}`);
    }

    // Callback para progress tracking
    if (this.onLog) {
      this.onLog(logEntry);
    }
  }

  debug(message, data) { this._log(LogLevel.DEBUG, 'DEBUG', message, data); }
  info(message, data) { this._log(LogLevel.INFO, 'INFO', message, data); }
  warn(message, data) { this._log(LogLevel.WARN, 'WARN', message, data); }
  error(message, data) { this._log(LogLevel.ERROR, 'ERROR', message, data); }
}

// ============================================================================
// CALCULO DINAMICO DE LIMITE
// ============================================================================

/**
 * Calcula o limite dinamico de caracteres baseado no contexto disponivel
 *
 * @param {Object} options - Opcoes de calculo
 * @param {string} options.model - ID do modelo sendo usado
 * @param {number} options.currentContextTokens - Tokens ja usados no contexto
 * @param {number} options.reserveForResponse - Tokens a reservar para resposta
 * @param {number} options.documentsCount - Numero de documentos a processar
 * @returns {Object} Limites calculados
 */
export function calculateDynamicLimit(options = {}) {
  const {
    model = 'default',
    currentContextTokens = 0,
    reserveForResponse = 60000,
    documentsCount = 1
  } = options;

  // Obter limite do modelo
  const modelLimit = DEFAULT_CONFIG.modelLimits[model] || DEFAULT_CONFIG.modelLimits.default;

  // Calcular tokens disponiveis
  const availableTokens = Math.floor(
    (modelLimit * DEFAULT_CONFIG.contextReserveRatio) - currentContextTokens - reserveForResponse
  );

  // Dividir entre documentos
  const tokensPerDocument = Math.floor(availableTokens / documentsCount);

  // Converter para caracteres
  const charsPerDocument = Math.floor(tokensPerDocument * DEFAULT_CONFIG.charsPerToken);

  return {
    modelLimit,
    availableTokens: Math.max(0, availableTokens),
    tokensPerDocument: Math.max(0, tokensPerDocument),
    charsPerDocument: Math.max(0, charsPerDocument),
    model,
    documentsCount,
    calculation: {
      modelLimit,
      contextReserveRatio: DEFAULT_CONFIG.contextReserveRatio,
      currentContextTokens,
      reserveForResponse,
      formula: `(${modelLimit} * ${DEFAULT_CONFIG.contextReserveRatio}) - ${currentContextTokens} - ${reserveForResponse} = ${availableTokens}`
    }
  };
}

// ============================================================================
// EXTRACTORS INDIVIDUAIS
// ============================================================================

/**
 * Extrai texto de arquivo PDF
 */
async function extractFromPDF(filePath, options = {}) {
  const { maxChars, logger } = options;

  try {
    // Importar pdf-parse dinamicamente
    const pdfParse = (await import('pdf-parse')).default;
    const dataBuffer = await fs.readFile(filePath);

    logger?.debug('Iniciando extracao de PDF', { filePath, size: dataBuffer.length });

    const data = await pdfParse(dataBuffer);
    let text = data.text || '';

    // Verificar se precisa de OCR (texto muito curto)
    const needsOCR = !text || text.trim().length < 100;

    if (needsOCR) {
      logger?.info('PDF sem texto selecionavel, tentando OCR...');

      try {
        // Tentar usar TesseractOCRService
        const { getTesseractOCRService } = await import('../services/tesseract-ocr-service.js');
        const ocrService = getTesseractOCRService();
        await ocrService.initialize({ verbose: false });

        // Criar pasta temporaria para OCR
        const tempFolder = path.join('/tmp', `ocr-${Date.now()}`);
        await fs.mkdir(tempFolder, { recursive: true });

        const ocrResult = await ocrService.performOCROnPDF(filePath, tempFolder, {
          maxPages: 50,
          confidenceThreshold: DEFAULT_CONFIG.ocrMinConfidence,
          saveIndividualPages: false
        });

        if (ocrResult.success && ocrResult.fullText) {
          text = ocrResult.fullText;
          logger?.info('OCR concluido com sucesso', {
            pages: ocrResult.processedPages,
            confidence: ocrResult.averageConfidence
          });
        }

        // Limpar pasta temporaria
        await fs.rm(tempFolder, { recursive: true, force: true }).catch(() => {});

      } catch (ocrError) {
        logger?.warn('OCR nao disponivel ou falhou', { error: ocrError.message });
      }
    }

    // Truncar se necessario
    if (maxChars && text.length > maxChars) {
      text = text.substring(0, maxChars) + '\n\n[... CONTEUDO TRUNCADO ...]';
    }

    return {
      success: true,
      text,
      metadata: {
        pages: data.numpages,
        info: data.info || {},
        originalLength: (data.text || '').length,
        truncated: maxChars && (data.text || '').length > maxChars,
        ocrApplied: needsOCR
      }
    };

  } catch (error) {
    logger?.error('Erro ao extrair PDF', { error: error.message });
    return {
      success: false,
      text: '',
      error: error.message,
      metadata: { pages: 0 }
    };
  }
}

/**
 * Extrai texto de arquivo DOCX (Microsoft Word)
 */
async function extractFromDOCX(filePath, options = {}) {
  const { maxChars, logger } = options;

  try {
    // Importar mammoth dinamicamente
    const mammoth = await import('mammoth');
    const dataBuffer = await fs.readFile(filePath);

    logger?.debug('Iniciando extracao de DOCX', { filePath, size: dataBuffer.length });

    const result = await mammoth.extractRawText({ buffer: dataBuffer });
    let text = result.value || '';

    // Truncar se necessario
    if (maxChars && text.length > maxChars) {
      text = text.substring(0, maxChars) + '\n\n[... CONTEUDO TRUNCADO ...]';
    }

    return {
      success: true,
      text,
      metadata: {
        messages: result.messages,
        originalLength: (result.value || '').length,
        truncated: maxChars && (result.value || '').length > maxChars
      }
    };

  } catch (error) {
    logger?.error('Erro ao extrair DOCX', { error: error.message });
    return {
      success: false,
      text: '',
      error: error.message,
      metadata: {}
    };
  }
}

/**
 * Extrai texto de arquivo TXT
 */
async function extractFromTXT(filePath, options = {}) {
  const { maxChars, logger } = options;

  try {
    logger?.debug('Iniciando extracao de TXT', { filePath });

    let text = await fs.readFile(filePath, 'utf-8');

    // Truncar se necessario
    if (maxChars && text.length > maxChars) {
      text = text.substring(0, maxChars) + '\n\n[... CONTEUDO TRUNCADO ...]';
    }

    return {
      success: true,
      text,
      metadata: {
        originalLength: (await fs.stat(filePath)).size,
        truncated: maxChars && (await fs.stat(filePath)).size > maxChars
      }
    };

  } catch (error) {
    logger?.error('Erro ao extrair TXT', { error: error.message });
    return {
      success: false,
      text: '',
      error: error.message,
      metadata: {}
    };
  }
}

/**
 * Extrai texto de arquivo ODT (OpenDocument Text)
 */
async function extractFromODT(filePath, options = {}) {
  const { maxChars, logger } = options;

  try {
    logger?.debug('Iniciando extracao de ODT', { filePath });

    // ODT e um ZIP contendo content.xml
    const { Readable } = await import('stream');
    const { pipeline } = await import('stream/promises');
    const { createReadStream } = await import('fs');
    const { createGunzip } = await import('zlib');

    // Tentar usar archiver/unzipper ou processar manualmente
    // Para simplicidade, usar uma abordagem com spawn para unzip
    const { spawn } = await import('child_process');

    const extractText = () => new Promise((resolve, reject) => {
      const unzip = spawn('unzip', ['-p', filePath, 'content.xml']);
      let content = '';
      let error = '';

      unzip.stdout.on('data', (data) => {
        content += data.toString();
      });

      unzip.stderr.on('data', (data) => {
        error += data.toString();
      });

      unzip.on('close', (code) => {
        if (code !== 0 && !content) {
          reject(new Error(`Falha ao extrair ODT: ${error}`));
        } else {
          resolve(content);
        }
      });

      unzip.on('error', reject);
    });

    const xmlContent = await extractText();

    // Extrair texto do XML removendo tags
    let text = xmlContent
      .replace(/<text:p[^>]*>/gi, '\n')
      .replace(/<text:h[^>]*>/gi, '\n\n')
      .replace(/<text:tab[^>]*\/>/gi, '\t')
      .replace(/<text:s[^>]*\/>/gi, ' ')
      .replace(/<text:line-break[^>]*\/>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Truncar se necessario
    const originalLength = text.length;
    if (maxChars && text.length > maxChars) {
      text = text.substring(0, maxChars) + '\n\n[... CONTEUDO TRUNCADO ...]';
    }

    return {
      success: true,
      text,
      metadata: {
        originalLength,
        truncated: maxChars && originalLength > maxChars
      }
    };

  } catch (error) {
    logger?.error('Erro ao extrair ODT', { error: error.message });
    return {
      success: false,
      text: '',
      error: error.message,
      metadata: {}
    };
  }
}

/**
 * Extrai texto de arquivo RTF (Rich Text Format)
 */
async function extractFromRTF(filePath, options = {}) {
  const { maxChars, logger } = options;

  try {
    logger?.debug('Iniciando extracao de RTF', { filePath });

    const rtfContent = await fs.readFile(filePath, 'utf-8');

    // Parser RTF simplificado
    let text = rtfContent
      // Remover header RTF
      .replace(/^\{\\rtf\d?\\[^\\]*/, '')
      // Remover comandos de formatacao
      .replace(/\\[a-z]+\d*\s?/gi, '')
      // Remover grupos vazios
      .replace(/\{[^{}]*\}/g, '')
      // Remover caracteres de controle
      .replace(/[\{\}\\]/g, '')
      // Converter escapes hexadecimais
      .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      // Limpar espacos
      .replace(/\s+/g, ' ')
      .trim();

    // Truncar se necessario
    const originalLength = text.length;
    if (maxChars && text.length > maxChars) {
      text = text.substring(0, maxChars) + '\n\n[... CONTEUDO TRUNCADO ...]';
    }

    return {
      success: true,
      text,
      metadata: {
        originalLength,
        truncated: maxChars && originalLength > maxChars
      }
    };

  } catch (error) {
    logger?.error('Erro ao extrair RTF', { error: error.message });
    return {
      success: false,
      text: '',
      error: error.message,
      metadata: {}
    };
  }
}

/**
 * Extrai texto de arquivo HTML
 */
async function extractFromHTML(filePath, options = {}) {
  const { maxChars, logger } = options;

  try {
    logger?.debug('Iniciando extracao de HTML', { filePath });

    // Importar html-to-text dinamicamente
    const { htmlToText } = await import('html-to-text');
    const htmlContent = await fs.readFile(filePath, 'utf-8');

    let text = htmlToText(htmlContent, {
      wordwrap: 130,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' },
        { selector: 'nav', format: 'skip' },
        { selector: 'header', format: 'skip' },
        { selector: 'footer', format: 'skip' }
      ]
    });

    // Truncar se necessario
    const originalLength = text.length;
    if (maxChars && text.length > maxChars) {
      text = text.substring(0, maxChars) + '\n\n[... CONTEUDO TRUNCADO ...]';
    }

    return {
      success: true,
      text,
      metadata: {
        originalLength,
        truncated: maxChars && originalLength > maxChars
      }
    };

  } catch (error) {
    logger?.error('Erro ao extrair HTML', { error: error.message });
    return {
      success: false,
      text: '',
      error: error.message,
      metadata: {}
    };
  }
}

// ============================================================================
// WORKER THREAD CODE
// ============================================================================

/**
 * Codigo executado dentro do Worker Thread
 * Isolado do processo principal para evitar crashes
 */
async function workerThreadCode() {
  const { filePath, format, maxChars } = workerData;

  const logger = new ExtractionLogger({ prefix: '[Worker]' });

  try {
    logger.info(`Iniciando extracao no worker`, { filePath, format, maxChars });

    let result;
    const options = { maxChars, logger };

    switch (format) {
      case '.pdf':
        result = await extractFromPDF(filePath, options);
        break;
      case '.docx':
        result = await extractFromDOCX(filePath, options);
        break;
      case '.txt':
        result = await extractFromTXT(filePath, options);
        break;
      case '.odt':
        result = await extractFromODT(filePath, options);
        break;
      case '.rtf':
        result = await extractFromRTF(filePath, options);
        break;
      case '.html':
      case '.htm':
        result = await extractFromHTML(filePath, options);
        break;
      default:
        result = {
          success: false,
          text: '',
          error: `Formato nao suportado: ${format}`,
          metadata: {}
        };
    }

    parentPort.postMessage({ type: 'result', data: result });

  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      data: {
        success: false,
        text: '',
        error: error.message,
        stack: error.stack,
        metadata: {}
      }
    });
  }
}

// Se estiver rodando como Worker, executar codigo do worker
if (!isMainThread) {
  workerThreadCode();
}

// ============================================================================
// FUNCAO PRINCIPAL DE EXTRACAO
// ============================================================================

/**
 * Extrai conteudo de arquivo com isolamento via Worker Thread
 *
 * @param {string} filePath - Caminho absoluto do arquivo
 * @param {Object} options - Opcoes de extracao
 * @param {number} options.timeoutMs - Timeout em milissegundos (default: 5 min)
 * @param {number} options.maxChars - Limite de caracteres (calculado dinamicamente se nao fornecido)
 * @param {string} options.model - ID do modelo para calculo dinamico
 * @param {number} options.currentContextTokens - Tokens ja usados no contexto
 * @param {Function} options.onProgress - Callback de progresso
 * @param {boolean} options.useWorker - Usar worker thread (default: true)
 * @returns {Promise<Object>} Resultado da extracao
 */
export async function extractFileContent(filePath, options = {}) {
  const {
    timeoutMs = DEFAULT_CONFIG.timeoutMs,
    maxChars = null,
    model = 'default',
    currentContextTokens = 0,
    onProgress = null,
    useWorker = true,
    logLevel = LogLevel.INFO
  } = options;

  const startTime = Date.now();
  const logger = new ExtractionLogger({
    logLevel,
    onLog: onProgress ? (entry) => onProgress({ type: 'log', ...entry }) : null
  });

  // Resultado padrao
  const result = {
    success: false,
    filePath,
    fileName: path.basename(filePath),
    format: null,
    text: '',
    metadata: {},
    error: null,
    timing: {
      startTime: new Date().toISOString(),
      endTime: null,
      durationMs: 0
    },
    limits: null
  };

  try {
    // ========================================================================
    // VALIDACOES
    // ========================================================================

    logger.info('Iniciando extracao de arquivo', { filePath });

    // Verificar se arquivo existe
    if (!existsSync(filePath)) {
      throw new Error(`Arquivo nao encontrado: ${filePath}`);
    }

    // Verificar formato
    const ext = path.extname(filePath).toLowerCase();
    if (!DEFAULT_CONFIG.supportedFormats.includes(ext)) {
      throw new Error(`Formato nao suportado: ${ext}. Formatos aceitos: ${DEFAULT_CONFIG.supportedFormats.join(', ')}`);
    }
    result.format = ext;

    // Verificar tamanho
    const stats = await fs.stat(filePath);
    if (stats.size > DEFAULT_CONFIG.maxFileSizeBytes) {
      throw new Error(`Arquivo muito grande: ${(stats.size / 1024 / 1024).toFixed(2)}MB. Maximo: ${DEFAULT_CONFIG.maxFileSizeBytes / 1024 / 1024}MB`);
    }

    logger.info('Arquivo validado', {
      format: ext,
      size: `${(stats.size / 1024).toFixed(2)}KB`
    });

    // ========================================================================
    // CALCULO DINAMICO DE LIMITE
    // ========================================================================

    let effectiveMaxChars = maxChars;

    if (!effectiveMaxChars) {
      const limits = calculateDynamicLimit({
        model,
        currentContextTokens,
        documentsCount: 1
      });
      effectiveMaxChars = limits.charsPerDocument;
      result.limits = limits;

      logger.info('Limite dinamico calculado', {
        maxChars: effectiveMaxChars,
        tokensPerDocument: limits.tokensPerDocument
      });
    }

    // ========================================================================
    // EXTRACAO (COM OU SEM WORKER)
    // ========================================================================

    if (onProgress) {
      onProgress({
        type: 'progress',
        phase: 'extraction',
        message: 'Iniciando extracao...',
        percent: 10
      });
    }

    let extractionResult;

    if (useWorker) {
      // Executar em Worker Thread isolado
      extractionResult = await runInWorker(filePath, ext, effectiveMaxChars, timeoutMs, logger);
    } else {
      // Executar no thread principal (fallback)
      extractionResult = await extractDirectly(filePath, ext, effectiveMaxChars, logger);
    }

    // ========================================================================
    // PROCESSAR RESULTADO
    // ========================================================================

    if (extractionResult.success) {
      result.success = true;
      result.text = extractionResult.text;
      result.metadata = extractionResult.metadata;

      logger.info('Extracao concluida com sucesso', {
        textLength: result.text.length,
        truncated: extractionResult.metadata?.truncated
      });
    } else {
      result.error = extractionResult.error;
      logger.warn('Extracao falhou', { error: extractionResult.error });
    }

    if (onProgress) {
      onProgress({
        type: 'progress',
        phase: 'complete',
        message: result.success ? 'Extracao concluida!' : 'Extracao falhou',
        percent: 100
      });
    }

  } catch (error) {
    result.error = error.message;
    logger.error('Erro na extracao', { error: error.message, stack: error.stack });
  }

  // Finalizar timing
  result.timing.endTime = new Date().toISOString();
  result.timing.durationMs = Date.now() - startTime;

  return result;
}

/**
 * Executa extracao em Worker Thread isolado
 */
async function runInWorker(filePath, format, maxChars, timeoutMs, logger) {
  return new Promise((resolve) => {
    logger.debug('Criando Worker Thread');

    const worker = new Worker(new URL(import.meta.url), {
      workerData: { filePath, format, maxChars }
    });

    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        worker.terminate();
      }
    };

    // Timeout
    const timeout = setTimeout(() => {
      logger.warn('Worker timeout, terminando...');
      cleanup();
      resolve({
        success: false,
        text: '',
        error: `Timeout apos ${timeoutMs}ms`,
        metadata: {}
      });
    }, timeoutMs);

    // Mensagem do worker
    worker.on('message', (message) => {
      clearTimeout(timeout);
      if (message.type === 'result') {
        resolved = true;
        resolve(message.data);
      } else if (message.type === 'error') {
        resolved = true;
        resolve(message.data);
      }
      cleanup();
    });

    // Erro do worker
    worker.on('error', (error) => {
      clearTimeout(timeout);
      logger.error('Erro no worker', { error: error.message });
      cleanup();
      resolve({
        success: false,
        text: '',
        error: `Erro no worker: ${error.message}`,
        metadata: {}
      });
    });

    // Worker finalizado
    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !resolved) {
        resolve({
          success: false,
          text: '',
          error: `Worker finalizado com codigo ${code}`,
          metadata: {}
        });
      }
    });
  });
}

/**
 * Executa extracao diretamente no thread principal (fallback)
 */
async function extractDirectly(filePath, format, maxChars, logger) {
  const options = { maxChars, logger };

  switch (format) {
    case '.pdf':
      return extractFromPDF(filePath, options);
    case '.docx':
      return extractFromDOCX(filePath, options);
    case '.txt':
      return extractFromTXT(filePath, options);
    case '.odt':
      return extractFromODT(filePath, options);
    case '.rtf':
      return extractFromRTF(filePath, options);
    case '.html':
    case '.htm':
      return extractFromHTML(filePath, options);
    default:
      return {
        success: false,
        text: '',
        error: `Formato nao suportado: ${format}`,
        metadata: {}
      };
  }
}

// ============================================================================
// EXTRACAO EM LOTE
// ============================================================================

/**
 * Extrai conteudo de multiplos arquivos com progress tracking
 *
 * @param {Array<string>} filePaths - Array de caminhos de arquivos
 * @param {Object} options - Opcoes de extracao
 * @returns {Promise<Object>} Resultados consolidados
 */
export async function extractMultipleFiles(filePaths, options = {}) {
  const {
    model = 'default',
    currentContextTokens = 0,
    onProgress = null,
    ...extractOptions
  } = options;

  const startTime = Date.now();
  const logger = new ExtractionLogger({ logLevel: options.logLevel ?? LogLevel.INFO });

  // Calcular limite para cada documento
  const limits = calculateDynamicLimit({
    model,
    currentContextTokens,
    documentsCount: filePaths.length
  });

  logger.info('Iniciando extracao em lote', {
    files: filePaths.length,
    charsPerDocument: limits.charsPerDocument
  });

  const results = [];
  const allText = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];

    if (onProgress) {
      onProgress({
        type: 'batch_progress',
        current: i + 1,
        total: filePaths.length,
        percent: Math.round(((i + 1) / filePaths.length) * 100),
        file: path.basename(filePath)
      });
    }

    const result = await extractFileContent(filePath, {
      ...extractOptions,
      maxChars: limits.charsPerDocument,
      onProgress: null // Evitar callbacks aninhados
    });

    results.push(result);

    if (result.success) {
      successCount++;
      allText.push(`=== ${result.fileName} ===\n\n${result.text}`);
    } else {
      failCount++;
    }
  }

  const totalTime = Date.now() - startTime;

  return {
    success: successCount > 0,
    totalFiles: filePaths.length,
    successCount,
    failCount,
    results,
    combinedText: allText.join('\n\n---\n\n'),
    limits,
    timing: {
      totalMs: totalTime,
      averagePerFileMs: Math.round(totalTime / filePaths.length)
    }
  };
}

// ============================================================================
// GRACEFUL DEGRADATION
// ============================================================================

/**
 * Extrai conteudo com graceful degradation
 * Tenta multiplas estrategias ate obter resultado
 *
 * @param {string} filePath - Caminho do arquivo
 * @param {Object} options - Opcoes
 * @returns {Promise<Object>} Resultado
 */
export async function extractWithDegradation(filePath, options = {}) {
  const logger = new ExtractionLogger({ logLevel: options.logLevel ?? LogLevel.INFO });

  const strategies = [
    { name: 'worker_full', useWorker: true, maxChars: null },
    { name: 'worker_limited', useWorker: true, maxChars: 100000 },
    { name: 'direct_full', useWorker: false, maxChars: null },
    { name: 'direct_limited', useWorker: false, maxChars: 50000 }
  ];

  for (const strategy of strategies) {
    logger.info(`Tentando estrategia: ${strategy.name}`);

    try {
      const result = await extractFileContent(filePath, {
        ...options,
        useWorker: strategy.useWorker,
        maxChars: strategy.maxChars ?? options.maxChars,
        timeoutMs: strategy.name.includes('limited') ? 60000 : options.timeoutMs
      });

      if (result.success) {
        logger.info(`Estrategia ${strategy.name} teve sucesso`);
        result.metadata.strategyUsed = strategy.name;
        return result;
      }
    } catch (error) {
      logger.warn(`Estrategia ${strategy.name} falhou: ${error.message}`);
    }
  }

  // Todas estrategias falharam
  logger.error('Todas estrategias de extracao falharam');
  return {
    success: false,
    filePath,
    fileName: path.basename(filePath),
    text: '',
    error: 'Todas estrategias de extracao falharam',
    metadata: { strategiesAttempted: strategies.map(s => s.name) }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEFAULT_CONFIG,
  LogLevel,
  ExtractionLogger,
  extractFromPDF,
  extractFromDOCX,
  extractFromTXT,
  extractFromODT,
  extractFromRTF,
  extractFromHTML
};

export default {
  extractFileContent,
  extractMultipleFiles,
  extractWithDegradation,
  calculateDynamicLimit,
  DEFAULT_CONFIG,
  LogLevel
};

// ============================================================================
// TESTES UNITARIOS INLINE
// ============================================================================

/**
 * Executar testes unitarios inline
 * Execute com: node --test src/utils/extractFileContent.js
 */
export async function runInlineTests() {
  const { test, describe, it, before, after } = await import('node:test');
  const assert = await import('node:assert');

  describe('extractFileContent', () => {

    describe('calculateDynamicLimit', () => {
      it('deve calcular limite correto para modelo padrao', () => {
        const result = calculateDynamicLimit({});
        assert.ok(result.modelLimit > 0);
        assert.ok(result.availableTokens > 0);
        assert.ok(result.charsPerDocument > 0);
      });

      it('deve dividir limite entre multiplos documentos', () => {
        const single = calculateDynamicLimit({ documentsCount: 1 });
        const multiple = calculateDynamicLimit({ documentsCount: 4 });

        assert.strictEqual(
          multiple.tokensPerDocument,
          Math.floor(single.tokensPerDocument / 4)
        );
      });

      it('deve respeitar contexto ja usado', () => {
        const full = calculateDynamicLimit({ currentContextTokens: 0 });
        const partial = calculateDynamicLimit({ currentContextTokens: 50000 });

        assert.ok(partial.availableTokens < full.availableTokens);
      });
    });

    describe('extractFromTXT', () => {
      it('deve extrair texto de arquivo TXT', async () => {
        // Criar arquivo temporario
        const tempFile = '/tmp/test-extract.txt';
        await fs.writeFile(tempFile, 'Conteudo de teste para extracao.');

        const result = await extractFromTXT(tempFile, {
          logger: new ExtractionLogger({ logLevel: LogLevel.ERROR })
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.text.includes('Conteudo de teste'));

        // Limpar
        await fs.unlink(tempFile);
      });

      it('deve truncar texto longo', async () => {
        const tempFile = '/tmp/test-extract-long.txt';
        const longText = 'A'.repeat(10000);
        await fs.writeFile(tempFile, longText);

        const result = await extractFromTXT(tempFile, {
          maxChars: 100,
          logger: new ExtractionLogger({ logLevel: LogLevel.ERROR })
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.text.length <= 150); // 100 + truncation message
        assert.ok(result.text.includes('[... CONTEUDO TRUNCADO ...]'));

        await fs.unlink(tempFile);
      });
    });

    describe('extractFileContent', () => {
      it('deve retornar erro para arquivo inexistente', async () => {
        const result = await extractFileContent('/caminho/inexistente.txt', {
          useWorker: false
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('nao encontrado'));
      });

      it('deve retornar erro para formato nao suportado', async () => {
        const tempFile = '/tmp/test.xyz';
        await fs.writeFile(tempFile, 'test');

        const result = await extractFileContent(tempFile, {
          useWorker: false
        });

        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('nao suportado'));

        await fs.unlink(tempFile);
      });

      it('deve extrair TXT com sucesso', async () => {
        const tempFile = '/tmp/test-main.txt';
        await fs.writeFile(tempFile, 'Teste de extracao principal');

        const result = await extractFileContent(tempFile, {
          useWorker: false
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.text.includes('Teste de extracao'));
        assert.ok(result.timing.durationMs > 0);

        await fs.unlink(tempFile);
      });
    });

    describe('extractWithDegradation', () => {
      it('deve tentar multiplas estrategias', async () => {
        const tempFile = '/tmp/test-degradation.txt';
        await fs.writeFile(tempFile, 'Teste degradation');

        const result = await extractWithDegradation(tempFile, {
          logLevel: LogLevel.ERROR
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.metadata.strategyUsed);

        await fs.unlink(tempFile);
      });
    });

    describe('extractMultipleFiles', () => {
      it('deve extrair multiplos arquivos', async () => {
        const files = [
          '/tmp/test-multi-1.txt',
          '/tmp/test-multi-2.txt'
        ];

        await fs.writeFile(files[0], 'Arquivo 1');
        await fs.writeFile(files[1], 'Arquivo 2');

        const result = await extractMultipleFiles(files, {
          logLevel: LogLevel.ERROR
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.successCount, 2);
        assert.ok(result.combinedText.includes('Arquivo 1'));
        assert.ok(result.combinedText.includes('Arquivo 2'));

        await Promise.all(files.map(f => fs.unlink(f)));
      });
    });

  });

  console.log('\n=== TESTES INLINE CONCLUIDOS ===\n');
}

// Auto-executar testes se chamado diretamente
if (process.argv[1] && process.argv[1].includes('extractFileContent.js') && process.argv.includes('--test')) {
  runInlineTests().catch(console.error);
}
