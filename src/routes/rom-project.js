/**
 * ROM Project API Routes
 *
 * Endpoints para gerenciar Custom Instructions, Prompts e Templates do Projeto ROM
 * Sistema autoatualizável de prompts jurídicos
 *
 * ✅ SEGURANÇA:
 * - GET (leitura): Público, sem autenticação
 * - POST/PUT/DELETE (escrita): Requer autenticação + permissões admin
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import romProjectService from '../services/rom-project-service.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// MIDDLEWARE DE SEGURANÇA
// ==========================================

/**
 * Middleware para verificar se usuário pode editar prompts/custom instructions
 * Apenas admin, partner_admin e master_admin podem editar
 */
function requireAdminPermissions(req, res, next) {
  const userRole = req.session?.user?.role || 'user';

  if (!['admin', 'partner_admin', 'master_admin'].includes(userRole)) {
    return res.status(403).json({
      success: false,
      error: 'Sem permissão para editar. Apenas administradores podem criar/editar/deletar prompts.',
      code: 'PERMISSION_DENIED'
    });
  }

  next();
}

// Configurar multer para upload de arquivos no KB
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const kbPath = path.join(__dirname, '../../data/rom-project/kb/uploads');
    cb(null, kbPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limite
  }
});

// ==========================================
// CUSTOM INSTRUCTIONS
// ==========================================

/**
 * GET /api/rom-project/custom-instructions
 * Obter custom instructions atuais
 */
