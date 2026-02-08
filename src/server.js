/**
 * ROM Agent - Servidor Web com Interface Amigável
 * Interface similar ao Claude.ai com marca personalizada
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROMAgent, CONFIG } from './index.js';
import dotenv from 'dotenv';
import { scheduler } from './jobs/scheduler.js';
import { deployJob } from './jobs/deploy-job.js';
import { logger } from './utils/logger.js';
import projectsRouter from '../lib/api-routes-projects.js';
import autoUpdateRoutes from '../lib/api-routes-auto-update.js';
const autoUpdateSystem = require('../lib/auto-update-system.cjs');
import datajudService from './services/datajud-service.js';
import { buscarJusBrasil } from './modules/webSearch.js';
import { obterTribunal } from './modules/tribunais.js';
import * as extractionService from './services/extraction-service.js';
import * as documentExtractionService from './services/document-extraction-service.js';
import romProjectRouter from './routes/rom-project.js';
import romProjectService from './services/rom-project-service.js';
import caseProcessorSSE from './routes/case-processor-sse.js';
import chatStreamRoutes from './routes/chat-stream.js';
import featureFlags from './utils/feature-flags.js';
import { requestLogger } from './middleware/request-logger.js';
import metricsCollector from './utils/metrics-collector-v2.js';
import testPuppeteerRoutes from './routes/test-puppeteer.js';
import testEnvRoutes from './routes/test-env.js';

// Authentication imports
import { createSessionMiddleware, sessionEnhancerMiddleware } from './config/session-store.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Observability middleware (traceId, requestId)
app.use(requestLogger);

// Session middleware (MUST come before routes)
app.use(createSessionMiddleware());
app.use(sessionEnhancerMiddleware);

// Authentication routes
app.use('/api/auth', authRoutes);

// Test routes (no auth required for diagnostics)
app.use('/api', testPuppeteerRoutes);
app.use('/api', testEnvRoutes);

// Serve static files (login.html, index.html, etc.)
app.use(express.static(path.join(__dirname, '../public')));

// Rotas de Projects e Code Execution
app.use('/api', projectsRouter);

// Rotas de Auto-Atualização e Aprendizado
app.use('/api', autoUpdateRoutes);

// Rotas do Projeto ROM (Custom Instructions, Prompts, Templates, KB)
app.use('/api/rom-project', romProjectRouter);

// Rotas de Server-Sent Events para Progresso em Tempo Real
app.use('/api/case-processor', caseProcessorSSE);

// Rotas de Streaming SSE para Chat em Tempo Real (v2.7.0)
app.use('/api/chat-stream', chatStreamRoutes);

// Instância do agente
let agent = null;

// Inicializar agente
function initAgent() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    agent = new ROMAgent(apiKey);
    return true;
  }
  return false;
}

// Rota principal - Interface
app.get('/', (req, res) => {
  res.send(getHTML());
});

// API - Processar mensagem
app.post('/api/chat', async (req, res) => {
  try {
    if (!agent) {
      if (!initAgent()) {
        return res.status(500).json({ error: 'API Key não configurada' });
      }
    }

    const { message, conversationId } = req.body;
    const userId = req.session?.user?.id;

    const resposta = await agent.processar(message);

    // Auto-save conversation and messages for long-term memory
    if (userId && userId !== 'anonymous') {
      try {
        const ConversationRepository = await import('./repositories/conversation-repository.js');
        let finalConversationId = conversationId;

        // Create new conversation if needed
        if (!conversationId) {
          const title = message.length > 50 ? message.substring(0, 50) + '...' : message;
          const newConv = await ConversationRepository.createConversation({
            userId: userId,  // ✅ FIX: Corrigido de user_id para userId
            title: title,
            model: agent.modelo || 'claude-sonnet-4.5'
          });
          finalConversationId = newConv.id;
        }

        // Save user message
        await ConversationRepository.addMessage({
          conversationId: finalConversationId,  // ✅ FIX: Corrigido de conversation_id para conversationId
          role: 'user',
          content: message
        });

        // Save assistant response
        await ConversationRepository.addMessage({
          conversationId: finalConversationId,  // ✅ FIX: Corrigido de conversation_id para conversationId
          role: 'assistant',
          content: resposta
        });

        return res.json({
          response: resposta,
          conversationId: finalConversationId
        });
      } catch (saveError) {
        // Log error but don't fail the request
        console.error('Error saving conversation:', saveError.message);
      }
    }

    res.json({ response: resposta });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API - Limpar histórico
app.post('/api/clear', (req, res) => {
  if (agent) {
    agent.limparHistorico();
  }
  res.json({ success: true });
});

// API - Listar prompts
app.get('/api/prompts', (req, res) => {
  if (agent) {
    res.json({ prompts: agent.listarPrompts() });
  } else {
    res.json({ prompts: [] });
  }
});

// API - Info do sistema
app.get('/api/info', (req, res) => {
  res.json({
    nome: CONFIG.nome,
    versao: CONFIG.versao,
    capacidades: CONFIG.capacidades
  });
});

// API - Página de downloads
app.get('/downloads', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/downloads.html'));
});

// API - Download de arquivos mobile
app.get('/api/download/:file', (req, res) => {
  const downloads = {
    'start-server': { path: '../mobile-access/scripts/start-server.sh', name: 'INICIAR-SERVIDOR.sh' },
    'start-ngrok': { path: '../mobile-access/scripts/start-ngrok.sh', name: 'ACESSO-INTERNET.sh' },
    'telegram-bot': { path: '../mobile-access/telegram-bot/bot.js', name: 'telegram-bot.js' },
    'render-yaml': { path: '../mobile-access/deploy/render.yaml', name: 'render.yaml' },
    'dockerfile': { path: '../mobile-access/deploy/Dockerfile', name: 'Dockerfile' },
    'railway-json': { path: '../mobile-access/deploy/railway.json', name: 'railway.json' },
    'readme': { path: '../mobile-access/README.md', name: 'README-Mobile.md' }
  };

  const file = downloads[req.params.file];
  if (file) {
    res.download(path.join(__dirname, file.path), file.name);
  } else {
    res.status(404).json({ error: 'Arquivo não encontrado' });
  }
});

// ============================================================================
// API - Metrics (Prometheus format)
// ============================================================================

app.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsCollector.exportPrometheus();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    logger.error('Error exporting metrics:', error);
    res.status(500).send('# Error exporting metrics\n');
  }
});

// ============================================================================
// API - Feature Flags (Admin)
// ============================================================================

// Admin authentication middleware
const requireAdminToken = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    logger.error('ADMIN_TOKEN not configured');
    return res.status(500).json({
      success: false,
      error: 'Admin authentication not configured'
    });
  }

  if (!token || token !== adminToken) {
    logger.warn('Unauthorized admin access attempt', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid or missing X-Admin-Token'
    });
  }

  next();
};

// Get all feature flags
app.get('/admin/flags', requireAdminToken, (req, res) => {
  try {
    const flags = featureFlags.getAll();
    logger.info('Admin flags read', { ip: req.ip });
    res.json({
      success: true,
      flags,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting flags:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reload feature flags from environment
app.post('/admin/reload-flags', requireAdminToken, (req, res) => {
  try {
    const flags = featureFlags.reload();
    logger.info('Feature flags reloaded by admin', {
      ip: req.ip,
      flagsCount: Object.keys(flags).length
    });
    res.json({
      success: true,
      message: 'Feature flags reloaded successfully',
      flags,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error reloading flags:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// API - Sistema de Deploy Automático
// ============================================================================

// Status do scheduler
app.get('/api/scheduler/status', (req, res) => {
  try {
    const status = scheduler.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lista jobs agendados
app.get('/api/scheduler/jobs', (req, res) => {
  try {
    const jobs = scheduler.listJobs();
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Executa um job manualmente
app.post('/api/scheduler/run/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    await scheduler.runJob(jobName);
    res.json({ success: true, message: `Job '${jobName}' executado com sucesso` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status do deploy
app.get('/api/deploy/status', (req, res) => {
  try {
    const status = deployJob.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Histórico de deploys
app.get('/api/deploy/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await deployJob.getHistory(limit);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Executa deploy manual
app.post('/api/deploy/execute', async (req, res) => {
  try {
    // Executa em background e retorna imediatamente
    deployJob.execute().catch(error => {
      logger.error('Erro no deploy manual:', error);
    });

    res.json({
      success: true,
      message: 'Deploy iniciado em background. Use /api/deploy/status para acompanhar.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logs do sistema
app.get('/api/logs', async (req, res) => {
  try {
    const date = req.query.date || null;
    const logs = await logger.getLogs(date);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lista arquivos de log disponíveis
app.get('/api/logs/files', async (req, res) => {
  try {
    const files = await logger.listLogFiles();
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// API - Sistema de Consulta de Jurisprudências
// ============================================================================

// Buscar jurisprudência em múltiplas fontes
app.get('/api/jurisprudencia/buscar', async (req, res) => {
  try {
    const { termo, tribunal, fonte = 'todas', dataInicio, dataFim, limit = 50 } = req.query;

    if (!termo) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "termo" é obrigatório'
      });
    }

    const resultados = {
      termo,
      tribunal,
      timestamp: new Date().toISOString(),
      fontes: []
    };

    // Buscar no DataJud (CNJ)
    if (fonte === 'datajud' || fonte === 'todas') {
      try {
        const datajud = await datajudService.buscarDecisoes({
          tribunal,
          termo,
          dataInicio,
          dataFim,
          limit: parseInt(limit)
        });
        resultados.fontes.push({ fonte: 'DataJud (CNJ)', ...datajud });
      } catch (error) {
        resultados.fontes.push({
          fonte: 'DataJud (CNJ)',
          erro: true,
          mensagem: error.message
        });
      }
    }

    // Buscar no JusBrasil
    if (fonte === 'jusbrasil' || fonte === 'todas') {
      try {
        const jusbrasil = await buscarJusBrasil(termo, 'jurisprudencia');
        resultados.fontes.push({ fonte: 'JusBrasil', ...jusbrasil });
      } catch (error) {
        resultados.fontes.push({
          fonte: 'JusBrasil',
          erro: true,
          mensagem: error.message
        });
      }
    }

    // Buscar via WebSearch (tribunais oficiais)
    if (fonte === 'websearch' || fonte === 'todas') {
      try {
        if (tribunal) {
          const tribunalInfo = obterTribunal(tribunal);
          if (tribunalInfo) {
            resultados.fontes.push({
              fonte: 'WebSearch Oficial',
              tribunal: tribunalInfo,
              termo,
              instrucao: `Acesse o site oficial do tribunal para buscar "${termo}"`
            });
          }
        }
      } catch (error) {
        resultados.fontes.push({
          fonte: 'WebSearch Oficial',
          erro: true,
          mensagem: error.message
        });
      }
    }

    res.json({
      success: true,
      totalFontes: resultados.fontes.length,
      ...resultados
    });

  } catch (error) {
    logger.error('Erro ao buscar jurisprudência:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Buscar processo específico por número CNJ
app.get('/api/jurisprudencia/processo/:numero', async (req, res) => {
  try {
    const { numero } = req.params;

    // Validar número do processo
    const validacao = datajudService.validarNumeroProcesso(numero);
    if (!validacao.valido) {
      return res.status(400).json({
        success: false,
        error: validacao.mensagem
      });
    }

    // Buscar processo no DataJud
    const resultado = await datajudService.buscarProcessos({
      numero
    });

    res.json({
      success: true,
      validacao,
      ...resultado
    });

  } catch (error) {
    logger.error('Erro ao buscar processo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar todos os tribunais disponíveis
app.get('/api/jurisprudencia/tribunais', (req, res) => {
  try {
    const tribunais = Object.entries(datajudService.TRIBUNAIS_DATAJUD).map(([sigla, codigo]) => ({
      sigla,
      codigo,
      nome: obterTribunal(sigla)?.nome || sigla
    }));

    res.json({
      success: true,
      total: tribunais.length,
      tribunais
    });
  } catch (error) {
    logger.error('Erro ao listar tribunais:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar classes processuais
app.get('/api/jurisprudencia/classes', async (req, res) => {
  try {
    const resultado = await datajudService.listarClasses();
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    logger.error('Erro ao listar classes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar assuntos processuais
app.get('/api/jurisprudencia/assuntos', async (req, res) => {
  try {
    const { area } = req.query;
    const resultado = await datajudService.listarAssuntos(area);
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    logger.error('Erro ao listar assuntos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Limpar cache do DataJud
app.post('/api/jurisprudencia/cache/clear', (req, res) => {
  try {
    const resultado = datajudService.limparCache();
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    logger.error('Erro ao limpar cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Estatísticas do cache
app.get('/api/jurisprudencia/cache/stats', (req, res) => {
  try {
    const stats = datajudService.estatisticasCache();
    res.json({
      success: true,
      cache: stats
    });
  } catch (error) {
    logger.error('Erro ao obter estatísticas do cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =========================================
// ENDPOINTS DE EXTRAÇÃO DE DOCUMENTOS
// =========================================

/**
 * POST /api/extraction/extract
 * Extrai documentos completos com OCR, cronologia, matrizes, etc.
 *
 * Body:
 * {
 *   filePath: string (caminho do arquivo a ser extraído),
 *   processNumber: string (número do processo),
 *   projectName?: string (nome do projeto, padrão: 'ROM'),
 *   uploadToKB?: boolean (fazer upload para KB, padrão: true),
 *   generateAllFormats?: boolean (gerar todos os formatos, padrão: true)
 * }
 */
