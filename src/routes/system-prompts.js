/**
 * System Prompts API Routes
 *
 * Gerenciamento de system prompts usando PromptsManager
 * - Suporta prompts globais e específicos de parceiro
 * - Integração com custom-instructions.json
 * - Sistema multi-tenant
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs/promises';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar PromptsManager (CommonJS module)
const require = createRequire(import.meta.url);
const PromptsManager = require('../../lib/prompts-manager.cjs');

/**
 * GET /api/system-prompts
 * Lista todos os system prompts (globais + parceiro)
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    const partnerId = req.session?.user?.partnerId || 'global';
    const userRole = req.session?.user?.role || 'user';

    // Listar prompts usando PromptsManager
    const prompts = PromptsManager.listarPrompts(partnerId, userRole);

    // LOG DETALHADO: Ver o que está sendo retornado
    console.log('[System Prompts] GET - Lista de prompts:', {
      partnerId,
      userRole,
      globalCount: prompts.global?.length || 0,
      partnerCount: prompts.partner?.length || 0,
      globalPrompts: prompts.global?.map(p => p.name).slice(0, 10) || [],
      hasMetodo: prompts.global?.some(p => p.name.toLowerCase().includes('metodo')) || false
    });

    // Adicionar informações de debug sobre persistência
    const autoMigrate = require('../../lib/prompts-auto-migrate.js');
    const baseDir = autoMigrate.getPromptsDirectory();

    const debugInfo = {
      baseDir,
      isPersistent: baseDir.includes('/var/data'),
      environment: process.env.NODE_ENV || 'development',
      promptsFolder: baseDir
    };

    res.json({
      success: true,
      prompts,
      ...debugInfo  // Incluir info de debug na resposta
    });
  } catch (error) {
    console.error('Erro ao listar system prompts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/system-prompts/:type/:id
 * Obtém conteúdo de um prompt específico
 * type: 'global' | 'partner'
 * id: ID do prompt
 */
router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const partnerId = req.session?.user?.partnerId || 'global';

    // Obter prompt usando PromptsManager (apenas ID, sem prefixo)
    const promptData = PromptsManager.obterPrompt(id, partnerId);

    if (!promptData) {
      return res.status(404).json({
        success: false,
        error: 'Prompt não encontrado'
      });
    }

    // Retornar apenas o conteúdo de texto (string), não o objeto completo
    res.json({
      success: true,
      content: promptData.content
    });
  } catch (error) {
    console.error('Erro ao obter system prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/system-prompts/:type/:id
 * Atualiza conteúdo de um prompt
 */
router.put('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { content } = req.body;
    const partnerId = req.session?.user?.partnerId || 'global';
    const userRole = req.session?.user?.role || 'user';

    // ✅ Validar permissões - incluir admin
    if (type === 'global' && userRole !== 'master_admin') {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar prompts globais'
      });
    }

    if (type === 'partner' && !['admin', 'partner_admin', 'master_admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar prompts do parceiro'
      });
    }

    // Determinar caminho do arquivo (usar diretório correto)
    const autoMigrate = require('../../lib/prompts-auto-migrate.js');
    const promptsDir = autoMigrate.getPromptsDirectory();
    const filePath = type === 'global'
      ? path.join(promptsDir, 'global', `${id}.md`)
      : path.join(promptsDir, 'partners', partnerId, `${id}.md`);

    // Criar diretórios se não existirem
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });

    // Salvar prompt
    await fs.writeFile(filePath, content, 'utf8');

    // Recarregar PromptsManager (se tiver método de reload)
    if (typeof PromptsManager.recarregar === 'function') {
      PromptsManager.recarregar();
    }

    res.json({
      success: true,
      message: 'Prompt atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar system prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/system-prompts
 * Cria novo prompt
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, content } = req.body;
    const partnerId = req.session?.user?.partnerId || 'global';
    const userRole = req.session?.user?.role || 'user';

    // Debug log para diagnóstico
    console.log('[System Prompts] POST - Tentativa de criação:', {
      name,
      type,
      userRole,
      partnerId,
      userEmail: req.session?.user?.email
    });

    // ✅ Validar permissões - incluir admin
    if (type === 'global' && userRole !== 'master_admin') {
      console.warn('[System Prompts] POST - Permissão negada (global):', { userRole, type });
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para criar prompts globais. Apenas master_admin pode criar prompts globais.',
        details: { userRole, required: 'master_admin' }
      });
    }

    if (type === 'partner' && !['admin', 'partner_admin', 'master_admin'].includes(userRole)) {
      console.warn('[System Prompts] POST - Permissão negada (partner):', { userRole, type });
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para criar prompts do parceiro. Necessário: admin, partner_admin ou master_admin.',
        details: { userRole, required: ['admin', 'partner_admin', 'master_admin'] }
      });
    }

    // Gerar ID a partir do nome
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Determinar caminho do arquivo (usar diretório correto)
    const autoMigrate = require('../../lib/prompts-auto-migrate.js');
    const promptsDir = autoMigrate.getPromptsDirectory();
    const filePath = type === 'global'
      ? path.join(promptsDir, 'global', `${id}.md`)
      : path.join(promptsDir, 'partners', partnerId, `${id}.md`);

    // Verificar se já existe
    try {
      await fs.access(filePath);
      return res.status(409).json({
        success: false,
        error: 'Prompt com esse nome já existe'
      });
    } catch {
      // Arquivo não existe, pode criar
    }

    // Criar diretórios
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });

    // Salvar prompt
    await fs.writeFile(filePath, content || `# ${name}\n\n`, 'utf8');

    // Recarregar PromptsManager
    if (typeof PromptsManager.recarregar === 'function') {
      PromptsManager.recarregar();
    }

    res.json({
      success: true,
      message: 'Prompt criado com sucesso',
      id
    });
  } catch (error) {
    console.error('Erro ao criar system prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/system-prompts/:type/:id
 * Deleta um prompt
 */
router.delete('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const partnerId = req.session?.user?.partnerId || 'global';
    const userRole = req.session?.user?.role || 'user';

    // ✅ Validar permissões - incluir admin
    if (type === 'global' && userRole !== 'master_admin') {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para deletar prompts globais'
      });
    }

    if (type === 'partner' && !['admin', 'partner_admin', 'master_admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para deletar prompts do parceiro'
      });
    }

    // Determinar caminho do arquivo (usar diretório correto)
    const autoMigrate = require('../../lib/prompts-auto-migrate.js');
    const promptsDir = autoMigrate.getPromptsDirectory();
    const filePath = type === 'global'
      ? path.join(promptsDir, 'global', `${id}.md`)
      : path.join(promptsDir, 'partners', partnerId, `${id}.md`);

    // Deletar arquivo
    await fs.unlink(filePath);

    // Recarregar PromptsManager
    if (typeof PromptsManager.recarregar === 'function') {
      PromptsManager.recarregar();
    }

    res.json({
      success: true,
      message: 'Prompt deletado com sucesso'
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        error: 'Prompt não encontrado'
      });
    }

    console.error('Erro ao deletar system prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
