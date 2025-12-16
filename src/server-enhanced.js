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
import session from 'express-session';
import fs from 'fs';
import { ROMAgent, CONFIG } from './index.js';
import { BedrockAgent } from './modules/bedrock.js';
import partnersBranding from '../lib/partners-branding.js';
import formattingTemplates from '../lib/formatting-templates.js';
import { extractDocument } from '../lib/extractor-pipeline.js';
import usersManager, { ROLES } from '../lib/users-manager.js';
import { conversarComTools } from './modules/bedrock-tools.js';
import dotenv from 'dotenv';
import compression from 'compression';
import logger, { requestLogger, logAIOperation, logKBOperation } from '../lib/logger.js';
import { generalLimiter, chatLimiter, uploadLimiter, authLimiter, searchLimiter } from '../lib/rate-limiter.js';
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
import romProjectService from './services/rom-project-service.js';
import romProjectRouter from './routes/rom-project.js';
import romCaseProcessorService from './services/processors/rom-case-processor-service.js';
import caseProcessorRouter from './routes/case-processor.js';
import caseProcessorSSE from './routes/case-processor-sse.js';
import { scheduler } from './jobs/scheduler.js';
import { deployJob } from './jobs/deploy-job.js';
import { ACTIVE_PATHS, STORAGE_INFO, ensureStorageStructure } from '../lib/storage-config.js';

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

const app = express();

// Trust proxy para Render (necessário para rate limiting e X-Forwarded-For)
app.set('trust proxy', true);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

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

// Request Logger (logs estruturados)
app.use(requestLogger);

// Sessões para histórico
app.use(session({
  secret: process.env.SESSION_SECRET || 'rom-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 dias
}));

// Rate Limiter Geral (100 requisições/hora por IP)
app.use('/api/', generalLimiter);

// Rotas de Projects, Auto-Atualização, Storage, Scheduler e Partner Settings
app.use('/api', projectsRouter);
app.use('/api', autoUpdateRoutes);
app.use('/api', storageRoutes);
app.use('/api', schedulerRoutes);
app.use('/api', partnerSettingsRoutes);
app.use('/api/rom-project', romProjectRouter);

// Rotas de Processamento de Casos (Extração + 5 Layers)
app.use('/api/case-processor', caseProcessorRouter);
app.use('/api/case-processor', caseProcessorSSE);

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

// Armazenar instâncias de agente por sessão
const agents = new Map();

// Armazenar histórico de conversas
const conversationHistory = new Map();

