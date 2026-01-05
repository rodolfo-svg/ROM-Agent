/**
 * ROM Agent - Servidor Web Melhorado
 * Funcionalidades:
 * - Upload de arquivos (PDF/DOCX)
 * - Histórico de conversas
 * - Streaming de respostas
 * - Formatação Markdown
 * - Tema dark/light
 * - Autenticação básica
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import multer from 'multer';
import fs from 'fs';
import { initPostgres, initRedis, checkDatabaseHealth, closeDatabaseConnections } from './config/database.js';
import { createSessionMiddleware, sessionEnhancerMiddleware } from './config/session-store.js';
import { ROMAgent, CONFIG } from './index.js';
import { BedrockAgent } from './modules/bedrock.js';
import partnersBranding from '../lib/partners-branding.js';
import formattingTemplates from '../lib/formatting-templates.js';
import { extractDocument, processFile, CONFIG as EXTRACTOR_CONFIG } from '../lib/extractor-pipeline.js';
import usersManager, { ROLES } from '../lib/users-manager.js';
import { conversarComTools } from './modules/bedrock-tools.js';
import dotenv from 'dotenv';
import compression from 'compression';
import logger, { requestLogger as legacyRequestLogger, logAIOperation, logKBOperation } from '../lib/logger.js';
import { requestLogger } from './middleware/request-logger.js';
import timeoutHandler from './middleware/timeout-handler.js';
import { generalLimiter, chatLimiter, uploadLimiter, authLimiter, searchLimiter } from '../lib/rate-limiter.js';
import contextManager from './utils/context-manager.js';
import semanticSearch from '../lib/semantic-search.js';
import documentVersioning from '../lib/versioning.js';
import templatesManager from '../lib/templates-manager.js';
import backupManager from '../lib/backup-manager.js';
import conversationsManager from '../lib/conversations-manager.js';
import chunkedUpload from '../lib/chunked-upload.js';
import projectsRouter from '../lib/api-routes-projects.js';
import autoUpdateRoutes from '../lib/api-routes-auto-update.js';
import storageRoutes from '../lib/api-routes-storage.js';
import schedulerRoutes from '../lib/api-routes-scheduler.js';
import partnerSettingsRoutes from '../lib/api-routes-partner-settings.js';
import deployRoutes from '../lib/api-routes-deploy.js';
import logsRoutes from '../lib/api-routes-logs.js';
import jurisprudenciaRoutes from '../lib/api-routes-jurisprudencia.js';
import documentsRoutes from '../lib/api-routes-documents.js';
import pipelineRoutes from '../lib/api-routes-pipeline.js';
import romProjectService from './services/rom-project-service.js';
import romProjectRouter from './routes/rom-project.js';
import romCaseProcessorService from './services/processors/rom-case-processor-service.js';
import caseProcessorRouter from './routes/case-processor.js';
import caseProcessorSSE from './routes/case-processor-sse.js';
import chatStreamRoutes from './routes/chat-stream.js';
import diagnosticBedrockRoutes from './routes/diagnostic-bedrock.js';
import certidoesDJEService from './services/certidoes-dje-service.js';
import multiAgentPipelineService from './services/multi-agent-pipeline-service.js';
// Import bedrock-helper to initialize Prometheus counters (bedrock_requests_total, bedrock_errors_total)
import './utils/bedrock-helper.js';
import autoPipelineService from './services/auto-pipeline-service.js';
import { DocumentDeduplicator } from '../lib/document-deduplicator.js';
import { scheduler } from './jobs/scheduler.js';
import { deployJob } from './jobs/deploy-job.js';
import authRoutes from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';
import { ACTIVE_PATHS, STORAGE_INFO, ensureStorageStructure } from '../lib/storage-config.js';
import featureFlagsLegacy from '../lib/feature-flags.js';
import featureFlags from './utils/feature-flags.js';
import spellChecker from '../lib/spell-checker.js';
import paradigmasManager from '../lib/paradigmas-manager.js';
import bedrockQueue from '../lib/bedrock-queue-manager.js';
import exhaustiveJobManager from '../lib/exhaustive-job-manager.js';
import metricsCollector from './utils/metrics-collector-v2.js';
import structuredLogger from './utils/structured-logger.js';
import { execSync } from 'child_process';

// Importar módulos CommonJS
const require = createRequire(import.meta.url);
const IntegradorSistema = require('../lib/integrador-sistema.cjs');
const autoUpdateSystem = require('../lib/auto-update-system.cjs');
const PromptsManager = require('../lib/prompts-manager.cjs');
const PromptsVersioning = require('../lib/prompts-versioning.cjs');
const AuthSystem = require('../lib/auth-system.cjs');
const UploadSync = require('../lib/upload-sync.cjs');
const ModelMonitor = require('../lib/model-monitor.cjs');
const KBCleaner = require('../lib/kb-cleaner.cjs');
const QualityValidator = require('../lib/quality-validator.cjs');

dotenv.config();

// ═══════════════════════════════════════════════════════════
// DEBUG: FORÇA SAÍDA DE DATABASE_URL
// ═══════════════════════════════════════════════════════════
console.log('━'.repeat(70));
console.log('🔍 [STARTUP] server-enhanced.js CARREGADO');
console.log('🔍 [STARTUP] NODE_ENV:', process.env.NODE_ENV);
console.log('🔍 [STARTUP] DATABASE_URL exists:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const masked = url.substring(0, 20) + '...' + url.substring(url.length - 20);
  console.log('🔍 [STARTUP] DATABASE_URL (masked):', masked);
}
console.log('━'.repeat(70));
// ═══════════════════════════════════════════════════════════

// Inicializar sistema de auto-atualização
const integrador = new IntegradorSistema();
integrador.inicializar().then(() => {
  console.log('✅ Sistema de auto-atualização inicializado');
}).catch(err => {
  console.error('❌ Erro ao inicializar sistema:', err);
});

// Inicializar gerenciador de prompts multi-tenant
const promptsManager = new PromptsManager();
const promptsVersioning = new PromptsVersioning();

// Inicializar sistema de autenticação JWT
const authSystem = new AuthSystem();

// Inicializar sistema de limpeza de KB
const kbCleaner = new KBCleaner();

// Inicializar monitor de modelos AI
const modelMonitor = new ModelMonitor();

// Inicializar validador de qualidade
const qualityValidator = new QualityValidator();
console.log('✅ Validador de Qualidade inicializado - evita retrabalho');

// Inicializar deduplicador de documentos
const documentDeduplicator = new DocumentDeduplicator();
console.log('✅ Deduplicador de Documentos inicializado - evita duplicatas no KB');

// Inicializar sistema de upload sincronizado
let uploadSync = null;
(async () => {
  try {
    uploadSync = new UploadSync();
    await uploadSync.start();
    console.log('✅ Sistema de Upload Sync inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar Upload Sync:', error);
  }
})();

// Agendar verificação de novos modelos
modelMonitor.scheduleAutoCheck((result) => {
  console.log(`🆕 ${result.newSuggestions} novas sugestões de modelos AI disponíveis`);
});

// Agendar limpeza automática de KB
kbCleaner.scheduleAutoCleaning({
  cleanOrphans: true,
  orphansInterval: 24 * 60 * 60 * 1000, // 24h
  cleanOldDocs: false
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS GLOBAIS - Extração inteligente de metadados
// ═══════════════════════════════════════════════════════════════════════

function detectDocumentType(text) {
  const lower = text.toLowerCase();
  if (lower.includes('petição inicial')) return 'Petição Inicial';
  if (lower.includes('recurso')) return 'Recurso';
  if (lower.includes('contestação')) return 'Contestação';
  if (lower.includes('sentença')) return 'Sentença';
  if (lower.includes('agravo')) return 'Agravo';
  if (lower.includes('habeas corpus')) return 'Habeas Corpus';
  if (lower.includes('contrato')) return 'Contrato';
  return 'Documento Jurídico';
}

function extractProcessNumber(text) {
  const match = text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  return match ? match[0] : 'Não identificado';
}

function extractParties(text) {
  const match = text.match(/(?:autor|requerente):\s*([^\n]+)|([^\n]+)\s*(?:x|versus)\s*([^\n]+)/i);
  return match ? (match[1] || `${match[2]} x ${match[3]}`).trim() : 'Não identificado';
}

function extractCourt(text) {
  const match = text.match(/(?:vara|tribunal|juízo)\s+([^\n]+)/i);
  return match ? match[0].trim() : 'Não identificado';
}

function extractSubject(text) {
  const match = text.match(/(?:assunto|objeto):\s*([^\n]+)/i);
  return match ? match[1].trim() : 'Não identificado';
}

function extractDate(text) {
  const match = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/);
  return match ? match[0] : 'Não identificado';
}

function extractValue(text) {
  const match = text.match(/R\$\s*[\d.,]+/);
  return match ? match[0] : 'Não identificado';
}

// ═══════════════════════════════════════════════════════════
// INICIALIZAÇÃO DO BANCO DE DADOS (CRÍTICO - ANTES DE TUDO!)
// ═══════════════════════════════════════════════════════════
console.log('🔌 [STARTUP] Inicializando banco de dados ANTES de criar Express app...');
console.log('🔌 [STARTUP] DATABASE_URL configurada:', !!process.env.DATABASE_URL);

try {
  await initPostgres();
  console.log('✅ [STARTUP] PostgreSQL inicializado com sucesso');
} catch (error) {
  console.error('❌ [STARTUP] Erro ao inicializar PostgreSQL:', error.message);
  console.error('⚠️  [STARTUP] Sessões usarão MemoryStore (dados perdidos em restart)');
}

try {
  await initRedis();
  console.log('✅ [STARTUP] Redis inicializado com sucesso');
} catch (error) {
  console.error('❌ [STARTUP] Erro ao inicializar Redis:', error.message);
}

const dbHealth = await checkDatabaseHealth();
console.log('🔌 [STARTUP] Database Health:', JSON.stringify(dbHealth));
console.log('━'.repeat(70));

const app = express();

// Trust proxy para Render (necessário para rate limiting e X-Forwarded-For)
app.set('trust proxy', true);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Sessões persistentes (PostgreSQL-backed com fallback para memória)
// IMPORTANTE: Deve vir ANTES de qualquer middleware que use req.session
// CRÍTICO: Database deve ser inicializado ANTES desta linha (ver acima)
app.use(createSessionMiddleware());
app.use(sessionEnhancerMiddleware);

// Middleware para proteger páginas HTML ANTIGAS (apenas quando frontend/dist não existe)
app.use((req, res, next) => {
  // Se está usando React SPA (frontend/dist existe), pular este middleware
  // O React SPA gerencia autenticação internamente
  const frontendPath = path.join(__dirname, '../frontend/dist');
  if (fs.existsSync(frontendPath)) {
    return next();
  }

  // Código legado para HTML estático (public/)
  const publicPages = [
    '/login.html',
    '/offline.html',
    '/manifest.json',
    '/service-worker.js'
  ];

  const isAsset = req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i);

  if (isAsset || publicPages.includes(req.path)) {
    return next();
  }

  const isHtmlPage = req.path === '/' || req.path.endsWith('.html');

  if (isHtmlPage) {
    if (!req.session || !req.session.user || !req.session.user.id) {
      return res.redirect('/login.html');
    }
  }

  next();
});

// Serve React Frontend V4 (frontend/dist) ou fallback para HTML antigo (public)
const frontendPath = path.join(__dirname, '../frontend/dist');
const publicPath = path.join(__dirname, '../public');
const staticPath = fs.existsSync(frontendPath) ? frontendPath : publicPath;
console.log(`📁 Servindo frontend de: ${staticPath}`);
app.use(express.static(staticPath));

// Compression (Gzip/Brotli) - comprimir responses > 1KB
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Nível de compressão (0-9)
  threshold: 1024 // Comprimir apenas responses > 1KB
}));

// SLO/Timeout Middlewares (aplicar ANTES de logs para capturar timeouts)
app.use(timeoutHandler.timeout);
app.use(timeoutHandler.abortSignal);
app.use(timeoutHandler.sloMetrics);

// Request Logger (logs estruturados)
app.use(requestLogger);

// Rate Limiter Geral (100 requisições/hora por IP)
app.use('/api/', generalLimiter);

// Rotas de Projects, Auto-Atualização, Storage, Scheduler e Partner Settings
app.use('/api', projectsRouter);
app.use('/api', autoUpdateRoutes);
app.use('/api', storageRoutes);
app.use('/api', schedulerRoutes);
app.use('/api', partnerSettingsRoutes);
app.use('/api', deployRoutes);
app.use('/api', logsRoutes);
app.use('/api', jurisprudenciaRoutes);
app.use('/api', documentsRoutes);
app.use('/api', pipelineRoutes);
app.use('/api/rom-project', romProjectRouter);

// Rotas de Autenticação (login/logout)
app.use('/api/auth', authRoutes);

// Rotas de Processamento de Casos (Extração + 5 Layers)
app.use('/api/case-processor', caseProcessorRouter);
app.use('/api/case-processor', caseProcessorSSE);

// Rotas de Streaming SSE para Chat em Tempo Real (v2.7.0)
app.use('/api/chat', chatStreamRoutes);

// Rota de Diagnóstico Bedrock (para debug)
app.use('/api/diagnostic/bedrock', diagnosticBedrockRoutes);

// ====================================================================
// 📄 API DE CERTIDÕES DJe/DJEN (CNJ)
// ====================================================================

/**
 * POST /api/certidoes/download
 * Baixar certidão do Diário da Justiça Eletrônico
 *
 * Body: {
 *   numeroProcesso: string (obrigatório),
 *   tribunal: string (opcional),
 *   dataPublicacao: string (opcional, formato DD/MM/YYYY),
 *   tipo: string (opcional: 'dje' ou 'djen', padrão: 'dje'),
 *   projectId: string (opcional, padrão: '1'),
 *   adicionarAoKB: boolean (opcional, padrão: true)
 * }
 */
