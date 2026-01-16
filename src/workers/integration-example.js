/**
 * Exemplo de Integração - Worker Threads com server-enhanced.js
 *
 * Este arquivo demonstra como integrar o sistema de Worker Threads
 * isolados com o servidor Express existente.
 *
 * COPIE E ADAPTE ESTE CÓDIGO PARA SEU server-enhanced.js
 *
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 1: IMPORTAÇÕES
// Adicione estas importações no topo do server-enhanced.js
// ═══════════════════════════════════════════════════════════════════════════

import { getExtractWrapper, shutdownWorkers } from './workers/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 2: VARIÁVEL GLOBAL
// Adicione esta variável junto com as outras declarações globais
// ═══════════════════════════════════════════════════════════════════════════

let extractWrapper = null;

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 3: INICIALIZAÇÃO
// Adicione esta função e chame durante a inicialização do servidor
// ═══════════════════════════════════════════════════════════════════════════

async function initializeExtractWorkers() {
  try {
    extractWrapper = await getExtractWrapper({
      // Configurações do pool
      poolConfig: {
        poolSize: 4,           // Número de workers
        taskTimeout: 120000,   // 2 minutos de timeout
        maxRetries: 3,         // 3 tentativas
        debug: false           // Debug logs desabilitados em produção
      },

      // Configurações de extração
      maxFileSizeMB: 100,      // Máximo 100MB por arquivo
      useWorkers: true,        // Usar workers isolados
      useFallback: true,       // Fallback síncrono se workers falharem
      enableLogging: true,     // Logs habilitados
      enableMetrics: true      // Métricas habilitadas
    });

    // Configurar listeners de eventos
    extractWrapper.on('workerError', (data) => {
      console.error('[ExtractWorker] Erro no worker:', data);
    });

    extractWrapper.on('workerExit', (data) => {
      console.warn('[ExtractWorker] Worker encerrado:', data);
    });

    console.log('✅ Worker Threads de extração inicializados');
    return true;

  } catch (error) {
    console.error('❌ Erro ao inicializar Worker Threads:', error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 4: ROTA DE UPLOAD SEGURA
// Substitua ou adapte sua rota de upload existente
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Upload de arquivo com extração isolada
 * PDF corrompido NÃO vai crashar o servidor
 */
async function handleFileUpload(req, res) {
  const startTime = Date.now();

  try {
    // Verificar se há arquivo
    if (!req.file) {
      return res.status(400).json({
        error: 'Nenhum arquivo enviado',
        code: 'NO_FILE'
      });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    console.log(`[Upload] Processando arquivo: ${fileName}`);

    // EXTRAÇÃO ISOLADA E SEGURA
    // Se o PDF estiver corrompido, o worker vai morrer, não o servidor
    const result = await extractWrapper.extract(filePath, {
      timeout: 60000,    // 1 minuto de timeout
      maxRetries: 2      // 2 tentativas
    });

    const processingTime = Date.now() - startTime;

    // Verificar sucesso
    if (!result.success) {
      console.warn(`[Upload] Falha na extração: ${fileName}`, result.errors);

      return res.status(400).json({
        error: 'Falha ao extrair conteúdo do arquivo',
        warnings: result.warnings,
        errors: result.errors.map(e => e.message),
        processingTime
      });
    }

    console.log(`[Upload] Sucesso: ${fileName} - ${result.text?.length || 0} caracteres em ${processingTime}ms`);

    // Retornar sucesso
    return res.json({
      success: true,
      fileName,
      text: result.text,
      pages: result.pages || 0,
      textLength: result.text?.length || 0,
      warnings: result.warnings,
      processingTime,
      fromCache: result.fromCache || false
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    // IMPORTANTE: Mesmo com erro, o servidor continua funcionando!
    console.error('[Upload] Erro na extração:', error.message);

    return res.status(500).json({
      error: 'Erro ao processar arquivo',
      message: error.message,
      code: error.code || 'EXTRACTION_ERROR',
      processingTime
    });
  }
}

// Registrar rota (adapte conforme seu setup de multer)
// app.post('/api/upload', upload.single('file'), handleFileUpload);

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 5: ROTAS DE MONITORAMENTO
// Adicione estas rotas para monitorar os workers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Health check dos workers
 */
async function getWorkersHealth(req, res) {
  try {
    if (!extractWrapper) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Workers não inicializados'
      });
    }

    const health = await extractWrapper.healthCheck();

    return res.json(health);

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * Métricas dos workers
 */
function getWorkersMetrics(req, res) {
  try {
    if (!extractWrapper) {
      return res.status(503).json({
        error: 'Workers não inicializados'
      });
    }

    const metrics = extractWrapper.getMetrics();

    return res.json(metrics);

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}

// Registrar rotas de monitoramento
// app.get('/api/workers/health', getWorkersHealth);
// app.get('/api/workers/metrics', getWorkersMetrics);

// ═══════════════════════════════════════════════════════════════════════════
// PASSO 6: SHUTDOWN GRACIOSO
// Adicione esta função ao seu handler de shutdown
// ═══════════════════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`\n[Shutdown] Recebido sinal ${signal}, encerrando...`);

  try {
    // Encerrar workers
    if (extractWrapper) {
      console.log('[Shutdown] Encerrando Worker Threads...');
      await shutdownWorkers();
      console.log('[Shutdown] Worker Threads encerrados');
    }

    // Aqui você adiciona outros shutdowns (database, redis, etc.)

    console.log('[Shutdown] Servidor encerrado com sucesso');
    process.exit(0);

  } catch (error) {
    console.error('[Shutdown] Erro durante shutdown:', error);
    process.exit(1);
  }
}

// Registrar handlers de shutdown
// process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ═══════════════════════════════════════════════════════════════════════════
// EXEMPLO COMPLETO DE USO
// ═══════════════════════════════════════════════════════════════════════════

async function exampleUsage() {
  // Inicializar workers
  await initializeExtractWorkers();

  // Extrair um único arquivo
  const result = await extractWrapper.extract('/path/to/document.pdf');
  console.log('Texto extraído:', result.text?.substring(0, 100));

  // Extrair múltiplos arquivos
  const batchResult = await extractWrapper.extractBatch([
    '/path/to/doc1.pdf',
    '/path/to/doc2.docx',
    '/path/to/doc3.txt'
  ], { concurrency: 4 });

  console.log(`Processados: ${batchResult.successful}/${batchResult.total}`);

  // Verificar saúde
  const health = await extractWrapper.healthCheck();
  console.log('Status:', health.status);

  // Obter métricas
  const metrics = extractWrapper.getMetrics();
  console.log('Taxa de sucesso:', metrics.successRate);

  // Limpar cache
  extractWrapper.clearCache();

  // Encerrar
  await shutdownWorkers();
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAÇÕES
// ═══════════════════════════════════════════════════════════════════════════

export {
  initializeExtractWorkers,
  handleFileUpload,
  getWorkersHealth,
  getWorkersMetrics,
  gracefulShutdown,
  exampleUsage
};

export default {
  initializeExtractWorkers,
  handleFileUpload,
  getWorkersHealth,
  getWorkersMetrics,
  gracefulShutdown
};