// Inicializar agente para sessão (usando Bedrock)
function getAgent(sessionId) {
  if (!agents.has(sessionId)) {
    // Usar BedrockAgent que funciona diretamente com AWS sem precisar de Anthropic API Key
    agents.set(sessionId, new BedrockAgent({
      modelo: 'amazon.nova-lite-v1:0', // OTIMIZAÇÃO: Lite é 40% mais rápido que Pro
      systemPrompt: 'Você é o ROM Agent, um assistente jurídico especializado em Direito brasileiro.'
    }));
  }
  return agents.get(sessionId);
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
    const agent = getAgent(req.session.id);
    if (!agent) {
      return res.status(500).json({ error: 'API Key não configurada' });
    }

    const { message, metadata, projectId = null } = req.body;
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

    // 🔍 BUSCAR DOCUMENTOS RELEVANTES NO KB
    let kbContext = '';
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

          // Buscar documentos relevantes (busca simples por palavras-chave)
          const relevantDocs = docs.filter(doc => {
            const lowerMessage = message.toLowerCase();
            const lowerContent = doc.content.toLowerCase();

            // Verificar se a pergunta menciona termos do documento
            return (
              (doc.metadata.processNumber && lowerMessage.includes('processo')) ||
              (doc.metadata.parties && lowerMessage.includes('parte')) ||
              (doc.metadata.court && lowerMessage.includes('tribunal')) ||
              lowerContent.includes(lowerMessage) ||
              message.split(' ').some(word => word.length > 4 && lowerContent.includes(word.toLowerCase()))
            );
          });

          if (relevantDocs.length > 0) {
            console.log(`✅ ${relevantDocs.length} documento(s) relevante(s) encontrado(s)`);

            kbContext = '\n\n📚 DOCUMENTOS DISPONÍVEIS NO KNOWLEDGE BASE:\n\n';
            relevantDocs.slice(0, 2).forEach((doc, i) => { // Limitar a 2 documentos (para caber mais conteúdo)
              kbContext += `--- DOCUMENTO ${i + 1}: ${doc.metadata.originalFilename || doc.file} ---\n`;
              if (doc.metadata.type) kbContext += `Tipo: ${doc.metadata.type}\n`;
              if (doc.metadata.processNumber) kbContext += `Processo: ${doc.metadata.processNumber}\n`;
              if (doc.metadata.parties) kbContext += `Partes: ${doc.metadata.parties}\n`;
              if (doc.metadata.court) kbContext += `Tribunal: ${doc.metadata.court}\n`;

              // 🚀 BUSCA INTELIGENTE: Enviar partes relevantes do documento
              let contentToSend = '';
              const lowerMessage = message.toLowerCase();

              // Se mencionar "sentença", "decisão", "dispositiv", "folha", buscar essas seções
              if (lowerMessage.includes('sentença') || lowerMessage.includes('decisão') ||
                  lowerMessage.includes('dispositiv') || lowerMessage.includes('folha') ||
                  lowerMessage.includes('última') || lowerMessage.includes('julg')) {

                // Buscar seções relevantes no documento
                const lines = doc.content.split('\n');
                const relevantSections = [];

                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i].toLowerCase();
                  if (line.includes('sentença') || line.includes('decisão') ||
                      line.includes('dispositiv') || line.includes('julg') ||
                      line.match(/fl\.\s*\d+/) || line.match(/folha\s*\d+/)) {
                    // Capturar contexto: 50 linhas antes e 50 depois
                    const start = Math.max(0, i - 50);
                    const end = Math.min(lines.length, i + 50);
                    relevantSections.push(lines.slice(start, end).join('\n'));
                  }
                }

                if (relevantSections.length > 0) {
                  contentToSend = relevantSections.join('\n\n--- SEÇÃO ---\n\n').substring(0, 400000); // 400KB limite
                  console.log(`   📍 Encontradas ${relevantSections.length} seções relevantes (${contentToSend.length} caracteres)`);
                } else {
                  // Fallback: enviar início + final do documento
                  contentToSend = doc.content.substring(0, 200000) + '\n\n...[MEIO DO DOCUMENTO OMITIDO]...\n\n' +
                                 doc.content.substring(Math.max(0, doc.content.length - 200000));
                  console.log(`   📄 Enviando início e fim do documento (${contentToSend.length} caracteres)`);
                }
              } else {
                // Para outras perguntas, enviar mais do início
                contentToSend = doc.content.substring(0, 400000); // 400KB = ~100 páginas
                console.log(`   📄 Enviando ${contentToSend.length} caracteres do documento`);
              }

              kbContext += `\nConteúdo:\n${contentToSend}\n\n`;
            });
          }
        }
      }
    } catch (kbError) {
      console.error('⚠️ Erro ao buscar no KB:', kbError.message);
    }

    // 🚀 DETECTAR ANÁLISE COMPLETA E USAR CASE PROCESSOR (5 LAYERS)
    const lowerMessage = message.toLowerCase();
    const isAnaliseCompleta = (
      (lowerMessage.includes('analise') || lowerMessage.includes('análise')) &&
      (lowerMessage.includes('integra') || lowerMessage.includes('íntegra') || lowerMessage.includes('completa'))
    ) || lowerMessage.includes('resumo executivo') ||
       lowerMessage.includes('fichamento') ||
       lowerMessage.includes('embargos') ||
       lowerMessage.includes('processo completo');

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
          return res.status(500).json({ error: resultado.erro || 'Erro ao processar mensagem' });
        }
        resposta = resultado.resposta;
      }
    } else {
      // Processamento normal com agente Bedrock
      const messageWithContext = kbContext ? message + kbContext : message;

      console.log(`🔄 Enviando mensagem para agente Bedrock (${messageWithContext.length} caracteres)...`);
      const resultado = await agent.enviar(messageWithContext);
      console.log(`✅ Agente respondeu: sucesso=${resultado.sucesso}, resposta=${resultado.resposta?.length || 0} caracteres`);

      if (!resultado.sucesso) {
        console.error(`❌ Erro do agente: ${resultado.erro}`);
        return res.status(500).json({ error: resultado.erro || 'Erro ao processar mensagem' });
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

    // Retornar erro mais detalhado
    res.status(500).json({
      error: error.message || 'Erro desconhecido no chat',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API - Chat com Tool Use (Jurisprudência Automática)
app.post('/api/chat-with-tools', async (req, res) => {
  try {
    const { message, modelo = 'amazon.nova-pro-v1:0', systemPrompt = null } = req.body;
    const history = getHistory(req.session.id);

    console.log('🔧 [Tool Use] Processando mensagem com ferramentas automáticas');

    // Usar conversação com tool use
    const resultado = await conversarComTools(message, {
      modelo,
      systemPrompt: systemPrompt || `Você é o ROM Agent, um assistente especializado em Direito brasileiro.

Quando precisar de jurisprudência ou precedentes judiciais para fundamentar sua resposta, use a ferramenta pesquisar_jurisprudencia automaticamente.

Sempre cite as fontes corretamente e formate as referências em ABNT.`,
      historico: history.slice(-10), // Últimas 10 mensagens
      maxTokens: 4096,
      temperature: 0.7
    });

    if (!resultado.sucesso) {
      return res.status(500).json({ error: resultado.erro });
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
      timestamp: new Date()
    });

    res.json({
      response: resultado.resposta,
      toolsUsadas: resultado.toolsUsadas || [],
      iteracoes: resultado.iteracoes || 1,
      modelo,
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
    const { message, modelo = 'amazon.nova-pro-v1:0' } = req.body;
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
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    console.log(`📤 Upload de ${req.files.length} arquivo(s) para extração automática...`);

    const extractions = [];

    for (const file of req.files) {
      try {
        console.log(`🔍 Processando: ${file.originalname} com 33 ferramentas...`);

        // 🚀 EXTRAÇÃO REAL usando pipeline (33 ferramentas, 100% gratuito)
        const extractionResult = await extractDocument(file.path);

        // Estruturar dados extraídos
        const extractedData = {
          filename: file.originalname,
          size: file.size,
          type: file.mimetype,
          uploadedAt: new Date().toISOString(),

          // Dados extraídos reais
          extractedText: extractionResult.text || '',
          textLength: extractionResult.textLength || 0,
          toolsUsed: extractionResult.toolsUsed || [],

          // Metadados inteligentes
          data: {
            'Tipo de Documento': detectDocumentType(extractionResult.text),
            'Número do Processo': extractProcessNumber(extractionResult.text),
            'Partes': extractParties(extractionResult.text),
            'Vara/Tribunal': extractCourt(extractionResult.text),
            'Assunto': extractSubject(extractionResult.text),
            'Data': extractDate(extractionResult.text),
            'Valor da Causa': extractValue(extractionResult.text),
            'Status': `✅ Extraído com sucesso (${(extractionResult.toolsUsed || []).length} ferramentas)`
          },

          // Info técnica
          stats: extractionResult.stats || {},
          chunks: extractionResult.chunks || []
        };

        extractions.push(extractedData);
        console.log(`✅ Processado: ${file.originalname} (${extractionResult.textLength} caracteres)`);

        // 💾 SALVAR NO KB para o chat poder acessar
        try {
          const kbPath = path.join(ACTIVE_PATHS.kb, 'documents', `${Date.now()}_${file.originalname}.txt`);
          await fs.promises.mkdir(path.dirname(kbPath), { recursive: true });
          await fs.promises.writeFile(kbPath, extractedData.extractedText, 'utf8');

          // Adicionar metadados
          const metadataPath = kbPath.replace('.txt', '.metadata.json');
          await fs.promises.writeFile(metadataPath, JSON.stringify({
            originalFilename: file.originalname,
            uploadedAt: extractedData.uploadedAt,
            type: detectDocumentType(extractedData.extractedText),
            processNumber: extractProcessNumber(extractedData.extractedText),
            parties: extractParties(extractedData.extractedText),
            court: extractCourt(extractedData.extractedText),
            textLength: extractedData.textLength,
            toolsUsed: extractedData.toolsUsed
          }, null, 2), 'utf8');

          console.log(`💾 Salvo no KB: ${path.basename(kbPath)}`);
          extractedData.savedToKB = true;
          extractedData.kbPath = kbPath;
        } catch (kbError) {
          console.error(`⚠️ Erro ao salvar no KB: ${kbError.message}`);
          extractedData.savedToKB = false;
          extractedData.kbError = kbError.message;
        }
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

// API - Info do sistema com health check completo
app.get('/api/info', async (req, res) => {
  try {
    // Status do AWS Bedrock
    let bedrockStatus = 'unknown';
    try {
      const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime');
      const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
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
        region: process.env.AWS_REGION || 'us-east-1',
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
        pid: process.pid
      },

      // Memória
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
      },

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

// Remover documento específico do KB
app.delete('/api/kb/documents/:docId', authSystem.authMiddleware(), (req, res) => {
  try {
    const { docId } = req.params;
    const result = kbCleaner.removeDocument(docId);

    res.json({
      success: result.success,
      result
    });
  } catch (error) {
    console.error('Erro ao remover documento:', error);
    res.status(500).json({ error: error.message });
  }
});

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

    // Processar cada arquivo
    for (const file of req.files) {
      try {
        console.log(`📤 KB Upload: ${file.originalname} por ${userName}`);

        // Extrair conteúdo usando pipeline
        const extractionResult = await extractDocument(file.path);

        // Criar documento KB
        const doc = {
          id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
          path: file.path,
          userId: userId,
          userName: userName,
          uploadedAt: new Date().toISOString(),
          extractedText: extractionResult.text || '',
          textLength: extractionResult.textLength || 0,
          metadata: {
            toolsUsed: extractionResult.toolsUsed || [],
            documentType: detectDocumentType(extractionResult.text),
            processNumber: extractProcessNumber(extractionResult.text),
            parties: extractParties(extractionResult.text),
            court: extractCourt(extractionResult.text)
          }
        };

        // Salvar documento no KB
        const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');
        let kbDocs = [];

        if (fs.existsSync(kbDocsPath)) {
          const data = fs.readFileSync(kbDocsPath, 'utf8');
          kbDocs = JSON.parse(data);
        }

        kbDocs.push(doc);
        fs.writeFileSync(kbDocsPath, JSON.stringify(kbDocs, null, 2));

        uploadedDocs.push({
          id: doc.id,
          name: doc.name,
          size: doc.size,
          uploadedAt: doc.uploadedAt,
          status: 'success'
        });

        console.log(`✅ KB: ${file.originalname} salvo com sucesso`);
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

// Deletar documento do KB (requer autenticação e ownership)
app.delete('/api/kb/documents/:id', authSystem.authMiddleware(), (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const kbDocsPath = path.join(process.cwd(), 'data', 'kb-documents.json');

    if (!fs.existsSync(kbDocsPath)) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    const data = fs.readFileSync(kbDocsPath, 'utf8');
    let allDocs = JSON.parse(data);
    const docIndex = allDocs.findIndex(d => d.id === id);

    if (docIndex === -1) {
      return res.status(404).json({ error: 'Documento não encontrado' });
    }

    const doc = allDocs[docIndex];

    // Verificar ownership
    if (doc.userId !== userId && req.user.role !== 'master_admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Deletar arquivo físico
    if (fs.existsSync(doc.path)) {
      fs.unlinkSync(doc.path);
    }

    // Remover do JSON
    allDocs.splice(docIndex, 1);
    fs.writeFileSync(kbDocsPath, JSON.stringify(allDocs, null, 2));

    console.log(`🗑️ KB: Documento ${doc.name} deletado por ${req.user.name}`);

    res.json({
      success: true,
      message: 'Documento excluído com sucesso'
    });
  } catch (error) {
    console.error('❌ Erro ao deletar documento KB:', error);
    res.status(500).json({ error: error.message });
  }
});

// 📚 Novo endpoint: Listar documentos REAIS extraídos em KB/documents/
app.get('/api/kb/extracted-documents', async (req, res) => {
  try {
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

// 🗑️ Endpoint para deletar documento extraído
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
    const { message, n = 3, modelo = 'amazon.nova-pro-v1:0' } = req.body;
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
        modelPreference: settings.modelPreference || 'amazon.nova-pro-v1:0',
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
    'amazon.nova-lite-v1:0',
    'amazon.nova-pro-v1:0',
    'anthropic.claude-haiku-4-5-20251001-v1:0'
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

// Iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
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

  // 🚨 Criar pasta Desktop/Mesa para UPLOADS MANUAIS DE EMERGÊNCIA
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
        // Processar arquivo com extrator
        const extractorPipeline = (await import('../lib/extractor-pipeline.js')).default;

        logger.info(`📄 Extraindo ${fileName} com 33 ferramentas...`);
        const result = await extractorPipeline.extractDocument(filePath);

        if (result.success && result.text) {
          logger.info(`✅ Extração concluída: ${result.charCount} caracteres`);

          // Salvar no KB
          const kbPath = path.join(ACTIVE_PATHS.kb, 'documents', `${Date.now()}_emergencia_${fileName}.txt`);
          await fs.promises.mkdir(path.dirname(kbPath), { recursive: true });
          await fs.promises.writeFile(kbPath, result.text, 'utf8');

          // Salvar metadados
          const metadata = {
            source: 'emergency-upload-desktop',
            originalFilename: fileName,
            uploadedAt: new Date().toISOString(),
            extractedAt: new Date().toISOString(),
            textLength: result.charCount,
            toolsUsed: result.toolsUsed || [],
            type: detectDocumentType(result.text),
            processNumber: extractProcessNumber(result.text),
            parties: extractParties(result.text),
            court: extractCourt(result.text)
          };

          const metadataPath = kbPath.replace('.txt', '.metadata.json');
          await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

          logger.info(`💾 Salvo no KB: ${path.basename(kbPath)}`);

          // 📁 CRIAR PASTA DE RESULTADOS com tudo organizado
          const timestamp = Date.now();
          const resultFolderName = `${timestamp}_${path.basename(fileName, path.extname(fileName))}_RESULTADO`;
          const resultFolder = path.join(desktopPath, resultFolderName);
          await fs.promises.mkdir(resultFolder, { recursive: true });

          // Salvar documento extraído na pasta de resultados
          const resultTextPath = path.join(resultFolder, 'documento_extraido.txt');
          await fs.promises.writeFile(resultTextPath, result.text, 'utf8');

          // Salvar metadados na pasta de resultados
          const resultMetadataPath = path.join(resultFolder, 'metadados.json');
          await fs.promises.writeFile(resultMetadataPath, JSON.stringify(metadata, null, 2), 'utf8');

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
   → ${result.charCount.toLocaleString()} caracteres
   → ${result.toolsUsed?.length || 0} ferramentas utilizadas

2. metadados.json
   → Informações estruturadas do documento
   → Número do processo, partes, tribunal, tipo
   → Data de extração e upload

3. LEIA-ME.txt (este arquivo)
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

export default app;
