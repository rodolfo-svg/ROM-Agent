import express from 'express';
import fs from 'fs';
import path from 'path';
import { customInstructionsManager } from '../../lib/custom-instructions-manager.js';
import { customInstructionsAnalyzer } from '../../lib/custom-instructions-analyzer.js';
import { ACTIVE_PATHS } from '../../lib/storage-config.js';
import { requireAuth } from '../middleware/auth.js';
import {
  canEditCustomInstructions,
  canViewCustomInstructions,
  canListCustomInstructions,
  canApplySuggestions,
  canRollbackVersion
} from '../middleware/custom-instructions-auth.js';

const router = express.Router();

/**
 * Middleware para garantir que req.user esteja disponível
 * (converte req.session.user para req.user)
 */
function ensureUser(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
}

// Aplicar ensureUser em todas as rotas
router.use(ensureUser);

/**
 * GET /api/custom-instructions/:partnerId
 * Retorna Custom Instructions de um parceiro específico
 *
 * Permissões:
 * - master_admin: Pode acessar qualquer partnerId
 * - partner_admin/user: Pode acessar apenas o próprio partnerId
 *
 * Exemplos:
 * - GET /api/custom-instructions/rom
 * - GET /api/custom-instructions/parceiro1
 */
router.get('/:partnerId', requireAuth, canViewCustomInstructions, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const data = customInstructionsManager.load(partnerId);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao carregar:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar Custom Instructions',
      details: error.message
    });
  }
});

/**
 * GET /api/custom-instructions
 * Lista Custom Instructions disponíveis para o usuário
 *
 * Comportamento:
 * - master_admin: Lista todos os escritórios
 * - partner_admin/user: Lista apenas o próprio escritório
 */
router.get('/', requireAuth, canListCustomInstructions, async (req, res) => {
  try {
    const filter = req.customInstructionsFilter;

    if (filter.canViewAll) {
      // master_admin: Lista todos os escritórios
      const partnersDir = path.join(ACTIVE_PATHS.data, 'custom-instructions');

      if (!fs.existsSync(partnersDir)) {
        return res.json({
          success: true,
          partners: []
        });
      }

      const partners = fs.readdirSync(partnersDir)
        .filter(f => {
          const fullPath = path.join(partnersDir, f);
          return fs.statSync(fullPath).isDirectory();
        })
        .map(partnerId => {
          try {
            const data = customInstructionsManager.load(partnerId);
            return {
              partnerId,
              version: data.version,
              lastUpdated: data.lastUpdated,
              updatedBy: data.updatedBy,
              settings: data.settings
            };
          } catch (error) {
            console.error(`[Custom Instructions API] Erro ao carregar partnerId ${partnerId}:`, error);
            return null;
          }
        })
        .filter(p => p !== null);

      res.json({
        success: true,
        partners
      });
    } else {
      // partner_admin/user: Retorna apenas do próprio escritório
      const partnerId = filter.partnerIds[0];
      const data = customInstructionsManager.load(partnerId);

      res.json({
        success: true,
        partners: [{
          partnerId,
          version: data.version,
          lastUpdated: data.lastUpdated,
          updatedBy: data.updatedBy,
          settings: data.settings
        }]
      });
    }
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao listar:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar Custom Instructions',
      details: error.message
    });
  }
});

/**
 * GET /api/custom-instructions/:partnerId/preview
 * Preview do texto compilado para um parceiro
 *
 * Retorna o texto final que será usado no prompt (3 componentes concatenados)
 */
router.get('/:partnerId/preview', requireAuth, canViewCustomInstructions, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const compiledText = customInstructionsManager.getCompiledText(partnerId);
    const components = customInstructionsManager.getComponents(partnerId);

    res.json({
      success: true,
      compiledText,
      components: components.map(c => ({
        id: c.id,
        name: c.name,
        order: c.order,
        enabled: c.enabled,
        metadata: c.metadata
      })),
      totalEstimatedTokens: components.reduce((sum, c) => sum + (c.metadata?.estimatedTokens || 0), 0)
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao gerar preview:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao gerar preview',
      details: error.message
    });
  }
});

/**
 * PUT /api/custom-instructions/:partnerId
 * Atualiza Custom Instructions de um parceiro
 *
 * Permissões:
 * - master_admin: Pode editar qualquer parceiro
 * - partner_admin: Pode editar apenas o próprio
 *
 * Body:
 * {
 *   components: { ... },
 *   settings: { ... }
 * }
 */