app.post('/api/extraction/extract', async (req, res) => {
  try {
    const {
      filePath,
      processNumber,
      projectName = 'ROM',
      uploadToKB = true,
      generateAllFormats = true
    } = req.body;

    // Validações
    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath é obrigatório'
      });
    }

    if (!processNumber) {
      return res.status(400).json({
        success: false,
        error: 'processNumber é obrigatório'
      });
    }

    logger.info(`Iniciando extração: ${processNumber} (Projeto: ${projectName})`);

    // Executar extração completa
    const result = await extractionService.extractCompleteDocument({
      filePath,
      processNumber,
      projectName,
      uploadToKB,
      generateAllFormats
    });

    logger.info(`Extração concluída: ${processNumber}`);

    res.json({
      success: true,
      processNumber,
      projectName,
      extractionFolder: result.processFolder,
      outputs: result.outputs,
      log: result.log
    });

  } catch (error) {
    logger.error('Erro na extração de documento:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/extraction/folder-structure/:processNumber
 * Retorna a estrutura de pastas criada para um processo
 */
app.get('/api/extraction/folder-structure/:processNumber', async (req, res) => {
  try {
    const { processNumber } = req.params;
    const { projectName = 'ROM' } = req.query;

    const structure = await extractionService.createProcessFolderStructure(
      processNumber,
      projectName
    );

    res.json({
      success: true,
      processNumber,
      projectName,
      structure
    });

  } catch (error) {
    logger.error('Erro ao criar estrutura de pastas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/extraction/ocr
 * Executa OCR em um PDF ou imagem
 *
 * Body:
 * {
 *   filePath: string,
 *   outputFolder: string,
 *   forceOCR?: boolean
 * }
 */
app.post('/api/extraction/ocr', async (req, res) => {
  try {
    const { filePath, outputFolder, forceOCR = false } = req.body;

    if (!filePath || !outputFolder) {
      return res.status(400).json({
        success: false,
        error: 'filePath e outputFolder são obrigatórios'
      });
    }

    // Importar OCR service
    const ocrService = await import('./services/ocr-service.js');

    const result = forceOCR
      ? await ocrService.performOCROnPDF(filePath, outputFolder)
      : await ocrService.smartOCR(filePath, outputFolder);

    res.json({
      success: result.success,
      ocrNeeded: result.ocrNeeded,
      totalPages: result.totalPages,
      processedPages: result.processedPages,
      averageConfidence: result.averageConfidence,
      warnings: result.warnings,
      errors: result.errors,
      outputPath: result.outputPath
    });

  } catch (error) {
    logger.error('Erro no OCR:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/extraction/chronology
 * Gera cronologia de um processo
 *
 * Body:
 * {
 *   processData: object (dados do processo),
 *   includeMatrizes?: boolean
 * }
 */
app.post('/api/extraction/chronology', async (req, res) => {
  try {
    const { processData, includeMatrizes = true } = req.body;

    if (!processData) {
      return res.status(400).json({
        success: false,
        error: 'processData é obrigatório'
      });
    }

    // Importar chronology service
    const chronologyService = await import('./services/chronology-service.js');

    const chronology = await chronologyService.generateChronology(processData);
    let matrices = null;

    if (includeMatrizes) {
      matrices = await chronologyService.generateMatrizes(processData);
    }

    res.json({
      success: true,
      chronology,
      matrices
    });

  } catch (error) {
    logger.error('Erro ao gerar cronologia:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/extraction/desktop-path
 * Retorna o caminho da pasta de extrações no Desktop
 */
app.get('/api/extraction/desktop-path', (req, res) => {
  try {
    const desktopPath = extractionService.getDesktopPath();
    const basePath = path.join(desktopPath, 'ROM-Extractions');

    res.json({
      success: true,
      desktopPath,
      basePath,
      platform: process.platform
    });

  } catch (error) {
    logger.error('Erro ao obter caminho do Desktop:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===================================================================
// ENDPOINTS - EXTRAÇÃO DE DOCUMENTOS GERAIS
// ===================================================================

/**
 * POST /api/documents/extract
 * Extrai documentos gerais (PDFs, imagens, vídeos, Office, etc.)
 * Body: {
 *   files: string[],        // Array de caminhos de arquivos (ILIMITADO)
 *   folderName: string,     // Nome customizado da pasta (OBRIGATÓRIO)
 *   projectName?: string,   // Nome do projeto (padrão: ROM)
 *   uploadToKB?: boolean    // Upload automático para KB (padrão: true)
 * }
 */
app.post('/api/documents/extract', async (req, res) => {
  try {
    const { files, folderName, projectName, uploadToKB } = req.body;

    // Validações
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array de arquivos é obrigatório (files)'
      });
    }

    if (!folderName || typeof folderName !== 'string' || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nome da pasta é obrigatório (folderName)'
      });
    }

    // Verificar se arquivos existem
    for (const filePath of files) {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: `Arquivo não encontrado: ${filePath}`
        });
      }
    }

    logger.info(`Iniciando extração de ${files.length} documento(s) para pasta: ${folderName}`);

    // Executar extração
    const resultado = await documentExtractionService.extractGeneralDocuments({
      files,
      folderName,
      projectName: projectName || 'ROM',
      uploadToKB: uploadToKB !== undefined ? uploadToKB : true,
      generateAllFormats: true
    });

    logger.info(`Extração concluída com sucesso: ${resultado.folder}`);

    res.json({
      success: true,
      message: `${files.length} documento(s) extraído(s) com sucesso`,
      ...resultado
    });

  } catch (error) {
    logger.error('Erro ao extrair documentos gerais:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * POST /api/documents/create-folder
 * Cria estrutura de pastas customizada para documentos
 * Body: {
 *   folderName: string,    // Nome da pasta
 *   projectName?: string   // Nome do projeto (padrão: ROM)
 * }
 */
app.post('/api/documents/create-folder', async (req, res) => {
  try {
    const { folderName, projectName } = req.body;

    if (!folderName || typeof folderName !== 'string' || folderName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Nome da pasta é obrigatório (folderName)'
      });
    }

    const estrutura = await documentExtractionService.createCustomFolderStructure(
      folderName,
      projectName || 'ROM'
    );

    logger.info(`Estrutura de pastas criada: ${estrutura.baseFolder}`);

    res.json({
      success: true,
      message: 'Estrutura de pastas criada com sucesso',
      ...estrutura
    });

  } catch (error) {
    logger.error('Erro ao criar estrutura de pastas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/supported-types
 * Lista todos os tipos de arquivo suportados
 */
app.get('/api/documents/supported-types', (req, res) => {
  try {
    const tiposSuportados = {
      pdf: {
        extensoes: ['.pdf'],
        descricao: 'Documentos PDF com OCR automático se necessário',
        recursos: ['Extração de texto', 'OCR', 'Análise de conteúdo']
      },
      imagem: {
        extensoes: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'],
        descricao: 'Imagens com OCR e análise visual',
        recursos: ['OCR', 'Análise de imagem', 'Extração de texto']
      },
      video: {
        extensoes: ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'],
        descricao: 'Vídeos com transcrição automática',
        recursos: ['Transcrição com timestamps', 'Análise de conteúdo', 'Extração de áudio']
      },
      documento: {
        extensoes: ['.docx', '.doc', '.odt', '.rtf'],
        descricao: 'Documentos de texto do Word e similares',
        recursos: ['Extração de texto', 'Preservação de formatação']
      },
      planilha: {
        extensoes: ['.xlsx', '.xls', '.ods', '.csv'],
        descricao: 'Planilhas do Excel e similares',
        recursos: ['Extração de dados', 'Análise de tabelas']
      },
      apresentacao: {
        extensoes: ['.pptx', '.ppt', '.odp'],
        descricao: 'Apresentações do PowerPoint e similares',
        recursos: ['Extração de conteúdo', 'Análise de slides']
      },
      texto: {
        extensoes: ['.txt', '.md', '.json', '.xml', '.html', '.css', '.js'],
        descricao: 'Arquivos de texto simples e código',
        recursos: ['Leitura direta', 'Análise de conteúdo']
      }
    };

    const totalExtensoes = Object.values(tiposSuportados)
      .reduce((acc, tipo) => acc + tipo.extensoes.length, 0);

    res.json({
      success: true,
      message: `Sistema suporta ${totalExtensoes} tipos de arquivo`,
      totalTipos: Object.keys(tiposSuportados).length,
      totalExtensoes,
      tipos: tiposSuportados,
      observacoes: [
        'Suporte para múltiplos documentos sem limite',
        'Processamento automático por tipo de arquivo',
        'Export em JSON e TXT',
        'Upload automático para Knowledge Base',
        'Estrutura de pastas customizável'
      ]
    });

  } catch (error) {
    logger.error('Erro ao listar tipos suportados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/desktop-path
 * Retorna o caminho da pasta de extrações de documentos gerais no Desktop
 */
app.get('/api/documents/desktop-path', (req, res) => {
  try {
    const desktopPath = documentExtractionService.getDesktopPath();
    const basePath = path.join(desktopPath, 'ROM-Extractions');

    res.json({
      success: true,
      desktopPath,
      basePath,
      platform: process.platform,
      observacao: 'Todas as extrações são salvas em subpastas customizadas dentro de ROM-Extractions'
    });

  } catch (error) {
    logger.error('Erro ao obter caminho do Desktop:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// HTML da interface
function getHTML() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ROM - Redator de Obras Magistrais</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #1a365d;
      --primary-light: #2c5282;
      --secondary: #c9a227;
      --background: #f7fafc;
      --surface: #ffffff;
      --text: #1a202c;
      --text-light: #718096;
      --border: #e2e8f0;
      --success: #38a169;
      --error: #e53e3e;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--background);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      color: white;
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .logo {
      width: 50px;
      height: 50px;
      background: white;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: var(--primary);
      font-size: 1.5rem;
    }

    .brand h1 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .brand p {
      font-size: 0.75rem;
      opacity: 0.8;
      margin-top: 2px;
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: rgba(255,255,255,0.2);
      color: white;
    }

    .btn-secondary:hover {
      background: rgba(255,255,255,0.3);
    }

    /* Main Chat Area */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
      padding: 1rem;
    }

    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .welcome {
      text-align: center;
      padding: 3rem 1rem;
    }

    .welcome-logo {
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      color: white;
      font-size: 2.5rem;
      font-weight: 700;
    }

    .welcome h2 {
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
      color: var(--primary);
    }

    .welcome p {
      color: var(--text-light);
      margin-bottom: 2rem;
    }

    .suggestions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 0.75rem;
      max-width: 700px;
      margin: 0 auto;
    }

    .suggestion {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s;
    }

    .suggestion:hover {
      border-color: var(--primary);
      box-shadow: 0 4px 12px rgba(26, 54, 93, 0.1);
    }

    .suggestion h4 {
      font-size: 0.875rem;
      color: var(--primary);
      margin-bottom: 0.25rem;
    }

    .suggestion p {
      font-size: 0.75rem;
      color: var(--text-light);
    }

    /* Messages */
    .message {
      display: flex;
      gap: 1rem;
      max-width: 100%;
    }

    .message-user {
      flex-direction: row-reverse;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
      flex-shrink: 0;
    }

    .avatar-rom {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      color: white;
    }

    .avatar-user {
      background: var(--secondary);
      color: white;
    }

    .message-content {
      background: var(--surface);
      border-radius: 12px;
      padding: 1rem;
      max-width: 80%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .message-user .message-content {
      background: var(--primary);
      color: white;
    }

    .message-content p {
      white-space: pre-wrap;
      line-height: 1.6;
    }

    /* Input Area */
    .input-area {
      padding: 1rem;
      background: var(--surface);
      border-top: 1px solid var(--border);
    }

    .input-container {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      gap: 0.75rem;
      align-items: flex-end;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    textarea {
      width: 100%;
      padding: 1rem;
      border: 2px solid var(--border);
      border-radius: 12px;
      font-size: 1rem;
      font-family: inherit;
      resize: none;
      min-height: 56px;
      max-height: 200px;
      transition: border-color 0.2s;
    }

    textarea:focus {
      outline: none;
      border-color: var(--primary);
    }

    .send-btn {
      width: 56px;
      height: 56px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .send-btn:hover {
      background: var(--primary-light);
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .send-btn svg {
      width: 24px;
      height: 24px;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 1rem;
      font-size: 0.75rem;
      color: var(--text-light);
    }

    .footer a {
      color: var(--primary);
      text-decoration: none;
    }

    /* Loading */
    .loading {
      display: flex;
      gap: 4px;
      padding: 0.5rem;
    }

    .loading span {
      width: 8px;
      height: 8px;
      background: var(--primary);
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }

    .loading span:nth-child(1) { animation-delay: -0.32s; }
    .loading span:nth-child(2) { animation-delay: -0.16s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    /* Capacidades */
    .capacidades {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
      margin-top: 1rem;
    }

    .capacidade {
      background: rgba(26, 54, 93, 0.1);
      color: var(--primary);
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.7rem;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .header {
        padding: 1rem;
      }

      .brand h1 {
        font-size: 1.25rem;
      }

      .suggestions {
        grid-template-columns: 1fr;
      }

      .message-content {
        max-width: 90%;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo-container">
      <div class="logo">R</div>
      <div class="brand">
        <h1>ROM</h1>
        <p>Redator de Obras Magistrais</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" onclick="limparChat()">Nova Conversa</button>
    </div>
  </header>

  <main class="main">
    <div class="chat-container" id="chatContainer">
      <div class="welcome" id="welcome">
        <div class="welcome-logo">ROM</div>
        <h2>Bem-vindo ao ROM</h2>
        <p>Seu assistente especializado em redação de peças jurídicas</p>

        <div class="suggestions">
          <div class="suggestion" onclick="enviarSugestao('Redija uma petição inicial de indenização por danos morais')">
            <h4>📝 Petição Inicial</h4>
            <p>Indenização por danos morais</p>
          </div>
          <div class="suggestion" onclick="enviarSugestao('Elabore um habeas corpus por excesso de prazo')">
            <h4>⚖️ Habeas Corpus</h4>
            <p>Excesso de prazo na prisão</p>
          </div>
          <div class="suggestion" onclick="enviarSugestao('Busque jurisprudência do STJ sobre responsabilidade civil objetiva')">
            <h4>🔍 Jurisprudência</h4>
            <p>Pesquisa no STJ</p>
          </div>
          <div class="suggestion" onclick="enviarSugestao('Gere um resumo executivo completo (Camada 3) do processo anexado')">
            <h4>📊 Resumo Executivo</h4>
            <p>Análise completa de processo</p>
          </div>
        </div>

        <div class="capacidades">
          <span class="capacidade">Peças Cíveis</span>
          <span class="capacidade">Peças Criminais</span>
          <span class="capacidade">Peças Trabalhistas</span>
          <span class="capacidade">Contratos</span>
          <span class="capacidade">Jurisprudência</span>
          <span class="capacidade">Legislação</span>
          <span class="capacidade">Resumo Executivo</span>
          <span class="capacidade">Prequestionamento</span>
        </div>
      </div>
    </div>
  </main>

  <div class="input-area">
    <div class="input-container">
      <div class="input-wrapper">
        <textarea
          id="messageInput"
          placeholder="Digite sua mensagem ou descreva a peça que deseja redigir..."
          rows="1"
          onkeydown="handleKeyDown(event)"
          oninput="autoResize(this)"
        ></textarea>
      </div>
      <button class="send-btn" id="sendBtn" onclick="enviarMensagem()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
  </div>

  <footer class="footer">
    <p>ROM v1.0 - Rodolfo Otávio Mota Advogados Associados | <a href="https://rom.adv.br" target="_blank">rom.adv.br</a></p>
  </footer>

  <script>
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const welcome = document.getElementById('welcome');

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }

    function handleKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensagem();
      }
    }

    function enviarSugestao(texto) {
      messageInput.value = texto;
      enviarMensagem();
    }

    async function enviarMensagem() {
      const message = messageInput.value.trim();
      if (!message) return;

      // Esconder welcome
      if (welcome) {
        welcome.style.display = 'none';
      }

      // Adicionar mensagem do usuário
      addMessage(message, 'user');
      messageInput.value = '';
      messageInput.style.height = 'auto';

      // Mostrar loading
      const loadingId = addLoading();

      // Desabilitar botão
      sendBtn.disabled = true;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });

        const data = await response.json();

        // Remover loading
        removeLoading(loadingId);

        if (data.error) {
          addMessage('Erro: ' + data.error, 'rom');
        } else {
          addMessage(data.response, 'rom');
        }
      } catch (error) {
        removeLoading(loadingId);
        addMessage('Erro de conexão. Verifique se o servidor está rodando.', 'rom');
      }

      sendBtn.disabled = false;
      messageInput.focus();
    }

    function addMessage(text, sender) {
      const div = document.createElement('div');
      div.className = 'message message-' + sender;

      const avatarClass = sender === 'rom' ? 'avatar-rom' : 'avatar-user';
      const avatarText = sender === 'rom' ? 'R' : 'U';

      div.innerHTML = \`
        <div class="avatar \${avatarClass}">\${avatarText}</div>
        <div class="message-content">
          <p>\${escapeHtml(text)}</p>
        </div>
      \`;

      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function addLoading() {
      const id = 'loading-' + Date.now();
      const div = document.createElement('div');
      div.id = id;
      div.className = 'message message-rom';
      div.innerHTML = \`
        <div class="avatar avatar-rom">R</div>
        <div class="message-content">
          <div class="loading">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      \`;
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
      return id;
    }

    function removeLoading(id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    function limparChat() {
      fetch('/api/clear', { method: 'POST' });
      chatContainer.innerHTML = '';
      if (welcome) {
        welcome.style.display = 'block';
        chatContainer.appendChild(welcome);
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Focus no input ao carregar
    messageInput.focus();
  </script>
</body>
</html>
`;
}

// Iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗  ██████╗ ███╗   ███╗                              ║
║   ██╔══██╗██╔═══██╗████╗ ████║                              ║
║   ██████╔╝██║   ██║██╔████╔██║                              ║
║   ██╔══██╗██║   ██║██║╚██╔╝██║                              ║
║   ██║  ██║╚██████╔╝██║ ╚═╝ ██║                              ║
║   ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝                              ║
║                                                              ║
║   Servidor Web Iniciado                                      ║
║   Acesse: http://localhost:${PORT}                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Iniciar scheduler de jobs
  logger.info('Iniciando sistema de deploy automático...');
  scheduler.start();
  logger.info('Sistema de deploy automático configurado para 02h-05h (horário de Brasília)');

  // Inicializar Projeto ROM
  logger.info('Inicializando Projeto ROM (Prompts Autoatualizáveis)...');
  romProjectService.init()
    .then(() => {
      const stats = romProjectService.getStatistics();
      logger.info(`✅ Projeto ROM carregado: ${stats.prompts.total} prompts disponíveis`);
    })
    .catch(error => {
      logger.error('Erro ao inicializar Projeto ROM:', error);
    });

  // Ativar sistema de auto-atualização e aprendizado
  logger.info('Ativando sistema de auto-atualização e aprendizado...');
  autoUpdateSystem.ativar();
  logger.info('Sistema de auto-atualização ATIVO - Verificação a cada 24h');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM recebido. Encerrando gracefully...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recebido. Encerrando gracefully...');
  scheduler.stop();
  process.exit(0);
});

export default app;
