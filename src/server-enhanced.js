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
import partnersBranding from '../lib/partners-branding.js';
import formattingTemplates from '../lib/formatting-templates.js';
import dotenv from 'dotenv';

// Importar módulos CommonJS
const require = createRequire(import.meta.url);
const IntegradorSistema = require('../lib/integrador-sistema.js');
const PromptsManager = require('../lib/prompts-manager.js');
const PromptsVersioning = require('../lib/prompts-versioning.js');

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Sessões para histórico
app.use(session({
  secret: process.env.SESSION_SECRET || 'rom-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 dias
}));

// Configurar multer para upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../upload');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
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

// Configurar multer para upload de logos
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const partnersDir = path.join(__dirname, '../public/img/partners');
    if (!fs.existsSync(partnersDir)) {
      fs.mkdirSync(partnersDir, { recursive: true });
    }
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

// Armazenar instâncias de agente por sessão
const agents = new Map();

// Armazenar histórico de conversas
const conversationHistory = new Map();

// Inicializar agente para sessão
function getAgent(sessionId) {
  if (!agents.has(sessionId)) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      agents.set(sessionId, new ROMAgent(apiKey));
    }
  }
  return agents.get(sessionId);
}

// Obter histórico de conversa
function getHistory(sessionId) {
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, []);
  }
  return conversationHistory.get(sessionId);
}

// Rota principal - Interface melhorada
app.get('/', (req, res) => {
  res.send(getEnhancedHTML());
});

// API - Processar mensagem com streaming
app.post('/api/chat', async (req, res) => {
  try {
    const agent = getAgent(req.session.id);
    if (!agent) {
      return res.status(500).json({ error: 'API Key não configurada' });
    }

    const { message, metadata } = req.body;
    const history = getHistory(req.session.id);

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

    // Adicionar mensagem do usuário ao histórico
    history.push({
      role: 'user',
      content: message,
      metadata: metadata || {},
      contextoEnriquecido,
      timestamp: new Date()
    });

    // Processar com agente
    const resposta = await agent.processar(message);

    // Adicionar resposta ao histórico
    history.push({ role: 'assistant', content: resposta, timestamp: new Date() });

    // Preparar resposta com metadados de verificação
    const response = {
      response: resposta,
      metadados: contextoEnriquecido?.metadados || {},
      recomendacoes: contextoEnriquecido?.recomendacoes || [],
      verificacaoRealizada: !!contextoEnriquecido
    };

    res.json(response);
  } catch (error) {
    console.error('Erro no chat:', error);
    res.status(500).json({ error: error.message });
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

// API - Limpar histórico
app.post('/api/clear', (req, res) => {
  const sessionId = req.session.id;
  if (agents.has(sessionId)) {
    agents.get(sessionId).limparHistorico();
  }
  conversationHistory.set(sessionId, []);
  res.json({ success: true });
});

// API - Obter histórico
app.get('/api/history', (req, res) => {
  const history = getHistory(req.session.id);
  res.json({ history });
});

// API - Listar prompts
app.get('/api/prompts', (req, res) => {
  const agent = getAgent(req.session.id);
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

// API - Autenticação simples (para demonstração)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Autenticação básica (TROCAR por sistema real em produção!)
  const validUsers = {
    'admin': 'admin123',
    'demo': 'demo123'
  };

  if (validUsers[username] === password) {
    req.session.authenticated = true;
    req.session.username = username;
    res.json({ success: true, username });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: !!req.session.authenticated,
    username: req.session.username || null,
    partnerId: req.session.partnerId || 'rom'
  });
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
app.put('/api/formatting/template/:partnerId', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin ou do próprio parceiro
    const { partnerId } = req.params;
    const { templateId, customizations } = req.body;

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
      template: updatedTemplate
    });
  } catch (error) {
    console.error('Erro ao configurar template:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar apenas customizações de um parceiro
app.patch('/api/formatting/template/:partnerId', (req, res) => {
  try {
    // TODO: Adicionar verificação de admin ou do próprio parceiro
    const { partnerId } = req.params;
    const { customizations } = req.body;

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
});

export default app;