app.post('/api/certidoes/download', generalLimiter, async (req, res) => {
  try {
    const { numeroProcesso, tribunal, dataPublicacao, tipo, projectId, adicionarAoKB } = req.body;

    if (!numeroProcesso) {
      return res.status(400).json({
        success: false,
        error: 'Número do processo é obrigatório'
      });
    }

    logger.info(`📄 Requisição de download de certidão - Processo: ${numeroProcesso}`);

    const certidao = await certidoesDJEService.baixarCertidao({
      numeroProcesso,
      tribunal,
      dataPublicacao,
      tipo: tipo || 'dje',
      projectId: projectId || '1',
      adicionarAoKB: adicionarAoKB !== false // padrão true
    });

    res.json({
      success: true,
      certidao,
      message: 'Certidão baixada com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao baixar certidão:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/certidoes
 * Listar todas as certidões salvas
 *
 * Query params:
 *   numeroProcesso: string (opcional)
 *   tribunal: string (opcional)
 */
app.get('/api/certidoes', generalLimiter, async (req, res) => {
  try {
    const { numeroProcesso, tribunal } = req.query;

    const certidoes = await certidoesDJEService.listarCertidoes({
      numeroProcesso,
      tribunal
    });

    res.json({
      success: true,
      certidoes,
      count: certidoes.length
    });

  } catch (error) {
    logger.error('Erro ao listar certidões:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/certidoes/:id
 * Obter certidão específica por ID ou número
 */
app.get('/api/certidoes/:id', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const certidao = await certidoesDJEService.obterCertidao(id);

    if (!certidao) {
      return res.status(404).json({
        success: false,
        error: 'Certidão não encontrada'
      });
    }

    res.json({
      success: true,
      certidao
    });

  } catch (error) {
    logger.error('Erro ao obter certidão:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/certidoes/:id/juntada
 * Gerar recomendação de juntada para certidão
 *
 * Body: {
 *   formato: string (opcional: 'peticao' ou 'resumo', padrão: 'peticao'),
 *   incluirTranscricao: boolean (opcional, padrão: true)
 * }
 */
app.post('/api/certidoes/:id/juntada', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { formato, incluirTranscricao } = req.body;

    const certidao = await certidoesDJEService.obterCertidao(id);

    if (!certidao) {
      return res.status(404).json({
        success: false,
        error: 'Certidão não encontrada'
      });
    }

    const recomendacao = certidoesDJEService.gerarRecomendacaoJuntada(certidao, {
      formato: formato || 'peticao',
      incluirTranscricao: incluirTranscricao !== false
    });

    res.json({
      success: true,
      recomendacao
    });

  } catch (error) {
    logger.error('Erro ao gerar recomendação de juntada:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/certidoes/:id
 * Deletar certidão
 */
app.delete('/api/certidoes/:id', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const success = await certidoesDJEService.deletarCertidao(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Certidão não encontrada ou erro ao deletar'
      });
    }

    res.json({
      success: true,
      message: 'Certidão deletada com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao deletar certidão:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

logger.info('✅ API de Certidões DJe/DJEN inicializada');

// ===========================================
// 🤖 MULTI-AGENT PIPELINE (PROCESSOS GRANDES 6700+ PÁGINAS)
// ===========================================

/**
 * POST /api/multi-agent/create
 * Criar novo pipeline multi-agent
 *
 * Body: {
 *   documentPath: string (obrigatório),
 *   mode: string (obrigatório: 'automatico' | 'manual' | 'hibrido'),
 *   budget: string (obrigatório: 'economico' | 'premium' | 'flexivel'),
 *   selectedStages: array (opcional, para modo flexível),
 *   outputType: string (opcional, tipo de saída desejada)
 * }
 */
app.post('/api/multi-agent/create', generalLimiter, async (req, res) => {
  try {
    const { documentPath, mode, budget, selectedStages, outputType } = req.body;

    // Validações
    if (!documentPath) {
      return res.status(400).json({
        success: false,
        error: 'documentPath é obrigatório'
      });
    }

    if (!mode || !['automatico', 'manual', 'hibrido'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'mode deve ser "automatico", "manual" ou "hibrido"'
      });
    }

    if (!budget || !['economico', 'premium', 'flexivel'].includes(budget)) {
      return res.status(400).json({
        success: false,
        error: 'budget deve ser "economico", "premium" ou "flexivel"'
      });
    }

    if (budget === 'flexivel' && (!selectedStages || selectedStages.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'selectedStages é obrigatório quando budget é "flexivel"'
      });
    }

    // Verificar se arquivo existe
    if (!fs.existsSync(documentPath)) {
      return res.status(404).json({
        success: false,
        error: `Documento não encontrado: ${documentPath}`
      });
    }

    logger.info(`🤖 Criando Multi-Agent Pipeline - Modo: ${mode}, Orçamento: ${budget}`);

    const pipeline = await multiAgentPipelineService.createPipeline({
      documentPath,
      mode,
      budget,
      selectedStages,
      outputType: outputType || 'revisao_criminal'
    });

    res.json({
      success: true,
      pipeline: {
        id: pipeline.id,
        status: pipeline.status,
        stages: pipeline.stages,
        estimatedCost: pipeline.estimatedCost,
        createdAt: pipeline.createdAt
      },
      message: `Pipeline ${pipeline.id} criado com sucesso`
    });

  } catch (error) {
    logger.error('Erro ao criar pipeline multi-agent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/multi-agent/execute/:id
 * Executar pipeline multi-agent
 *
 * NOTA: Esta é uma operação de longa duração (pode levar vários minutos)
 * Recomenda-se usar SSE ou polling em /api/multi-agent/status/:id para acompanhar progresso
 */
app.post('/api/multi-agent/execute/:id', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const pipeline = multiAgentPipelineService.getPipelineStatus(id);

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: `Pipeline ${id} não encontrado`
      });
    }

    if (pipeline.status === 'executando') {
      return res.status(409).json({
        success: false,
        error: 'Pipeline já está em execução'
      });
    }

    logger.info(`🚀 Executando Multi-Agent Pipeline: ${id}`);

    // Executar pipeline em background (não bloquear a resposta HTTP)
    multiAgentPipelineService.executePipeline(id, (progress) => {
      // Callback de progresso (pode ser usado para SSE futuramente)
      logger.info(`   📊 Pipeline ${id} - Stage ${progress.stageNumber}/${progress.totalStages}: ${progress.stage} (${progress.progress}%)`);
    }).then(result => {
      if (result.success) {
        logger.info(`✅ Pipeline ${id} concluído com sucesso`);
      } else {
        logger.error(`❌ Pipeline ${id} falhou: ${result.error}`);
      }
    });

    res.json({
      success: true,
      message: `Pipeline ${id} iniciado. Use GET /api/multi-agent/status/${id} para acompanhar progresso`,
      pipelineId: id
    });

  } catch (error) {
    logger.error('Erro ao executar pipeline multi-agent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/multi-agent/status/:id
 * Obter status atual do pipeline
 */
app.get('/api/multi-agent/status/:id', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    const status = multiAgentPipelineService.getPipelineStatus(id);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: `Pipeline ${id} não encontrado`
      });
    }

    res.json({
      success: true,
      pipeline: status
    });

  } catch (error) {
    logger.error('Erro ao obter status do pipeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/multi-agent/list
 * Listar todos os pipelines criados
 *
 * Query params:
 *   status: string (opcional: 'criado' | 'executando' | 'concluido' | 'erro')
 */
app.get('/api/multi-agent/list', generalLimiter, async (req, res) => {
  try {
    const { status } = req.query;

    let pipelines = multiAgentPipelineService.listPipelines();

    // Filtrar por status se fornecido
    if (status) {
      pipelines = pipelines.filter(p => p.status === status);
    }

    res.json({
      success: true,
      pipelines,
      count: pipelines.length
    });

  } catch (error) {
    logger.error('Erro ao listar pipelines:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

logger.info('✅ API Multi-Agent Pipeline inicializada');

// ====================================================================

logger.info('Sistema inicializado com todos os middlewares de otimização');

// Configurar multer para upload (ARMAZENAMENTO PERSISTENTE)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Usar disco persistente (/var/data no Render)
    // Pasta já criada por ensureStorageStructure() no startup
    const uploadDir = ACTIVE_PATHS.upload;
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB (4x maior que Claude.ai)
    files: 20 // 20 arquivos por vez
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|docx|doc|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF, DOCX e TXT são permitidos!'));
    }
  }
});

// Configurar multer para upload de logos (ARMAZENAMENTO PERSISTENTE)
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Usar disco persistente para logos de parceiros
    // Pasta já criada por ensureStorageStructure() no startup
    const partnersDir = ACTIVE_PATHS.partners;
    cb(null, partnersDir);
  },
  filename: (req, file, cb) => {
    const partnerId = req.body.partnerId || 'temp';
    const ext = path.extname(file.originalname);
    cb(null, `${partnerId}-logo${ext}`);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /png|jpg|jpeg|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    const mimetype = allowedMimes.includes(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PNG, JPG e SVG são permitidos!'));
    }
  }
});

// Configurar multer para upload de letterheads/timbrados (ARMAZENAMENTO PERSISTENTE)
const letterheadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Usar disco persistente para timbrados de parceiros
    // Pasta já criada por ensureStorageStructure() no startup
    const partnersDir = ACTIVE_PATHS.partners;
    cb(null, partnersDir);
  },
  filename: (req, file, cb) => {
    const partnerId = req.params.partnerId || 'temp';
    const ext = path.extname(file.originalname);
    cb(null, `${partnerId}-letterhead${ext}`);
  }
});

const uploadLetterhead = multer({
  storage: letterheadStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /png|jpg|jpeg|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    const mimetype = allowedMimes.includes(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PNG, JPG e SVG são permitidos!'));
    }
  }
});

// ============================================================
// 🎯 CUSTOM INSTRUCTIONS & INTELLIGENT MODEL SELECTION
// ============================================================

/**
 * Carrega custom instructions do arquivo JSON
 */
function loadCustomInstructions() {
  try {
    const customInstructionsPath = path.join(__dirname, '..', 'data', 'rom-project', 'custom-instructions.json');
    console.log(`🔍 [DEBUG] Tentando carregar custom instructions de: ${customInstructionsPath}`);

    if (fs.existsSync(customInstructionsPath)) {
      const data = JSON.parse(fs.readFileSync(customInstructionsPath, 'utf8'));
      const instructions = data.systemInstructions || null;

      if (instructions) {
        console.log(`✅ [DEBUG] Custom instructions carregadas com sucesso!`);
        console.log(`   - Role: ${instructions.role}`);
        console.log(`   - Expertise areas: ${instructions.expertise?.length || 0}`);
        console.log(`   - Guidelines: ${instructions.guidelines?.length || 0}`);
      } else {
        console.log(`⚠️ [DEBUG] Arquivo existe mas systemInstructions está vazio`);
      }

      return instructions;
    } else {
      console.log(`❌ [DEBUG] Arquivo custom-instructions.json NÃO ENCONTRADO!`);
    }
  } catch (error) {
    console.error('⚠️ Erro ao carregar custom instructions:', error.message);
    console.error('   Stack:', error.stack);
  }
  return null;
}

/**
 * Constrói system prompt completo com custom instructions
 */
function buildSystemPrompt() {
  console.log(`🏗️ [DEBUG] Construindo system prompt...`);

  const customInstructions = loadCustomInstructions();

  if (!customInstructions) {
    // Fallback: prompt básico
    const fallbackPrompt = 'Você é o ROM Agent, um assistente jurídico especializado em Direito brasileiro.';
    console.log(`⚠️ [DEBUG] Usando FALLBACK prompt (custom instructions não carregadas)`);
    console.log(`   Prompt: ${fallbackPrompt}`);
    return fallbackPrompt;
  }

  // Construir prompt detalhado
  let prompt = `# ${customInstructions.role}\n\n`;

  // Expertise
  if (customInstructions.expertise && customInstructions.expertise.length > 0) {
    prompt += `## Áreas de Expertise:\n`;
    customInstructions.expertise.forEach(area => {
      prompt += `- ${area}\n`;
    });
    prompt += '\n';
  }

  // Guidelines
  if (customInstructions.guidelines && customInstructions.guidelines.length > 0) {
    prompt += `## Diretrizes Obrigatórias:\n`;
    customInstructions.guidelines.forEach(guideline => {
      prompt += `- ${guideline}\n`;
    });
    prompt += '\n';
  }

  // Prohibitions
  if (customInstructions.prohibitions && customInstructions.prohibitions.length > 0) {
    prompt += `## Proibições:\n`;
    customInstructions.prohibitions.forEach(prohibition => {
      prompt += `- ❌ ${prohibition}\n`;
    });
    prompt += '\n';
  }

  // Tom
  if (customInstructions.tone) {
    prompt += `## Tom: ${customInstructions.tone}\n\n`;
  }

  // Análise de Prazos
  if (customInstructions.deadlineAnalysis) {
    prompt += `## Análise de Prazos Processuais:\n`;
    prompt += `- Lei 11.419/2006: Publicação eletrônica (DJe/DJEN)\n`;
    prompt += `- Início do prazo: SEMPRE no 1º dia útil APÓS a publicação\n`;
    prompt += `- Contagem: Dias úteis (excluem sábados, domingos e feriados)\n`;
    prompt += `- Prazo em dobro: Fazenda Pública, Defensoria, litisconsortes\n\n`;
  }

  prompt += `---\n\n`;
  prompt += `**EXCELÊNCIA NAS RESPOSTAS - IMPERATIVO:**\n\n`;
  prompt += `VOCÊ DEVE OBRIGATORIAMENTE:\n`;
  prompt += `- ✅ Produzir análises EXTENSAS, PROFUNDAS e DETALHADAS (mínimo 1000 palavras para análises complexas)\n`;
  prompt += `- ✅ Citar TODOS os artigos de lei aplicáveis com explicação COMPLETA de cada um\n`;
  prompt += `- ✅ Incluir fundamentação doutrinária e jurisprudencial quando existente\n`;
  prompt += `- ✅ Estruturar em seções numeradas com cabeçalhos claros\n`;
  prompt += `- ✅ Usar linguagem técnico-jurídica sofisticada e precisa\n`;
  prompt += `- ✅ Desenvolver raciocínio jurídico completo, não apenas conclusões\n\n`;
  prompt += `VOCÊ ESTÁ ABSOLUTAMENTE PROIBIDO DE:\n`;
  prompt += `- ❌ Respostas genéricas, superficiais ou rasas\n`;
  prompt += `- ❌ Omitir fundamentação legal obrigatória\n`;
  prompt += `- ❌ Usar apenas tópicos sem desenvolvimento textual\n`;
  prompt += `- ❌ Responder em menos de 500 palavras para perguntas jurídicas complexas\n\n`;
  prompt += `**FORMATO ESPERADO:** Parágrafos bem desenvolvidos com fundamentação completa, citações legais com explicação, argumentação jurídica sólida.\n\n`;

  console.log(`✅ [DEBUG] System prompt construído com sucesso!`);
  console.log(`   Tamanho: ${prompt.length} caracteres`);
  console.log(`   Primeiros 300 chars: ${prompt.substring(0, 300)}...`);

  return prompt;
}

/**
 * Seleciona modelo ideal baseado no tipo de query
 * @param {string} message - Mensagem do usuário
 * @param {object} metadata - Metadados adicionais
 * @param {array} relevantDocs - Documentos relevantes do KB
 * @returns {string} Model ID do Bedrock
 */
function selectIntelligentModel(message, metadata = {}, relevantDocs = []) {
  const lowerMessage = message.toLowerCase();

  // 1. MULTIMODAL - Detecção de imagens (futuro)
  const hasImageAttachment = metadata.hasImage || false;

  // 2. RACIOCÍNIO PROFUNDO - DeepSeek R1
  if (lowerMessage.includes('fundamentação') ||
      lowerMessage.includes('raciocínio') ||
      lowerMessage.includes('explicação detalhada') ||
      lowerMessage.includes('passo a passo')) {
    console.log('🧠 Modelo selecionado: DeepSeek R1 (raciocínio exposto)');
    return 'deepseek.r1-v1:0';
  }

  // 3. ANÁLISE JURÍDICA / PEÇAS PROCESSUAIS - Claude Sonnet 4.5 (PRIORIDADE)
  if (lowerMessage.includes('analise') || lowerMessage.includes('análise') ||
      lowerMessage.includes('processo') || lowerMessage.includes('sentença') ||
      lowerMessage.includes('decisão') || lowerMessage.includes('acórdão') ||
      lowerMessage.includes('embargos') || lowerMessage.includes('recurso') ||
      lowerMessage.includes('petição') || lowerMessage.includes('contestação') ||
      lowerMessage.includes('fundamentação') || lowerMessage.includes('resumo executivo') ||
      lowerMessage.includes('fichamento') || lowerMessage.includes('parecer')) {
    console.log('🔥 Modelo selecionado: Claude Sonnet 4.5 (análise jurídica profunda)');
    return 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';
  }

  // 4. RAG / PESQUISA NO KB - Claude Sonnet 4.5 ou Llama 3.3
  if (lowerMessage.includes('pesquise') ||
      lowerMessage.includes('buscar') ||
      lowerMessage.includes('precedentes') ||
      (relevantDocs && relevantDocs.length > 3)) {
    if (metadata.clienteVIP || relevantDocs.length > 10) {
      console.log('🔍 Modelo selecionado: Claude Sonnet 4.5 (RAG premium)');
      return 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';
    } else {
      console.log('📚 Modelo selecionado: Llama 3.3 70B (RAG custo-benefício)');
      return 'meta.llama3-3-70b-instruct-v1:0';
    }
  }

  // 5. CASOS VIP / CRÍTICOS - Nova Premier ou Opus 4.5
  if (metadata.clienteVIP || lowerMessage.includes('urgente') || lowerMessage.includes('crítico')) {
    if (lowerMessage.includes('máxima qualidade') || metadata.casoComplexo) {
      console.log('💎 Modelo selecionado: Claude Opus 4.5 (máxima qualidade)');
      return 'anthropic.claude-opus-4-5-20251101-v1:0';
    } else {
      console.log('🏆 Modelo selecionado: Nova Premier (VIP Amazon)');
      return 'amazon.nova-premier-v1:0';
    }
  }

  // 6. RESUMOS RÁPIDOS / TRIAGEM - Claude Haiku 4.5
  if (lowerMessage.includes('resumo rápido') ||
      lowerMessage.includes('resumir') ||
      lowerMessage.includes('triagem') ||
      lowerMessage.includes('breve')) {
    console.log('⚡ Modelo selecionado: Claude Haiku 4.5 (rápido)');
    return 'anthropic.claude-haiku-4-5-20251001-v1:0';
  }

  // 7. VALIDAÇÃO / SEGUNDA OPINIÃO - Llama 4 Maverick
  if (lowerMessage.includes('validar') ||
      lowerMessage.includes('revisar') ||
      lowerMessage.includes('segunda opinião') ||
      lowerMessage.includes('verificar')) {
    console.log('🔄 Modelo selecionado: Llama 4 Maverick (validação)');
    return 'meta.llama4-maverick-17b-instruct-v1:0';
  }

  // 8. LONG CONTEXT - Processos grandes
  const hasLargeDocuments = relevantDocs && relevantDocs.some(doc =>
    doc.content && doc.content.length > 100000
  );
  if (hasLargeDocuments || lowerMessage.includes('processo completo')) {
    console.log('📚 Modelo selecionado: Llama 3.3 70B (long context)');
    return 'meta.llama3-3-70b-instruct-v1:0';
  }

  // 9. PADRÃO - Claude Sonnet 4.5 (máxima qualidade para análises jurídicas)
  console.log('✅ Modelo selecionado: Claude Sonnet 4.5 (padrão - máxima qualidade)');
  return 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';
}

// Armazenar instâncias de agente por sessão
const agents = new Map();

// Armazenar histórico de conversas
const conversationHistory = new Map();

// Inicializar agente para sessão (usando Bedrock com intelligent model selection)
function getAgent(sessionId, modelId = null, forceNew = false) {
  const agentKey = modelId ? `${sessionId}_${modelId}` : sessionId;

  if (!agents.has(agentKey) || forceNew) {
    // Construir system prompt com custom instructions
    const systemPrompt = buildSystemPrompt();

    // Usar modelo específico ou padrão (Claude Sonnet 4.5 - máxima qualidade)
    const modelo = modelId || 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

    console.log(`🤖 [DEBUG] Criando agente para sessão ${sessionId}`);
    console.log(`   - Modelo: ${modelo}`);
    console.log(`   - System Prompt Tamanho: ${systemPrompt.length} chars`);
    console.log(`   - System Prompt Preview: ${systemPrompt.substring(0, 150)}...`);
    console.log(`   - Agent Key: ${agentKey}`);

    agents.set(agentKey, new BedrockAgent({
      modelo,
      systemPrompt
    }));

    console.log(`✅ [DEBUG] Agente criado e armazenado no Map`);
  } else {
    console.log(`♻️ [DEBUG] Reutilizando agente existente para sessão ${sessionId}`);
    console.log(`   - Agent Key: ${agentKey}`);
  }

  return agents.get(agentKey);
}

// Obter histórico de conversa (limitado às últimas 10 mensagens para performance)
function getHistory(sessionId) {
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, []);
  }
  // OTIMIZAÇÃO: Limitar histórico a 10 mensagens (-10% tokens, mais rápido)
  return conversationHistory.get(sessionId).slice(-10);
}

// Rota principal - Interface melhorada
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API - Processar mensagem com streaming
app.post('/api/chat', async (req, res) => {
  try {
    const { message, metadata = {}, projectId = null } = req.body;

    // Guard: validar mensagem
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem inválida ou ausente' });
    }

    const history = getHistory(req.session.id);

    // ✅ GERENCIAMENTO DE CONVERSAÇÃO
    // Criar ou obter conversationId da sessão
    if (!req.session.conversationId) {
      const userId = req.session.userId || 'anonymous';
      req.session.conversationId = conversationsManager.createConversation(
        userId,
        req.session.id,
        projectId
      );
      logger.info(`Nova conversa criada: ${req.session.conversationId}`);
    }

    const conversationId = req.session.conversationId;

    // 🔍 DETECÇÃO AUTOMÁTICA DE MODO EXAUSTIVO (PLANO ANTI-429)
    // Desabilitado temporariamente - forçar sempre modo ONLINE
    // O contextManager vai limitar o tamanho do contexto automaticamente
    const isExhaustive = false;

    if (isExhaustive) {
      logger.info('🚀 Pedido EXAUSTIVO detectado - disparando job assíncrono', {
        message: message.substring(0, 100),
        conversationId,
        projectId
      });

      // Criar job assíncrono
      const job = await exhaustiveJobManager.createJob({
        projectId: projectId || 'default',
        userId: req.session.userId || 'anonymous',
        traceId: req.headers['x-trace-id'] || `trace_${Date.now()}`,
        request: message,
        metadata: {
          conversationId,
          sessionId: req.session.id
        }
      });

      // Retornar resposta imediata ao usuário
      const exhaustiveResponse = `🔍 **Análise Exaustiva Iniciada**

Detectei que você solicitou análise da **INTEGRALIDADE** do processo.
Devido à complexidade e volume de informações, isso será processado como **JOB ASSÍNCRONO**.

📊 **Status**: Em processamento
⏱️ **Estimativa**: ${job.estimatedTime}
🔗 **Acompanhe**: ${job.trackingUrl}
🆔 **Job ID**: \`${job.jobId}\`

**O que está sendo feito:**
1. ✅ Inventariando todos os documentos do projeto
2. 📝 Analisando cada documento detalhadamente
3. 🔗 Consolidando informações por tema jurídico
4. 📊 Gerando resumo executivo + tabelas estruturadas
5. 💾 Preparando export completo (JSON + Markdown)

**Você será notificado quando concluir.**
Enquanto isso, pode continuar usando o sistema normalmente.

*Para acompanhar o progresso em tempo real, acesse: \`GET ${job.trackingUrl}\`*`;

      // Adicionar resposta ao histórico
      history.push({
        role: 'assistant',
        content: exhaustiveResponse,
        timestamp: new Date(),
        isExhaustiveJob: true,
        jobId: job.jobId
      });

      // Salvar na conversação
      conversationsManager.addMessage(conversationId, {
        role: 'assistant',
        content: exhaustiveResponse
      });

      // Retornar resposta
      return res.json({
        response: exhaustiveResponse,
        conversationId,
        exhaustiveJob: {
          jobId: job.jobId,
          status: job.status,
          trackingUrl: job.trackingUrl,
          estimatedTime: job.estimatedTime
        }
      });
    }

    // ✅ VERIFICAÇÃO E ANÁLISE DO SISTEMA DE AUTO-ATUALIZAÇÃO
    let contextoEnriquecido = null;
    if (metadata?.dataDosFatos || metadata?.ramoDireito || metadata?.tipoPeca) {
      console.log('🔍 Analisando contexto jurídico...');
      const analise = await integrador.processarRequisicao({
        dataDosFatos: metadata.dataDosFatos,
        dataAjuizamento: metadata.dataAjuizamento,
        ramoDireito: metadata.ramoDireito,
        naturezaProcesso: metadata.naturezaProcesso,
        instancia: metadata.instancia,
        tipoPeca: metadata.tipoPeca
      });

      contextoEnriquecido = analise;

      // Adicionar aviso de direito intertemporal na resposta se aplicável
      if (analise.analiseIntertemporal?.direitoIntertemporal?.material) {
        console.log(`⚖️ ${analise.analiseIntertemporal.direitoIntertemporal.material}`);
      }

      // Adicionar recomendações ao contexto da mensagem
      if (analise.recomendacoes && analise.recomendacoes.length > 0) {
        console.log(`📋 ${analise.recomendacoes.length} recomendações aplicáveis`);
      }
    }

    // Adicionar mensagem do usuário ao histórico em memória
    history.push({
      role: 'user',
      content: message,
      metadata: metadata || {},
      contextoEnriquecido,
      timestamp: new Date()
    });

    // ✅ SALVAR MENSAGEM DO USUÁRIO NA CONVERSA PERSISTENTE
    conversationsManager.addMessage(conversationId, {
      role: 'user',
      content: message
    });

    // 🔍 BUSCAR DOCUMENTOS RELEVANTES NO KB COM GERENCIAMENTO INTELIGENTE DE CONTEXTO
    let kbContext = '';
    let relevantDocs = []; // Declarar no escopo correto
    try {
      const kbDocsPath = path.join(ACTIVE_PATHS.kb, 'documents');
      if (fs.existsSync(kbDocsPath)) {
        const files = await fs.promises.readdir(kbDocsPath);
        const txtFiles = files.filter(f => f.endsWith('.txt'));

        if (txtFiles.length > 0) {
          console.log(`📚 Buscando em ${txtFiles.length} documentos do KB...`);

          // Ler todos os documentos e seus metadados
          const docs = await Promise.all(txtFiles.map(async (file) => {
            const filePath = path.join(kbDocsPath, file);
            const metadataPath = filePath.replace('.txt', '.metadata.json');

            const content = await fs.promises.readFile(filePath, 'utf8');
            let metadata = {};
            try {
              if (fs.existsSync(metadataPath)) {
                metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
              }
            } catch (e) {}

            return { file, content, metadata };
          }));

          // 🎯 BUSCA INTELIGENTE: Filtrar documentos relevantes
          const lowerMessage = message.toLowerCase();
          const searchTerms = message.split(/\s+/).filter(word => word.length > 3);

          // Detectar se é análise exaustiva (mas agora com limitação de tokens)
          const isExhaustiveAnalysis = (
            lowerMessage.includes('todos') ||
            lowerMessage.includes('completo') ||
            lowerMessage.includes('íntegra') ||
            lowerMessage.includes('integra') ||
            lowerMessage.includes('exaustivamente')
          );

          if (isExhaustiveAnalysis) {
            logger.info('🔍 Análise EXAUSTIVA solicitada - Usando TODOS documentos com limitação inteligente');
            relevantDocs = docs;
          } else {
            // Buscar documentos relevantes por palavras-chave
            relevantDocs = docs.filter(doc => {
              const lowerContent = doc.content.toLowerCase();

              // Busca por metadados específicos
              const metadataMatch = (
                (doc.metadata.processNumber && lowerMessage.includes('processo')) ||
                (doc.metadata.parties && lowerMessage.includes('parte')) ||
                (doc.metadata.court && lowerMessage.includes('tribunal'))
              );

              // Busca por conteúdo
              const contentMatch = searchTerms.some(term =>
                lowerContent.includes(term.toLowerCase())
              );

              return metadataMatch || contentMatch;
            });

            logger.info(`✅ ${relevantDocs.length} documento(s) relevante(s) encontrado(s) por palavras-chave`);
          }

          if (relevantDocs.length > 0) {
            // 🚀 USAR CONTEXT MANAGER PARA OTIMIZAR O CONTEXTO
            const selectedModelForContext = selectedModel || 'claude-3-5-sonnet-20241022';

            logger.info(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            logger.info(`🧠 CONTEXT MANAGER - Otimizando ${relevantDocs.length} documento(s)`);
            logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

            const managedContext = contextManager.manageMultiDocumentContext(
              relevantDocs,
              message,
              selectedModelForContext
            );

            kbContext = contextManager.formatContextForPrompt(managedContext);

            logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

            // Atualizar relevantDocs com os documentos processados
            relevantDocs = managedContext.documents;
          } else {
            logger.info('ℹ️ Nenhum documento relevante encontrado no KB');
          }
        }
      }
    } catch (kbError) {
      logger.error('⚠️ Erro ao buscar no KB:', kbError);
    }

    // 🎯 INTELLIGENT MODEL SELECTION
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`💬 [DEBUG] NOVA MENSAGEM DO CHAT`);
    console.log(`   - Sessão: ${req.session.id}`);
    console.log(`   - Mensagem: ${message.substring(0, 100)}...`);
    console.log(`   - Metadata: ${JSON.stringify(metadata)}`);
    console.log(`   - Docs Relevantes: ${relevantDocs.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const selectedModel = selectIntelligentModel(message, metadata, relevantDocs);

    console.log(`\n🎯 [DEBUG] MODELO SELECIONADO: ${selectedModel}`);

    const agent = getAgent(req.session.id, selectedModel);

    if (!agent) {
      console.error(`❌ [DEBUG] FALHA AO CRIAR AGENTE!`);
      return res.status(500).json({ error: 'Erro ao inicializar agente' });
    }

    console.log(`✅ [DEBUG] Agente obtido com sucesso, iniciando processamento...`);

    // 🚀 DETECTAR ANÁLISE COMPLETA E USAR CASE PROCESSOR (5 LAYERS)
    // 🔥 TEMPORARIAMENTE DESABILITADO - Case Processor não tem Context Manager
    // TODO: Integrar Context Manager no Case Processor antes de reabilitar
    const lowerMessage = message.toLowerCase();
    const isAnaliseCompleta = false; // DESABILITADO: Case Processor envia contexto sem gerenciamento de tokens
    /* const isAnaliseCompleta = (
      (lowerMessage.includes('analise') || lowerMessage.includes('análise')) &&
      (lowerMessage.includes('integra') || lowerMessage.includes('íntegra') || lowerMessage.includes('completa'))
    ) || lowerMessage.includes('resumo executivo') ||
       lowerMessage.includes('fichamento') ||
       lowerMessage.includes('embargos') ||
       lowerMessage.includes('processo completo'); */

    let resposta;

    if (isAnaliseCompleta && relevantDocs && relevantDocs.length > 0) {
      // ✅ USAR CASE PROCESSOR (5 LAYERS) para análise completa
      console.log('🔍 Análise completa detectada - Executando 5 LAYERS do Case Processor...');

      try {
        // Criar casoId temporário baseado no documento
        const casoId = `CHAT_${req.session.id}_${Date.now()}`;

        // Executar todas as 5 layers do Case Processor
        const resultado = await romCaseProcessorService.processCaso(casoId, {
          documentPaths: relevantDocs.map(doc => path.join(kbDocsPath, doc.file.replace('.txt', ''))),
          extractorService: { extractDocument: async () => ({ success: true, text: relevantDocs[0].content }) },
          skipExtraction: true, // Já temos o texto extraído
          extractedDocuments: relevantDocs.map(doc => ({
            filename: doc.metadata.originalFilename || doc.file,
            text: doc.content,
            metadata: doc.metadata
          }))
        });

        // Formatar resposta com TODAS as informações das 5 layers
        resposta = `# 📋 ANÁLISE COMPLETA DO PROCESSO\n\n`;

        // Layer 2: Índices
        if (resultado.indexes) {
          resposta += `## 📊 ÍNDICE DE EVENTOS E FOLHAS\n\n`;
          if (resultado.indexes.eventos) {
            resposta += `**Total de Eventos:** ${resultado.indexes.eventos.length}\n\n`;
            resultado.indexes.eventos.slice(0, 20).forEach((evento, i) => {
              resposta += `${i + 1}. ${evento.tipo || 'Evento'} - Folha ${evento.folha || 'N/A'}\n`;
            });
            if (resultado.indexes.eventos.length > 20) {
              resposta += `\n_... e mais ${resultado.indexes.eventos.length - 20} eventos_\n`;
            }
          }
        }

        // Layer 3: Fichamento por Documento e Prazos
        if (resultado.microfichamentos && Array.isArray(resultado.microfichamentos)) {
          resposta += `\n\n## 📑 FICHAMENTO POR DOCUMENTO\n\n`;
          resultado.microfichamentos.forEach((fichamento, i) => {
            resposta += `### ${i + 1}. ${fichamento.nomeDocumento || `Documento ${i + 1}`}\n\n`;

            // Movimentos processuais
            if (fichamento.movimentos && Array.isArray(fichamento.movimentos)) {
              resposta += `**Movimentos Processuais:** ${fichamento.movimentos.length}\n\n`;
              fichamento.movimentos.forEach((mov, j) => {
                resposta += `${j + 1}. **${mov.data || 'Data N/A'}** - ${mov.descricao || mov.tipo || 'Movimento'}\n`;
                if (mov.folha) resposta += `   - Folha: ${mov.folha}\n`;
              });
            }

            // Resumo do documento
            if (fichamento.resumo) {
              resposta += `\n**Resumo:**\n${fichamento.resumo}\n\n`;
            }

            // Partes
            if (fichamento.partes) {
              resposta += `**Partes:**\n${JSON.stringify(fichamento.partes, null, 2)}\n\n`;
            }

            resposta += `\n---\n\n`;
          });
        }

        if (resultado.consolidacoes) {
          resposta += `\n\n## 📋 CONSOLIDAÇÃO GERAL\n\n${JSON.stringify(resultado.consolidacoes, null, 2)}\n\n`;
        }

        if (resultado.prazos) {
          resposta += `\n\n## ⏰ ANÁLISE DE PRAZOS\n\n`;
          if (Array.isArray(resultado.prazos)) {
            resultado.prazos.forEach((prazo, i) => {
              resposta += `${i + 1}. **${prazo.tipo || 'Prazo'}**\n`;
              resposta += `   - Vencimento: ${prazo.dataVencimento || 'N/A'}\n`;
              resposta += `   - Status: ${prazo.status || 'Pendente'}\n`;
              if (prazo.dias) resposta += `   - Dias restantes: ${prazo.dias}\n`;
              resposta += `\n`;
            });
          } else {
            resposta += `${JSON.stringify(resultado.prazos, null, 2)}\n\n`;
          }
        }

        // Layer 4: Jurisprudência
        if (resultado.jurisprudencia) {
          resposta += `\n\n## ⚖️ JURISPRUDÊNCIA RELEVANTE\n\n`;
          resultado.jurisprudencia.forEach((jurisp, i) => {
            resposta += `${i + 1}. **${jurisp.ementa}**\n   - Fonte: ${jurisp.fonte}\n\n`;
          });
        }

        // Mensagem original do usuário
        resposta += `\n\n---\n\n**Processamento completo realizado com sucesso!**\n`;
        resposta += `Todas as 5 layers foram executadas: Extração ✅ Índices ✅ Análise ✅ Jurisprudência ✅ Redação ✅`;

        console.log(`✅ Análise completa gerada: ${resposta.length} caracteres`);
      } catch (caseError) {
        console.error(`❌ Erro no Case Processor: ${caseError.message}`);
        console.error(`   Stack: ${caseError.stack}`);
        // Fallback para processamento normal
        const messageWithContext = kbContext ? message + kbContext : message;
        const resultado = await agent.enviar(messageWithContext);
        if (!resultado.sucesso) {
          const statusCode = resultado.statusCode || 500;
          const errorResponse = { error: resultado.erro || 'Erro ao processar mensagem', status: statusCode };
          if (statusCode === 503 && resultado.retryAfter) res.set('Retry-After', String(resultado.retryAfter));
          if (resultado.errorCode) errorResponse.code = resultado.errorCode;
          return res.status(statusCode).json(errorResponse);
        }
        resposta = resultado.resposta;
      }
    } else {
      // Processamento normal com agente Bedrock
      // NÃO concatenar ainda - deixar o agente fazer isso após truncar o histórico

      console.log(`🔄 Enviando mensagem para agente Bedrock...`);
      console.log(`   - Mensagem: ${message.length} caracteres`);
      console.log(`   - KB Context: ${kbContext.length} caracteres`);

      // 🔥 PASSAR MENSAGEM E KB SEPARADOS PARA TRUNCAMENTO CORRETO DO HISTÓRICO
      const resultado = await agent.enviar(message, { kbContext });

      console.log(`✅ Agente respondeu: sucesso=${resultado.sucesso}, resposta=${resultado.resposta?.length || 0} caracteres`);

      if (!resultado.sucesso) {
        const status = Number.isInteger(resultado?.statusCode) ? resultado.statusCode : 500;

        console.error(`❌ Erro do agente (${status}): ${resultado.erro}`);

        if (status === 503 && resultado?.retryAfter) {
          res.set('Retry-After', String(resultado.retryAfter));
        }

        return res.status(status).json({
          error: resultado.erro || 'Erro ao processar mensagem',
          status
        });
      }

      resposta = resultado.resposta;
    }

    // Adicionar resposta ao histórico em memória
    history.push({ role: 'assistant', content: resposta, timestamp: new Date() });

    // ✅ SALVAR RESPOSTA DO ASSISTANT NA CONVERSA PERSISTENTE
    conversationsManager.addMessage(conversationId, {
      role: 'assistant',
      content: resposta
    });

    // ✅ GERAR TÍTULO AUTOMATICAMENTE APÓS PRIMEIRA MENSAGEM
    conversationsManager.generateTitle(conversationId);

    // Preparar resposta com metadados de verificação
    const response = {
      response: resposta,
      conversationId: conversationId, // Retornar conversationId para o frontend
      metadados: contextoEnriquecido?.metadados || {},
      recomendacoes: contextoEnriquecido?.recomendacoes || [],
      verificacaoRealizada: !!contextoEnriquecido
    };

    res.json(response);
  } catch (error) {
    console.error('❌ ERRO CRÍTICO no /api/chat:', error.message);
    console.error('   Stack:', error.stack);
    console.error('   Session ID:', req.session.id);
    console.error('   Message length:', req.body.message?.length || 0);

    // Debug: inspecionar propriedades do erro
    console.error('[api/chat] error meta', {
      message: error?.message,
      name: error?.name,
      statusCode: error?.statusCode,
      status: error?.status,
      code: error?.code,
      retryAfter: error?.retryAfter,
      stackTop: (error?.stack || '').split('\n').slice(0, 3).join('\n'),
    });

    // Determinar status HTTP correto (respeita error.statusCode do Bottleneck/Circuit Breaker)
    const status = Number.isInteger(error?.statusCode)
      ? error.statusCode
      : (Number.isInteger(error?.status) ? error.status : 500);

    // Adicionar header Retry-After para HTTP 503 (Bottleneck)
    if (status === 503 && error?.retryAfter) {
      res.set('Retry-After', String(error.retryAfter));
    }

    // Retornar erro com status apropriado (não vaza stack em produção)
    const responseBody = {
      error: error.message || 'Erro desconhecido no chat',
      status
    };

    // Preservar campos extras se existirem (traceId, requestId, etc)
    if (error.traceId) responseBody.traceId = error.traceId;
    if (error.requestId) responseBody.requestId = error.requestId;
    if (error.code) responseBody.code = error.code;

    // Stack trace apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development' && error.stack) {
      responseBody.details = error.stack;
    }

    res.status(status).json(responseBody);
  }
});

// API - Aprovar Documento e Limpar KB
app.post('/api/approve-document', async (req, res) => {
  try {
    const { casoId, projectId, keepDesktopCopy = true } = req.body;

    if (!casoId) {
      return res.status(400).json({ error: 'casoId é obrigatório' });
    }

    console.log(`✅ Aprovando documento para caso ${casoId}...`);

    const result = {
      success: true,
      casoId,
      deletedFiles: [],
      desktopCopy: null,
      message: 'Documento aprovado com sucesso'
    };

    // 1. MANTER CÓPIA NO DESKTOP (se solicitado)
    if (keepDesktopCopy) {
      try {
        const desktopPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Desktop', 'ROM-Agent-Aprovados');
        await fs.mkdir(desktopPath, { recursive: true });

        const casoExportPath = path.join(ACTIVE_PATHS.data, 'casos', casoId, 'export');
        const desktopCasoPath = path.join(desktopPath, casoId);

        // Verificar se há exportação
        try {
          await fs.access(casoExportPath);

          // Copiar toda a exportação para o Desktop
          await fs.cp(casoExportPath, desktopCasoPath, { recursive: true });

          result.desktopCopy = desktopCasoPath;
          console.log(`📁 Cópia salva no Desktop: ${desktopCasoPath}`);
        } catch (err) {
          console.warn('⚠️  Exportação não encontrada, pulando cópia para Desktop');
        }
      } catch (err) {
        console.error('❌ Erro ao copiar para Desktop:', err);
        result.desktopCopyError = err.message;
      }
    }

    // 2. DELETAR ARQUIVOS TEMPORÁRIOS DO KB
    try {
      const kbDocsPath = path.join(ACTIVE_PATHS.kb, 'documents');

      // Listar todos os arquivos no KB
      const kbFiles = await fs.readdir(kbDocsPath);

      // Filtrar apenas arquivos relacionados ao caso (se projectId fornecido)
      let filesToDelete = kbFiles;
      if (projectId) {
        filesToDelete = kbFiles.filter(f => f.includes(projectId) || f.includes(casoId));
      }

      // Deletar arquivos
      for (const file of filesToDelete) {
        const filePath = path.join(kbDocsPath, file);
        try {
          await fs.unlink(filePath);
          result.deletedFiles.push(file);
          console.log(`🗑️  Deletado do KB: ${file}`);
        } catch (err) {
          console.warn(`⚠️  Não foi possível deletar ${file}:`, err.message);
        }
      }

      console.log(`✅ ${result.deletedFiles.length} arquivos deletados do KB`);
    } catch (err) {
      console.error('❌ Erro ao deletar KB:', err);
      result.kbDeletionError = err.message;
    }

    // 3. MARCAR CASO COMO APROVADO NO HISTÓRICO
    try {
      const casoPath = path.join(ACTIVE_PATHS.data, 'casos', casoId);
      const metadataPath = path.join(casoPath, 'metadata.json');

      let metadata = {
        casoId,
        status: 'aprovado',
        approvedAt: new Date().toISOString(),
        kbCleaned: result.deletedFiles.length > 0,
        desktopCopy: result.desktopCopy
      };

      try {
        const existingData = await fs.readFile(metadataPath, 'utf-8');
        const existing = JSON.parse(existingData);
        metadata = { ...existing, ...metadata };
      } catch (err) {
        // Arquivo não existe - criar novo
      }

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      console.log(`✅ Caso marcado como aprovado`);
    } catch (err) {
      console.error('❌ Erro ao atualizar metadata:', err);
      result.metadataError = err.message;
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Erro ao aprovar documento:', error);
    res.status(500).json({
      error: error.message || 'Erro ao aprovar documento',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API - Chat com Tool Use (Jurisprudência Automática)
app.post('/api/chat-with-tools', async (req, res) => {
  try {
    const { message, modelo = null, systemPrompt = null, tipo = null, prioridade = 'equilibrado' } = req.body;
    const history = getHistory(req.session.id);

    console.log('🤖 [Auto Pipeline] Processando com seleção automática de estratégia');

    // ═══════════════════════════════════════════════════════════
    // USAR AUTO PIPELINE SERVICE (Seleção automática inteligente)
    // ═══════════════════════════════════════════════════════════
    const resultado = await autoPipelineService.process({
      prompt: message,
      tipo,
      prioridade,
      forceModel: modelo,  // Se usuário passou modelo específico, respeitar
      systemPrompt: systemPrompt || `Você é o ROM Agent, um assistente especializado em Direito brasileiro.

Quando precisar de jurisprudência ou precedentes judiciais para fundamentar sua resposta, use a ferramenta pesquisar_jurisprudencia automaticamente.

Sempre cite as fontes corretamente e formate as referências em ABNT.`,
      historico: history.slice(-5) // Últimas 5 mensagens (reduzido para evitar overflow de contexto)
    });

    if (!resultado.sucesso) {
      return res.status(500).json({ error: resultado.erro || 'Erro no processamento' });
    }

    // Adicionar ao histórico
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    history.push({
      role: 'assistant',
      content: resultado.resposta,
      toolsUsadas: resultado.toolsUsadas || [],
      modelo: resultado.modelo,
      estrategia: resultado.estrategia,
      timestamp: new Date()
    });

    res.json({
      response: resultado.resposta,
      toolsUsadas: resultado.toolsUsadas || [],
      modelo: resultado.modelo,
      estrategia: resultado.estrategia,
      selecao: resultado.selecao,  // Metadados da seleção automática
      duracao: resultado.duracao,
      uso: resultado.uso
    });

  } catch (error) {
    console.error('❌ [Tool Use] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// API - Chat com Streaming Real-Time (SSE)
app.post('/api/chat-stream', async (req, res) => {
  try {
    const { message, modelo = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0' } = req.body;
    const history = getHistory(req.session.id);

    // Configurar SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx

    console.log('🌊 [Stream] Iniciando streaming...', { modelo });

    const { conversarStream } = await import('./modules/bedrock.js');

    let textoCompleto = '';
    const startTime = Date.now();

    await conversarStream(
      message,
      (chunk) => {
        textoCompleto += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      },
      {
        modelo,
        historico: history.slice(-10),
        maxTokens: 4096,
        temperature: 0.7
      }
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // Enviar evento final
    res.write(`data: ${JSON.stringify({
      type: 'done',
      fullText: textoCompleto,
      elapsed: `${elapsed}s`,
      modelo
    })}\n\n`);
    res.end();

    // Adicionar ao histórico
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    history.push({
      role: 'assistant',
      content: textoCompleto,
      timestamp: new Date(),
      modelo,
      streaming: true
    });

    console.log(`✅ [Stream] Concluído em ${elapsed}s`);
  } catch (error) {
    console.error('❌ [Stream] Erro:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Alias para compatibilidade com frontend React V4
app.post('/api/chat/stream', async (req, res) => {
  try {
    const {
      message,
      model = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      conversationId,
      messages = [] // Histórico completo do frontend
    } = req.body;

    const sessionId = conversationId || req.session.id;

    // PRIORIDADE: Usar histórico do frontend se fornecido, senão buscar do servidor
    let history = [];
    if (messages && messages.length > 0) {
      // Frontend enviou histórico - USAR ESTE (fonte da verdade)
      history = messages
        .filter(m => m.role && m.content) // Validar estrutura
        .map(m => ({
          role: m.role,
          content: m.content
        }));
      console.log(`📚 [Context] Usando ${history.length} mensagens do frontend`);
    } else {
      // Fallback: histórico do servidor (compatibilidade)
      history = getHistory(sessionId);
      console.log(`📚 [Context] Usando ${history.length} mensagens do servidor (fallback)`);
    }

    // Configurar SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx

    console.log('🌊 [Stream] Iniciando streaming (V4)...', { model, contextSize: history.length });

    const { conversarStream } = await import('./modules/bedrock.js');

    let textoCompleto = '';
    const startTime = Date.now();

    await conversarStream(
      message,
      (chunk) => {
        textoCompleto += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      {
        modelo: model,
        historico: history.slice(-10), // Últimas 10 mensagens
        maxTokens: 4096,
        temperature: 0.7
      }
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // Enviar evento final
    res.write(`data: ${JSON.stringify({
      type: 'done',
      content: textoCompleto,
      elapsed: `${elapsed}s`,
      model
    })}\n\n`);
    res.end();

    // Adicionar ao histórico
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    history.push({
      role: 'assistant',
      content: textoCompleto,
      timestamp: new Date(),
      model,
      streaming: true
    });

    console.log(`✅ [Stream] Concluído em ${elapsed}s`);
  } catch (error) {
    console.error('❌ [Stream] Erro:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// API - Upload de arquivo
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const agent = getAgent(req.session.id);
    if (!agent) {
      return res.status(500).json({ error: 'API Key não configurada' });
    }

    // Processar arquivo com o agente
    const filePath = req.file.path;
    const fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: filePath,
      size: req.file.size,
      mimetype: req.file.mimetype
    };

    // Adicionar ao histórico
    const history = getHistory(req.session.id);
    history.push({
      role: 'user',
      content: `Arquivo enviado: ${fileInfo.originalName}`,
      file: fileInfo,
      timestamp: new Date()
    });

    res.json({
      success: true,
      file: fileInfo,
      message: 'Arquivo enviado com sucesso! O que você gostaria que eu fizesse com ele?'
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// API - UPLOAD CHUNKED PARA ARQUIVOS GRANDES (SEM LIMITE)
// ============================================================================

/**
 * Iniciar sessão de upload chunked
 * POST /api/upload/chunked/init
 * Body: { filename, fileSize, contentType }
 */
app.post('/api/upload/chunked/init', uploadLimiter, async (req, res) => {
  try {
    const { filename, fileSize, contentType } = req.body;

    if (!filename || !fileSize) {
      return res.status(400).json({ error: 'Filename e fileSize são obrigatórios' });
    }

    const session = await chunkedUpload.initSession(filename, fileSize, contentType || 'application/octet-stream');

    logger.info('Sessão de upload chunked iniciada', {
      uploadId: session.uploadId,
      filename,
      fileSize: (fileSize / 1024 / 1024).toFixed(2) + ' MB'
    });

    res.json({
      success: true,
      ...session
    });

  } catch (error) {
    logger.error('Erro ao iniciar upload chunked', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Upload de um chunk
 * POST /api/upload/chunked/:uploadId/chunk/:chunkIndex
 * Body: binary data (chunk)
 */
app.post('/api/upload/chunked/:uploadId/chunk/:chunkIndex', uploadLimiter, async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.params;
    const chunks = [];

    // Receber dados binários
    req.on('data', chunk => chunks.push(chunk));

    req.on('end', async () => {
      try {
        const chunkData = Buffer.concat(chunks);
        const result = await chunkedUpload.uploadChunk(uploadId, parseInt(chunkIndex), chunkData);

        logger.info('Chunk recebido', {
          uploadId,
          chunkIndex,
          progress: result.progress + '%'
        });

        res.json({
          success: true,
          ...result
        });

      } catch (error) {
        logger.error('Erro ao processar chunk', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

  } catch (error) {
    logger.error('Erro no upload de chunk', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Finalizar upload chunked
 * POST /api/upload/chunked/:uploadId/finalize
 */
app.post('/api/upload/chunked/:uploadId/finalize', uploadLimiter, async (req, res) => {
  try {
    const { uploadId } = req.params;
    const result = await chunkedUpload.finalizeUpload(uploadId);

    logger.info('Upload chunked finalizado', {
      uploadId,
      filename: result.filename,
      fileSize: (result.fileSize / 1024 / 1024).toFixed(2) + ' MB'
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error('Erro ao finalizar upload chunked', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Status de upload chunked
 * GET /api/upload/chunked/:uploadId/status
 */
app.get('/api/upload/chunked/:uploadId/status', (req, res) => {
  try {
    const { uploadId } = req.params;
    const status = chunkedUpload.getStatus(uploadId);

    if (!status) {
      return res.status(404).json({ error: 'Sessão de upload não encontrada' });
    }

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    logger.error('Erro ao obter status de upload', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cancelar upload chunked
 * DELETE /api/upload/chunked/:uploadId
 */
app.delete('/api/upload/chunked/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const result = await chunkedUpload.cancelUpload(uploadId);

    logger.info('Upload chunked cancelado', { uploadId });

    res.json(result);

  } catch (error) {
    logger.error('Erro ao cancelar upload', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

logger.info('✅ Chunked Upload API endpoints configured');

// ============================================================================

// API - Upload múltiplos documentos com extração automática (33 ferramentas)
app.post('/api/upload-documents', upload.array('files', 20), async (req, res) => {
  try {
    // Estender timeout para 10 minutos (arquivos grandes podem demorar)
    req.setTimeout(600000); // 10 minutos
    res.setTimeout(600000);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    console.log(`📤 Upload de ${req.files.length} arquivo(s) para extração automática...`);

    const extractions = [];

    for (const file of req.files) {
      try {
        console.log(`🔍 Processando: ${file.originalname} com 33 ferramentas + documentos estruturados...`);

        // 🚀 PROCESSAMENTO COMPLETO: Extração + Documentos Estruturados
        // Usa processFile() que gera automaticamente:
        // - Texto extraído (33 ferramentas)
        // - 7 documentos estruturados (fichamento, índices, análises)
        // - Chunks para RAG
        // - Metadados completos
        const processResult = await processFile(file.path);

        if (!processResult.success) {
          throw new Error(processResult.error || 'Falha na extração');
        }

        // Estruturar dados processados
        const extractedData = {
          filename: file.originalname,
          size: file.size,
          type: file.mimetype,
          uploadedAt: new Date().toISOString(),

          // Dados extraídos
          extractedText: processResult.extraction?.charCount > 0 ? 'Texto extraído com sucesso' : '',
          textLength: processResult.extraction?.charCount || 0,
          wordCount: processResult.extraction?.wordCount || 0,
          toolsUsed: processResult.toolsUsed || [],

          // Documentos estruturados gerados
          structuredDocuments: processResult.structuredDocuments || {},

          // Metadados inteligentes
          data: {
            'Tipo de Documento': 'Processo Judicial',
            'Status': `✅ Processado (${(processResult.toolsUsed || []).length} ferramentas + 7 docs estruturados)`,
            'Fichamento': processResult.structuredDocuments?.filesGenerated >= 7 ? '✅' : '⚠️',
            'Índices': processResult.structuredDocuments?.filesGenerated >= 7 ? '✅' : '⚠️',
            'Análises': processResult.structuredDocuments?.filesGenerated >= 7 ? '✅' : '⚠️',
            'Documentos Gerados': processResult.structuredDocuments?.filesGenerated || 0
          },

          // Info técnica
          stats: processResult.processing || {},
          chunks: processResult.processing?.chunks || 0
        };

        // 💾 COPIAR PARA KB (processFile salva em extracted/, precisamos copiar para KB/)
        try {
          // Validação 1: Verificar se extracted existe
          if (!processResult.extracted) {
            throw new Error('processResult.extracted is undefined');
          }

          // Validação 2: Construir caminho usando CONFIG correto
          const extractedTextPath = path.join(EXTRACTOR_CONFIG.extractedFolder, processResult.extracted);

          // Validação 3: Verificar se arquivo existe
          if (!fs.existsSync(extractedTextPath)) {
            throw new Error(`Arquivo extraído não encontrado: ${extractedTextPath}`);
          }

          // Ler conteúdo do arquivo extraído
          const extractedText = await fs.promises.readFile(extractedTextPath, 'utf8');

          // 🔍 VERIFICAR DUPLICATAS usando SHA256
          if (documentDeduplicator.isDuplicate(extractedText)) {
            const original = documentDeduplicator.getOriginal(extractedText);
            console.log(`   ⚠️ DUPLICATA DETECTADA: ${file.originalname}`);
            console.log(`   📄 Original: ${original.filename} (${original.uploadedAt})`);

            extractions.push({
              filename: file.originalname,
              success: false,
              skipped: true,
              reason: 'duplicate',
              originalDocument: original.filename,
              message: `Documento duplicado. Original: "${original.filename}" enviado em ${new Date(original.uploadedAt).toLocaleString('pt-BR')}`
            });

            // Pular para próximo arquivo
            continue;
          }

          // Criar nome único para KB (remover extensão se já houver .txt)
          const baseFilename = file.originalname.replace(/\.txt$/i, '');
          const kbPath = path.join(ACTIVE_PATHS.kb, 'documents', `${Date.now()}_${baseFilename}.txt`);

          // Validação 4: Garantir que diretório KB existe
          await fs.promises.mkdir(path.dirname(kbPath), { recursive: true });

          // Copiar arquivo principal
          await fs.promises.copyFile(extractedTextPath, kbPath);
          console.log(`   💾 KB: Copiado ${path.basename(kbPath)}`);

          // 📝 REGISTRAR no deduplicador
          const docHash = documentDeduplicator.register(
            path.basename(kbPath),
            extractedText,
            file.originalname
          );
          console.log(`   🔐 Hash SHA256: ${docHash.substring(0, 16)}...`);

          // 🚀 CORREÇÃO CRÍTICA: Copiar os 7 documentos estruturados para o KB
          const structuredDocs = [];
          if (processResult.structuredDocuments?.outputPath) {
            try {
              const structuredFiles = await fs.promises.readdir(processResult.structuredDocuments.outputPath);

              for (const structFile of structuredFiles) {
                const sourcePath = path.join(processResult.structuredDocuments.outputPath, structFile);
                const timestamp = Date.now();
                const destPath = path.join(ACTIVE_PATHS.kb, 'documents', `${timestamp}_${baseFilename}_${structFile}`);

                await fs.promises.copyFile(sourcePath, destPath);
                structuredDocs.push({
                  name: structFile,
                  path: destPath,
                  type: path.extname(structFile)
                });

                console.log(`   📄 KB: ${structFile}`);
              }

              console.log(`   ✅ ${structuredDocs.length} documentos estruturados copiados para KB`);
            } catch (error) {
              console.warn(`   ⚠️ Erro ao copiar documentos estruturados: ${error.message}`);
            }
          }

          // Salvar metadados no KB (incluindo referências aos 7 docs)
          const kbMetadata = {
            source: 'web-upload',
            originalFilename: file.originalname,
            uploadedAt: new Date().toISOString(),
            textLength: processResult.extraction?.charCount || 0,
            wordCount: processResult.extraction?.wordCount || 0,
            toolsUsed: processResult.toolsUsed || [],
            structuredDocuments: processResult.structuredDocuments,
            structuredDocsPath: processResult.structuredDocuments?.outputPath,
            structuredDocsInKB: structuredDocs
          };

          const kbMetadataPath = kbPath.replace('.txt', '.metadata.json');
          await fs.promises.writeFile(kbMetadataPath, JSON.stringify(kbMetadata, null, 2), 'utf8');

          // 📋 REGISTRAR NO kb-documents.json (para aparecer na interface do KB)
          try {
            const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');
            let kbDocs = [];

            if (fs.existsSync(kbDocsPath)) {
              const data = fs.readFileSync(kbDocsPath, 'utf8');
              kbDocs = JSON.parse(data);
            }

            // Criar entrada para o documento PRINCIPAL
            const kbDoc = {
              id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: file.originalname,
              type: file.mimetype,
              size: file.size,
              path: kbPath,
              userId: req.user?.userId || 'web-upload',
              userName: req.user?.name || 'Web Upload',
              uploadedAt: new Date().toISOString(),
              extractedText: await fs.promises.readFile(kbPath, 'utf8'),
              textLength: processResult.extraction?.charCount || 0,
              metadata: {
                toolsUsed: processResult.toolsUsed || [],
                structuredDocuments: processResult.structuredDocuments?.filesGenerated || 0,
                structuredDocsPath: processResult.structuredDocuments?.outputPath,
                wordCount: processResult.extraction?.wordCount || 0,
                structuredDocsInKB: structuredDocs
              }
            };

            kbDocs.push(kbDoc);

            // 📄 ADICIONAR OS 7 DOCUMENTOS ESTRUTURADOS AO REGISTRO
            for (const structDoc of structuredDocs) {
              const structContent = await fs.promises.readFile(structDoc.path, 'utf8');

              kbDocs.push({
                id: `kb-struct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: `${file.originalname} - ${structDoc.name}`,
                type: structDoc.type === '.md' ? 'text/markdown' : 'application/json',
                size: structContent.length,
                path: structDoc.path,
                userId: req.user?.userId || 'web-upload',
                userName: req.user?.name || 'Web Upload',
                uploadedAt: new Date().toISOString(),
                extractedText: structContent,
                textLength: structContent.length,
                metadata: {
                  isStructuredDocument: true,
                  parentDocument: file.originalname,
                  documentType: structDoc.name.split('_')[1]?.replace('.md', '').replace('.json', ''),
                  structuredType: structDoc.name
                }
              });
            }
            fs.writeFileSync(kbDocsPath, JSON.stringify(kbDocs, null, 2));

            console.log(`   📋 KB Registry: Registrado em kb-documents.json (${kbDocs.length} total)`);
          } catch (registryError) {
            console.error(`   ⚠️  Erro ao registrar em kb-documents.json: ${registryError.message}`);
          }

        } catch (kbError) {
          // Log mas não falha o upload completo
          console.error(`   ⚠️  Erro ao copiar para KB: ${kbError.message}`);
          logger.warn('Falha ao copiar para KB', { error: kbError.message, file: file.originalname });
        }

        extractions.push(extractedData);
        console.log(`✅ Processado: ${file.originalname} (${processResult.extraction?.wordCount} palavras, ${processResult.structuredDocuments?.filesGenerated || 0} docs estruturados)`)
      } catch (fileError) {
        console.error(`❌ Erro ao processar ${file.originalname}:`, fileError);
        extractions.push({
          filename: file.originalname,
          error: fileError.message,
          data: {
            'Status': `❌ Erro: ${fileError.message}`
          }
        });
      }
    }

    console.log(`✅ Upload concluído: ${extractions.length} arquivo(s) processado(s)`);

    res.json({
      success: true,
      message: `${req.files.length} arquivo(s) processado(s) com sucesso`,
      filesCount: req.files.length,
      extractions: extractions
    });

  } catch (error) {
    console.error('❌ Erro no upload de documentos:', error);
    console.error('Stack trace:', error.stack);
    logger.error('Erro no upload de documentos', {
      error: error.message,
      stack: error.stack,
      files: req.files?.map(f => f.originalname)
    });
    res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API - Limpar histórico
app.post('/api/clear', (req, res) => {
  const sessionId = req.session.id;
  if (agents.has(sessionId)) {
    agents.get(sessionId).limparHistorico();
  }
  conversationHistory.set(sessionId, []);

  // ✅ LIMPAR conversationId DA SESSÃO PARA CRIAR NOVA CONVERSA
  delete req.session.conversationId;
  logger.info(`Histórico limpo - nova conversa será criada na próxima mensagem`);

  res.json({ success: true });
});

// API - Obter histórico
app.get('/api/history', (req, res) => {
  const history = getHistory(req.session.id);
  res.json({ history });
});

// API - Listar prompts
app.get('/api/prompts', (req, res) => {
  try {
    const { partnerId, role } = getUserInfo(req);
    const prompts = promptsManager.listarPrompts(partnerId, role);
    res.json({ prompts });
  } catch (error) {
    console.error('Erro ao listar prompts:', error);
    res.json({ prompts: [] });
  }
});

// API - Listar prompts do Projeto ROM (JSON)
app.get('/api/rom-prompts', async (req, res) => {
  try {
    const promptsDir = path.join(ACTIVE_PATHS.data, 'rom-project', 'prompts');
    const prompts = {
      gerais: [],
      judiciais: [],
      extrajudiciais: [],
      total: 0
    };

    // Função auxiliar para ler prompts de uma categoria
    const lerPromptsCategoria = async (categoria) => {
      const categoriaPath = path.join(promptsDir, categoria);
      try {
        const files = await fs.promises.readdir(categoriaPath);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        for (const file of jsonFiles) {
          const filePath = path.join(categoriaPath, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const promptData = JSON.parse(content);

          prompts[categoria].push({
            id: promptData.id || file.replace('.json', ''),
            nome: promptData.nome || promptData.name || file.replace('.json', ''),
            categoria: categoria,
            subcategoria: promptData.subcategoria || promptData.subcategory || null,
            descricao: promptData.descricao || promptData.description || '',
            tags: promptData.tags || [],
            version: promptData.version || '1.0',
            updated: promptData.updated || promptData.lastModified || null,
            autoUpdateable: promptData.autoUpdateable || false,
            file: file,
            path: `${categoria}/${file}`
          });
        }
      } catch (error) {
        console.error(`Erro ao ler prompts da categoria ${categoria}:`, error);
      }
    };

    // Ler todas as categorias
    await Promise.all([
      lerPromptsCategoria('gerais'),
      lerPromptsCategoria('judiciais'),
      lerPromptsCategoria('extrajudiciais')
    ]);

    // Calcular total
    prompts.total = prompts.gerais.length + prompts.judiciais.length + prompts.extrajudiciais.length;

    res.json({
      success: true,
      prompts,
      message: `${prompts.total} prompts do Projeto ROM disponíveis`
    });

  } catch (error) {
    console.error('Erro ao listar prompts ROM:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      prompts: { gerais: [], judiciais: [], extrajudiciais: [], total: 0 }
    });
  }
});

// API - Obter prompt específico do Projeto ROM
app.get('/api/rom-prompts/:categoria/:promptId', async (req, res) => {
  try {
    const { categoria, promptId } = req.params;
    const promptsDir = path.join(ACTIVE_PATHS.data, 'rom-project', 'prompts');
    const promptPath = path.join(promptsDir, categoria, `${promptId}.json`);

    // Verificar se o arquivo existe
    try {
      await fs.promises.access(promptPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Prompt não encontrado'
      });
    }

    // Ler o arquivo
    const content = await fs.promises.readFile(promptPath, 'utf-8');
    const promptData = JSON.parse(content);

    res.json({
      success: true,
      prompt: promptData
    });

  } catch (error) {
    console.error('Erro ao obter prompt ROM:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API - Editar prompt do Projeto ROM
app.put('/api/rom-prompts/:categoria/:promptId', async (req, res) => {
  try {
    const { categoria, promptId } = req.params;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Dados do prompt não fornecidos'
      });
    }

    const promptsDir = path.join(ACTIVE_PATHS.data, 'rom-project', 'prompts');
    const promptPath = path.join(promptsDir, categoria, `${promptId}.json`);

    // Verificar se o arquivo existe
    try {
      await fs.promises.access(promptPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Prompt não encontrado'
      });
    }

    // Fazer backup antes de editar
    const backupDir = path.join(promptsDir, '.backups');
    await fs.promises.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `${promptId}_${Date.now()}.json`);
    const originalContent = await fs.promises.readFile(promptPath, 'utf-8');
    await fs.promises.writeFile(backupPath, originalContent, 'utf-8');

    // Adicionar timestamp de atualização
    const updatedPrompt = {
      ...prompt,
      updated: new Date().toISOString(),
      lastModifiedBy: 'user'
    };

    // Salvar prompt editado
    await fs.promises.writeFile(
      promptPath,
      JSON.stringify(updatedPrompt, null, 2),
      'utf-8'
    );

    logger.info('Prompt ROM editado', {
      categoria,
      promptId,
      backupPath
    });

    res.json({
      success: true,
      message: 'Prompt editado com sucesso',
      prompt: updatedPrompt,
      backup: backupPath
    });

  } catch (error) {
    console.error('Erro ao editar prompt ROM:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API - Criar novo prompt do Projeto ROM
app.post('/api/rom-prompts/:categoria', async (req, res) => {
  try {
    const { categoria } = req.params;
    const { prompt } = req.body;

    if (!prompt || !prompt.id) {
      return res.status(400).json({
        success: false,
        error: 'Dados do prompt ou ID não fornecidos'
      });
    }

    // Validar categoria
    const categoriasValidas = ['gerais', 'judiciais', 'extrajudiciais'];
    if (!categoriasValidas.includes(categoria)) {
      return res.status(400).json({
        success: false,
        error: 'Categoria inválida. Use: gerais, judiciais ou extrajudiciais'
      });
    }

    const promptsDir = path.join(ACTIVE_PATHS.data, 'rom-project', 'prompts');
    const categoriaPath = path.join(promptsDir, categoria);
    const promptPath = path.join(categoriaPath, `${prompt.id}.json`);

    // Verificar se já existe
    try {
      await fs.promises.access(promptPath);
      return res.status(409).json({
        success: false,
        error: 'Prompt com este ID já existe'
      });
    } catch {
      // Arquivo não existe, pode criar
    }

    // Criar diretório da categoria se não existir
    await fs.promises.mkdir(categoriaPath, { recursive: true });

    // Adicionar metadados
    const newPrompt = {
      ...prompt,
      categoria: categoria,
      version: prompt.version || '1.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      createdBy: 'user',
      autoUpdateable: false
    };

    // Salvar novo prompt
    await fs.promises.writeFile(
      promptPath,
      JSON.stringify(newPrompt, null, 2),
      'utf-8'
    );

    logger.info('Novo prompt ROM criado', {
      categoria,
      promptId: prompt.id
    });

    res.status(201).json({
      success: true,
      message: 'Prompt criado com sucesso',
      prompt: newPrompt
    });

  } catch (error) {
    console.error('Erro ao criar prompt ROM:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API - Deletar prompt do Projeto ROM
app.delete('/api/rom-prompts/:categoria/:promptId', async (req, res) => {
  try {
    const { categoria, promptId } = req.params;
    const promptsDir = path.join(ACTIVE_PATHS.data, 'rom-project', 'prompts');
    const promptPath = path.join(promptsDir, categoria, `${promptId}.json`);

    // Verificar se o arquivo existe
    try {
      await fs.promises.access(promptPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: 'Prompt não encontrado'
      });
    }

    // Ler conteúdo antes de deletar (para backup)
    const content = await fs.promises.readFile(promptPath, 'utf-8');
    const promptData = JSON.parse(content);

    // Criar backup permanente antes de deletar
    const backupDir = path.join(promptsDir, '.deleted');
    await fs.promises.mkdir(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `${promptId}_${Date.now()}.json`);
    await fs.promises.writeFile(backupPath, content, 'utf-8');

    // Deletar arquivo
    await fs.promises.unlink(promptPath);

    logger.info('Prompt ROM deletado', {
      categoria,
      promptId,
      backupPath
    });

    res.json({
      success: true,
      message: 'Prompt deletado com sucesso',
      backup: backupPath,
      deletedPrompt: promptData
    });

  } catch (error) {
    console.error('Erro ao deletar prompt ROM:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Obtém o hash do commit git atual
 * @returns {string} Hash do commit ou 'unknown' se não disponível
 */
function getGitCommit() {
  try {
    const commit = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      timeout: 1000,
      windowsHide: true
    }).trim();
    return commit || 'unknown';
  } catch {
    // Fallback: tentar ler do env var (Render seta isso)
    return process.env.RENDER_GIT_COMMIT?.substring(0, 8) || 'unknown';
  }
}

// API - Info do sistema com health check completo
app.get('/api/info', async (req, res) => {
  try {
    // Status do AWS Bedrock
    let bedrockStatus = 'unknown';
    try {
      const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
      const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });
      bedrockStatus = 'connected';
    } catch (error) {
      bedrockStatus = 'disconnected';
    }

    // Status do cache
    const cacheStats = {
      enabled: true,
      entries: agents.size
    };

    // Uptime
    const uptime = process.uptime();
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

    // Uso de memória
    const memoryUsage = process.memoryUsage();

    // Informações do sistema
    const systemInfo = {
      nome: CONFIG.nome,
      versao: CONFIG.versao,
      version: CONFIG.versao, // Alias em inglês para compatibilidade internacional
      capacidades: CONFIG.capacidades,

      // Health Check
      health: {
        status: bedrockStatus === 'connected' ? 'healthy' : 'degraded',
        uptime: uptimeFormatted,
        uptimeSeconds: Math.floor(uptime)
      },

      // AWS Bedrock
      bedrock: {
        status: bedrockStatus,
        region: process.env.AWS_REGION || 'us-west-2',
        credentials: {
          hasAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretAccessKey: !!process.env.AWS_SECRET_ACCESS_KEY,
          hasRegion: !!process.env.AWS_REGION
        }
      },

      // Cache
      cache: {
        enabled: cacheStats.enabled,
        activeSessions: cacheStats.entries
      },

      // Servidor
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        gitCommit: getGitCommit()
      },

      // Memória
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
      },

      // ✅ STORAGE DIAGNOSTIC (debug disco persistente)
      storage: (() => {
        const varDataExists = fs.existsSync('/var/data');
        let varDataStats = null;
        let varDataError = null;

        try {
          if (varDataExists) {
            varDataStats = fs.statSync('/var/data');
          }
        } catch (err) {
          varDataError = err.message;
        }

        // Tentar listar diretórios em /var
        let varContents = null;
        let varError = null;
        try {
          if (fs.existsSync('/var')) {
            varContents = fs.readdirSync('/var');
          }
        } catch (err) {
          varError = err.message;
        }

        return {
          isRender: process.env.RENDER === 'true',
          hasRenderEnv: !!process.env.RENDER,
          renderValue: process.env.RENDER,
          renderServiceName: process.env.RENDER_SERVICE_NAME || 'not set',
          uploadFolder: process.env.UPLOAD_FOLDER || 'not set',
          extractedFolder: process.env.EXTRACTED_FOLDER || 'not set',
          processedFolder: process.env.PROCESSED_FOLDER || 'not set',

          // /var/data checks
          varDataExists,
          varDataIsDir: varDataStats ? varDataStats.isDirectory() : false,
          varDataPermissions: varDataStats ? varDataStats.mode.toString(8) : null,
          varDataError,

          // /var directory listing
          varExists: fs.existsSync('/var'),
          varContents,
          varError,

          // Active paths being used
          activePaths: {
            upload: EXTRACTOR_CONFIG.uploadFolder,
            extracted: EXTRACTOR_CONFIG.extractedFolder,
            processed: EXTRACTOR_CONFIG.processedFolder
          }
        };
      })(),

      // Timestamp
      timestamp: new Date().toISOString()
    };

    res.json(systemInfo);
  } catch (error) {
    console.error('Erro no health check:', error);
    res.status(500).json({ error: error.message });
  }
});

// API - Estatísticas de uso do sistema
app.get('/api/stats', (req, res) => {
  try {
    // Obter estatísticas de conversas
    const allConversations = conversationsManager.loadConversations();
    const conversationsArray = Object.values(allConversations);

    const totalConversations = conversationsArray.length;
    const totalMessages = conversationsArray.reduce((sum, conv) => sum + (conv.messageCount || 0), 0);

    // Estatísticas de cache
    const cacheHitRate = 0; // Placeholder - implementar se necessário

    // Estatísticas de agentes
    const activeAgents = agents.size;

    // Estatísticas de KB (placeholder)
    const totalDocuments = 0; // Placeholder - implementar se necessário

    // Tempo médio de resposta (placeholder)
    const averageResponseTime = 3.0; // Placeholder baseado em testes

    const stats = {
      success: true,
      conversations: {
        total: totalConversations,
        totalMessages: totalMessages
      },
      cache: {
        activeSessions: activeAgents,
        hitRate: cacheHitRate
      },
      kb: {
        totalDocuments: totalDocuments
      },
      performance: {
        averageResponseTime: averageResponseTime,
        unit: 'seconds'
      },
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE AUTENTICAÇÃO JWT
// ====================================================================

// Login com JWT
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const result = await authSystem.login(email, password);

    // Salvar info na sessão também (para compatibilidade)
    req.session.authenticated = true;
    req.session.userId = result.user.id;
    req.session.username = result.user.name;
    req.session.partnerId = result.user.partnerId;
    req.session.userRole = result.user.role;

    res.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(401).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      authSystem.logout(token);
    }

    req.session.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.json({ success: true }); // Sempre retornar sucesso no logout
  }
});

// Refresh token
app.post('/api/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token é obrigatório' });
    }

    const result = authSystem.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });
  } catch (error) {
    console.error('Erro ao refresh token:', error);
    res.status(401).json({ error: error.message });
  }
});

// Registrar novo usuário (requer autenticação)
app.post('/api/auth/register', authSystem.authMiddleware(), (req, res) => {
  try {
    const userData = req.body;
    const newUser = authSystem.registerUser(userData);

    res.json({
      success: true,
      user: newUser
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(400).json({ error: error.message });
  }
});

// Status de autenticação
app.get('/api/auth/status', (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = authSystem.verifyToken(token);

      return res.json({
        authenticated: true,
        user: {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          partnerId: decoded.partnerId
        }
      });
    }

    // Fallback para sessão antiga (compatibilidade)
    res.json({
      authenticated: !!req.session.authenticated,
      username: req.session.username || null,
      partnerId: req.session.partnerId || 'rom'
    });
  } catch (error) {
    res.json({
      authenticated: false
    });
  }
});

// ====================================================================
// ROTAS DE API PARA PARCEIROS E BRANDING
// ====================================================================

// Obter branding do parceiro atual
app.get('/api/branding', (req, res) => {
  try {
    const partnerId = req.session.partnerId || req.query.partnerId || 'rom';
    const branding = partnersBranding.getBranding(partnerId);
    res.json(branding);
  } catch (error) {
    console.error('Erro ao obter branding:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar todos os parceiros (admin)
app.get('/api/partners', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const partners = partnersBranding.listPartners();
    res.json({ partners });
  } catch (error) {
    console.error('Erro ao listar parceiros:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cadastrar novo parceiro (admin)
app.post('/api/partners', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const partnerData = req.body;
    const newPartner = partnersBranding.registerPartner(partnerData);
    res.json({ success: true, partner: newPartner });
  } catch (error) {
    console.error('Erro ao cadastrar parceiro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar parceiro (admin)
app.put('/api/partners/:partnerId', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const { partnerId } = req.params;
    const updates = req.body;
    const updatedPartner = partnersBranding.updatePartner(partnerId, updates);
    res.json({ success: true, partner: updatedPartner });
  } catch (error) {
    console.error('Erro ao atualizar parceiro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar parceiro (admin)
app.delete('/api/partners/:partnerId', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const { partnerId } = req.params;
    partnersBranding.deletePartner(partnerId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar parceiro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload de logo do parceiro
app.post('/api/partners/:partnerId/logo', uploadLogo.single('logo'), (req, res) => {
  try {
    // TODO: Adicionar verificação de admin ou do próprio parceiro
    const { partnerId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const logoUrl = `/img/partners/${req.file.filename}`;
    const updatedPartner = partnersBranding.updatePartnerLogo(partnerId, logoUrl);

    res.json({
      success: true,
      partner: updatedPartner,
      logoUrl: logoUrl
    });
  } catch (error) {
    console.error('Erro no upload de logo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload de timbrado (letterhead) do parceiro
app.post('/api/partners/:partnerId/letterhead', uploadLetterhead.single('letterhead'), (req, res) => {
  try {
    // TODO: Adicionar verificação de admin ou do próprio parceiro
    const { partnerId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const letterheadUrl = `/img/partners/${req.file.filename}`;
    const updatedPartner = partnersBranding.updatePartnerLetterhead(partnerId, letterheadUrl);

    res.json({
      success: true,
      partner: updatedPartner,
      letterheadUrl: letterheadUrl
    });
  } catch (error) {
    console.error('Erro no upload de timbrado:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET letterhead do parceiro
app.get('/api/partners/:partnerId/letterhead', (req, res) => {
  try {
    const { partnerId } = req.params;
    const partner = partnersBranding.getBranding(partnerId);

    if (!partner) {
      return res.status(404).json({ error: 'Parceiro não encontrado' });
    }

    res.json({
      success: true,
      letterhead: partner.letterhead || '/img/timbrado_rom.png' // Fallback para timbrado ROM padrão
    });
  } catch (error) {
    console.error('Erro ao obter timbrado:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA GERENCIAMENTO DE USUÁRIOS DA EQUIPE ROM
// ====================================================================

// Criar novo usuário (admin/developer only)
app.post('/api/users', async (req, res) => {
  try {
    // TODO: Adicionar verificação de autenticação (admin/developer only)
    const newUser = await usersManager.createUser(req.body);

    console.log(`✅ Usuário criado: ${newUser.name} (${newUser.email}) - Role: ${newUser.role}`);

    res.json({
      success: true,
      user: newUser,
      message: 'Usuário criado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    res.status(400).json({ error: error.message });
  }
});

// Listar usuários
app.get('/api/users', (req, res) => {
  try {
    // TODO: Adicionar verificação de autenticação
    const includeInactive = req.query.includeInactive === 'true';
    const users = usersManager.listUsers(includeInactive);

    res.json({
      success: true,
      users,
      total: users.length
    });
  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter usuário por ID
app.get('/api/users/:userId', (req, res) => {
  try {
    // TODO: Adicionar verificação de autenticação
    const { userId } = req.params;
    const user = usersManager.getUserById(userId);

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('❌ Erro ao obter usuário:', error);

    if (error.message === 'Usuário não encontrado') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Atualizar usuário
app.put('/api/users/:userId', async (req, res) => {
  try {
    // TODO: Adicionar verificação de autenticação (admin/developer only)
    const { userId } = req.params;
    const updates = req.body;

    const updatedUser = await usersManager.updateUser(userId, updates);

    console.log(`✅ Usuário atualizado: ${updatedUser.name} (${updatedUser.email})`);

    res.json({
      success: true,
      user: updatedUser,
      message: 'Usuário atualizado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error);

    if (error.message === 'Usuário não encontrado') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

// Desativar usuário (soft delete)
app.delete('/api/users/:userId', (req, res) => {
  try {
    // TODO: Adicionar verificação de autenticação (admin/developer only)
    const { userId } = req.params;

    usersManager.deactivateUser(userId);

    console.log(`⚠️ Usuário desativado: ${userId}`);

    res.json({
      success: true,
      message: 'Usuário desativado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao desativar usuário:', error);

    if (error.message === 'Usuário não encontrado') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Reativar usuário
app.post('/api/users/:userId/reactivate', (req, res) => {
  try {
    // TODO: Adicionar verificação de autenticação (admin/developer only)
    const { userId } = req.params;

    usersManager.reactivateUser(userId);

    console.log(`✅ Usuário reativado: ${userId}`);

    res.json({
      success: true,
      message: 'Usuário reativado com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao reativar usuário:', error);

    if (error.message === 'Usuário não encontrado') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Deletar usuário permanentemente (admin only)
app.delete('/api/users/:userId/hard-delete', (req, res) => {
  try {
    // TODO: Adicionar verificação de autenticação (admin only)
    const { userId } = req.params;

    usersManager.deleteUser(userId);

    console.log(`🗑️ Usuário deletado permanentemente: ${userId}`);

    res.json({
      success: true,
      message: 'Usuário deletado permanentemente'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar usuário:', error);

    if (error.message === 'Usuário não encontrado') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Obter estatísticas de usuários
app.get('/api/users-statistics', (req, res) => {
  try {
    // TODO: Adicionar verificação de autenticação (admin/developer/manager)
    const stats = usersManager.getStatistics();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA TEMPLATES DE FORMATAÇÃO
// ====================================================================

// Listar presets de formatação disponíveis
app.get('/api/formatting/presets', (req, res) => {
  try {
    const presets = formattingTemplates.listPresets();
    res.json({ presets });
  } catch (error) {
    console.error('Erro ao listar presets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter detalhes de um preset específico
app.get('/api/formatting/presets/:presetId', (req, res) => {
  try {
    const { presetId } = req.params;
    const preset = formattingTemplates.getPreset(presetId);

    if (!preset) {
      return res.status(404).json({ error: 'Preset não encontrado' });
    }

    res.json({ preset });
  } catch (error) {
    console.error('Erro ao obter preset:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter template de formatação de um parceiro
app.get('/api/formatting/template/:partnerId?', (req, res) => {
  try {
    const partnerId = req.params.partnerId || req.session.partnerId || 'rom';
    const template = formattingTemplates.getTemplate(partnerId);
    res.json({ template });
  } catch (error) {
    console.error('Erro ao obter template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configurar template de um parceiro (selecionar preset + customizações)
// Middleware customizado: master_admin pode editar qualquer parceiro, admin só o seu
app.put('/api/formatting/template/:partnerId', authSystem.authMiddleware(), (req, res) => {
  try {
    const { partnerId } = req.params;
    const { templateId, customizations } = req.body;
    const user = req.user;

    // Verificar permissões: master_admin pode tudo, admin só o próprio parceiro
    if (user.role !== 'master_admin' && user.partnerId !== partnerId) {
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Você só pode editar a formatação do seu próprio escritório'
      });
    }

    if (!templateId) {
      return res.status(400).json({ error: 'templateId é obrigatório' });
    }

    const updatedTemplate = formattingTemplates.setPartnerTemplate(
      partnerId,
      templateId,
      customizations || {}
    );

    res.json({
      success: true,
      template: updatedTemplate,
      message: `Template atualizado para ${partnerId}`
    });
  } catch (error) {
    console.error('Erro ao configurar template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar apenas customizações de um parceiro
app.patch('/api/formatting/template/:partnerId', authSystem.authMiddleware(), (req, res) => {
  try {
    const { partnerId } = req.params;
    const { customizations } = req.body;
    const user = req.user;

    // Verificar permissões: master_admin pode tudo, admin só o próprio parceiro
    if (user.role !== 'master_admin' && user.partnerId !== partnerId) {
      return res.status(403).json({
        error: 'Acesso negado',
        message: 'Você só pode editar a formatação do seu próprio escritório'
      });
    }

    if (!customizations) {
      return res.status(400).json({ error: 'customizations é obrigatório' });
    }

    const updatedTemplate = formattingTemplates.updateCustomizations(partnerId, customizations);

    res.json({
      success: true,
      template: updatedTemplate
    });
  } catch (error) {
    console.error('Erro ao atualizar customizações:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resetar template de um parceiro para o padrão
app.delete('/api/formatting/template/:partnerId', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin ou do próprio parceiro
    const { partnerId } = req.params;
    const resetTemplate = formattingTemplates.resetTemplate(partnerId);

    res.json({
      success: true,
      template: resetTemplate
    });
  } catch (error) {
    console.error('Erro ao resetar template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter configuração DOCX para um parceiro
app.get('/api/formatting/docx-config/:partnerId?', (req, res) => {
  try {
    const partnerId = req.params.partnerId || req.session.partnerId || 'rom';
    const docxConfig = formattingTemplates.toDocxConfig(partnerId);
    res.json({ config: docxConfig });
  } catch (error) {
    console.error('Erro ao gerar config DOCX:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter CSS para um parceiro (para preview/web)
app.get('/api/formatting/css/:partnerId?', (req, res) => {
  try {
    const partnerId = req.params.partnerId || req.session.partnerId || 'rom';
    const css = formattingTemplates.toCSS(partnerId);
    res.setHeader('Content-Type', 'text/css');
    res.send(css);
  } catch (error) {
    console.error('Erro ao gerar CSS:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA DASHBOARD
// ====================================================================

// Helper para ler arquivos JSON de logs
function readLogFile(filename) {
  try {
    const logsDir = path.join(__dirname, '../logs');
    const filePath = path.join(logsDir, filename);

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
      return [];
    }

    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao ler ${filename}:`, error);
    return [];
  }
}

// Helper para escrever arquivos JSON de logs
function writeLogFile(filename, data) {
  try {
    const logsDir = path.join(__dirname, '../logs');
    const filePath = path.join(logsDir, filename);

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Erro ao escrever ${filename}:`, error);
    return false;
  }
}

// Dashboard - Listar usuários
app.get('/api/dashboard/users', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const users = readLogFile('users.json');
    res.json({ users });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard - Obter dados de uso
app.get('/api/dashboard/usage', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const usage = readLogFile('usage.json');
    res.json({ usage });
  } catch (error) {
    console.error('Erro ao obter dados de uso:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard - Obter histórico de peças
app.get('/api/dashboard/pieces', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const pieces = readLogFile('pieces_history.json');
    res.json({ pieces });
  } catch (error) {
    console.error('Erro ao obter histórico de peças:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard - Obter analytics
app.get('/api/dashboard/analytics', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const analytics = readLogFile('analytics.json');
    res.json({ analytics });
  } catch (error) {
    console.error('Erro ao obter analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard - Obter dados de qualidade
app.get('/api/dashboard/quality', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const quality = readLogFile('quality.json');
    res.json({ quality });
  } catch (error) {
    console.error('Erro ao obter dados de qualidade:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard - Obter dados de billing
app.get('/api/dashboard/billing', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const billing = readLogFile('billing.json');
    res.json({ billing });
  } catch (error) {
    console.error('Erro ao obter billing:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA PROMPTS E CUSTOM INSTRUCTIONS
// ====================================================================

// Listar todos os prompts do sistema
app.get('/api/prompts/system', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const promptsDir = path.join(__dirname, '../config/system_prompts');

    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
    }

    const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
    const prompts = files.map(file => {
      const content = fs.readFileSync(path.join(promptsDir, file), 'utf8');
      return {
        id: file,
        name: file.replace(/\.(txt|md)$/, ''),
        content,
        filename: file
      };
    });

    res.json({ prompts });
  } catch (error) {
    console.error('Erro ao listar prompts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter um prompt específico
app.get('/api/prompts/system/:promptId', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const { promptId } = req.params;
    const promptsDir = path.join(__dirname, '../config/system_prompts');
    const filePath = path.join(promptsDir, promptId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Prompt não encontrado' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.json({
      id: promptId,
      name: promptId.replace(/\.(txt|md)$/, ''),
      content,
      filename: promptId
    });
  } catch (error) {
    console.error('Erro ao obter prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar um prompt
app.put('/api/prompts/system/:promptId', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const { promptId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const promptsDir = path.join(__dirname, '../config/system_prompts');

    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
    }

    const filePath = path.join(promptsDir, promptId);
    fs.writeFileSync(filePath, content, 'utf8');

    res.json({
      success: true,
      prompt: {
        id: promptId,
        name: promptId.replace(/\.(txt|md)$/, ''),
        content,
        filename: promptId
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Criar novo prompt
app.post('/api/prompts/system', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const { name, content } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios' });
    }

    const filename = name.endsWith('.txt') || name.endsWith('.md') ? name : `${name}.txt`;
    const promptsDir = path.join(__dirname, '../config/system_prompts');

    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
    }

    const filePath = path.join(promptsDir, filename);

    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: 'Prompt com esse nome já existe' });
    }

    fs.writeFileSync(filePath, content, 'utf8');

    res.json({
      success: true,
      prompt: {
        id: filename,
        name: filename.replace(/\.(txt|md)$/, ''),
        content,
        filename
      }
    });
  } catch (error) {
    console.error('Erro ao criar prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar um prompt
app.delete('/api/prompts/system/:promptId', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin
    const { promptId } = req.params;
    const promptsDir = path.join(__dirname, '../config/system_prompts');
    const filePath = path.join(promptsDir, promptId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Prompt não encontrado' });
    }

    fs.unlinkSync(filePath);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar prompt:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA GERENCIAMENTO MULTI-TENANT DE PROMPTS
// ====================================================================

// Helper para obter user info da sessão (mock - implementar auth real)
function getUserInfo(req) {
  // TODO: Implementar autenticação real
  // Por enquanto, usar dados da sessão ou query params para testes
  return {
    userId: req.session.userId || req.query.userId || 'user-001',
    partnerId: req.session.partnerId || req.query.partnerId || 'rom',
    role: req.session.userRole || req.query.role || 'master_admin' // master_admin, partner_admin, user
  };
}

// Listar todos os prompts disponíveis (global + partner-specific)
app.get('/api/v2/prompts', (req, res) => {
  try {
    const { partnerId, role } = getUserInfo(req);
    const prompts = promptsManager.listarPrompts(partnerId, role);
    res.json(prompts);
  } catch (error) {
    console.error('Erro ao listar prompts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter um prompt específico (com prioridade partner > global)
app.get('/api/v2/prompts/:promptId', (req, res) => {
  try {
    const { promptId } = req.params;
    const { partnerId } = getUserInfo(req);
    const prompt = promptsManager.obterPrompt(promptId, partnerId);
    res.json(prompt);
  } catch (error) {
    console.error('Erro ao obter prompt:', error);
    if (error.message.includes('não encontrado')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Salvar/atualizar prompt (global ou partner-specific conforme permissões)
app.put('/api/v2/prompts/:promptId', (req, res) => {
  try {
    const { promptId } = req.params;
    const { content, type } = req.body; // type: 'global' ou 'partner'
    const { partnerId, role } = getUserInfo(req);

    const targetPartnerId = type === 'global' ? null : partnerId;
    const result = promptsManager.salvarPrompt(promptId, content, targetPartnerId, role);

    res.json(result);
  } catch (error) {
    console.error('Erro ao salvar prompt:', error);
    if (error.message.includes('permiss') || error.message.includes('apenas')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Criar override de um prompt global para o parceiro
app.post('/api/v2/prompts/:promptId/override', (req, res) => {
  try {
    const { promptId } = req.params;
    const { partnerId, role } = getUserInfo(req);

    const result = promptsManager.criarOverride(promptId, partnerId, role);
    res.json(result);
  } catch (error) {
    console.error('Erro ao criar override:', error);
    if (error.message.includes('permiss') || error.message.includes('apenas')) {
      res.status(403).json({ error: error.message });
    } else if (error.message.includes('não encontrado')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Remover override e voltar a usar prompt global
app.delete('/api/v2/prompts/:promptId/override', (req, res) => {
  try {
    const { promptId } = req.params;
    const { partnerId, role } = getUserInfo(req);

    const result = promptsManager.removerOverride(promptId, partnerId, role);
    res.json(result);
  } catch (error) {
    console.error('Erro ao remover override:', error);
    if (error.message.includes('permiss') || error.message.includes('apenas')) {
      res.status(403).json({ error: error.message });
    } else if (error.message.includes('não encontrado')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Obter estatísticas de prompts do parceiro
app.get('/api/v2/prompts-stats', (req, res) => {
  try {
    const { partnerId } = getUserInfo(req);
    const stats = promptsManager.obterEstatisticas(partnerId);
    res.json(stats);
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA VERSIONAMENTO E NOTIFICAÇÕES
// ====================================================================

// Obter notificações de atualizações de prompts globais
app.get('/api/v2/prompts/notifications', (req, res) => {
  try {
    const { partnerId } = getUserInfo(req);
    const onlyUnread = req.query.unread === 'true';
    const notifications = promptsVersioning.obterNotificacoesParceiro(partnerId, onlyUnread);
    res.json({ notifications });
  } catch (error) {
    console.error('Erro ao obter notificações:', error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar notificação como lida
app.put('/api/v2/prompts/notifications/:notificationId/read', (req, res) => {
  try {
    const { notificationId } = req.params;
    const result = promptsVersioning.marcarComoLida(notificationId);
    res.json(result);
  } catch (error) {
    console.error('Erro ao marcar notificação:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sincronizar override com versão global
app.post('/api/v2/prompts/:promptId/sync', (req, res) => {
  try {
    const { promptId } = req.params;
    const { partnerId } = getUserInfo(req);
    const result = promptsVersioning.sincronizarComGlobal(promptId, partnerId);
    res.json(result);
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    if (error.message.includes('não encontrado')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Comparar override com versão global
app.get('/api/v2/prompts/:promptId/compare', (req, res) => {
  try {
    const { promptId } = req.params;
    const { partnerId } = getUserInfo(req);
    const comparison = promptsVersioning.compararComGlobal(promptId, partnerId);
    res.json(comparison);
  } catch (error) {
    console.error('Erro ao comparar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter changelog de um prompt
app.get('/api/v2/prompts/:promptId/changelog', (req, res) => {
  try {
    const { promptId } = req.params;
    const changelog = promptsVersioning.obterChangelog(promptId);
    res.json(changelog);
  } catch (error) {
    console.error('Erro ao obter changelog:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA UPLOAD SYNC E KB MANAGEMENT
// ====================================================================

// Obter estatísticas do Upload Sync
app.get('/api/upload/stats', (req, res) => {
  try {
    if (!uploadSync) {
      return res.status(503).json({ error: 'Upload Sync não inicializado' });
    }

    const stats = uploadSync.getStatistics();
    res.json({ stats });
  } catch (error) {
    console.error('Erro ao obter estatísticas do upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Buscar documentos no KB
app.get('/api/kb/search', (req, res) => {
  try {
    if (!uploadSync) {
      return res.status(503).json({ error: 'Upload Sync não inicializado' });
    }

    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query é obrigatória' });
    }

    const results = uploadSync.search(query);
    res.json({ results, total: results.length });
  } catch (error) {
    console.error('Erro ao buscar no KB:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA KB CLEANER
// ====================================================================

// Aprovar peça e limpar arquivos usados
app.post('/api/kb/approve-and-clean', authSystem.authMiddleware(), (req, res) => {
  try {
    const pieceData = req.body;

    // Adicionar info do usuário
    pieceData.approvedBy = req.user.userId;
    pieceData.approvedAt = new Date().toISOString();

    const result = kbCleaner.approveAndCleanup(pieceData);

    res.json({
      success: true,
      cleanup: result
    });
  } catch (error) {
    console.error('Erro ao aprovar e limpar:', error);
    res.status(500).json({ error: error.message });
  }
});

// REMOVIDO: Rota antiga de deleção de KB (substituída pela rota BACKSPEC BETA linha ~3990)

// Limpar arquivos órfãos
app.post('/api/kb/clean-orphans', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const result = kbCleaner.cleanOrphanedFiles();

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Erro ao limpar órfãos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Limpar documentos antigos
app.post('/api/kb/clean-old', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    const result = kbCleaner.cleanOldDocuments(daysOld);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Erro ao limpar documentos antigos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter peças aprovadas
app.get('/api/kb/approved-pieces', authSystem.authMiddleware(), (req, res) => {
  try {
    const filters = req.query;
    const pieces = kbCleaner.getApprovedPieces(filters);

    res.json({
      pieces,
      total: pieces.length
    });
  } catch (error) {
    console.error('Erro ao obter peças aprovadas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter estatísticas do KB (sem auth - manter compatibilidade)
app.get('/api/kb/statistics', (req, res) => {
  try {
    const stats = kbCleaner.getStatistics();
    res.json({ stats });
  } catch (error) {
    console.error('Erro ao obter estatísticas do KB:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter status geral do Knowledge Base
app.get('/api/kb/status', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const kbPath = path.join(__dirname, '../KB');

    // Verificar se diretório KB existe
    if (!fs.existsSync(kbPath)) {
      return res.json({
        success: true,
        status: 'empty',
        totalDocuments: 0,
        totalSize: 0,
        lastUpdate: null,
        message: 'Knowledge Base vazio - aguardando documentos'
      });
    }

    // Contar documentos e tamanho total
    const files = fs.readdirSync(kbPath);
    const documents = files.filter(f => !f.startsWith('.'));

    let totalSize = 0;
    let lastUpdate = null;

    documents.forEach(file => {
      const filePath = path.join(kbPath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;

      if (!lastUpdate || stats.mtime > lastUpdate) {
        lastUpdate = stats.mtime;
      }
    });

    res.json({
      success: true,
      status: documents.length > 0 ? 'active' : 'empty',
      totalDocuments: documents.length,
      totalSize: totalSize,
      totalSizeFormatted: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
      kbPath: kbPath
    });
  } catch (error) {
    console.error('Erro ao obter status do KB:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA KNOWLEDGE BASE (KB) COM AUTENTICAÇÃO
// ====================================================================

// Upload de documentos para o KB (requer autenticação)
app.post('/api/kb/upload', authSystem.authMiddleware(), upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const userId = req.user.userId;
    const userName = req.user.name || 'Unknown';
    const uploadedDocs = [];

    // Processar cada arquivo COM DOCUMENTOS ESTRUTURADOS
    for (const file of req.files) {
      try {
        console.log(`📤 KB Upload: ${file.originalname} por ${userName}`);
        console.log(`🔍 Processando com 33 ferramentas + documentos estruturados...`);

        // 🚀 USAR processFile() PARA GERAR DOCUMENTOS ESTRUTURADOS
        const processResult = await processFile(file.path);

        if (!processResult.success) {
          throw new Error(processResult.error || 'Falha na extração');
        }

        // Copiar arquivo extraído para KB
        const extractedTextPath = path.join(EXTRACTOR_CONFIG.extractedFolder, processResult.extracted);
        const extractedText = await fs.promises.readFile(extractedTextPath, 'utf8');

        const baseFilename = file.originalname.replace(/\.txt$/i, '');
        const kbPath = path.join(ACTIVE_PATHS.kb, 'documents', `${Date.now()}_${baseFilename}.txt`);

        await fs.promises.mkdir(path.dirname(kbPath), { recursive: true });
        await fs.promises.copyFile(extractedTextPath, kbPath);

        console.log(`   💾 KB: Copiado ${path.basename(kbPath)}`);

        // 🚀 COPIAR OS 7 DOCUMENTOS ESTRUTURADOS
        const structuredDocs = [];
        if (processResult.structuredDocuments?.outputPath) {
          try {
            const structuredFiles = await fs.promises.readdir(processResult.structuredDocuments.outputPath);

            for (const structFile of structuredFiles) {
              const sourcePath = path.join(processResult.structuredDocuments.outputPath, structFile);
              const timestamp = Date.now();
              const destPath = path.join(ACTIVE_PATHS.kb, 'documents', `${timestamp}_${baseFilename}_${structFile}`);

              await fs.promises.copyFile(sourcePath, destPath);
              structuredDocs.push({
                name: structFile,
                path: destPath,
                type: path.extname(structFile)
              });

              console.log(`   📄 KB: ${structFile}`);
            }

            console.log(`   ✅ ${structuredDocs.length} documentos estruturados copiados`);
          } catch (error) {
            console.warn(`   ⚠️ Erro ao copiar docs estruturados: ${error.message}`);
          }
        }

        // Criar documento KB principal
        const doc = {
          id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
          path: kbPath,
          userId: userId,
          userName: userName,
          uploadedAt: new Date().toISOString(),
          extractedText: extractedText,
          textLength: processResult.extraction?.charCount || 0,
          metadata: {
            toolsUsed: processResult.toolsUsed || [],
            structuredDocuments: processResult.structuredDocuments?.filesGenerated || 0,
            structuredDocsPath: processResult.structuredDocuments?.outputPath,
            wordCount: processResult.extraction?.wordCount || 0,
            structuredDocsInKB: structuredDocs
          }
        };

        // Salvar no kb-documents.json
        const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');
        let kbDocs = [];

        if (fs.existsSync(kbDocsPath)) {
          const data = fs.readFileSync(kbDocsPath, 'utf8');
          kbDocs = JSON.parse(data);
        }

        kbDocs.push(doc);

        // 📄 ADICIONAR OS 7 DOCUMENTOS ESTRUTURADOS AO REGISTRO
        for (const structDoc of structuredDocs) {
          const structContent = await fs.promises.readFile(structDoc.path, 'utf8');

          kbDocs.push({
            id: `kb-struct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `${file.originalname} - ${structDoc.name}`,
            type: structDoc.type === '.md' ? 'text/markdown' : 'application/json',
            size: structContent.length,
            path: structDoc.path,
            userId: userId,
            userName: userName,
            uploadedAt: new Date().toISOString(),
            extractedText: structContent,
            textLength: structContent.length,
            metadata: {
              isStructuredDocument: true,
              parentDocument: file.originalname,
              documentType: structDoc.name.split('_')[1]?.replace('.md', '').replace('.json', ''),
              structuredType: structDoc.name
            }
          });
        }

        fs.writeFileSync(kbDocsPath, JSON.stringify(kbDocs, null, 2));

        uploadedDocs.push({
          id: doc.id,
          name: doc.name,
          size: doc.size,
          uploadedAt: doc.uploadedAt,
          structuredDocs: structuredDocs.length,
          status: 'success'
        });

        console.log(`✅ KB: ${file.originalname} + ${structuredDocs.length} docs estruturados salvos`);
      } catch (fileError) {
        console.error(`❌ Erro ao processar ${file.originalname}:`, fileError);
        uploadedDocs.push({
          name: file.originalname,
          status: 'error',
          error: fileError.message
        });
      }
    }

    res.json({
      success: true,
      message: `${uploadedDocs.length} documento(s) processado(s)`,
      documents: uploadedDocs
    });
  } catch (error) {
    console.error('❌ Erro no upload KB:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar documentos do KB do usuário (requer autenticação)
app.get('/api/kb/documents', authSystem.authMiddleware(), (req, res) => {
  try {
    const userId = req.user.userId;
    const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');

    if (!fs.existsSync(kbDocsPath)) {
      return res.json({ documents: [] });
    }

    const data = fs.readFileSync(kbDocsPath, 'utf8');
    const allDocs = JSON.parse(data);

    // Filtrar apenas documentos do usuário atual
    const userDocs = allDocs.filter(doc => doc.userId === userId);

    // Retornar documentos formatados
    const documents = userDocs.map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
      textLength: doc.textLength,
      metadata: doc.metadata
    }));

    res.json({ documents });
  } catch (error) {
    console.error('❌ Erro ao listar documentos KB:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download de documento do KB (requer autenticação e ownership)
app.get('/api/kb/documents/:id/download', authSystem.authMiddleware(), (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');

    if (!fs.existsSync(kbDocsPath)) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    const data = fs.readFileSync(kbDocsPath, 'utf8');
    const allDocs = JSON.parse(data);
    const doc = allDocs.find(d => d.id === id);

    if (!doc) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    // Verificar ownership
    if (doc.userId !== userId && req.user.role !== 'master_admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Verificar se arquivo existe
    if (!fs.existsSync(doc.path)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    // Enviar arquivo
    res.download(doc.path, doc.name);
  } catch (error) {
    console.error('❌ Erro ao baixar documento KB:', error);
    res.status(500).json({ error: error.message });
  }
});

// REMOVIDO: Rota antiga de deleção de KB com auth (substituída pela rota BACKSPEC BETA linha ~3990)

// 📚 Novo endpoint: Listar documentos REAIS extraídos em KB/documents/
app.get('/api/kb/extracted-documents', async (req, res) => {
  try {
    // Garantir que ACTIVE_PATHS.kb existe
    if (!ACTIVE_PATHS.kb) {
      console.error('❌ ACTIVE_PATHS.kb não está definido');
      return res.json({ success: true, documents: [], count: 0 });
    }

    const kbDocsPath = path.join(ACTIVE_PATHS.kb, 'documents');

    // Verificar se pasta existe
    if (!fs.existsSync(kbDocsPath)) {
      return res.json({ success: true, documents: [], count: 0 });
    }

    // Ler todos os arquivos da pasta
    const files = await fs.promises.readdir(kbDocsPath);
    const txtFiles = files.filter(f => f.endsWith('.txt'));

    // Ler cada documento e seus metadados
    const documents = await Promise.all(txtFiles.map(async (file) => {
      const filePath = path.join(kbDocsPath, file);
      const metadataPath = filePath.replace('.txt', '.metadata.json');

      try {
        const stats = await fs.promises.stat(filePath);
        const content = await fs.promises.readFile(filePath, 'utf8');

        let metadata = {};
        if (fs.existsSync(metadataPath)) {
          const metaContent = await fs.promises.readFile(metadataPath, 'utf8');
          metadata = JSON.parse(metaContent);
        }

        return {
          id: file.replace('.txt', ''),
          filename: file,
          originalFilename: metadata.originalFilename || file,
          uploadedAt: metadata.uploadedAt || stats.birthtime,
          extractedAt: metadata.extractedAt,
          type: metadata.type || 'Documento',
          processNumber: metadata.processNumber,
          parties: metadata.parties,
          court: metadata.court,
          textLength: metadata.textLength || content.length,
          toolsUsed: metadata.toolsUsed || [],
          source: metadata.source || 'unknown',
          size: stats.size,
          preview: content.substring(0, 200) + '...'
        };
      } catch (error) {
        console.error(`Erro ao ler documento ${file}:`, error);
        return null;
      }
    }));

    // Filtrar nulls e ordenar por data
    const validDocs = documents
      .filter(doc => doc !== null)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({
      success: true,
      documents: validDocs,
      count: validDocs.length,
      totalSize: validDocs.reduce((sum, doc) => sum + doc.size, 0)
    });

  } catch (error) {
    console.error('❌ Erro ao listar documentos extraídos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📄 Endpoint para baixar documento extraído específico
app.get('/api/kb/extracted-documents/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(ACTIVE_PATHS.kb, 'documents', `${id}.txt`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    // Ler metadados para nome original
    const metadataPath = filePath.replace('.txt', '.metadata.json');
    let originalName = id + '.txt';

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
      originalName = metadata.originalFilename || originalName;
    }

    res.download(filePath, originalName);
  } catch (error) {
    console.error('❌ Erro ao baixar documento:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🗑️ Endpoint para deletar documento extraído (simples - apenas .txt e .metadata.json)
app.delete('/api/kb/extracted-documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = path.join(ACTIVE_PATHS.kb, 'documents', `${id}.txt`);
    const metadataPath = filePath.replace('.txt', '.metadata.json');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    // Deletar arquivo de texto
    await fs.promises.unlink(filePath);

    // Deletar metadados se existir
    if (fs.existsSync(metadataPath)) {
      await fs.promises.unlink(metadataPath);
    }

    res.json({ success: true, message: 'Documento deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar documento:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// 🗄️ KB MANAGEMENT APIs (BACKSPEC BETA - ETAPA 1)
// ===========================================

/**
 * DELETE /api/kb/documents/:id
 * Deletar documento do KB com limpeza completa (usa kb-cleaner.cjs)
 * Deleta documento do sistema antigo (KB/) e também de data/kb-documents.json
 */
app.delete('/api/kb/documents/:id', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`🗑️ Iniciando deleção completa do documento: ${id}`);

    const KBCleaner = require('../lib/kb-cleaner.cjs');
    const cleaner = new KBCleaner();

    // Tentar remover do sistema antigo (KB/)
    const cleanerResult = cleaner.removeDocument(id);

    // Também remover de data/kb-documents.json (sistema novo)
    const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
    let removedFromNew = false;

    if (fs.existsSync(kbDocsPath)) {
      const kbDocs = JSON.parse(await fs.promises.readFile(kbDocsPath, 'utf8'));
      const originalLength = kbDocs.length;
      const filtered = kbDocs.filter(doc => doc.id !== id);

      if (filtered.length < originalLength) {
        await fs.promises.writeFile(kbDocsPath, JSON.stringify(filtered, null, 2));
        removedFromNew = true;
        logger.info(`✅ Documento ${id} removido de kb-documents.json`);
      }
    }

    // Também remover de KB/documents/ (sistema de extração)
    const extractedPath = path.join(ACTIVE_PATHS.kb, 'documents', `${id}.txt`);
    const extractedMetadata = extractedPath.replace('.txt', '.metadata.json');
    let removedExtracted = false;

    if (fs.existsSync(extractedPath)) {
      await fs.promises.unlink(extractedPath);
      if (fs.existsSync(extractedMetadata)) {
        await fs.promises.unlink(extractedMetadata);
      }
      removedExtracted = true;
      logger.info(`✅ Documento ${id} removido de KB/documents/`);
    }

    // Verificar se removeu de algum lugar
    if (!cleanerResult.success && !removedFromNew && !removedExtracted) {
      logger.warn(`⚠️ Documento ${id} não encontrado em nenhum sistema`);
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado'
      });
    }

    const result = {
      success: true,
      message: `Documento ${id} deletado com sucesso`,
      details: {
        removedFromKBCleaner: cleanerResult.success,
        removedFromKBDocuments: removedFromNew,
        removedFromExtracted: removedExtracted,
        filesDeleted: cleanerResult.filesDeleted || (removedExtracted ? 2 : 0),
        spaceSaved: cleaner.formatBytes(cleanerResult.spaceSaved || 0)
      }
    };

    logger.info(`✅ Deleção completa concluída:`, result.details);
    res.json(result);

  } catch (error) {
    logger.error('❌ Erro ao deletar documento do KB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/kb/reindex
 * Reindexar Knowledge Base completo
 * Reconstrói índices de KB/ e valida data/kb-documents.json
 */
app.post('/api/kb/reindex', generalLimiter, async (req, res) => {
  try {
    const startTime = Date.now();
    logger.info('🔄 Iniciando reindexação completa do Knowledge Base');

    const stats = {
      oldSystemReindexed: false,
      newSystemValidated: false,
      documentsFound: 0,
      documentsIndexed: 0,
      orphansRemoved: 0,
      errors: [],
      duration: 0
    };

    // 1. Reindexar sistema antigo (KB/)
    const KBCleaner = require('../lib/kb-cleaner.cjs');
    const cleaner = new KBCleaner();

    try {
      // Limpar órfãos primeiro
      const orphanResult = cleaner.cleanOrphanedFiles();
      stats.orphansRemoved = orphanResult.orphansRemoved || 0;
      logger.info(`🧹 Órfãos removidos: ${stats.orphansRemoved}`);

      // Reconstruir índice KB/index.json
      const kbIndexPath = path.join(ACTIVE_PATHS.kb || path.join(__dirname, '../KB'), 'index.json');
      const kbDocsPath = path.join(ACTIVE_PATHS.kb || path.join(__dirname, '../KB'), 'documents');

      if (fs.existsSync(kbDocsPath)) {
        const folders = await fs.promises.readdir(kbDocsPath);
        const documents = [];

        for (const folder of folders) {
          const folderPath = path.join(kbDocsPath, folder);
          const stat = await fs.promises.stat(folderPath);

          if (stat.isDirectory()) {
            documents.push({
              id: folder,
              uploadedAt: stat.mtime.toISOString(),
              size: 0 // Será calculado se necessário
            });
          }
        }

        const newIndex = {
          documents,
          totalDocuments: documents.length,
          lastUpdated: new Date().toISOString()
        };

        await fs.promises.writeFile(kbIndexPath, JSON.stringify(newIndex, null, 2));
        stats.documentsIndexed = documents.length;
        stats.oldSystemReindexed = true;
        logger.info(`✅ KB/index.json reconstruído: ${documents.length} documentos`);
      }

    } catch (error) {
      stats.errors.push(`Erro ao reindexar sistema antigo: ${error.message}`);
      logger.error('⚠️ Erro ao reindexar sistema antigo:', error);
    }

    // 2. Validar sistema novo (data/kb-documents.json)
    try {
      const kbDocsJsonPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');

      if (fs.existsSync(kbDocsJsonPath)) {
        const kbDocs = JSON.parse(await fs.promises.readFile(kbDocsJsonPath, 'utf8'));
        stats.documentsFound = kbDocs.length;

        // Validar que os arquivos existem
        const validDocs = [];
        for (const doc of kbDocs) {
          if (doc.path && fs.existsSync(doc.path)) {
            validDocs.push(doc);
          } else {
            logger.warn(`⚠️ Documento órfão removido: ${doc.id} (arquivo não existe)`);
          }
        }

        // Reescrever se houver mudanças
        if (validDocs.length !== kbDocs.length) {
          await fs.promises.writeFile(kbDocsJsonPath, JSON.stringify(validDocs, null, 2));
          logger.info(`🧹 Removidos ${kbDocs.length - validDocs.length} documentos órfãos de kb-documents.json`);
        }

        stats.newSystemValidated = true;
        logger.info(`✅ kb-documents.json validado: ${validDocs.length} documentos válidos`);
      }

    } catch (error) {
      stats.errors.push(`Erro ao validar sistema novo: ${error.message}`);
      logger.error('⚠️ Erro ao validar sistema novo:', error);
    }

    stats.duration = Date.now() - startTime;

    logger.info(`✅ Reindexação completa concluída em ${stats.duration}ms`);

    res.json({
      success: true,
      message: 'Knowledge Base reindexado com sucesso',
      stats
    });

  } catch (error) {
    logger.error('❌ Erro ao reindexar KB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kb/statistics
 * Obter estatísticas completas do Knowledge Base
 */
app.get('/api/kb/statistics', generalLimiter, async (req, res) => {
  try {
    const KBCleaner = require('../lib/kb-cleaner.cjs');
    const cleaner = new KBCleaner();

    const cleanerStats = cleaner.getStatistics();

    // Também pegar stats de data/kb-documents.json
    let newSystemStats = {
      totalDocuments: 0,
      totalSize: 0
    };

    const kbDocsPath = path.join(ACTIVE_PATHS.data, 'kb-documents.json');
    if (fs.existsSync(kbDocsPath)) {
      const kbDocs = JSON.parse(await fs.promises.readFile(kbDocsPath, 'utf8'));
      newSystemStats.totalDocuments = kbDocs.length;
      newSystemStats.totalSize = kbDocs.reduce((sum, doc) => sum + (doc.size || 0), 0);
    }

    res.json({
      success: true,
      stats: {
        oldSystem: cleanerStats,
        newSystem: newSystemStats,
        combined: {
          totalDocuments: cleanerStats.kb.totalDocuments + newSystemStats.totalDocuments,
          message: 'Sistema híbrido (KB/ + data/kb-documents.json)'
        }
      }
    });

  } catch (error) {
    logger.error('❌ Erro ao obter estatísticas do KB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

logger.info('✅ APIs de Gerenciamento do KB inicializadas (BACKSPEC BETA - ETAPA 1)');

// ============================================
// 🚩 FEATURE FLAGS APIs (BACKSPEC BETA - ETAPA 3)
// ============================================

/**
 * GET /api/feature-flags
 * Retorna todas as feature flags
 */
app.get('/api/feature-flags', generalLimiter, (req, res) => {
  try {
    const allFlags = featureFlags.getAll();
    const stats = featureFlags.getStats();
    const validation = featureFlags.validate();

    res.json({
      success: true,
      flags: allFlags,
      stats,
      validation
    });
  } catch (error) {
    logger.error('❌ Erro ao buscar feature flags:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feature-flags/validate
 * Valida as feature flags atuais
 */
app.get('/api/feature-flags/validate', generalLimiter, (req, res) => {
  try {
    const validation = featureFlags.validate();

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    logger.error('❌ Erro ao validar feature flags:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feature-flags/:category
 * Retorna feature flags de uma categoria específica
 */
app.get('/api/feature-flags/:category', generalLimiter, (req, res) => {
  try {
    const { category } = req.params;
    const categoryFlags = featureFlags.getByCategory(category);

    res.json({
      success: true,
      category,
      flags: categoryFlags
    });
  } catch (error) {
    logger.error(`❌ Erro ao buscar flags da categoria ${req.params.category}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/feature-flags/:flagName
 * Atualiza uma feature flag específica
 */
app.put('/api/feature-flags/:flagName', generalLimiter, async (req, res) => {
  try {
    const { flagName } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Valor não fornecido' });
    }

    const success = featureFlags.set(flagName, value, true);

    if (success) {
      logger.info(`🚩 Feature flag atualizada: ${flagName} = ${value}`);

      res.json({
        success: true,
        flagName,
        value,
        message: `Feature flag ${flagName} atualizada com sucesso`
      });
    } else {
      res.status(500).json({ error: 'Erro ao atualizar feature flag' });
    }
  } catch (error) {
    logger.error(`❌ Erro ao atualizar feature flag ${req.params.flagName}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feature-flags/bulk
 * Atualiza múltiplas feature flags de uma vez
 */
app.post('/api/feature-flags/bulk', generalLimiter, async (req, res) => {
  try {
    const { flags } = req.body;

    if (!flags || typeof flags !== 'object') {
      return res.status(400).json({ error: 'Objeto flags não fornecido' });
    }

    featureFlags.setMultiple(flags, true);

    logger.info(`🚩 ${Object.keys(flags).length} feature flags atualizadas em bulk`);

    res.json({
      success: true,
      updated: Object.keys(flags).length,
      flags
    });
  } catch (error) {
    logger.error('❌ Erro ao atualizar feature flags em bulk:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feature-flags/reset
 * Reseta todas as feature flags para os valores padrão
 */
app.post('/api/feature-flags/reset', generalLimiter, async (req, res) => {
  try {
    featureFlags.reset();

    logger.info('🔄 Feature flags resetadas para valores padrão');

    res.json({
      success: true,
      message: 'Feature flags resetadas para valores padrão',
      flags: featureFlags.getAll()
    });
  } catch (error) {
    logger.error('❌ Erro ao resetar feature flags:', error);
    res.status(500).json({ error: error.message });
  }
});

logger.info('✅ APIs de Feature Flags inicializadas (BACKSPEC BETA - ETAPA 3)');

// ============================================
// ✍️  SPELL CHECK APIs (BACKSPEC BETA - ETAPA 4)
// ============================================

/**
 * POST /api/spell-check
 * Verifica ortografia e gramática de um texto
 */
app.post('/api/spell-check', generalLimiter, async (req, res) => {
  try {
    const { text, language, autoCorrect } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Texto não fornecido' });
    }

    const result = await spellChecker.checkText(text, {
      language: language || 'pt-BR',
      autoCorrect: autoCorrect !== undefined ? autoCorrect : false
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('❌ Erro ao verificar ortografia:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/spell-check/info
 * Retorna informações sobre o spell checker
 */
app.get('/api/spell-check/info', generalLimiter, (req, res) => {
  try {
    const info = spellChecker.getInfo();

    res.json({
      success: true,
      info
    });
  } catch (error) {
    logger.error('❌ Erro ao obter info do spell checker:', error);
    res.status(500).json({ error: error.message });
  }
});

logger.info('✅ APIs de Spell Check inicializadas (BACKSPEC BETA - ETAPA 4)');

// ============================================
// 📚 PARADIGMAS APIs (BETA PRÉ-MULTIUSUÁRIOS - BETA-1)
// ============================================

/**
 * POST /api/paradigmas
 * Cria um novo paradigma
 */
app.post('/api/paradigmas', generalLimiter, async (req, res) => {
  try {
    const paradigma = await paradigmasManager.add(req.body);

    res.json({
      success: true,
      paradigma
    });
  } catch (error) {
    logger.error('❌ Erro ao criar paradigma:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/paradigmas/categories
 * Retorna categorias disponíveis
 * DEVE VIR ANTES DE /:id
 */
app.get('/api/paradigmas/categories', generalLimiter, (req, res) => {
  try {
    const categories = paradigmasManager.getCategories();

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    logger.error('❌ Erro ao obter categorias:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/paradigmas/stats/general
 * Retorna estatísticas gerais dos paradigmas
 * DEVE VIR ANTES DE /:id
 */
app.get('/api/paradigmas/stats/general', generalLimiter, async (req, res) => {
  try {
    const stats = await paradigmasManager.getStatistics();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('❌ Erro ao obter estatísticas de paradigmas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/paradigmas
 * Lista paradigmas com filtros
 */
app.get('/api/paradigmas', generalLimiter, async (req, res) => {
  try {
    const filters = {
      tipo: req.query.tipo,
      area: req.query.area,
      tribunal: req.query.tribunal,
      materia: req.query.materia,
      status: req.query.status,
      tags: req.query.tags,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    const result = await paradigmasManager.list(filters);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('❌ Erro ao listar paradigmas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/paradigmas/:id
 * Retorna um paradigma específico
 * DEVE VIR DEPOIS DAS ROTAS ESPECÍFICAS
 */
app.get('/api/paradigmas/:id', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const includeContent = req.query.includeContent === 'true';

    const paradigma = await paradigmasManager.get(id, includeContent);

    if (!paradigma) {
      return res.status(404).json({ error: 'Paradigma não encontrado' });
    }

    res.json({
      success: true,
      paradigma
    });
  } catch (error) {
    logger.error(`❌ Erro ao buscar paradigma ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/paradigmas/:id
 * Atualiza um paradigma
 */
app.put('/api/paradigmas/:id', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const paradigma = await paradigmasManager.update(id, req.body);

    res.json({
      success: true,
      paradigma
    });
  } catch (error) {
    logger.error(`❌ Erro ao atualizar paradigma ${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/paradigmas/:id
 * Remove um paradigma
 */
app.delete('/api/paradigmas/:id', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    await paradigmasManager.delete(id);

    res.json({
      success: true,
      message: `Paradigma ${id} removido com sucesso`
    });
  } catch (error) {
    logger.error(`❌ Erro ao remover paradigma ${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/paradigmas/:id/use
 * Registra uso de um paradigma
 */
app.post('/api/paradigmas/:id/use', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    await paradigmasManager.registerUse(id);

    res.json({
      success: true,
      message: 'Uso registrado'
    });
  } catch (error) {
    logger.error(`❌ Erro ao registrar uso do paradigma ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/paradigmas/:id/feedback
 * Adiciona feedback a um paradigma
 */
app.post('/api/paradigmas/:id/feedback', generalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    await paradigmasManager.addFeedback(id, req.body);

    res.json({
      success: true,
      message: 'Feedback adicionado'
    });
  } catch (error) {
    logger.error(`❌ Erro ao adicionar feedback ao paradigma ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

logger.info('✅ APIs de Paradigmas inicializadas (BETA PRÉ-MULTIUSUÁRIOS - BETA-1)');

// ============================================
// 🔄 EXHAUSTIVE JOBS APIs (PLANO ANTI-429)
// ============================================

/**
 * POST /api/jobs/exhaustive
 * Cria job de análise exaustiva
 */
app.post('/api/jobs/exhaustive', generalLimiter, async (req, res) => {
  try {
    const { projectId, request: userRequest, metadata = {} } = req.body;
    const userId = req.session?.user?.id || 'anonymous';
    const traceId = req.headers['x-trace-id'] || `trace_${Date.now()}`;

    if (!projectId || !userRequest) {
      return res.status(400).json({
        error: 'projectId e request são obrigatórios'
      });
    }

    // Criar job
    const job = await exhaustiveJobManager.createJob({
      projectId,
      userId,
      traceId,
      request: userRequest,
      metadata
    });

    logger.info('🚀 Job de análise exaustiva criado via API', {
      jobId: job.jobId,
      projectId,
      userId,
      traceId
    });

    res.json({
      success: true,
      job: {
        jobId: job.jobId,
        status: job.status,
        message: job.message,
        estimatedTime: job.estimatedTime,
        trackingUrl: job.trackingUrl
      }
    });
  } catch (error) {
    logger.error('❌ Erro ao criar job exaustivo:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/jobs/:jobId/status
 * Obtém status de um job
 */
app.get('/api/jobs/:jobId/status', generalLimiter, (req, res) => {
  try {
    const { jobId } = req.params;

    const status = exhaustiveJobManager.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({
        error: 'Job não encontrado'
      });
    }

    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('❌ Erro ao obter status do job:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/jobs/:jobId/results
 * Obtém resultados de um job completo
 */
app.get('/api/jobs/:jobId/results', generalLimiter, (req, res) => {
  try {
    const { jobId } = req.params;

    const results = exhaustiveJobManager.getJobResults(jobId);

    if (!results) {
      return res.status(404).json({
        error: 'Resultados não disponíveis. Job pode ainda estar em andamento ou não existir.'
      });
    }

    res.json({
      success: true,
      results
    });
  } catch (error) {
    logger.error('❌ Erro ao obter resultados do job:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/jobs/project/:projectId
 * Lista todos os jobs de um projeto
 */
app.get('/api/jobs/project/:projectId', generalLimiter, (req, res) => {
  try {
    const { projectId } = req.params;

    const jobs = exhaustiveJobManager.getProjectJobs(projectId);

    res.json({
      success: true,
      projectId,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    logger.error('❌ Erro ao listar jobs do projeto:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/jobs/user/:userId
 * Lista todos os jobs de um usuário
 */
app.get('/api/jobs/user/:userId', generalLimiter, (req, res) => {
  try {
    const { userId } = req.params;

    const jobs = exhaustiveJobManager.getUserJobs(userId);

    res.json({
      success: true,
      userId,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    logger.error('❌ Erro ao listar jobs do usuário:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/jobs/:jobId
 * Cancela um job em andamento
 */
app.delete('/api/jobs/:jobId', generalLimiter, (req, res) => {
  try {
    const { jobId } = req.params;

    const cancelled = exhaustiveJobManager.cancelJob(jobId);

    if (!cancelled) {
      return res.status(404).json({
        error: 'Job não encontrado ou já concluído'
      });
    }

    res.json({
      success: true,
      message: 'Job cancelado com sucesso'
    });
  } catch (error) {
    logger.error('❌ Erro ao cancelar job:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bedrock/queue/status
 * Obtém status da fila do Bedrock
 */
app.get('/api/bedrock/queue/status', generalLimiter, (req, res) => {
  try {
    const status = bedrockQueue.getQueueStatus();
    const metrics = bedrockQueue.getMetrics();

    res.json({
      success: true,
      queue: status,
      metrics
    });
  } catch (error) {
    logger.error('❌ Erro ao obter status da fila:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/bedrock/queue/metrics
 * Obtém métricas da fila do Bedrock
 */
app.get('/api/bedrock/queue/metrics', generalLimiter, (req, res) => {
  try {
    const metrics = bedrockQueue.getMetrics();

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('❌ Erro ao obter métricas da fila:', error);
    res.status(500).json({ error: error.message });
  }
});

logger.info('✅ APIs de Exhaustive Jobs e Bedrock Queue inicializadas (PLANO ANTI-429)');

// 📊 Endpoint para listar documentos estruturados (7 tipos)
app.get('/api/kb/structured-documents', async (req, res) => {
  try {
    const structuredPath = path.join(EXTRACTOR_CONFIG.extractedFolder, 'structured');

    if (!fs.existsSync(structuredPath)) {
      return res.json({ success: true, documents: [], count: 0 });
    }

    // Listar todas as pastas (cada pasta é um documento processado)
    const folders = await fs.promises.readdir(structuredPath);
    const documents = [];

    for (const folder of folders) {
      const folderPath = path.join(structuredPath, folder);
      const stats = await fs.promises.stat(folderPath);

      if (!stats.isDirectory()) continue;

      // Listar arquivos dentro da pasta
      const files = await fs.promises.readdir(folderPath);
      const structuredFiles = files.map(file => ({
        name: file,
        path: path.join(folderPath, file),
        type: file.split('_').slice(1).join('_').replace(/\.(md|json)$/, '')
      }));

      documents.push({
        id: folder,
        name: folder,
        createdAt: stats.birthtime,
        filesCount: structuredFiles.length,
        files: structuredFiles
      });
    }

    // Ordenar por data de criação (mais recentes primeiro)
    documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      documents,
      count: documents.length,
      totalFiles: documents.reduce((sum, doc) => sum + doc.filesCount, 0)
    });

  } catch (error) {
    console.error('❌ Erro ao listar documentos estruturados:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📄 Endpoint para baixar documento estruturado específico
app.get('/api/kb/structured-documents/:id/:filename', async (req, res) => {
  try {
    const { id, filename } = req.params;
    const filePath = path.join(EXTRACTOR_CONFIG.extractedFolder, 'structured', id, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    const content = await fs.promises.readFile(filePath, 'utf8');
    const contentType = filename.endsWith('.json') ? 'application/json' : 'text/markdown';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);

  } catch (error) {
    console.error('❌ Erro ao baixar documento estruturado:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/kb/structured-documents/:id
 * Deletar conjunto completo de documentos estruturados
 */
app.delete('/api/kb/structured-documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const structuredPath = path.join(EXTRACTOR_CONFIG.extractedFolder, 'structured', id);

    logger.info(`🗑️ Deletando documentos estruturados: ${id}`);

    if (!fs.existsSync(structuredPath)) {
      return res.status(404).json({
        success: false,
        error: 'Documentos estruturados não encontrados'
      });
    }

    // Contar arquivos antes de deletar
    const files = await fs.promises.readdir(structuredPath);
    const filesCount = files.length;

    // Calcular tamanho total
    let totalSize = 0;
    for (const file of files) {
      const filePath = path.join(structuredPath, file);
      const stats = await fs.promises.stat(filePath);
      totalSize += stats.size;
    }

    // Deletar pasta completa
    await fs.promises.rm(structuredPath, { recursive: true, force: true });

    logger.info(`✅ Deletados ${filesCount} documentos estruturados (${(totalSize / 1024).toFixed(2)} KB)`);

    res.json({
      success: true,
      message: `${filesCount} documentos estruturados deletados com sucesso`,
      details: {
        id,
        filesDeleted: filesCount,
        spaceSaved: totalSize,
        spaceSavedFormatted: `${(totalSize / 1024).toFixed(2)} KB`
      }
    });

  } catch (error) {
    logger.error('❌ Erro ao deletar documentos estruturados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Estatísticas do KB do usuário (requer autenticação)
app.get('/api/kb/user-statistics', authSystem.authMiddleware(), (req, res) => {
  try {
    const userId = req.user.userId;
    const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');

    if (!fs.existsSync(kbDocsPath)) {
      return res.json({
        stats: {
          totalDocuments: 0,
          totalSize: 0,
          documentsToday: 0,
          lastUpdate: null
        }
      });
    }

    const data = fs.readFileSync(kbDocsPath, 'utf8');
    const allDocs = JSON.parse(data);
    const userDocs = allDocs.filter(doc => doc.userId === userId);

    // Calcular estatísticas
    const totalSize = userDocs.reduce((sum, doc) => sum + doc.size, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const documentsToday = userDocs.filter(doc => {
      const uploadDate = new Date(doc.uploadedAt);
      uploadDate.setHours(0, 0, 0, 0);
      return uploadDate.getTime() === today.getTime();
    }).length;

    const lastUpdate = userDocs.length > 0
      ? userDocs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0].uploadedAt
      : null;

    res.json({
      stats: {
        totalDocuments: userDocs.length,
        totalSize: totalSize,
        documentsToday: documentsToday,
        lastUpdate: lastUpdate
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter estatísticas KB do usuário:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA MODEL MONITOR
// ====================================================================

// Listar todos os modelos disponíveis
app.get('/api/models', authSystem.authMiddleware(), async (req, res) => {
  try {
    const modelsPath = path.join(__dirname, '../data/ai_models.json');
    const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf-8'));

    // Flatten the structure for easier consumption
    const allModels = [];
    for (const [providerKey, models] of Object.entries(modelsData)) {
      if (Array.isArray(models)) {
        models.forEach(model => {
          allModels.push({
            ...model,
            providerKey: providerKey
          });
        });
      }
    }

    res.json({
      success: true,
      models: allModels,
      totalCount: allModels.length,
      implementedCount: allModels.filter(m => m.implemented).length,
      providers: Object.keys(modelsData)
    });
  } catch (error) {
    console.error('❌ Erro ao listar modelos:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verificar novos modelos disponíveis
app.post('/api/models/check', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), async (req, res) => {
  try {
    const result = await modelMonitor.checkForNewModels();

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Erro ao verificar novos modelos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Listar sugestões de modelos pendentes
app.get('/api/models/suggestions', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const suggestions = modelMonitor.listPendingSuggestions();

    res.json({
      suggestions,
      total: suggestions.length
    });
  } catch (error) {
    console.error('Erro ao listar sugestões:', error);
    res.status(500).json({ error: error.message });
  }
});

// Aprovar sugestão de modelo
app.post('/api/models/suggestions/:suggestionId/approve', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const { suggestionId } = req.params;
    const approvedBy = req.user.userId;

    const result = modelMonitor.approveSuggestion(suggestionId, approvedBy);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Erro ao aprovar sugestão:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rejeitar sugestão de modelo
app.post('/api/models/suggestions/:suggestionId/reject', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { reason } = req.body;
    const rejectedBy = req.user.userId;

    if (!reason) {
      return res.status(400).json({ error: 'Motivo é obrigatório' });
    }

    const result = modelMonitor.rejectSuggestion(suggestionId, rejectedBy, reason);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Erro ao rejeitar sugestão:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter estatísticas de modelos
app.get('/api/models/statistics', authSystem.authMiddleware(), (req, res) => {
  try {
    const stats = modelMonitor.getStatistics();
    res.json({ stats });
  } catch (error) {
    console.error('Erro ao obter estatísticas de modelos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA JUSBRASIL (CREDENCIAIS POR PARCEIRO)
// ====================================================================

// Configurar credenciais Jusbrasil do parceiro
app.post('/api/jusbrasil/credentials', authSystem.authMiddleware(), (req, res) => {
  try {
    const { email, senha } = req.body;
    const partnerId = req.user.partnerId || 'rom';

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Salvar credenciais por parceiro (em produção, criptografar!)
    const usersPath = path.join(__dirname, '../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    const user = users.find(u => u.id === req.user.userId);
    if (user) {
      user.jusbrasilCredentials = {
        email,
        senha, // Em produção: bcrypt.hashSync(senha, 10)
        configuredAt: new Date().toISOString()
      };

      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

      res.json({
        success: true,
        message: 'Credenciais Jusbrasil configuradas com sucesso',
        email
      });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao configurar credenciais Jusbrasil:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter status das credenciais Jusbrasil
app.get('/api/jusbrasil/credentials/status', authSystem.authMiddleware(), (req, res) => {
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    const user = users.find(u => u.id === req.user.userId);
    if (user && user.jusbrasilCredentials) {
      res.json({
        configured: true,
        email: user.jusbrasilCredentials.email,
        configuredAt: user.jusbrasilCredentials.configuredAt
      });
    } else {
      res.json({
        configured: false
      });
    }
  } catch (error) {
    console.error('Erro ao verificar credenciais:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remover credenciais Jusbrasil
app.delete('/api/jusbrasil/credentials', authSystem.authMiddleware(), (req, res) => {
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    const user = users.find(u => u.id === req.user.userId);
    if (user) {
      delete user.jusbrasilCredentials;
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

      res.json({
        success: true,
        message: 'Credenciais Jusbrasil removidas'
      });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao remover credenciais:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA VALIDAÇÃO DE QUALIDADE
// ====================================================================

// Validar peça ANTES de enviar para IA (economiza tokens, evita retrabalho)
app.post('/api/validate', (req, res) => {
  try {
    const { type, content, metadata } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: 'type e content são obrigatórios' });
    }

    // 🚀 VALIDAÇÃO RÁPIDA - não é burocrática
    const validation = qualityValidator.validate({ type, content, metadata });

    res.json({
      valid: validation.valid,
      score: validation.score,
      errors: validation.errors,
      warnings: validation.warnings,
      canProceed: validation.score >= 60, // Mínimo para prosseguir
      message: validation.valid
        ? '✅ Peça validada - pronta para geração'
        : '⚠️ Peça precisa de ajustes antes de gerar'
    });
  } catch (error) {
    console.error('Erro ao validar peça:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter estatísticas de validação
app.get('/api/validate/statistics', (req, res) => {
  try {
    const stats = qualityValidator.getStatistics();
    res.json({ stats });
  } catch (error) {
    console.error('Erro ao obter estatísticas de validação:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA CACHE INTELIGENTE
// ====================================================================

// Obter estatísticas do cache
app.get('/api/cache/statistics', (req, res) => {
  try {
    // Retornar estatísticas do cache de agentes ativos
    const stats = {
      enabled: true,
      activeSessions: agents.size,
      totalAgents: agents.size,
      cacheType: 'in-memory',
      ttl: '30min'
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Erro ao obter estatísticas do cache:', error);
    res.status(500).json({ error: error.message });
  }
});

// Limpar cache (requer autenticação de admin)
app.post('/api/cache/clear', authSystem.authMiddleware(), authSystem.requireRole('master_admin'), (req, res) => {
  try {
    // Limpar cache de todos os agentes ativos
    let cleared = 0;
    for (const [sessionId, agent] of agents.entries()) {
      agent.clearCache();
      cleared++;
    }

    res.json({
      success: true,
      message: `Cache limpo em ${cleared} sessões`
    });
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA EXPORTAÇÃO DE DOCUMENTOS
// ====================================================================

// Exportar para DOCX
app.post('/api/export/docx', async (req, res) => {
  try {
    const { content, titulo = 'Documento ROM Agent', projectId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const DOCXExporter = require('../lib/docx-exporter.cjs');
    const exporter = new DOCXExporter();

    // Converter conteúdo (assumindo HTML ou markdown)
    const buffer = await exporter.createLegalDocument({
      titulo,
      conteudoHTML: content,
      timbrado: {
        escritorio: 'Rodolfo Otávio Mota Advogados Associados',
        oab: 'OAB/MG',
        endereco: 'Belo Horizonte - MG',
        email: 'contato@rom.adv.br'
      }
    });

    const filename = `${titulo.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

    console.log(`✅ Documento DOCX exportado: ${filename}`);
  } catch (error) {
    console.error('❌ Erro ao exportar DOCX:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar para PDF (usando html-pdf ou similar)
app.post('/api/export/pdf', async (req, res) => {
  try {
    const { content, titulo = 'Documento ROM Agent' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    // Converter markdown para HTML se necessário
    let htmlContent = content;
    if (content.includes('##') || content.includes('**')) {
      const { marked } = require('marked');
      htmlContent = marked.parse(content);
    }

    // Template HTML para PDF
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.5;
      margin: 3cm 2cm 2cm 3cm;
      text-align: justify;
    }
    h1 { font-size: 14pt; text-align: center; margin-bottom: 1.5cm; }
    h2 { font-size: 13pt; margin-top: 1cm; margin-bottom: 0.5cm; }
    p { margin-bottom: 0.5cm; text-indent: 2cm; }
  </style>
</head>
<body>
  <h1>${titulo}</h1>
  ${htmlContent}
</body>
</html>`;

    // Por enquanto, retornar HTML (pode-se usar puppeteer ou wkhtmltopdf no futuro)
    const filename = `${titulo.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.html`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(htmlTemplate);

    console.log(`✅ Documento HTML/PDF exportado: ${filename}`);
  } catch (error) {
    console.error('❌ Erro ao exportar PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar para TXT
app.post('/api/export/txt', (req, res) => {
  try {
    const { content, titulo = 'Documento ROM Agent' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    // Remover markdown e HTML
    let txtContent = content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/#{1,6}\s/g, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.*?)\*/g, '$1') // Remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
      .trim();

    // Adicionar título
    txtContent = `${titulo.toUpperCase()}\n${'='.repeat(titulo.length)}\n\n${txtContent}`;

    const filename = `${titulo.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(txtContent);

    console.log(`✅ Documento TXT exportado: ${filename}`);
  } catch (error) {
    console.error('❌ Erro ao exportar TXT:', error);
    res.status(500).json({ error: error.message });
  }
});

// Exportar para HTML
app.post('/api/export/html', (req, res) => {
  try {
    const { content, titulo = 'Documento ROM Agent' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    // Converter markdown para HTML se necessário
    let htmlContent = content;
    if (content.includes('##') || content.includes('**')) {
      const { marked } = require('marked');
      htmlContent = marked.parse(content);
    }

    // Template HTML profissional
    const htmlDocument = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.5;
      max-width: 21cm;
      margin: 0 auto;
      padding: 3cm 2cm 2cm 3cm;
      background: #fff;
      color: #000;
      text-align: justify;
    }
    h1 {
      font-size: 14pt;
      text-align: center;
      margin-bottom: 1.5cm;
      text-transform: uppercase;
    }
    h2 {
      font-size: 13pt;
      margin-top: 1cm;
      margin-bottom: 0.5cm;
    }
    p {
      margin-bottom: 0.5cm;
      text-indent: 2cm;
    }
    blockquote {
      margin-left: 4cm;
      margin-right: 0;
      font-style: italic;
      border-left: 3px solid #ccc;
      padding-left: 1cm;
    }
    @media print {
      body {
        margin: 3cm 2cm 2cm 3cm;
      }
    }
  </style>
</head>
<body>
  <h1>${titulo}</h1>
  ${htmlContent}

  <footer style="margin-top: 3cm; text-align: center; font-size: 10pt; color: #666;">
    <p>Documento gerado por ROM Agent - ${new Date().toLocaleDateString('pt-BR')}</p>
  </footer>
</body>
</html>`;

    const filename = `${titulo.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.html`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(htmlDocument);

    console.log(`✅ Documento HTML exportado: ${filename}`);
  } catch (error) {
    console.error('❌ Erro ao exportar HTML:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================================
// ROTAS DE API PARA ESTRATÉGIAS MULTI-MODELO
// ====================================================================

// Importar estratégias do intelligent-router
const {
  cascadeStrategy,
  votingStrategy,
  evaluateConfidence
} = require('../lib/intelligent-router.cjs');

// Estratégia Cascade: modelo rápido → premium se necessário
app.post('/api/chat/cascade', async (req, res) => {
  try {
    const { message } = req.body;
    const history = getHistory(req.session.id);

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }

    console.log('🔀 [Cascade] Iniciando estratégia cascade...');

    const { conversar } = await import('./modules/bedrock.js');

    const result = await cascadeStrategy(message, '', conversar);

    // Adicionar ao histórico
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    history.push({
      role: 'assistant',
      content: result.response.resposta,
      strategy: result.strategy,
      model: result.routing.model,
      confidence: result.confidence,
      timestamp: new Date()
    });

    res.json({
      response: result.response.resposta,
      strategy: result.strategy,
      model: result.routing.model,
      confidence: result.confidence,
      savings: result.routing.savingsPercent || '0%'
    });

  } catch (error) {
    console.error('❌ [Cascade] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estratégia Voting: múltiplos modelos votam
app.post('/api/chat/voting', async (req, res) => {
  try {
    const { message, numModels = 3 } = req.body;
    const history = getHistory(req.session.id);

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }

    console.log(`🗳️ [Voting] Iniciando votação com ${numModels} modelos...`);

    const { conversar } = await import('./modules/bedrock.js');

    const result = await votingStrategy(message, '', conversar, numModels);

    // Adicionar ao histórico
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    history.push({
      role: 'assistant',
      content: result.winner.response.resposta,
      strategy: result.strategy,
      model: result.winner.model,
      score: result.winner.score,
      alternatives: result.alternatives.map(alt => ({
        model: alt.model,
        score: alt.score
      })),
      timestamp: new Date()
    });

    res.json({
      response: result.winner.response.resposta,
      strategy: result.strategy,
      model: result.winner.model,
      score: result.winner.score,
      alternatives: result.alternatives.map(alt => ({
        model: alt.model,
        score: alt.score
      })),
      consensus: result.consensus
    });

  } catch (error) {
    console.error('❌ [Voting] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estratégia Best-of-N: gera N respostas, retorna melhor
app.post('/api/chat/best-of-n', async (req, res) => {
  try {
    const { message, n = 3, modelo = 'global.anthropic.claude-sonnet-4-5-20250929-v1:0' } = req.body;
    const history = getHistory(req.session.id);

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }

    console.log(`🎯 [Best-of-N] Gerando ${n} respostas e selecionando a melhor...`);

    const { conversar } = await import('./modules/bedrock.js');
    const { evaluateResponseQuality } = require('../lib/intelligent-router.cjs');

    // Gerar N respostas
    const responses = await Promise.all(
      Array(n).fill(null).map(() =>
        conversar(message, {
          modelo,
          historico: history.slice(-10),
          maxTokens: 4096,
          temperature: 0.7
        })
      )
    );

    // Avaliar qualidade de cada resposta
    const scored = responses.map((resp, idx) => ({
      response: resp,
      score: evaluateResponseQuality(resp.resposta),
      index: idx + 1
    }));

    // Ordenar por score
    scored.sort((a, b) => b.score - a.score);

    const winner = scored[0];

    // Adicionar ao histórico
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    history.push({
      role: 'assistant',
      content: winner.response.resposta,
      strategy: 'best-of-n',
      model: modelo,
      score: winner.score,
      alternatives: scored.slice(1).map(s => ({
        score: s.score,
        index: s.index
      })),
      timestamp: new Date()
    });

    res.json({
      response: winner.response.resposta,
      strategy: 'best-of-n',
      model: modelo,
      score: winner.score,
      totalGenerated: n,
      alternatives: scored.slice(1).map(s => ({
        score: s.score,
        index: s.index
      }))
    });

  } catch (error) {
    console.error('❌ [Best-of-N] Erro:', error);
    res.status(500).json({ error: error.message });
  }
});

// HTML da interface melhorada
function getEnhancedHTML() {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ROM - Redator de Obras Magistrais</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
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

    [data-theme="dark"] {
      --primary: #4299e1;
      --primary-light: #63b3ed;
      --secondary: #ecc94b;
      --background: #1a202c;
      --surface: #2d3748;
      --text: #f7fafc;
      --text-light: #cbd5e0;
      --border: #4a5568;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--background);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      transition: background 0.3s, color 0.3s;
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
      height: 50px;
      width: auto;
      max-width: 200px;
      object-fit: contain;
    }

    .logo-placeholder {
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
      align-items: center;
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

    .theme-toggle {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: rgba(255,255,255,0.2);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
    }

    .theme-toggle:hover {
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
      height: 100px;
      width: auto;
      max-width: 300px;
      object-fit: contain;
      margin: 0 auto 1.5rem;
      display: block;
    }

    .welcome-logo-placeholder {
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
      transform: translateY(-2px);
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
      animation: fadeIn 0.3s;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
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
      margin-bottom: 0.5rem;
    }

    .message-content p:last-child {
      margin-bottom: 0;
    }

    .message-content code {
      background: rgba(0,0,0,0.05);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }

    .message-content pre {
      background: rgba(0,0,0,0.05);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 0.5rem 0;
    }

    .file-attachment {
      background: rgba(0,0,0,0.05);
      padding: 0.75rem;
      border-radius: 8px;
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .file-icon {
      font-size: 1.5rem;
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
      flex-direction: column;
      gap: 0.75rem;
    }

    .input-wrapper {
      display: flex;
      gap: 0.75rem;
      align-items: flex-end;
    }

    .input-box {
      flex: 1;
      position: relative;
    }

    textarea {
      width: 100%;
      padding: 1rem;
      padding-right: 3rem;
      border: 2px solid var(--border);
      border-radius: 12px;
      font-size: 1rem;
      font-family: inherit;
      resize: none;
      min-height: 56px;
      max-height: 200px;
      transition: border-color 0.2s;
      background: var(--background);
      color: var(--text);
    }

    textarea:focus {
      outline: none;
      border-color: var(--primary);
    }

    .attach-btn {
      position: absolute;
      right: 0.5rem;
      bottom: 0.5rem;
      width: 40px;
      height: 40px;
      background: transparent;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.2s;
      color: var(--text-light);
    }

    .attach-btn:hover {
      background: var(--border);
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

    .file-preview {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .file-preview button {
      margin-left: auto;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--error);
      font-size: 1.2rem;
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

    /* Hidden file input */
    #fileInput {
      display: none;
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo-container">
      <img src="/img/logo_rom.png" alt="ROM" class="logo" id="headerLogo">
      <div class="brand">
        <h1 id="brandName">ROM</h1>
        <p id="brandTagline">Redator de Obras Magistrais</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="theme-toggle" onclick="toggleTheme()" title="Alternar tema">🌙</button>
      <button class="btn btn-secondary" onclick="limparChat()">Nova Conversa</button>
    </div>
  </header>

  <main class="main">
    <div class="chat-container" id="chatContainer">
      <div class="welcome" id="welcome">
        <img src="/img/logo_rom.png" alt="ROM" class="welcome-logo" id="welcomeLogo">
        <h2 id="welcomeTitle">Bem-vindo ao ROM</h2>
        <p id="welcomeSubtitle">Seu assistente especializado em redação de peças jurídicas</p>

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
          <div class="suggestion" onclick="enviarSugestao('Analise o documento que vou enviar')">
            <h4>📄 Análise de Documento</h4>
            <p>Analise PDFs e DOCs</p>
          </div>
        </div>
      </div>
    </div>
  </main>

  <div class="input-area">
    <div class="input-container">
      <div id="filePreviewContainer"></div>
      <div class="input-wrapper">
        <div class="input-box">
          <textarea
            id="messageInput"
            placeholder="Digite sua mensagem ou descreva a peça que deseja redigir..."
            rows="1"
            onkeydown="handleKeyDown(event)"
            oninput="autoResize(this)"
          ></textarea>
          <button class="attach-btn" onclick="document.getElementById('fileInput').click()" title="Anexar arquivo">
            📎
          </button>
          <input type="file" id="fileInput" accept=".pdf,.doc,.docx,.txt" onchange="handleFileSelect(event)" />
        </div>
        <button class="send-btn" id="sendBtn" onclick="enviarMensagem()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <footer class="footer">
    <p>ROM v2.0 - Rodolfo Otávio Mota Advogados Associados</p>
  </footer>

  <script>
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const welcome = document.getElementById('welcome');
    const filePreviewContainer = document.getElementById('filePreviewContainer');
    let selectedFile = null;

    // Tema
    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);

      const toggle = document.querySelector('.theme-toggle');
      toggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }

    // Carregar tema salvo
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (savedTheme === 'dark') {
      document.querySelector('.theme-toggle').textContent = '☀️';
    }

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

    function handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        selectedFile = file;
        showFilePreview(file);
      }
    }

    function showFilePreview(file) {
      filePreviewContainer.innerHTML = \`
        <div class="file-preview">
          <span class="file-icon">📄</span>
          <span>\${file.name} (\${formatFileSize(file.size)})</span>
          <button onclick="clearFileSelection()">×</button>
        </div>
      \`;
    }

    function clearFileSelection() {
      selectedFile = null;
      filePreviewContainer.innerHTML = '';
      document.getElementById('fileInput').value = '';
    }

    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    async function uploadFile() {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      return await response.json();
    }

    async function enviarMensagem() {
      const message = messageInput.value.trim();
      if (!message && !selectedFile) return;

      // Esconder welcome
      if (welcome) {
        welcome.style.display = 'none';
      }

      // Upload de arquivo primeiro, se houver
      if (selectedFile) {
        addMessage(\`Enviando arquivo: \${selectedFile.name}...\`, 'user');
        const uploadResult = await uploadFile();

        if (uploadResult.success) {
          addMessage(uploadResult.message, 'rom');
        } else {
          addMessage('Erro ao enviar arquivo: ' + uploadResult.error, 'rom');
        }

        clearFileSelection();

        if (!message) {
          messageInput.focus();
          return;
        }
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
          // Renderizar markdown
          addMessage(data.response, 'rom', true);
        }
      } catch (error) {
        removeLoading(loadingId);
        addMessage('Erro de conexão. Verifique se o servidor está rodando.', 'rom');
      }

      sendBtn.disabled = false;
      messageInput.focus();
    }

    function addMessage(text, sender, isMarkdown = false) {
      const div = document.createElement('div');
      div.className = 'message message-' + sender;

      const avatarClass = sender === 'rom' ? 'avatar-rom' : 'avatar-user';
      const avatarText = sender === 'rom' ? 'R' : 'U';

      let content = text;
      if (isMarkdown && sender === 'rom') {
        // Renderizar markdown
        content = marked.parse(text);
      } else {
        content = \`<p>\${escapeHtml(text)}</p>\`;
      }

      div.innerHTML = \`
        <div class="avatar \${avatarClass}">\${avatarText}</div>
        <div class="message-content">
          \${content}
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

    // Carregar branding do parceiro
    async function loadBranding() {
      try {
        const response = await fetch('/api/branding');
        const branding = await response.json();

        // Atualizar logos
        if (document.getElementById('headerLogo')) {
          document.getElementById('headerLogo').src = branding.logo;
        }
        if (document.getElementById('welcomeLogo')) {
          document.getElementById('welcomeLogo').src = branding.logo;
        }

        // Atualizar textos
        if (document.getElementById('brandName')) {
          document.getElementById('brandName').textContent = branding.name;
        }
        if (document.getElementById('brandTagline')) {
          document.getElementById('brandTagline').textContent = branding.tagline;
        }
        if (document.getElementById('welcomeTitle')) {
          document.getElementById('welcomeTitle').textContent = \`Bem-vindo ao \${branding.name}\`;
        }
        if (document.getElementById('welcomeSubtitle')) {
          document.getElementById('welcomeSubtitle').textContent = branding.subtitle;
        }

        // Atualizar cores customizadas
        if (branding.colors) {
          document.documentElement.style.setProperty('--primary', branding.colors.primary);
          document.documentElement.style.setProperty('--primary-light', branding.colors.primaryLight);
          document.documentElement.style.setProperty('--secondary', branding.colors.secondary);
        }

        // Atualizar título da página
        document.title = \`\${branding.name} - \${branding.tagline}\`;

      } catch (error) {
        console.error('Erro ao carregar branding:', error);
        // Usar valores padrão ROM se falhar
      }
    }

    // Focus no input ao carregar
    messageInput.focus();

    // Carregar branding e histórico ao iniciar
    loadBranding();

    // Carregar histórico ao iniciar
    async function loadHistory() {
      try {
        const response = await fetch('/api/history');
        const data = await response.json();

        if (data.history && data.history.length > 0) {
          welcome.style.display = 'none';
          data.history.forEach(msg => {
            if (msg.file) {
              addMessage(\`Arquivo: \${msg.file.originalName}\`, msg.role === 'user' ? 'user' : 'rom');
            } else {
              addMessage(msg.content, msg.role === 'user' ? 'user' : 'rom', msg.role !== 'user');
            }
          });
        }
      } catch (error) {
        console.error('Erro ao carregar histórico:', error);
      }
    }

    loadHistory();
  </script>
</body>
</html>
`;
}

// ============================================
// PROJECTS SYSTEM API ROUTES
// ============================================

// In-memory projects store with file persistence
const projectsStore = new Map();
let projectIdCounter = 1;

// Projects data file path
const projectsFilePath = path.join(process.cwd(), 'data', 'projects.json');

// Load projects from file
function loadProjectsFromFile() {
  try {
    if (fs.existsSync(projectsFilePath)) {
      const data = fs.readFileSync(projectsFilePath, 'utf8');
      const projects = JSON.parse(data);

      // Restore projects to Map
      projects.forEach(project => {
        projectsStore.set(project.id, project);
        // Update counter to avoid ID collision
        const projectNum = parseInt(project.id);
        if (!isNaN(projectNum) && projectNum >= projectIdCounter) {
          projectIdCounter = projectNum + 1;
        }
      });

      console.log(`✅ ${projects.length} projetos carregados de ${projectsFilePath}`);
    } else {
      console.log('ℹ️ Nenhum arquivo de projetos encontrado, iniciando vazio');
    }
  } catch (error) {
    console.error('⚠️ Erro ao carregar projetos:', error);
  }
}

// Save projects to file
function saveProjectsToFile() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const projects = Array.from(projectsStore.values());
    fs.writeFileSync(projectsFilePath, JSON.stringify(projects, null, 2));
    console.log(`💾 ${projects.length} projetos salvos em ${projectsFilePath}`);
  } catch (error) {
    console.error('⚠️ Erro ao salvar projetos:', error);
  }
}

// Helper function to save project
function saveProject(project) {
  projectsStore.set(project.id, project);
  saveProjectsToFile(); // Persist to file
  return project;
}

// ====================================================================
// MULTI-TENANT CUSTOM INSTRUCTIONS SYSTEM
// ====================================================================

// Partner prompts file path (custom instructions por parceiro)
const partnerPromptsFilePath = path.join(process.cwd(), 'data', 'partner-prompts.json');

// In-memory cache for partner prompts
let partnerPromptsCache = {};

// Load partner prompts from file
function loadPartnerPrompts() {
  try {
    if (fs.existsSync(partnerPromptsFilePath)) {
      const data = fs.readFileSync(partnerPromptsFilePath, 'utf8');
      partnerPromptsCache = JSON.parse(data);
      const partnersCount = Object.keys(partnerPromptsCache).length;
      console.log(`✅ ${partnersCount} customizações de prompts carregadas de ${partnerPromptsFilePath}`);
    } else {
      console.log('ℹ️ Nenhum arquivo de customizações encontrado, iniciando vazio');
      partnerPromptsCache = {};
    }
  } catch (error) {
    console.error('⚠️ Erro ao carregar customizações de prompts:', error);
    partnerPromptsCache = {};
  }
}

// Save partner prompts to file
function savePartnerPrompts() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(partnerPromptsFilePath, JSON.stringify(partnerPromptsCache, null, 2));
    console.log(`💾 Customizações de prompts salvas em ${partnerPromptsFilePath}`);
  } catch (error) {
    console.error('⚠️ Erro ao salvar customizações de prompts:', error);
  }
}

// Get partner-specific custom instructions (or default)
function getPartnerPrompts(projectId, partnerId) {
  // Projeto ROM Agent (ID "1") é multi-tenant
  if (projectId !== '1') {
    return null; // Outros projetos não têm customização por parceiro
  }

  // Se parceiro tem customização, retornar
  if (partnerId && partnerPromptsCache[partnerId]) {
    return partnerPromptsCache[partnerId];
  }

  // Caso contrário, retornar null (usa prompts padrão do projeto)
  return null;
}

// Save partner-specific custom instructions
function savePartnerPrompt(projectId, partnerId, customInstructions, userId = 'system') {
  // Apenas projeto ROM Agent (ID "1") aceita customização por parceiro
  if (projectId !== '1') {
    throw new Error('Apenas o projeto ROM Agent aceita customizações por parceiro');
  }

  if (!partnerId || partnerId.trim() === '') {
    throw new Error('partnerId é obrigatório');
  }

  if (!customInstructions || customInstructions.trim() === '') {
    throw new Error('customInstructions não pode ser vazio');
  }

  // Salvar customização
  partnerPromptsCache[partnerId] = {
    customInstructions: customInstructions.trim(),
    lastModified: new Date().toISOString(),
    editedBy: userId
  };

  savePartnerPrompts();

  return partnerPromptsCache[partnerId];
}

// GET /api/projects/list - Listar todos os projetos
app.get('/api/projects/list', (req, res) => {
  try {
    const projects = Array.from(projectsStore.values())
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    res.json(projects);
  } catch (error) {
    console.error('Erro ao listar projetos:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/projects/:id - Obter detalhes de um projeto (com support multi-tenant)
app.get('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { partnerId } = req.query; // Query param opcional: ?partnerId=xxx
    const project = projectsStore.get(id);

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    // Clonar projeto para não modificar o original
    const projectResponse = { ...project };

    // Se projeto ROM Agent (ID "1") e partnerId fornecido, aplicar customizações
    if (id === '1' && partnerId) {
      const partnerPrompt = getPartnerPrompts(id, partnerId);

      if (partnerPrompt) {
        // Override custom instructions com versão do parceiro
        projectResponse.customInstructions = partnerPrompt.customInstructions;
        projectResponse.customInstructionsSource = 'partner'; // Indica que é customizado
        projectResponse.customInstructionsLastModified = partnerPrompt.lastModified;
        projectResponse.customInstructionsEditedBy = partnerPrompt.editedBy;
      } else {
        // Usar prompts padrão
        projectResponse.customInstructionsSource = 'default';
      }
    }

    res.json(projectResponse);
  } catch (error) {
    console.error('Erro ao obter projeto:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/projects/1/prompts - Editar custom instructions do parceiro (projeto ROM Agent)
app.put('/api/projects/1/prompts', authSystem.authMiddleware(), (req, res) => {
  try {
    const { customInstructions } = req.body;
    const user = req.user; // Obtido pelo middleware de autenticação
    const partnerId = user.partnerId || 'rom';

    // Validar entrada
    if (!customInstructions || customInstructions.trim().length === 0) {
      return res.status(400).json({
        error: 'customInstructions não pode ser vazio',
        message: 'Por favor, forneça as instruções customizadas'
      });
    }

    // Salvar customização do parceiro
    const saved = savePartnerPrompt('1', partnerId, customInstructions, user.email || user.userId);

    logger.info(`Custom instructions atualizadas para parceiro ${partnerId} por ${user.email || user.userId}`);

    res.json({
      success: true,
      partnerId,
      customInstructions: saved.customInstructions,
      lastModified: saved.lastModified,
      editedBy: saved.editedBy,
      message: 'Custom instructions atualizadas com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar custom instructions:', error);
    res.status(500).json({
      error: error.message,
      message: 'Erro ao atualizar custom instructions'
    });
  }
});

// GET /api/projects/1/prompts - Obter custom instructions do parceiro
app.get('/api/projects/1/prompts', authSystem.authMiddleware(), (req, res) => {
  try {
    const user = req.user;
    const partnerId = user.partnerId || 'rom';

    const partnerPrompt = getPartnerPrompts('1', partnerId);

    // Obter prompts padrão do projeto
    const project = projectsStore.get('1');
    const defaultPrompts = project ? project.customInstructions : '';

    res.json({
      success: true,
      partnerId,
      source: partnerPrompt ? 'partner' : 'default',
      customInstructions: partnerPrompt ? partnerPrompt.customInstructions : defaultPrompts,
      defaultPrompts: defaultPrompts, // Sempre retornar os padrão para referência
      lastModified: partnerPrompt ? partnerPrompt.lastModified : null,
      editedBy: partnerPrompt ? partnerPrompt.editedBy : null,
      isCustomized: !!partnerPrompt
    });

  } catch (error) {
    console.error('Erro ao obter custom instructions:', error);
    res.status(500).json({
      error: error.message,
      message: 'Erro ao obter custom instructions'
    });
  }
});

// DELETE /api/projects/1/prompts - Resetar custom instructions para padrão (remover customização)
app.delete('/api/projects/1/prompts', authSystem.authMiddleware(), (req, res) => {
  try {
    const user = req.user;
    const partnerId = user.partnerId || 'rom';

    // Remover customização do parceiro
    if (partnerPromptsCache[partnerId]) {
      delete partnerPromptsCache[partnerId];
      savePartnerPrompts();

      logger.info(`Custom instructions resetadas para padrão para parceiro ${partnerId} por ${user.email || user.userId}`);

      res.json({
        success: true,
        partnerId,
        message: 'Custom instructions resetadas para padrão. Agora usando prompts globais do ROM Agent.'
      });
    } else {
      res.json({
        success: true,
        partnerId,
        message: 'Parceiro já estava usando prompts padrão'
      });
    }

  } catch (error) {
    console.error('Erro ao resetar custom instructions:', error);
    res.status(500).json({
      error: error.message,
      message: 'Erro ao resetar custom instructions'
    });
  }
});

// POST /api/projects/create - Criar novo projeto (igual Claude.ai)
app.post('/api/projects/create', (req, res) => {
  try {
    const {
      name,
      description,
      customInstructions,
      kbMaxSizeMB = 500, // 500MB padrão (5x maior que Claude.ai 100MB)
      settings = {}
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome do projeto é obrigatório' });
    }

    const projectId = String(projectIdCounter++);
    const now = new Date().toISOString();

    const project = {
      id: projectId,
      name: name.trim(),
      description: description ? description.trim() : '',

      // Custom Instructions específicas do projeto (igual Claude.ai)
      customInstructions: customInstructions ? customInstructions.trim() : '',

      // KB com maior capacidade
      kbMaxSizeMB: Number(kbMaxSizeMB) || 500,
      kbCurrentSizeMB: 0,
      kbUsagePercent: 0,

      documents: 0,
      type: null, // Will be set after analysis
      icon: '📁',
      lastModified: now,
      createdAt: now,
      status: 'active',
      uploadedFiles: [],
      analysis: null,
      chatHistory: [],

      // Configurações avançadas (igual Claude.ai) - Usar settings do body ou defaults
      settings: {
        autoAnalyze: settings.autoAnalyze !== undefined ? settings.autoAnalyze : true,
        smartSuggestions: settings.smartSuggestions !== undefined ? settings.smartSuggestions : true,
        modelPreference: settings.modelPreference || 'us.amazon.nova-pro-v1:0',
        temperature: settings.temperature !== undefined ? Number(settings.temperature) : 0.7
      }
    };

    saveProject(project);
    console.log(`✅ Projeto criado: ${project.name} (ID: ${projectId}, KB: ${kbMaxSizeMB}MB, CustomInstructions: ${customInstructions ? 'Sim' : 'Não'})`);

    res.json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/upload - Upload de documentos com KB tracking (SEM GASTAR TOKENS)
app.post('/api/projects/:id/upload', upload.array('files', 20), async (req, res) => {
  try {
    const { id } = req.params;
    const project = projectsStore.get(id);

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    // Calcular tamanho total dos novos arquivos
    const newFilesSizeMB = req.files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024);
    const projectedTotalMB = (project.kbCurrentSizeMB || 0) + newFilesSizeMB;

    // Verificar se excede o limite do KB
    const kbMaxMB = project.kbMaxSizeMB || 500;
    if (projectedTotalMB > kbMaxMB) {
      return res.status(413).json({
        error: 'Limite de KB excedido',
        message: `Upload de ${newFilesSizeMB.toFixed(2)}MB excederia o limite de ${kbMaxMB}MB (uso atual: ${(project.kbCurrentSizeMB || 0).toFixed(2)}MB)`,
        currentUsageMB: project.kbCurrentSizeMB || 0,
        maxSizeMB: kbMaxMB,
        attemptedUploadMB: newFilesSizeMB,
        projectedTotalMB: projectedTotalMB.toFixed(2)
      });
    }

    // Add uploaded files to project
    const uploadedFiles = req.files.map(file => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: file.originalname,
      path: file.path,
      size: file.size,
      type: file.mimetype,
      uploadedAt: new Date().toISOString()
    }));

    project.uploadedFiles.push(...uploadedFiles);
    project.documents = project.uploadedFiles.length;

    // Atualizar KB usage
    project.kbCurrentSizeMB = projectedTotalMB;
    project.kbUsagePercent = Math.round((projectedTotalMB / kbMaxMB) * 100);

    project.lastModified = new Date().toISOString();

    saveProject(project);
    console.log(`✅ ${uploadedFiles.length} documentos enviados para projeto ${id} (KB: ${project.kbCurrentSizeMB.toFixed(2)}/${kbMaxMB}MB - ${project.kbUsagePercent}%)`);

    res.json({
      success: true,
      project,
      uploadedFiles,
      kbUsage: {
        currentMB: project.kbCurrentSizeMB.toFixed(2),
        maxMB: kbMaxMB,
        usagePercent: project.kbUsagePercent,
        remainingMB: (kbMaxMB - project.kbCurrentSizeMB).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/analyze - Analisar documentos e sugerir instrumento
app.post('/api/projects/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const project = projectsStore.get(id);

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    if (project.uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'Nenhum documento para analisar' });
    }

    // Simulate AI analysis (in production, use actual AI analysis)
    const instrumentTypes = [
      { type: 'peticao_inicial', name: 'Petição Inicial', icon: '⚖️', confidence: 0.92 },
      { type: 'recurso_apelacao', name: 'Recurso de Apelação', icon: '📋', confidence: 0.88 },
      { type: 'habeas_corpus', name: 'Habeas Corpus', icon: '⚖️', confidence: 0.85 },
      { type: 'agravo_instrumento', name: 'Agravo de Instrumento', icon: '⚡', confidence: 0.80 }
    ];

    const suggested = instrumentTypes[Math.floor(Math.random() * instrumentTypes.length)];

    const analysis = {
      analyzedAt: new Date().toISOString(),
      documentCount: project.uploadedFiles.length,
      suggested: suggested,
      reasoning: `Baseado na análise dos ${project.uploadedFiles.length} documentos enviados, o sistema identificou que ${suggested.name} é o instrumento mais adequado para este caso.`,
      legalBasis: ['Art. 319 CPC', 'Art. 1007 CPC'],
      estimatedLength: '15-25 páginas'
    };

    project.analysis = analysis;
    project.type = suggested.name;
    project.icon = suggested.icon;
    project.lastModified = new Date().toISOString();

    saveProject(project);
    console.log(`✅ Análise concluída para projeto ${id}: ${suggested.name}`);

    res.json({
      success: true,
      project,
      analysis
    });
  } catch (error) {
    console.error('Erro ao analisar projeto:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/confirm - Confirmar sugestão e iniciar redação
app.post('/api/projects/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const project = projectsStore.get(id);

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    if (!project.analysis) {
      return res.status(400).json({ error: 'Projeto não foi analisado ainda' });
    }

    project.status = 'confirmed';
    project.lastModified = new Date().toISOString();

    saveProject(project);
    console.log(`✅ Sugestão confirmada para projeto ${id}`);

    res.json({
      success: true,
      project,
      message: 'Sugestão confirmada. Pronto para redigir.'
    });
  } catch (error) {
    console.error('Erro ao confirmar sugestão:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/projects/:id/chat - Chat específico do projeto
app.post('/api/projects/:id/chat', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const project = projectsStore.get(id);

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }

    // Add user message to chat history
    project.chatHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Simulate AI response (in production, use actual AI)
    const response = `Resposta ao projeto "${project.name}": ${message}`;

    project.chatHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });

    project.lastModified = new Date().toISOString();

    saveProject(project);

    res.json({
      success: true,
      response,
      chatHistory: project.chatHistory
    });
  } catch (error) {
    console.error('Erro no chat do projeto:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/projects/:id - Excluir projeto
app.delete('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const project = projectsStore.get(id);

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    projectsStore.delete(id);
    console.log(`✅ Projeto ${id} excluído`);

    res.json({
      success: true,
      message: 'Projeto excluído com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir projeto:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// KB MONITORING & STATISTICS API
// ============================================

// GET /api/kb/stats - Estatísticas completas do KB
app.get('/api/kb/stats', (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '../upload');
    const kbDir = path.join(__dirname, '../KB');

    // Calcular estatísticas
    const projects = Array.from(projectsStore.values());
    const totalFiles = projects.reduce((sum, p) => sum + (p.uploadedFiles?.length || 0), 0);
    const totalSize = projects.reduce((sum, p) => {
      return sum + (p.uploadedFiles || []).reduce((s, f) => s + (f.size || 0), 0);
    }, 0);

    // Estatísticas por tipo de arquivo
    const fileTypes = {};
    projects.forEach(project => {
      (project.uploadedFiles || []).forEach(file => {
        const ext = path.extname(file.name).toLowerCase();
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      });
    });

    // Projetos por status
    const projectsByStatus = {
      active: projects.filter(p => p.status === 'active').length,
      confirmed: projects.filter(p => p.status === 'confirmed').length,
      completed: projects.filter(p => p.status === 'completed').length
    };

    // Cálculos
    const avgProjectSize = projects.length > 0 ? totalSize / projects.length : 0;
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    const maxFiles = 20; // por upload

    res.json({
      success: true,
      stats: {
        // Projetos
        totalProjects: projects.length,
        projectsByStatus,

        // Arquivos
        totalFiles,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        avgProjectSize,
        avgProjectSizeFormatted: formatBytes(avgProjectSize),

        // Tipos de arquivo
        fileTypes,

        // Limites
        limits: {
          maxFileSize,
          maxFileSizeFormatted: formatBytes(maxFileSize),
          maxFilesPerUpload: maxFiles,
          comparison: 'ROM Agent: 100MB vs Claude: 25MB (4x maior)'
        },

        // Capacidade
        capacity: {
          currentUsage: totalSize,
          currentUsageFormatted: formatBytes(totalSize),
          availableSpace: '10 GB', // Atualizar baseado no plano
          percentUsed: 0 // Calcular baseado no plano
        },

        // Performance
        performance: {
          tokensUsedOnUpload: 0, // Upload não gasta tokens!
          processingAsync: true,
          averageUploadTime: '< 2 segundos'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/kb/projects-summary - Resumo rápido de projetos
app.get('/api/kb/projects-summary', (req, res) => {
  try {
    const projects = Array.from(projectsStore.values());

    const summary = projects.map(project => ({
      id: project.id,
      name: project.name,
      documentsCount: project.uploadedFiles?.length || 0,
      totalSize: (project.uploadedFiles || []).reduce((sum, f) => sum + (f.size || 0), 0),
      type: project.type,
      status: project.status,
      lastModified: project.lastModified
    })).sort((a, b) => b.totalSize - a.totalSize);

    res.json({
      success: true,
      summary,
      totalProjects: projects.length
    });
  } catch (error) {
    console.error('Erro ao obter resumo:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ====================================================================
// PRELOAD DE MODELOS - Eliminar Cold Start
// ====================================================================
async function preloadModelos() {
  console.log('🔥 Pré-aquecendo modelos Bedrock...');

  const { conversar } = await import('./modules/bedrock.js');
  const modelos = [
    'us.amazon.nova-lite-v1:0',
    'us.amazon.nova-pro-v1:0',
    'us.anthropic.claude-haiku-4-5-20251001-v1:0'
  ];

  for (const modelo of modelos) {
    try {
      await conversar('ping', { modelo, maxTokens: 10 });
      console.log(`✅ ${modelo} pré-aquecido`);
    } catch (err) {
      console.log(`⚠️ Erro ao pré-aquecer ${modelo}`);
    }
  }

  console.log('✅ Preload concluído!');
}

// Keep-alive: repreload a cada 5min
setInterval(async () => {
  await preloadModelos();
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════
// PHASE 4 & 5 - API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Semantic Search - TF-IDF Local (público)
app.post('/api/semantic-search', searchLimiter, async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    logger.info(`Semantic search: "${query}"`);

    // Buscar documentos na Knowledge Base
    const kbPath = path.join(__dirname, '../KB/ROM');
    const documents = [];

    // Ler todos os documentos das subpastas
    const folders = ['modelos', 'legislacao', 'jurisprudencia', 'doutrina'];

    for (const folder of folders) {
      const folderPath = path.join(kbPath, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);

        for (const file of files) {
          if (file.endsWith('.txt') || file.endsWith('.md')) {
            const filePath = path.join(folderPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            documents.push({
              filename: file,
              content,
              type: folder,
              path: filePath
            });
          }
        }
      }
    }

    if (documents.length === 0) {
      return res.json([]);
    }

    // Executar busca semântica
    const results = semanticSearch.search(query, documents, limit);

    logger.info(`Found ${results.length} results for "${query}"`);
    logKBOperation('semantic_search', {
      query,
      resultsCount: results.length,
      topScore: results[0]?.score || 0
    });

    res.json(results);
  } catch (error) {
    logger.error('Semantic search error:', error);
    res.status(500).json({ error: 'Erro ao realizar busca semântica' });
  }
});

// Templates Manager - List Templates (público)
app.get('/api/templates/list', generalLimiter, async (req, res) => {
  try {
    logger.info('Listing templates');

    const templates = templatesManager.listTemplates();

    // Garantir que sempre retornamos um array
    const templatesList = Array.isArray(templates) ? templates : [];

    logger.info(`Found ${templatesList.length} templates`);
    res.json(templatesList);
  } catch (error) {
    logger.error('Templates list error:', error);
    res.status(500).json({ error: 'Erro ao listar templates' });
  }
});

// Templates Manager - Get Template (público)
app.get('/api/templates/:templateId', generalLimiter, async (req, res) => {
  try {
    const { templateId } = req.params;

    logger.info(`Getting template: ${templateId}`);

    const template = templatesManager.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    res.json(template);
  } catch (error) {
    logger.error('Template get error:', error);
    res.status(500).json({ error: 'Erro ao obter template' });
  }
});

// Templates Manager - Render Template
app.post('/api/templates/render', generalLimiter, authSystem.authMiddleware(), async (req, res) => {
  try {
    const { templateId, variables } = req.body;

    if (!templateId || !variables) {
      return res.status(400).json({ error: 'templateId and variables are required' });
    }

    logger.info(`Rendering template: ${templateId}`);

    const rendered = templatesManager.renderTemplate(templateId, variables);

    logger.info(`Template ${templateId} rendered successfully`);
    res.json({ content: rendered });
  } catch (error) {
    logger.error('Template render error:', error);
    res.status(500).json({ error: error.message || 'Erro ao renderizar template' });
  }
});

// Versioning - Get Versions (público)
app.get('/api/versions/:documentId', generalLimiter, async (req, res) => {
  try {
    const { documentId } = req.params;

    logger.info(`Getting versions for document: ${documentId}`);

    const versions = documentVersioning.getVersions(documentId);

    logger.info(`Found ${versions.length} versions for ${documentId}`);
    res.json(versions);
  } catch (error) {
    logger.error('Versions get error:', error);
    res.status(500).json({ error: 'Erro ao obter versões' });
  }
});

// Versioning - Save Version
app.post('/api/versions/save', generalLimiter, authSystem.authMiddleware(), async (req, res) => {
  try {
    const { documentId, content, metadata = {} } = req.body;

    if (!documentId || !content) {
      return res.status(400).json({ error: 'documentId and content are required' });
    }

    logger.info(`Saving version for document: ${documentId}`);

    metadata.author = req.user?.name || 'System';
    const version = documentVersioning.saveVersion(documentId, content, metadata);

    logger.info(`Version saved: ${version.id}`);
    res.json(version);
  } catch (error) {
    logger.error('Version save error:', error);
    res.status(500).json({ error: 'Erro ao salvar versão' });
  }
});

// Versioning - Restore Version
app.post('/api/versions/restore', generalLimiter, authSystem.authMiddleware(), async (req, res) => {
  try {
    const { documentId, versionId } = req.body;

    if (!documentId || !versionId) {
      return res.status(400).json({ error: 'documentId and versionId are required' });
    }

    logger.info(`Restoring version ${versionId} for document ${documentId}`);

    const content = documentVersioning.restoreVersion(documentId, versionId);

    logger.info(`Version ${versionId} restored successfully`);
    res.json({ content });
  } catch (error) {
    logger.error('Version restore error:', error);
    res.status(500).json({ error: error.message || 'Erro ao restaurar versão' });
  }
});

// Versioning - Diff Versions
app.post('/api/versions/diff', generalLimiter, authSystem.authMiddleware(), async (req, res) => {
  try {
    const { documentId, versionId1, versionId2 } = req.body;

    if (!documentId || !versionId1 || !versionId2) {
      return res.status(400).json({ error: 'documentId, versionId1, and versionId2 are required' });
    }

    logger.info(`Comparing versions ${versionId1} and ${versionId2}`);

    const versions = documentVersioning.getVersions(documentId);
    const v1 = versions.find(v => v.id === versionId1);
    const v2 = versions.find(v => v.id === versionId2);

    if (!v1 || !v2) {
      return res.status(404).json({ error: 'Versões não encontradas' });
    }

    const diff = documentVersioning.diffVersions(v1, v2);

    logger.info(`Diff generated: ${diff.length} differences`);
    res.json(diff);
  } catch (error) {
    logger.error('Version diff error:', error);
    res.status(500).json({ error: 'Erro ao gerar diff' });
  }
});

// Backup - Status (público)
app.get('/api/backup/status', generalLimiter, async (req, res) => {
  try {
    logger.info('Getting backup status');

    const backupDir = path.join(__dirname, '../backups');

    if (!fs.existsSync(backupDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
      .map(f => {
        const filePath = path.join(backupDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          timestamp: stats.mtime
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    logger.info(`Found ${files.length} backups`);
    res.json(files);
  } catch (error) {
    logger.error('Backup status error:', error);
    res.status(500).json({ error: 'Erro ao verificar backups' });
  }
});

// Backup - Create Manual Backup
app.post('/api/backup/create', generalLimiter, authSystem.authMiddleware(), async (req, res) => {
  try {
    logger.info('Creating manual backup');

    const result = await backupManager.createBackup();

    logger.info(`Backup created: ${result.filename}`);
    res.json(result);
  } catch (error) {
    logger.error('Backup creation error:', error);
    res.status(500).json({ error: 'Erro ao criar backup' });
  }
});

// Backup - Download (público)
app.get('/api/backup/download/:filename', generalLimiter, async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename
    if (!filename.startsWith('backup-') || !filename.endsWith('.zip')) {
      return res.status(400).json({ error: 'Nome de arquivo inválido' });
    }

    const filePath = path.join(__dirname, '../backups', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup não encontrado' });
    }

    logger.info(`Downloading backup: ${filename}`);

    res.download(filePath, filename);
  } catch (error) {
    logger.error('Backup download error:', error);
    res.status(500).json({ error: 'Erro ao baixar backup' });
  }
});

logger.info('✅ Phase 4 & 5 API endpoints configured');

// ═══════════════════════════════════════════════════════════════
// CONVERSATIONS API - Sistema de Histórico como Claude.ai
// ═══════════════════════════════════════════════════════════════

// Criar nova conversa
app.post('/api/conversations/create', generalLimiter, (req, res) => {
  try {
    const userId = req.session.userId || 'anonymous';
    const sessionId = req.session.id;
    const { projectId = null } = req.body;

    const conversationId = conversationsManager.createConversation(userId, sessionId, projectId);

    logger.info(`New conversation created: ${conversationId}${projectId ? ` (project: ${projectId})` : ''}`);
    res.json({ success: true, conversationId });
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ error: 'Erro ao criar conversa' });
  }
});

// Criar nova conversa (alias para compatibilidade - POST /api/conversations)
app.post('/api/conversations', generalLimiter, (req, res) => {
  try {
    const userId = req.session.userId || 'anonymous';
    const sessionId = req.session.id;
    const { title = 'Nova conversa', messages = [], projectId = null } = req.body;

    const conversationId = conversationsManager.createConversation(userId, sessionId, projectId);

    // Se houver mensagens no body (para importação), adicionar
    if (messages && messages.length > 0) {
      const conversation = conversationsManager.loadConversations()[conversationId];
      if (conversation) {
        conversation.messages = messages;
        conversation.title = title;
        conversation.messageCount = messages.length;
        conversationsManager.saveConversations(conversationsManager.loadConversations());
      }
    }

    logger.info(`New conversation created: ${conversationId}${projectId ? ` (project: ${projectId})` : ''}`);
    res.json({ success: true, conversationId, conversation: conversationsManager.loadConversations()[conversationId] });
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ error: 'Erro ao criar conversa' });
  }
});

// Listar conversas (com paginação, busca e filtro por projeto)
app.get('/api/conversations/list', generalLimiter, (req, res) => {
  try {
    const userId = req.session.userId || 'anonymous';
    const { limit = 50, offset = 0, search = '', projectId = null } = req.query;

    const result = conversationsManager.listConversations(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      search,
      projectId
    });

    logger.info(`Listed ${result.conversations.length} conversations for user ${userId}${projectId ? ` (project: ${projectId})` : ''}`);
    res.json(result);
  } catch (error) {
    logger.error('List conversations error:', error);
    res.status(500).json({ error: 'Erro ao listar conversas' });
  }
});

// Listar conversas organizadas por data (Hoje, Ontem, etc.)
app.get('/api/conversations/organized', generalLimiter, (req, res) => {
  try {
    const userId = req.session.userId || 'anonymous';
    const { projectId = null } = req.query;
    const organized = conversationsManager.organizeByDate(userId, projectId);

    logger.info(`Organized conversations for user ${userId}${projectId ? ` (project: ${projectId})` : ''}`);
    res.json({ success: true, organized });
  } catch (error) {
    logger.error('Organize conversations error:', error);
    res.status(500).json({ error: 'Erro ao organizar conversas' });
  }
});

// Obter conversa específica
app.get('/api/conversations/:conversationId', generalLimiter, (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = conversationsManager.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    logger.info(`Retrieved conversation: ${conversationId}`);
    res.json({ success: true, conversation });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ error: 'Erro ao obter conversa' });
  }
});

// Renomear conversa
app.put('/api/conversations/:conversationId/rename', generalLimiter, (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Título não pode ser vazio' });
    }

    const success = conversationsManager.renameConversation(conversationId, title);

    if (!success) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    logger.info(`Renamed conversation ${conversationId} to: ${title}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Rename conversation error:', error);
    res.status(500).json({ error: 'Erro ao renomear conversa' });
  }
});

// Deletar conversa
app.delete('/api/conversations/:conversationId', generalLimiter, (req, res) => {
  try {
    const { conversationId } = req.params;
    const success = conversationsManager.deleteConversation(conversationId);

    if (!success) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    logger.info(`Deleted conversation: ${conversationId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Erro ao deletar conversa' });
  }
});

// Deletar múltiplas conversas
app.post('/api/conversations/delete-multiple', generalLimiter, (req, res) => {
  try {
    const { conversationIds } = req.body;

    if (!Array.isArray(conversationIds)) {
      return res.status(400).json({ error: 'conversationIds deve ser um array' });
    }

    const deleted = conversationsManager.deleteMultipleConversations(conversationIds);

    logger.info(`Deleted ${deleted} conversations`);
    res.json({ success: true, deleted });
  } catch (error) {
    logger.error('Delete multiple conversations error:', error);
    res.status(500).json({ error: 'Erro ao deletar conversas' });
  }
});

// Exportar conversa
app.get('/api/conversations/:conversationId/export', generalLimiter, (req, res) => {
  try {
    const { conversationId } = req.params;
    const exported = conversationsManager.exportConversation(conversationId);

    if (!exported) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    // Define o nome do arquivo
    const filename = `conversa-${conversationId}-${Date.now()}.json`;

    logger.info(`Exported conversation: ${conversationId}`);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exported);
  } catch (error) {
    logger.error('Export conversation error:', error);
    res.status(500).json({ error: 'Erro ao exportar conversa' });
  }
});

// Obter estatísticas de conversas
app.get('/api/conversations/stats', generalLimiter, (req, res) => {
  try {
    const userId = req.session.userId || 'anonymous';
    const stats = conversationsManager.getStats(userId);

    logger.info(`Retrieved conversation stats for user ${userId}`);
    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Get conversation stats error:', error);
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

// Limpar conversas antigas
app.post('/api/conversations/clean-old', generalLimiter, (req, res) => {
  try {
    const userId = req.session.userId || 'anonymous';
    const { daysOld = 30 } = req.body;

    const deleted = conversationsManager.cleanOldConversations(userId, daysOld);

    logger.info(`Cleaned ${deleted} old conversations for user ${userId}`);
    res.json({ success: true, deleted });
  } catch (error) {
    logger.error('Clean old conversations error:', error);
    res.status(500).json({ error: 'Erro ao limpar conversas antigas' });
  }
});

// Vincular conversa a projeto
app.put('/api/conversations/:conversationId/link-project', generalLimiter, (req, res) => {
  try {
    const { conversationId } = req.params;
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId é obrigatório' });
    }

    const success = conversationsManager.linkToProject(conversationId, projectId);

    if (!success) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    logger.info(`Linked conversation ${conversationId} to project ${projectId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Link to project error:', error);
    res.status(500).json({ error: 'Erro ao vincular conversa ao projeto' });
  }
});

// Desvincular conversa de projeto
app.put('/api/conversations/:conversationId/unlink-project', generalLimiter, (req, res) => {
  try {
    const { conversationId } = req.params;
    const success = conversationsManager.unlinkFromProject(conversationId);

    if (!success) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    logger.info(`Unlinked conversation ${conversationId} from project`);
    res.json({ success: true });
  } catch (error) {
    logger.error('Unlink from project error:', error);
    res.status(500).json({ error: 'Erro ao desvincular conversa do projeto' });
  }
});

logger.info('✅ Conversations API endpoints configured');

// ============================================================================
// API - SISTEMA DE TARIFAÇÃO
// ============================================================================

/**
 * Calcula custo estimado de uma operação antes de executar
 * POST /api/pricing/calculate
 * Body: { operation, inputTokens, outputTokens, model }
 */
app.post('/api/pricing/calculate', generalLimiter, (req, res) => {
  try {
    const { operation, inputTokens, outputTokens, model = 'sonnet' } = req.body;

    // Tabela de preços (por 1K tokens)
    const pricing = {
      'haiku': { input: 0.00025, output: 0.00125 },
      'sonnet': { input: 0.003, output: 0.015 },
      'opus': { input: 0.015, output: 0.075 }
    };

    const modelPricing = pricing[model.toLowerCase()] || pricing['sonnet'];

    // Calcular custos
    const inputCost = (inputTokens / 1000) * modelPricing.input;
    const outputCost = (outputTokens / 1000) * modelPricing.output;
    const totalCost = inputCost + outputCost;

    // Custos adicionais
    const iof = 0.0638; // IOF 6.38% para transações internacionais
    const markup = 0.30; // Markup de 30%

    // Calcular custo final com todos os encargos
    const costWithIOF = totalCost * (1 + iof); // Custo + IOF
    const finalCost = costWithIOF * (1 + markup); // Custo + IOF + Markup 30%

    // Estimativas por tipo de operação
    const estimates = {
      'peticao-inicial': { input: 5000, output: 8000 },
      'contestacao': { input: 4000, output: 7000 },
      'recurso': { input: 6000, output: 10000 },
      'habeas-corpus': { input: 4000, output: 6000 },
      'extracao-pdf': { input: 3000, output: 1000 },
      'resumo-executivo': { input: 7000, output: 3000 }
    };

    const operationEstimate = estimates[operation] || { input: 5000, output: 8000 };

    logger.info('Cálculo de tarifação', {
      operation,
      model,
      inputTokens: inputTokens || operationEstimate.input,
      outputTokens: outputTokens || operationEstimate.output,
      cost: finalCost.toFixed(4)
    });

    res.json({
      success: true,
      pricing: {
        model,
        operation,
        inputTokens: inputTokens || operationEstimate.input,
        outputTokens: outputTokens || operationEstimate.output,
        breakdown: {
          inputCost: inputCost.toFixed(6),
          outputCost: outputCost.toFixed(6),
          subtotal: totalCost.toFixed(6),
          iof: (totalCost * iof).toFixed(6),
          iofPercentage: '6.38%',
          subtotalWithIOF: costWithIOF.toFixed(6),
          markup: (costWithIOF * markup).toFixed(6),
          markupPercentage: '30%'
        },
        total: {
          usd: finalCost.toFixed(4),
          brl: (finalCost * 5.80).toFixed(2)
        },
        currency: 'USD',
        exchangeRate: 5.80
      },
      comparison: {
        haiku: ((((operationEstimate.input / 1000) * pricing.haiku.input) + ((operationEstimate.output / 1000) * pricing.haiku.output)) * (1 + iof) * (1 + markup)).toFixed(4),
        sonnet: ((((operationEstimate.input / 1000) * pricing.sonnet.input) + ((operationEstimate.output / 1000) * pricing.sonnet.output)) * (1 + iof) * (1 + markup)).toFixed(4),
        opus: ((((operationEstimate.input / 1000) * pricing.opus.input) + ((operationEstimate.output / 1000) * pricing.opus.output)) * (1 + iof) * (1 + markup)).toFixed(4)
      },
      notes: [
        'Custos incluem IOF de 6.38% para transações internacionais',
        'Markup de 30% aplicado sobre custo + IOF',
        'Conversão BRL baseada na cotação atual (exemplo: R$ 5,80)',
        'Valores finais já incluem TODOS os custos'
      ]
    });

  } catch (error) {
    logger.error('Erro ao calcular tarifação', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Baixar certidão do DJe/DJEN (CNJ)
 * POST /api/certidoes/baixar
 *
 * Integração com CNJ para download automático de certidões
 * e cálculo de prazos processuais
 */
app.post('/api/certidoes/baixar', authSystem.authMiddleware(), async (req, res) => {
  try {
    const { numeroProcesso, tribunal, dataPublicacao, tipo, adicionarAoKB } = req.body;

    // Validação
    if (!numeroProcesso) {
      return res.status(400).json({
        success: false,
        error: 'Número do processo é obrigatório'
      });
    }

    logger.info('📄 Baixando certidão DJe/DJEN', {
      numeroProcesso,
      tribunal,
      tipo: tipo || 'dje'
    });

    // Baixar certidão via serviço
    const certidao = await certidoesDJEService.baixarCertidao({
      numeroProcesso,
      tribunal: tribunal || 'TJRJ',
      dataPublicacao,
      tipo: tipo || 'dje',
      projectId: '1',  // Projeto ROM
      adicionarAoKB: adicionarAoKB !== false  // Padrão: true
    });

    logger.info('✅ Certidão baixada com sucesso', {
      numeroCertidao: certidao.numeroCertidao,
      prazoFinal: certidao.prazo?.dataFinal
    });

    res.json({
      success: true,
      certidao,
      message: `Certidão baixada${adicionarAoKB !== false ? ' e adicionada ao KB' : ''} com sucesso`,
      prazo: certidao.prazo ? {
        dataPublicacao: certidao.prazo.dataPublicacao,
        primeiroDiaUtil: certidao.prazo.primeiroDiaUtil,
        dataFinal: certidao.prazo.dataFinal,
        diasUteis: certidao.prazo.diasUteis
      } : null
    });

  } catch (error) {
    logger.error('❌ Erro ao baixar certidão', {
      error: error.message,
      numeroProcesso: req.body.numeroProcesso
    });

    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * Obter tabela de preços completa
 * GET /api/pricing/table
 */
app.get('/api/pricing/table', (req, res) => {
  try {
    const pricing = [
      {
        model: 'Claude Haiku',
        tier: 'Econômico',
        inputPrice: '$0.00025/1K',
        outputPrice: '$0.00125/1K',
        recommended: 'Extração, resumos simples',
        speed: 'Muito rápido',
        quality: 'Boa'
      },
      {
        model: 'Claude Sonnet 4.5',
        tier: 'Balanceado',
        inputPrice: '$0.003/1K',
        outputPrice: '$0.015/1K',
        recommended: 'Petições, recursos, peças jurídicas',
        speed: 'Rápido',
        quality: 'Excelente'
      },
      {
        model: 'Claude Opus',
        tier: 'Premium',
        inputPrice: '$0.015/1K',
        outputPrice: '$0.075/1K',
        recommended: 'Casos críticos, recursos extraordinários',
        speed: 'Moderado',
        quality: 'Máxima'
      }
    ];

    const examples = [
      {
        operation: 'Petição Inicial Simples (Sonnet)',
        input: 5000,
        output: 8000,
        cost: '$0.135',
        costBRL: 'R$ 0,78'
      },
      {
        operation: 'Extração de PDF (Haiku)',
        input: 3000,
        output: 1000,
        cost: '$0.002',
        costBRL: 'R$ 0,01'
      },
      {
        operation: 'Recurso Extraordinário (Opus)',
        input: 7000,
        output: 12000,
        cost: '$1.005',
        costBRL: 'R$ 5,83'
      }
    ];

    res.json({
      success: true,
      pricing,
      examples,
      markup: '30%',
      notes: [
        'Preços incluem markup de 30% sobre custo real',
        'Valores em USD (conversão BRL é estimada)',
        'Haiku é 67x mais barato que Opus',
        'Sonnet oferece melhor custo-benefício'
      ]
    });

  } catch (error) {
    logger.error('Erro ao obter tabela de preços', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Calcular custo estimado por tipo de peça
 * GET /api/pricing/estimate/:pieceType
 */
app.get('/api/pricing/estimate/:pieceType', (req, res) => {
  try {
    const { pieceType } = req.params;
    const { model = 'sonnet' } = req.query;

    const estimates = {
      'peticao-inicial': { name: 'Petição Inicial', input: 5000, output: 8000, complexity: 'média' },
      'contestacao': { name: 'Contestação', input: 4000, output: 7000, complexity: 'média' },
      'recurso-apelacao': { name: 'Recurso de Apelação', input: 6000, output: 10000, complexity: 'alta' },
      'recurso-especial': { name: 'Recurso Especial', input: 7000, output: 12000, complexity: 'muito alta' },
      'recurso-extraordinario': { name: 'Recurso Extraordinário', input: 7000, output: 12000, complexity: 'muito alta' },
      'habeas-corpus': { name: 'Habeas Corpus', input: 4000, output: 6000, complexity: 'média' },
      'mandado-seguranca': { name: 'Mandado de Segurança', input: 5000, output: 8000, complexity: 'média' },
      'agravo-instrumento': { name: 'Agravo de Instrumento', input: 4000, output: 6000, complexity: 'média' },
      'embargos-declaracao': { name: 'Embargos de Declaração', input: 3000, output: 4000, complexity: 'baixa' },
      'alegacoes-finais': { name: 'Alegações Finais', input: 6000, output: 9000, complexity: 'alta' },
      'parecer-juridico': { name: 'Parecer Jurídico', input: 5000, output: 7000, complexity: 'média' },
      'contrato': { name: 'Contrato', input: 4000, output: 6000, complexity: 'média' }
    };

    const estimate = estimates[pieceType];

    if (!estimate) {
      return res.status(404).json({
        error: 'Tipo de peça não encontrado',
        availableTypes: Object.keys(estimates)
      });
    }

    const pricing = {
      'haiku': { input: 0.00025, output: 0.00125 },
      'sonnet': { input: 0.003, output: 0.015 },
      'opus': { input: 0.015, output: 0.075 }
    };

    const modelPricing = pricing[model.toLowerCase()] || pricing['sonnet'];
    const inputCost = (estimate.input / 1000) * modelPricing.input;
    const outputCost = (estimate.output / 1000) * modelPricing.output;
    const subtotal = inputCost + outputCost;

    // Adicionar IOF (6.38%) e Markup (30%)
    const iof = 0.0638;
    const markup = 0.30;
    const costWithIOF = subtotal * (1 + iof);
    const totalCost = costWithIOF * (1 + markup);

    res.json({
      success: true,
      piece: {
        type: pieceType,
        name: estimate.name,
        complexity: estimate.complexity,
        estimatedTokens: {
          input: estimate.input,
          output: estimate.output,
          total: estimate.input + estimate.output
        }
      },
      pricing: {
        model,
        cost: {
          usd: totalCost.toFixed(4),
          brl: (totalCost * 5.80).toFixed(2)
        },
        breakdown: {
          inputCost: inputCost.toFixed(6),
          outputCost: outputCost.toFixed(6),
          subtotal: subtotal.toFixed(6),
          iof: (subtotal * iof).toFixed(6) + ' (6.38%)',
          markup: (costWithIOF * markup).toFixed(6) + ' (30%)',
          total: totalCost.toFixed(4)
        },
        notes: [
          'Inclui IOF de 6.38% para transações internacionais',
          'Inclui Markup de 30% sobre custo + IOF',
          'Valor final já contempla TODOS os encargos'
        ]
      },
      recommendation: estimate.complexity === 'muito alta' ? 'opus' : estimate.complexity === 'alta' ? 'sonnet' : 'haiku'
    });

  } catch (error) {
    logger.error('Erro ao estimar custo de peça', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

logger.info('✅ Pricing API endpoints configured');

// ============================================================================
// PR#2: OBSERVABILITY ENDPOINTS
// ============================================================================

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: dbHealth
  });
});

// DATABASE DIAGNOSTIC ENDPOINT - exposes exact connection error
app.get('/api/db-diagnose', async (req, res) => {
  const diagnostic = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
      DATABASE_URL_LENGTH: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
      DATABASE_URL_PREFIX: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'NOT SET'
    },
    connectionTest: null,
    error: null
  };

  // Try to connect fresh
  try {
    const pg = (await import('pg')).default;
    const testClient = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000
    });

    const startTime = Date.now();
    await testClient.connect();
    const latency = Date.now() - startTime;
    await testClient.query('SELECT NOW()');
    await testClient.end();

    diagnostic.connectionTest = {
      success: true,
      latency: `${latency}ms`,
      message: 'PostgreSQL conectado com sucesso!'
    };
  } catch (error) {
    diagnostic.error = {
      message: error.message,
      code: error.code,
      stack: error.stack,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname
    };
    diagnostic.connectionTest = {
      success: false,
      message: 'Falha ao conectar PostgreSQL'
    };
  }

  res.json(diagnostic);
});

// Metrics endpoint (Prometheus format)
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await metricsCollector.exportPrometheus();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    structuredLogger.error('Error exporting metrics', { error });
    res.status(500).send('# Error exporting metrics\n');
  }
});

// Admin middleware
const requireAdminToken = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    structuredLogger.error('ADMIN_TOKEN not configured');
    return res.status(500).json({
      success: false,
      error: 'Admin authentication not configured'
    });
  }

  if (!token || token !== adminToken) {
    structuredLogger.warn('Unauthorized admin access attempt', {
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
    structuredLogger.info('Admin flags read', { ip: req.ip });
    res.json({
      success: true,
      flags,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    structuredLogger.error('Error getting flags', { error });
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
    structuredLogger.info('Feature flags reloaded by admin', {
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
    structuredLogger.error('Error reloading flags', { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

logger.info('✅ PR#2 Observability endpoints configured');

// ============================================================================
// PWA FILES - Serve manifest.json e service-worker.js
// ============================================================================
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    name: "ROM Agent - Redator de Obras Magistrais",
    short_name: "ROM Agent",
    description: "Assistente de IA para redação de peças jurídicas",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a365d",
    orientation: "portrait-primary",
    icons: [
      { src: "/img/logo_rom.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/img/logo_rom.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ],
    categories: ["productivity", "business"]
  });
});

app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.send(`const CACHE_NAME='rom-agent-v1';const ASSETS_TO_CACHE=['/','/manifest.json'];self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS_TO_CACHE).catch(()=>{})).then(()=>self.skipWaiting()))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n!==CACHE_NAME).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{if(e.request.url.includes('/api/')){e.respondWith(fetch(e.request));return}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(f=>caches.open(CACHE_NAME).then(c=>{if(e.request.method==='GET')c.put(e.request,f.clone());return f}))).catch(()=>{if(e.request.destination==='document')return caches.match('/')}))});`);
});

// ============================================================================
// SPA FALLBACK - Serve index.html para React Router (todas as rotas não-API)
// ============================================================================
app.get('*', (req, res, next) => {
  // Apenas para requisições HTML (não API, não assets)
  if (req.path.startsWith('/api/') || req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json)$/i)) {
    return next();
  }

  // Servir index.html do React SPA se existe, senão continuar para 404
  const frontendIndexPath = path.join(__dirname, '../frontend/dist/index.html');

  if (fs.existsSync(frontendIndexPath)) {
    return res.sendFile(frontendIndexPath);
  }

  // Fallback para HTML antigo (não deveria acontecer, mas mantém compatibilidade)
  next();
});

// ============================================================================

// Iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  // Database já foi inicializado no início do arquivo (antes de criar session middleware)
  console.log('🚀 [SERVER] Servidor iniciado na porta', PORT);
  console.log('🚀 [SERVER] Database já inicializado - session store configurado');

  // Configurar armazenamento persistente
  logger.info('Configurando armazenamento persistente...');
  ensureStorageStructure();
  logger.info(`Armazenamento: ${STORAGE_INFO.environment} (${STORAGE_INFO.diskSize})`);
  logger.info(`Base: ${STORAGE_INFO.basePath}`);

  // Ativar sistema de auto-atualização e aprendizado
  logger.info('Ativando sistema de auto-atualização e aprendizado...');
  autoUpdateSystem.ativar();
  logger.info('Sistema de auto-atualização ATIVO - Verificação a cada 24h');

  // Ativar scheduler de jobs automáticos (deploy 02h + health check)
  logger.info('Ativando scheduler de jobs automáticos...');
  scheduler.start();
  logger.info('Scheduler ATIVO - Deploy às 02h + Health check por hora');

  // Ativar backup automático diário (03h)
  logger.info('Agendando backup automático diário...');
  backupManager.scheduleBackup('03:00');
  logger.info('Backup automático ATIVO - Execução às 03h diariamente');

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
║   Servidor Web MELHORADO - v2.0                              ║
║   Acesse: http://localhost:${PORT}                            ║
║                                                              ║
║   Funcionalidades:                                           ║
║   ✓ Upload de arquivos (PDF/DOCX)                           ║
║   ✓ Histórico de conversas                                  ║
║   ✓ Formatação Markdown                                     ║
║   ✓ Tema dark/light                                         ║
║   ✓ Autenticação básica                                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Carregar projetos do arquivo
  loadProjectsFromFile();

  // Carregar customizações de prompts dos parceiros
  loadPartnerPrompts();

  // Inicializar Projeto ROM
  romProjectService.init()
    .then(() => {
      const stats = romProjectService.getStatistics();
      logger.info(`✅ Projeto ROM carregado: ${stats.prompts.total} prompts disponíveis`);
    })
    .catch(error => {
      logger.error('Erro ao inicializar Projeto ROM:', error);
    });

  // Inicializar ROM Case Processor (Sistema de Extração + 5 Layers)
  romCaseProcessorService.init()
    .then(() => {
      logger.info('✅ ROM Case Processor inicializado - Sistema de extração e processamento de casos ativo');
    })
    .catch(error => {
      logger.error('Erro ao inicializar ROM Case Processor:', error);
    });

  // Inicializar Multi-Agent Pipeline Service (Sistema de análise de processos grandes 6700+ páginas)
  multiAgentPipelineService.init()
    .then(() => {
      logger.info('✅ Multi-Agent Pipeline Service inicializado - Suporte a documentos 6700+ páginas com múltiplos modelos IA');
    })
    .catch(error => {
      logger.error('Erro ao inicializar Multi-Agent Pipeline Service:', error);
    });

  // 🚨 Criar pasta Desktop/Mesa para UPLOADS MANUAIS DE EMERGÊNCIA
  // IMPORTANTE: Apenas o worker 1 monitora a pasta (evita duplicatas em cluster)
  const cluster = await import('cluster');
  const shouldInitWatcher = !cluster.default.isWorker || cluster.default.worker?.id === 1;

  if (!shouldInitWatcher) {
    logger.info('📂 Worker secundário - pulando inicialização do watcher de emergência');
  }

  try {
    const os = await import('os');
    const desktopPath = path.join(os.homedir(), 'Desktop', 'ROM-Uploads-Emergencia');

    // Criar pasta se não existir
    await fs.promises.mkdir(desktopPath, { recursive: true });

    // Criar arquivo README explicando como usar
    const readmePath = path.join(desktopPath, 'LEIA-ME.txt');
    const readmeContent = `
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║  📁 ROM - PASTA DE UPLOADS DE EMERGÊNCIA                      ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

🎯 COMO USAR:

1. Arraste e solte arquivos PDF ou DOCX nesta pasta
2. O sistema detectará automaticamente e iniciará o processamento
3. Os arquivos serão:
   ✅ Extraídos com 33 ferramentas de limpeza
   ✅ Salvos no Knowledge Base (KB)
   ✅ Indexados e analisados
   ✅ Disponibilizados para o chat

⚠️  IMPORTANTE:
   - Esta pasta é para USO DE EMERGÊNCIA
   - Use a interface web sempre que possível: https://iarom.com.br
   - Arquivos processados serão movidos para subpasta "processados/"

📊 STATUS DO MONITORAMENTO: ATIVO ✅
📅 Data de criação: ${new Date().toLocaleString('pt-BR')}

© 2025 ROM Agent - Redator de Obras Magistrais
`;

    await fs.promises.writeFile(readmePath, readmeContent, 'utf8');

    // Criar subpasta para arquivos processados
    await fs.promises.mkdir(path.join(desktopPath, 'processados'), { recursive: true });

    logger.info(`✅ Pasta de emergência criada: ${desktopPath}`);

    // 👁️ Monitorar pasta para novos arquivos - APENAS NO WORKER 1
    if (!shouldInitWatcher) {
      logger.info('⚠️  Watcher de emergência desabilitado para este worker');
      return;
    }

    logger.info('🎯 Inicializando watcher de emergência no Worker 1');

    // 👁️ Monitorar pasta para novos arquivos (usando chokidar que já está nas dependências)
    const chokidar = (await import('chokidar')).default;
    const watcher = chokidar.watch(desktopPath, {
      ignored: /(^|[\/\\])\../, // ignorar arquivos ocultos
      persistent: true,
      ignoreInitial: true, // não processar arquivos existentes na inicialização
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    watcher.on('add', async (filePath) => {
      // Ignorar arquivos da subpasta processados e README
      if (filePath.includes('processados') || filePath.includes('LEIA-ME')) {
        return;
      }

      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      // Apenas processar PDF e DOCX
      if (!['.pdf', '.docx'].includes(ext)) {
        logger.warn(`⚠️ Arquivo ignorado (formato não suportado): ${fileName}`);
        return;
      }

      logger.info(`🚨 UPLOAD DE EMERGÊNCIA detectado: ${fileName}`);

      try {
        // 🚀 PROCESSAR ARQUIVO COMPLETO (extração + documentos estruturados)
        logger.info(`📄 Processando ${fileName} com 33 ferramentas + documentos estruturados...`);
        const result = await processFile(filePath);

        if (result.success) {
          logger.info(`✅ Processamento concluído:`);
          logger.info(`   - Texto: ${result.extraction.charCount} caracteres`);
          logger.info(`   - Ferramentas: ${result.toolsUsed.length}`);
          logger.info(`   - Documentos estruturados: ${result.structuredDocuments?.filesGenerated || 0}`);

          // 💾 Copiar texto principal para KB para busca rápida
          // O processFile já salva tudo em data/extracted/ e data/extracted/structured/
          const extractedTextPath = path.join(process.cwd(), 'data', 'extracted', result.extracted);
          const extractedText = await fs.promises.readFile(extractedTextPath, 'utf8');

          const kbPath = path.join(ACTIVE_PATHS.kb, 'documents', `${Date.now()}_emergencia_${fileName}.txt`);
          await fs.promises.mkdir(path.dirname(kbPath), { recursive: true });
          await fs.promises.copyFile(extractedTextPath, kbPath);

          // Salvar metadados no KB
          const metadata = {
            source: 'emergency-upload-desktop',
            originalFilename: fileName,
            uploadedAt: new Date().toISOString(),
            extractedAt: new Date().toISOString(),
            textLength: result.extraction.charCount,
            wordCount: result.extraction.wordCount,
            toolsUsed: result.toolsUsed || [],
            structuredDocuments: result.structuredDocuments,
            structuredDocsPath: result.structuredDocuments?.outputPath,
            type: detectDocumentType(extractedText),
            processNumber: extractProcessNumber(extractedText),
            parties: extractParties(extractedText),
            court: extractCourt(extractedText)
          };

          const metadataPath = kbPath.replace('.txt', '.metadata.json');
          await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

          logger.info(`💾 Salvo no KB: ${path.basename(kbPath)}`);
          logger.info(`📁 Documentos estruturados em: ${result.structuredDocuments?.outputPath || 'N/A'}`);

          // 📁 CRIAR PASTA DE RESULTADOS com tudo organizado
          const timestamp = Date.now();
          const resultFolderName = `${timestamp}_${path.basename(fileName, path.extname(fileName))}_RESULTADO`;
          const resultFolder = path.join(desktopPath, resultFolderName);
          await fs.promises.mkdir(resultFolder, { recursive: true });

          // Salvar documento extraído na pasta de resultados
          const resultTextPath = path.join(resultFolder, 'documento_extraido.txt');
          await fs.promises.writeFile(resultTextPath, extractedText, 'utf8');

          // Salvar metadados na pasta de resultados
          const resultMetadataPath = path.join(resultFolder, 'metadados.json');
          await fs.promises.writeFile(resultMetadataPath, JSON.stringify(metadata, null, 2), 'utf8');

          // Copiar documentos estruturados para a pasta de resultados
          if (result.structuredDocuments?.outputPath) {
            const structuredFolder = path.join(resultFolder, 'documentos_estruturados');
            await fs.promises.mkdir(structuredFolder, { recursive: true });

            // Copiar todos os arquivos estruturados
            const structuredFiles = await fs.promises.readdir(result.structuredDocuments.outputPath);
            for (const file of structuredFiles) {
              const srcPath = path.join(result.structuredDocuments.outputPath, file);
              const destPath = path.join(structuredFolder, file);
              await fs.promises.copyFile(srcPath, destPath);
            }

            logger.info(`📋 ${structuredFiles.length} documentos estruturados copiados para Desktop`);
          }

          // Criar arquivo README explicativo
          const readmeResultPath = path.join(resultFolder, 'LEIA-ME.txt');
          const readmeContent = `
╔════════════════════════════════════════════════════════╗
║  📄 RESULTADO DA EXTRAÇÃO - ROM AGENT                 ║
╚════════════════════════════════════════════════════════╝

Arquivo Original: ${fileName}
Processado em: ${new Date().toLocaleString('pt-BR')}

📁 CONTEÚDO DESTA PASTA:

1. documento_extraido.txt
   → Texto completo extraído com 33 ferramentas
   → ${result.extraction.charCount.toLocaleString()} caracteres
   → ${result.toolsUsed?.length || 0} ferramentas utilizadas

2. documentos_estruturados/
   → ${result.structuredDocuments?.filesGenerated || 0} documentos organizados
   → Fichamento, índices, análises, entidades, etc.

3. metadados.json
   → Informações estruturadas do documento
   → Número do processo, partes, tribunal, tipo
   → Data de extração e upload

4. LEIA-ME.txt (este arquivo)
   → Explicação do conteúdo

✅ O documento também foi salvo no Knowledge Base
   e está disponível para consulta no chat!

Acesse: https://iarom.com.br/kb-documents.html

`;
          await fs.promises.writeFile(readmeResultPath, readmeContent, 'utf8');

          logger.info(`📁 Pasta de resultados criada: ${resultFolderName}`);

          // Mover arquivo original para "processados"
          const processedPath = path.join(desktopPath, 'processados', fileName);
          await fs.promises.rename(filePath, processedPath);

          logger.info(`📦 Arquivo movido para: processados/${fileName}`);
          logger.info(`✅ UPLOAD DE EMERGÊNCIA processado com sucesso!`);
          logger.info(`📂 Resultados disponíveis em: ${resultFolderName}`);

        } else {
          logger.error(`❌ Falha na extração de ${fileName}: ${result.error || 'Texto vazio'}`);
        }

      } catch (error) {
        logger.error(`❌ Erro ao processar upload de emergência ${fileName}:`, error);
      }
    });

    logger.info('👁️  Monitoramento de pasta Desktop/Mesa ATIVO');

  } catch (error) {
    logger.error('❌ Erro ao criar pasta de emergência:', error);
  }

  // Pré-carregar modelos
  await preloadModelos();
});

// ============================================================================
// GRACEFUL SHUTDOWN - Fechar conexões de banco ao encerrar
// ============================================================================
async function gracefulShutdown(signal) {
  logger.info(`${signal} recebido - encerrando gracefully...`);

  // Fechar conexões de banco de dados
  await closeDatabaseConnections();

  logger.info('Shutdown completo');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