router.put('/:partnerId', requireAuth, canEditCustomInstructions, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { components, settings } = req.body;

    if (!components && !settings) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma alteração fornecida (components ou settings)'
      });
    }

    const currentData = customInstructionsManager.load(partnerId);

    // Atualiza componentes
    if (components) {
      Object.keys(components).forEach(key => {
        if (currentData.components[key]) {
          currentData.components[key] = {
            ...currentData.components[key],
            ...components[key]
          };

          // Recalcula metadados se houver novo texto
          if (components[key].content && components[key].content.text) {
            currentData.components[key].metadata = customInstructionsManager.calculateMetadata(
              components[key].content.text
            );
          }
        }
      });
    }

    // Atualiza settings
    if (settings) {
      currentData.settings = {
        ...currentData.settings,
        ...settings
      };
    }

    // Salva
    const updatedData = await customInstructionsManager.save(
      currentData,
      req.user.id,
      partnerId
    );

    res.json({
      success: true,
      data: updatedData,
      message: 'Custom Instructions atualizadas com sucesso'
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao atualizar:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar Custom Instructions',
      details: error.message
    });
  }
});

/**
 * POST /api/custom-instructions/:partnerId/components/:componentId
 * Atualiza componente específico de um parceiro
 *
 * Body:
 * {
 *   html: "<p>...</p>",
 *   markdown: "# ...",
 *   text: "..."
 * }
 */
router.post('/:partnerId/components/:componentId', requireAuth, canEditCustomInstructions, async (req, res) => {
  try {
    const { partnerId, componentId } = req.params;
    const { html, markdown, text } = req.body;

    if (!html && !markdown && !text) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum conteúdo fornecido (html, markdown ou text)'
      });
    }

    const currentData = customInstructionsManager.load(partnerId);

    if (!currentData.components[componentId]) {
      return res.status(404).json({
        success: false,
        error: 'Componente não encontrado',
        availableComponents: Object.keys(currentData.components)
      });
    }

    // Atualiza conteúdo
    currentData.components[componentId].content = {
      html: html || currentData.components[componentId].content.html,
      markdown: markdown || currentData.components[componentId].content.markdown,
      text: text || currentData.components[componentId].content.text
    };

    // Atualiza metadados baseado no texto
    const finalText = text || currentData.components[componentId].content.text;
    currentData.components[componentId].metadata = customInstructionsManager.calculateMetadata(finalText);

    // Salva
    const updatedData = await customInstructionsManager.save(
      currentData,
      req.user.id,
      partnerId
    );

    res.json({
      success: true,
      data: updatedData.components[componentId],
      message: 'Componente atualizado com sucesso'
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao atualizar componente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar componente',
      details: error.message
    });
  }
});

/**
 * GET /api/custom-instructions/:partnerId/versions
 * Lista versões históricas de um parceiro
 *
 * Retorna: Array com informações resumidas de cada versão
 */
router.get('/:partnerId/versions', requireAuth, canViewCustomInstructions, async (req, res) => {
  try {
    const { partnerId } = req.params;

    const versionsDir = path.join(
      ACTIVE_PATHS.data,
      'custom-instructions',
      partnerId,
      'versions'
    );

    if (!fs.existsSync(versionsDir)) {
      return res.json({
        success: true,
        versions: []
      });
    }

    const files = fs.readdirSync(versionsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const content = JSON.parse(
            fs.readFileSync(path.join(versionsDir, f), 'utf-8')
          );
          return {
            version: content.version,
            date: content.lastUpdated,
            updatedBy: content.updatedBy,
            filename: f
          };
        } catch (error) {
          console.error(`[Custom Instructions API] Erro ao ler versão ${f}:`, error);
          return null;
        }
      })
      .filter(v => v !== null)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      versions: files
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao listar versões:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar versões',
      details: error.message
    });
  }
});

/**
 * POST /api/custom-instructions/:partnerId/rollback/:version
 * Rollback para versão específica de um parceiro
 *
 * Permissões: APENAS master_admin
 *
 * IMPORTANTE: Não sobrescreve, cria nova versão baseada na versão antiga
 */
router.post('/:partnerId/rollback/:version', requireAuth, canRollbackVersion, async (req, res) => {
  try {
    const { partnerId, version } = req.params;

    const versionPath = path.join(
      ACTIVE_PATHS.data,
      'custom-instructions',
      partnerId,
      'versions',
      `v${version}.json`
    );

    if (!fs.existsSync(versionPath)) {
      return res.status(404).json({
        success: false,
        error: 'Versão não encontrada',
        requestedVersion: version
      });
    }

    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));

    // Salva como nova versão (não sobrescreve)
    const updatedData = await customInstructionsManager.save(
      versionData,
      `${req.user.id}_rollback`,
      partnerId
    );

    res.json({
      success: true,
      data: updatedData,
      message: `Rollback para versão ${version} realizado com sucesso`,
      newVersion: updatedData.version
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao fazer rollback:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao fazer rollback',
      details: error.message
    });
  }
});

/**
 * GET /api/custom-instructions/:partnerId/versions/:version
 * Retorna conteúdo completo de uma versão específica
 *
 * Útil para comparar versões ou visualizar histórico detalhado
 */