router.get('/custom-instructions', async (req, res) => {
  try {
    const instructions = romProjectService.getCustomInstructions();

    res.json({
      success: true,
      customInstructions: instructions
    });
  } catch (error) {
    console.error('Erro ao obter custom instructions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/rom-project/custom-instructions
 * Atualizar custom instructions
 * ✅ PROTEGIDO: Requer permissões de admin
 */
router.put('/custom-instructions', requireAdminPermissions, async (req, res) => {
  try {
    const updates = req.body;
    const userEmail = req.session?.user?.email || 'unknown';

    await romProjectService.updateCustomInstructions(updates);

    console.log(`[ROM-PROJECT] Custom instructions atualizadas por: ${userEmail}`);

    res.json({
      success: true,
      message: 'Custom instructions atualizadas com sucesso',
      customInstructions: romProjectService.getCustomInstructions()
    });
  } catch (error) {
    console.error('Erro ao atualizar custom instructions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// PROMPTS
// ==========================================

/**
 * GET /api/rom-project/prompts
 * Listar todos os prompts ou filtrar por categoria
 * Query params: category (judiciais|extrajudiciais|gerais)
 */
router.get('/prompts', async (req, res) => {
  try {
    const { category } = req.query;

    if (category) {
      const prompts = romProjectService.getPromptsByCategory(category);
      res.json({
        success: true,
        category,
        total: Object.keys(prompts).length,
        prompts
      });
    } else {
      const allPrompts = romProjectService.getAllPrompts();
      const totalCount = Object.values(allPrompts).reduce((sum, cat) => sum + Object.keys(cat).length, 0);

      res.json({
        success: true,
        total: totalCount,
        prompts: allPrompts
      });
    }
  } catch (error) {
    console.error('Erro ao listar prompts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rom-project/prompts/:category/:promptId
 * Obter prompt específico
 */
router.get('/prompts/:category/:promptId', async (req, res) => {
  try {
    const { category, promptId } = req.params;

    const prompt = romProjectService.getPrompt(category, promptId);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt não encontrado'
      });
    }

    res.json({
      success: true,
      prompt
    });
  } catch (error) {
    console.error('Erro ao obter prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rom-project/prompts/:category/:promptId
 * Criar ou atualizar prompt
 * ✅ PROTEGIDO: Requer permissões de admin
 */
router.post('/prompts/:category/:promptId', requireAdminPermissions, async (req, res) => {
  try {
    const { category, promptId } = req.params;
    const promptData = req.body;
    const userEmail = req.session?.user?.email || 'unknown';

    await romProjectService.savePrompt(category, promptId, promptData);

    console.log(`[ROM-PROJECT] Prompt salvo por ${userEmail}: ${category}/${promptId}`);

    res.json({
      success: true,
      message: 'Prompt salvo com sucesso',
      promptId,
      category,
      prompt: romProjectService.getPrompt(category, promptId)
    });
  } catch (error) {
    console.error('Erro ao salvar prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/rom-project/prompts/:category/:promptId
 * Deletar prompt
 * ✅ PROTEGIDO: Requer permissões de admin
 */
router.delete('/prompts/:category/:promptId', requireAdminPermissions, async (req, res) => {
  try {
    const { category, promptId } = req.params;
    const userEmail = req.session?.user?.email || 'unknown';

    await romProjectService.deletePrompt(category, promptId);

    console.log(`[ROM-PROJECT] Prompt deletado por ${userEmail}: ${category}/${promptId}`);

    res.json({
      success: true,
      message: 'Prompt deletado com sucesso',
      promptId,
      category
    });
  } catch (error) {
    console.error('Erro ao deletar prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rom-project/prompts/search
 * Buscar prompts por palavra-chave
 * Query params: keyword
 */
router.get('/prompts/search', async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro keyword é obrigatório'
      });
    }

    const results = romProjectService.searchPrompts(keyword);

    res.json({
      success: true,
      keyword,
      total: results.length,
      results
    });
  } catch (error) {
    console.error('Erro ao buscar prompts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rom-project/prompts/:category/:promptId/generate
 * Gerar prompt completo para uso no chat
 * Body: { context: {...} }
 */
router.post('/prompts/:category/:promptId/generate', async (req, res) => {
  try {
    const { category, promptId } = req.params;
    const { context } = req.body;

    const fullPrompt = romProjectService.generateFullPrompt(category, promptId, context);

    res.json({
      success: true,
      fullPrompt
    });
  } catch (error) {
    console.error('Erro ao gerar prompt completo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// TEMPLATES
// ==========================================

/**
 * GET /api/rom-project/templates
 * Listar todos os templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = romProjectService.getTemplates();

    res.json({
      success: true,
      total: Object.keys(templates).length,
      templates
    });
  } catch (error) {
    console.error('Erro ao listar templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rom-project/templates/:templateId
 * Obter template específico
 */
router.get('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;

    const template = romProjectService.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template não encontrado'
      });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Erro ao obter template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rom-project/templates/:templateId
 * Salvar template
 * ✅ PROTEGIDO: Requer permissões de admin
 */
router.post('/templates/:templateId', requireAdminPermissions, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { content } = req.body;
    const userEmail = req.session?.user?.email || 'unknown';

    await romProjectService.saveTemplate(templateId, content);

    console.log(`[ROM-PROJECT] Template salvo por ${userEmail}: ${templateId}`);

    res.json({
      success: true,
      message: 'Template salvo com sucesso',
      templateId
    });
  } catch (error) {
    console.error('Erro ao salvar template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// KNOWLEDGE BASE
// ==========================================

/**
 * POST /api/rom-project/kb/upload
 * Upload de arquivos para Knowledge Base (aceita qualquer extensão)
 *
 * Suporta: PDFs, DOCXs, imagens, vídeos, áudios, planilhas, códigos, etc.
 * Limite: 100MB por arquivo
 * ✅ PROTEGIDO: Requer permissões de admin
 */
router.post('/kb/upload', requireAdminPermissions, upload.array('files', 50), async (req, res) => {
  try {
    const { projectName, category } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      });
    }

    const uploadedFiles = files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString()
    }));

    // Registrar no KB do projeto (se especificado)
    if (projectName) {
      await romProjectService.addToKnowledgeBase(projectName, uploadedFiles, category);
    }

    res.json({
      success: true,
      message: `${files.length} arquivo(s) enviado(s) com sucesso`,
      totalFiles: files.length,
      files: uploadedFiles,
      projectName,
      category
    });

  } catch (error) {
    console.error('Erro no upload para KB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rom-project/kb/files
 * Listar arquivos do Knowledge Base
 * Query params: projectName, category
 */
router.get('/kb/files', async (req, res) => {
  try {
    const { projectName, category } = req.query;

    const files = await romProjectService.listKnowledgeBaseFiles(projectName, category);

    res.json({
      success: true,
      total: files.length,
      projectName,
      category,
      files
    });
  } catch (error) {
    console.error('Erro ao listar arquivos do KB:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// PROJETO COMPLETO
// ==========================================

/**
 * GET /api/rom-project/export
 * Exportar projeto completo (custom instructions + prompts + templates)
 */
router.get('/export', async (req, res) => {
  try {
    const exportData = romProjectService.exportProject();

    res.json({
      success: true,
      project: exportData,
      exportedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao exportar projeto:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/rom-project/import
 * Importar projeto completo
 * Body: { customInstructions, prompts, templates }
 * ✅ PROTEGIDO: Requer permissões de admin
 */
router.post('/import', requireAdminPermissions, async (req, res) => {
  try {
    const { customInstructions, prompts, templates } = req.body;
    const userEmail = req.session?.user?.email || 'unknown';

    await romProjectService.importProject({
      customInstructions,
      prompts,
      templates
    });

    console.log(`[ROM-PROJECT] Projeto importado por ${userEmail}`);

    res.json({
      success: true,
      message: 'Projeto importado com sucesso',
      importedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao importar projeto:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rom-project/stats
 * Estatísticas do projeto
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = romProjectService.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/rom-project/health
 * Health check do projeto ROM
 */
router.get('/health', async (req, res) => {
  try {
    const stats = romProjectService.getStatistics();
    const isHealthy = romProjectService.initialized && stats.prompts.total > 0;

    res.json({
      success: true,
      healthy: isHealthy,
      initialized: romProjectService.initialized,
      version: stats.version,
      lastUpdated: stats.lastUpdated
    });
  } catch (error) {
    console.error('Erro no health check:', error);
    res.status(500).json({
      success: false,
      healthy: false,
      error: error.message
    });
  }
});

export default router;