router.get('/:partnerId/versions/:version', requireAuth, canViewCustomInstructions, async (req, res) => {
  try {
    const { partnerId, version } = req.params;

    const versionPath = path.join(
      ACTIVE_PATHS.data,
      'custom-instructions',
      partnerId,
      'versions',
      `v${version}.json`
    );

    if (!fs.existsSync(versionPath)) {
      return res.status(404).json({
        success: false,
        error: 'Versão não encontrada',
        requestedVersion: version
      });
    }

    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));

    res.json({
      success: true,
      data: versionData
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao carregar versão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar versão',
      details: error.message
    });
  }
});

/**
 * DELETE /api/custom-instructions/:partnerId/components/:componentId/disable
 * Desabilita componente específico (não deleta, apenas marca enabled: false)
 *
 * Útil para testar o impacto de remover um componente temporariamente
 */
router.post('/:partnerId/components/:componentId/disable', requireAuth, canEditCustomInstructions, async (req, res) => {
  try {
    const { partnerId, componentId } = req.params;

    const currentData = customInstructionsManager.load(partnerId);

    if (!currentData.components[componentId]) {
      return res.status(404).json({
        success: false,
        error: 'Componente não encontrado'
      });
    }

    currentData.components[componentId].enabled = false;

    const updatedData = await customInstructionsManager.save(
      currentData,
      req.user.id,
      partnerId
    );

    res.json({
      success: true,
      data: updatedData,
      message: 'Componente desabilitado com sucesso'
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao desabilitar componente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao desabilitar componente',
      details: error.message
    });
  }
});

/**
 * POST /api/custom-instructions/:partnerId/components/:componentId/enable
 * Reabilita componente específico
 */
router.post('/:partnerId/components/:componentId/enable', requireAuth, canEditCustomInstructions, async (req, res) => {
  try {
    const { partnerId, componentId } = req.params;

    const currentData = customInstructionsManager.load(partnerId);

    if (!currentData.components[componentId]) {
      return res.status(404).json({
        success: false,
        error: 'Componente não encontrado'
      });
    }

    currentData.components[componentId].enabled = true;

    const updatedData = await customInstructionsManager.save(
      currentData,
      req.user.id,
      partnerId
    );

    res.json({
      success: true,
      data: updatedData,
      message: 'Componente habilitado com sucesso'
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao habilitar componente:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao habilitar componente',
      details: error.message
    });
  }
});

/**
 * GET /api/custom-instructions/:partnerId/suggestions
 * Lista sugestões pendentes de IA para um parceiro
 */
router.get('/:partnerId/suggestions', requireAuth, canViewCustomInstructions, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const suggestions = customInstructionsAnalyzer.getPendingSuggestions(partnerId);

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao listar sugestões:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar sugestões',
      details: error.message
    });
  }
});

/**
 * POST /api/custom-instructions/:partnerId/suggestions/:suggestionId/apply
 * Aplica sugestão aprovada
 */
router.post('/:partnerId/suggestions/:suggestionId/apply', requireAuth, canApplySuggestions, async (req, res) => {
  try {
    const { partnerId, suggestionId } = req.params;

    await customInstructionsAnalyzer.applySuggestion(suggestionId, partnerId);

    res.json({
      success: true,
      message: 'Sugestão aplicada com sucesso'
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao aplicar sugestão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao aplicar sugestão',
      details: error.message
    });
  }
});

/**
 * POST /api/custom-instructions/:partnerId/suggestions/:suggestionId/reject
 * Rejeita sugestão
 */
router.post('/:partnerId/suggestions/:suggestionId/reject', requireAuth, canApplySuggestions, async (req, res) => {
  try {
    const { partnerId, suggestionId } = req.params;

    await customInstructionsAnalyzer.rejectSuggestion(suggestionId, partnerId);

    res.json({
      success: true,
      message: 'Sugestão rejeitada'
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao rejeitar sugestão:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao rejeitar sugestão',
      details: error.message
    });
  }
});

/**
 * POST /api/custom-instructions/:partnerId/trigger-analysis
 * Força análise imediata (trigger manual)
 */
router.post('/:partnerId/trigger-analysis', requireAuth, canEditCustomInstructions, async (req, res) => {
  try {
    const { partnerId } = req.params;

    // Gera sugestões
    const suggestionsData = await customInstructionsAnalyzer.generateSuggestions(partnerId);

    // Salva sugestões
    await customInstructionsAnalyzer.saveSuggestions(suggestionsData, partnerId);

    res.json({
      success: true,
      message: 'Análise concluída com sucesso',
      suggestionsCount: suggestionsData.suggestions.length
    });
  } catch (error) {
    console.error('[Custom Instructions API] Erro ao executar análise:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao executar análise',
      details: error.message
    });
  }
});

export default router;
